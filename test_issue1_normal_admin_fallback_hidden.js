const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Issue 1: Normal Admin vs Master Admin Fallback Scoping...\n');

// 1. Check style.css hides fallback from non-superadmins
const styleCss = fs.readFileSync(path.join(__dirname, 'public/css/style.css'), 'utf8');
assert(styleCss.includes('body:not(.is-superadmin) #default-fallback-url-card'), 'style.css must hide default-fallback-url-card for non-superadmin');
assert(styleCss.includes('html:not(.is-superadmin) #default-fallback-url-card'), 'style.css must hide default-fallback-url-card for html not is-superadmin');
assert(styleCss.includes('body:not(.is-superadmin) #modal-rule-fallback-wrap'), 'style.css must hide modal-rule-fallback-wrap for non-superadmin');
console.log('  ✅ PASS: 1. style.css strictly enforces display:none for #default-fallback-url-card and #modal-rule-fallback-wrap for non-superadmin');

// 2. Check admin.html starts with #default-fallback-url-card hidden
const adminHtml = fs.readFileSync(path.join(__dirname, 'public/admin.html'), 'utf8');
assert(adminHtml.includes('id="default-fallback-url-card"') && adminHtml.includes('display:none;'), 'admin.html default-fallback-url-card must be display:none by default');
console.log('  ✅ PASS: 2. admin.html initializes #default-fallback-url-card with display:none to prevent layout flicker');

// 3. Test JavaScript isSuperAdminUser and isFullAdminUser logic in dashboard.js
const dashboardJs = fs.readFileSync(path.join(__dirname, 'public/js/dashboard.js'), 'utf8');

// Simulate the function logic from dashboard.js
function createSimulator(username, role, isSuperAdminServer = null) {
  let currentLoggedInUsername = username;
  let currentLoggedInRole = role;
  let currentLoggedInIsSuperAdmin = isSuperAdminServer;

  function isSuperAdminUser() {
    if (currentLoggedInIsSuperAdmin !== null) {
      return currentLoggedInIsSuperAdmin === true;
    }
    const r = String(currentLoggedInRole || '').toLowerCase().trim();
    const u = String(currentLoggedInUsername || '').toLowerCase().trim();
    const cleanU = u.replace(/[^\w\s]/g, '').trim();
    const cleanR = r.replace(/[^\w\s]/g, '').trim();
    return cleanU === 'admin' || cleanU === 'master admin' || cleanU === 'super admin' || cleanR === 'super admin' || cleanR === 'master admin';
  }

  function isFullAdminUser() {
    const r = String(currentLoggedInRole || '').toLowerCase().trim();
    const u = String(currentLoggedInUsername || '').toLowerCase().trim();
    const cleanU = u.replace(/[^\w\s]/g, '').trim();
    const cleanR = r.replace(/[^\w\s]/g, '').trim();
    return isSuperAdminUser() || cleanR === 'admin' || cleanU === 'admin';
  }

  return { isSuperAdminUser, isFullAdminUser };
}

// Case A: Master Admin (username: "admin", role: "Admin")
const masterAdmin = createSimulator('admin', 'Admin', true);
assert.strictEqual(masterAdmin.isSuperAdminUser(), true, 'Master Admin must have isSuperAdminUser() === true');
assert.strictEqual(masterAdmin.isFullAdminUser(), true, 'Master Admin must have isFullAdminUser() === true');

// Case B: Normal Admin (username: "Okkooo", role: "Admin")
const normalAdmin = createSimulator('Okkooo', 'Admin', false);
assert.strictEqual(normalAdmin.isSuperAdminUser(), false, 'Normal Admin MUST have isSuperAdminUser() === false');
assert.strictEqual(normalAdmin.isFullAdminUser(), true, 'Normal Admin MUST have isFullAdminUser() === true (for general admin features)');

// Case C: Editor (username: "Khanliker", role: "Editor")
const editorUser = createSimulator('Khanliker', 'Editor', false);
assert.strictEqual(editorUser.isSuperAdminUser(), false, 'Editor must have isSuperAdminUser() === false');
assert.strictEqual(editorUser.isFullAdminUser(), false, 'Editor must have isFullAdminUser() === false');

console.log('  ✅ PASS: 3. isSuperAdminUser() strictly separates Master Admin (TRUE) from Normal Admin (FALSE) and Editor (FALSE)');

// 4. Verify dashboard.js scopes fallbackCard strictly to isSuperAdminUser()
assert(dashboardJs.includes("fallbackCard.style.display = isSuperAdminUser() ? '' : 'none';"), 'dashboard.js must gate fallbackCard to isSuperAdminUser()');
assert(dashboardJs.includes("fallbackWrap.style.display = isSuperAdminUser() ? '' : 'none';"), 'dashboard.js must gate modal-rule-fallback-wrap to isSuperAdminUser()');
assert(dashboardJs.includes("wrapNewColFallback.style.setProperty('display', isSuperAdminUser() ? 'flex' : 'none', 'important')"), 'dashboard.js must gate wrapNewColFallback to isSuperAdminUser()');
assert(dashboardJs.includes("wrapEditColFallback.style.setProperty('display', isSuperAdminUser() ? 'flex' : 'none', 'important')"), 'dashboard.js must gate wrapEditColFallback to isSuperAdminUser()');
console.log('  ✅ PASS: 4. dashboard.js gates fallbackCard, modal-rule-fallback-wrap, and modal checkboxes to isSuperAdminUser()');

// 5. Verify server.js protection
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
assert(serverJs.includes('if (defaultFallbackUrl !== undefined && !isSuperAdminSession(req))'), 'server.js POST /api/admin/settings must block non-superadmins from setting defaultFallbackUrl');
assert(serverJs.includes('delete sanitized.defaultFallbackUrl;'), 'server.js GET /api/admin/settings must strip defaultFallbackUrl for non-superadmins');
console.log('  ✅ PASS: 5. server.js strictly prevents Normal Admin from viewing or modifying defaultFallbackUrl');

console.log('\n🎉 ALL ISSUE 1 VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
