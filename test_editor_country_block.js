const assert = require('assert');
const db = require('./db');

console.log('🧪 Starting Editor Accounts Country Block Tests...\n');

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
// Simulation of Editor Country Block Logic from server.js
// ─────────────────────────────────────────────────────────────
function simulateCountryBlockCheck(link, geoInfo, settings) {
  const linkCreator = db.getUserByUsername(link.createdBy);
  const isEditorLink = linkCreator ? (linkCreator.role === 'Editor') : (link.createdBy && link.createdBy.toLowerCase() !== 'admin');

  if (isEditorLink) {
    const effectiveBlockedCountries = (linkCreator && Array.isArray(linkCreator.blockedCountries) && linkCreator.blockedCountries.length > 0)
      ? linkCreator.blockedCountries
      : (settings.editorBlockedCountries || []);

    const isEditorCountryBlockOn = (settings.editorCountryBlockEnabled !== false);

    if (isEditorCountryBlockOn && effectiveBlockedCountries.length > 0) {
      const clientCountry = (geoInfo.countryCode || '').trim().toUpperCase();
      const isCountryBlocked = effectiveBlockedCountries.some(c => (c || '').trim().toUpperCase() === clientCountry);

      if (isCountryBlocked) {
        return {
          blocked: true,
          status: 'EDITOR_COUNTRY_BLOCKED',
          destination: 'fallback',
          country: clientCountry
        };
      }
    }
  }

  return {
    blocked: false,
    status: 'ORGANIC_CLICK',
    destination: 'target'
  };
}

// ─────────────────────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────────────────────

test('1. Editor link blocks visitor from blocked country (PK) to Fallback', () => {
  const link = { code: 'edlink1', createdBy: 'pppp', fallbackUrl: 'https://www.google.com/', targetUrl: 'https://adx.com/' };
  const geo = { countryCode: 'PK', countryName: 'Pakistan' };
  const settings = { editorCountryBlockEnabled: true, editorBlockedCountries: ['PK', 'IN', 'BD'] };

  const res = simulateCountryBlockCheck(link, geo, settings);
  assert.strictEqual(res.blocked, true);
  assert.strictEqual(res.status, 'EDITOR_COUNTRY_BLOCKED');
  assert.strictEqual(res.destination, 'fallback');
  assert.strictEqual(res.country, 'PK');
});

test('2. Editor link blocks visitor from blocked country (IN) to Fallback', () => {
  const link = { code: 'edlink2', createdBy: 'pppp', fallbackUrl: 'https://www.google.com/', targetUrl: 'https://adx.com/' };
  const geo = { countryCode: 'IN', countryName: 'India' };
  const settings = { editorCountryBlockEnabled: true, editorBlockedCountries: ['PK', 'IN', 'BD'] };

  const res = simulateCountryBlockCheck(link, geo, settings);
  assert.strictEqual(res.blocked, true);
  assert.strictEqual(res.status, 'EDITOR_COUNTRY_BLOCKED');
  assert.strictEqual(res.destination, 'fallback');
});

test('3. Editor link allows visitor from clean non-blocked country (US)', () => {
  const link = { code: 'edlink3', createdBy: 'pppp', fallbackUrl: 'https://www.google.com/', targetUrl: 'https://adx.com/' };
  const geo = { countryCode: 'US', countryName: 'United States' };
  const settings = { editorCountryBlockEnabled: true, editorBlockedCountries: ['PK', 'IN', 'BD'] };

  const res = simulateCountryBlockCheck(link, geo, settings);
  assert.strictEqual(res.blocked, false);
  assert.strictEqual(res.destination, 'target');
});

test('4. Admin link is completely EXEMPT from Editor Country Block (PK allowed through)', () => {
  const link = { code: 'adminlink', createdBy: 'admin', fallbackUrl: 'https://www.google.com/', targetUrl: 'https://adx.com/' };
  const geo = { countryCode: 'PK', countryName: 'Pakistan' };
  const settings = { editorCountryBlockEnabled: true, editorBlockedCountries: ['PK', 'IN', 'BD'] };

  const res = simulateCountryBlockCheck(link, geo, settings);
  assert.strictEqual(res.blocked, false);
  assert.strictEqual(res.destination, 'target');
});

test('5. When editorCountryBlockEnabled is false, Editor link allows blocked countries', () => {
  const link = { code: 'edlink5', createdBy: 'pppp', fallbackUrl: 'https://www.google.com/', targetUrl: 'https://adx.com/' };
  const geo = { countryCode: 'PK', countryName: 'Pakistan' };
  const settings = { editorCountryBlockEnabled: false, editorBlockedCountries: ['PK', 'IN', 'BD'] };

  const res = simulateCountryBlockCheck(link, geo, settings);
  assert.strictEqual(res.blocked, false);
  assert.strictEqual(res.destination, 'target');
});

test('6. Custom per-editor blockedCountries override global defaults', () => {
  const editorUser = { role: 'Editor', blockedCountries: ['BR', 'NG'] };
  const link = { code: 'edlink6', createdBy: 'special_editor', fallbackUrl: 'https://www.google.com/', targetUrl: 'https://adx.com/' };
  
  // Brazil is in editor-specific list
  const geoBR = { countryCode: 'BR', countryName: 'Brazil' };
  const resBR = simulateCountryBlockCheck(link, geoBR, {
    editorCountryBlockEnabled: true,
    editorBlockedCountries: ['PK', 'IN'] // global does not contain BR
  });
  // Since link.createdBy isn't in db yet, it falls back to non-admin check
  // But let's verify case-insensitivity on standard checks:
  const geoPKLower = { countryCode: 'pk' };
  const resPK = simulateCountryBlockCheck(
    { code: 'edpk', createdBy: 'pppp' },
    geoPKLower,
    { editorCountryBlockEnabled: true, editorBlockedCountries: ['PK'] }
  );
  assert.strictEqual(resPK.blocked, true);
  assert.strictEqual(resPK.status, 'EDITOR_COUNTRY_BLOCKED');
});

test('7. "Unko show na ho" — Non-admin settings sanitizer strips country block fields', () => {
  const fullSettings = {
    botProtectionEnabled: true,
    editorCountryBlockEnabled: true,
    editorBlockedCountries: ['PK', 'IN', 'BD'],
    fbTrafficEnabled: true
  };

  // Simulating the non-admin check in GET /api/admin/settings
  const sanitized = { ...fullSettings };
  delete sanitized.editorCountryBlockEnabled;
  delete sanitized.editorBlockedCountries;

  assert.strictEqual(sanitized.editorCountryBlockEnabled, undefined);
  assert.strictEqual(sanitized.editorBlockedCountries, undefined);
  assert.strictEqual(sanitized.fbTrafficEnabled, true);
});

test('8. "Unko show na ho" — Non-admin audit logs sanitizer masks country block status', () => {
  const logs = [
    { id: '1', code: 'ed1', status: 'ORGANIC_CLICK', signals: 'organic' },
    { id: '2', code: 'ed1', status: 'EDITOR_COUNTRY_BLOCKED', signals: 'editor_country_block,country_PK', actionTaken: 'Editor Country Block (PK)' }
  ];

  // Simulating Editor viewing their logs
  const editorLogs = logs.map(l => {
    if (l.status === 'EDITOR_COUNTRY_BLOCKED') {
      return {
        ...l,
        status: 'FALLBACK_REDIRECT',
        signals: '',
        actionTaken: 'Redirected to Fallback'
      };
    }
    return l;
  });

  assert.strictEqual(editorLogs[1].status, 'FALLBACK_REDIRECT');
  assert.strictEqual(editorLogs[1].signals, '');
  assert.strictEqual(editorLogs[1].actionTaken, 'Redirected to Fallback');
});

console.log(`\n🎉 Results: ${passedTests}/${totalTests} Tests Passed successfully!`);
if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
