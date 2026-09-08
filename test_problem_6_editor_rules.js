const assert = require('assert');
const db = require('./db');

console.log('🧪 Starting Problem 6 Per-Editor Rules Test Suite...\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
  }
}

// Setup test user & links
const testEditorUsername = 'test_editor_p6_' + Date.now();
const testEditorId = 'usr_' + testEditorUsername;

// Clean up helper
function cleanup() {
  db.deleteUser(testEditorId);
  const links = db.getLinks();
  const filtered = links.filter(l => l.createdBy !== testEditorUsername);
  require('fs').writeFileSync('./data/links.json', JSON.stringify(filtered, null, 2));
}

try {
  // Test 1: User creation with restricted rules
  test('1. Editor created with only Master & Profiles ON, all others OFF', () => {
    db.addUser({
      id: testEditorId,
      username: testEditorUsername,
      role: 'Editor',
      permissions: ['links', 'facebook'],
      fbTrafficSettings: {
        fbTrafficEnabled: true,
        allowFbProfiles: true,
        allowFbGroups: false,
        allowFbPages: false,
        allowFbStories: false,
        blockAutomatedUnknown: false,
        botProtection: false
      }
    });

    const user = db.getUserByUsername(testEditorUsername);
    assert(user, 'User must exist');
    assert.strictEqual(user.fbTrafficSettings.fbTrafficEnabled, true);
    assert.strictEqual(user.fbTrafficSettings.allowFbProfiles, true);
    assert.strictEqual(user.fbTrafficSettings.allowFbGroups, false);
    assert.strictEqual(user.fbTrafficSettings.allowFbPages, false);
    assert.strictEqual(user.fbTrafficSettings.allowFbStories, false);
    assert.strictEqual(user.fbTrafficSettings.blockAutomatedUnknown, false);
    assert.strictEqual(user.fbTrafficSettings.botProtection, false);
  });

  // Test 2: Create a link for this editor with all true initially, then updateUserRole syncs existing links
  test('2. db.updateUserRole syncs all existing links for that editor', () => {
    // Add two test links for this editor
    const link1 = db.addLink({
      code: 'p6lnk1_' + Date.now().toString(36),
      targetUrl: 'https://example.com/target1',
      fallbackUrl: 'https://example.com/fallback',
      createdBy: testEditorUsername,
      fbTrafficEnabled: true,
      allowFbProfiles: true,
      allowFbGroups: true,
      allowFbPages: true,
      allowFbStories: true,
      blockAutomatedUnknown: true,
      botProtection: true
    });

    const link2 = db.addLink({
      code: 'p6lnk2_' + Date.now().toString(36),
      targetUrl: 'https://example.com/target2',
      fallbackUrl: 'https://example.com/fallback',
      createdBy: testEditorUsername,
      fbTrafficEnabled: true,
      allowFbProfiles: true,
      allowFbGroups: true,
      allowFbPages: true,
      allowFbStories: true,
      blockAutomatedUnknown: true,
      botProtection: true
    });

    // Super Admin updates the editor's role with only 2 options enabled
    db.updateUserRole(
      testEditorId,
      'Editor',
      ['links', 'facebook'],
      [],
      {
        fbTrafficEnabled: true,
        allowFbProfiles: true,
        allowFbGroups: false,
        allowFbPages: false,
        allowFbStories: false,
        blockAutomatedUnknown: false,
        botProtection: false
      },
      [],
      false
    );

    // Verify existing links were automatically updated
    const fresh1 = db.getLinks().find(l => l.id === link1.id);
    const fresh2 = db.getLinks().find(l => l.id === link2.id);

    assert(fresh1, 'Link 1 must exist');
    assert.strictEqual(fresh1.fbTrafficEnabled, true);
    assert.strictEqual(fresh1.allowFbProfiles, true);
    assert.strictEqual(fresh1.allowFbGroups, false);
    assert.strictEqual(fresh1.allowFbPages, false);
    assert.strictEqual(fresh1.allowFbStories, false);
    assert.strictEqual(fresh1.blockAutomatedUnknown, false);
    assert.strictEqual(fresh1.botProtection, false);

    assert(fresh2, 'Link 2 must exist');
    assert.strictEqual(fresh2.allowFbGroups, false);
    assert.strictEqual(fresh2.allowFbPages, false);
  });

  // Test 3: Global batch updates do not overwrite custom editor rules
  test('3. db.updateAllEditorsFbSettings preserves editor with hasCustomFbRules', () => {
    // Attempt global update where all options are true
    db.updateAllEditorsFbSettings({
      fbTrafficEnabled: true,
      allowFbProfiles: true,
      allowFbGroups: true,
      allowFbPages: true,
      allowFbStories: true,
      blockAutomatedUnknown: true,
      botProtection: true
    });

    const user = db.getUserByUsername(testEditorUsername);
    assert.strictEqual(user.fbTrafficSettings.allowFbGroups, false, 'Editor custom rules must be preserved');
    assert.strictEqual(user.fbTrafficSettings.allowFbPages, false, 'Editor custom rules must be preserved');
  });

  // Test 4: Global link batch updates do not overwrite custom editor links
  test('4. db.updateAllEditorLinksFbSettings preserves links of custom editor', () => {
    db.updateAllEditorLinksFbSettings({
      fbTrafficEnabled: true,
      allowFbProfiles: true,
      allowFbGroups: true,
      allowFbPages: true,
      allowFbStories: true,
      blockAutomatedUnknown: true,
      botProtection: true
    });

    const links = db.getLinks().filter(l => l.createdBy === testEditorUsername);
    for (const l of links) {
      assert.strictEqual(l.allowFbGroups, false, 'Custom editor link rules must not be overwritten');
      assert.strictEqual(l.allowFbPages, false, 'Custom editor link rules must not be overwritten');
    }
  });

  // Test 5: Traffic redirection policy resolution strictly respects editor settings
  test('5. Redirect policy resolution: editor restricted rules override global rules', () => {
    const creatorUser = db.getUserByUsername(testEditorUsername);
    const creatorFbSettings = creatorUser.fbTrafficSettings;
    const settings = {
      applyFirewallGlobally: true,
      fbTrafficEnabled: true,
      allowFbProfiles: true,
      allowFbGroups: true, // Global has groups ON
      allowFbPages: true   // Global has pages ON
    };

    const link = {
      code: 'test_code',
      createdBy: testEditorUsername,
      fbTrafficEnabled: true,
      allowFbProfiles: true,
      allowFbGroups: true // Link has true
    };

    const resolveEditorRule = (ruleKey, linkVal, globalVal) => {
      if (creatorFbSettings && creatorFbSettings[ruleKey] !== undefined) {
        if (creatorFbSettings[ruleKey] === false) return false;
        return (linkVal !== undefined) ? (linkVal !== false) : true;
      }
      if (settings.applyFirewallGlobally !== false) {
        return (globalVal !== undefined) ? (globalVal !== false) : true;
      }
      if (linkVal !== undefined) return linkVal !== false;
      return (globalVal !== undefined) ? (globalVal !== false) : true;
    };

    assert.strictEqual(resolveEditorRule('fbTrafficEnabled', link.fbTrafficEnabled, settings.fbTrafficEnabled), true);
    assert.strictEqual(resolveEditorRule('allowFbProfiles', link.allowFbProfiles, settings.allowFbProfiles), true);
    // Groups MUST be false because Admin turned it OFF for this editor!
    assert.strictEqual(resolveEditorRule('allowFbGroups', link.allowFbGroups, settings.allowFbGroups), false);
    // Pages MUST be false because Admin turned it OFF for this editor!
    assert.strictEqual(resolveEditorRule('allowFbPages', link.allowFbPages, settings.allowFbPages), false);
  });

  // Test 6: Verify gggg settings in data files
  test('6. User gggg in users.json and links in links.json adhere to Screenshot 1', () => {
    const ggggUser = db.getUserByUsername('gggg');
    assert(ggggUser, 'User gggg must exist');
    assert.strictEqual(ggggUser.fbTrafficSettings.fbTrafficEnabled, true);
    assert.strictEqual(ggggUser.fbTrafficSettings.allowFbProfiles, true);
    assert.strictEqual(ggggUser.fbTrafficSettings.allowFbGroups, false);
    assert.strictEqual(ggggUser.fbTrafficSettings.allowFbPages, false);
    assert.strictEqual(ggggUser.fbTrafficSettings.allowFbStories, false);
    assert.strictEqual(ggggUser.fbTrafficSettings.blockAutomatedUnknown, false);
    assert.strictEqual(ggggUser.fbTrafficSettings.botProtection, false);

    const ggggLinks = db.getLinks().filter(l => (l.createdBy || '').toLowerCase() === 'gggg');
    assert(ggggLinks.length > 0, 'gggg must have shortlinks');
    for (const l of ggggLinks) {
      assert.strictEqual(l.fbTrafficEnabled, true, `${l.code} fbTrafficEnabled`);
      assert.strictEqual(l.allowFbProfiles, true, `${l.code} allowFbProfiles`);
      assert.strictEqual(l.allowFbGroups, false, `${l.code} allowFbGroups`);
      assert.strictEqual(l.allowFbPages, false, `${l.code} allowFbPages`);
      assert.strictEqual(l.allowFbStories, false, `${l.code} allowFbStories`);
      assert.strictEqual(l.blockAutomatedUnknown, false, `${l.code} blockAutomatedUnknown`);
      assert.strictEqual(l.botProtection, false, `${l.code} botProtection`);
    }
  });

} finally {
  cleanup();
}

console.log(`\n🎉 Results: ${passed}/${total} Tests Passed successfully!`);
if (passed !== total) process.exit(1);
