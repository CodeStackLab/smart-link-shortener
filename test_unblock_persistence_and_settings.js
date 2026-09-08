const assert = require('assert');
const db = require('./db');

const initialSettings = { ...db.getSettings() };

console.log('🧪 Starting Unblock Persistence & Settings Fix Unit Tests...\n');

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
// 1. Unblocking countries persists without reverting to defaults
// ─────────────────────────────────────────────────────────────
test('1. Unblocking all countries except 1 (US) persists and does NOT revert to 8 defaults', () => {
  db.updateSettings({
    editorCountryBlockEnabled: true,
    editorBlockedCountries: ['US']
  });

  const settings = db.getSettings();
  assert.strictEqual(settings.editorCountryBlockEnabled, true);
  assert.deepStrictEqual(settings.editorBlockedCountries, ['US'], 'Must contain ONLY US');
});

test('2. Completely unblocking all countries ([]) persists and does NOT revert to 8 defaults', () => {
  db.updateSettings({
    editorCountryBlockEnabled: false,
    editorBlockedCountries: []
  });

  const settings = db.getSettings();
  assert.strictEqual(settings.editorCountryBlockEnabled, false);
  assert.deepStrictEqual(settings.editorBlockedCountries, [], 'Must be empty array');
});

test('3. Custom 2 countries (e.g. PK, EG) unblocking remaining 6 persists cleanly', () => {
  db.updateSettings({
    editorCountryBlockEnabled: true,
    editorBlockedCountries: ['PK', 'EG']
  });

  const settings = db.getSettings();
  assert.strictEqual(settings.editorCountryBlockEnabled, true);
  assert.deepStrictEqual(settings.editorBlockedCountries, ['PK', 'EG']);
});

// ─────────────────────────────────────────────────────────────
// 2. Partial updates do NOT wipe other settings to defaults
// ─────────────────────────────────────────────────────────────
test('4. Saving Fallback URL preserves existing editorBlockedCountries and firewall settings', () => {
  // Setup custom state
  db.updateSettings({
    defaultFallbackUrl: 'https://my-custom-fallback.com/',
    botLimitClicks: 350,
    editorBlockedCountries: ['PK', 'EG']
  });

  // Now simulate updating ONLY fallback URL (as from Settings tab)
  db.updateSettings({
    defaultFallbackUrl: 'https://new-safe-destination.com/'
  });

  const settings = db.getSettings();
  assert.strictEqual(settings.defaultFallbackUrl, 'https://new-safe-destination.com/');
  assert.strictEqual(settings.botLimitClicks, 350, 'botLimitClicks must NOT revert to 100 default');
  assert.deepStrictEqual(settings.editorBlockedCountries, ['PK', 'EG'], 'editorBlockedCountries must NOT revert to 8 defaults');
});

test('5. Saving Editor Country Block preserves existing defaultFallbackUrl and Shield settings', () => {
  db.updateSettings({
    editorCountryBlockEnabled: true,
    editorBlockedCountries: ['IN', 'BD']
  });

  const settings = db.getSettings();
  assert.strictEqual(settings.defaultFallbackUrl, 'https://new-safe-destination.com/', 'Fallback URL must remain intact');
  assert.strictEqual(settings.botLimitClicks, 350, 'Shield clicks must remain intact');
  assert.deepStrictEqual(settings.editorBlockedCountries, ['IN', 'BD']);
});

// ─────────────────────────────────────────────────────────────
// 3. UI checks in admin.html, dashboard.js, and style.css
// ─────────────────────────────────────────────────────────────
test('6. HTML editor-blocked-countries-tags is clean with no hardcoded countries', () => {
  const fs = require('fs');
  const html = fs.readFileSync('./public/admin.html', 'utf8');
  assert.ok(html.includes('id="editor-blocked-countries-tags"'));
  const tagsContainerMatch = html.match(/<div id="editor-blocked-countries-tags"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(tagsContainerMatch, 'Container must exist');
  assert.strictEqual(tagsContainerMatch[1].trim(), '', 'Container must not contain hardcoded country spans');
});

test('7. dashboard.js does not forcibly re-inject mandatory countries array', () => {
  const fs = require('fs');
  const js = fs.readFileSync('./public/js/dashboard.js', 'utf8');
  assert.strictEqual(
    js.includes('activeEditorBlockedCountries = new Set([...loadedCountries, ...mandatoryCountries])'),
    false,
    'Must not force-inject mandatoryCountries into activeEditorBlockedCountries'
  );
  assert.strictEqual(
    js.includes('editUserBlockedCountries = new Set([...userBlockedList, ...mandatoryCountries])'),
    false,
    'Must not force-inject mandatoryCountries into editUserBlockedCountries'
  );
});

test('8. Fallback card title in admin.html is Fallback Redirect (without cuatmoize text)', () => {
  const fs = require('fs');
  const html = fs.readFileSync('./public/admin.html', 'utf8');
  assert.ok(html.includes('Fallback Redirect'), 'Must have Fallback Redirect title');
  assert.strictEqual(html.toLowerCase().includes('cuatmoize'), false, 'Must NOT contain typo cuatmoize');
});

// Clean up and restore healthy defaults for test suite
db.updateSettings(initialSettings);

console.log(`\n🎉 Results: ${passedTests}/${totalTests} Tests Passed successfully!`);
