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

  const fbTrafficEnabled = (link.fbTrafficEnabled !== undefined)
    ? !!link.fbTrafficEnabled
    : (creatorFbSettings && creatorFbSettings.fbTrafficEnabled !== undefined
        ? !!creatorFbSettings.fbTrafficEnabled
        : (settings.fbTrafficEnabled !== false));

  const allowFbGroups = (link.allowFbGroups !== undefined)
    ? !!link.allowFbGroups
    : (creatorFbSettings && creatorFbSettings.allowFbGroups !== undefined
        ? !!creatorFbSettings.allowFbGroups
        : (settings.allowFbGroups !== false));

  const allowFbStories = (link.allowFbStories !== undefined)
    ? !!link.allowFbStories
    : (creatorFbSettings && creatorFbSettings.allowFbStories !== undefined
        ? !!creatorFbSettings.allowFbStories
        : (settings.allowFbStories !== false));

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

test('3. Editor A with Groups OFF has groups blocked on their shortlinks', () => {
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
  const link = { createdBy: 'editor_a' }; // no direct link overrides
  const settings = { fbTrafficEnabled: true, allowFbGroups: true, editorBlockedCountries: ['BD'] };

  const policy = resolvePolicyForLink(link, editorA, settings);
  assert.strictEqual(policy.allowFbGroups, false, 'Editor A must have Groups blocked');
  assert.strictEqual(policy.fbTrafficEnabled, true);
  assert.deepStrictEqual(policy.effectiveBlockedCountries, ['US', 'PK'], 'Must use Editor A blocked list');
});

test('4. Editor B with Groups ON has groups allowed on their shortlinks', () => {
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
  const settings = { fbTrafficEnabled: true, allowFbGroups: false, editorBlockedCountries: ['US'] };

  const policy = resolvePolicyForLink(link, editorB, settings);
  assert.strictEqual(policy.allowFbGroups, true, 'Editor B must have Groups allowed despite global setting');
  assert.deepStrictEqual(policy.effectiveBlockedCountries, ['IN', 'BD'], 'Must use Editor B blocked list');
});

test('5. Admin links are not affected by Editor rules', () => {
  const adminUser = {
    username: 'admin',
    role: 'Admin',
    blockedCountries: ['US', 'PK']
  };
  const link = { createdBy: 'admin' };
  const settings = { fbTrafficEnabled: true, allowFbGroups: true, editorBlockedCountries: ['US', 'PK', 'IN', 'BD'] };

  const policy = resolvePolicyForLink(link, adminUser, settings);
  assert.strictEqual(policy.fbTrafficEnabled, true);
  assert.strictEqual(policy.allowFbGroups, true);
});

console.log(`\n🎉 Results: ${passedTests}/${totalTests} Tests Passed successfully!`);
if (passedTests !== totalTests) process.exit(1);
