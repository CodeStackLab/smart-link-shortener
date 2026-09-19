// ==========================================================================
// PUBLYTICS DEDICATED ANALYTICS DASHBOARD CONTROLLER
// Real-time, Acquisition, Audience, KPIs, User List & Interactive Drill-Downs
// ==========================================================================

(function() {
  'use strict';

  let currentPeriod = 'realtime';
  let currentSiteId = '';
  let currentAcqDim = 'utm_source';
  let autoRefreshTimer = null;
  let isFetching = false;
  let isSuperAdmin = false;

  // Cache of currently loaded data to enable instant drill-downs
  const loadedData = {
    realtime: null,
    overview: null,
    acq: {},
    audience: {},
    users: []
  };

  // Flag Emoji Helper
  function getFlagEmoji(countryCode) {
    if (!countryCode || countryCode === 'Unknown' || countryCode === 'XX') return '🌐';
    const code = String(countryCode).toUpperCase();
    if (code.length !== 2) return '🌐';
    return String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));
  }

  // Formatting helpers
  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString();
  }

  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0s';
    const s = Math.round(Number(seconds));
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    if (mins === 0) return `${rem}s`;
    return `${mins}m ${rem}s`;
  }

  function formatPercent(val) {
    if (val === null || val === undefined || isNaN(val)) return '0%';
    return `${Math.round(Number(val))}%`;
  }

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', async () => {
    initAuthAndConfig();
    initEventListeners();
  });

  async function initAuthAndConfig() {
    try {
      // 1. Session verification
      const sRes = await fetch('/api/session');
      const session = await sRes.json();
      if (!session.authenticated) {
        window.location.href = '/admin';
        return;
      }

      const role = String(session.role || '').toLowerCase();
      const username = String(session.username || '').toLowerCase();
      isSuperAdmin = username === 'admin' || username === 'master admin' || role === 'super admin' || role === 'master admin';

      // 2. Load Publytics Config
      const cfgRes = await fetch('/api/publytics/config');
      const cfg = await cfgRes.json();

      const setupBanner = document.getElementById('setup-banner');
      if (!cfg.hasToken) {
        if (setupBanner) setupBanner.style.display = 'flex';
      } else {
        if (setupBanner) setupBanner.style.display = 'none';
      }

      // Populate config modal form with current values
      if (document.getElementById('cfg-site')) {
        document.getElementById('cfg-site').value = cfg.currentSiteId || '';
      }
      if (document.getElementById('cfg-sites-list') && Array.isArray(cfg.sitesList)) {
        document.getElementById('cfg-sites-list').value = cfg.sitesList.map(s => s.id || s).join('\n');
      }

      // 3. Load Sites into Selector
      await loadSitesList(cfg.currentSiteId);

      // 4. Initial Data Load
      loadCurrentView();
      startAutoRefresh();

    } catch (err) {
      console.error('Initialization error:', err);
    }
  }

  async function loadSitesList(defaultSite) {
    const select = document.getElementById('site-select');
    if (!select) return;

    try {
      const res = await fetch('/api/publytics/sites');
      const data = await res.json();
      const sites = Array.isArray(data.sites) ? data.sites : [];

      select.innerHTML = '';
      if (sites.length === 0) {
        select.innerHTML = `<option value="">Default Site (${defaultSite || 'Not configured'})</option>`;
        currentSiteId = defaultSite || '';
      } else {
        sites.forEach(site => {
          const sId = site.id || site.domain || site;
          const sName = site.name || site.domain || sId;
          const opt = document.createElement('option');
          opt.value = sId;
          opt.textContent = sName;
          if (sId === defaultSite || sId === data.currentSiteId) {
            opt.selected = true;
          }
          select.appendChild(opt);
        });
        currentSiteId = select.value || defaultSite || '';
      }
    } catch {
      select.innerHTML = `<option value="${defaultSite || ''}">${defaultSite || 'Default Site'}</option>`;
      currentSiteId = defaultSite || '';
    }
  }

  function initEventListeners() {
    // Site selector change
    const siteSelect = document.getElementById('site-select');
    if (siteSelect) {
      siteSelect.addEventListener('change', () => {
        currentSiteId = siteSelect.value;
        loadCurrentView();
      });
    }

    // Refresh button
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        loadCurrentView(true);
      });
    }

    // Date range pills
    const pills = document.querySelectorAll('#date-pill-group .pub-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const period = pill.getAttribute('data-period');
        if (period === 'custom') {
          promptCustomDateRange();
          return;
        }

        currentPeriod = period;
        toggleRealtimeHero(currentPeriod === 'realtime');
        loadCurrentView();
      });
    });

    // Acquisition Subtabs
    const acqTabs = document.querySelectorAll('#acq-subtabs .pub-subtab-btn');
    acqTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        acqTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentAcqDim = tab.getAttribute('data-dim');
        loadAcquisition();
      });
    });

    // Auto-refresh checkbox
    const autoRef = document.getElementById('auto-refresh-toggle');
    if (autoRef) {
      autoRef.addEventListener('change', () => {
        if (autoRef.checked) {
          startAutoRefresh();
        } else {
          stopAutoRefresh();
        }
      });
    }

    // Open Config Modal Button
    const btnOpenConfig = document.getElementById('btn-open-config');
    if (btnOpenConfig) {
      btnOpenConfig.addEventListener('click', () => window.openConfigModal());
    }
  }

  function toggleRealtimeHero(show) {
    const hero = document.getElementById('realtime-hero-section');
    if (hero) hero.style.display = show ? 'grid' : 'none';
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshTimer = setInterval(() => {
      const autoRef = document.getElementById('auto-refresh-toggle');
      if (autoRef && autoRef.checked && !isFetching) {
        if (currentPeriod === 'realtime') {
          loadRealtime();
        } else {
          loadCurrentView(false);
        }
      }
    }, 15000);
  }

  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  function promptCustomDateRange() {
    const from = prompt('Enter start date (YYYY-MM-DD):', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
    if (!from) return;
    const to = prompt('Enter end date (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!to) return;

    currentPeriod = `custom&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    toggleRealtimeHero(false);
    loadCurrentView();
  }

  // --- CORE DATA FETCHING ---
  async function loadCurrentView(showSpin = false) {
    if (isFetching) return;
    isFetching = true;

    const icon = document.getElementById('refresh-icon');
    if (icon && showSpin) icon.classList.add('pub-spin');

    try {
      if (currentPeriod === 'realtime') {
        toggleRealtimeHero(true);
        await Promise.allSettled([
          loadRealtime(),
          loadOverview(),
          loadAcquisition(),
          loadAudience(),
          loadUsers()
        ]);
      } else {
        toggleRealtimeHero(false);
        await Promise.allSettled([
          loadOverview(),
          loadAcquisition(),
          loadAudience(),
          loadUsers()
        ]);
      }

      const updatedText = document.getElementById('last-updated-text');
      if (updatedText) {
        updatedText.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
      }
    } finally {
      isFetching = false;
      if (icon) icon.classList.remove('pub-spin');
    }
  }

  // 1. Real-Time
  async function loadRealtime() {
    try {
      const res = await fetch(`/api/publytics/realtime?siteId=${encodeURIComponent(currentSiteId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      loadedData.realtime = data;

      // Update counters
      const active = data.activeVisitors || data.totalVisitors || data.visitors || data.count || 0;
      document.getElementById('rt-active-count').textContent = formatNumber(active);

      if (data.breakdown) {
        document.getElementById('rt-1m').textContent = formatNumber(data.breakdown['1m'] || data['1m'] || 0);
        document.getElementById('rt-5m').textContent = formatNumber(data.breakdown['5m'] || data['5m'] || 0);
        document.getElementById('rt-30m').textContent = formatNumber(data.breakdown['30m'] || data['30m'] || 0);
      } else {
        document.getElementById('rt-1m').textContent = formatNumber(data['1m'] || active);
        document.getElementById('rt-5m').textContent = formatNumber(data['5m'] || active);
        document.getElementById('rt-30m').textContent = formatNumber(data['30m'] || active);
      }

      // Active pages list
      const pagesContainer = document.getElementById('rt-pages-container');
      const pages = data.pages || data.activePages || [];
      if (!Array.isArray(pages) || pages.length === 0) {
        pagesContainer.innerHTML = `<div style="font-size:0.8rem; color:#94a3b8; font-style:italic;">No active real-time page sessions right now.</div>`;
      } else {
        pagesContainer.innerHTML = pages.slice(0, 5).map(p => `
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.06); padding:0.35rem 0.65rem; border-radius:8px; font-size:0.82rem;">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:80%;" title="${p.page || p.url || p.name}">
              📄 ${p.page || p.url || p.name || '/'}
            </span>
            <span style="font-weight:700; color:#38bdf8;">${formatNumber(p.visitors || p.count || 1)}</span>
          </div>
        `).join('');
      }

    } catch (err) {
      document.getElementById('rt-active-count').textContent = '0';
    }
  }

  // 2. Main Analytics KPIs
  async function loadOverview() {
    try {
      const res = await fetch(`/api/publytics/overview?siteId=${encodeURIComponent(currentSiteId)}&period=${encodeURIComponent(currentPeriod)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      loadedData.overview = data;

      document.getElementById('kpi-users').textContent = formatNumber(data.users || data.visitors || data.unique_visitors || 0);
      document.getElementById('kpi-views').textContent = formatNumber(data.pageviews || data.views || 0);
      document.getElementById('kpi-sessions').textContent = formatNumber(data.sessions || data.visits || 0);
      document.getElementById('kpi-duration').textContent = formatDuration(data.sessionDuration || data.duration || data.avg_duration || 0);
      document.getElementById('kpi-bounce').textContent = formatPercent(data.bounceRate || data.bounce_rate || 0);

    } catch (err) {
      document.getElementById('kpi-users').textContent = '0';
      document.getElementById('kpi-views').textContent = '0';
      document.getElementById('kpi-sessions').textContent = '0';
      document.getElementById('kpi-duration').textContent = '0s';
      document.getElementById('kpi-bounce').textContent = '0%';
    }
  }

  // 3. Acquisition & Campaigns
  async function loadAcquisition() {
    const tbody = document.getElementById('acq-tbody');
    const colName = document.getElementById('acq-col-name');
    if (colName) {
      colName.textContent = currentAcqDim.replace('_', ' ').toUpperCase();
    }

    try {
      const res = await fetch(`/api/publytics/dimension/${currentAcqDim}?siteId=${encodeURIComponent(currentSiteId)}&period=${encodeURIComponent(currentPeriod)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = await res.json();
      const items = Array.isArray(list) ? list : (list.data || []);
      loadedData.acq[currentAcqDim] = items;

      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="pub-empty-state">No ${currentAcqDim.replace('_', ' ')} data found for this period.</td></tr>`;
        return;
      }

      const maxVisitors = Math.max(...items.map(i => Number(i.visitors || i.count || i.sessions || 1)));

      tbody.innerHTML = items.map(item => {
        const name = item.name || item.value || item[currentAcqDim] || '(not set)';
        const visitors = Number(item.visitors || item.count || item.sessions || 0);
        const share = maxVisitors > 0 ? Math.round((visitors / maxVisitors) * 100) : 0;

        return `
          <tr class="pub-interactive-row" onclick="window.openDrilldown('${currentAcqDim}', '${escapeHtml(name)}', ${visitors}, ${escapeJsonAttr(item)})">
            <td>
              <strong style="color:#0f172a;">${escapeHtml(name)}</strong>
            </td>
            <td><strong>${formatNumber(visitors)}</strong></td>
            <td>
              <div style="font-size:0.75rem; color:#64748b; margin-bottom:2px;">${share}%</div>
              <div class="pub-progress-bg">
                <div class="pub-progress-fill" style="width:${share}%;"></div>
              </div>
            </td>
            <td style="text-align:right;">
              <button class="pub-btn pub-btn-default" style="padding:0.25rem 0.55rem; font-size:0.75rem;">
                🔍 Details
              </button>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4" class="pub-empty-state" style="color:#ef4444;">Failed to load acquisition data: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  // 4. Audience Demographics & Systems
  async function loadAudience() {
    const dimensions = [
      { dim: 'country', tbodyId: 'audience-countries-tbody', labelKey: 'country' },
      { dim: 'device', tbodyId: 'audience-devices-tbody', labelKey: 'device' },
      { dim: 'os', tbodyId: 'audience-os-tbody', labelKey: 'os' },
      { dim: 'browser', tbodyId: 'audience-browsers-tbody', labelKey: 'browser' },
      { dim: 'hostname', tbodyId: 'audience-hostnames-tbody', labelKey: 'hostname' },
      { dim: 'page', tbodyId: 'audience-pages-tbody', labelKey: 'page' }
    ];

    dimensions.forEach(async ({ dim, tbodyId }) => {
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;

      try {
        const res = await fetch(`/api/publytics/dimension/${dim}?siteId=${encodeURIComponent(currentSiteId)}&period=${encodeURIComponent(currentPeriod)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const list = await res.json();
        const items = Array.isArray(list) ? list : (list.data || []);
        loadedData.audience[dim] = items;

        if (items.length === 0) {
          tbody.innerHTML = `<tr><td colspan="3" class="pub-empty-state" style="padding:1.5rem;">No ${dim} data.</td></tr>`;
          return;
        }

        const maxVisitors = Math.max(...items.map(i => Number(i.visitors || i.count || i.views || 1)));

        tbody.innerHTML = items.slice(0, 10).map(item => {
          const rawName = item.name || item.value || item[dim] || 'Unknown';
          const visitors = Number(item.visitors || item.count || item.views || 0);
          const share = maxVisitors > 0 ? Math.round((visitors / maxVisitors) * 100) : 0;

          let displayLabel = escapeHtml(rawName);
          if (dim === 'country') {
            displayLabel = `${getFlagEmoji(rawName)} ${escapeHtml(rawName)}`;
          }

          return `
            <tr class="pub-interactive-row" onclick="window.openDrilldown('${dim}', '${escapeHtml(rawName)}', ${visitors}, ${escapeJsonAttr(item)})">
              <td><strong>${displayLabel}</strong></td>
              <td>${formatNumber(visitors)}</td>
              <td>
                <div class="pub-progress-bg">
                  <div class="pub-progress-fill" style="width:${share}%;"></div>
                </div>
              </td>
            </tr>
          `;
        }).join('');

      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="pub-empty-state" style="padding:1.5rem; color:#ef4444;">Unavailable</td></tr>`;
      }
    });
  }

  // 5. User List
  async function loadUsers() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    try {
      const res = await fetch(`/api/publytics/users?siteId=${encodeURIComponent(currentSiteId)}&period=${encodeURIComponent(currentPeriod)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = await res.json();
      const users = Array.isArray(list) ? list : (list.data || []);
      loadedData.users = users;

      if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="pub-empty-state">No individual user records found from Publytics API.</td></tr>`;
        return;
      }

      tbody.innerHTML = users.slice(0, 15).map(u => {
        const uid = u.id || u.userId || u.identifier || 'anon_user';
        const country = u.country || 'XX';
        const sessions = u.sessions || 1;
        const pageviews = u.pageviews || u.views || 1;
        const lastSeen = u.lastSeen ? new Date(u.lastSeen).toLocaleString() : 'Recent';

        return `
          <tr class="pub-interactive-row" onclick="window.openDrilldown('user', '${escapeHtml(uid)}', ${pageviews}, ${escapeJsonAttr(u)})">
            <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:6px; font-weight:600;">${escapeHtml(uid)}</code></td>
            <td>${getFlagEmoji(country)} ${escapeHtml(country)}</td>
            <td>${formatNumber(sessions)}</td>
            <td>${formatNumber(pageviews)}</td>
            <td>${escapeHtml(lastSeen)}</td>
            <td style="text-align:right;">
              <button class="pub-btn pub-btn-default" style="padding:0.25rem 0.55rem; font-size:0.75rem;">
                🔍 View Profile
              </button>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="pub-empty-state">User list is only available when user identification is enabled in Publytics tracking.</td></tr>`;
    }
  }

  // --- SECTION 6: INTERACTIVE DRILL-DOWN MODAL ---
  window.openDrilldown = function(dimension, itemValue, primaryMetric, rawData) {
    const modal = document.getElementById('drilldown-modal');
    if (!modal) return;

    const title = document.getElementById('drilldown-title');
    const subtitle = document.getElementById('drilldown-subtitle');
    const icon = document.getElementById('drilldown-icon');
    const kpis = document.getElementById('drilldown-kpis');
    const body = document.getElementById('drilldown-details-body');

    if (title) title.textContent = `${dimension.toUpperCase()}: ${itemValue}`;
    if (subtitle) subtitle.textContent = `Deep-dive insights for selected ${dimension} on site ${currentSiteId}`;
    if (icon) {
      icon.textContent = dimension === 'country' ? getFlagEmoji(itemValue)
                       : dimension.startsWith('utm') ? '🎯'
                       : dimension === 'device' ? '📱'
                       : dimension === 'user' ? '👤'
                       : '🔍';
    }

    // Quick stats cards
    if (kpis) {
      kpis.innerHTML = `
        <div class="pub-card" style="padding:0.75rem 1rem;">
          <div style="font-size:0.7rem; color:#64748b; font-weight:700;">VISITORS / VIEWS</div>
          <div style="font-size:1.4rem; font-weight:800; color:#0f172a;">${formatNumber(primaryMetric)}</div>
        </div>
        <div class="pub-card" style="padding:0.75rem 1rem;">
          <div style="font-size:0.7rem; color:#64748b; font-weight:700;">TIME PERIOD</div>
          <div style="font-size:0.95rem; font-weight:700; color:#1877f2; text-transform:capitalize;">${currentPeriod}</div>
        </div>
        <div class="pub-card" style="padding:0.75rem 1rem;">
          <div style="font-size:0.7rem; color:#64748b; font-weight:700;">SITE ID</div>
          <div style="font-size:0.85rem; font-weight:700; overflow:hidden; text-overflow:ellipsis;" title="${currentSiteId}">${currentSiteId || 'Default'}</div>
        </div>
      `;
    }

    // Detailed JSON/table breakdown
    if (body) {
      let html = '<div style="display:flex; flex-direction:column; gap:0.6rem;">';
      if (rawData && typeof rawData === 'object') {
        for (const [k, v] of Object.entries(rawData)) {
          if (typeof v !== 'object') {
            html += `
              <div style="display:flex; justify-content:space-between; padding:0.4rem 0.6rem; background:#f8fafc; border-radius:8px; font-size:0.84rem;">
                <strong style="color:#475569; text-transform:capitalize;">${escapeHtml(k)}:</strong>
                <span style="color:#0f172a; font-weight:600;">${escapeHtml(String(v))}</span>
              </div>
            `;
          }
        }
      }
      html += '</div>';
      body.innerHTML = html;
    }

    modal.style.display = 'flex';
  };

  window.closeDrilldownModal = function() {
    const modal = document.getElementById('drilldown-modal');
    if (modal) modal.style.display = 'none';
  };

  // --- CONFIGURATION MODAL ---
  window.openConfigModal = function() {
    const modal = document.getElementById('config-modal');
    if (modal) modal.style.display = 'flex';
  };

  window.closeConfigModal = function() {
    const modal = document.getElementById('config-modal');
    if (modal) modal.style.display = 'none';
  };

  window.testApiConnection = async function() {
    const token = document.getElementById('cfg-token').value.trim();
    const site = document.getElementById('cfg-site').value.trim();
    const statusBox = document.getElementById('cfg-test-status');

    if (!site) {
      alert('Please enter a Site ID to test.');
      return;
    }

    statusBox.style.display = 'block';
    statusBox.style.background = '#f1f5f9';
    statusBox.style.color = '#334155';
    statusBox.textContent = 'Testing connection with Publytics API...';

    try {
      const res = await fetch('/api/publytics/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiToken: token, siteId: site })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        statusBox.style.background = '#dcfce7';
        statusBox.style.color = '#15803d';
        statusBox.textContent = '✅ ' + data.message;
      } else {
        statusBox.style.background = '#fee2e2';
        statusBox.style.color = '#b91c1c';
        statusBox.textContent = '❌ ' + (data.error || 'Connection failed.');
      }
    } catch (err) {
      statusBox.style.background = '#fee2e2';
      statusBox.style.color = '#b91c1c';
      statusBox.textContent = '❌ Network error testing connection: ' + err.message;
    }
  };

  window.saveConfig = async function(e) {
    if (e) e.preventDefault();

    const token = document.getElementById('cfg-token').value.trim();
    const site = document.getElementById('cfg-site').value.trim();
    const sitesRaw = document.getElementById('cfg-sites-list').value;

    const sitesList = sitesRaw
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => ({ id: s, name: s }));

    try {
      const res = await fetch('/api/publytics/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiToken: token || undefined,
          siteId: site,
          sitesList
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('Publytics API Configuration Saved successfully!');
        window.closeConfigModal();

        const setupBanner = document.getElementById('setup-banner');
        if (setupBanner) setupBanner.style.display = 'none';

        await loadSitesList(site);
        loadCurrentView();
      } else {
        alert('Failed to save configuration: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error saving configuration: ' + err.message);
    }
  };

  // Helper Escaping
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeJsonAttr(obj) {
    if (!obj) return '{}';
    return escapeHtml(JSON.stringify(obj));
  }

})();
