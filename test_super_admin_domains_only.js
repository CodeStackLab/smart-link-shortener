const assert = require('assert');
const fs = require('fs');
const db = require('./db');

console.log('🧪 Starting Domains Access Verification (Super Admin Only)...\n');

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

test('1. style.css strictly hides #custom-domains-card for non-superadmins and editors', () => {
  const css = fs.readFileSync('./public/css/style.css', 'utf8');
  assert(css.includes('body:not(.is-superadmin) #custom-domains-card'), 'Must hide #custom-domains-card for non-superadmin');
  assert(css.includes('body.is-editor #custom-domains-card'), 'Must hide #custom-domains-card for is-editor');
});

test('2. admin.html has #custom-domains-card hidden by default and hides domains checkboxes', () => {
  const html = fs.readFileSync('./public/admin.html', 'utf8');
  assert(html.includes('id="custom-domains-card"') && html.includes('display:none;'), 'custom-domains-card must be display:none by default');
  assert(html.includes('<label style="display:none;"><input type="checkbox" class="new-perm-cb" value="domains">'), 'new user domains checkbox must be hidden');
  assert(html.includes('<label style="display:none;"><input type="checkbox" class="edit-perm-cb" value="domains">'), 'edit user domains checkbox must be hidden');
});

test('3. dashboard.js adds is-superadmin class strictly for superadmin and restricts customDomainsCard to isSuperAdminUser', () => {
  const js = fs.readFileSync('./public/js/dashboard.js', 'utf8');
  assert(js.includes("if (isSuperAdminUser()) {\n            document.body.classList.add('is-superadmin');"), 'Must add is-superadmin class to body only for superadmin');
  assert(js.includes("customDomainsCard.style.display = isSuperAdminUser() ? '' : 'none';"), 'applyRoleUiScoping must check isSuperAdminUser()');
  assert(js.includes('if (!isSuperAdminUser()) return;'), 'loadDomains must guard against non-superadmin execution');
});

test('4. server.js protects /api/admin/domains with requireSuperAdmin (which strictly requires Super Admin)', () => {
  const serverJs = fs.readFileSync('./server.js', 'utf8');
  assert(serverJs.includes("app.get('/api/admin/domains', requireAuth, requireSuperAdmin"), 'GET /api/admin/domains must require requireSuperAdmin');
  assert(serverJs.includes("app.post('/api/admin/domains', requireAuth, requireSuperAdmin"), 'POST /api/admin/domains must require requireSuperAdmin');
  assert(serverJs.includes("app.delete('/api/admin/domains/:id', requireAuth, requireSuperAdmin"), 'DELETE /api/admin/domains/:id must require requireSuperAdmin');
});

test('5. db.js strips domains from role Admin default permissions and public user list', () => {
  const adminDefaults = db.getDefaultPermissions('Admin');
  assert(!adminDefaults.includes('domains'), 'Admin default permissions must NOT include domains');
  const editorDefaults = db.getDefaultPermissions('Editor');
  assert(!editorDefaults.includes('domains'), 'Editor default permissions must NOT include domains');

  const publicUsers = db.getUsersPublic();
  for (const u of publicUsers) {
    if (u.role !== 'Super Admin' && u.username.toLowerCase() !== 'admin') {
      assert(!u.permissions.includes('domains'), `User ${u.username} in public list must NOT have domains permission`);
    }
  }
});

console.log(`\n🎉 All ${passed}/${total} Super Admin Domains Only Verification Tests Passed successfully!`);
