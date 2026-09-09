const assert = require('assert');
const fs = require('fs');
const path = require('path');
const db = require('./db');

console.log('🧪 Starting "Apply For All Editors Account" Verification Tests...\n');

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

// 1. Check admin.html UI elements
test('1. admin.html removed upper selected section completely and renamed card to "Apply For All Editors Account"', () => {
  const html = fs.readFileSync(path.join(__dirname, 'public/admin.html'), 'utf8');

  // Upper section items must NOT exist
  assert(!html.includes('👑 Admin Only — Hidden From Editors'), 'Must NOT contain "Admin Only — Hidden From Editors" badge');
  assert(!html.includes('Silent Country Block for Editors ("Unko Show Na Ho")'), 'Must NOT contain Silent Country Block banner');
  assert(!html.includes('Enable Country Block for Editor Accounts'), 'Must NOT contain "Enable Country Block for Editor Accounts" checkbox title');
  assert(!html.includes('<input type="checkbox" id="editor-country-block-enabled"'), 'Must NOT contain checkbox for editor-country-block-enabled');

  // Must have new title and button
  assert(html.includes('Apply For All Editors Account'), 'Card title must include "Apply For All Editors Account"');
  assert(html.includes('💾 Apply For All Editors Account'), 'Button must say "💾 Apply For All Editors Account"');

  // Must keep lower country selection section
  assert(html.includes('id="quick-country-buttons"'), 'Must keep quick country buttons');
  assert(html.includes('id="editor-blocked-countries-tags"'), 'Must keep blocked countries tags container');
  assert(html.includes('id="editor-custom-country-code"'), 'Must keep custom country code input');
  assert(html.includes('id="btn-add-editor-country"'), 'Must keep add country button');
});

// 2. Test applying added countries to all Editor accounts
test('2. Applying added countries automatically synchronizes to ALL Editor accounts in db', () => {
  const initialUsers = JSON.parse(JSON.stringify(db.getUsers()));

  // Simulate applying ['US', 'PK', 'IN'] with forceAll = true (as done when Admin applies from the card)
  db.updateAllEditorsBlockedCountries(['US', 'PK', 'IN'], true, true);

  const updatedUsers = db.getUsers();
  const editorUsers = updatedUsers.filter(u => u && u.role === 'Editor');
  assert(editorUsers.length > 0, 'Must have editor users');

  for (const ed of editorUsers) {
    assert.deepStrictEqual(ed.blockedCountries.sort(), ['IN', 'PK', 'US'], `Editor ${ed.username} must have ['IN', 'PK', 'US']`);
    assert.strictEqual(ed.countryBlockEnabled, true, `Editor ${ed.username} must have countryBlockEnabled: true`);
  }

  // Restore initial users
  fs.writeFileSync('./data/users.json', JSON.stringify(initialUsers, null, 2), 'utf8');
});

// 3. Test removing a country from the applied list removes it from all Editor accounts
test('3. Removing any country automatically removes it from ALL Editor accounts in db', () => {
  const initialUsers = JSON.parse(JSON.stringify(db.getUsers()));

  // First apply ['US', 'PK', 'IN']
  db.updateAllEditorsBlockedCountries(['US', 'PK', 'IN'], true, true);

  // Now remove 'PK' -> apply ['US', 'IN']
  db.updateAllEditorsBlockedCountries(['US', 'IN'], true, true);

  const updatedUsers = db.getUsers();
  const editorUsers = updatedUsers.filter(u => u && u.role === 'Editor');

  for (const ed of editorUsers) {
    assert.deepStrictEqual(ed.blockedCountries.sort(), ['IN', 'US'], `Editor ${ed.username} must have 'PK' removed`);
    assert(!ed.blockedCountries.includes('PK'), `Editor ${ed.username} must not have 'PK'`);
  }

  // Now remove all countries -> apply []
  db.updateAllEditorsBlockedCountries([], false, true);
  const clearedUsers = db.getUsers();
  const clearedEditors = clearedUsers.filter(u => u && u.role === 'Editor');

  for (const ed of clearedEditors) {
    assert.deepStrictEqual(ed.blockedCountries, [], `Editor ${ed.username} must have all countries removed`);
    assert.strictEqual(ed.countryBlockEnabled, false, `Editor ${ed.username} must have countryBlockEnabled: false`);
  }

  // Restore initial users
  fs.writeFileSync('./data/users.json', JSON.stringify(initialUsers, null, 2), 'utf8');
});

// 4. Test server.js integration passes forceAll=true on country block updates
test('4. server.js passes forceAll=true to db.updateAllEditorsBlockedCountries when settings are saved', () => {
  const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert(
    serverCode.includes('db.updateAllEditorsBlockedCountries(\n      updated.editorBlockedCountries,\n      updated.editorCountryBlockEnabled,\n      true') ||
    serverCode.includes('updated.editorCountryBlockEnabled,\n      true'),
    'server.js must pass true as 3rd parameter to db.updateAllEditorsBlockedCountries'
  );
});

// 5. Test dashboard.js sets enabled based on countries.length and submits to settings
test('5. dashboard.js computes enabled from activeEditorBlockedCountries.size and alerts success', () => {
  const dashCode = fs.readFileSync(path.join(__dirname, 'public/js/dashboard.js'), 'utf8');
  assert(dashCode.includes('const enabled = countries.length > 0;'), 'dashboard.js must set enabled = countries.length > 0');
  assert(dashCode.includes('Applied to all Editor accounts successfully!'), 'dashboard.js must show confirmation that rules applied to all Editor accounts');
});

console.log(`\n🎉 All ${passed}/${total} Apply For All Editors Country Block Tests Passed successfully!`);
if (passed !== total) process.exit(1);
