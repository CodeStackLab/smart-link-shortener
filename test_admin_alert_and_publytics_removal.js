const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('🧪 Starting Admin Alert & Publytics Removal Verification...\n');

// 1. Static code assertions
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(__dirname, 'public/admin.html'), 'utf8');
const publyticsJs = fs.readFileSync(path.join(__dirname, 'public/js/publytics.js'), 'utf8');
const publyticsCss = fs.readFileSync(path.join(__dirname, 'public/css/publytics.css'), 'utf8');
const settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/settings.json'), 'utf8'));

// Check 1: No api.publytics.net calls in server.js
console.log('1. Checking removal of slow outbound Publytics API calls:');
assert(!serverJs.includes('https://api.publytics.net/events'), 'FAIL: api.publytics.net/events still found in server.js');
console.log('   ✅ PASS: Zero outbound fetch calls to api.publytics.net in server.js');

// Check 2: Admin alert in settings.json
console.log('\n2. Checking settings.json default admin alert:');
assert(settings.adminAlertMessage !== undefined, 'FAIL: settings.adminAlertMessage missing');
console.log('   ✅ PASS: adminAlertMessage stored in settings.json (current: "' + settings.adminAlertMessage + '")');

// Check 3: Admin alert elements in admin.html
console.log('\n3. Checking Admin Alert UI cards in admin.html:');
assert(adminHtml.includes('id="admin-alert-display-card"'), 'FAIL: admin-alert-display-card missing');
assert(adminHtml.includes('id="official-publytics-login-card"'), 'FAIL: official-publytics-login-card missing');
assert(adminHtml.includes('id="admin-alert-settings-card"'), 'FAIL: admin-alert-settings-card missing');
assert(adminHtml.includes('id="official-publytics-creds-card"'), 'FAIL: official-publytics-creds-card missing');
assert(adminHtml.includes('data-tab="tab-publytics"'), 'FAIL: bottom nav tab-publytics icon missing');
console.log('   ✅ PASS: Admin Alert card, Official Login card, and Settings edit card all present in admin.html');

// Check 4: CSS styling for glowing Admin Alert card
console.log('\n4. Checking CSS styling for Admin Alert card:');
assert(publyticsCss.includes('.admin-alert-card'), 'FAIL: .admin-alert-card CSS missing');
assert(publyticsCss.includes('.admin-alert-inner'), 'FAIL: .admin-alert-inner CSS missing');
assert(publyticsCss.includes('.admin-alert-body'), 'FAIL: .admin-alert-body CSS missing');
console.log('   ✅ PASS: Custom neon blue cyber styles configured for Admin Alert card');

// Check 5: Lightweight publytics.js
console.log('\n5. Checking publytics.js size and implementation:');
const pubJsLines = publyticsJs.split('\n').length;
console.log(`   publytics.js lines: ${pubJsLines} (was 1,442 lines)`);
assert(pubJsLines < 120, 'FAIL: publytics.js should be lightweight (< 120 lines)');
assert(publyticsJs.includes('/api/admin-alert'), 'FAIL: publytics.js should fetch /api/admin-alert');
assert(publyticsJs.includes('/api/publytics/credentials'), 'FAIL: publytics.js should fetch /api/publytics/credentials');
assert(publyticsJs.includes('copyPubCredential'), 'FAIL: publytics.js should define copyPubCredential');
console.log('   ✅ PASS: publytics.js is ultra-lightweight and clean');

console.log('\n🎉 ALL ADMIN ALERT & PUBLYTICS REMOVAL STATIC TESTS PASSED! 🎉\n');
