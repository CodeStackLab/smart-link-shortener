const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Verifying Publytics Bearer API Token Pill UI & Toggle Button...\n');

const adminHtml = fs.readFileSync(path.join(__dirname, 'public/admin.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, 'public/css/style.css'), 'utf8');

// 1. Verify two-tone header and key icon in admin.html
assert(adminHtml.includes('class="publytics-token-key-icon"'), 'FAIL: publytics-token-key-icon missing');
assert(adminHtml.includes('class="publytics-token-title-dark">PUBLYTICS</span>'), 'FAIL: dark PUBLYTICS title missing');
assert(adminHtml.includes('class="publytics-token-title-blue">BEARER API TOKEN:</span>'), 'FAIL: blue BEARER API TOKEN: title missing');
console.log('✅ PASS: Two-tone header with glowing key icon verified');

// 2. Verify pill container & input
assert(adminHtml.includes('class="publytics-token-pill-wrap"'), 'FAIL: publytics-token-pill-wrap missing');
assert(adminHtml.includes('id="publytics-settings-api-token"'), 'FAIL: publytics-settings-api-token input missing');
assert(adminHtml.includes('class="publytics-token-divider"'), 'FAIL: publytics-token-divider missing');
console.log('✅ PASS: Pill container, divider, and token input verified');

// 3. Verify single toggle button & SVG icons (no bulky side-by-side Hide/Unhide text buttons)
assert(adminHtml.includes('id="btn-publytics-toggle-token"'), 'FAIL: btn-publytics-toggle-token missing');
assert(!adminHtml.includes('id="btn-publytics-hide-token"'), 'FAIL: old bulky btn-publytics-hide-token still present');
assert(!adminHtml.includes('id="btn-publytics-unhide-token"'), 'FAIL: old bulky btn-publytics-unhide-token still present');
assert(adminHtml.includes('id="publytics-token-eye-slash-icon"'), 'FAIL: eye slash SVG missing');
assert(adminHtml.includes('id="publytics-token-eye-icon"'), 'FAIL: eye open SVG missing');
console.log('✅ PASS: Single toggle button with Eye-Slash / Eye SVGs verified (old side-by-side buttons removed)');

// 4. Verify toggle javascript
assert(adminHtml.includes('window.togglePublyticsTokenVisibility'), 'FAIL: togglePublyticsTokenVisibility missing');
assert(adminHtml.includes('window.setPublyticsTokenVisible'), 'FAIL: setPublyticsTokenVisible missing');
console.log('✅ PASS: Visibility toggle functions verified in admin.html');

// 5. Verify CSS styling in style.css
assert(styleCss.includes('.publytics-token-pill-wrap'), 'FAIL: .publytics-token-pill-wrap CSS missing');
assert(styleCss.includes('.publytics-token-toggle-btn'), 'FAIL: .publytics-token-toggle-btn CSS missing');
assert(styleCss.includes('border-radius: 9999px'), 'FAIL: border-radius: 9999px missing for pill');
assert(styleCss.includes('linear-gradient(135deg, #1e70ff 0%, #0052d9 100%)'), 'FAIL: gradient button CSS missing');
console.log('✅ PASS: Pill styling, 9999px border-radius, and glowing blue gradient button verified in style.css');

console.log('\n🎉 ALL PUBLYTICS TOKEN PILL & TOGGLE TESTS PASSED! 🎉');
