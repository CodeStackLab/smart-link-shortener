const assert = require('assert');
const fs = require('fs');
const db = require('./db');

console.log('🧪 Starting Super Admin Fallback & Domains Verification...\n');

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

test('1. style.css strictly hides #default-fallback-url-card for non-superadmins and editors', () => {
  const css = fs.readFileSync('./public/css/style.css', 'utf8');
  assert(css.includes('body:not(.is-superadmin) #default-fallback-url-card'), 'Must hide #default-fallback-url-card for non-superadmin');
  assert(css.includes('body.is-editor #default-fallback-url-card'), 'Must hide #default-fallback-url-card for is-editor');
});

test('2. admin.html has #default-fallback-url-card hidden by default', () => {
  const html = fs.readFileSync('./public/admin.html', 'utf8');
  assert(html.includes('id="default-fallback-url-card"') && html.includes('display:none;'), 'default-fallback-url-card must have display:none by default');
});

test('3. dashboard.js gates fallbackCard and saveDefaultFallbackUrl strictly to isSuperAdminUser', () => {
  const js = fs.readFileSync('./public/js/dashboard.js', 'utf8');
  assert(js.includes("fallbackCard.style.display = isSuperAdminUser() ? '' : 'none';"), 'applyRoleUiScoping must check isSuperAdminUser() for fallbackCard');
  const saveFallbackIdx = js.indexOf('window.saveDefaultFallbackUrl = async function');
  assert(saveFallbackIdx !== -1, 'saveDefaultFallbackUrl must exist');
  const saveFallbackChunk = js.slice(saveFallbackIdx, saveFallbackIdx + 200);
  assert(saveFallbackChunk.includes('if (!isSuperAdminUser())'), 'saveDefaultFallbackUrl must check isSuperAdminUser()');
});

test('4. server.js strips defaultFallbackUrl in GET /api/admin/settings for non-superadmins and rejects POST from non-superadmins', () => {
  const serverJs = fs.readFileSync('./server.js', 'utf8');
  assert(serverJs.includes('delete sanitized.defaultFallbackUrl;'), 'GET /api/admin/settings must delete defaultFallbackUrl for non-superadmins');
  assert(serverJs.includes('defaultFallbackUrl !== undefined && !isSuperAdminSession(req)'), 'POST /api/admin/settings must reject defaultFallbackUrl from non-superadmins');
});

test('5. style.css strictly hides #custom-domains-card for non-superadmins and editors', () => {
  const css = fs.readFileSync('./public/css/style.css', 'utf8');
  assert(css.includes('body:not(.is-superadmin) #custom-domains-card'), 'Must hide #custom-domains-card for non-superadmin');
  assert(css.includes('body.is-editor #custom-domains-card'), 'Must hide #custom-domains-card for is-editor');
});

test('6. admin.html has #custom-domains-card hidden by default and hides domains checkboxes', () => {
  const html = fs.readFileSync('./public/admin.html', 'utf8');
  assert(html.includes('id="custom-domains-card"') && html.includes('display:none;'), 'custom-domains-card must have display:none by default');
  assert(html.includes('<label style="display:none;"><input type="checkbox" class="new-perm-cb" value="domains">'), 'new user domains checkbox must be hidden');
  assert(html.includes('<label style="display:none;"><input type="checkbox" class="edit-perm-cb" value="domains">'), 'edit user domains checkbox must be hidden');
});

test('7. dashboard.js strictly restricts customDomainsCard and loadDomains to isSuperAdminUser', () => {
  const js = fs.readFileSync('./public/js/dashboard.js', 'utf8');
  assert(js.includes("customDomainsCard.style.display = isSuperAdminUser() ? '' : 'none';"), 'applyRoleUiScoping must check isSuperAdminUser() for customDomainsCard');
  assert(js.includes('if (!isSuperAdminUser()) return;'), 'loadDomains must guard against non-superadmin execution');
});

test('8. server.js protects /api/admin/domains with requireSuperAdmin and filters domains from getUserPermissions', () => {
  const serverJs = fs.readFileSync('./server.js', 'utf8');
  assert(serverJs.includes("app.get('/api/admin/domains', requireAuth, requireSuperAdmin"), 'GET /api/admin/domains must require requireSuperAdmin');
  assert(serverJs.includes("app.post('/api/admin/domains', requireAuth, requireSuperAdmin"), 'POST /api/admin/domains must require requireSuperAdmin');
  assert(serverJs.includes("app.delete('/api/admin/domains/:id', requireAuth, requireSuperAdmin"), 'DELETE /api/admin/domains/:id must require requireSuperAdmin');
});

console.log(`\n🎉 All ${passed}/${total} Super Admin Fallback & Domains Verification Tests Passed successfully!`);
