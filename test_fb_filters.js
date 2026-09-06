const assert = require('assert');
const { classifyFacebookTraffic } = require('./utils/detector');

console.log('🧪 Starting Facebook Traffic Filtering & AdX Control Tests...\n');

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
// Requirement 2: Sub-source Classification Tests
// ─────────────────────────────────────────────────────────────
console.log('--- Testing Sub-source Classification ---');

test('1. Detects Facebook Profile from profile.php referrer', () => {
  const res = classifyFacebookTraffic(
    { query: {}, url: '/s/test' },
    'https://www.facebook.com/profile.php?id=100012345678',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    { isp: 'Comcast Cable', isVpn: false }
  );
  assert.strictEqual(res.isFacebook, true);
  assert.strictEqual(res.subCategory, 'profile');
});

test('2. Detects Facebook Profile from clean organic mobile share with fbclid', () => {
  const res = classifyFacebookTraffic(
    { query: { fbclid: 'IwAR3xxxxxx' }, url: '/s/test?fbclid=IwAR3xxxxxx' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.0;FBSS/3;FBCR/Verizon;FBID/phone;FBLC/en_US;FBOP/5]',
    { isp: 'Verizon Wireless', isVpn: false }
  );
  assert.strictEqual(res.isFacebook, true);
  assert.strictEqual(res.subCategory, 'profile');
});

test('3. Detects Facebook Group from referer /groups/', () => {
  const res = classifyFacebookTraffic(
    { query: {}, url: '/s/test' },
    'https://m.facebook.com/groups/techcommunity/permalink/123456789/',
    'Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0',
    { isp: 'Vodafone India', isVpn: false }
  );
  assert.strictEqual(res.isFacebook, true);
  assert.strictEqual(res.subCategory, 'group');
});

test('4. Detects Facebook Group from query parameter fb_group / group_id', () => {
  const res = classifyFacebookTraffic(
    { query: { group_id: '987654321' }, url: '/s/test?group_id=987654321' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36',
    { isp: 'Jio Broadband', isVpn: false }
  );
  assert.strictEqual(res.isFacebook, true);
  assert.strictEqual(res.subCategory, 'group');
});

test('5. Detects Facebook Page from referer /pages/', () => {
  const res = classifyFacebookTraffic(
    { query: {}, url: '/s/test' },
    'https://www.facebook.com/pages/Breaking-News/1029384756',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
    { isp: 'Spectrum', isVpn: false }
  );
  assert.strictEqual(res.isFacebook, true);
  assert.strictEqual(res.subCategory, 'page');
});

test('6. Detects Facebook Page from query parameter fb_source=page', () => {
  const res = classifyFacebookTraffic(
    { query: { fb_source: 'page_feed' }, url: '/s/test?fb_source=page_feed' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
    { isp: 'AT&T Internet', isVpn: false }
  );
  assert.strictEqual(res.isFacebook, true);
  assert.strictEqual(res.subCategory, 'page');
});

test('7. Detects Facebook Story from sfnsn query parameter (FB official mobile story share)', () => {
  const res = classifyFacebookTraffic(
    { query: { sfnsn: 'mo' }, url: '/s/test?sfnsn=mo' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36',
    { isp: 'T-Mobile USA', isVpn: false }
  );
  assert.strictEqual(res.isFacebook, true);
  assert.strictEqual(res.subCategory, 'story');
});

test('8. Detects Facebook Story from referer /stories/', () => {
  const res = classifyFacebookTraffic(
    { query: {}, url: '/s/test' },
    'https://m.facebook.com/stories/1234567890/',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    { isp: 'Orange France', isVpn: false }
  );
  assert.strictEqual(res.isFacebook, true);
  assert.strictEqual(res.subCategory, 'story');
});

test('9. Flags Automated / Fake FB traffic from Datacenter ISP (e.g. Hetzner / AWS)', () => {
  const res = classifyFacebookTraffic(
    { query: { fbclid: 'fake_click_id' }, url: '/s/test?fbclid=fake_click_id' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    { isp: 'Hetzner Online GmbH', isVpn: true }
  );
  assert.strictEqual(res.isFacebook, true);
  assert.strictEqual(res.subCategory, 'automated');
  assert.ok(res.signals.includes('datacenter_ip'));
});

test('10. Flags Automated / Fake FB traffic from headless scraper', () => {
  const res = classifyFacebookTraffic(
    { query: {}, url: '/s/test' },
    'https://l.facebook.com/',
    'HeadlessChrome/128.0.6613.88',
    { isp: 'Residential Comcast', isVpn: false }
  );
  assert.strictEqual(res.isFacebook, true);
  assert.strictEqual(res.subCategory, 'automated');
  assert.ok(res.signals.includes('bot_or_headless'));
});

test('11. Non-Facebook traffic classified as none', () => {
  const res = classifyFacebookTraffic(
    { query: {}, url: '/s/test' },
    'https://www.google.com/',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    { isp: 'Residential Comcast', isVpn: false }
  );
  assert.strictEqual(res.isFacebook, false);
  assert.strictEqual(res.subCategory, 'none');
});

// ─────────────────────────────────────────────────────────────
// Decision Tree & Filtering Simulation Tests (The 7 Requirements)
// ─────────────────────────────────────────────────────────────
console.log('\n--- Testing Decision Tree & Filtering Rules ---');

function simulateRedirectDecision(linkConfig, req, referer, userAgent, geoInfo) {
  const fbTraffic = classifyFacebookTraffic(req, referer, userAgent, geoInfo);
  
  const fbTrafficEnabled = (linkConfig.fbTrafficEnabled !== undefined) ? !!linkConfig.fbTrafficEnabled : true;
  const allowFbProfiles = (linkConfig.allowFbProfiles !== undefined) ? !!linkConfig.allowFbProfiles : true;
  const allowFbGroups = (linkConfig.allowFbGroups !== undefined) ? !!linkConfig.allowFbGroups : true;
  const allowFbPages = (linkConfig.allowFbPages !== undefined) ? !!linkConfig.allowFbPages : true;
  const allowFbStories = (linkConfig.allowFbStories !== undefined) ? !!linkConfig.allowFbStories : true;
  const blockAutomatedUnknown = (linkConfig.blockAutomatedUnknown !== undefined) ? !!linkConfig.blockAutomatedUnknown : true;
  const isBotProtectionOn = (linkConfig.botProtection !== undefined) ? !!linkConfig.botProtection : true;

  if (fbTraffic.isFacebook) {
    if (!fbTrafficEnabled) {
      return { status: 'FB_TRAFFIC_DISABLED', destination: 'fallback' };
    }
    if (blockAutomatedUnknown && (fbTraffic.subCategory === 'automated' || fbTraffic.subCategory === 'unknown' || (isBotProtectionOn && geoInfo.isVpn))) {
      return { status: fbTraffic.subCategory === 'automated' ? 'FB_AUTOMATED_BLOCKED' : 'FB_UNKNOWN_BLOCKED', destination: 'fallback' };
    }
    if (fbTraffic.subCategory === 'group' && !allowFbGroups) {
      return { status: 'FB_GROUP_BLOCKED', destination: 'fallback' };
    }
    if (fbTraffic.subCategory === 'page' && !allowFbPages) {
      return { status: 'FB_PAGE_BLOCKED', destination: 'fallback' };
    }
    if (fbTraffic.subCategory === 'story' && !allowFbStories) {
      return { status: 'FB_STORY_BLOCKED', destination: 'fallback' };
    }
    if (fbTraffic.subCategory === 'profile' && !allowFbProfiles) {
      return { status: 'FB_PROFILE_BLOCKED', destination: 'fallback' };
    }
    if (isBotProtectionOn && (geoInfo.isVpn || geoInfo.isDatacenter)) {
      return { status: 'BOT_TRAFFIC_BLOCKED', destination: 'fallback' };
    }
    return { status: 'ORGANIC_CLICK', destination: 'adx_target', subCategory: fbTraffic.subCategory };
  }
  return { status: 'ORGANIC_CLICK', destination: 'fallback_or_target' };
}

test('12. Rule 1: Facebook Traffic Master OFF blocks all FB traffic to Fallback', () => {
  const link = { fbTrafficEnabled: false };
  const decision = simulateRedirectDecision(
    link,
    { query: { fbclid: '123' }, url: '/s/adx?fbclid=123' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(decision.status, 'FB_TRAFFIC_DISABLED');
  assert.strictEqual(decision.destination, 'fallback');
});

test('13. Rule 2: FB Profile traffic allowed forward to AdX target', () => {
  const link = { fbTrafficEnabled: true, allowFbProfiles: true };
  const decision = simulateRedirectDecision(
    link,
    { query: { fbclid: '123' }, url: '/s/adx?fbclid=123' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(decision.status, 'ORGANIC_CLICK');
  assert.strictEqual(decision.destination, 'adx_target');
  assert.strictEqual(decision.subCategory, 'profile');
});

test('14. Rule 3: FB Groups blocked redirects to Fallback', () => {
  const link = { fbTrafficEnabled: true, allowFbGroups: false };
  const decision = simulateRedirectDecision(
    link,
    { query: {}, url: '/s/adx' },
    'https://m.facebook.com/groups/somegroup/',
    'Mozilla/5.0 (Android 14; Mobile)',
    { isp: 'Airtel', isVpn: false }
  );
  assert.strictEqual(decision.status, 'FB_GROUP_BLOCKED');
  assert.strictEqual(decision.destination, 'fallback');
});

test('15. Rule 3: FB Groups allowed forwards to AdX target', () => {
  const link = { fbTrafficEnabled: true, allowFbGroups: true };
  const decision = simulateRedirectDecision(
    link,
    { query: {}, url: '/s/adx' },
    'https://m.facebook.com/groups/somegroup/',
    'Mozilla/5.0 (Android 14; Mobile)',
    { isp: 'Airtel', isVpn: false }
  );
  assert.strictEqual(decision.status, 'ORGANIC_CLICK');
  assert.strictEqual(decision.destination, 'adx_target');
  assert.strictEqual(decision.subCategory, 'group');
});

test('16. Rule 4: FB Pages blocked redirects to Fallback', () => {
  const link = { fbTrafficEnabled: true, allowFbPages: false };
  const decision = simulateRedirectDecision(
    link,
    { query: { page_id: '999' }, url: '/s/adx?page_id=999' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    { isp: 'Spectrum', isVpn: false }
  );
  assert.strictEqual(decision.status, 'FB_PAGE_BLOCKED');
  assert.strictEqual(decision.destination, 'fallback');
});

test('17. Rule 4: FB Pages allowed forwards to AdX target', () => {
  const link = { fbTrafficEnabled: true, allowFbPages: true };
  const decision = simulateRedirectDecision(
    link,
    { query: { page_id: '999' }, url: '/s/adx?page_id=999' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    { isp: 'Spectrum', isVpn: false }
  );
  assert.strictEqual(decision.status, 'ORGANIC_CLICK');
  assert.strictEqual(decision.destination, 'adx_target');
  assert.strictEqual(decision.subCategory, 'page');
});

test('18. Rule 5: FB Stories blocked redirects to Fallback', () => {
  const link = { fbTrafficEnabled: true, allowFbStories: false };
  const decision = simulateRedirectDecision(
    link,
    { query: { sfnsn: 'mo' }, url: '/s/adx?sfnsn=mo' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (Linux; Android 14; Mobile)',
    { isp: 'T-Mobile', isVpn: false }
  );
  assert.strictEqual(decision.status, 'FB_STORY_BLOCKED');
  assert.strictEqual(decision.destination, 'fallback');
});

test('19. Rule 5: FB Stories allowed forwards to AdX target', () => {
  const link = { fbTrafficEnabled: true, allowFbStories: true };
  const decision = simulateRedirectDecision(
    link,
    { query: { sfnsn: 'mo' }, url: '/s/adx?sfnsn=mo' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (Linux; Android 14; Mobile)',
    { isp: 'T-Mobile', isVpn: false }
  );
  assert.strictEqual(decision.status, 'ORGANIC_CLICK');
  assert.strictEqual(decision.destination, 'adx_target');
  assert.strictEqual(decision.subCategory, 'story');
});

test('20. Rule 6: Automated / Datacenter FB traffic auto-blocked to Fallback', () => {
  const link = { fbTrafficEnabled: true, blockAutomatedUnknown: true };
  const decision = simulateRedirectDecision(
    link,
    { query: { fbclid: 'datacenter_bot' }, url: '/s/adx?fbclid=datacenter_bot' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    { isp: 'Amazon Technologies Inc.', isVpn: true }
  );
  assert.strictEqual(decision.status, 'FB_AUTOMATED_BLOCKED');
  assert.strictEqual(decision.destination, 'fallback');
});

test('21. Rule 7: Bot protection ON blocks VPN FB visitor', () => {
  const link = { fbTrafficEnabled: true, botProtection: true, blockAutomatedUnknown: true };
  const decision = simulateRedirectDecision(
    link,
    { query: { fbclid: '123' }, url: '/s/adx?fbclid=123' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (Linux; Android 14)',
    { isp: 'ExpressVPN Node', isVpn: true }
  );
  assert.strictEqual(decision.destination, 'fallback');
});

console.log(`\n🎉 Results: ${passedTests}/${totalTests} Tests Passed successfully!`);
if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
