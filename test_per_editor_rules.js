const assert = require('assert');
const db = require('./db');

console.log('🧪 Starting Per-Editor Facebook Rules & Country Block Unit Tests...\n');

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
// 1. db.js User Methods Test
// ─────────────────────────────────────────────────────────────
test('1. db.addUser properly stores custom fbTrafficSettings and blockedCountries', () => {
  const testUser = {
    id: 'usr_test_editor_1',
    username: 'test_ed_1',
    passwordHash: 'dummy',
    rawPassword: 'pass',
    role: 'Editor',
    permissions: ['facebook'],
    allowedTargetDomains: [],
    fbTrafficSettings: {
      fbTrafficEnabled: true,
      allowFbProfiles: true,
      allowFbGroups: false, // Groups explicitly blocked for this Editor
      allowFbPages: true,
      allowFbStories: false, // Stories explicitly blocked
      blockAutomatedUnknown: true,
      botProtection: true
    },
    blockedCountries: ['US', 'NG', 'EG'],
    countryBlockEnabled: true
  };

  const added = db.addUser(testUser);
  assert.strictEqual(added.fbTrafficSettings.allowFbGroups, false);
  assert.strictEqual(added.fbTrafficSettings.allowFbStories, false);
  assert.deepStrictEqual(added.blockedCountries, ['US', 'NG', 'EG']);
  assert.strictEqual(added.countryBlockEnabled, true);

  // Clean up
  db.deleteUser('usr_test_editor_1');
});

test('2. db.updateUserRole updates fbTrafficSettings and blockedCountries', () => {
  const testUser = {
    id: 'usr_test_editor_2',
    username: 'test_ed_2',
    passwordHash: 'dummy',
    role: 'Editor'
  };
  db.addUser(testUser);

  // Update
  db.updateUserRole(
    'usr_test_editor_2',
    'Editor',
    ['facebook'],
    [],
    {
      fbTrafficEnabled: false, // Master turned OFF for this Editor
      allowFbProfiles: false,
      allowFbGroups: false,
      allowFbPages: false,
      allowFbStories: false,
      blockAutomatedUnknown: true,
      botProtection: true
    },
    ['US', 'PK'],
    false // countryBlockEnabled turned OFF
  );

  const updated = db.getUserByUsername('test_ed_2');
  assert.strictEqual(updated.fbTrafficSettings.fbTrafficEnabled, false);
  assert.strictEqual(updated.fbTrafficSettings.allowFbProfiles, false);
  assert.deepStrictEqual(updated.blockedCountries, ['US', 'PK']);
  assert.strictEqual(updated.countryBlockEnabled, false);

  // Clean up
  db.deleteUser('usr_test_editor_2');
});

// ─────────────────────────────────────────────────────────────
// 2. Redirect Resolution Simulation (Matching server.js logic)
// ─────────────────────────────────────────────────────────────
function resolvePolicyForLink(link, linkCreator, settings) {
  const isEditorLink = linkCreator ? (linkCreator.role === 'Editor') : (link.createdBy && link.createdBy.toLowerCase() !== 'admin');
  const creatorFbSettings = (isEditorLink && linkCreator && linkCreator.fbTrafficSettings) ? linkCreator.fbTrafficSettings : null;
  const enforceGlobal = (settings.applyFirewallGlobally !== false && isEditorLink);

  const fbTrafficEnabled = enforceGlobal
    ? (settings.fbTrafficEnabled !== false)
    : ((link.fbTrafficEnabled !== undefined)
        ? !!link.fbTrafficEnabled
        : (creatorFbSettings && creatorFbSettings.fbTrafficEnabled !== undefined
            ? !!creatorFbSettings.fbTrafficEnabled
            : (settings.fbTrafficEnabled !== false)));

  const allowFbGroups = enforceGlobal
    ? (settings.allowFbGroups !== false)
    : ((link.allowFbGroups !== undefined)
        ? !!link.allowFbGroups
        : (creatorFbSettings && creatorFbSettings.allowFbGroups !== undefined
            ? !!creatorFbSettings.allowFbGroups
            : (settings.allowFbGroups !== false)));

  const allowFbStories = enforceGlobal
    ? (settings.allowFbStories !== false)
    : ((link.allowFbStories !== undefined)
        ? !!link.allowFbStories
        : (creatorFbSettings && creatorFbSettings.allowFbStories !== undefined
            ? !!creatorFbSettings.allowFbStories
            : (settings.allowFbStories !== false)));

  const isEditorCountryBlockOn = (isEditorLink && linkCreator && linkCreator.countryBlockEnabled !== undefined)
    ? !!linkCreator.countryBlockEnabled
    : (settings.editorCountryBlockEnabled !== false);

  const effectiveBlockedCountries = (isEditorLink && linkCreator && Array.isArray(linkCreator.blockedCountries) && linkCreator.blockedCountries.length > 0)
    ? linkCreator.blockedCountries
    : (settings.editorBlockedCountries || []);

  return {
    fbTrafficEnabled,
    allowFbGroups,
    allowFbStories,
    isEditorCountryBlockOn,
    effectiveBlockedCountries
  };
}

test('3. When applyFirewallGlobally is false, Editor A custom rules apply (Groups blocked)', () => {
  const editorA = {
    username: 'editor_a',
    role: 'Editor',
    fbTrafficSettings: {
      fbTrafficEnabled: true,
      allowFbGroups: false, // Blocked
      allowFbStories: true
    },
    blockedCountries: ['US', 'PK']
  };
  const link = { createdBy: 'editor_a' };
  const settings = { applyFirewallGlobally: false, fbTrafficEnabled: true, allowFbGroups: true, editorBlockedCountries: ['BD'] };

  const policy = resolvePolicyForLink(link, editorA, settings);
  assert.strictEqual(policy.allowFbGroups, false, 'Editor A must have Groups blocked when global is disabled');
  assert.strictEqual(policy.fbTrafficEnabled, true);
  assert.deepStrictEqual(policy.effectiveBlockedCountries, ['US', 'PK'], 'Must use Editor A blocked list');
});

test('4. When applyFirewallGlobally is false, Editor B custom rules apply (Groups allowed)', () => {
  const editorB = {
    username: 'editor_b',
    role: 'Editor',
    fbTrafficSettings: {
      fbTrafficEnabled: true,
      allowFbGroups: true, // Allowed
      allowFbStories: true
    },
    blockedCountries: ['IN', 'BD']
  };
  const link = { createdBy: 'editor_b' };
  const settings = { applyFirewallGlobally: false, fbTrafficEnabled: true, allowFbGroups: false, editorBlockedCountries: ['US'] };

  const policy = resolvePolicyForLink(link, editorB, settings);
  assert.strictEqual(policy.allowFbGroups, true, 'Editor B must have Groups allowed when global is disabled');
  assert.deepStrictEqual(policy.effectiveBlockedCountries, ['IN', 'BD'], 'Must use Editor B blocked list');
});

test('5. Admin links are not affected by Editor rules', () => {
  const adminUser = {
    username: 'admin',
    role: 'Admin',
    blockedCountries: ['US', 'PK']
  };
  const link = { createdBy: 'admin' };
  const settings = { applyFirewallGlobally: true, fbTrafficEnabled: true, allowFbGroups: true, editorBlockedCountries: ['US', 'PK', 'IN', 'BD'] };

  const policy = resolvePolicyForLink(link, adminUser, settings);
  assert.strictEqual(policy.fbTrafficEnabled, true);
  assert.strictEqual(policy.allowFbGroups, true);
});

test('6. When applyFirewallGlobally is true (default), Global Rules apply to all Editor links globally', () => {
  const editorB = {
    username: 'editor_b',
    role: 'Editor',
    fbTrafficSettings: {
      fbTrafficEnabled: true,
      allowFbGroups: true, // Local setting is true
      allowFbStories: true
    }
  };
  const link = { createdBy: 'editor_b', fbTrafficEnabled: true, allowFbGroups: true };
  // Global rule has Groups OFF
  const settings = { applyFirewallGlobally: true, fbTrafficEnabled: true, allowFbGroups: false };

  const policy = resolvePolicyForLink(link, editorB, settings);
  assert.strictEqual(policy.allowFbGroups, false, 'Global Facebook rule must override and apply to Editor B link');
});

test('7. When Global Facebook Traffic Master is OFF, all Editor links are blocked globally', () => {
  const editorA = {
    username: 'editor_a',
    role: 'Editor',
    fbTrafficSettings: {
      fbTrafficEnabled: true,
      allowFbGroups: true
    }
  };
  const link = { createdBy: 'editor_a', fbTrafficEnabled: true };
  // Global rule has Master OFF
  const settings = { applyFirewallGlobally: true, fbTrafficEnabled: false, allowFbGroups: true };

  const policy = resolvePolicyForLink(link, editorA, settings);
  assert.strictEqual(policy.fbTrafficEnabled, false, 'Global Master OFF must apply to Editor shortlink');
});

test('8. db.updateAllEditorsFbSettings synchronizes all Editor accounts in database', () => {
  db.updateAllEditorsFbSettings({
    fbTrafficEnabled: true,
    allowFbProfiles: true,
    allowFbGroups: false,
    allowFbPages: false,
    allowFbStories: false,
    blockAutomatedUnknown: true,
    botProtection: true
  });

  const editors = db.getUsers().filter(u => u.role === 'Editor');
  for (const ed of editors) {
    assert.strictEqual(ed.fbTrafficSettings.allowFbGroups, false);
    assert.strictEqual(ed.fbTrafficSettings.allowFbPages, false);
    assert.strictEqual(ed.fbTrafficSettings.allowFbStories, false);
  }

  // Restore
  db.updateAllEditorsFbSettings({
    fbTrafficEnabled: true,
    allowFbProfiles: true,
    allowFbGroups: true,
    allowFbPages: true,
    allowFbStories: true,
    blockAutomatedUnknown: true,
    botProtection: true
  });
});

test('9. db.updateAllEditorLinksFbSettings synchronizes all Editor shortlinks in database', () => {
  db.updateAllEditorLinksFbSettings({
    fbTrafficEnabled: true,
    allowFbProfiles: true,
    allowFbGroups: false,
    allowFbPages: true,
    allowFbStories: true,
    blockAutomatedUnknown: true,
    botProtection: true
  });

  const links = db.getLinks();
  const editorUsernames = new Set(db.getUsers().filter(u => u.role === 'Editor').map(u => u.username.toLowerCase()));
  const editorLinks = links.filter(l => editorUsernames.has((l.createdBy || '').toLowerCase()));
  if (editorLinks.length > 0) {
    for (const el of editorLinks) {
      assert.strictEqual(el.allowFbGroups, false);
    }
  }

  // Restore
  db.updateAllEditorLinksFbSettings({
    fbTrafficEnabled: true,
    allowFbProfiles: true,
    allowFbGroups: true,
    allowFbPages: true,
    allowFbStories: true,
    blockAutomatedUnknown: true,
    botProtection: true
  });
});

test('10. db.updateAllEditorsBlockedCountries synchronizes all Editor accounts blocked countries in database', () => {
  db.updateAllEditorsBlockedCountries(['US', 'PK', 'IN', 'BD', 'EG', 'NG', 'PH', 'TW', 'ID'], true);

  const editors = db.getUsers().filter(u => u.role === 'Editor');
  for (const ed of editors) {
    assert(ed.blockedCountries.includes('ID'), 'Editor must have ID added');
    assert.strictEqual(ed.countryBlockEnabled, true);
  }

  // Restore
  db.updateAllEditorsBlockedCountries(['US', 'PK', 'IN', 'BD', 'EG', 'NG', 'PH', 'TW'], true);
});

console.log(`\n🎉 Results: ${passedTests}/${totalTests} Tests Passed successfully!`);
if (passedTests !== totalTests) process.exit(1);
