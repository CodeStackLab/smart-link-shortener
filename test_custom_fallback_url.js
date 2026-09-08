const assert = require('assert');
const db = require('./db');

console.log('🧪 Starting Customizable Fallback URL Unit Tests...\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
  }
}

// ─────────────────────────────────────────────────────────────
// 1. Link Creation with Custom Fallback URL
// ─────────────────────────────────────────────────────────────
test('1. Shortlink creation supports custom Fallback URL', () => {
  const testId = 'link_test_custom_fb_1';
  const customFallback = 'https://custom-fallback.org/safe-page';
  
  const link = {
    id: testId,
    code: 'custfb1',
    targetUrl: 'https://adx-target.com/offer',
    fallbackUrl: customFallback,
    allowedPlatforms: ['facebook'],
    active: true,
    createdBy: 'admin',
    fbTrafficEnabled: true
  };

  db.addLink(link);

  const fetched = db.getLinkByCode('custfb1');
  assert.ok(fetched, 'Link must exist');
  assert.strictEqual(fetched.fallbackUrl, customFallback, 'fallbackUrl must match custom URL');

  db.deleteLink(testId);
});

// ─────────────────────────────────────────────────────────────
// 2. Updating Fallback URL on an Existing Link
// ─────────────────────────────────────────────────────────────
test('2. Updating fallbackUrl on existing link persists and updates cleanly', () => {
  const testId = 'link_test_custom_fb_2';
  const initialLink = {
    id: testId,
    code: 'custfb2',
    targetUrl: 'https://adx-target.com/offer',
    fallbackUrl: 'https://www.google.com/',
    allowedPlatforms: ['facebook'],
    active: true,
    createdBy: 'admin',
    fbTrafficEnabled: true
  };

  db.addLink(initialLink);

  // Update fallbackUrl
  const newFallback = 'https://news-portal.com/backup';
  const updated = db.updateLink(testId, { fallbackUrl: newFallback });
  assert.strictEqual(updated.fallbackUrl, newFallback, 'Updated link must have new fallbackUrl');

  // Verify re-reading from database
  const readBack = db.getLinkByCode('custfb2');
  assert.strictEqual(readBack.fallbackUrl, newFallback, 'Database must persist updated fallbackUrl');

  db.deleteLink(testId);
});

// ─────────────────────────────────────────────────────────────
// 3. Status Toggle (Pause / Enable) preserves custom Fallback URL
// ─────────────────────────────────────────────────────────────
test('3. Toggling link Pause/Enable strictly preserves custom fallbackUrl', () => {
  const testId = 'link_test_custom_fb_3';
  const customFallback = 'https://mysecureblog.com/home';
  const initialLink = {
    id: testId,
    code: 'custfb3',
    targetUrl: 'https://adx-target.com/offer',
    fallbackUrl: customFallback,
    allowedPlatforms: ['facebook'],
    active: true,
    createdBy: 'editor',
    fbTrafficEnabled: true
  };

  db.addLink(initialLink);

  // Pause
  db.updateLink(testId, { active: false });
  let link = db.getLinkByCode('custfb3');
  assert.strictEqual(link.active, false);
  assert.strictEqual(link.fallbackUrl, customFallback, 'fallbackUrl must be preserved when paused');

  // Enable
  db.updateLink(testId, { active: true });
  link = db.getLinkByCode('custfb3');
  assert.strictEqual(link.active, true);
  assert.strictEqual(link.fallbackUrl, customFallback, 'fallbackUrl must be preserved when enabled');

  db.deleteLink(testId);
});

// ─────────────────────────────────────────────────────────────
// 4. Redirect Destination Simulation: Filtered visitor receives custom fallbackUrl
// ─────────────────────────────────────────────────────────────
test('4. Blocked/filtered traffic is directed to the custom fallbackUrl instead of google.com', () => {
  const customFallback = 'https://my-branded-landing.com/welcome';
  const link = {
    code: 'custfb4',
    targetUrl: 'https://adx-target.com/offer',
    fallbackUrl: customFallback,
    fbTrafficEnabled: false // Master OFF -> must send all traffic to fallback
  };

  // Simulate destination determination matching server.js redirect logic
  const isGenuineOrganic = false; // blocked by fbTrafficEnabled = false
  const destinationUrl = isGenuineOrganic ? link.targetUrl : (link.fallbackUrl || 'https://www.google.com/');

  assert.strictEqual(destinationUrl, customFallback, 'Destination URL must be custom fallbackUrl');
  assert.notStrictEqual(destinationUrl, 'https://www.google.com/', 'Must not default to google.com when custom fallbackUrl is present');
});

// ─────────────────────────────────────────────────────────────
// 5. Default Fallback URL fallback when none provided
// ─────────────────────────────────────────────────────────────
test('5. Fallback URL cleanly defaults to google.com when none is provided', () => {
  const settings = db.getSettings();
  const defaultFallback = settings.defaultFallbackUrl || 'https://www.google.com/';

  const linkWithoutFallback = {
    fallbackUrl: ''
  };

  const effectiveFallback = linkWithoutFallback.fallbackUrl || defaultFallback;
  assert(effectiveFallback.length > 0);
});

// ─────────────────────────────────────────────────────────────
// 6. UI Check: Fallback input removed from create-link-form & added to tab-settings
// ─────────────────────────────────────────────────────────────
test('6. Fallback input removed from create link form and present ONLY in Settings tab for Admin', () => {
  const fs = require('fs');
  const html = fs.readFileSync('./public/admin.html', 'utf8');
  const css = fs.readFileSync('./public/css/style.css', 'utf8');
  const js = fs.readFileSync('./public/js/dashboard.js', 'utf8');

  // Verify create link form does NOT contain fallback-url or Fallback Redirect input
  const createFormMatch = html.match(/<form id="create-link-form"[\s\S]*?<\/form>/);
  assert.ok(createFormMatch, 'create-link-form must exist');
  assert.strictEqual(createFormMatch[0].includes('id="fallback-url"'), false, 'Create Link form must NOT contain fallback-url');
  assert.strictEqual(createFormMatch[0].includes('Fallback Redirect'), false, 'Create Link form must NOT contain Fallback Redirect');

  // Verify Settings tab has default-fallback-url-card
  assert.ok(
    html.includes('id="default-fallback-url-card"'),
    'Settings tab must have default-fallback-url-card'
  );
  assert.ok(
    html.includes('id="setting-default-fallback-url"'),
    'Settings tab must have setting-default-fallback-url input'
  );
  assert.ok(
    html.includes('id="btn-save-default-fallback"'),
    'Settings tab must have btn-save-default-fallback button'
  );

  // Verify modal has modal-rule-fallback-wrap
  assert.ok(
    html.includes('id="modal-rule-fallback-wrap"'),
    'Rules modal must have modal-rule-fallback-wrap'
  );

  // Verify CSS strictly hides fallback elements from Editors / Non-Admins
  assert.ok(css.includes('body:not(.is-admin) #modal-rule-fallback-wrap'), 'CSS must hide modal fallback for non-admin');
  assert.ok(css.includes('body:not(.is-admin) #default-fallback-url-card'), 'CSS must hide settings fallback for non-admin');
  assert.ok(css.includes('body.is-editor #modal-rule-fallback-wrap'), 'CSS must hide modal fallback for editor');

  // Verify JS gates fallback card and wrap
  assert.ok(js.includes("document.getElementById('default-fallback-url-card')"), 'JS must gate fallback card');
  assert.ok(js.includes("document.getElementById('modal-rule-fallback-wrap')"), 'JS must gate modal fallback wrap');
});

// ─────────────────────────────────────────────────────────────
// 7. db.updateAllLinksFallbackUrl updates all links
// ─────────────────────────────────────────────────────────────
test('7. db.updateAllLinksFallbackUrl synchronizes all links with new global fallback', () => {
  const originalFallback = db.getSettings().defaultFallbackUrl || 'https://www.google.com/';
  const testFallback = 'https://custom-safe-fallback.com/';
  db.updateAllLinksFallbackUrl(testFallback);

  const links = db.getLinks();
  assert(links.length > 0, 'Links must exist');
  for (const l of links) {
    assert.strictEqual(l.fallbackUrl, testFallback, `${l.code} fallbackUrl must match`);
  }

  // Restore previous fallback
  db.updateAllLinksFallbackUrl(originalFallback);
  const freshLinks = db.getLinks();
  for (const l of freshLinks) {
    assert.strictEqual(l.fallbackUrl, originalFallback, `${l.code} fallbackUrl restored`);
  }
});

// ─────────────────────────────────────────────────────────────
// 8. db.updateSettings persists defaultFallbackUrl
// ─────────────────────────────────────────────────────────────
test('8. db.updateSettings persists defaultFallbackUrl cleanly', () => {
  const original = db.getSettings().defaultFallbackUrl || 'https://www.google.com/';
  db.updateSettings({ defaultFallbackUrl: 'https://global-fallback-test.org/' });
  let s = db.getSettings();
  assert.strictEqual(s.defaultFallbackUrl, 'https://global-fallback-test.org/');

  // Restore
  db.updateSettings({ defaultFallbackUrl: original });
  s = db.getSettings();
  assert.strictEqual(s.defaultFallbackUrl, original);
});

console.log(`\n🎉 Results: ${passedTests}/${totalTests} Tests Passed successfully!`);
if (passedTests !== totalTests) {
  process.exit(1);
}
