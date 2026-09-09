const assert = require('assert');
const fs = require('fs');
const db = require('./db');

console.log('🧪 Starting Super Admin Exclusivity for Fallback & Domains Verification...\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

test('1. style.css strictly hides #default-fallback-url-card and #custom-domains-card for non-superadmins', () => {
  const css = fs.readFileSync('./public/css/style.css', 'utf8');
  assert(css.includes('body:not(.is-superadmin) #default-fallback-url-card'), 'Must hide #default-fallback-url-card for non-superadmin');
  assert(css.includes('body:not(.is-superadmin) #custom-domains-card'), 'Must hide #custom-domains-card for non-superadmin');
  assert(css.includes('body.is-editor #default-fallback-url-card'), 'Must hide #default-fallback-url-card for is-editor');
  assert(css.includes('body.is-editor #custom-domains-card'), 'Must hide #custom-domains-card for is-editor');
});

test('2. admin.html has #default-fallback-url-card and #custom-domains-card hidden by default', () => {
  const html = fs.readFileSync('./public/admin.html', 'utf8');
  assert(html.includes('id="default-fallback-url-card"') && html.includes('display:none;'), 'default-fallback-url-card must have display:none by default');
  assert(html.includes('id="custom-domains-card"') && html.includes('display:none;'), 'custom-domains-card must have display:none by default');
  assert(html.includes('<label style="display:none;"><input type="checkbox" class="new-perm-cb" value="domains">'), 'new user form must hide domains checkbox');
  assert(html.includes('<label style="display:none;"><input type="checkbox" class="edit-perm-cb" value="domains">'), 'edit user form must hide domains checkbox');
});

test('3. dashboard.js gates fallbackCard and customDomainsCard strictly to isSuperAdminUser, but teamCard to isFullAdmin', () => {
  const js = fs.readFileSync('./public/js/dashboard.js', 'utf8');
  assert(js.includes("fallbackCard.style.display = isSuperAdminUser() ? '' : 'none';"), 'fallbackCard must check isSuperAdminUser()');
  assert(js.includes("customDomainsCard.style.display = isSuperAdminUser() ? '' : 'none';"), 'customDomainsCard must check isSuperAdminUser()');
  assert(js.includes("teamCard.style.display = isFullAdmin ? '' : 'none';"), 'teamCard must check isFullAdmin');
  assert(js.includes("editorCountryBlockCard.style.display = isFullAdmin ? '' : 'none';"), 'editorCountryBlockCard must check isFullAdmin');
});

test('4. server.js restricts Fallback URL and Custom Domains to Super Admin, but allows team management for Normal Admin', () => {
  const serverJs = fs.readFileSync('./server.js', 'utf8');
  assert(serverJs.includes('delete sanitized.defaultFallbackUrl;'), 'GET /api/admin/settings must delete defaultFallbackUrl for non-superadmins');
  assert(serverJs.includes('defaultFallbackUrl !== undefined && !isSuperAdminSession(req)'), 'POST /api/admin/settings must reject defaultFallbackUrl from non-superadmins');
  assert(serverJs.includes("app.get('/api/admin/domains', requireAuth, requireSuperAdmin"), 'GET /api/admin/domains must require requireSuperAdmin');
  assert(serverJs.includes("app.get('/api/admin/users', requireAuth, (req, res) => {\n  if (!isAnyAdminSession(req))"), 'GET /api/admin/users must check isAnyAdminSession');
  assert(serverJs.includes("app.post('/api/admin/users/invite', requireAuth, (req, res) => {\n  if (!isAnyAdminSession(req))"), 'POST /api/admin/users/invite must check isAnyAdminSession');
  assert(serverJs.includes("app.delete('/api/admin/users/:id', requireAuth, (req, res) => {\n  if (!isAnyAdminSession(req))"), 'DELETE /api/admin/users/:id must check isAnyAdminSession');
});

test('5. db.js reserves domains permission for Super Admin and strips it from Admin and Editor', () => {
  const adminDefaults = db.getDefaultPermissions('Admin');
  assert(!adminDefaults.includes('domains'), 'Admin default permissions must NOT include domains');
  const superAdminDefaults = db.getDefaultPermissions('Super Admin');
  assert(superAdminDefaults.includes('domains'), 'Super Admin default permissions must include domains');
  const editorDefaults = db.getDefaultPermissions('Editor');
  assert(!editorDefaults.includes('domains'), 'Editor default permissions must NOT include domains');
  assert(!editorDefaults.includes('firewall'), 'Editor default permissions must NOT include firewall');
  assert(!editorDefaults.includes('analytics'), 'Editor default permissions must NOT include analytics');
});

console.log(`\n🎉 All ${passed}/${total} Super Admin Exclusivity Verification Tests Passed successfully!`);
