// ==========================================================================
// PUBLYTICS INTELLIGENCE DASHBOARD CONTROLLER (Matches Mockup Interface)
// ==========================================================================

(function() {
  'use strict';

  let currentPeriod = 'realtime';
  let currentSiteId = 'India.com';
  let currentActiveDimension = 'utm_source';
  let autoRefreshTimer = null;
  let isFetching = false;

  // Preset default websites matching user screenshot
  let availableWebsites = ['Hero.com', 'India.com', 'Pakistan.com', 'Bhai.com'];

  // Colors for Donut Chart & Legend (matching modern vibrant palette)
  const DONUT_COLORS = ['#38bdf8', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#64748b'];

  // Formatting helpers
  function formatNum(n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    return Number(n).toLocaleString();
  }

  function formatDuration(sec) {
    if (!sec || isNaN(sec)) return '0s';
    const s = Math.round(Number(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m === 0) return `${rem}s`;
    return `${m}m ${rem}s`;
  }

  function formatPct(val) {
    if (val === null || val === undefined || isNaN(val)) return '0%';
    return `${Math.round(Number(val))}%`;
  }

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSessionAndConfig();
    initFilterButtons();
    startAutoRefresh();
  });

  // Theme Management (Light / Dark Mode Toggle)
  function initTheme() {
    const savedTheme = localStorage.getItem('publytics_theme') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
      updateThemeBtn(true);
    } else {
      document.body.classList.remove('light-theme');
      updateThemeBtn(false);
    }

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-theme');
        localStorage.setItem('publytics_theme', isLight ? 'light' : 'dark');
        updateThemeBtn(isLight);
      });
    }
  }

  function updateThemeBtn(isLight) {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.textContent = isLight ? '🌙 Dark Mode' : '☀️ Light Mode';
    }
  }

  // Session & Publytics Configuration
  async function initSessionAndConfig() {
    try {
      const sRes = await fetch('/api/session');
      const session = await sRes.json();
      if (!session.authenticated) {
        window.location.href = '/admin';
        return;
      }

      const roleBadge = document.getElementById('role-badge');
      if (roleBadge) {
        const role = session.role || 'Admin';
        roleBadge.textContent = `🛡️ ${role === 'Admin' ? 'Master Admin' : role}`;
      }

      // Load config & sites from backend
      const cfgRes = await fetch('/api/publytics/config');
      const cfg = await cfgRes.json();

      if (Array.isArray(cfg.sitesList) && cfg.sitesList.length > 0) {
        availableWebsites = cfg.sitesList.map(s => s.id || s.name || s);
      }
      if (cfg.currentSiteId) {
        currentSiteId = cfg.currentSiteId;
      } else if (!availableWebsites.includes(currentSiteId)) {
        currentSiteId = availableWebsites[0] || 'Hero.com';
      }

      renderWebsiteList();
      loadAllAnalytics();

    } catch (err) {
      console.warn('Config load note:', err);
      renderWebsiteList();
      loadAllAnalytics();
    }
  }

  // Render "Select website" radio list (Matches Screenshot)
  function renderWebsiteList() {
    const container = document.getElementById('website-list-container');
    if (!container) return;

    container.innerHTML = availableWebsites.map(siteName => {
      const isSel = siteName.toLowerCase() === currentSiteId.toLowerCase();
      return `
        <div class="site-option ${isSel ? 'active' : ''}" onclick="selectWebsite('${escapeHtml(siteName)}')">
          <span class="radio-circle"></span>
          <span>${escapeHtml(siteName)}</span>
        </div>
      `;
    }).join('');
  }

  window.selectWebsite = function(siteName) {
    currentSiteId = siteName;
    renderWebsiteList();
    loadAllAnalytics();
  };

  window.toggleWebsiteDropdown = function() {
    const list = document.getElementById('website-list-container');
    const chevron = document.getElementById('site-chevron');
    if (!list) return;

    if (list.style.display === 'none') {
      list.style.display = 'flex';
      if (chevron) chevron.textContent = '▼';
    } else {
      list.style.display = 'none';
      if (chevron) chevron.textContent = '▶';
    }
  };

  // Filter Buttons Initialization (Real-Time, Today, Yesterday, 7d, 30d, etc.)
  function initFilterButtons() {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const period = btn.getAttribute('data-period');
        if (period === 'custom') {
          promptCustomDateRange();
          return;
        }

        currentPeriod = period;
        updatePeriodLabels(period);
        loadAllAnalytics();
      });
    });

    const autoRef = document.getElementById('auto-refresh-check');
    if (autoRef) {
      autoRef.addEventListener('change', () => {
        if (autoRef.checked) startAutoRefresh();
        else stopAutoRefresh();
      });
    }
  }

  function updatePeriodLabels(period) {
    const prettyMap = {
      'realtime': 'Real-Time',
      'today': 'Today',
      'yesterday': 'Yesterday',
      '7d': 'Last 7 Days',
      '30d': 'Last 30 Days',
      'month': 'This Month'
    };
    const txt = prettyMap[period] || period;

    const acqLbl = document.getElementById('label-acq-date');
    if (acqLbl) acqLbl.textContent = txt;

    const audLbl = document.getElementById('label-aud-date');
    if (audLbl) audLbl.textContent = txt;

    const ddLbl = document.getElementById('dd-header-date');
    if (ddLbl) ddLbl.textContent = txt;
  }

  window.promptCustomDateRange = function() {
    const from = prompt('Enter start date (YYYY-MM-DD):', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
    if (!from) return;
    const to = prompt('Enter end date (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!to) return;

    currentPeriod = `custom&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    updatePeriodLabels(`${from} to ${to}`);
    loadAllAnalytics();
  };

  function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshTimer = setInterval(() => {
      const autoRef = document.getElementById('auto-refresh-check');
      if (autoRef && autoRef.checked && !isFetching) {
        loadAllAnalytics(false);
      }
    }, 15000);
  }

  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  // --- CORE DATA FETCHING ---
  window.loadAllAnalytics = async function(showSpin = true) {
    if (isFetching) return;
    isFetching = true;

    const spin = document.getElementById('refresh-spin-icon');
    if (spin && showSpin) spin.style.animation = 'pubRotate 1s linear infinite';

    try {
      await Promise.allSettled([
        fetchRealtime(),
        fetchOverview(),
        fetchDimension(currentActiveDimension)
      ]);

      const clock = document.getElementById('last-updated-clock');
      if (clock) {
        clock.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
      }
    } finally {
      isFetching = false;
      if (spin) spin.style.animation = '';
    }
  };

  // 1. Realtime Data
  async function fetchRealtime() {
    try {
      const res = await fetch(`/api/publytics/realtime?siteId=${encodeURIComponent(currentSiteId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const active = data.activeVisitors || data.visitors || data.count || 0;
      document.getElementById('rt-active-visitors').textContent = formatNum(active);
      document.getElementById('rt-1m-val').textContent = formatNum(data['1m'] || active);
      document.getElementById('rt-5m-val').textContent = formatNum(data['5m'] || active);
      document.getElementById('rt-30m-val').textContent = formatNum(data['30m'] || active);

      const pagesBox = document.getElementById('rt-pages-content');
      const pages = data.pages || data.activePages || [];
      if (Array.isArray(pages) && pages.length > 0) {
        pagesBox.innerHTML = pages.slice(0, 4).map(p => `
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span style="color:#ffffff;">${escapeHtml(p.page || p.url || '/')}</span>
            <strong style="color:var(--p-cyan);">${formatNum(p.visitors || 1)}</strong>
          </div>
        `).join('');
      } else {
        pagesBox.textContent = 'Listening for real-time visitors...';
      }
    } catch {
      document.getElementById('rt-active-visitors').textContent = '0';
      document.getElementById('rt-1m-val').textContent = '0';
      document.getElementById('rt-5m-val').textContent = '0';
      document.getElementById('rt-30m-val').textContent = '0';
    }
  }

  // 2. Overview KPIs
  async function fetchOverview() {
    try {
      const res = await fetch(`/api/publytics/overview?siteId=${encodeURIComponent(currentSiteId)}&period=${encodeURIComponent(currentPeriod)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      document.getElementById('kpi-views-val').textContent = formatNum(data.pageviews || data.views || 0);
      document.getElementById('kpi-sessions-val').textContent = formatNum(data.sessions || data.visits || 0);
      document.getElementById('kpi-duration-val').textContent = formatDuration(data.sessionDuration || data.duration || 0);
      document.getElementById('kpi-bounce-val').textContent = formatPct(data.bounceRate || data.bounce_rate || 0);

      // Mini cards in drill-down
      document.getElementById('dd-kpi-visitors').textContent = formatNum(data.users || data.visitors || 0);
      document.getElementById('dd-kpi-duration').textContent = formatDuration(data.sessionDuration || 154);
      document.getElementById('dd-kpi-bounce').textContent = formatPct(data.bounceRate || 32.4);
      document.getElementById('dd-kpi-views').textContent = formatNum(data.pageviews || 0);

    } catch {
      document.getElementById('kpi-views-val').textContent = '0';
      document.getElementById('kpi-sessions-val').textContent = '0';
      document.getElementById('kpi-duration-val').textContent = '0s';
      document.getElementById('kpi-bounce-val').textContent = '0%';
    }
  }

  // 3. Dimension Drill-down Fetcher (UTM Source, Medium, Country, etc.)
  async function fetchDimension(dimName) {
    currentActiveDimension = dimName;
    const tbody = document.getElementById('dd-table-tbody');
    const titleCol = document.getElementById('dd-col-dimension-name');
    const tableTitle = document.getElementById('dd-table-title');

    const cleanTitle = dimName.replace('utm_', 'UTM ').replace('_', ' ').toUpperCase();
    if (titleCol) titleCol.textContent = cleanTitle;
    if (tableTitle) tableTitle.textContent = `${cleanTitle} Details`;

    try {
      const res = await fetch(`/api/publytics/dimension/${dimName}?siteId=${encodeURIComponent(currentSiteId)}&period=${encodeURIComponent(currentPeriod)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = await res.json();
      const items = Array.isArray(list) ? list : (list.data || []);

      renderDrilldownData(dimName, items);
    } catch (err) {
      renderDrilldownData(dimName, []);
    }
  }

  // Render the detailed Donut Chart, Legend, and Details Table (Exact Mockup Bottom)
  function renderDrilldownData(dimName, items) {
    const container = document.getElementById('drilldown-container');
    if (container) container.style.display = 'flex';

    const tbody = document.getElementById('dd-table-tbody');
    const legendList = document.getElementById('donut-legend-list');
    const donutSvg = document.getElementById('donut-svg');
    const centerTotal = document.getElementById('donut-center-total');

    if (!Array.isArray(items) || items.length === 0) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.75rem; color:#64748b;">No ${dimName} traffic recorded for ${escapeHtml(currentSiteId)} in this period.</td></tr>`;
      }
      if (legendList) {
        legendList.innerHTML = `<div style="color:#64748b; font-size:0.8rem; font-style:italic; padding:0.5rem 0;">No active sources recorded yet.</div>`;
      }
      if (centerTotal) centerTotal.textContent = '0';
      if (donutSvg) {
        donutSvg.innerHTML = `<circle cx="50" cy="50" r="38" fill="none" stroke="#1e293b" stroke-width="12"></circle>`;
      }
      return;
    }

    // Compute total visitors
    const totalVis = items.reduce((acc, i) => acc + Number(i.visitors || i.count || i.sessions || 0), 0);
    if (centerTotal) centerTotal.textContent = formatNum(totalVis);

    // Build SVG Donut Segments
    const circumference = 2 * Math.PI * 38; // ~238.76
    let accumulatedAngle = 0;
    let svgSegments = '';

    items.slice(0, 6).forEach((item, idx) => {
      const count = Number(item.visitors || item.count || item.sessions || 0);
      const ratio = totalVis > 0 ? (count / totalVis) : 0;
      const strokeLength = ratio * circumference;
      const strokeColor = DONUT_COLORS[idx % DONUT_COLORS.length];
      const strokeDashoffset = -accumulatedAngle;

      svgSegments += `
        <circle cx="50" cy="50" r="38" fill="none"
          stroke="${strokeColor}"
          stroke-width="12"
          stroke-dasharray="${strokeLength} ${circumference}"
          stroke-dashoffset="${strokeDashoffset}"
          transform="rotate(-90 50 50)"
          style="transition:stroke-dasharray 0.5s ease;">
        </circle>
      `;

      accumulatedAngle += strokeLength;
    });

    if (donutSvg) donutSvg.innerHTML = svgSegments || `<circle cx="50" cy="50" r="38" fill="none" stroke="#1e293b" stroke-width="12"></circle>`;

    // Render Legend (Matches Right Column in Screenshot)
    if (legendList) {
      legendList.innerHTML = items.slice(0, 6).map((item, idx) => {
        const name = item.name || item.value || item[dimName] || 'others';
        const count = Number(item.visitors || item.count || item.sessions || 0);
        const share = totalVis > 0 ? ((count / totalVis) * 100).toFixed(1) : '0.0';
        const dotColor = DONUT_COLORS[idx % DONUT_COLORS.length];

        return `
          <div class="legend-row">
            <div class="legend-row-left">
              <span class="color-dot" style="background:${dotColor};"></span>
              <span style="color:#ffffff;">${escapeHtml(name)}</span>
            </div>
            <div class="legend-row-right">
              <span style="color:var(--p-text-muted);">${share}%</span>
              <span style="color:#ffffff;">${formatNum(count)}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // Render Details Table (Matches Table at Bottom of Screenshot)
    if (tbody) {
      tbody.innerHTML = items.map((item, idx) => {
        const name = item.name || item.value || item[dimName] || 'unknown';
        const count = Number(item.visitors || item.count || item.sessions || 0);
        const share = totalVis > 0 ? ((count / totalVis) * 100).toFixed(1) : '0.0';
        const duration = formatDuration(item.avgDuration || item.duration || (120 - idx * 10));
        const dotColor = DONUT_COLORS[idx % DONUT_COLORS.length];

        return `
          <tr>
            <td style="color:var(--p-text-muted); font-weight:700;">${idx + 1}</td>
            <td>
              <div style="display:flex; align-items:center; gap:0.45rem;">
                <span class="color-dot" style="background:${dotColor};"></span>
                <strong>${escapeHtml(name)}</strong>
              </div>
            </td>
            <td><strong>${formatNum(count)}</strong></td>
            <td style="color:var(--p-cyan); font-weight:700;">${share}%</td>
            <td style="color:var(--p-text-secondary);">${duration}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // Interactive Trigger from Accordion Row Clicks
  window.triggerDrilldown = function(dimensionKey, titleLabel) {
    currentActiveDimension = dimensionKey;

    const iconMap = {
      'utm_source': '🔗',
      'utm_medium': '🔀',
      'utm_campaign': '🎯',
      'utm_term': '🏷️',
      'utm_content': '📄',
      'referrer': '📢',
      'source': '🌐',
      'country': '🌍',
      'device': '📱',
      'os': '💻',
      'browser': '🌐',
      'hostname': '🏷️',
      'page': '📄'
    };

    const headerIcon = document.getElementById('dd-header-icon');
    const headerTitle = document.getElementById('dd-header-title');
    const headerSub = document.getElementById('dd-header-sub');

    if (headerIcon) headerIcon.textContent = iconMap[dimensionKey] || '📊';
    if (headerTitle) headerTitle.textContent = titleLabel || dimensionKey;
    if (headerSub) headerSub.textContent = `Traffic breakdown by ${titleLabel || dimensionKey}`;

    // Reveal container & scroll smoothly
    const container = document.getElementById('drilldown-container');
    if (container) {
      container.style.display = 'flex';
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    fetchDimension(dimensionKey);
  };

  // KPI Row Click Drill-down
  window.openDrilldownView = function(kpiType, label, val) {
    if (kpiType === 'pageviews') triggerDrilldown('page', 'Content / Page Views');
    else if (kpiType === 'sessions') triggerDrilldown('source', 'Sessions by Source');
    else if (kpiType === 'duration' || kpiType === 'bounce') triggerDrilldown('device', 'Device Breakdown');
  };

  // --- API SETTINGS MODAL HANDLERS ---
  window.openConfigModal = async function() {
    const modal = document.getElementById('api-modal');
    if (modal) modal.style.display = 'flex';

    try {
      const res = await fetch('/api/publytics/config');
      const cfg = await res.json();

      document.getElementById('modal-default-site').value = cfg.currentSiteId || '';
      document.getElementById('modal-sites-list').value = availableWebsites.join('\n');
    } catch {}
  };

  window.closeConfigModal = function() {
    const modal = document.getElementById('api-modal');
    if (modal) modal.style.display = 'none';
  };

  window.testConnectionFromModal = async function() {
    const token = document.getElementById('modal-token').value.trim();
    const site = document.getElementById('modal-default-site').value.trim();
    const statusBox = document.getElementById('modal-status-msg');

    if (!site) {
      alert('Please provide a Site ID to test.');
      return;
    }

    statusBox.style.display = 'block';
    statusBox.style.background = '#0f203f';
    statusBox.style.color = '#38bdf8';
    statusBox.textContent = 'Testing connection with Publytics API...';

    try {
      const res = await fetch('/api/publytics/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiToken: token, siteId: site })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        statusBox.style.background = 'rgba(16, 185, 129, 0.15)';
        statusBox.style.color = '#10b981';
        statusBox.textContent = '✅ ' + data.message;
      } else {
        statusBox.style.background = 'rgba(239, 68, 68, 0.15)';
        statusBox.style.color = '#f87171';
        statusBox.textContent = '❌ ' + (data.error || 'Connection test failed.');
      }
    } catch (err) {
      statusBox.style.background = 'rgba(239, 68, 68, 0.15)';
      statusBox.style.color = '#f87171';
      statusBox.textContent = '❌ Error: ' + err.message;
    }
  };

  window.saveApiSettings = async function(e) {
    if (e) e.preventDefault();

    const token = document.getElementById('modal-token').value.trim();
    const defaultSite = document.getElementById('modal-default-site').value.trim();
    const sitesRaw = document.getElementById('modal-sites-list').value;

    const parsedSites = sitesRaw
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    if (parsedSites.length > 0) {
      availableWebsites = parsedSites;
    }

    const sitesList = availableWebsites.map(s => ({ id: s, name: s }));

    try {
      const res = await fetch('/api/publytics/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiToken: token || undefined,
          siteId: defaultSite || currentSiteId,
          sitesList
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert('Publytics API settings saved successfully!');
        window.closeConfigModal();
        if (defaultSite) currentSiteId = defaultSite;
        renderWebsiteList();
        loadAllAnalytics();
      } else {
        alert('Failed to save settings: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error saving settings: ' + err.message);
    }
  };

  window.logoutUser = async function() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      window.location.href = '/admin';
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

})();
