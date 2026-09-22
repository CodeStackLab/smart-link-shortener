const assert = require('assert');
const publyticsService = require('./services/publyticsService');
const db = require('./db');

console.log('🧪 Testing Real-Time Live Visitors & Native Hybrid Traffic Engine...\n');

// 1. Check getSites returns real active domain
const sitesRes = publyticsService.getSites();
sitesRes.then(async (sitesData) => {
  assert(sitesData.sites.length > 0, 'FAIL: sites list is empty');
  console.log('✅ PASS: getSites() returns valid sites:', sitesData.sites.map(s => s.id));
  assert(sitesData.currentSiteId, 'FAIL: currentSiteId is empty');
  console.log('✅ PASS: currentSiteId auto-selected:', sitesData.currentSiteId);

  // 2. Add a recent live click log to verify real-time counting
  const now = new Date().toISOString();
  db.addLog({
    id: 'test_rt_' + Date.now(),
    timestamp: now,
    code: 'rt_test_code',
    ip: '198.51.100.55',
    countryCode: 'US',
    countryName: 'United States',
    platform: 'facebook',
    status: 'ORGANIC_CLICK',
    domain: 'goo33.online'
  });

  const rt = await publyticsService.getRealtime('goo33.online/gqMzOr');
  console.log('Real-Time Data received:', rt);

  assert(rt.activeVisitors >= 1, 'FAIL: activeVisitors should be >= 1 for recent click');
  assert(rt['1m'] >= 1, 'FAIL: 1m count should be >= 1');
  assert(rt['5m'] >= 1, 'FAIL: 5m count should be >= 1');
  assert(rt['30m'] >= 1, 'FAIL: 30m count should be >= 1');
  assert(Array.isArray(rt.pages), 'FAIL: pages should be an array');
  assert(rt.pages.some(p => p.page === '/rt_test_code'), 'FAIL: active page /rt_test_code missing from real-time pages');
  console.log('✅ PASS: Real-time traffic engine accurately calculated active visitors, 1m/5m/30m, and active pages!');

  // Immediately remove test log so production logs stay clean
  const curLogs = db.getLogs();
  const cleanedLogs = curLogs.filter(l => !String(l.code).startsWith('rt_test_') && !String(l.id).startsWith('test_rt_'));
  require('fs').writeFileSync(require('path').join(__dirname, 'data/logs.json'), JSON.stringify(cleanedLogs, null, 2));

  // 3. Test token persistence on connection failure
  const preConfig = publyticsService.getConfig();
  const testToken = 'pub_sec_test_token_never_delete_12345';
  
  // Save token with an invalid test site that returns error
  try {
    await publyticsService.updateConfig({
      apiToken: testToken,
      siteId: 'invalid-nonexistent-site-test.com'
    });
  } catch (e) {
    // Expected to fail connection test
  }

  const postSettings = db.getSettings();
  assert.strictEqual(postSettings.publyticsApiToken, testToken, 'FAIL: API Token was erased on connection failure! It must be preserved!');
  console.log('✅ PASS: API Token is preserved on disk even when connection test fails!');

  // Cleanup test settings and restore
  db.updateSettings({
    publyticsApiToken: '',
    publyticsSiteId: 'goo33.online/gqMzOr',
    publyticsSitesList: [
      { id: 'goo33.online/gqMzOr', name: 'goo33.online/gqMzOr' },
      { id: 'goo33.online', name: 'goo33.online' }
    ]
  });

  console.log('\n🎉 ALL REAL-TIME TRAFFIC & TOKEN PRESERVATION TESTS PASSED! 🎉');
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
