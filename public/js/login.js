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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.style.display = 'none';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        window.location.href = '/admin';
      } else {
        alertBox.textContent = data.error || 'Login failed. Please check credentials.';
        alertBox.style.display = 'block';
      }
    } catch (err) {
      alertBox.textContent = 'Network error. Please try again.';
      alertBox.style.display = 'block';
    }
  });
});
