const assert = require('assert');
const fs = require('fs');
const db = require('./db');

console.log('🧪 Starting Super Admin Hidden & Country Block Permission Verification...\n');

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

// ── 1. Admin HTML UI Components ──
test('1. admin.html contains wrap-new-col-blocked-countries and wrap-edit-col-blocked-countries checkboxes', () => {
  const html = fs.readFileSync('./public/admin.html', 'utf8');
  assert(html.includes('id="wrap-new-col-blocked-countries"'), 'Must have wrap-new-col-blocked-countries');
  assert(html.includes('value="col_blocked_countries"'), 'Must have col_blocked_countries checkbox');
  assert(html.includes('id="wrap-edit-col-blocked-countries"'), 'Must have wrap-edit-col-blocked-countries');
  assert(html.includes('dashboard.js?v=85'), 'Must have bumped dashboard.js version to v85');
  assert(html.includes('style.css?v=52'), 'Must have bumped style.css version to v52');
});

// ── 2. Stylesheet Security & Column Hiding ──
test('2. style.css hides column on col-hidden-perm and allows both Super Admin and Normal Admin to see toggle', () => {
  const css = fs.readFileSync('./public/css/style.css', 'utf8');
  assert(!css.includes('body:not(.is-superadmin) #wrap-new-col-blocked-countries'), 'Must not hide wrap-new-col-blocked-countries from normal admin');
  assert(!css.includes('body:not(.is-superadmin) #wrap-edit-col-blocked-countries'), 'Must not hide wrap-edit-col-blocked-countries from normal admin');
  assert(css.includes('td[data-label="Blocked Countries"].col-hidden-perm'), 'Must hide data-label="Blocked Countries" on col-hidden-perm');
  assert(css.includes('td.col-blocked-countries.col-hidden-perm'), 'Must hide td.col-blocked-countries on col-hidden-perm');
  assert(css.includes('th#th-blocked-countries.col-hidden-perm'), 'Must hide th#th-blocked-countries on col-hidden-perm');
});

// ── 3. Frontend Column Visibility & Super Admin Filtering ──
test('3. dashboard.js includes col_blocked_countries in colMap and shows toggle for both Super Admin and Normal Admin', () => {
  const js = fs.readFileSync('./public/js/dashboard.js', 'utf8');
  assert(js.includes("perm: 'col_blocked_countries'"), 'colMap must include col_blocked_countries');
  assert(js.includes("thId: 'th-blocked-countries'"), 'colMap must map to th-blocked-countries');
  assert(js.includes("tdClass: 'col-blocked-countries'"), 'colMap must map to col-blocked-countries');
  assert(js.includes("wrapNewColBlocked.style.display = isFullAdmin ? 'flex' : 'none'"), 'wrapNewColBlocked must be visible to isFullAdmin');
  assert(js.includes("wrapEditColBlocked.style.display = isFullAdmin ? 'flex' : 'none'"), 'wrapEditColBlocked must be visible to isFullAdmin');
  assert(js.includes("filteredUsers.filter(u => u.username.toLowerCase() !== 'admin'"), 'loadUsers must filter out admin for non-superadmin');
});

// ── 4. Service Worker Cache Invalidation ──
test('4. sw.js is updated with new cache name smartlink-v85', () => {
  const sw = fs.readFileSync('./public/sw.js', 'utf8');
  assert(sw.includes("smartlink-v85"), 'Service Worker cache must be smartlink-v85');
});

// ── 5. Backend GET /api/admin/users Hides Super Admin ──
test('5. server.js filters primary Super Admin account in GET /api/admin/users for Normal Admin', () => {
  const serverJs = fs.readFileSync('./server.js', 'utf8');
  assert(serverJs.includes("if (!isSuperAdminSession(req)) {\n    // Primary Super Admin account is hidden from Normal Admin"), 'Must filter out admin in GET /api/admin/users for non-superadmins');
});

// ── 6. Backend Super Admin Account Protection ──
test('6. server.js protects Super Admin from modification and password reset by Normal Admin', () => {
  const serverJs = fs.readFileSync('./server.js', 'utf8');
  assert(serverJs.includes("if (target.username.toLowerCase() === 'admin' || String(target.role).toLowerCase() === 'super admin') {\n    return res.status(400).json({ error: 'Cannot modify primary Super Admin account.' });"), 'Must protect Super Admin in update-role');
  assert(serverJs.includes("if (!isSuperAdminSession(req) && (user.username.toLowerCase() === 'admin' || String(user.role).toLowerCase() === 'super admin')) {\n    return res.status(403).json({ error: 'Access denied. Only Super Admin can reset Super Admin password.' });"), 'Must protect Super Admin in reset-password');
});

// ── 7. Backend Both Super Admin and Normal Admin Can Manage col_blocked_countries ──
test('7. server.js allows both Super Admin and Normal Admin to manage col_blocked_countries', () => {
  const serverJs = fs.readFileSync('./server.js', 'utf8');
  assert(serverJs.includes("finalPerms = finalPerms.filter(p => p !== 'domains');"), 'Only domains is filtered for Normal Admin in update-role');
  assert(serverJs.includes("assignedPerms = assignedPerms.filter(p => p !== 'domains');"), 'Only domains is filtered for Normal Admin in invite');
});

// ── 8. Backend Global Country Block Enforcement for Editor Shortlinks ──
test('8. server.js shortlink redirect strictly applies global Country Block to all Editor links', () => {
  const serverJs = fs.readFileSync('./server.js', 'utf8');
  assert(serverJs.includes("const isGlobalCountryBlockOn = settings.editorCountryBlockEnabled !== false;"), 'Must check isGlobalCountryBlockOn');
  assert(serverJs.includes("const globalBlockedCountries = Array.isArray(settings.editorBlockedCountries) ? settings.editorBlockedCountries : [];"), 'Must get globalBlockedCountries');
  assert(serverJs.includes("if (isGlobalCountryBlockOn && globalBlockedCountries.length > 0) {\n      isEditorCountryBlockOn = true;\n      effectiveBlockedCountries = globalBlockedCountries;"), 'Must apply global blocked countries to all editor links');
});

// ── 9. Backend Link API Visibility Protection for Editors ──
test('9. server.js hides blockedCountries from Editors in /api/admin/links unless col_blocked_countries granted', () => {
  const serverJs = fs.readFileSync('./server.js', 'utf8');
  assert(serverJs.includes("if (!userPerms.includes('col_blocked_countries')) {\n    mapped.forEach(l => {\n      l.blockedCountries = [];\n      l.countryBlockEnabled = false;\n    });\n  }"), 'Must sanitize blockedCountries for Editors without col_blocked_countries perm');
});

// ── 10. Database Role Default Permissions ──
test('10. db.getDefaultPermissions for Editor does NOT contain col_blocked_countries', () => {
  const editorPerms = db.getDefaultPermissions('Editor');
  assert(!editorPerms.includes('col_blocked_countries'), 'Default Editor permissions must NOT include col_blocked_countries');
  assert(!editorPerms.includes('domains'), 'Default Editor permissions must NOT include domains');
});

console.log(`\n🎉 All ${passed}/${total} checks PASSED successfully!`);
