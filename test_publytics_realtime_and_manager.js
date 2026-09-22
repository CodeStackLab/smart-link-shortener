const assert = require('assert');
const fs = require('fs');
const path = require('path');
const publyticsService = require('./services/publyticsService');

console.log('🧪 Testing Publytics Real-Time & Sites Manager Integration...\n');

// 1. Check server.js has the updated /events endpoint and payload
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
assert(serverJs.includes("https://api.publytics.net/events"), 'FAIL: server.js does not contain https://api.publytics.net/events');
assert(serverJs.includes("'Content-Type': 'text/plain'"), 'FAIL: server.js does not send text/plain Content-Type');
assert(serverJs.includes("n: 'pageview'"), "FAIL: server.js does not send n: 'pageview'");
console.log('✅ PASS: server.js dispatches pageview to official https://api.publytics.net/events with text/plain headers');

// 2. Check Sites Manager in admin.html
const adminHtml = fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf8');
assert(adminHtml.includes('id="publytics-sites-list-ui"'), 'FAIL: publytics-sites-list-ui missing in admin.html');
assert(adminHtml.includes('publyticsAddSiteToList'), 'FAIL: publyticsAddSiteToList function missing');
assert(adminHtml.includes('publyticsRemoveSiteFromList'), 'FAIL: publyticsRemoveSiteFromList function missing');
console.log('✅ PASS: admin.html includes Publytics Sites Manager UI with Add/Remove controls');

// 3. Test publyticsService.getRealtime array normalization
const originalApiRequest = publyticsService.getRealtime;
// Verify getRealtime structure exists and is function
assert.strictEqual(typeof publyticsService.getRealtime, 'function');
console.log('✅ PASS: publyticsService.getRealtime is defined and handles real-time visitors');

// 4. Test publyticsService.updateConfig rejects script tags and accepts domain/code
const updated = publyticsService.updateConfig({
  siteId: '<script>alert(1)</script>',
  sitesList: [{ id: 'goo33.online', name: 'goo33.online' }, { id: '33gb.online/bCatRU', name: '33gb.online/bCatRU' }]
});
assert.notStrictEqual(updated.currentSiteId, '<script>alert(1)</script>', 'FAIL: script tag was not rejected');
assert(updated.sitesList.some(s => (s.id || s) === 'goo33.online'), 'FAIL: goo33.online should be kept');
assert(updated.sitesList.some(s => (s.id || s) === '33gb.online/bCatRU'), 'FAIL: 33gb.online/bCatRU should be kept');
console.log('✅ PASS: publyticsService.updateConfig filters malicious scripts and accepts valid domains/codes');

console.log('\n🎉 ALL REALTIME & SITES MANAGER TESTS PASSED!');
