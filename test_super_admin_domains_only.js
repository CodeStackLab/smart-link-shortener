const assert = require('assert');
const fs = require('fs');
const db = require('./db');

console.log('🧪 Starting Domains Access Verification (Normal Admin & Super Admin Access)...\n');

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

test('1. style.css hides #custom-domains-card for editors, but allows admins', () => {
  const css = fs.readFileSync('./public/css/style.css', 'utf8');
  assert(css.includes('body:not(.is-admin) #custom-domains-card'), 'Must hide #custom-domains-card for non-admin');
  assert(css.includes('body.is-editor #custom-domains-card'), 'Must hide #custom-domains-card for is-editor');
});

test('2. admin.html has #custom-domains-card hidden by default to avoid flicker', () => {
  const html = fs.readFileSync('./public/admin.html', 'utf8');
  assert(html.includes('id="custom-domains-card"') && html.includes('display:none;'), 'custom-domains-card must be display:none by default');
});

test('3. dashboard.js adds is-superadmin class and restricts customDomainsCard and loadDomains to isSuperAdminUser', () => {
  const js = fs.readFileSync('./public/js/dashboard.js', 'utf8');
  assert(js.includes("document.body.classList.add('is-superadmin')"), 'Must add is-superadmin class to body for superadmin/admin');
  assert(js.includes('customDomainsCard.style.display = isSuperAdminUser() ? \'\' : \'none\';'), 'applyRoleUiScoping must check isSuperAdminUser()');
  assert(js.includes('if (!isSuperAdminUser()) return;'), 'loadDomains must guard against non-superadmin execution');
});

test('4. server.js protects /api/admin/domains with requireSuperAdmin (which allows Admin)', () => {
  const serverJs = fs.readFileSync('./server.js', 'utf8');
  assert(serverJs.includes("app.get('/api/admin/domains', requireAuth, requireSuperAdmin"), 'GET /api/admin/domains must require requireSuperAdmin');
  assert(serverJs.includes("app.post('/api/admin/domains', requireAuth, requireSuperAdmin"), 'POST /api/admin/domains must require requireSuperAdmin');
  assert(serverJs.includes("app.delete('/api/admin/domains/:id', requireAuth, requireSuperAdmin"), 'DELETE /api/admin/domains/:id must require requireSuperAdmin');
});

test('5. db.js grants domains to role Admin and strips from Editor', () => {
  const adminDefaults = db.getDefaultPermissions('Admin');
  assert(adminDefaults.includes('domains'), 'Admin default permissions must include domains');
  const editorDefaults = db.getDefaultPermissions('Editor');
  assert(!editorDefaults.includes('domains'), 'Editor default permissions must NOT include domains');
});

console.log(`\n🎉 All ${passed}/${total} Domains Access Verification Tests Passed successfully!`);
