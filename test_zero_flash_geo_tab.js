const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Zero-Flash Geo Tab Protection for Editors...\n');

// 1. Verify admin.html head script
const adminHtml = fs.readFileSync(path.join(__dirname, 'public/admin.html'), 'utf8');
assert(adminHtml.includes('cachedPermissions'), 'admin.html head script must read cachedPermissions');
assert(adminHtml.includes('hide-geo-tab'), 'admin.html head script must support hide-geo-tab class');
assert(adminHtml.includes('has-geo-perm'), 'admin.html head script must support has-geo-perm class');
assert(adminHtml.includes('style.css?v=122'), 'admin.html must link style.css?v=122');
assert(adminHtml.includes('dashboard.js?v=122'), 'admin.html must link dashboard.js?v=122');
console.log('  ✅ PASS: 1. admin.html head script synchronously checks permissions before first paint');

// 2. Verify style.css zero-flash rules
const styleCss = fs.readFileSync(path.join(__dirname, 'public/css/style.css'), 'utf8');
assert(styleCss.includes('html.is-editor:not(.has-geo-perm) .mobile-nav-item[data-tab="tab-geo"]'), 'style.css must target html.is-editor:not(.has-geo-perm) for mobile nav');
assert(styleCss.includes('html.is-editor:not(.has-geo-perm) .tab-btn[data-tab="tab-geo"]'), 'style.css must target html.is-editor:not(.has-geo-perm) for desktop tabs');
assert(styleCss.includes('html.hide-geo-tab .mobile-nav-item[data-tab="tab-geo"]'), 'style.css must target html.hide-geo-tab');
console.log('  ✅ PASS: 2. style.css zero-flash rules instantly hide Geo tab from unpermitted Editors');

// 3. Verify dashboard.js sync & caching
const dashboardJs = fs.readFileSync(path.join(__dirname, 'public/js/dashboard.js'), 'utf8');
assert(dashboardJs.includes("localStorage.setItem('cachedPermissions'"), 'dashboard.js must cache permissions');
assert(dashboardJs.includes("localStorage.removeItem('cachedPermissions'"), 'dashboard.js must clear cached permissions on logout');
assert(dashboardJs.includes("has-geo-perm"), 'dashboard.js must toggle has-geo-perm class');
assert(dashboardJs.includes("hide-geo-tab"), 'dashboard.js must toggle hide-geo-tab class');
console.log('  ✅ PASS: 3. dashboard.js live syncs cached permissions and toggles classes');

// 4. Verify login.js caching
const loginJs = fs.readFileSync(path.join(__dirname, 'public/js/login.js'), 'utf8');
assert(loginJs.includes("localStorage.setItem('cachedPermissions'"), 'login.js must cache permissions on login');
console.log('  ✅ PASS: 4. login.js stores initial permissions to prevent first-load flash');

// 5. Verify sw.js cache name
const swJs = fs.readFileSync(path.join(__dirname, 'public/sw.js'), 'utf8');
assert(swJs.includes('smartlink-v132'), 'sw.js must have smartlink-v132');
console.log('  ✅ PASS: 5. Service worker cache bumped to smartlink-v132');

console.log('\n🎉 ALL ZERO-FLASH VERIFICATIONS PASSED!\n');
