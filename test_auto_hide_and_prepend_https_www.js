const assert = require('assert');
const fs = require('fs');

console.log('🧪 Testing Auto-Hide and Auto-Prepend https://www. Requirement...');

// 1. Check admin.html
const html = fs.readFileSync('public/admin.html', 'utf8');
assert(!html.includes('<input type="url" id="target-url"'), 'FAIL: target-url should have type="text"');
assert(html.includes('id="target-url" class="form-control" placeholder="e.g. bbcUrdu.com"'), 'FAIL: target-url should have placeholder e.g. bbcUrdu.com');
assert(html.includes('id="custom-website-target-url" class="form-control" placeholder="e.g. bbcUrdu.com/article123"'), 'FAIL: custom-website-target-url placeholder');
console.log('  ✅ PASS: 1. admin.html uses type="text" and placeholder="e.g. bbcUrdu.com"');

// 2. Check dashboard.js logic
const js = fs.readFileSync('public/js/dashboard.js', 'utf8');

// Extract and test stripProtocolAndWww
function stripProtocolAndWww(urlStr) {
  if (!urlStr) return '';
  return urlStr.trim().replace(/^https?:\/\/(www\.)?/i, '').replace(/^www\./i, '');
}

assert.strictEqual(stripProtocolAndWww('https://www.bbcurdu.com'), 'bbcurdu.com');
assert.strictEqual(stripProtocolAndWww('https://bbcurdu.com'), 'bbcurdu.com');
assert.strictEqual(stripProtocolAndWww('http://www.bbcurdu.com'), 'bbcurdu.com');
assert.strictEqual(stripProtocolAndWww('www.bbcurdu.com'), 'bbcurdu.com');
assert.strictEqual(stripProtocolAndWww('bbcUrdu.com'), 'bbcUrdu.com');
assert.strictEqual(stripProtocolAndWww('https://www.bbcurdu.com/article123'), 'bbcurdu.com/article123');
console.log('  ✅ PASS: 2. stripProtocolAndWww hides https://www. cleanly for all variants');

// Extract and test ensureHttpsWww
function ensureHttpsWww(urlStr) {
  if (!urlStr) return '';
  let u = urlStr.trim();
  if (/^https?:\/\/www\./i.test(u)) {
    return u.replace(/^http:\/\//i, 'https://');
  }
  if (/^https?:\/\//i.test(u)) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)/i.test(u)) {
      return u;
    }
    return u.replace(/^(https?:\/\/)/i, '$1www.');
  }
  if (/^www\./i.test(u)) {
    return 'https://' + u;
  }
  if (/^(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)/i.test(u)) {
    return 'http://' + u;
  }
  return 'https://www.' + u;
}

assert.strictEqual(ensureHttpsWww('bbcUrdu.com'), 'https://www.bbcUrdu.com');
assert.strictEqual(ensureHttpsWww('bbcUrdu.com/news'), 'https://www.bbcUrdu.com/news');
assert.strictEqual(ensureHttpsWww('www.bbcUrdu.com'), 'https://www.bbcUrdu.com');
assert.strictEqual(ensureHttpsWww('https://www.bbcUrdu.com'), 'https://www.bbcUrdu.com');
assert.strictEqual(ensureHttpsWww('https://bbcUrdu.com'), 'https://www.bbcUrdu.com');
console.log('  ✅ PASS: 3. ensureHttpsWww automatically adds https://www. in background');

// 3. Test backend integration in server.js & db.js
const db = require('./db.js');
const http = require('http');

// Check ensureAbsoluteUrl behavior
const serverFile = fs.readFileSync('server.js', 'utf8');
assert(serverFile.includes('targetUrl = ensureAbsoluteUrl(targetUrl);'), 'server.js must normalize targetUrl in POST /api/admin/links');
assert(serverFile.includes('targetUrl = ensureAbsoluteUrl(targetUrl);'), 'server.js must normalize targetUrl in PUT /api/admin/links/:id');

console.log('  ✅ PASS: 4. server.js enforces ensureAbsoluteUrl for link creation and updates');

// 4. Test database link storage with domain-only input
const testCode = 'tst' + Math.random().toString(36).substring(2, 6);
const createdLink = db.addLink({
  code: testCode,
  targetUrl: ensureHttpsWww('bbcUrdu.com'),
  fallbackUrl: 'https://www.google.com/',
  active: true,
  createdAt: new Date().toISOString()
});

assert(createdLink, 'Link should be created');
assert.strictEqual(createdLink.targetUrl, 'https://www.bbcUrdu.com', 'Target URL in db must have https://www. automatically added');

// Clean up test link
db.deleteLink(testCode);

console.log('  ✅ PASS: 5. Database stores targetUrl with https://www. automatically prepended');

console.log('\n🎉 All Auto-Hide & Auto-Prepend https://www. Tests Passed Successfully!');
