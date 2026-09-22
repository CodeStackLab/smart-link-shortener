const assert = require('assert');
const fs = require('fs');
const path = require('path');
const db = require('./db');

console.log('🧪 Testing Normal Admin Publytics Access & Super Admin Delete Guard...\n');

// 1. Verify db.js defaults for Admin include 'publytics'
const adminDefaults = db.getDefaultPermissions('Admin');
assert(adminDefaults.includes('publytics'), 'FAIL: publytics missing from Admin default permissions');
console.log('✅ PASS: db.getDefaultPermissions("Admin") includes "publytics"');

// 2. Verify server.js allows Admin role bypass for publytics
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
assert(serverJs.includes("if (isAdminRole(req.session && req.session.role) && !permissions.includes('domains'))"), 'FAIL: server.js still restricts publytics from Admin role');
console.log('✅ PASS: server.js allows Admin role to access publytics endpoints');

// 3. Verify dashboard.js gives Normal Admin access to publytics tab
const dashboardJs = fs.readFileSync(path.join(__dirname, 'public/js/dashboard.js'), 'utf8');
assert(dashboardJs.includes("(isSuperAdminUser() || isFullAdmin || userPerms.includes('publytics'))"), 'FAIL: dashboard.js does not allow isFullAdmin on publytics tab');
assert(dashboardJs.includes("!(isSuperAdminUser() || isFullAdminUser() || userCurrentPermissions.includes('publytics'))"), 'FAIL: dashboard.js does not allow isFullAdminUser on publytics tab click');
console.log('✅ PASS: dashboard.js grants Normal Admin full access to the Publytics tab');

// 4. Verify publytics.js gates delete button to Super Admin only
const publyticsJs = fs.readFileSync(path.join(__dirname, 'public/js/publytics.js'), 'utf8');
assert(publyticsJs.includes("const canDelete = isSuperAdmin();"), 'FAIL: publytics.js missing canDelete check');
assert(publyticsJs.includes("if (!isSuperAdmin()) {"), 'FAIL: publytics.js missing removeSiteFromList guard');
console.log('✅ PASS: publytics.js strictly hides ✕ delete button from non-superadmin users and guards removeSiteFromList');

// 5. Verify admin.html new user modal has publytics checked
const adminHtml = fs.readFileSync(path.join(__dirname, 'public/admin.html'), 'utf8');
assert(adminHtml.includes('class="new-perm-cb" value="publytics" checked'), 'FAIL: admin.html does not check publytics by default');
console.log('✅ PASS: admin.html checks publytics by default for new accounts');

console.log('\n🎉 ALL ADMIN PUBLYTICS & SUPER ADMIN DELETE GUARD TESTS PASSED! 🎉');
