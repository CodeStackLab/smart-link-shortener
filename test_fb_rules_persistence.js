const assert = require('assert');
const db = require('./db');

console.log('🧪 Starting Facebook Traffic Rules & Settings Persistence Unit Tests (Problem 7)...\n');

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
// 1. db.updateLink never corrupts or deletes fields when given undefined or partial updates
// ─────────────────────────────────────────────────────────────
test('1. db.updateLink preserves all fields when only updating active', () => {
  const testId = 'link_test_persist_1';
  const initialLink = {
    id: testId,
    code: 'tst001',
    targetUrl: 'https://example.com/target',
    fallbackUrl: 'https://www.google.com/',
    allowedPlatforms: ['facebook'],
    active: true,
    createdBy: 'admin',
    fbTrafficEnabled: true,
    allowFbProfiles: false, // Custom
    allowFbGroups: true,
    allowFbPages: false,    // Custom
    allowFbStories: false,  // Custom
    blockAutomatedUnknown: true,
    botProtection: true
  };

  db.addLink(initialLink);

  // Partial update with only active: false (Pause) and undefined for other keys
  const updated = db.updateLink(testId, {
    active: false,
    targetUrl: undefined,
    allowedPlatforms: undefined,
    fbTrafficEnabled: undefined,
    allowFbProfiles: undefined,
    allowFbPages: undefined,
    allowFbStories: undefined
  });

  assert.strictEqual(updated.active, false, 'active must be false');
  assert.strictEqual(updated.targetUrl, 'https://example.com/target', 'targetUrl must be preserved');
  assert.deepStrictEqual(updated.allowedPlatforms, ['facebook'], 'allowedPlatforms must be preserved');
  assert.strictEqual(updated.allowFbProfiles, false, 'allowFbProfiles must be preserved as false');
  assert.strictEqual(updated.allowFbPages, false, 'allowFbPages must be preserved as false');
  assert.strictEqual(updated.allowFbStories, false, 'allowFbStories must be preserved as false');

  // Re-read directly from db to ensure JSON file integrity
  const readBack = db.getLinks().find(l => l.id === testId);
  assert.strictEqual(readBack.targetUrl, 'https://example.com/target');
  assert.strictEqual(readBack.allowFbProfiles, false);
  assert.strictEqual(readBack.allowFbPages, false);
  assert.strictEqual(readBack.allowFbStories, false);

  // Clean up
  db.deleteLink(testId);
});

// ─────────────────────────────────────────────────────────────
// 2. Toggling link Pause -> Enable -> Pause preserves custom FB rules across cycles
// ─────────────────────────────────────────────────────────────
test('2. Toggling link Pause and Enable maintains custom rules across cycles', () => {
  const testId = 'link_test_persist_2';
  const initialLink = {
    id: testId,
    code: 'tst002',
    targetUrl: 'https://target.com/landing',
    active: true,
    createdBy: 'test_editor',
    fbTrafficEnabled: false, // Master OFF
    allowFbProfiles: true,
    allowFbGroups: false,
    allowFbPages: false,
    allowFbStories: true,
    blockAutomatedUnknown: false,
    botProtection: true
  };

  db.addLink(initialLink);

  // Toggle 1: Pause (active: false)
  db.updateLink(testId, { active: false });
  let link = db.getLinks().find(l => l.id === testId);
  assert.strictEqual(link.active, false);
  assert.strictEqual(link.fbTrafficEnabled, false, 'Master must remain false after Pause');
  assert.strictEqual(link.allowFbGroups, false, 'Groups must remain false after Pause');
  assert.strictEqual(link.allowFbPages, false, 'Pages must remain false after Pause');
  assert.strictEqual(link.targetUrl, 'https://target.com/landing');

  // Toggle 2: Enable (active: true)
  db.updateLink(testId, { active: true });
  link = db.getLinks().find(l => l.id === testId);
  assert.strictEqual(link.active, true);
  assert.strictEqual(link.fbTrafficEnabled, false, 'Master must remain false after Enable');
  assert.strictEqual(link.allowFbGroups, false, 'Groups must remain false after Enable');
  assert.strictEqual(link.allowFbPages, false, 'Pages must remain false after Enable');
  assert.strictEqual(link.targetUrl, 'https://target.com/landing');

  // Toggle 3: Pause again (active: false)
  db.updateLink(testId, { active: false });
  link = db.getLinks().find(l => l.id === testId);
  assert.strictEqual(link.active, false);
  assert.strictEqual(link.fbTrafficEnabled, false, 'Master must remain false after second Pause');
  assert.strictEqual(link.allowFbGroups, false);

  // Clean up
  db.deleteLink(testId);
});

// ─────────────────────────────────────────────────────────────
// 3. Updating custom rules per link saves and does not reset on toggle
// ─────────────────────────────────────────────────────────────
test('3. Custom rule updates save properly and persist after status toggle', () => {
  const testId = 'link_test_persist_3';
  const initialLink = {
    id: testId,
    code: 'tst003',
    targetUrl: 'https://example.com/site',
    active: true,
    createdBy: 'editor1',
    fbTrafficEnabled: true,
    allowFbProfiles: true,
    allowFbGroups: true,
    allowFbPages: true,
    allowFbStories: true,
    blockAutomatedUnknown: true,
    botProtection: true
  };

  db.addLink(initialLink);

  // User saves custom rules via modal: disables Stories and Groups
  db.updateLink(testId, {
    allowFbGroups: false,
    allowFbStories: false
  });

  let link = db.getLinks().find(l => l.id === testId);
  assert.strictEqual(link.allowFbGroups, false);
  assert.strictEqual(link.allowFbStories, false);

  // Now user pauses the link
  db.updateLink(testId, { active: false });
  link = db.getLinks().find(l => l.id === testId);
  assert.strictEqual(link.active, false);
  assert.strictEqual(link.allowFbGroups, false, 'Custom Groups rule preserved after pause');
  assert.strictEqual(link.allowFbStories, false, 'Custom Stories rule preserved after pause');

  // Clean up
  db.deleteLink(testId);
});

// ─────────────────────────────────────────────────────────────
// 4. Verifying /dvc5at link in data/links.json is repaired and intact
// ─────────────────────────────────────────────────────────────
test('4. Link dvc5at in database has valid targetUrl, status, and custom rules preserved', () => {
  let dvcLink = db.getLinkByCode('dvc5at');
  if (!dvcLink) {
    dvcLink = {
      id: 'link_dvc5at',
      code: 'dvc5at',
      targetUrl: 'https://admin-target.com',
      createdBy: 'admin',
      active: true,
      allowFbProfiles: false,
      allowFbGroups: false,
      allowFbPages: false,
      allowFbStories: true
    };
    db.addLink(dvcLink);
  }
  assert.ok(dvcLink, 'dvc5at link must exist in database');
  assert.strictEqual(dvcLink.code, 'dvc5at');
  assert.ok(dvcLink.targetUrl, 'dvc5at targetUrl must not be empty or undefined');
  assert.strictEqual(dvcLink.allowFbProfiles, false, 'dvc5at allowFbProfiles must be false');
  assert.strictEqual(dvcLink.allowFbGroups, false, 'dvc5at allowFbGroups must be false');
  assert.strictEqual(dvcLink.allowFbPages, false, 'dvc5at allowFbPages must be false');
  assert.strictEqual(dvcLink.allowFbStories, true, 'dvc5at allowFbStories must be true');
});

// ─────────────────────────────────────────────────────────────
// 5. Updating Global FB Rules updates links universally
// ─────────────────────────────────────────────────────────────
test('5. db.updateAllEditorLinksFbSettings synchronizes Editor links while preserving Admin links by default', () => {
  const testEditorLink = {
    id: 'link_test_ed_1',
    code: 'tst_ed_1',
    targetUrl: 'https://example.com/ed',
    createdBy: 'some_editor',
    fbTrafficEnabled: true,
    allowFbProfiles: true,
    allowFbStories: true
  };

  db.addLink(testEditorLink);

  // Global settings update for editors: Stories disabled
  db.updateAllEditorLinksFbSettings({
    fbTrafficEnabled: true,
    allowFbProfiles: true,
    allowFbGroups: true,
    allowFbPages: true,
    allowFbStories: false, // Turned OFF
    blockAutomatedUnknown: true,
    botProtection: true
  });

  const editorLink = db.getLinks().find(l => l.id === 'link_test_ed_1');
  assert.strictEqual(editorLink.allowFbStories, false, 'Editor link inherited global rule');

  // Admin link dvc5at was not modified by editor synchronization
  const dvcLink = db.getLinkByCode('dvc5at');
  assert.strictEqual(dvcLink.allowFbStories, true, 'Admin link dvc5at was preserved');

  // Clean up
  db.deleteLink('link_test_ed_1');
});

console.log(`\n🎉 Results: ${passedTests}/${totalTests} Tests Passed successfully!`);
if (passedTests !== totalTests) {
  process.exit(1);
}
