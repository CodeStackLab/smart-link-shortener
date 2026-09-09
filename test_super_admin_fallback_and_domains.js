const assert = require('assert');
const fs = require('fs');
const db = require('./db');

console.log('🧪 Starting Full Admin & Super Admin Controls Verification...\n');

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

test('1. style.css hides #default-fallback-url-card and #custom-domains-card for editors, but allows admins', () => {
  const css = fs.readFileSync('./public/css/style.css', 'utf8');
  assert(css.includes('body:not(.is-admin) #default-fallback-url-card'), 'Must hide #default-fallback-url-card for non-admin');
  assert(css.includes('body.is-editor #default-fallback-url-card'), 'Must hide #default-fallback-url-card for is-editor');
  assert(css.includes('body:not(.is-admin) #custom-domains-card'), 'Must hide #custom-domains-card for non-admin');
  assert(css.includes('body.is-editor #custom-domains-card'), 'Must hide #custom-domains-card for is-editor');
});

test('2. admin.html has #default-fallback-url-card and #custom-domains-card hidden initially to avoid flicker', () => {
  const html = fs.readFileSync('./public/admin.html', 'utf8');
  assert(html.includes('id="default-fallback-url-card"') && html.includes('display:none;'), 'default-fallback-url-card must have display:none by default');
  assert(html.includes('id="custom-domains-card"') && html.includes('display:none;'), 'custom-domains-card must have display:none by default');
  assert(html.includes('<input type="checkbox" class="new-perm-cb" value="domains">'), 'new user form must have domains checkbox');
  assert(html.includes('<input type="checkbox" class="edit-perm-cb" value="domains">'), 'edit user form must have domains checkbox');
});

test('3. dashboard.js defines isSuperAdminUser to include Normal Admin and Super Admin', () => {
  const js = fs.readFileSync('./public/js/dashboard.js', 'utf8');
  assert(js.includes("r === 'admin' || r === 'super admin'"), 'isSuperAdminUser must return true for Admin role');
  assert(js.includes("fallbackCard.style.display = isSuperAdminUser() ? '' : 'none';"), 'fallbackCard must check isSuperAdminUser()');
  assert(js.includes("customDomainsCard.style.display = isSuperAdminUser() ? '' : 'none';"), 'customDomainsCard must check isSuperAdminUser()');
});

test('4. server.js isSuperAdminSession grants full admin capabilities to role Admin', () => {
  const serverJs = fs.readFileSync('./server.js', 'utf8');
  assert(serverJs.includes("r === 'admin' || r === 'super admin'") || serverJs.includes("r === 'admin'"), 'isSuperAdminSession must include Admin role');
  assert(serverJs.includes("app.get('/api/admin/users', requireAuth, (req, res) => {\n  if (!isSuperAdminSession(req))"), 'GET /api/admin/users must check isSuperAdminSession');
  assert(serverJs.includes("app.post('/api/admin/users/invite', requireAuth, (req, res) => {\n  if (!isSuperAdminSession(req))"), 'POST /api/admin/users/invite must check isSuperAdminSession');
  assert(serverJs.includes("app.post('/api/admin/users/update-role', requireAuth, (req, res) => {\n  if (!isSuperAdminSession(req))"), 'POST /api/admin/users/update-role must check isSuperAdminSession');
  assert(serverJs.includes("app.delete('/api/admin/users/:id', requireAuth, (req, res) => {\n  if (!isSuperAdminSession(req))"), 'DELETE /api/admin/users/:id must check isSuperAdminSession');
});

test('5. db.js grants domains permission to role Admin while strictly stripping it from Editor', () => {
  const adminDefaults = db.getDefaultPermissions('Admin');
  assert(adminDefaults.includes('domains'), 'Admin default permissions must include domains');
  const editorDefaults = db.getDefaultPermissions('Editor');
  assert(!editorDefaults.includes('domains'), 'Editor default permissions must NOT include domains');
  assert(!editorDefaults.includes('firewall'), 'Editor default permissions must NOT include firewall');
  assert(!editorDefaults.includes('analytics'), 'Editor default permissions must NOT include analytics');
});

console.log(`\n🎉 All ${passed}/${total} Admin & Super Admin Controls Verification Tests Passed successfully!`);
