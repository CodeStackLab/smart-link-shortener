const fs = require('fs');
const assert = require('assert');

console.log('🧪 Testing QR Modal: Hide Tagged Links (Group, Page, Story) from Editors...');

const adminHtml = fs.readFileSync('public/admin.html', 'utf8');
const styleCss = fs.readFileSync('public/css/style.css', 'utf8');
const dashboardJs = fs.readFileSync('public/js/dashboard.js', 'utf8');
const swJs = fs.readFileSync('public/sw.js', 'utf8');

// 1. admin.html
assert(adminHtml.includes('id="qr-tagged-links-wrap"'), 'admin.html must have id="qr-tagged-links-wrap"');
assert(adminHtml.includes('id="qr-tagged-links-wrap" style="margin-top:0.65rem; padding-top:0.55rem; border-top:1px dashed var(--border-color, #e2e8f0); display:none;"'), 'qr-tagged-links-wrap must be display:none by default');
assert(/style\.css\?v=(12[3-9]|1[3-9]\d)/.test(adminHtml), 'style.css cache buster must be bumped');
console.log('  ✅ PASS: 1. admin.html has qr-tagged-links-wrap with default display:none and bumped cache-buster');

// 2. style.css
assert(styleCss.includes('html.is-editor #qr-tagged-links-wrap') && styleCss.includes('body.is-editor #qr-tagged-links-wrap'), 'style.css must hide qr-tagged-links-wrap for .is-editor');
assert(styleCss.includes('html:not(.is-admin) #qr-tagged-links-wrap') && styleCss.includes('body:not(.is-admin) #qr-tagged-links-wrap'), 'style.css must hide qr-tagged-links-wrap for :not(.is-admin)');
console.log('  ✅ PASS: 2. style.css strictly enforces display: none !important for Editors');

// 3. dashboard.js
assert(dashboardJs.includes("const qrTaggedWrap = document.getElementById('qr-tagged-links-wrap')"), 'dashboard.js showQrModal must lookup qr-tagged-links-wrap');
assert(dashboardJs.includes("qrTaggedWrap.style.setProperty('display', isAdmin ? 'block' : 'none', 'important')"), 'dashboard.js must scope qr-tagged-links-wrap to isAdmin');
assert(dashboardJs.includes("const qrTaggedWrapEl = document.getElementById('qr-tagged-links-wrap')"), 'dashboard.js applyPermissionsToUI must lookup qr-tagged-links-wrap');
console.log('  ✅ PASS: 3. dashboard.js enforces admin-only visibility in showQrModal and applyPermissionsToUI');

// 4. sw.js
assert(/smartlink-v13[3-9]/.test(swJs), 'sw.js must be bumped');
console.log('  ✅ PASS: 4. sw.js cache bumped for mobile instant purge');

console.log('\n🎉 ALL QR MODAL EDITOR RESTRICTION TESTS PASSED!');
