const assert = require('assert');
const db = require('./db');

console.log('🧪 Testing Custom Editor Country Block Persistence & Protection...');

// 1. Create a test editor with custom blocked countries
const testEditor = {
  username: 'test_ed_custom_' + Date.now(),
  passwordHash: 'dummyhash',
  role: 'Editor',
  blockedCountries: ['US', 'PK', 'IN'],
  countryBlockEnabled: true
};

const created = db.addUser(testEditor);
db.updateUserRole(created.id, 'Editor', created.permissions, [], created.fbTrafficSettings, ['IN', 'PK', 'US'], true);

const fetchedUser = db.getUserByUsername(testEditor.username);
assert.deepStrictEqual(fetchedUser.blockedCountries.sort(), ['IN', 'PK', 'US']);
assert.strictEqual(fetchedUser.hasCustomCountryRules, true, 'Must have hasCustomCountryRules set to true');
console.log('  ✅ PASS: 1. Custom editor blocked countries and hasCustomCountryRules saved properly');

// 2. Simulate global settings update (which updates all default editors)
db.updateAllEditorsBlockedCountries(['US', 'PK', 'IN', 'BD', 'EG', 'NG', 'PH', 'TW'], true);

// 3. Verify custom editor was protected and NOT overwritten
const protectedUser = db.getUserByUsername(testEditor.username);
assert.deepStrictEqual(protectedUser.blockedCountries.sort(), ['IN', 'PK', 'US'], 'Custom editor blocked countries must NOT be overwritten by global updates');
console.log('  ✅ PASS: 2. updateAllEditorsBlockedCountries strictly protects editors with custom rules');

// 4. Verify getUsersPublic returns exact custom countries
const publicUser = db.getUsersPublic().find(u => u.username === testEditor.username);
assert.deepStrictEqual(publicUser.blockedCountries.sort(), ['IN', 'PK', 'US'], 'getUsersPublic must return exact custom blocked countries');
console.log('  ✅ PASS: 3. getUsersPublic preserves exact custom blocked countries without re-injecting 8 defaults');

// Cleanup
db.deleteUser(created.id);
console.log('  ✅ PASS: 4. Test cleanup completed');

console.log('\n🎉 All Custom Editor Country Block Persistence Tests Passed successfully!');
