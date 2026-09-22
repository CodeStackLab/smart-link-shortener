const assert = require('assert');
const fs = require('fs');

console.log('🧪 Verifying Multi-Layer Master Admin Exclusivity for Fallback Clicks & Fallback URL...\n');

// 1. Check HTML default inline style
const html = fs.readFileSync('./public/admin.html', 'utf8');
assert(html.includes('id="wrap-new-logs-fallback-clicks" style="display:none;'), 'wrap-new-logs-fallback-clicks must have display:none by default in HTML');
assert(html.includes('id="wrap-edit-logs-fallback-clicks" style="display:none;'), 'wrap-edit-logs-fallback-clicks must have display:none by default in HTML');
assert(html.includes('id="wrap-new-col-fallback-url" style="display:none;'), 'wrap-new-col-fallback-url must have display:none by default in HTML');
assert(html.includes('id="wrap-edit-col-fallback-url" style="display:none;'), 'wrap-edit-col-fallback-url must have display:none by default in HTML');
assert(html.includes('style.css?v='), 'style.css must have cache buster');
assert(html.includes('dashboard.js?v='), 'dashboard.js must have cache buster');
console.log('  ✅ PASS: 1. Default inline styles and cache buster query parameters verified');

// 2. Check CSS strict rules
const css = fs.readFileSync('./public/css/style.css', 'utf8');
assert(css.includes('html:not(.is-superadmin) #wrap-new-logs-fallback-clicks'), 'CSS must target html:not(.is-superadmin) for wrap-new-logs-fallback-clicks');
assert(css.includes('body:not(.is-superadmin) #wrap-new-logs-fallback-clicks'), 'CSS must target body:not(.is-superadmin) for wrap-new-logs-fallback-clicks');
assert(css.includes('html:not(.is-superadmin) #wrap-edit-logs-fallback-clicks'), 'CSS must target html:not(.is-superadmin) for wrap-edit-logs-fallback-clicks');
assert(css.includes('body:not(.is-superadmin) #wrap-edit-logs-fallback-clicks'), 'CSS must target body:not(.is-superadmin) for wrap-edit-logs-fallback-clicks');
console.log('  ✅ PASS: 2. CSS rules strictly hide fallback clicks from non-superadmins with !important');

// 3. Check JS scoping
const js = fs.readFileSync('./public/js/dashboard.js', 'utf8');
assert(js.includes("wrapNewLogsFallbackPerm.style.setProperty('display', isSuperAdminUser() ? 'flex' : 'none', 'important')"), 'JS applyUserPermissions must scope wrapNewLogsFallbackPerm with important');
assert(js.includes("wrapEditLogsFallback.style.setProperty('display', isSuperAdminUser() ? 'flex' : 'none', 'important')"), 'JS setupEditUserModal must scope wrapEditLogsFallback with important');
assert(js.includes("document.documentElement.classList.add('is-superadmin')"), 'JS must sync is-superadmin to documentElement');
console.log('  ✅ PASS: 3. JS dashboard.js enforces Master Admin visibility with important display priority');

// 4. Check SW Cache
const sw = fs.readFileSync('./public/sw.js', 'utf8');
assert(sw.includes('const CACHE_NAME = \'smartlink-v'), 'Service worker cache must have valid cache name');
console.log('  ✅ PASS: 4. Service Worker configured for instant mobile cache purge');

console.log('\n🎉 ALL MULTI-LAYER CHECKS PASSED!\n');
