const assert = require('assert');
const fs = require('fs');
const path = require('path');
const db = require('./db');

console.log('🧪 Testing Fallback Option Scoping to Master Admin & Allowed Sources Fix...\n');

// 1. Verify admin.html has wrap IDs for fallback URL
const adminHtml = fs.readFileSync(path.join(__dirname, 'public/admin.html'), 'utf8');
assert(adminHtml.includes('id="wrap-new-col-fallback-url"'), 'wrap-new-col-fallback-url must exist in admin.html');
assert(adminHtml.includes('id="wrap-edit-col-fallback-url"'), 'wrap-edit-col-fallback-url must exist in admin.html');
console.log('  ✅ PASS: 1. wrap-new-col-fallback-url & wrap-edit-col-fallback-url exist in admin.html');

// 2. Verify dashboard.js scopes wrap-new-col-fallback-url & wrap-edit-col-fallback-url to isSuperAdminUser()
const dashboardJs = fs.readFileSync(path.join(__dirname, 'public/js/dashboard.js'), 'utf8');
assert(dashboardJs.includes("wrapNewColFallback.style.setProperty('display', isSuperAdminUser() ? 'flex' : 'none', 'important')"), 'wrapNewColFallback must be scoped to isSuperAdminUser()');
assert(dashboardJs.includes("wrapEditColFallback.style.setProperty('display', isSuperAdminUser() ? 'flex' : 'none', 'important')"), 'wrapEditColFallback must be scoped to isSuperAdminUser()');
console.log('  ✅ PASS: 2. Fallback URL checkboxes in user modals are strictly scoped to isSuperAdminUser()');

// 3. Verify Traffic Rules Modal scopes Fallback Redirect wrap to isSuperAdminUser()
assert(dashboardJs.includes("fallbackWrap.style.display = isSuperAdminUser() ? '' : 'none'"), 'modal-rule-fallback-wrap must be scoped to isSuperAdminUser()');
console.log('  ✅ PASS: 3. modal-rule-fallback-wrap in Traffic Rules modal is strictly scoped to isSuperAdminUser()');

// 4. Verify Column Visibility in Links Table scopes col_fallback_url to isSuperAdminUser()
assert(dashboardJs.includes("hasColPerm = (perm === 'col_fallback_url')\n        ? isSuperAdminUser()"), 'col_fallback_url column must be strictly scoped to isSuperAdminUser()');
console.log('  ✅ PASS: 4. Fallback URL column in links table is strictly scoped to isSuperAdminUser()');

// 5. Verify server.js protects col_fallback_url and logs_fallback_clicks in update-role
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
assert(serverJs.includes("finalPerms.filter(p => p !== 'domains' && p !== 'col_fallback_url' && p !== 'logs_fallback_clicks')"), 'server.js update-role must prevent Normal Admin from granting col_fallback_url and logs_fallback_clicks');
assert(serverJs.includes("assignedPerms.filter(p => p !== 'domains' && p !== 'col_fallback_url' && p !== 'logs_fallback_clicks')"), 'server.js invite must prevent Normal Admin from granting col_fallback_url and logs_fallback_clicks');
console.log('  ✅ PASS: 5. Backend endpoints /api/admin/users/invite & update-role protect col_fallback_url and logs_fallback_clicks from Normal Admin');

// 6. Verify server.js protects fallbackUrl modification in PUT /api/admin/links/:id
assert(serverJs.includes('if (fallbackUrl !== undefined && isSuperAdminSession(req)) updateFields.fallbackUrl'), 'PUT /api/admin/links/:id must enforce isSuperAdminSession(req) for fallbackUrl');
console.log('  ✅ PASS: 6. Backend PUT /api/admin/links/:id allows only Master Admin to modify fallbackUrl');

// 7. Verify allowedPlatforms fix in dashboard.js
assert(dashboardJs.includes("const rawAllowed = (Array.isArray(link.allowedPlatforms) && link.allowedPlatforms.length > 0)"), 'dashboard.js presetBadges must handle empty allowedPlatforms');
assert(dashboardJs.includes("link.allowedPlatforms.filter(p => p && p !== 'direct')"), 'dashboard.js must filter out direct');
assert(dashboardJs.includes("const isPermitted = isFullAdminUser() || (Array.isArray(userCurrentPermissions) && userCurrentPermissions.includes(val));"), 'dashboard.js allowedPlatforms building must use isFullAdminUser()');
console.log('  ✅ PASS: 7. dashboard.js allowedPlatforms generation and badge rendering properly supports Master Admin and non-empty fallback');

// 8. Verify existing links in links.json have valid allowedPlatforms
const linksJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/links.json'), 'utf8'));
if (linksJson.length > 0) {
  const sampleLink = linksJson.find(l => l.allowedPlatforms) || linksJson[0];
  assert(Array.isArray(sampleLink.allowedPlatforms) && sampleLink.allowedPlatforms.includes('facebook'), 'sampleLink allowedPlatforms must include facebook');
  console.log('  ✅ PASS: 8. Existing link in database has valid allowedPlatforms: ["facebook"]');
}

console.log('\n🎉 All 8 Verification Tests Passed successfully!');
