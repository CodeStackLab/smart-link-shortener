const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing New User Creation Default Unselected Countries...');

// 1. Verify admin.html default states
const adminHtml = fs.readFileSync(path.join(__dirname, 'public/admin.html'), 'utf8');

// Checkbox should NOT have 'checked' attribute
const checkboxRegex = /<input[^>]+id="new-user-country-block-enabled"[^>]*>/;
const match = adminHtml.match(checkboxRegex);
assert(match, 'admin.html must contain #new-user-country-block-enabled');
assert(!match[0].includes('checked'), '#new-user-country-block-enabled should NOT be checked by default');
console.log('  ✅ PASS: 1. #new-user-country-block-enabled is unchecked by default in admin.html');

// Quick pill buttons in admin.html should have default unselected styling (#f3f4f6, #374151, not #dc2626 or #fef2f2)
const quickBtnsBlock = adminHtml.slice(adminHtml.indexOf('id="new-user-quick-countries"'), adminHtml.indexOf('id="new-user-blocked-tags"'));
assert(!quickBtnsBlock.includes('#fef2f2'), 'Quick buttons in new user section must not have active red styling (#fef2f2)');
console.log('  ✅ PASS: 2. Quick buttons for new user are not pre-selected in admin.html');

// 2. Verify dashboard.js defaults
const dashboardJs = fs.readFileSync(path.join(__dirname, 'public/js/dashboard.js'), 'utf8');
assert(dashboardJs.includes('let newUserBlockedCountries = new Set();'), 'dashboard.js must initialize newUserBlockedCountries as empty Set');
assert(!dashboardJs.includes("let newUserBlockedCountries = new Set(['US'"), 'dashboard.js must not initialize with hardcoded countries');
console.log('  ✅ PASS: 3. dashboard.js initializes newUserBlockedCountries with an empty Set');

// 3. Verify db.addUser defaults
const db = require('./db');
const testUser = {
  username: 'test_default_user_' + Date.now(),
  passwordHash: 'dummyhash',
  role: 'Editor'
};
const created = db.addUser(testUser);
assert(Array.isArray(created.blockedCountries), 'created.blockedCountries should be an array');
assert.strictEqual(created.blockedCountries.length, 0, 'created.blockedCountries should default to empty array []');
assert.strictEqual(created.countryBlockEnabled, false, 'created.countryBlockEnabled should default to false');

// Clean up
db.deleteUser(created.id);
console.log('  ✅ PASS: 4. db.addUser defaults blockedCountries to [] and countryBlockEnabled to false');

console.log('\n🎉 All New User Default Unselected Countries Tests Passed successfully!');
