const assert = require('assert');
const { classifyFacebookTraffic } = require('./utils/detector');

console.log('🧪 Starting Facebook Traffic Filtering & AdX Control Tests (6-Source System)...\n');

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
// Part 1: Sub-source Classification Tests (All 6 Sources + Unknown)
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
  assert.strictEqual(res.label, 'Facebook Profile');
});

test('2. Detects Facebook Profile from profile mibextid / profile param', () => {
  const res = classifyFacebookTraffic(
    { query: { mibextid: 'AwKD5V', fbclid: 'IwAR3xxxxxx' }, url: '/s/test?mibextid=AwKD5V&fbclid=IwAR3xxxxxx' },
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
  assert.strictEqual(res.label, 'Facebook Group');
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
  assert.strictEqual(res.label, 'Facebook Page');
});

test('6. Detects Facebook Page from query parameter fb_source=page or paipv', () => {
  const res = classifyFacebookTraffic(
    { query: { paipv: '1', fb_source: 'page_feed' }, url: '/s/test?paipv=1&fb_source=page_feed' },
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
  assert.strictEqual(res.label, 'Facebook Story');
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

test('9. Detects Facebook Event from eid query parameter and /events/ referer', () => {
  const res = classifyFacebookTraffic(
    { query: { eid: '1122334455' }, url: '/s/test?eid=1122334455' },
    'https://www.facebook.com/events/1122334455/',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0',
    { isp: 'Comcast', isVpn: false }
  );
  assert.strictEqual(res.isFacebook, true);
  assert.strictEqual(res.subCategory, 'event');
  assert.strictEqual(res.label, 'Facebook Event');
});

test('10. Detects Facebook Comment from comment_id query parameter and comment.php referer', () => {
  const res = classifyFacebookTraffic(
    { query: { comment_id: '5566778899' }, url: '/s/test?comment_id=5566778899' },
    'https://m.facebook.com/comment.php?id=123',
    'Mozilla/5.0 (Linux; Android 14) Chrome/128.0.0.0 Mobile',
    { isp: 'Vodafone', isVpn: false }
  );
  assert.strictEqual(res.isFacebook, true);
  assert.strictEqual(res.subCategory, 'comment');
  assert.strictEqual(res.label, 'Facebook Comment');
});

test('11. Rule 10: Unverified Facebook traffic without verified source signals is classified as unknown', () => {
  const res = classifyFacebookTraffic(
    { query: { fbclid: 'generic_click_without_subsource_signals' }, url: '/s/test?fbclid=generic_click_without_subsource_signals' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0',
    { isp: 'Residential ISP', isVpn: false }
  );
  assert.strictEqual(res.isFacebook, true);
  assert.strictEqual(res.subCategory, 'unknown');
  assert.strictEqual(res.label, 'Facebook Unknown / Unverified');
});

test('12. Flags Automated / Fake FB traffic from Datacenter ISP (e.g. Hetzner / AWS)', () => {
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

test('13. Flags Automated / Fake FB traffic from headless scraper', () => {
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

test('14. Non-Facebook traffic classified as none', () => {
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
// Part 2: Decision Tree & Filtering Simulation Tests (The 6-Source Logic)
// ─────────────────────────────────────────────────────────────
console.log('\n--- Testing Decision Tree & Filtering Rules ---');

function simulateRedirectDecision(linkConfig, req, referer, userAgent, geoInfo) {
  const fbTraffic = classifyFacebookTraffic(req, referer, userAgent, geoInfo);
  
  const fbTrafficEnabled = (linkConfig.fbTrafficEnabled !== undefined) ? !!linkConfig.fbTrafficEnabled : true;
  const allowFbProfiles = (linkConfig.allowFbProfiles !== undefined) ? !!linkConfig.allowFbProfiles : true;
  const allowFbGroups = (linkConfig.allowFbGroups !== undefined) ? !!linkConfig.allowFbGroups : true;
  const allowFbPages = (linkConfig.allowFbPages !== undefined) ? !!linkConfig.allowFbPages : true;
  const allowFbStories = (linkConfig.allowFbStories !== undefined) ? !!linkConfig.allowFbStories : true;
  const allowFbEvents = (linkConfig.allowFbEvents !== undefined) ? !!linkConfig.allowFbEvents : true;
  const allowFbComments = (linkConfig.allowFbComments !== undefined) ? !!linkConfig.allowFbComments : true;
  const blockAutomatedUnknown = (linkConfig.blockAutomatedUnknown !== undefined) ? !!linkConfig.blockAutomatedUnknown : true;
  const isBotProtectionOn = (linkConfig.botProtection !== undefined) ? !!linkConfig.botProtection : true;

  if (fbTraffic.isFacebook) {
    if (!fbTrafficEnabled) {
      return { status: 'FB_TRAFFIC_DISABLED', destination: 'fallback' };
    }
    // Rule 10: Unknown / unverified FB traffic always routes to fallback
    if (fbTraffic.subCategory === 'unknown') {
      return { status: 'FB_UNKNOWN_BLOCKED', destination: 'fallback' };
    }
    if (blockAutomatedUnknown && (fbTraffic.subCategory === 'automated' || (isBotProtectionOn && geoInfo.isVpn))) {
      return { status: 'FB_AUTOMATED_BLOCKED', destination: 'fallback' };
    }
    if (fbTraffic.subCategory === 'profile' && !allowFbProfiles) {
      return { status: 'FB_PROFILE_BLOCKED', destination: 'fallback' };
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
    if (fbTraffic.subCategory === 'event' && !allowFbEvents) {
      return { status: 'FB_EVENT_BLOCKED', destination: 'fallback' };
    }
    if (fbTraffic.subCategory === 'comment' && !allowFbComments) {
      return { status: 'FB_COMMENT_BLOCKED', destination: 'fallback' };
    }
    if (isBotProtectionOn && (geoInfo.isVpn || geoInfo.isDatacenter)) {
      return { status: 'BOT_TRAFFIC_BLOCKED', destination: 'fallback' };
    }
    return { status: 'ORGANIC_CLICK', destination: 'main_url', subCategory: fbTraffic.subCategory };
  }
  return { status: 'ORGANIC_CLICK', destination: 'target' };
}

test('15. Master Facebook Switch OFF: All FB traffic routes to Fallback', () => {
  const link = { fbTrafficEnabled: false };
  const decision = simulateRedirectDecision(
    link,
    { query: { fb_profile: '1' }, url: '/s/adx?fb_profile=1' },
    'https://www.facebook.com/profile.php',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(decision.status, 'FB_TRAFFIC_DISABLED');
  assert.strictEqual(decision.destination, 'fallback');
});

test('16. Rule 10: Unknown / unverified FB traffic routes to Fallback (Never guess)', () => {
  const link = { fbTrafficEnabled: true, allowFbProfiles: true, allowFbPages: true };
  const decision = simulateRedirectDecision(
    link,
    { query: { fbclid: 'just_fbclid' }, url: '/s/adx?fbclid=just_fbclid' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    { isp: 'Spectrum', isVpn: false }
  );
  assert.strictEqual(decision.status, 'FB_UNKNOWN_BLOCKED');
  assert.strictEqual(decision.destination, 'fallback');
});

test('17. User Case 1: ONLY Profile ALLOWED -> Profile to MAIN, Pages/Groups/Stories/Events/Comments to FALLBACK', () => {
  const link = {
    fbTrafficEnabled: true,
    allowFbProfiles: true,
    allowFbPages: false,
    allowFbGroups: false,
    allowFbStories: false,
    allowFbEvents: false,
    allowFbComments: false
  };

  // Profile traffic
  const prof = simulateRedirectDecision(
    link,
    { query: { fb_profile: '1' }, url: '/s/adx?fb_profile=1' },
    'https://www.facebook.com/profile.php?id=123',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(prof.status, 'ORGANIC_CLICK');
  assert.strictEqual(prof.destination, 'main_url');

  // Page traffic -> FALLBACK
  const page = simulateRedirectDecision(
    link,
    { query: { page_id: '99' }, url: '/s/adx?page_id=99' },
    'https://www.facebook.com/pages/Test',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(page.status, 'FB_PAGE_BLOCKED');
  assert.strictEqual(page.destination, 'fallback');

  // Group traffic -> FALLBACK
  const group = simulateRedirectDecision(
    link,
    { query: { group_id: '88' }, url: '/s/adx?group_id=88' },
    'https://www.facebook.com/groups/Test',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(group.status, 'FB_GROUP_BLOCKED');
  assert.strictEqual(group.destination, 'fallback');

  // Story traffic -> FALLBACK
  const story = simulateRedirectDecision(
    link,
    { query: { sfnsn: 'mo' }, url: '/s/adx?sfnsn=mo' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(story.status, 'FB_STORY_BLOCKED');
  assert.strictEqual(story.destination, 'fallback');

  // Event traffic -> FALLBACK
  const event = simulateRedirectDecision(
    link,
    { query: { eid: '77' }, url: '/s/adx?eid=77' },
    'https://www.facebook.com/events/77',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(event.status, 'FB_EVENT_BLOCKED');
  assert.strictEqual(event.destination, 'fallback');

  // Comment traffic -> FALLBACK
  const comment = simulateRedirectDecision(
    link,
    { query: { comment_id: '66' }, url: '/s/adx?comment_id=66' },
    'https://www.facebook.com/comment.php?id=66',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(comment.status, 'FB_COMMENT_BLOCKED');
  assert.strictEqual(comment.destination, 'fallback');
});

test('18. User Case 2: ONLY Pages ALLOWED -> Pages to MAIN, Profile/Groups/Stories/Events/Comments to FALLBACK', () => {
  const link = {
    fbTrafficEnabled: true,
    allowFbProfiles: false,
    allowFbPages: true,
    allowFbGroups: false,
    allowFbStories: false,
    allowFbEvents: false,
    allowFbComments: false
  };

  // Page -> MAIN
  const page = simulateRedirectDecision(
    link,
    { query: { page_id: '99' }, url: '/s/adx?page_id=99' },
    'https://www.facebook.com/pages/Test',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(page.status, 'ORGANIC_CLICK');
  assert.strictEqual(page.destination, 'main_url');

  // Profile -> FALLBACK
  const prof = simulateRedirectDecision(
    link,
    { query: { fb_profile: '1' }, url: '/s/adx?fb_profile=1' },
    'https://www.facebook.com/profile.php?id=123',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(prof.status, 'FB_PROFILE_BLOCKED');
  assert.strictEqual(prof.destination, 'fallback');
});

test('19. User Case 3: ONLY Groups ALLOWED -> Groups to MAIN, others to FALLBACK', () => {
  const link = {
    fbTrafficEnabled: true,
    allowFbProfiles: false,
    allowFbPages: false,
    allowFbGroups: true,
    allowFbStories: false,
    allowFbEvents: false,
    allowFbComments: false
  };

  const group = simulateRedirectDecision(
    link,
    { query: { group_id: '88' }, url: '/s/adx?group_id=88' },
    'https://www.facebook.com/groups/Test',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(group.status, 'ORGANIC_CLICK');
  assert.strictEqual(group.destination, 'main_url');

  const page = simulateRedirectDecision(
    link,
    { query: { page_id: '99' }, url: '/s/adx?page_id=99' },
    'https://www.facebook.com/pages/Test',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(page.status, 'FB_PAGE_BLOCKED');
  assert.strictEqual(page.destination, 'fallback');
});

test('20. User Case 4: ONLY Stories ALLOWED -> Stories to MAIN, others to FALLBACK', () => {
  const link = {
    fbTrafficEnabled: true,
    allowFbProfiles: false,
    allowFbPages: false,
    allowFbGroups: false,
    allowFbStories: true,
    allowFbEvents: false,
    allowFbComments: false
  };

  const story = simulateRedirectDecision(
    link,
    { query: { sfnsn: 'mo' }, url: '/s/adx?sfnsn=mo' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(story.status, 'ORGANIC_CLICK');
  assert.strictEqual(story.destination, 'main_url');

  const event = simulateRedirectDecision(
    link,
    { query: { eid: '77' }, url: '/s/adx?eid=77' },
    'https://www.facebook.com/events/77',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(event.status, 'FB_EVENT_BLOCKED');
  assert.strictEqual(event.destination, 'fallback');
});

test('21. User Case 5: ONLY Events ALLOWED -> Events to MAIN, others to FALLBACK', () => {
  const link = {
    fbTrafficEnabled: true,
    allowFbProfiles: false,
    allowFbPages: false,
    allowFbGroups: false,
    allowFbStories: false,
    allowFbEvents: true,
    allowFbComments: false
  };

  const event = simulateRedirectDecision(
    link,
    { query: { eid: '77' }, url: '/s/adx?eid=77' },
    'https://www.facebook.com/events/77',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(event.status, 'ORGANIC_CLICK');
  assert.strictEqual(event.destination, 'main_url');

  const comment = simulateRedirectDecision(
    link,
    { query: { comment_id: '66' }, url: '/s/adx?comment_id=66' },
    'https://www.facebook.com/comment.php?id=66',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(comment.status, 'FB_COMMENT_BLOCKED');
  assert.strictEqual(comment.destination, 'fallback');
});

test('22. User Case 6: ONLY Comments ALLOWED -> Comments to MAIN, others to FALLBACK', () => {
  const link = {
    fbTrafficEnabled: true,
    allowFbProfiles: false,
    allowFbPages: false,
    allowFbGroups: false,
    allowFbStories: false,
    allowFbEvents: false,
    allowFbComments: true
  };

  const comment = simulateRedirectDecision(
    link,
    { query: { comment_id: '66' }, url: '/s/adx?comment_id=66' },
    'https://www.facebook.com/comment.php?id=66',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(comment.status, 'ORGANIC_CLICK');
  assert.strictEqual(comment.destination, 'main_url');

  const prof = simulateRedirectDecision(
    link,
    { query: { fb_profile: '1' }, url: '/s/adx?fb_profile=1' },
    'https://www.facebook.com/profile.php?id=123',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(prof.status, 'FB_PROFILE_BLOCKED');
  assert.strictEqual(prof.destination, 'fallback');
});

test('23. Multi-source: Events & Comments ALLOWED -> both to MAIN, others to FALLBACK', () => {
  const link = {
    fbTrafficEnabled: true,
    allowFbProfiles: false,
    allowFbPages: false,
    allowFbGroups: false,
    allowFbStories: false,
    allowFbEvents: true,
    allowFbComments: true
  };

  const event = simulateRedirectDecision(
    link,
    { query: { eid: '77' }, url: '/s/adx?eid=77' },
    'https://www.facebook.com/events/77',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(event.status, 'ORGANIC_CLICK');
  assert.strictEqual(event.destination, 'main_url');

  const comment = simulateRedirectDecision(
    link,
    { query: { comment_id: '66' }, url: '/s/adx?comment_id=66' },
    'https://www.facebook.com/comment.php?id=66',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(comment.status, 'ORGANIC_CLICK');
  assert.strictEqual(comment.destination, 'main_url');

  const story = simulateRedirectDecision(
    link,
    { query: { sfnsn: 'mo' }, url: '/s/adx?sfnsn=mo' },
    'https://l.facebook.com/',
    'Mozilla/5.0 (iPhone)',
    { isp: 'Verizon', isVpn: false }
  );
  assert.strictEqual(story.status, 'FB_STORY_BLOCKED');
  assert.strictEqual(story.destination, 'fallback');
});

test('24. All 6 Sources ALLOWED -> all 6 pass to MAIN, unknown goes to FALLBACK', () => {
  const link = {
    fbTrafficEnabled: true,
    allowFbProfiles: true,
    allowFbPages: true,
    allowFbGroups: true,
    allowFbStories: true,
    allowFbEvents: true,
    allowFbComments: true
  };

  const sources = [
    { name: 'profile', req: { query: { fb_profile: '1' }, url: '/s/adx?fb_profile=1' }, ref: 'https://www.facebook.com/profile.php' },
    { name: 'page', req: { query: { page_id: '1' }, url: '/s/adx?page_id=1' }, ref: 'https://www.facebook.com/pages/Test' },
    { name: 'group', req: { query: { group_id: '1' }, url: '/s/adx?group_id=1' }, ref: 'https://www.facebook.com/groups/Test' },
    { name: 'story', req: { query: { sfnsn: 'mo' }, url: '/s/adx?sfnsn=mo' }, ref: 'https://l.facebook.com/' },
    { name: 'event', req: { query: { eid: '1' }, url: '/s/adx?eid=1' }, ref: 'https://www.facebook.com/events/1' },
    { name: 'comment', req: { query: { comment_id: '1' }, url: '/s/adx?comment_id=1' }, ref: 'https://www.facebook.com/comment.php?id=1' }
  ];

  for (const s of sources) {
    const res = simulateRedirectDecision(link, s.req, s.ref, 'Mozilla/5.0 (iPhone)', { isp: 'Comcast', isVpn: false });
    assert.strictEqual(res.status, 'ORGANIC_CLICK', `Source ${s.name} should pass to MAIN`);
    assert.strictEqual(res.destination, 'main_url', `Source ${s.name} destination should be main_url`);
  }

  // Unknown still blocked
  const unk = simulateRedirectDecision(link, { query: { fbclid: 'xyz' }, url: '/s/adx?fbclid=xyz' }, 'https://l.facebook.com/', 'Mozilla/5.0 (iPhone)', { isp: 'Comcast', isVpn: false });
  assert.strictEqual(unk.status, 'FB_UNKNOWN_BLOCKED');
  assert.strictEqual(unk.destination, 'fallback');
});

test('25. Datacenter ISP auto-blocked to Fallback', () => {
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

test('26. Bot protection ON blocks VPN FB visitor to Fallback', () => {
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
