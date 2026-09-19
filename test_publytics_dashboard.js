const assert = require('assert');
const publyticsService = require('./services/publyticsService');
const db = require('./db');

async function runTests() {
  console.log('🧪 Running Publytics API & Dashboard Integration Tests...\n');

  // Test 1: Service configuration and token security
  console.log('1. Testing Publytics Service config management & masking...');
  const initialCfg = publyticsService.getConfig();
  assert(typeof initialCfg === 'object', 'Config should be an object');
  assert('hasToken' in initialCfg, 'Config must have hasToken boolean');
  assert('tokenMasked' in initialCfg, 'Config must have tokenMasked string');

  // Update with dummy test token to verify masking and persistence
  publyticsService.updateConfig({
    apiToken: 'test_token_1234567890abcdef',
    siteId: 'test.site.com/xyz123',
    sitesList: [{ id: 'test.site.com/xyz123', name: 'Test Site' }]
  });

  const updatedCfg = publyticsService.getConfig();
  assert.strictEqual(updatedCfg.hasToken, true, 'hasToken should be true after update');
  assert.strictEqual(updatedCfg.currentSiteId, 'test.site.com/xyz123', 'Site ID should be persisted');
  assert(updatedCfg.tokenMasked.includes('••••'), 'Token must be masked');
  assert(!updatedCfg.tokenMasked.includes('1234567890'), 'Raw token secret must not be exposed in tokenMasked');
  console.log('   ✅ Config persistence & token security passed.');

  // Test 2: Dimension validation
  console.log('2. Testing dimension parameter validation...');
  let errorCaught = false;
  try {
    await publyticsService.getDimension('test.site.com/xyz123', 'hacked_dimension');
  } catch (err) {
    errorCaught = true;
    assert(err.message.includes('Invalid dimension'), 'Should reject invalid dimensions');
  }
  assert.strictEqual(errorCaught, true, 'Invalid dimension must throw an error');
  console.log('   ✅ Dimension whitelist validation passed.');

  // Test 3: Sites list retrieval
  console.log('3. Testing getSites() logic...');
  const sitesResult = await publyticsService.getSites();
  assert(Array.isArray(sitesResult.sites), 'Sites result must be an array');
  assert(sitesResult.sites.some(s => s.id === 'test.site.com/xyz123'), 'Configured site must be in sites list');
  console.log('   ✅ getSites() passed.');

  // Test 4: Verify testConnection validation
  console.log('4. Testing testConnection validation...');
  let testConnError = false;
  try {
    await publyticsService.testConnection({ apiToken: '', siteId: '' });
  } catch (err) {
    testConnError = true;
  }
  assert.strictEqual(testConnError, true, 'Empty token must fail testConnection');
  console.log('   ✅ testConnection validation passed.');

  // Cleanup: Reset test config to clean state
  publyticsService.updateConfig({
    apiToken: '',
    siteId: '',
    sitesList: []
  });
  console.log('   ✅ Test cleanup done.');

  console.log('\n🎉 ALL PUBLYTICS SERVICE TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
