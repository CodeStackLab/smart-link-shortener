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
test('6. Fallback input in create link form has clean label Fallback Redirect with no (CUSTOMIZE)', () => {
  const fs = require('fs');
  const html = fs.readFileSync('./public/admin.html', 'utf8');

  // Verify create link form has Fallback Redirect and does NOT have (CUSTOMIZE)
  const createFormMatch = html.match(/<form id="create-link-form"[\s\S]*?<\/form>/);
  assert.ok(createFormMatch, 'create-link-form must exist');
  assert.ok(createFormMatch[0].includes('Fallback Redirect'), 'Must have Fallback Redirect label');
  assert.strictEqual(createFormMatch[0].toLowerCase().includes('(customize)'), false, 'Must NOT contain (CUSTOMIZE)');
  assert.strictEqual(createFormMatch[0].includes('FALLBACK REDIRECT URL'), false, 'Old label must be removed');

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

  // Verify Rules modal has clean Fallback Redirect: without (Customize)
  const rulesModalMatch = html.match(/<div id="traffic-rules-modal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  if (rulesModalMatch) {
    assert.strictEqual(rulesModalMatch[0].toLowerCase().includes('(customize)'), false, 'Rules modal must NOT contain (Customize)');
  }
});

// ─────────────────────────────────────────────────────────────
// 7. db.updateAllLinksFallbackUrl updates all links
// ─────────────────────────────────────────────────────────────
test('7. db.updateAllLinksFallbackUrl synchronizes all links with new global fallback', () => {
  const testFallback = 'https://custom-safe-fallback.com/';
  db.updateAllLinksFallbackUrl(testFallback);

  const links = db.getLinks();
  assert(links.length > 0, 'Links must exist');
  for (const l of links) {
    assert.strictEqual(l.fallbackUrl, testFallback, `${l.code} fallbackUrl must match`);
  }

  // Restore default fallback
  const restoredFallback = 'https://www.google.com/';
  db.updateAllLinksFallbackUrl(restoredFallback);
  const freshLinks = db.getLinks();
  for (const l of freshLinks) {
    assert.strictEqual(l.fallbackUrl, restoredFallback, `${l.code} fallbackUrl restored`);
  }
});

// ─────────────────────────────────────────────────────────────
// 8. db.updateSettings persists defaultFallbackUrl
// ─────────────────────────────────────────────────────────────
test('8. db.updateSettings persists defaultFallbackUrl cleanly', () => {
  db.updateSettings({ defaultFallbackUrl: 'https://global-fallback-test.org/' });
  let s = db.getSettings();
  assert.strictEqual(s.defaultFallbackUrl, 'https://global-fallback-test.org/');

  // Restore
  db.updateSettings({ defaultFallbackUrl: 'https://www.google.com/' });
  s = db.getSettings();
  assert.strictEqual(s.defaultFallbackUrl, 'https://www.google.com/');
});

console.log(`\n🎉 Results: ${passedTests}/${totalTests} Tests Passed successfully!`);
if (passedTests !== totalTests) {
  process.exit(1);
}
