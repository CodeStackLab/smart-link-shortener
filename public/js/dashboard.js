document.addEventListener('DOMContentLoaded', () => {
  // Intercept global fetch to handle 401 Unauthorized globally (e.g. if container restarted and session memory was wiped)
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const res = await originalFetch(...args);
    if (res.status === 401 && !args[0].includes('/api/session')) {
      window.location.href = '/admin';
    }
    return res;
  };

  const alertBox = document.getElementById('dashboard-alert');
  const logoutBtn = document.getElementById('logout-btn');
  const userBadge = document.getElementById('user-badge');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');

  // QR Modal Elements
  const qrModal = document.getElementById('qr-modal');
  const qrModalCode = document.getElementById('qr-modal-code');
  const qrModalImg = document.getElementById('qr-modal-img');
  const qrDownloadBtn = document.getElementById('qr-download-btn');
  const closeQrBtn = document.getElementById('close-qr-btn');

  if (closeQrBtn) {
    closeQrBtn.addEventListener('click', () => {
      if (qrModal) qrModal.style.display = 'none';
    });
  }

  // Theme Switcher Engine
  let currentTheme = localStorage.getItem('theme') || 'light';

  window.applyTheme = function(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (themeToggleBtn) {
      if (theme === 'light') themeToggleBtn.innerHTML = '☀️ Light';
      else if (theme === 'dark') themeToggleBtn.innerHTML = '🌙 Dark';
      else if (theme === 'multi') themeToggleBtn.innerHTML = '🌈 Sunset';
      else if (theme === 'ocean') themeToggleBtn.innerHTML = '❄️ Ocean';
      else if (theme === 'wine') themeToggleBtn.innerHTML = '🍷 Wine';
      else if (theme === 'forest') themeToggleBtn.innerHTML = '🌲 Forest';
    }
  };

  // Define local variable applyTheme as a shortcut
  const applyTheme = window.applyTheme;
  applyTheme(currentTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const themeOrder = ['light', 'dark', 'multi', 'ocean', 'wine', 'forest'];
      let nextIndex = (themeOrder.indexOf(currentTheme) + 1) % themeOrder.length;
      if (nextIndex === -1) nextIndex = 0;
      applyTheme(themeOrder[nextIndex]);
    });
  }

  // Helper: Convert Base64 Data URI to Native Binary Blob URL for Reliable 1-Click PNG Download
  function base64ToBlobUrl(base64Data, mimeType = 'image/png') {
    try {
      const parts = base64Data.split(';base64,');
      const contentType = parts[0].replace('data:', '') || mimeType;
      const raw = window.atob(parts[1] || base64Data);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);

      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }

      const blob = new Blob([uInt8Array], { type: contentType });
      return URL.createObjectURL(blob);
    } catch (e) {
      return base64Data;
    }
  }
  // --------------------------------------------------------
  // COPY LINK TOAST — shown after shortlink generation
  // --------------------------------------------------------
  function showCopyLinkToast(shortUrl) {
    // Remove any existing toast first
    const existing = document.getElementById('copy-link-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'copy-link-toast';
    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.7rem; flex-wrap:wrap;">
        <span style="font-size:1.25rem;">✅</span>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:800; font-size:0.82rem; color:#fff; margin-bottom:0.15rem; letter-spacing:0.02em;">Short Link Created!</div>
          <div id="copy-link-toast-url" style="font-size:0.75rem; color:rgba(255,255,255,0.85); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;">${shortUrl}</div>
        </div>
        <button id="copy-link-toast-btn" style="background:#fff; color:#1877f2; border:none; border-radius:8px; padding:0.4rem 0.85rem; font-weight:800; font-size:0.82rem; cursor:pointer; flex-shrink:0; box-shadow:0 2px 8px rgba(0,0,0,0.12);">📋 Copy</button>
        <button id="copy-link-toast-close" style="background:rgba(255,255,255,0.18); color:#fff; border:none; border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:1rem; line-height:1; display:flex; align-items:center; justify-content:center; flex-shrink:0;">✕</button>
      </div>
    `;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '5.5rem',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'linear-gradient(135deg, #1877f2 0%, #0d5fd9 100%)',
      borderRadius: '14px',
      padding: '0.85rem 1rem',
      width: 'min(92vw, 380px)',
      boxShadow: '0 8px 32px rgba(24,119,242,0.4)',
      zIndex: '99999',
      animation: 'slideUpFade 0.35s cubic-bezier(.22,.68,0,1.2) forwards',
    });

    document.body.appendChild(toast);

    // Inject animation if not already present
    if (!document.getElementById('toast-anim-style')) {
      const style = document.createElement('style');
      style.id = 'toast-anim-style';
      style.textContent = `@keyframes slideUpFade { from { opacity:0; transform:translateX(-50%) translateY(20px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`;
      document.head.appendChild(style);
    }

    // Copy button handler
    document.getElementById('copy-link-toast-btn').addEventListener('click', function() {
      navigator.clipboard.writeText(shortUrl).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = shortUrl;
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      });
      this.textContent = '✅ Copied!';
      this.style.background = '#10b981';
      this.style.color = '#fff';
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 1800);
    });

    // Close button handler
    document.getElementById('copy-link-toast-close').addEventListener('click', () => toast.remove());

    // Auto-dismiss after 8 seconds
    setTimeout(() => { if (toast && toast.parentNode) toast.remove(); }, 8000);
  }


  const toggleProSettingsBtn = document.getElementById('toggle-pro-settings-btn');
  const proSettingsBody = document.getElementById('pro-settings-body');
  const proSettingsToggleIcon = document.getElementById('pro-settings-toggle-icon');

  if (toggleProSettingsBtn && proSettingsBody) {
    toggleProSettingsBtn.addEventListener('click', () => {
      const isOpen = proSettingsBody.classList.contains('open');
      if (!isOpen) {
        proSettingsBody.classList.add('open');
        toggleProSettingsBtn.classList.add('open');
        if (proSettingsToggleIcon) { proSettingsToggleIcon.textContent = '▼ Hide'; proSettingsToggleIcon.classList.add('open'); }
      } else {
        proSettingsBody.classList.remove('open');
        toggleProSettingsBtn.classList.remove('open');
        if (proSettingsToggleIcon) { proSettingsToggleIcon.textContent = '▶ Click to Show'; proSettingsToggleIcon.classList.remove('open'); }
      }
    });
  }

  let currentLoggedInUsername = '';
  let currentLoggedInRole = 'Admin';

  // Check Session & Update Header User Badge & Apply Role Scoping
  fetch('/api/session')
    .then(res => res.json())
    .then(data => {
      if (!data.authenticated) {
        window.location.href = '/admin';
      } else {
        currentLoggedInUsername = data.username || 'admin';
        currentLoggedInRole = data.role || 'Admin';
        if (userBadge) {
          const uName = (data.username || 'admin').trim();
          const uRole = (data.role || 'Admin').trim();
          if (uName.toLowerCase() === 'admin' || uName.toLowerCase() === uRole.toLowerCase()) {
            userBadge.textContent = uRole;
          } else {
            userBadge.textContent = `${uName} (${uRole})`;
          }
          userBadge.className = `badge ${uRole === 'Admin' ? 'badge-red' : (uRole === 'Manager' ? 'badge-info' : 'badge-success')}`;
        }
        applyRoleUiScoping(currentLoggedInRole, data.permissions);
        updateTargetUrlFieldForRole(data);
        // Load data AFTER session is confirmed
        loadLinks();
        loadUsers();
      }
    })
    .catch(() => {
      window.location.href = '/admin';
    });

  function updateTargetUrlFieldForRole(sessionData) {
    const targetInput = document.getElementById('target-url');
    const targetSelect = document.getElementById('target-url-select');
    const postUrlInput = document.getElementById('post-url-input');

    if (!targetInput || !targetSelect) return;

    const role = sessionData ? sessionData.role : (currentLoggedInRole || 'Admin');
    const allowedSites = (sessionData && Array.isArray(sessionData.allowedTargetDomains)) ? sessionData.allowedTargetDomains : [];

    if (role === 'Admin') {
      targetInput.style.display = 'block';
      targetInput.required = true;
      targetSelect.style.display = 'none';
      targetSelect.required = false;
    } else {
      // Editor / Manager sees Dropdown Select Menu
      targetInput.style.display = 'none';
      targetInput.required = false;
      targetSelect.style.display = 'block';
      targetSelect.required = true;

      if (allowedSites.length > 0) {
        const cleanSites = allowedSites.map(s => {
          let clean = s.trim();
          if (!/^https?:\/\//i.test(clean)) {
            clean = 'https://' + clean.replace(/^www\./i, '');
          }
          return clean;
        });

        targetSelect.innerHTML = cleanSites.map(s => `<option value="${s}">🌐 ${s}</option>`).join('');
        // Automatically default to 1st assigned site so Editor doesn't have to pick manually!
        targetSelect.value = cleanSites[0];
        targetInput.value = cleanSites[0];
      } else {
        targetSelect.innerHTML = `<option value="">-- No Assigned Target Websites (Ask Admin to add sites in Settings) --</option>`;
      }
    }

    // Auto-update targetInput when post-url-input or targetSelect changes
    if (postUrlInput) {
      const updateTargetUrl = () => {
        const val = postUrlInput.value.trim();
        let base = (targetSelect && targetSelect.style.display !== 'none' && targetSelect.value)
          ? targetSelect.value.trim()
          : (targetInput.value || targetInput.placeholder || 'https://website.com');
        if (base && !/^https?:\/\//i.test(base)) base = 'https://' + base;
        base = base.split('/')[0] + '//' + base.split('/')[2]; // base domain
        if (base.endsWith('/undefined') || !base.includes('.')) base = 'https://website.com';

        if (val.startsWith('http://') || val.startsWith('https://')) {
          targetInput.value = val;
        } else if (val) {
          let cleanPath = val.startsWith('/') ? val : '/' + val;
          targetInput.value = base + cleanPath;
        }
      };

      postUrlInput.oninput = updateTargetUrl;
      if (targetSelect) targetSelect.onchange = updateTargetUrl;
    }
  }

  let userCurrentPermissions = ['links', 'domains', 'geo', 'analytics', 'firewall', 'settings'];

  function applyRoleUiScoping(role, permissions) {
    const isFullAdmin = role === 'Admin';
    const userPerms = Array.isArray(permissions) ? permissions : (isFullAdmin ? ['links', 'domains', 'geo', 'analytics', 'firewall', 'settings'] : ['links', 'geo', 'analytics']);
    userCurrentPermissions = userPerms;

    const navMap = [
      { key: 'links', tabId: 'tab-links' },
      { key: 'domains', tabId: 'tab-domains' },
      { key: 'geo', tabId: 'tab-geo' },
      { key: 'analytics', tabId: 'tab-analytics' },
      { key: 'firewall', tabId: 'tab-firewall' },
      { key: 'settings', tabId: 'tab-settings' }
    ];

    navMap.forEach(item => {
      const hasAccess = isFullAdmin || userPerms.includes(item.key);

      const tabBtn = document.querySelector(`.tab-btn[data-tab="${item.tabId}"]`);
      if (tabBtn) tabBtn.style.display = hasAccess ? '' : 'none';

      const mobileBtn = document.querySelector(`.mobile-nav-item[data-tab="${item.tabId}"]`);
      if (mobileBtn) mobileBtn.style.display = hasAccess ? '' : 'none';

      const tabContent = document.getElementById(item.tabId);
      if (tabContent && !hasAccess) tabContent.style.display = 'none';
    });

    const createFormCard = document.querySelector('#create-link-form')?.closest('.card');
    if (createFormCard) {
      if (role === 'Manager') {
        createFormCard.style.display = 'none';
      } else {
        createFormCard.style.display = 'block';
      }
    }

    const proAccordion = document.getElementById('pro-accordion');
    if (proAccordion) {
      proAccordion.style.display = (isFullAdmin || userPerms.includes('settings')) ? '' : 'none';
    }

    // Platform Traffic Sources Scoping for Editor / Manager
    const chipInstagram = document.getElementById('chip-instagram');
    const chipCustomWeb = document.getElementById('chip-custom-website');
    if (chipInstagram) {
      chipInstagram.style.display = (isFullAdmin || userPerms.includes('instagram')) ? 'inline-flex' : 'none';
    }
    if (chipCustomWeb) {
      chipCustomWeb.style.display = (isFullAdmin || userPerms.includes('custom_website')) ? 'inline-flex' : 'none';
    }
  }


  // Logout Handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/admin';
    });
  }

  // Mobile Hamburger Menu Toggler
  const hamburgerMenuBtn = document.getElementById('hamburger-menu-btn');
  const menuOverlay = document.getElementById('menu-overlay');

  const closeDrawerBtn = document.getElementById('close-drawer-btn');

  if (hamburgerMenuBtn) {
    hamburgerMenuBtn.addEventListener('click', () => {
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

  // Tab Switcher Logic
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Team / Users section elements
  const inviteUserForm = document.getElementById('invite-user-form');
  const usersTbody = document.getElementById('users-tbody');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.style.display = 'none');

      btn.classList.add('active');
      document.getElementById(targetTab).style.display = 'block';

      // Close mobile navigation drawer
      document.body.classList.remove('menu-open');

      if (targetTab === 'tab-links') loadLinks();
      if (targetTab === 'tab-domains') loadDomains();
      if (targetTab === 'tab-geo') loadCountryAnalytics();
      if (targetTab === 'tab-analytics') loadAnalytics();
      if (targetTab === 'tab-firewall') loadBlockedIps();
      if (targetTab === 'tab-settings') loadUsers();
    });
  });

  // Show Banner Alert
  function showAlert(msg, isError = false) {
    alertBox.textContent = msg;
    alertBox.className = `alert ${isError ? 'alert-danger' : 'alert-success'}`;
    alertBox.style.display = 'block';
    setTimeout(() => {
      alertBox.style.display = 'none';
    }, 4500);
  }

  // Collapsible DNS Setup Guide Toggle
  const toggleDnsGuideBtn = document.getElementById('toggle-dns-guide-btn');
  const dnsGuideBody = document.getElementById('dns-guide-body');
  const dnsGuideToggleIcon = document.getElementById('dns-guide-toggle-icon');

  if (toggleDnsGuideBtn && dnsGuideBody) {
    toggleDnsGuideBtn.addEventListener('click', () => {
      const isHidden = dnsGuideBody.style.display === 'none' || !dnsGuideBody.style.display;
      dnsGuideBody.style.display = isHidden ? 'block' : 'none';
      if (dnsGuideToggleIcon) {
        dnsGuideToggleIcon.textContent = isHidden ? '▼ Click to Hide Guide' : '▶ Click to Show Guide';
      }
    });
  }

  // Interactive Platform Chips Checkboxes
  const platformChips = document.querySelectorAll('.platform-chip');
  platformChips.forEach(chip => {
    const cb = chip.querySelector('input[type="checkbox"]');
    if (cb) {
      cb.addEventListener('change', () => {
        if (cb.checked) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      });
    }
  });

  // Custom Website Checkbox Chip Toggle
  const customDomainEnableCb = document.getElementById('custom-domain-enable-cb');
  const customDomainsContainer = document.getElementById('custom-domains-container');
  const customDomainChip = document.getElementById('custom-domain-chip');
  const customDomainsInput = document.getElementById('custom-domains-input');
  let customDomainsList = [];

  if (customDomainEnableCb && customDomainsContainer) {
    customDomainEnableCb.addEventListener('change', () => {
      if (customDomainEnableCb.checked) {
        customDomainsContainer.style.display = 'flex';
        if (customDomainChip) customDomainChip.classList.add('active');
      } else {
        customDomainsContainer.style.display = 'none';
        if (customDomainChip) customDomainChip.classList.remove('active');
        customDomainsList = [];
        renderDomainTags();
      }
    });
  }

  function renderDomainTags() {
    if (!customDomainsContainer) return;
    const existingTags = customDomainsContainer.querySelectorAll('.domain-tag');
    existingTags.forEach(t => t.remove());

    customDomainsList.forEach((domain, index) => {
      const tag = document.createElement('div');
      tag.className = 'domain-tag';
      tag.innerHTML = `🌐 ${domain} <span class="remove-tag" data-index="${index}">&times;</span>`;
      customDomainsContainer.insertBefore(tag, customDomainsInput);
    });

    customDomainsContainer.querySelectorAll('.remove-tag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        customDomainsList.splice(idx, 1);
        renderDomainTags();
      });
    });
  }

  if (customDomainsInput) {
    customDomainsInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = customDomainsInput.value.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
        if (val && !customDomainsList.includes(val)) {
          customDomainsList.push(val);
          customDomainsInput.value = '';
          renderDomainTags();
        }
      }
    });
  }

  // --------------------------------------------------------
  // TAB 1: LINK MANAGER LOGIC
  // --------------------------------------------------------
  const linksTbody = document.getElementById('links-tbody');
  const createForm = document.getElementById('create-link-form');
  const searchInput = document.getElementById('search-links');
  let allLinksCache = [];

  async function loadLinks() {
    try {
      const res = await fetch('/api/admin/links');
      if (!res.ok) {
        if (linksTbody) linksTbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem;">Please log in to view links.</td></tr>`;
        return;
      }
      allLinksCache = await res.json();
      renderLinksTable(allLinksCache);
    } catch (err) {
      if (linksTbody) linksTbody.innerHTML = `<tr><td colspan="8" style="color: var(--danger);">Failed to load links.</td></tr>`;
    }
  }

  function renderLinksTable(links) {
    if (!linksTbody) return;

    if (!Array.isArray(links) || links.length === 0) {
      linksTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No smart links found. Create your first link above!</td></tr>`;
      return;
    }

    const host = window.location.origin;

    linksTbody.innerHTML = links.map(link => {
      const domainToUse = link.domain ? link.domain : host.replace(/^https?:\/\//, '');
      const shortUrl = `${window.location.protocol}//${domainToUse}/s/${link.code}`;
      
      const presetBadges = (link.allowedPlatforms || ['facebook']).map(p => {
        const labels = {
          facebook: 'Facebook',
          instagram: 'Instagram'
        };
        return `<span class="badge badge-info">${labels[p] || p}</span>`;
      }).join(' ');

      const customBadges = (link.customDomains || []).map(d => {
        return `<span class="badge badge-custom">🌐 ${d}</span>`;
      }).join(' ');

      // Pro Features Badges
      const delayBadge = link.delaySeconds > 0 
        ? `<span class="badge badge-warning">⏱️ ${link.delaySeconds}s Delay</span>`
        : `<span class="badge badge-info">⏱️ Instant</span>`;

      let limitsInfo = [];
      if (link.maxClicks > 0) limitsInfo.push(`Cap: ${link.clicks}/${link.maxClicks}`);
      if (link.hourlyLimit > 0) limitsInfo.push(`${link.hourlyLimit}/hr`);
      if (link.dailyLimit > 0) limitsInfo.push(`${link.dailyLimit}/day`);
      if (link.monthlyLimit > 0) limitsInfo.push(`${link.monthlyLimit}/mo`);

      const limitsBadge = limitsInfo.length > 0
        ? `<span class="badge badge-custom">🛑 ${limitsInfo.join(', ')}</span>`
        : `<span class="badge badge-success">♾️ Unlimited</span>`;

      let expBadge = '';
      if (link.expiresAt) {
        const isExp = new Date(link.expiresAt).getTime() < Date.now();
        expBadge = isExp
          ? `<span class="badge badge-danger">❌ Expired</span>`
          : `<span class="badge badge-warning">⏰ Expires ${new Date(link.expiresAt).toLocaleDateString()}</span>`;
      }

      const isOwner = (link.createdBy || 'admin').toLowerCase() === currentLoggedInUsername.toLowerCase();
      const canManage = currentLoggedInRole === 'Admin' || isOwner;

      const actionsHtml = canManage ? `
        <div class="action-btn-group">
          <button class="btn btn-secondary btn-sm" onclick="showQrModal('${link.code}')">📱 QR Code</button>
          <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${shortUrl}')">📋 Copy</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleLinkStatus('${link.id}', ${!link.active})">
            ${link.active ? 'Pause' : 'Enable'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteLink('${link.id}')">🗑️ Delete</button>
        </div>
      ` : `
        <div class="action-btn-group">
          <button class="btn btn-secondary btn-sm" onclick="showQrModal('${link.code}')">📱 QR Code</button>
          <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('${shortUrl}')">📋 Copy</button>
          <span class="badge badge-info" style="font-size:0.7rem; padding:0.35rem 0.65rem; font-weight:700;">👁️ View Only</span>
        </div>
      `;

      return `
        <tr>
          <td data-label="Short Link">
            <div class="shortlink-cell-wrap">
              <strong style="color: var(--accent-primary); font-size: 0.95rem;">/${link.code}</strong>
              ${link.createdBy && link.createdBy.toLowerCase() !== 'admin' ? `<span class="badge badge-custom" style="margin-left:0.3rem; font-size:0.6rem;">By: ${link.createdBy}</span>` : ''}
              <div style="margin-top: 0.2rem;">
                <span class="code-box">${shortUrl}</span>
              </div>
            </div>
          </td>
          <td data-label="Target URL">
            <a href="${link.targetUrl}" target="_blank" class="url-link" title="${link.targetUrl}" style="display:block; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${link.targetUrl}</a>
          </td>
          <td data-label="Fallback URL">
            <span style="color: var(--text-secondary); font-size: 0.8rem; display:block; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${link.fallbackUrl}">${link.fallbackUrl}</span>
          </td>
          <td data-label="Allowed Sources">
            <div style="display: flex; gap: 0.3rem; flex-wrap: wrap;">
              ${presetBadges}
              ${customBadges}
            </div>
          </td>
          <td data-label="Settings">
            <div style="display: flex; flex-direction: column; gap: 0.2rem;">
              ${delayBadge}
              ${limitsBadge}
              ${expBadge}
            </div>
          </td>
          <td data-label="Clicks"><strong style="font-size: 1.1rem; font-family: 'Outfit', sans-serif;">${link.clicks || 0}</strong></td>
          <td data-label="Status">
            <span class="badge ${link.active ? 'badge-success' : 'badge-danger'}">
              ${link.active ? 'Active' : 'Paused'}
            </span>
          </td>
          <td data-label="Actions">
            ${actionsHtml}
          </td>
        </tr>
      `;
    }).join('');
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = allLinksCache.filter(l => 
        l.code.toLowerCase().includes(q) || 
        l.targetUrl.toLowerCase().includes(q) ||
        (l.customDomains || []).some(d => d.toLowerCase().includes(q))
      );
      renderLinksTable(filtered);
    });
  }

  // QR Code Modal & 1-Click PNG Download Handler (Using Binary Blob URL)
  window.showQrModal = async function(code) {
    try {
      const res = await fetch(`/api/admin/qrcode/${code}`);
      const data = await res.json();
      if (res.ok && data.qrUrl) {
        if (qrModalCode) qrModalCode.textContent = `/${data.code} - ${data.fullUrl}`;
        if (qrModalImg) qrModalImg.src = data.qrUrl;
        
        if (qrDownloadBtn) {
          qrDownloadBtn.onclick = (e) => {
            e.preventDefault();
            const blobUrl = base64ToBlobUrl(data.qrUrl, 'image/png');
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `qrcode_${data.code}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => {
              if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
            }, 1000);
          };
        }

        if (qrModal) { qrModal.style.display = 'flex'; qrModal.style.setProperty('display','flex','important'); }
      } else {
        showAlert('Failed to load QR code', true);
      }
    } catch (err) {
      showAlert('Failed to load QR code', true);
    }
  };

  window.copyToClipboard = function(text, btnEl) {
    const doCopySuccess = () => {
      if (btnEl) {
        const origText = btnEl.innerHTML;
        btnEl.innerHTML = '✅ Copied!';
        btnEl.style.background = '#059669';
        btnEl.style.color = '#ffffff';
        btnEl.style.borderColor = '#059669';
        setTimeout(() => {
          btnEl.innerHTML = origText;
          btnEl.style.background = '';
          btnEl.style.color = '';
          btnEl.style.borderColor = '';
        }, 2000);
      } else {
        showAlert(`Copied to clipboard!`);
      }
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        doCopySuccess();
      }).catch(err => {
        fallbackCopyTextToClipboard(text, doCopySuccess);
      });
    } else {
      fallbackCopyTextToClipboard(text, doCopySuccess);
    }
  };

  function fallbackCopyTextToClipboard(text, onSuccess) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    textArea.style.width = "1px";
    textArea.style.height = "1px";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    textArea.setAttribute("readonly", "");
    document.body.appendChild(textArea);
    
    try {
      textArea.focus();
      textArea.setSelectionRange(0, textArea.value.length);
      const successful = document.execCommand('copy');
      
      // Clear selection ranges immediately
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
      if (document.selection) {
        document.selection.empty();
      }
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }

      if (successful) {
        if (onSuccess) onSuccess();
        else showAlert(`Copied to clipboard!`);
      } else {
        showAlert('Failed to copy text', true);
      }
    } catch (err) {
      if (onSuccess) onSuccess();
    }
    
    if (textArea.parentNode) {
      textArea.parentNode.removeChild(textArea);
    }
  }

  window.toggleLinkStatus = async function(id, newActive) {
    try {
      const res = await fetch(`/api/admin/links/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive })
      });
      if (res.ok) {
        showAlert('Link status updated');
        loadLinks();
      }
    } catch (err) {
      showAlert('Failed to update status', true);
    }
  };

  window.deleteLink = async function(id) {
    if (!confirm('Are you sure you want to delete this short link?')) return;
    try {
      const res = await fetch(`/api/admin/links/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert('Shortlink deleted');
        loadLinks();
      }
    } catch (err) {
      showAlert('Failed to delete link', true);
    }
  };

  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
      const getNum = (id) => { const el = document.getElementById(id); return el ? parseInt(el.value || 0, 10) : 0; };

      const domain = getVal('link-domain') || 'goo33.online';

      // 1. Auto-generate random slug if code is empty/hidden
      let code = getVal('link-code');
      if (!code) {
        code = Math.random().toString(36).substring(2, 8);
      }

      // 2. Resolve targetUrl (Admin text input vs Editor dropdown select vs Post URL paste)
      let targetUrl = '';
      const targetInput = document.getElementById('target-url');
      const targetSelect = document.getElementById('target-url-select');
      const postUrlInput = document.getElementById('post-url-input');
      const postUrlVal = postUrlInput ? postUrlInput.value.trim() : '';

      if (postUrlVal && (postUrlVal.startsWith('http://') || postUrlVal.startsWith('https://'))) {
        targetUrl = postUrlVal;
      } else if (targetSelect && targetSelect.style.display !== 'none' && targetSelect.value) {
        let baseUrl = targetSelect.value.trim().replace(/\/+$/, '');
        let path = postUrlVal ? (postUrlVal.startsWith('/') ? postUrlVal : '/' + postUrlVal) : '';
        targetUrl = baseUrl + path;
      } else if (targetInput && targetInput.value) {
        targetUrl = targetInput.value.trim();
      }

      if (!targetUrl) {
        showAlert('Please select or enter a valid Target URL.', true);
        return;
      }

      const fallbackUrl = getVal('fallback-url') || 'https://www.google.com';
      const delaySeconds = getNum('delay-seconds');
      const maxClicks = getNum('max-clicks');
      const hourlyLimit = getNum('hourly-limit');
      const dailyLimit = getNum('daily-limit');
      const monthlyLimit = getNum('monthly-limit');
      const expiresAt = getVal('expires-at');
      const androidUrl = getVal('android-url');
      const iosUrl = getVal('ios-url');

      const allowedPlatforms = ['facebook'];
      document.querySelectorAll('.platform-cb:checked').forEach(cb => {
        if (cb.value && !allowedPlatforms.includes(cb.value)) {
          allowedPlatforms.push(cb.value);
        }
      });

      const finalCustomDomains = customDomainEnableCb && customDomainEnableCb.checked ? customDomainsList : [];

      try {
        const response = await fetch('/api/admin/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            targetUrl,
            fallbackUrl,
            allowedPlatforms,
            customDomains: finalCustomDomains,
            delaySeconds,
            maxClicks,
            hourlyLimit,
            dailyLimit,
            monthlyLimit,
            expiresAt,
            androidUrl,
            iosUrl,
            domain
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          const generatedCode = data.link.code;
          const shortUrl = `${location.origin}/s/${generatedCode}`;
          
          createForm.reset();
          customDomainsList = [];
          renderDomainTags();
          
          // Reset default checkboxes: ONLY Facebook Checked!
          document.querySelectorAll('.platform-chip').forEach((chip) => {
            const cb = chip.querySelector('input[type="checkbox"]');
            if (cb) {
              if (cb.value === 'facebook') {
                cb.checked = true;
                chip.classList.add('active');
              } else {
                cb.checked = false;
                chip.classList.remove('active');
              }
            }
          });
          if (customDomainsContainer) customDomainsContainer.style.display = 'none';
          if (proSettingsBody) { proSettingsBody.classList.remove('open'); }
          if (toggleProSettingsBtn) toggleProSettingsBtn.classList.remove('open');
          if (proSettingsToggleIcon) { proSettingsToggleIcon.textContent = '▶ Click to Show'; proSettingsToggleIcon.classList.remove('open'); }
          loadLinks();
          
          // Show copy-link success toast instead of QR modal
          showCopyLinkToast(shortUrl);
        } else {
          showAlert(data.error || 'Failed to create link', true);
        }
      } catch (err) {
        showAlert('Network error creating link', true);
      }
    });
  }

  // --------------------------------------------------------
  // TAB 2: COUNTRY & VPN MAP ANALYTICS LOGIC
  // --------------------------------------------------------
  const countriesTbody = document.getElementById('countries-tbody');
  const startDateInput = document.getElementById('start-date-input');
  const endDateInput = document.getElementById('end-date-input');
  const applyDateBtn = document.getElementById('apply-date-btn');
  const datePresetBtns = document.querySelectorAll('.date-preset-btn');

  let geoCurrentPage = 1;
  const geoPageSize = 10;
  let currentGeoCountries = [];
  let currentGeoTotalLogs = 0;

  function renderGeoTable() {
    if (!countriesTbody) return;
    if (!currentGeoCountries || currentGeoCountries.length === 0) {
      countriesTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No country traffic recorded for selected range.</td></tr>`;
      updateGeoPaginationUI(0, 1);
      return;
    }

    const totalPages = Math.ceil(currentGeoCountries.length / geoPageSize);
    if (geoCurrentPage > totalPages) geoCurrentPage = totalPages;
    if (geoCurrentPage < 1) geoCurrentPage = 1;

    const startIdx = (geoCurrentPage - 1) * geoPageSize;
    const pagedCountries = currentGeoCountries.slice(startIdx, startIdx + geoPageSize);
    const maxClicks = Math.max(...currentGeoCountries.map(c => c.totalClicks), 1);

    countriesTbody.innerHTML = pagedCountries.map(c => {
      const percent = Math.round((c.totalClicks / (currentGeoTotalLogs || 1)) * 100) || 0;
      const barWidth = Math.round((c.totalClicks / maxClicks) * 100);
      const vpnCount = c.vpnClicks || c.vpsClicks || 0;

      return `
        <tr>
          <td data-label="Country">
            <strong style="font-size: 0.95rem; margin-right: 0.35rem;">${c.flag || '🌐'}</strong>
            <strong style="color: var(--text-primary);">${c.name} (${c.code})</strong>
          </td>
          <td data-label="Total Traffic"><strong style="font-size: 1.05rem; font-family: 'Outfit', sans-serif;">${c.totalClicks}</strong></td>
          <td data-label="Organic"><span style="color: #10b981; font-weight: 600;">${c.organicClicks}</span></td>
          <td data-label="VPN / Proxy"><span class="badge ${vpnCount > 0 ? 'badge-warning' : 'badge-info'}">${vpnCount} VPN / Proxy</span></td>
          <td data-label="Share">
            <div style="display: flex; align-items: center; gap: 0.5rem; width: 100%; justify-content: flex-end;">
              <div style="flex: 1; background: rgba(0,0,0,0.08); height: 6px; border-radius: 4px; overflow: hidden; max-width: 120px;">
                <div style="width: ${barWidth}%; height: 100%; background: #1877f2;"></div>
              </div>
              <span style="font-size: 0.775rem; font-weight: 700; color: var(--text-secondary); width: 34px;">${percent}%</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    updateGeoPaginationUI(totalPages, geoCurrentPage);
  }

  function updateGeoPaginationUI(totalPages, page) {
    const pageInfo = document.getElementById('geo-page-info');
    if (pageInfo) pageInfo.textContent = `Page ${page} of ${totalPages || 1}`;

    const prevBtn = document.getElementById('geo-prev-btn');
    const nextBtn = document.getElementById('geo-next-btn');
    if (prevBtn) prevBtn.disabled = (page <= 1);
    if (nextBtn) nextBtn.disabled = (page >= totalPages || totalPages === 0);
  }

  async function loadCountryAnalytics(startDate = '', endDate = '') {
    if (!countriesTbody) return;
    try {
      let query = '';
      if (startDate && endDate) {
        query = `?startDate=${startDate}&endDate=${endDate}`;
      }

      const res = await fetch(`/api/admin/analytics/countries${query}`);
      const data = await res.json();

      const totalVpn = data.totalVpnClicks || data.totalVpsClicks || 0;
      const genuineEl = document.getElementById('stat-geo-genuine');
      if (genuineEl) genuineEl.textContent = data.totalGenuineClicks || 0;

      const vpnEl = document.getElementById('stat-geo-vpn');
      if (vpnEl) vpnEl.textContent = totalVpn;

      const vpnPercentage = data.totalLogs > 0 ? Math.round((totalVpn / data.totalLogs) * 100) : 0;
      const riskEl = document.getElementById('stat-geo-risk');
      if (riskEl) {
        if (vpnPercentage > 30) {
          riskEl.textContent = `HIGH (${vpnPercentage}% VPN)`;
          riskEl.style.color = '#ef4444';
        } else if (vpnPercentage > 10) {
          riskEl.textContent = `MEDIUM (${vpnPercentage}% VPN)`;
          riskEl.style.color = '#f59e0b';
        } else {
          riskEl.textContent = `LOW (${vpnPercentage}% VPN)`;
          riskEl.style.color = '#10b981';
        }
      }

      currentGeoCountries = data.countries || [];
      currentGeoTotalLogs = data.totalLogs || 1;
      geoCurrentPage = 1;
      renderGeoTable();
    } catch (err) {
      console.error('Geo analytics error:', err);
      if (countriesTbody) countriesTbody.innerHTML = `<tr><td colspan="5" style="color: var(--danger); text-align:center; padding:1.5rem;">Failed to load country analytics.</td></tr>`;
    }
  }

  const geoPrevBtn = document.getElementById('geo-prev-btn');
  const geoNextBtn = document.getElementById('geo-next-btn');
  if (geoPrevBtn) {
    geoPrevBtn.addEventListener('click', () => {
      if (geoCurrentPage > 1) {
        geoCurrentPage--;
        renderGeoTable();
      }
    });
  }
  if (geoNextBtn) {
    geoNextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(currentGeoCountries.length / geoPageSize);
      if (geoCurrentPage < totalPages) {
        geoCurrentPage++;
        renderGeoTable();
      }
    });
  }

  datePresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      datePresetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const range = btn.getAttribute('data-range');
      const now = new Date();
      let start, end;

      if (range === 'last30') {
        end = new Date();
        start = new Date();
        start.setDate(now.getDate() - 30);
      } else if (range === 'thisMonth') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else if (range === 'lastMonth') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
      }

      if (startDateInput && endDateInput) {
        startDateInput.value = start.toISOString().split('T')[0];
        endDateInput.value = end.toISOString().split('T')[0];
      }

      loadCountryAnalytics(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
    });
  });

  if (applyDateBtn) {
    applyDateBtn.addEventListener('click', () => {
      const s = startDateInput.value;
      const e = endDateInput.value;
      if (!s || !e) return showAlert('Please select both start and end dates', true);
      loadCountryAnalytics(s, e);
    });
  }

  // --------------------------------------------------------
  // TAB 3: TRAFFIC AUDIT LOGS LOGIC (With Auto Live Feed)
  // --------------------------------------------------------
  const logsTbody = document.getElementById('logs-tbody');
  const clearLogsBtn = document.getElementById('clear-logs-btn');

  function formatReferrerBadge(refererStr) {
    if (!refererStr || refererStr.trim() === '' || refererStr.toLowerCase() === 'direct/blank' || refererStr.toLowerCase() === 'direct') {
      return `<span class="badge" style="background:var(--border, #e2e8f0); color:var(--text-secondary, #475569); font-weight:700; padding:0.25rem 0.6rem; border-radius:12px; font-size:0.75rem; display:inline-flex; align-items:center; gap:0.3rem;">🔗 Direct / Blank</span>`;
    }

    let decodedRef = refererStr.trim();
    try { decodedRef = decodeURIComponent(refererStr); } catch(e) {}
    const refLower = decodedRef.toLowerCase();

    // Facebook Referrers (lm.facebook.com, l.facebook.com, m.facebook.com, facebook.com, fb)
    if (refLower.includes('facebook') || refLower.includes('fb.com') || refLower.includes('fb.me')) {
      return `<span class="badge" style="background:#1877f2; color:#ffffff; font-weight:800; padding:0.3rem 0.65rem; border-radius:12px; display:inline-flex; align-items:center; gap:0.35rem; font-size:0.78rem; box-shadow:0 2px 8px rgba(24,119,242,0.25);">
        <svg width="14" height="14" fill="#ffffff" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
        <span>Facebook</span>
      </span>`;
    }

    // Instagram Referrers
    if (refLower.includes('instagram') || refLower.includes('instagr.am')) {
      return `<span class="badge" style="background:linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); color:#ffffff; font-weight:800; padding:0.3rem 0.65rem; border-radius:12px; display:inline-flex; align-items:center; gap:0.35rem; font-size:0.78rem; box-shadow:0 2px 8px rgba(220,39,67,0.25);">
        <svg width="14" height="14" fill="#ffffff" viewBox="0 0 24 24" style="flex-shrink:0;"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
        <span>Instagram</span>
      </span>`;
    }

    // WhatsApp Referrers
    if (refLower.includes('whatsapp') || refLower.includes('wa.me')) {
      return `<span class="badge" style="background:#25d366; color:#ffffff; font-weight:800; padding:0.3rem 0.65rem; border-radius:12px; display:inline-flex; align-items:center; gap:0.35rem; font-size:0.78rem; box-shadow:0 2px 8px rgba(37,211,102,0.25);">
        💬 <span>WhatsApp</span>
      </span>`;
    }

    // Google Referrers
    if (refLower.includes('google')) {
      return `<span class="badge" style="background:#4285f4; color:#ffffff; font-weight:800; padding:0.3rem 0.65rem; border-radius:12px; display:inline-flex; align-items:center; gap:0.35rem; font-size:0.78rem; box-shadow:0 2px 8px rgba(66,133,244,0.25);">
        🔍 <span>Google</span>
      </span>`;
    }

    // Generic Domain Referrer
    try {
      const parsed = new URL(/^https?:\/\//i.test(decodedRef) ? decodedRef : 'https://' + decodedRef);
      const domainHost = parsed.hostname.replace(/^www\./, '');
      return `<span class="badge" style="background:var(--surface-2, #f1f5f9); color:var(--text-primary, #1e293b); font-weight:700; padding:0.25rem 0.65rem; border-radius:12px; font-size:0.75rem; border:1px solid var(--border, #cbd5e1); display:inline-flex; align-items:center; gap:0.3rem; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        🌐 <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${domainHost}</span>
      </span>`;
    } catch (e) {
      let cleanText = decodedRef.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
      return `<span class="badge" style="background:var(--surface-2, #f1f5f9); color:var(--text-primary, #1e293b); font-weight:700; padding:0.25rem 0.65rem; border-radius:12px; font-size:0.75rem; border:1px solid var(--border, #cbd5e1); display:inline-flex; align-items:center; gap:0.3rem; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        🌐 <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${cleanText}</span>
      </span>`;
    }
  }

  async function loadAnalytics() {
    try {
      const res = await fetch('/api/admin/logs');
      const logs = await res.json();

      if (!Array.isArray(logs) || logs.length === 0) {
        if (logsTbody) logsTbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">No traffic logs recorded yet.</td></tr>`;
        const totalEl = document.getElementById('stat-total-clicks');
        if (totalEl) totalEl.textContent = '0';
        const orgEl = document.getElementById('stat-organic-clicks');
        if (orgEl) orgEl.textContent = '0';
        const fbEl = document.getElementById('stat-fallback-clicks');
        if (fbEl) fbEl.textContent = '0';
        return;
      }

      let organicCount = 0;
      let fallbackCount = 0;

      logs.forEach(log => {
        if (log.status === 'ORGANIC_CLICK') organicCount++;
        else if (log.status === 'FALLBACK_REDIRECT') fallbackCount++;
      });

      const totalEl = document.getElementById('stat-total-clicks');
      if (totalEl) totalEl.textContent = logs.length;
      const orgEl = document.getElementById('stat-organic-clicks');
      if (orgEl) orgEl.textContent = organicCount;
      const fbEl = document.getElementById('stat-fallback-clicks');
      if (fbEl) fbEl.textContent = fallbackCount;

      // Filter out blocked firewall entries from UI table (works in background silently)
      const displayLogs = logs.filter(log => {
        if (!log.status) return true;
        const st = log.status.toUpperCase();
        return !st.includes('BLOCKED') && !st.includes('FIREWALL') && !st.includes('RATE_LIMITED');
      });

      if (!Array.isArray(displayLogs) || displayLogs.length === 0) {
        if (logsTbody) logsTbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 1.5rem 0;">No organic traffic logs recorded yet. (Blocked firewall entries run silently in background).</td></tr>`;
        return;
      }

      if (logsTbody) {
        logsTbody.innerHTML = displayLogs.slice(0, 250).map(log => {
          let badgeClass = 'badge-info';
          if (log.status === 'ORGANIC_CLICK') badgeClass = 'badge-success';
          if (log.status === 'FALLBACK_REDIRECT') badgeClass = 'badge-warning';

          const timeStr = new Date(log.timestamp).toLocaleTimeString();
          const flag = log.flag || '🌐';
          const location = `${flag} ${log.countryName || 'Unknown'} (${log.city || 'N/A'})`;
          const isVpn = log.isVpn || log.isVps || false;
          
          const connectionBadge = isVpn 
            ? `<span class="badge badge-warning">🔒 VPN / Proxy</span>`
            : `<span class="badge badge-info">🌐 Residential</span>`;

          const durationStr = log.durationSeconds ? `${log.durationSeconds}s` : 'Redirected';

          return `
            <tr>
              <td data-label="Time" style="font-size: 0.75rem; color: var(--text-muted);">${timeStr}</td>
              <td data-label="Code"><strong style="color: var(--accent-primary); font-size: 0.875rem;">/${log.code || '-'}</strong></td>
              <td data-label="IP / ISP">
                <div class="ip-isp-cell">
                  <div class="ip-row">
                    <span class="mobile-sublabel">IP</span>
                    <code>${log.ip || '-'}</code>
                  </div>
                  <div class="isp-row">
                    <span class="mobile-sublabel">ISP</span>
                    <small class="isp-text">${log.isp || 'ISP'}</small>
                  </div>
                </div>
              </td>
              <td data-label="Location" style="font-size: 0.775rem;">${location}</td>
              <td data-label="Connection">${connectionBadge}</td>
              <td data-label="Referrer">${formatReferrerBadge(log.referer)}</td>
              <td data-label="Status"><span class="badge ${badgeClass}">${log.status}</span></td>
              <td data-label="Dwell"><span style="font-weight: 600; color: var(--accent-primary);">${durationStr}</span></td>
              <td data-label="Action">
                <button class="btn btn-danger btn-sm" onclick="quickBlockIp('${log.ip}')" style="padding: 0.2rem 0.5rem; font-size: 0.725rem;">
                  🚫 Block IP
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    } catch (err) {
      if (logsTbody) logsTbody.innerHTML = `<tr><td colspan="9" style="color: var(--danger);">Failed to load analytics.</td></tr>`;
    }
  }

  // Live Auto-Refresh Stream every 6 seconds
  setInterval(() => {
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab && activeTab.getAttribute('data-tab') === 'tab-analytics') {
      loadAnalytics();
    }
  }, 6000);

  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to clear all click logs?')) return;
      await fetch('/api/admin/clear-logs', { method: 'POST' });
      showAlert('Click logs cleared.');
      loadAnalytics();
    });
  }

  window.quickBlockIp = async function(ip) {
    if (!confirm(`Are you sure you want to block IP ${ip}?`)) return;
    try {
      const res = await fetch('/api/admin/block-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, reason: 'Quick Block from Traffic Logs' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showAlert(`IP address ${ip} has been blocked by Firewall.`);
        loadAnalytics();
      } else {
        showAlert(data.error || 'Failed to block IP', true);
      }
    } catch (err) {
      showAlert('Error blocking IP', true);
    }
  };

  // --------------------------------------------------------
  // TAB 4: IP FIREWALL & BLOCKLIST MANAGER LOGIC
  // --------------------------------------------------------
  const firewallTbody = document.getElementById('firewall-tbody');
  const blockIpForm = document.getElementById('block-ip-form');

  async function loadBlockedIps() {
    if (!firewallTbody) return;
    loadShieldSettings();
    try {
      const res = await fetch('/api/admin/blocked-ips');
      const blocked = await res.json();

      if (!Array.isArray(blocked) || blocked.length === 0) {
        firewallTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No IP addresses currently blocked in Firewall.</td></tr>`;
        return;
      }

      firewallTbody.innerHTML = blocked.map(item => {
        const timeStr = new Date(item.blockedAt).toLocaleString();
        return `
          <tr>
            <td data-label="IP Address"><code>${item.ip}</code></td>
            <td data-label="Reason" style="color: var(--text-secondary);">${item.reason || 'Manual Block'}</td>
            <td data-label="Blocked At" style="font-size: 0.75rem; color: var(--text-muted);">${timeStr}</td>
            <td data-label="Actions">
              <button class="btn btn-secondary btn-sm" onclick="unblockIp('${item.ip}')" style="width:100% !important;">
                🔓 Unblock IP
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      if (firewallTbody) firewallTbody.innerHTML = `<tr><td colspan="4" style="color: var(--danger);">Failed to load blocked IPs.</td></tr>`;
    }
  }

  window.unblockIp = async function(ip) {
    if (!confirm(`Are you sure you want to unblock IP ${ip}?`)) return;
    try {
      const res = await fetch(`/api/admin/blocked-ips/${encodeURIComponent(ip)}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert(`IP ${ip} has been unblocked.`);
        loadBlockedIps();
      }
    } catch (err) {
      showAlert('Error unblocking IP', true);
    }
  };

  // Auto Shield Form Elements & Sync
  const autoShieldForm = document.getElementById('auto-shield-form');
  const botProtectionCb = document.getElementById('bot-protection-enabled');
  const botLimitClicksInput = document.getElementById('bot-limit-clicks');
  const botLimitMinutesInput = document.getElementById('bot-limit-minutes');
  const vpnProtectionCb = document.getElementById('vpn-protection-enabled');
  const vpnLimitClicksInput = document.getElementById('vpn-limit-clicks');
  const vpnLimitMinutesInput = document.getElementById('vpn-limit-minutes');
  const blockCountriesCb = document.getElementById('block-suspicious-countries');
  const blockScrapersCb = document.getElementById('block-known-scrapers');
  const honeypotCb = document.getElementById('honeypot-protection-enabled');

  async function loadShieldSettings() {
    if (!autoShieldForm) return;
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) return;
      const settings = await res.json();

      botProtectionCb.checked = !!settings.botProtectionEnabled;
      botLimitClicksInput.value = settings.botLimitClicks || 100;
      botLimitMinutesInput.value = settings.botLimitMinutes || 1;
      
      vpnProtectionCb.checked = !!settings.vpnProtectionEnabled;
      vpnLimitClicksInput.value = settings.vpnLimitClicks || 500;
      vpnLimitMinutesInput.value = settings.vpnLimitMinutes || 90;

      blockCountriesCb.checked = !!settings.blockSuspiciousCountries;
      blockScrapersCb.checked = !!settings.blockKnownScrapers;
      honeypotCb.checked = !!settings.honeypotProtectionEnabled;

      toggleSettingsGroup('bot-settings-group', botProtectionCb.checked);
      toggleSettingsGroup('vpn-settings-group', vpnProtectionCb.checked);
    } catch (err) {
      console.error('Failed to load shield settings:', err);
    }
  }

  function toggleSettingsGroup(groupId, show) {
    const group = document.getElementById(groupId);
    if (group) {
      group.style.opacity = show ? '1' : '0.5';
      group.querySelectorAll('input').forEach(input => {
        input.disabled = !show;
      });
    }
  }

  if (botProtectionCb) {
    botProtectionCb.addEventListener('change', (e) => {
      toggleSettingsGroup('bot-settings-group', e.target.checked);
    });
  }

  if (vpnProtectionCb) {
    vpnProtectionCb.addEventListener('change', (e) => {
      toggleSettingsGroup('vpn-settings-group', e.target.checked);
    });
  }

  if (autoShieldForm) {
    autoShieldForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const payload = {
        botProtectionEnabled: botProtectionCb.checked,
        botLimitClicks: parseInt(botLimitClicksInput.value || 100, 10),
        botLimitMinutes: parseInt(botLimitMinutesInput.value || 1, 10),
        vpnProtectionEnabled: vpnProtectionCb.checked,
        vpnLimitClicks: parseInt(vpnLimitClicksInput.value || 500, 10),
        vpnLimitMinutes: parseInt(vpnLimitMinutesInput.value || 90, 10),
        blockSuspiciousCountries: blockCountriesCb.checked,
        blockKnownScrapers: blockScrapersCb.checked,
        honeypotProtectionEnabled: honeypotCb.checked
      };

      try {
        const res = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showAlert('Shield & Firewall settings updated successfully!');
          loadShieldSettings();
        } else {
          showAlert(data.error || 'Failed to save settings', true);
        }
      } catch (err) {
        showAlert('Error saving settings', true);
      }
    });
  }

  if (blockIpForm) {
    blockIpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ip = document.getElementById('block-ip-address').value.trim();
      const reason = document.getElementById('block-ip-reason').value.trim();

      try {
        const res = await fetch('/api/admin/block-ip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip, reason })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showAlert(`IP ${ip} blocked successfully!`);
          blockIpForm.reset();
          loadBlockedIps();
        } else {
          showAlert(data.error || 'Failed to block IP', true);
        }
      } catch (err) {
        showAlert('Error blocking IP', true);
      }
    });
  }

  // --------------------------------------------------------
  // TAB 5: TEAM MEMBERS & USER INVITES LOGIC
  // --------------------------------------------------------
  const btnGenPass = document.getElementById('btn-gen-pass');
  if (btnGenPass) {
    btnGenPass.addEventListener('click', () => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
      let pass = '';
      for (let i = 0; i < 10; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const passInput = document.getElementById('new-user-password');
      if (passInput) passInput.value = pass;
    });
  }

  // ---- DYNAMIC PER-USER SITES MANAGER HELPERS ----
  function renderUserSiteInputRow(container, initialDomain = '') {
    if (!container) return;
    const currentRows = container.querySelectorAll('.user-site-item-row');
    if (currentRows.length >= 10) {
      showAlert('Maximum 10 allowed websites permitted per user account.', true);
      return;
    }

    const emptyNotice = container.querySelector('#invite-sites-empty-msg, #edit-sites-empty-msg');
    if (emptyNotice) emptyNotice.style.display = 'none';

    const row = document.createElement('div');
    row.className = 'user-site-item-row';
    row.style.cssText = 'display:flex; gap:0.4rem; align-items:center; width:100%; margin-bottom:0.25rem;';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control user-site-input';
    input.placeholder = 'e.g. Akel.com';
    input.value = initialDomain;
    input.style.cssText = 'font-weight:700; font-size:0.8rem; padding:0.45rem 0.65rem; height:36px; min-height:36px; flex:1; min-width:0;';

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.innerHTML = '🗑️';
    delBtn.title = 'Remove Site';
    delBtn.style.cssText = 'background:#ef4444; color:#fff; border:none; border-radius:8px; padding:0.4rem 0.65rem; cursor:pointer; font-weight:700; flex-shrink:0; font-size:0.75rem; min-height:36px; height:36px;';

    delBtn.addEventListener('click', () => {
      row.remove();
      const remaining = container.querySelectorAll('.user-site-item-row');
      if (remaining.length === 0 && emptyNotice) {
        emptyNotice.style.display = 'block';
      }
    });

    row.appendChild(input);
    row.appendChild(delBtn);
    container.appendChild(row);
  }

  const btnAddInviteSite = document.getElementById('btn-add-invite-site');
  const inviteSitesList = document.getElementById('invite-sites-list');
  if (btnAddInviteSite && inviteSitesList) {
    btnAddInviteSite.addEventListener('click', () => {
      renderUserSiteInputRow(inviteSitesList, '');
    });
  }

  const btnAddEditUserSite = document.getElementById('btn-add-edit-user-site');
  const editUserSitesList = document.getElementById('edit-user-sites-list');
  if (btnAddEditUserSite && editUserSitesList) {
    btnAddEditUserSite.addEventListener('click', () => {
      renderUserSiteInputRow(editUserSitesList, '');
    });
  }

  let allUsersCache = [];

  async function loadUsers() {
    if (!usersTbody) return;
    try {
      const res = await fetch('/api/admin/users');
      const users = await res.json();

      if (!Array.isArray(users) || users.length === 0) {
        usersTbody.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:1.5rem 0;font-size:0.82rem;">No team members found.</div>`;
        return;
      }

      allUsersCache = users;

      usersTbody.innerHTML = users.map(user => {
        const isSelf = user.username.toLowerCase() === currentLoggedInUsername.toLowerCase();
        const roleColor = user.role === 'Admin' ? '#ef4444' : (user.role === 'Manager' ? '#3b82f6' : '#10b981');
        const roleBg = user.role === 'Admin' ? 'rgba(239,68,68,0.1)' : (user.role === 'Manager' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)');
        const passChip = user.rawPassword
          ? `<span style="font-family:monospace;font-size:0.73rem;font-weight:700;color:#1877f2;background:rgba(24,119,242,0.09);padding:0.18rem 0.5rem;border-radius:6px;letter-spacing:0.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px;display:inline-block;vertical-align:middle;">${user.rawPassword}</span>`
          : `<span style="color:var(--text-muted);font-size:0.8rem;letter-spacing:0.12em;">••••••••</span>`;

        const userSites = Array.isArray(user.allowedTargetDomains) ? user.allowedTargetDomains : [];
        const sitesBadge = userSites.length > 0
          ? `<span style="font-size:0.68rem;font-weight:700;color:#1877f2;background:rgba(24,119,242,0.08);padding:0.25rem 0.55rem;border-radius:10px;border:1px solid rgba(24,119,242,0.2);word-break:break-all;overflow-wrap:anywhere;display:inline-block;max-width:100%;box-sizing:border-box;">🌐 Sites: ${userSites.join(', ')}</span>`
          : `<span style="font-size:0.68rem;font-weight:600;color:var(--text-muted);">🌐 Sites: Default / Global</span>`;

        return `
          <div style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.85rem;background:var(--input-bg,#f9fafb);border:1.5px solid var(--border,#e8eaf0);border-radius:12px;flex-wrap:wrap;transition:box-shadow 0.18s;max-width:100%;overflow-x:hidden;box-sizing:border-box;" onmouseover="this.style.boxShadow='0 2px 12px rgba(0,0,0,0.08)'" onmouseout="this.style.boxShadow='none'">

            <!-- Avatar + Name -->
            <div style="display:flex;align-items:center;gap:0.45rem;flex:1;min-width:90px;">
              <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#1877f2,#6c3de8);display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0;">👤</div>
              <div>
                <div style="font-weight:800;font-size:0.83rem;color:var(--text-primary);line-height:1.2;">${user.username}</div>
                ${isSelf ? '<div style="font-size:0.6rem;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:0.06em;">You</div>' : ''}
              </div>
            </div>

            <!-- Role Badge -->
            <span style="font-size:0.68rem;font-weight:800;color:${roleColor};background:${roleBg};border:1px solid ${roleColor}33;padding:0.2rem 0.55rem;border-radius:20px;white-space:nowrap;flex-shrink:0;">${user.role || 'Editor'}</span>

            <!-- Password chip -->
            <div style="flex-shrink:0;">${passChip}</div>

            <!-- Assigned Sites Badge (Wrapped cleanly within card bounds) -->
            <div style="flex:1 1 100%;width:100%;max-width:100%;box-sizing:border-box;margin-top:0.2rem;word-break:break-all;overflow-wrap:anywhere;">${sitesBadge}</div>

            <!-- Actions -->
            <div style="display:flex;gap:0.5rem;margin-left:auto;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;">
              ${isSelf
                ? `<span style="font-size:0.72rem;font-weight:600;color:var(--text-muted);padding:0.4rem 0;">Current Account</span>`
                : `<button onclick="openEditUserModal('${user.id}')" style="background:linear-gradient(135deg,#1877f2,#6c3de8);border:none;color:#fff;border-radius:10px;padding:0.45rem 0.9rem;font-size:0.8rem;font-weight:800;cursor:pointer;white-space:nowrap;box-shadow:0 3px 10px rgba(24,119,242,0.3);display:flex;align-items:center;gap:0.35rem;">✏️ Edit</button>
                   <button onclick="openDeleteUserModal('${user.id}','${user.username}')" style="background:linear-gradient(135deg,#ef4444,#b91c1c);border:none;color:#fff;border-radius:10px;padding:0.45rem 0.9rem;font-size:0.8rem;font-weight:800;cursor:pointer;white-space:nowrap;box-shadow:0 3px 10px rgba(239,68,68,0.3);display:flex;align-items:center;gap:0.35rem;">🗑️ Delete</button>`
              }
            </div>
          </div>

        `;
      }).join('');
    } catch (err) {
      if (usersTbody) usersTbody.innerHTML = `<div style="color:var(--danger);text-align:center;padding:1rem;font-size:0.82rem;">Failed to load team users.</div>`;
    }
  }


  window.resetUserPassword = async function(username, newPassword) {
    if (!newPassword || newPassword.trim().length < 6) {
      showAlert('Password must be at least 6 characters long.', true);
      return;
    }
    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, newPassword: newPassword.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Failed to update password' };
      }
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  };

  // ---- EDIT USER MODAL ----
  let _editModalUsername = '';
  let _editUserId = '';
  const editUserModal = document.getElementById('edit-user-modal');
  const editUserModalClose = document.getElementById('edit-user-modal-close');
  const editUserDirectLink = document.getElementById('edit-user-direct-link');
  const editUserCopyLinkBtn = document.getElementById('edit-user-copy-link-btn');
  const editUserNewPass = document.getElementById('edit-user-new-pass');
  const editUserGenPass = document.getElementById('edit-user-gen-pass');
  const editUserSavePassBtn = document.getElementById('edit-user-save-pass-btn');
  const editUserPassError = document.getElementById('edit-user-pass-error');
  const editUserPassSuccess = document.getElementById('edit-user-pass-success');
  const editUserModalSubtitle = document.getElementById('edit-user-modal-subtitle');
  const editUserRoleSelect = document.getElementById('edit-user-role-select');
  const editUserSaveRoleBtn = document.getElementById('edit-user-save-role-btn');
  const editUserRoleSuccess = document.getElementById('edit-user-role-success');

  window.openEditUserModal = function(userId) {
    const user = allUsersCache.find(u => u.id === userId);
    if (!user) return;

    const username = user.username;
    _editModalUsername = username;
    _editUserId = user.id;
    const rawPass = user.rawPassword || '';
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    const userSites = Array.isArray(user.allowedTargetDomains) ? user.allowedTargetDomains : [];

    const directUrl = `${window.location.origin}/login?u=${encodeURIComponent(username)}&p=${encodeURIComponent(rawPass)}`;
    if (editUserModalSubtitle) editUserModalSubtitle.textContent = `👤 ${username}`;
    if (editUserDirectLink) editUserDirectLink.value = directUrl;
    if (editUserNewPass) editUserNewPass.value = '';
    if (editUserPassError) editUserPassError.style.display = 'none';
    if (editUserPassSuccess) editUserPassSuccess.style.display = 'none';
    if (editUserRoleSuccess) editUserRoleSuccess.style.display = 'none';

    if (editUserRoleSelect) editUserRoleSelect.value = user.role || 'Editor';

    document.querySelectorAll('.edit-perm-cb').forEach(cb => {
      cb.checked = perms.includes(cb.value);
    });

    // Populate user's individual allowed sites in Edit User modal
    if (editUserSitesList) {
      editUserSitesList.querySelectorAll('.user-site-item-row').forEach(row => row.remove());
      const emptyNotice = editUserSitesList.querySelector('#edit-sites-empty-msg');
      if (userSites.length > 0) {
        if (emptyNotice) emptyNotice.style.display = 'none';
        userSites.forEach(site => renderUserSiteInputRow(editUserSitesList, site));
      } else {
        if (emptyNotice) emptyNotice.style.display = 'block';
      }
    }

    if (editUserModal) { editUserModal.style.display = 'flex'; }
  };

  if (editUserModalClose) editUserModalClose.addEventListener('click', () => { if (editUserModal) editUserModal.style.display = 'none'; });
  if (editUserModal) editUserModal.addEventListener('click', (e) => { if (e.target === editUserModal) editUserModal.style.display = 'none'; });

  if (editUserCopyLinkBtn && editUserDirectLink) {
    editUserCopyLinkBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(editUserDirectLink.value).then(() => {
        editUserCopyLinkBtn.textContent = '✅ Copied!';
        setTimeout(() => { editUserCopyLinkBtn.textContent = '📋 Copy'; }, 2200);
      }).catch(() => {
        editUserDirectLink.select();
        document.execCommand('copy');
      });
    });
  }

  if (editUserGenPass) {
    editUserGenPass.addEventListener('click', () => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
      let pass = '';
      for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
      if (editUserNewPass) editUserNewPass.value = pass;
    });
  }

  if (editUserSavePassBtn) {
    editUserSavePassBtn.addEventListener('click', async () => {
      const newPass = editUserNewPass ? editUserNewPass.value.trim() : '';
      if (!newPass || newPass.length < 6) {
        if (editUserPassError) { editUserPassError.textContent = '⚠️ Password must be at least 6 characters.'; editUserPassError.style.display = 'block'; }
        return;
      }
      if (editUserPassError) editUserPassError.style.display = 'none';
      editUserSavePassBtn.textContent = '⏳ Updating...';
      editUserSavePassBtn.disabled = true;
      const result = await resetUserPassword(_editModalUsername, newPass);
      editUserSavePassBtn.textContent = '🔐 Update Password';
      editUserSavePassBtn.disabled = false;
      if (result && result.success) {
        if (editUserPassSuccess) { editUserPassSuccess.textContent = `✅ Password updated successfully! New password: ${newPass}`; editUserPassSuccess.style.display = 'block'; }
        // Update direct link with new password
        const newUrl = `${window.location.origin}/login?u=${encodeURIComponent(_editModalUsername)}&p=${encodeURIComponent(newPass)}`;
        if (editUserDirectLink) editUserDirectLink.value = newUrl;
        loadUsers();
      } else {
        if (editUserPassError) { editUserPassError.textContent = '❌ ' + (result ? result.error : 'Error'); editUserPassError.style.display = 'block'; }
      }
    });
  }

  if (editUserSaveRoleBtn) {
    editUserSaveRoleBtn.addEventListener('click', async () => {
      if (!_editUserId) return;
      const role = editUserRoleSelect ? editUserRoleSelect.value : 'Editor';
      const permissions = Array.from(document.querySelectorAll('.edit-perm-cb:checked')).map(cb => cb.value);
      const allowedTargetDomains = Array.from(document.querySelectorAll('#edit-user-sites-list .user-site-input'))
        .map(inp => inp.value.trim())
        .filter(Boolean);

      editUserSaveRoleBtn.textContent = '⏳ Saving...';
      editUserSaveRoleBtn.disabled = true;

      try {
        const res = await fetch('/api/admin/users/update-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: _editUserId, role, permissions, allowedTargetDomains })
        });
        const data = await res.json();
        editUserSaveRoleBtn.textContent = '💾 Save Role & Permissions';
        editUserSaveRoleBtn.disabled = false;
        if (res.ok && data.success) {
          if (editUserRoleSuccess) {
            editUserRoleSuccess.textContent = `✅ Role, Permissions & Assigned Sites updated successfully!`;
            editUserRoleSuccess.style.display = 'block';
          }
          loadUsers();
        } else {
          showAlert(data.error || 'Failed to update role/permissions', true);
        }
      } catch(err) {
        editUserSaveRoleBtn.textContent = '💾 Save Role & Permissions';
        editUserSaveRoleBtn.disabled = false;
        showAlert('Error updating role', true);
      }
    });
  }


  // ---- DELETE USER MODAL ----
  let _deleteUserId = '';
  const deleteUserModal = document.getElementById('delete-user-modal');
  const deleteUserCancelBtn = document.getElementById('delete-user-cancel-btn');
  const deleteUserConfirmBtn = document.getElementById('delete-user-confirm-btn');
  const deleteUserModalSubtitle = document.getElementById('delete-user-modal-subtitle');

  window.openDeleteUserModal = function(id, username) {
    _deleteUserId = id;
    if (deleteUserModalSubtitle) deleteUserModalSubtitle.textContent = `👤 ${username}`;
    if (deleteUserModal) deleteUserModal.style.display = 'flex';
  };

  if (deleteUserCancelBtn) deleteUserCancelBtn.addEventListener('click', () => { if (deleteUserModal) deleteUserModal.style.display = 'none'; });
  if (deleteUserModal) deleteUserModal.addEventListener('click', (e) => { if (e.target === deleteUserModal) deleteUserModal.style.display = 'none'; });

  if (deleteUserConfirmBtn) {
    deleteUserConfirmBtn.addEventListener('click', async () => {
      if (!_deleteUserId) return;
      try {
        const res = await fetch(`/api/admin/users/${_deleteUserId}`, { method: 'DELETE' });
        const data = await res.json();
        if (deleteUserModal) deleteUserModal.style.display = 'none';
        if (res.ok && data.success) {
          showAlert('Team member removed.');
          loadUsers();
        } else {
          showAlert(data.error || 'Failed to remove user', true);
        }
      } catch (err) {
        showAlert('Error deleting user', true);
      }
    });
  }

  // ---- FORCE REFRESH / CACHE CLEAR BUTTON ----
  const cacheRefreshBtn = document.getElementById('cache-refresh-btn');
  if (cacheRefreshBtn) {
    cacheRefreshBtn.addEventListener('click', () => {
      // Clear all cached state from localStorage
      const keysToKeep = ['theme'];
      Object.keys(localStorage).forEach(k => { if (!keysToKeep.includes(k)) localStorage.removeItem(k); });
      // Reload everything from server
      loadLinks();
      loadUsers();
      load2FAStatus();
      loadBlockedIps();
      loadDomains();
      loadCountryAnalytics();
      loadAnalytics();
      cacheRefreshBtn.textContent = '✅ Refreshed!';
      setTimeout(() => { cacheRefreshBtn.textContent = '🔄 Force Refresh'; }, 2000);
    });
  }

  const newUserRoleSelect = document.getElementById('new-user-role');
  if (newUserRoleSelect) {
    newUserRoleSelect.addEventListener('change', () => {
      const selectedRole = newUserRoleSelect.value;
      const defaultPerms = selectedRole === 'Admin'
        ? ['links', 'domains', 'geo', 'analytics', 'firewall', 'settings']
        : (selectedRole === 'Manager' ? ['links', 'domains', 'geo', 'analytics'] : ['links', 'geo', 'analytics']);

      document.querySelectorAll('.new-perm-cb').forEach(cb => {
        cb.checked = defaultPerms.includes(cb.value);
      });
    });
  }

  if (inviteUserForm) {
    inviteUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('new-user-username').value.trim();
      const password = document.getElementById('new-user-password').value.trim();
      const role = document.getElementById('new-user-role').value;
      const permissions = Array.from(document.querySelectorAll('.new-perm-cb:checked')).map(cb => cb.value);
      const allowedTargetDomains = Array.from(document.querySelectorAll('#invite-sites-list .user-site-input'))
        .map(inp => inp.value.trim())
        .filter(Boolean);

      try {
        const res = await fetch('/api/admin/users/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role, permissions, allowedTargetDomains })
        });


        const data = await res.json();
        if (res.ok && data.success) {
          const directUrl = data.user.directLoginUrl || `${window.location.origin}/login?u=${encodeURIComponent(username)}&p=${encodeURIComponent(password)}`;
          
          // Populate success card
          const succCard = document.getElementById('user-created-success-card');
          const succUser = document.getElementById('succ-username');
          const succPass = document.getElementById('succ-password');
          const succRole = document.getElementById('succ-role');
          const succLink = document.getElementById('succ-direct-link');
          const succCopyBtn = document.getElementById('succ-copy-btn');

          if (succUser) succUser.textContent = username;
          if (succPass) succPass.textContent = password;
          if (succRole) succRole.textContent = role;
          if (succLink) succLink.value = directUrl;

          if (succCopyBtn) {
            succCopyBtn.onclick = () => {
              const fullText = `👤 Username: ${username}\n🔑 Password: ${password}\n🎭 Role: ${role}\n🔗 Direct 1-Click Login Link: ${directUrl}`;
              navigator.clipboard.writeText(fullText).then(() => {
                succCopyBtn.textContent = '✅ Copied Credentials & Link!';
                setTimeout(() => { succCopyBtn.textContent = '📋 Copy Full Credentials & Link'; }, 2500);
              }).catch(() => {});
            };
          }

          if (succCard) succCard.style.display = 'block';
          
          showAlert(`✅ User '${username}' (${role}) created successfully!`);
          
          inviteUserForm.reset();
          loadUsers();

          // Keep user strictly on Settings tab
          const settingsBtn = document.querySelector('.tab-btn[data-tab="tab-settings"]');
          if (settingsBtn) {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.style.display = 'none');
            settingsBtn.classList.add('active');
            const target = document.getElementById('tab-settings');
            if (target) target.style.display = 'block';
          }
        } else {
          showAlert(data.error || 'Failed to create user', true);
        }
      } catch (err) {
        showAlert('Error inviting user', true);
      }
    });
  }

  // --------------------------------------------------------
  // GOOGLE AUTHENTICATOR 2FA MANAGER LOGIC
  // --------------------------------------------------------
  const banner2FAActive = document.getElementById('2fa-active-banner');
  const banner2FAInactive = document.getElementById('2fa-inactive-banner');
  const setup2FABox = document.getElementById('2fa-setup-box');
  const btnStart2FASetup = document.getElementById('btn-start-2fa-setup');
  const btnEnable2FAConfirm = document.getElementById('btn-enable-2fa-confirm');
  const btnDisable2FA = document.getElementById('btn-disable-2fa');
  const qrImg2FA = document.getElementById('2fa-qr-img');
  const secretKey2FA = document.getElementById('2fa-secret-key');
  const verifyCode2FA = document.getElementById('2fa-verify-code');

  async function load2FAStatus() {
    try {
      const res = await fetch('/api/admin/2fa/status');
      const data = await res.json();

      if (data.enabled) {
        if (banner2FAActive) banner2FAActive.style.display = 'block';
        if (banner2FAInactive) banner2FAInactive.style.display = 'none';
        if (setup2FABox) setup2FABox.style.display = 'none';
        if (btnStart2FASetup) btnStart2FASetup.style.display = 'none';
        if (btnDisable2FA) btnDisable2FA.style.display = 'block';
      } else {
        if (banner2FAActive) banner2FAActive.style.display = 'none';
        if (banner2FAInactive) banner2FAInactive.style.display = 'block';
        if (setup2FABox) setup2FABox.style.display = 'none';
        if (btnStart2FASetup) btnStart2FASetup.style.display = 'block';
        if (btnDisable2FA) btnDisable2FA.style.display = 'none';
      }
    } catch (err) {
      console.error('Failed to load 2FA status:', err);
    }
  }

  if (btnStart2FASetup) {
    btnStart2FASetup.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/admin/2fa/setup', { method: 'POST' });
        const data = await res.json();

        if (res.ok && data.success) {
          if (qrImg2FA) qrImg2FA.src = data.qrCode;
          if (secretKey2FA) secretKey2FA.textContent = data.secret;
          if (setup2FABox) setup2FABox.style.display = 'block';
          if (btnStart2FASetup) btnStart2FASetup.style.display = 'none';
          if (verifyCode2FA) verifyCode2FA.focus();
        } else {
          showAlert(data.error || 'Failed to initiate 2FA setup.', true);
        }
      } catch (err) {
        showAlert('Error starting 2FA setup.', true);
      }
    });
  }

  if (btnEnable2FAConfirm) {
    btnEnable2FAConfirm.addEventListener('click', async () => {
      const code = verifyCode2FA ? verifyCode2FA.value.trim() : '';
      if (!code || code.length !== 6) {
        return showAlert('Please enter a valid 6-digit Authenticator code.', true);
      }

      try {
        const res = await fetch('/api/admin/2fa/enable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showAlert('🟢 Google Authenticator 2FA active! You can now log in using 6-digit App Codes or Admin Password.');
          load2FAStatus();
        } else {
          showAlert(data.error || 'Failed to enable 2FA.', true);
        }
      } catch (err) {
        showAlert('Error verifying 2FA code.', true);
      }
    });
  }

  if (btnDisable2FA) {
    btnDisable2FA.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to disable Google Authenticator 2FA security?')) return;
      try {
        const res = await fetch('/api/admin/2fa/disable', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
          showAlert('Google Authenticator 2FA has been disabled.');
          load2FAStatus();
        } else {
          showAlert(data.error || 'Failed to disable 2FA.', true);
        }
      } catch (err) {
        showAlert('Error disabling 2FA.', true);
      }
    });
  }

  // Load 2FA status when dashboard loads
  load2FAStatus();

  if (passwordChangeForm) {
    passwordChangeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('current-password').value.trim() || 'admin123456';
      const newPassword = document.getElementById('new-password').value.trim();

      if (newPassword.length < 6) {
        return showAlert('New password must be at least 6 characters.', true);
      }

      try {
        const res = await fetch('/api/admin/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showAlert('🔑 Password changed successfully! Keep your credentials safe.');
          passwordChangeForm.reset();
        } else {
          showAlert(data.error || 'Failed to change password', true);
        }
      } catch (err) {
        showAlert('Error updating password', true);
      }
    });
  }

  // --------------------------------------------------------
  // MULTI UI/UX CUSTOMIZATION LOGIC
  // --------------------------------------------------------
  const themePresetBtns = document.querySelectorAll('.theme-preset-btn');
  const uiDensitySelect = document.getElementById('ui-density-select');
  const uiBorderSelect = document.getElementById('ui-border-select');
  const uiFontSelect = document.getElementById('ui-font-select');
  const uiShadowSelect = document.getElementById('ui-shadow-select');
  const uiGlassCb = document.getElementById('ui-glass-cb');

  // Remove any remaining RTL override globally (as requested by user)
  document.body.removeAttribute('dir');
  localStorage.removeItem('rtl-mode');

  // Load Saved Spacing Density
  const savedDensity = localStorage.getItem('ui-density') || 'cozy';
  if (uiDensitySelect) {
    uiDensitySelect.value = savedDensity;
    applyDensity(savedDensity);
    uiDensitySelect.addEventListener('change', (e) => {
      const density = e.target.value;
      localStorage.setItem('ui-density', density);
      applyDensity(density);
      showAlert(`Layout density updated to: ${density.toUpperCase()}`);
    });
  }

  function applyDensity(density) {
    document.body.classList.remove('density-compact', 'density-standard', 'density-cozy');
    document.documentElement.classList.remove('density-compact', 'density-standard', 'density-cozy');
    if (density === 'compact') {
      document.body.classList.add('density-compact');
      document.documentElement.classList.add('density-compact');
    } else if (density === 'standard') {
      document.body.classList.add('density-standard');
      document.documentElement.classList.add('density-standard');
    } else {
      document.body.classList.add('density-cozy');
      document.documentElement.classList.add('density-cozy');
    }
  }

  // Load Saved Borders
  const savedBorder = localStorage.getItem('ui-border') || 'default';
  if (uiBorderSelect) {
    uiBorderSelect.value = savedBorder;
    applyBorderPreset(savedBorder);
    uiBorderSelect.addEventListener('change', (e) => {
      const style = e.target.value;
      localStorage.setItem('ui-border', style);
      applyBorderPreset(style);
      showAlert(`Border corner style updated to: ${style.toUpperCase()}`);
    });
  }

  function applyBorderPreset(style) {
    const root = document.documentElement;
    if (style === 'sharp') {
      root.style.setProperty('--r-sm', '0px');
      root.style.setProperty('--r-md', '0px');
      root.style.setProperty('--r-lg', '0px');
      root.style.setProperty('--r-xl', '0px');
    } else if (style === 'pill') {
      root.style.setProperty('--r-sm', '14px');
      root.style.setProperty('--r-md', '20px');
      root.style.setProperty('--r-lg', '28px');
      root.style.setProperty('--r-xl', '36px');
    } else {
      root.style.removeProperty('--r-sm');
      root.style.removeProperty('--r-md');
      root.style.removeProperty('--r-lg');
      root.style.removeProperty('--r-xl');
    }
  }

  // Load Saved Typography
  const savedFont = localStorage.getItem('ui-font') || 'sans';
  if (uiFontSelect) {
    uiFontSelect.value = savedFont;
    applyFont(savedFont);
    uiFontSelect.addEventListener('change', (e) => {
      const font = e.target.value;
      localStorage.setItem('ui-font', font);
      applyFont(font);
      showAlert(`Typography theme updated to: ${uiFontSelect.options[uiFontSelect.selectedIndex].text}`);
    });
  }

  function applyFont(font) {
    document.body.classList.remove('font-sans', 'font-grotesk', 'font-outfit');
    document.body.classList.add(`font-${font}`);
  }

  // Load Saved Shadow System
  const savedShadow = localStorage.getItem('ui-shadow') || 'default';
  if (uiShadowSelect) {
    uiShadowSelect.value = savedShadow;
    applyShadow(savedShadow);
    uiShadowSelect.addEventListener('change', (e) => {
      const shadow = e.target.value;
      localStorage.setItem('ui-shadow', shadow);
      applyShadow(shadow);
      showAlert(`Shadow intensity updated to: ${shadow.toUpperCase()}`);
    });
  }

  function applyShadow(shadow) {
    document.body.classList.remove('shadow-flat', 'shadow-glow');
    if (shadow === 'flat') {
      document.body.classList.add('shadow-flat');
    } else if (shadow === 'glow') {
      document.body.classList.add('shadow-glow');
    }
  }

  // Load Saved Glassmorphism Backdrop Blur
  const savedGlass = localStorage.getItem('ui-glass') !== 'false';
  if (uiGlassCb) {
    uiGlassCb.checked = savedGlass;
    applyGlass(savedGlass);
    uiGlassCb.addEventListener('change', (e) => {
      const isGlass = e.target.checked;
      localStorage.setItem('ui-glass', isGlass);
      applyGlass(isGlass);
      showAlert(`Glassmorphism backdrop effects ${isGlass ? 'enabled' : 'disabled'}`);
    });
  }

  function applyGlass(isGlass) {
    if (isGlass) {
      document.body.classList.remove('glass-disabled');
    } else {
      document.body.classList.add('glass-disabled');
    }
  }

  // Load Theme Presets (All 6 options)
  themePresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTheme = btn.getAttribute('data-theme');
      applyTheme(targetTheme);
      showAlert(`Theme preset changed to: ${targetTheme.toUpperCase()}`);
    });
  });

  // loadLinks() and loadUsers() are called after session check completes (see above)
  loadDomains();

// --------------------------------------------------------
// CUSTOM DOMAINS MANAGEMENT LOGIC
// --------------------------------------------------------
const domainsTbody = document.getElementById('domains-tbody');
const addDomainForm = document.getElementById('add-domain-form');
const domainSelect = document.getElementById('link-domain');

async function loadDomains() {
  try {
    const res = await fetch('/api/admin/domains');
    const domains = await res.json();
    renderDomainsTable(domains);
    populateDomainSelects(domains);
  } catch (err) {
    if (domainsTbody) domainsTbody.innerHTML = `<tr><td colspan="3" style="color: var(--danger); text-align: center;">Failed to load domains.</td></tr>`;
  }
}

function renderDomainsTable(domains) {
  if (!domainsTbody) return;
  if (!Array.isArray(domains) || domains.length === 0) {
    domainsTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No custom domains configured yet. Add your first above!</td></tr>`;
    return;
  }

  domainsTbody.innerHTML = domains.map(dom => `
    <tr>
      <td data-label="Domain"><strong>${dom.domain}</strong></td>
      <td data-label="Added At">${new Date(dom.createdAt).toLocaleString()}</td>
      <td data-label="Actions">
        <button class="btn btn-danger btn-sm" onclick="deleteDomain('${dom.id}')">🗑️ Delete</button>
      </td>
    </tr>
  `).join('');
}

function populateDomainSelects(domains) {
  if (!domainSelect) return;
  const currentVal = domainSelect.value;
  domainSelect.innerHTML = '<option value="">Default (goo33.online)</option>';
  domains.forEach(dom => {
    const option = document.createElement('option');
    option.value = dom.domain;
    option.textContent = dom.domain;
    domainSelect.appendChild(option);
  });
  domainSelect.value = currentVal;
}

if (addDomainForm) {
  addDomainForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const domainInput = document.getElementById('new-domain-input');
    const domain = domainInput.value.trim();
    if (!domain) return;

    try {
      const res = await fetch('/api/admin/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });
      const data = await res.json();
      if (res.ok) {
        showAlert(`Domain ${domain} added successfully!`);
        domainInput.value = '';
        loadDomains();
      } else {
        showAlert(data.error || 'Failed to add domain', true);
      }
    } catch (err) {
      showAlert('Error adding domain', true);
    }
  });
}

window.deleteDomain = async function(id) {
  if (!confirm('Are you sure you want to delete this custom domain? Links configured to use this domain will stop resolving correctly unless pointed back to default.')) return;
  try {
    const res = await fetch(`/api/admin/domains/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showAlert('Domain deleted successfully');
      loadDomains();
    } else {
      showAlert('Failed to delete domain', true);
    }
  } catch (err) {
    showAlert('Error deleting domain', true);
  }
};
});

