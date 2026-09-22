// ==========================================================================
// PUBLYTICS TAB & ADMIN ALERT CONTROLLER (Ultra-Lightweight & Instant)
// Zero external API calls • Instant Load • Admin Alert Broadcast & Credentials
// ==========================================================================

(function() {
  'use strict';

  // Copy credential helper with visual feedback
  window.copyPubCredential = function(type, btn) {
    let val = '';
    if (type === 'email') {
      const el = document.getElementById('official-pub-email-val');
      val = el ? el.textContent.trim() : '';
    } else if (type === 'password') {
      const el = document.getElementById('official-pub-pass-val');
      val = el ? el.textContent.trim() : '';
    }
    if (!val) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(val);
    } else {
      const ta = document.createElement('textarea');
      ta.value = val;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    if (btn) {
      const origHTML = btn.innerHTML;
      btn.innerHTML = '<span style="font-size:0.8rem;">✅ Copied!</span>';
      btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      setTimeout(() => {
        btn.innerHTML = origHTML;
        btn.style.background = 'linear-gradient(135deg, #0070f3, #00b4ff)';
      }, 2000);
    }
  };

  // Load Admin Alert Message & Official Login Credentials
  window.loadPublyticsAlertAndCreds = async function() {
    try {
      // 1. Fetch Admin Alert Message
      const alertRes = await fetch('/api/admin-alert');
      if (alertRes.ok) {
        const alertData = await alertRes.json();
        const alertEl = document.getElementById('admin-alert-text');
        if (alertEl && alertData.message) {
          alertEl.textContent = alertData.message;
        }
      }

      // 2. Fetch Official Login Credentials
      const credsRes = await fetch('/api/publytics/credentials');
      if (credsRes.ok) {
        const credsData = await credsRes.json();
        const emailEl = document.getElementById('official-pub-email-val');
        const passEl = document.getElementById('official-pub-pass-val');
        if (emailEl && credsData.loginEmail) emailEl.textContent = credsData.loginEmail;
        if (passEl && credsData.loginPassword) passEl.textContent = credsData.loginPassword;
        if (!document.getElementById('admin-alert-text').textContent.trim() && credsData.adminAlertMessage) {
          document.getElementById('admin-alert-text').textContent = credsData.adminAlertMessage;
        }
      }
    } catch (err) {
      console.warn('Error loading admin alert or credentials:', err);
    }
  };

  window.initPublyticsDashboard = function() {
    window.loadPublyticsAlertAndCreds();
  };

  // Safe stubs for legacy functions
  window.refreshDashboard = function() { window.loadPublyticsAlertAndCreds(); };
  window.openDrilldown = function() {};
  window.closeDrilldown = function() {};
  window.openDrilldownPage = function() {};
  window.closeDrilldownView = function() {};
  window.toggleWebsiteDropdown = function() {};
  window.switchTableTab = function() {};
  window.openCustomDateModal = function() {};
  window.closeCustomDateModal = function() {};

  // Auto-init on page load if Publytics tab is active
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.loadPublyticsAlertAndCreds();
    });
  } else {
    window.loadPublyticsAlertAndCreds();
  }
})();
