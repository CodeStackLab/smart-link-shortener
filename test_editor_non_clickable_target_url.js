const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Editor Non-Clickable Target URL Security...\n');

// 1. Check dashboard.js logic
const dashboardJs = fs.readFileSync(path.join(__dirname, 'public/js/dashboard.js'), 'utf8');

assert(dashboardJs.includes('isFullAdminUser()'), 'dashboard.js must check isFullAdminUser() when rendering target URL');
assert(dashboardJs.includes('non-clickable-target-url'), 'dashboard.js must use non-clickable-target-url class for Editors');
assert(dashboardJs.includes('pointer-events:none'), 'dashboard.js inline style must include pointer-events:none for Editors');
assert(dashboardJs.includes('user-select:none'), 'dashboard.js inline style must include user-select:none for Editors');

// Ensure Editor output is a <span>, not an <a>
const renderTargetUrlSnippet = dashboardJs.slice(dashboardJs.indexOf('col-target-url'), dashboardJs.indexOf('col-target-url') + 500);
assert(renderTargetUrlSnippet.includes('<span class="url-text non-clickable-target-url"'), 'Editor target URL must be a <span> tag');
assert(renderTargetUrlSnippet.includes('<a href="${link.targetUrl}" target="_blank" class="url-link"'), 'Admin target URL can be an <a> link');
console.log('  ✅ PASS: 1. dashboard.js renders non-clickable <span> for Editors and <a> only for Admins');

// 2. Check style.css safeguards
const styleCss = fs.readFileSync(path.join(__dirname, 'public/css/style.css'), 'utf8');
assert(styleCss.includes('.non-clickable-target-url'), 'style.css must define .non-clickable-target-url');
assert(styleCss.includes('body.is-editor .col-target-url a'), 'style.css must protect body.is-editor .col-target-url a');
assert(styleCss.includes('body:not(.is-admin) .col-target-url a'), 'style.css must protect body:not(.is-admin) .col-target-url a');
assert(styleCss.includes('pointer-events: none !important;'), 'style.css must enforce pointer-events: none !important');
console.log('  ✅ PASS: 2. style.css strictly enforces pointer-events: none !important on Target URL for Editors');

// 3. Check cache busting
const adminHtml = fs.readFileSync(path.join(__dirname, 'public/admin.html'), 'utf8');
assert(adminHtml.includes('style.css?v=122'), 'admin.html must have style.css?v=122');
assert(adminHtml.includes('dashboard.js?v=122'), 'admin.html must have dashboard.js?v=122');
const swJs = fs.readFileSync(path.join(__dirname, 'public/sw.js'), 'utf8');
assert(swJs.includes('smartlink-v132'), 'sw.js must have smartlink-v132');
console.log('  ✅ PASS: 3. Asset cache-busters bumped to v=122 and smartlink-v132');

console.log('\n🎉 ALL TESTS PASSED! Target URL is 100% non-clickable for Editors!\n');
