document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const alertBox = document.getElementById('login-alert');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');

  // Theme Switcher Engine (Default: Light Mode)
  let currentTheme = localStorage.getItem('theme') || 'light';
  applyTheme(currentTheme);

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = theme === 'light' ? '☀️ Light Mode' : '🌙 Dark Mode';
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(currentTheme);
    });
  }

  // Check if session already active
  fetch('/api/session')
    .then(res => res.json())
    .then(data => {
      if (data.authenticated) {
        window.location.href = '/admin';
      }
    })
    .catch(() => {});

  // Tab switching logic
  const tabBtnPassword = document.getElementById('tab-btn-password');
  const tabBtnTotp = document.getElementById('tab-btn-totp');
  const passwordTabContent = document.getElementById('password-tab-content');
  const totpTabContent = document.getElementById('totp-tab-content');
  const activeAuthMode = document.getElementById('active-auth-mode');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const totpCodeInput = document.getElementById('totp-code');

  // Auto-fill credentials & auto-login from Direct Invite Link (?u=...&p=...)
  const urlParams = new URLSearchParams(window.location.search);
  const paramUser = urlParams.get('u') || urlParams.get('user') || urlParams.get('username');
  const paramPass = urlParams.get('p') || urlParams.get('pass') || urlParams.get('password');

  if (paramUser && usernameInput) {
    usernameInput.value = paramUser;
  }
  if (paramPass && passwordInput) {
    passwordInput.value = paramPass;
  }
  if (paramUser && paramPass && form) {
    setTimeout(() => {
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }, 300);
  }

  if (tabBtnPassword && tabBtnTotp) {
    tabBtnPassword.addEventListener('click', () => {
      tabBtnPassword.classList.add('active');
      tabBtnTotp.classList.remove('active');
      passwordTabContent.style.display = 'block';
      totpTabContent.style.display = 'none';
      if (activeAuthMode) activeAuthMode.value = 'password';
      if (passwordInput) passwordInput.focus();
    });

    tabBtnTotp.addEventListener('click', () => {
      tabBtnTotp.classList.add('active');
      tabBtnPassword.classList.remove('active');
      totpTabContent.style.display = 'block';
      passwordTabContent.style.display = 'none';
      if (activeAuthMode) activeAuthMode.value = 'totp';
      if (totpCodeInput) totpCodeInput.focus();
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.style.display = 'none';

    const username = (document.getElementById('username')?.value || '').trim();
    if (!username) {
      alertBox.textContent = 'Please enter your username.';
      alertBox.style.display = 'block';
      return;
    }
    const mode = activeAuthMode ? activeAuthMode.value : 'password';

    let payload = { username };

    if (mode === 'totp') {
      const totpCode = totpCodeInput ? totpCodeInput.value.trim() : '';
      if (!totpCode || totpCode.length !== 6) {
        alertBox.textContent = 'Please enter a valid 6-digit Authenticator code.';
        alertBox.style.display = 'block';
        return;
      }
      payload.totpCode = totpCode;
    } else {
      const password = passwordInput ? passwordInput.value.trim() : '';
      if (!password) {
        alertBox.textContent = 'Please enter your admin password.';
        alertBox.style.display = 'block';
        return;
      }
      payload.password = password;
    }

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        window.location.href = '/admin';
      } else {
        alertBox.textContent = data.error || 'Login failed. Please check credentials or code.';
        alertBox.style.display = 'block';
      }
    } catch (err) {
      alertBox.textContent = 'Network error. Please try again.';
      alertBox.style.display = 'block';
    }
  });
});
