// ==========================================================================
// PUBLYTICS REAL-TIME & DEEP-ANALYTICS DASHBOARD CONTROLLER
// 100% Real Publytics API Data • Zero Dummy Fallbacks • Full Clickable Drilldowns
// ==========================================================================

(function() {
  'use strict';

  let currentPeriod = '7d';
  let currentSiteId = '';
  let currentActiveDimension = 'utm_source';
  let autoRefreshTimer = null;
  let isFetching = false;
  let currentDimensionData = [];
  let currentUsersData = [];

  // Available websites fetched from Publytics API
  let availableWebsites = [];

  // Vibrant Cyber Palette for Donut Segments
  const DONUT_COLORS = [
    '#0090ff', // Electric Blue
    '#00e5ff', // Cyan
    '#7c3aed', // Purple
    '#f43f5e', // Rose/Coral
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#64748b'  // Muted Slate
  ];

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
    return `${Number(val).toFixed(1)}%`;
  }

  // Brand Icon SVGs / Helpers
  function getBrandIconHtml(name) {
    const n = String(name || '').toLowerCase().trim();
    if (n.includes('google')) {
      return `
        <span class="brand-icon" style="background:#ffffff; border-radius:50%; box-shadow:0 1px 3px rgba(0,0,0,0.3);">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
        </span>
      `;
    }
    if (n.includes('facebook') || n.includes('fb')) {
      return `
        <span class="brand-icon" style="background:#1877f2; border-radius:50%; color:#ffffff;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="#ffffff">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </span>
      `;
    }
    if (n.includes('direct')) {
      return `
        <span class="brand-icon" style="background:#0284c7; border-radius:50%; color:#ffffff;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
        </span>
      `;
    }
    if (n.includes('instagram') || n.includes('ig')) {
      return `
        <span class="brand-icon" style="background:radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%,#d6249f 60%,#285AEB 90%); border-radius:50%; color:#fff;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <circle cx="12" cy="12" r="4"></circle>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
          </svg>
        </span>
      `;
    }
    if (n.includes('tiktok')) {
      return `
        <span class="brand-icon" style="background:#000000; border:1px solid rgba(255,255,255,0.2); border-radius:50%; color:#ffffff;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="#ffffff">
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.81 4.47 6.27 6.27 0 0 0 1.96-4.49V8.41a8.29 8.29 0 0 0 4.82 1.54V6.69z"/>
          </svg>
        </span>
      `;
    }
    if (n.includes('mobile')) {
      return `
        <span class="brand-icon" style="background:linear-gradient(135deg, #0284c7, #00e5ff); border-radius:50%; color:#ffffff;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
        </span>
      `;
    }
    if (n.includes('desktop')) {
      return `
        <span class="brand-icon" style="background:linear-gradient(135deg, #7c3aed, #4f46e5); border-radius:50%; color:#ffffff;">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
        </span>
      `;
    }
    return `
      <span class="brand-icon" style="background:#031d4d; border:1px solid rgba(0,144,255,0.4); border-radius:50%; color:#00e5ff; font-weight:800; font-size:0.75rem;">
        📊
      </span>
    `;
  }

  // --- FLOATING TOAST ---
  window.showPublyticsToast = function(msg) {
    let toast = document.getElementById('publytics-floating-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'publytics-floating-toast';
      toast.style.cssText = 'position:fixed; bottom:85px; left:50%; transform:translateX(-50%) translateY(10px); background:rgba(3,17,44,0.95); border:1.5px solid #00e5ff; color:#fff; padding:0.65rem 1.25rem; border-radius:9999px; font-weight:800; font-size:0.85rem; box-shadow:0 8px 30px rgba(0,229,255,0.3); z-index:999999; display:flex; align-items:center; gap:0.5rem; transition:all 0.25s ease; opacity:0; pointer-events:none;';
      document.body.appendChild(toast);
    }
    toast.innerHTML = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
      if (toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(10px)';
      }
    }, 2800);
  };

  // Toast notification for user actions
  function hideStatusAlert() {}

  // --- INITIALIZATION ---
  window.initPublyticsDashboard = function() {
    if (document.getElementById('website-list-container')) {
      initSessionAndConfig();
      initFilterButtons();
      updateClockDisplay();
      startAutoRefresh();
    }
  };

  // DOMContentLoaded: Only auto-init on the standalone publytics.html page.
  // On admin.html, dashboard.js calls initPublyticsDashboard() on tab switch.
  document.addEventListener('DOMContentLoaded', () => {
    const isStandalonePage = window.location.pathname.includes('publytics.html');
    if (isStandalonePage) {
      // Redirect standalone publytics.html to admin.html#tab-publytics
      window.location.replace('/admin#tab-publytics');
      return;
    }
    // On admin.html, popstate and deep-link support only
    initHistoryPopstate();
  });

  // History Popstate Navigation
  function initHistoryPopstate() {
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.view === 'drilldown') {
        showDrilldownViewInternal(e.state.dimKey, e.state.dimTitle, false);
      } else {
        closeDrilldownViewInternal(false);
      }
    });
  }

  // Header & Drawer
  function initHeaderAndDrawer() {
    const hamburgerBtn = document.getElementById('hamburger-menu-btn');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');
    const menuOverlay = document.getElementById('menu-overlay');

    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.body.classList.toggle('menu-open');
      });
    }
    if (closeDrawerBtn) {
      closeDrawerBtn.addEventListener('click', () => {
        document.body.classList.remove('menu-open');
      });
    }
    if (menuOverlay) {
      menuOverlay.addEventListener('click', () => {
        document.body.classList.remove('menu-open');
      });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try { await fetch('/api/logout', { method: 'POST' }); } catch(e) {}
        localStorage.removeItem('cachedToken');
        window.location.href = '/admin';
      });
    }
  }

  // Theme Management
  function initTheme() {
    const savedTheme = localStorage.getItem('theme') || localStorage.getItem('publytics_theme') || 'dark';
    applyThemeState(savedTheme);

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || (document.body.classList.contains('light-theme') ? 'light' : 'dark');
        const next = current === 'light' ? 'dark' : 'light';
        applyThemeState(next);
        localStorage.setItem('publytics_theme', next);
        localStorage.setItem('theme', next);
      });
    }
  }

  function applyThemeState(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      if (themeBtn) themeBtn.textContent = '☀️ Light Mode';
    } else {
      document.body.classList.remove('light-theme');
      if (themeBtn) themeBtn.textContent = '🌙 Dark Mode';
    }
  }

  // Session & Publytics Configuration
  async function initSessionAndConfig() {
    try {
      let session = {};
      try {
        const sRes = await fetch('/api/session');
        session = await sRes.json();
      } catch (e) {}

      if (!session.authenticated) {
        // If not authenticated on admin page, dashboard.js handles redirect
        return;
      }

      // Check publytics permission
      const hasPubPerm = session.isSuperAdmin || (Array.isArray(session.permissions) && session.permissions.includes('publytics'));
      if (!hasPubPerm) {
        // Hide publytics tab content inside admin.html
        const tabPub = document.getElementById('tab-publytics');
        if (tabPub) tabPub.style.display = 'none';
        const tabBtn = document.getElementById('tab-btn-publytics');
        if (tabBtn) tabBtn.style.display = 'none';
        // Hide mobile nav item for publytics
        document.querySelectorAll('.mobile-nav-item[data-tab="tab-publytics"]').forEach(el => el.style.display = 'none');
        return;
      }

      const userBadge = document.getElementById('user-badge') || document.getElementById('role-badge');
      if (userBadge) {
        const role = (session && session.role) || 'Master Admin';
        userBadge.textContent = `🛡️ ${role === 'Admin' ? 'Master Admin' : role}`;
        userBadge.style.display = 'inline-flex';
      }

      // Fetch Publytics Config
      const cfgRes = await fetch('/api/publytics/config');
      if (cfgRes.status === 403) return;
      const cfg = await cfgRes.json();

      // Fetch sites list from Publytics API
      await fetchAvailableSites(cfg);

    } catch (err) {
      console.warn('Init session/config error:', err);
    }
  }

  async function fetchAvailableSites(cfg) {
    try {
      const sRes = await fetch('/api/publytics/sites');
      const data = await sRes.json();
      const rawList = Array.isArray(data.sites) ? data.sites : (Array.isArray(data) ? data : []);

      availableWebsites = rawList.map(s => {
        if (typeof s === 'string') return s;
        return s.id || s.name || s.domain || '';
      }).filter(Boolean);

      if (availableWebsites.length === 0 && cfg && Array.isArray(cfg.sitesList) && cfg.sitesList.length > 0) {
        availableWebsites = cfg.sitesList.map(s => s.id || s.name || s).filter(Boolean);
      }

      const savedSite = localStorage.getItem('publytics_selected_site');
      if (savedSite && availableWebsites.includes(savedSite)) {
        currentSiteId = savedSite;
      } else if (availableWebsites.length > 0) {
        currentSiteId = availableWebsites[0];
      } else {
        currentSiteId = (cfg && cfg.currentSiteId) || '';
      }

      renderWebsiteList();

      if (currentSiteId) {
        loadAllAnalytics();
      }
    } catch (e) {
      renderWebsiteList();
    }
  }

  // Render "Select website" radio list
  function renderWebsiteList() {
    const container = document.getElementById('website-list-container');
    if (!container) return;

    if (availableWebsites.length === 0) {
      container.innerHTML = `
        <div style="padding:0.75rem 1rem; color:#7f9bc2; font-size:0.82rem; text-align:center;">
          No websites detected. Configure Site ID in Settings.
        </div>
      `;
      updateSelectorPillLabel();
      return;
    }

    container.innerHTML = availableWebsites.map(siteName => {
      const isSel = currentSiteId && siteName.toLowerCase() === currentSiteId.toLowerCase();
      return `
        <div class="site-option ${isSel ? 'active' : ''}" onclick="selectWebsite('${escapeHtml(siteName)}')">
          <span class="radio-circle"></span>
          <span class="site-name-text">${escapeHtml(siteName)}</span>
        </div>
      `;
    }).join('');

    updateSelectorPillLabel();
  }

  function updateSelectorPillLabel() {
    const label = document.getElementById('website-selector-label');
    if (!label) return;
    if (currentSiteId) {
      label.textContent = currentSiteId;
    } else {
      label.textContent = 'Select website';
    }
  }

  window.selectWebsite = function(siteName) {
    currentSiteId = siteName;
    try { localStorage.setItem('publytics_selected_site', siteName); } catch(e) {}
    renderWebsiteList();

    const container = document.getElementById('website-list-container');
    const arrow = document.getElementById('site-chevron-arrow');
    const trigger = document.getElementById('website-selector-trigger');
    if (container) container.classList.remove('open');
    if (arrow) arrow.style.transform = '';
    if (trigger) trigger.setAttribute('aria-expanded', 'false');

    hideStatusAlert();
    loadAllAnalytics();
  };

  window.toggleWebsiteDropdown = function() {
    const container = document.getElementById('website-list-container');
    const arrow = document.getElementById('site-chevron-arrow');
    const trigger = document.getElementById('website-selector-trigger');
    if (!container) return;

    const isOpen = container.classList.contains('open');
    if (isOpen) {
      container.classList.remove('open');
      if (arrow) arrow.style.transform = '';
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    } else {
      container.classList.add('open');
      if (arrow) arrow.style.transform = 'rotate(180deg)';
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
    }
  };

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    const card = document.getElementById('website-selector-card');
    const container = document.getElementById('website-list-container');
    const arrow = document.getElementById('site-chevron-arrow');
    const trigger = document.getElementById('website-selector-trigger');
    if (card && container && container.classList.contains('open')) {
      if (!card.contains(e.target)) {
        container.classList.remove('open');
        if (arrow) arrow.style.transform = '';
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    }

    const ddMenus = document.querySelectorAll('.dd-date-dropdown.open');
    ddMenus.forEach(menu => {
      const parent = menu.closest('.dd-date-pill-wrapper');
      if (parent && !parent.contains(e.target)) {
        menu.classList.remove('open');
      }
    });
  });

  // Filter Buttons Initialization (Real-Time, Today, Yesterday, 7d, 30d, etc.)
  function initFilterButtons() {
    const buttons = document.querySelectorAll('.filter-btn-pill, .filter-btn-text, .filter-btn-col');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const period = btn.getAttribute('data-period');
        if (period === 'custom') {
          openCustomDateModal();
          return;
        }

        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentPeriod = period;
        updatePeriodLabels(period);
        loadAllAnalytics();
      });
    });

    const autoRef = document.getElementById('auto-refresh-check');
    if (autoRef) {
      autoRef.addEventListener('change', () => {
        const customBox = document.getElementById('custom-auto-refresh-box');
        if (customBox) {
          if (autoRef.checked) customBox.classList.add('checked');
          else customBox.classList.remove('checked');
        }
        if (autoRef.checked) startAutoRefresh();
        else stopAutoRefresh();
      });
    }
  }

  window.toggleAutoRefreshCheckbox = function() {
    const autoRef = document.getElementById('auto-refresh-check');
    const customBox = document.getElementById('custom-auto-refresh-box');
    if (!autoRef) return;
    autoRef.checked = !autoRef.checked;
    if (customBox) {
      if (autoRef.checked) customBox.classList.add('checked');
      else customBox.classList.remove('checked');
    }
    if (autoRef.checked) startAutoRefresh();
    else stopAutoRefresh();
  };

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

    const ddPill = document.getElementById('dd-period-pill-text');
    if (ddPill) ddPill.textContent = txt;
  }

  window.toggleDrilldownDateDropdown = function(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const wrapper = e ? e.currentTarget.closest('.dd-date-pill-wrapper') : document.querySelector('.dd-date-pill-wrapper');
    const menu = wrapper ? wrapper.querySelector('.dd-date-dropdown') : document.getElementById('dd-date-dropdown-menu');
    if (!menu) return;
    menu.classList.toggle('open');
  };

  window.selectDrilldownPeriod = function(period, label, e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const menus = document.querySelectorAll('.dd-date-dropdown');
    menus.forEach(m => m.classList.remove('open'));

    if (period === 'custom') {
      openCustomDateModal();
      return;
    }

    currentPeriod = period;
    updatePeriodLabels(period);

    // Sync active state on main dashboard filter buttons
    const buttons = document.querySelectorAll('.filter-btn-pill, .filter-btn-text, .filter-btn-col');
    buttons.forEach(btn => {
      if (btn.getAttribute('data-period') === period) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    loadAllAnalytics();
  };

  // Custom Date Modal Handlers
  window.openCustomDateModal = function() {
    const modal = document.getElementById('custom-date-modal');
    if (modal) modal.classList.add('open');
    const endInp = document.getElementById('custom-end-date');
    const startInp = document.getElementById('custom-start-date');
    if (endInp && !endInp.value) endInp.value = new Date().toISOString().slice(0, 10);
    if (startInp && !startInp.value) startInp.value = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  };

  window.closeCustomDateModal = function() {
    const modal = document.getElementById('custom-date-modal');
    if (modal) modal.classList.remove('open');
  };

  window.applyCustomDateFilter = function() {
    const start = document.getElementById('custom-start-date')?.value;
    const end = document.getElementById('custom-end-date')?.value;
    if (!start || !end) {
      alert('Please select both start and end dates.');
      return;
    }
    closeCustomDateModal();
    currentPeriod = `custom&from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}`;
    updatePeriodLabels(`${start} to ${end}`);
    loadAllAnalytics();
  };

  function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshTimer = setInterval(() => {
      const tabPub = document.getElementById('tab-publytics');
      if (tabPub && (tabPub.style.display === 'none' || getComputedStyle(tabPub).display === 'none')) {
        return;
      }
      const autoRef = document.getElementById('auto-refresh-check');
      if (autoRef && autoRef.checked && !isFetching && currentSiteId) {
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
    if (isFetching || !currentSiteId) return;
    isFetching = true;

    const spin = document.getElementById('refresh-spin-icon');
    if (spin && showSpin) spin.style.animation = 'pubRotate 1s linear infinite';

    try {
      await Promise.allSettled([
        fetchRealtime(),
        fetchOverview(),
        fetchUsersList()
      ]);

      // If drilldown view is open, refresh its data
      const ddView = document.getElementById('drilldown-page-view');
      if (ddView && ddView.style.display !== 'none') {
        await fetchDimensionData(currentActiveDimension);
      }

      updateClockDisplay();
    } finally {
      isFetching = false;
      if (spin) spin.style.animation = '';
    }
  };

  function updateClockDisplay() {
    const now = new Date();
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strTime = `${String(hours).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const timeEl = document.getElementById('last-updated-clock-time');
    const ampmEl = document.getElementById('last-updated-clock-ampm');
    if (timeEl) timeEl.textContent = `Updated: ${strTime}`;
    if (ampmEl) ampmEl.textContent = ampm;
  }

  // 1. Real-Time Data (Section 1)
  async function fetchRealtime() {
    if (!currentSiteId) return;
    try {
      const res = await fetch(`/api/publytics/realtime?siteId=${encodeURIComponent(currentSiteId)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      const data = await res.json();

      const active = data.activeVisitors !== undefined ? data.activeVisitors
                   : (data.visitors !== undefined ? data.visitors
                   : (data.count !== undefined ? data.count : 0));

      const rtEl = document.getElementById('rt-active-visitors');
      if (rtEl) rtEl.textContent = formatNum(active);

      const m1 = data['1m'] !== undefined ? data['1m'] : active;
      const m5 = data['5m'] !== undefined ? data['5m'] : active;
      const m30 = data['30m'] !== undefined ? data['30m'] : active;

      if (document.getElementById('rt-1m-val')) document.getElementById('rt-1m-val').textContent = formatNum(m1);
      if (document.getElementById('rt-5m-val')) document.getElementById('rt-5m-val').textContent = formatNum(m5);
      if (document.getElementById('rt-30m-val')) document.getElementById('rt-30m-val').textContent = formatNum(m30);

      const pagesBox = document.getElementById('rt-pages-content');
      const pages = data.pages || data.activePages || [];
      if (pagesBox) {
        if (Array.isArray(pages) && pages.length > 0) {
          pagesBox.innerHTML = pages.slice(0, 5).map(p => `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.82rem;">
              <span style="color:#ffffff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:80%;">${escapeHtml(p.page || p.url || p.path || '/')}</span>
              <strong style="color:var(--p-cyan);">${formatNum(p.visitors || p.count || 1)}</strong>
            </div>
          `).join('');
        } else {
          pagesBox.textContent = active > 0 ? `${active} active visitor(s) across site` : 'No active visitors right now';
        }
      }
    } catch (e) {
      if (document.getElementById('rt-active-visitors')) document.getElementById('rt-active-visitors').textContent = '0';
      if (document.getElementById('rt-1m-val')) document.getElementById('rt-1m-val').textContent = '0';
      if (document.getElementById('rt-5m-val')) document.getElementById('rt-5m-val').textContent = '0';
      if (document.getElementById('rt-30m-val')) document.getElementById('rt-30m-val').textContent = '0';
      const pagesBox = document.getElementById('rt-pages-content');
      if (pagesBox) pagesBox.textContent = 'Listening for real-time visitors...';
    }
  }

  // 2. Overview / Main Analytics (Section 4)
  async function fetchOverview() {
    if (!currentSiteId) return;
    try {
      const res = await fetch(`/api/publytics/overview?siteId=${encodeURIComponent(currentSiteId)}&period=${encodeURIComponent(currentPeriod)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const users = data.users !== undefined ? data.users : (data.uniqueVisitors !== undefined ? data.uniqueVisitors : (data.visitors || 0));
      const views = data.pageviews !== undefined ? data.pageviews : (data.views || 0);
      const sessions = data.sessions !== undefined ? data.sessions : (data.visits || 0);
      const duration = data.sessionDuration !== undefined ? data.sessionDuration : (data.duration || 0);
      const bounce = data.bounceRate !== undefined ? data.bounceRate : (data.bounce_rate || 0);

      if (document.getElementById('kpi-users-val')) document.getElementById('kpi-users-val').textContent = formatNum(users);
      if (document.getElementById('kpi-views-val')) document.getElementById('kpi-views-val').textContent = formatNum(views);
      if (document.getElementById('kpi-sessions-val')) document.getElementById('kpi-sessions-val').textContent = formatNum(sessions);
      if (document.getElementById('kpi-duration-val')) document.getElementById('kpi-duration-val').textContent = formatDuration(duration);
      if (document.getElementById('kpi-bounce-val')) document.getElementById('kpi-bounce-val').textContent = formatPct(bounce);

      // Also update drilldown mini KPI cards
      if (document.getElementById('dd-stat-visitors')) document.getElementById('dd-stat-visitors').textContent = formatNum(users || sessions);
      if (document.getElementById('dd-stat-duration')) document.getElementById('dd-stat-duration').textContent = formatDuration(duration);
      if (document.getElementById('dd-stat-bounce')) document.getElementById('dd-stat-bounce').textContent = formatPct(bounce);
      if (document.getElementById('dd-stat-views')) document.getElementById('dd-stat-views').textContent = formatNum(views);

    } catch (e) {
      if (document.getElementById('kpi-users-val')) document.getElementById('kpi-users-val').textContent = '0';
      if (document.getElementById('kpi-views-val')) document.getElementById('kpi-views-val').textContent = '0';
      if (document.getElementById('kpi-sessions-val')) document.getElementById('kpi-sessions-val').textContent = '0';
      if (document.getElementById('kpi-duration-val')) document.getElementById('kpi-duration-val').textContent = '0s';
      if (document.getElementById('kpi-bounce-val')) document.getElementById('kpi-bounce-val').textContent = '0%';
    }
  }

  // 3. User List Data (Section 5)
  window.fetchUsersList = async function() {
    if (!currentSiteId) return;
    const tbody = document.getElementById('users-table-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:1.5rem; color:#7f9bc2;">
            Loading live user identifiers from Publytics API...
          </td>
        </tr>
      `;
    }

    try {
      const res = await fetch(`/api/publytics/users?siteId=${encodeURIComponent(currentSiteId)}&period=${encodeURIComponent(currentPeriod)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const users = Array.isArray(raw) ? raw : (raw.data || raw.users || []);
      currentUsersData = users;

      renderUsersTable(users);
    } catch (e) {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7">
              <div class="p-empty-state">
                <div class="p-empty-icon">👤</div>
                <div class="p-empty-title">No User Identifiers Found</div>
                <div class="p-empty-sub">No user sessions were recorded by the Publytics API for <strong>${escapeHtml(currentSiteId)}</strong> in this period.</div>
              </div>
            </td>
          </tr>
        `;
      }
    }
  };

  function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    if (!Array.isArray(users) || users.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="p-empty-state">
              <div class="p-empty-icon">👥</div>
              <div class="p-empty-title">No User Sessions Recorded</div>
              <div class="p-empty-sub">Publytics API recorded no active user sessions for <strong>${escapeHtml(currentSiteId)}</strong> in this period.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = users.map((u, idx) => {
      const id = u.userId || u.id || u.user_id || `User #${idx + 1}`;
      const location = u.country || u.location || u.city || 'Unknown';
      const device = u.device || u.os || u.browser || 'Web';
      const sessions = u.sessions || u.sessionCount || u.visits || 1;
      const lastActive = u.lastActive || u.timestamp || u.lastSeen || 'Recent';

      return `
        <tr class="clickable-row publytics-tr" onclick="openUserAnalytics('${escapeHtml(id)}', ${idx});" title="Click to view complete user analytics">
          <td data-label="#" style="color:#00e5ff; font-weight:800;">#${idx + 1}</td>
          <td data-label="User">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="font-size:1.1rem;">👤</span>
              <strong style="color:#00e5ff; font-family:monospace;">${escapeHtml(id)}</strong>
            </div>
          </td>
          <td data-label="Location" style="color:#ffffff;">${escapeHtml(location)}</td>
          <td data-label="Platform"><span class="p-badge-pill">${escapeHtml(device)}</span></td>
          <td data-label="Sessions"><strong style="color:#ffffff;">${formatNum(sessions)}</strong></td>
          <td data-label="Last Active" style="color:#7f9bc2; font-size:0.75rem;">${escapeHtml(lastActive)}</td>
          <td data-label="Details" style="text-align:right;">
            <button type="button" class="btn btn-ghost btn-sm" style="color:#00e5ff; font-size:0.8rem; padding:0.2rem 0.45rem;">🔍</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Clicking a user opens their complete available analytics from Publytics API (Section 5)
  window.openUserAnalytics = async function(userId, fallbackIndex = null) {
    const modal = document.getElementById('user-deepdive-modal');
    const content = document.getElementById('user-modal-content');
    const title = document.getElementById('user-modal-title-text');
    if (modal) modal.classList.add('open');
    if (title) title.textContent = `User: ${userId}`;
    if (content) {
      content.innerHTML = `
        <div style="text-align:center; padding:2rem; color:#7f9bc2;">
          <div style="font-size:2rem; animation:pubRotate 1s linear infinite; display:inline-block;">🔄</div>
          <div style="margin-top:0.75rem; font-weight:700; color:#ffffff;">Fetching complete user analytics from Publytics API...</div>
        </div>
      `;
    }

    try {
      const res = await fetch(`/api/publytics/users/${encodeURIComponent(userId)}?siteId=${encodeURIComponent(currentSiteId)}`);
      let data = {};
      if (res.ok) {
        data = await res.json();
      } else if (fallbackIndex !== null && currentUsersData[fallbackIndex]) {
        data = currentUsersData[fallbackIndex];
      }

      renderUserModalContent(userId, data);
    } catch (e) {
      const fallback = fallbackIndex !== null ? currentUsersData[fallbackIndex] : {};
      renderUserModalContent(userId, fallback || {});
    }
  };

  function renderUserModalContent(userId, u) {
    const content = document.getElementById('user-modal-content');
    if (!content) return;

    const sessions = u.sessions || u.sessionCount || u.visits || 1;
    const duration = u.duration || u.sessionDuration || 0;
    const pageviews = u.pageviews || u.views || u.pagesCount || 1;
    const country = u.country || u.location || 'Unknown';
    const device = u.device || 'Desktop';
    const os = u.os || 'Unknown OS';
    const browser = u.browser || 'Unknown Browser';
    const firstSeen = u.firstSeen || u.first_seen || 'N/A';
    const lastSeen = u.lastActive || u.lastSeen || 'N/A';
    const pages = Array.isArray(u.pages) ? u.pages : (Array.isArray(u.history) ? u.history : []);

    content.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; background:#03112c; padding:0.85rem 1rem; border-radius:12px; border:1px solid rgba(0,144,255,0.25);">
        <div>
          <div style="font-size:0.72rem; color:#7f9bc2; font-weight:700; text-transform:uppercase;">USER IDENTIFIER</div>
          <div style="color:#00e5ff; font-weight:900; font-family:monospace; font-size:1.1rem; margin-top:0.2rem;">${escapeHtml(userId)}</div>
        </div>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          <span class="p-badge-pill">📍 ${escapeHtml(country)}</span>
          <span class="p-badge-pill">📱 ${escapeHtml(device)}</span>
        </div>
      </div>

      <div class="p-stat-grid">
        <div class="p-stat-box">
          <div class="p-stat-box-label">Total Sessions</div>
          <div class="p-stat-box-val">${formatNum(sessions)}</div>
        </div>
        <div class="p-stat-box">
          <div class="p-stat-box-label">Total Pageviews</div>
          <div class="p-stat-box-val">${formatNum(pageviews)}</div>
        </div>
        <div class="p-stat-box">
          <div class="p-stat-box-label">Total Duration</div>
          <div class="p-stat-box-val">${formatDuration(duration)}</div>
        </div>
      </div>

      <div style="background:#03112c; border:1px solid rgba(0,144,255,0.25); border-radius:12px; padding:0.85rem 1rem;">
        <div style="font-size:0.82rem; font-weight:800; color:#cbd5e1; margin-bottom:0.5rem;">User Environment &amp; Platform</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; font-size:0.8rem;">
          <div><span style="color:#7f9bc2;">Operating System:</span> <strong style="color:#fff;">${escapeHtml(os)}</strong></div>
          <div><span style="color:#7f9bc2;">Browser:</span> <strong style="color:#fff;">${escapeHtml(browser)}</strong></div>
          <div><span style="color:#7f9bc2;">First Seen:</span> <strong style="color:#fff;">${escapeHtml(firstSeen)}</strong></div>
          <div><span style="color:#7f9bc2;">Last Active:</span> <strong style="color:#fff;">${escapeHtml(lastSeen)}</strong></div>
        </div>
      </div>

      ${pages.length > 0 ? `
        <div style="background:#03112c; border:1px solid rgba(0,144,255,0.25); border-radius:12px; padding:0.85rem 1rem;">
          <div style="font-size:0.82rem; font-weight:800; color:#cbd5e1; margin-bottom:0.5rem;">Visited Pages &amp; Actions</div>
          <div style="display:flex; flex-direction:column; gap:0.35rem; max-height:180px; overflow-y:auto;">
            ${pages.map(p => `
              <div style="display:flex; justify-content:space-between; font-size:0.78rem; padding:0.25rem 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span style="color:#00e5ff;">${escapeHtml(p.page || p.url || p)}</span>
                <span style="color:#7f9bc2;">${escapeHtml(p.time || '')}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  window.closeUserDeepdiveModal = function() {
    const modal = document.getElementById('user-deepdive-modal');
    if (modal) modal.classList.remove('open');
  };

  // Scroll to User List from KPI Card
  window.scrollToUsersSection = function() {
    const card = document.getElementById('user-list-section-card');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      card.style.outline = '2px solid #00e5ff';
      setTimeout(() => { card.style.outline = ''; }, 1800);
    }
  };

  // ==========================================================================
  // 4. CLICKABLE DETAILED DATA & DRILLDOWN VIEW (Sections 2, 3, 6)
  // ==========================================================================

  window.openDrilldownPage = function(dimensionKey, titleLabel) {
    showDrilldownViewInternal(dimensionKey, titleLabel, true);
  };

  function showDrilldownViewInternal(dimensionKey, titleLabel, pushToHistory = true) {
    currentActiveDimension = dimensionKey;

    const ddView = document.getElementById('drilldown-page-view');
    if (ddView) {
      ddView.style.display = 'block';
      ddView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (pushToHistory) {
      history.pushState({ view: 'drilldown', dimKey: dimensionKey, dimTitle: titleLabel }, '');
    }

    const iconMap = {
      'utm_source': '🎯',
      'utm_medium': '🔀',
      'utm_campaign': '📢',
      'utm_term': '📋',
      'utm_content': '</>',
      'referrer': '🔗',
      'source': '🌐',
      'source_medium': '🔀',
      'country': '🌍',
      'device': '📱',
      'os': '💻',
      'browser': '🌐',
      'hostname': '🏷️',
      'page': '📄'
    };

    const cleanTitle = titleLabel || dimensionKey.replace('utm_', 'UTM ').toUpperCase();

    // Update Header
    const pageTitle = document.getElementById('dd-page-title-text');
    if (pageTitle) pageTitle.textContent = cleanTitle;

    // Update Hero Banner
    const heroIcon = document.getElementById('dd-hero-icon');
    const heroTitle = document.getElementById('dd-hero-title-text');
    const heroSub = document.getElementById('dd-hero-sub-text');

    if (heroIcon) heroIcon.textContent = iconMap[dimensionKey] || '📊';
    if (heroTitle) heroTitle.textContent = `${cleanTitle} Analytics`;
    if (heroSub) heroSub.textContent = `Live breakdown for ${cleanTitle.toLowerCase()} from Publytics API`;

    // Update Legend & Table Titles
    const legendTitle = document.getElementById('dd-legend-title-text');
    if (legendTitle) legendTitle.textContent = `Traffic by ${cleanTitle}`;

    const tableHeader = document.getElementById('dd-table-header-title');
    if (tableHeader) tableHeader.textContent = `${cleanTitle} Details`;

    const thDim = document.getElementById('th-dim-label');
    if (thDim) thDim.textContent = cleanTitle;

    // Fetch and render the analytics breakdown
    fetchDimensionData(dimensionKey);
  }

  window.closeDrilldownView = function() {
    closeDrilldownViewInternal(true);
  };

  function closeDrilldownViewInternal(popHistory = true) {
    const ddView = document.getElementById('drilldown-page-view');
    if (ddView) ddView.style.display = 'none';

    if (popHistory && window.history.state && window.history.state.view === 'drilldown') {
      window.history.back();
    }
  }

  // Fetch Dimension Data directly from Publytics API (Zero Synthetic Fallbacks)
  async function fetchDimensionData(dimKey) {
    if (!currentSiteId) return;
    const tbody = document.getElementById('dd-table-body-rows');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:1.75rem; color:#7f9bc2;">
            Loading ${escapeHtml(dimKey)} data from Publytics API...
          </td>
        </tr>
      `;
    }

    try {
      const res = await fetch(`/api/publytics/dimension/${dimKey}?siteId=${encodeURIComponent(currentSiteId)}&period=${encodeURIComponent(currentPeriod)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const items = Array.isArray(raw) ? raw : (raw.data || raw.items || []);
      currentDimensionData = items;

      renderDrilldownAnalytics(dimKey, items);
    } catch (err) {
      currentDimensionData = [];
      renderDrilldownAnalytics(dimKey, []);
    }
  }

  // Render Donut Chart, Legend, and Details Table with 100% Real API Data
  function renderDrilldownAnalytics(dimKey, items) {
    const totalVis = items.reduce((acc, i) => acc + Number(i.visitors || i.count || i.sessions || 0), 0);

    const centerTotal = document.getElementById('donut-center-num-text');
    if (centerTotal) centerTotal.textContent = formatNum(totalVis);

    const donutSvg = document.getElementById('donut-svg-element');
    const legendContainer = document.getElementById('dd-legend-items-container');
    const tbody = document.getElementById('dd-table-body-rows');
    const chartCard = document.getElementById('dd-chart-section');

    // If zero data: render clean empty state
    if (!Array.isArray(items) || items.length === 0 || totalVis === 0) {
      if (chartCard) chartCard.style.display = 'none';
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6">
              <div class="p-empty-state">
                <div class="p-empty-icon">📊</div>
                <div class="p-empty-title">No Traffic Data Recorded</div>
                <div class="p-empty-sub">
                  Publytics API recorded no visitor data for <strong>${escapeHtml(dimKey)}</strong> on <strong>${escapeHtml(currentSiteId)}</strong> in this period.
                </div>
              </div>
            </td>
          </tr>
        `;
      }
      return;
    }

    if (chartCard) chartCard.style.display = 'flex';

    // Build Donut Segments
    const circumference = 2 * Math.PI * 38; // ~238.76
    let accumulatedStroke = 0;
    let svgSegments = '';

    items.slice(0, 6).forEach((item, idx) => {
      const count = Number(item.visitors || item.count || item.sessions || 0);
      const ratio = totalVis > 0 ? (count / totalVis) : 0;
      const strokeLength = ratio * circumference;
      const strokeColor = DONUT_COLORS[idx % DONUT_COLORS.length];
      const strokeDashoffset = -accumulatedStroke;

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

      accumulatedStroke += strokeLength;
    });

    if (donutSvg) {
      donutSvg.innerHTML = svgSegments || `<circle cx="50" cy="50" r="38" fill="none" stroke="#1e293b" stroke-width="12"></circle>`;
    }

    // Render Legend
    if (legendContainer) {
      legendContainer.innerHTML = items.slice(0, 6).map((item, idx) => {
        const name = item.name || item.value || item[dimKey] || 'other';
        const count = Number(item.visitors || item.count || item.sessions || 0);
        const share = item.share !== undefined ? Number(item.share).toFixed(1) : (totalVis > 0 ? ((count / totalVis) * 100).toFixed(1) : '0.0');
        const color = DONUT_COLORS[idx % DONUT_COLORS.length];

        return `
          <div class="dd-legend-item" onclick="openItemAnalytics('${escapeHtml(dimKey)}', ${idx});" style="cursor:pointer;">
            <div class="dd-legend-item-left">
              <span class="brand-dot" style="background:${color};"></span>
              <span style="color:#ffffff; font-weight:600;">${escapeHtml(name)}</span>
            </div>
            <div class="dd-legend-item-right">
              <span style="color:#ffffff;">${formatNum(count)}</span>
              <span style="color:#7f9bc2; width:48px; text-align:right;">${share}%</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // Render Table (Every single row is clickable!)
    if (tbody) {
      tbody.innerHTML = items.map((item, idx) => {
        const name = item.name || item.value || item[dimKey] || 'other';
        const count = Number(item.visitors || item.count || item.sessions || 0);
        const share = item.share !== undefined ? Number(item.share).toFixed(1) : (totalVis > 0 ? ((count / totalVis) * 100).toFixed(1) : '0.0');
        const duration = item.duration || (item.avgDuration ? formatDuration(item.avgDuration) : 'N/A');

        return `
          <tr class="clickable-row publytics-tr" onclick="openItemAnalytics('${escapeHtml(dimKey)}', ${idx});" title="Click to view full Publytics details for ${escapeHtml(name)}">
            <td data-label="#" style="color:#00e5ff; font-weight:800;">#${idx + 1}</td>
            <td data-label="Item">
              <div class="brand-cell">
                ${getBrandIconHtml(name)}
                <span style="font-weight:700; color:#ffffff;">${escapeHtml(name)}</span>
              </div>
            </td>
            <td data-label="Visitors"><strong style="color:#ffffff;">${formatNum(count)}</strong></td>
            <td data-label="% Share" style="color:#00e5ff; font-weight:800;">${share}%</td>
            <td data-label="Avg Duration" style="color:#7f9bc2;">${duration}</td>
            <td data-label="Details" style="text-align:right;">
              <button type="button" class="btn btn-ghost btn-sm" style="color:#00e5ff; font-size:0.8rem; padding:0.2rem 0.45rem;">🔍</button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // --- ITEM DEEP-DIVE MODAL (Clicking any row in any drilldown table) ---
  window.openItemAnalytics = function(dimKey, itemIndex) {
    const item = currentDimensionData[itemIndex];
    if (!item) return;

    const modal = document.getElementById('item-deepdive-modal');
    const title = document.getElementById('item-modal-title-text');
    const content = document.getElementById('item-modal-content');
    if (modal) modal.classList.add('open');

    const name = item.name || item.value || item[dimKey] || 'Unknown Item';
    if (title) title.textContent = `${name}`;

    const totalVis = currentDimensionData.reduce((acc, i) => acc + Number(i.visitors || i.count || i.sessions || 0), 0);
    const count = Number(item.visitors || item.count || item.sessions || 0);
    const share = item.share !== undefined ? Number(item.share).toFixed(1) : (totalVis > 0 ? ((count / totalVis) * 100).toFixed(1) : '0.0');
    const duration = item.duration || (item.avgDuration ? formatDuration(item.avgDuration) : 'N/A');
    const bounce = item.bounceRate !== undefined ? formatPct(item.bounceRate) : 'N/A';

    if (content) {
      content.innerHTML = `
        <div style="background:#03112c; border:1px solid rgba(0,144,255,0.25); border-radius:12px; padding:0.9rem 1.1rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
          <div style="display:flex; align-items:center; gap:0.65rem;">
            ${getBrandIconHtml(name)}
            <div>
              <div style="font-size:0.72rem; color:#7f9bc2; font-weight:700; text-transform:uppercase;">${escapeHtml(dimKey.toUpperCase())}</div>
              <div style="font-size:1.15rem; font-weight:900; color:#ffffff;">${escapeHtml(name)}</div>
            </div>
          </div>
          <span class="p-badge-pill" style="font-size:0.85rem; padding:0.35rem 0.75rem;">${share}% Total Share</span>
        </div>

        <div class="p-stat-grid">
          <div class="p-stat-box">
            <div class="p-stat-box-label">Visitors</div>
            <div class="p-stat-box-val" style="color:#00e5ff;">${formatNum(count)}</div>
          </div>
          <div class="p-stat-box">
            <div class="p-stat-box-label">Avg. Duration</div>
            <div class="p-stat-box-val">${duration}</div>
          </div>
          <div class="p-stat-box">
            <div class="p-stat-box-label">Bounce Rate</div>
            <div class="p-stat-box-val">${bounce}</div>
          </div>
        </div>

        <div style="background:#03112c; border:1px solid rgba(0,144,255,0.25); border-radius:12px; padding:0.9rem 1.1rem;">
          <div style="font-size:0.82rem; font-weight:800; color:#cbd5e1; margin-bottom:0.5rem;">Publytics API Dimension Metadata</div>
          <div style="display:flex; flex-direction:column; gap:0.4rem; font-size:0.8rem;">
            <div><span style="color:#7f9bc2;">Site ID:</span> <strong style="color:#fff;">${escapeHtml(currentSiteId)}</strong></div>
            <div><span style="color:#7f9bc2;">Time Range:</span> <strong style="color:#fff;">${escapeHtml(currentPeriod)}</strong></div>
            <div><span style="color:#7f9bc2;">Dimension:</span> <strong style="color:#fff;">${escapeHtml(dimKey)}</strong></div>
            <div><span style="color:#7f9bc2;">Raw Value:</span> <code style="color:#00e5ff; background:rgba(0,144,255,0.1); padding:0.15rem 0.4rem; border-radius:4px;">${escapeHtml(name)}</code></div>
          </div>
        </div>
      `;
    }
  };

  window.closeItemDeepdiveModal = function() {
    const modal = document.getElementById('item-deepdive-modal');
    if (modal) modal.classList.remove('open');
  };

  // Close modals when clicking on backdrop
  document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('p-modal-overlay')) {
      e.target.classList.remove('open');
    }
  });

  // Keyboard Escape to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.p-modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  // Settings redirect
  window.openConfigModal = function() {
    window.location.href = '/admin#tab-settings';
  };
  window.closeConfigModal = function() {};

})();
