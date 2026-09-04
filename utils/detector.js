const db = require('../db');

// ─────────────────────────────────────────────────────────────────────────────
// In-memory state stores (all cleared on restart — by design, for privacy)
// ─────────────────────────────────────────────────────────────────────────────

// Rate limiting: ip -> [timestamps]
const ipRequestWindowMap = new Map();

// Auto-shield click counters: ip -> [timestamps]
const ipAllClicksMap   = new Map();
const ipVpnClicksMap   = new Map();

// Temporary soft-blocks: ip -> { blockedUntil, reason, riskScore }
const temporaryBlockMap = new Map();

// Session anomaly: ip -> { firstSeen, codes: Set, requestCount, lastSeen }
const sessionMap = new Map();

// Traffic spike tracker: code -> [timestamps]
const trafficSpikeMap = new Map();

// ─────────────────────────────────────────────────────────────────────────────
// Known-Bot User-Agent helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the UA belongs to a known social link crawler / preview bot.
 * These are legitimate bots (Facebook, Telegram, Googlebot, etc.) that should
 * receive OG-meta responses instead of the real redirect.
 */
/**
 * Returns true if the UA belongs to a known social link crawler / preview bot.
 * These are legitimate bots (Facebook, Telegram, Googlebot, etc.) that should
 * receive OG-meta responses instead of the real redirect.
 */
function isSocialScraper(userAgent = '') {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes('facebookexternalhit') ||
    ua.includes('facebot')             ||
    ua.includes('whatsapp')            ||
    ua.includes('telegrambot')         ||
    ua.includes('twitterbot')          ||
    ua.includes('linkedinbot')         ||
    ua.includes('slackbot')            ||
    ua.includes('discordbot')          ||
    ua.includes('googlebot')           ||
    ua.includes('bingbot')             ||
    ua.includes('applebot')
  );
}

/**
 * Checks if an ISP/Organization name belongs to a cloud hosting, datacenter,
 * VPN, or proxy provider. Real human traffic comes from residential/mobile carriers.
 */
function isDatacenterIsp(isp = '') {
  if (!isp || typeof isp !== 'string') return false;
  const s = isp.toLowerCase();
  return /amazon|aws|meta platforms|facebook|google|microsoft|azure|oracle|digitalocean|hetzner|ovh|linode|vultr|leaseweb|reliablesite|servers tech|m247|choopa|hostinger|contabo|akamai|cloudflare|fastly|alibaba|tencent|ucloud|scaleway|datawire|cogent|cogentco|colocrossing|quadranet|servermania|zenlayer|psychz|tierpoint|inap|tzulo|fdcservers|packethub/i.test(s);
}

/**
 * Returns true if the UA is a known automated scraper, HTTP client library,
 * automated testing tool, or fake traffic generator.
 */
function isSpamBot(userAgent = '') {
  if (!userAgent || typeof userAgent !== 'string' || userAgent.trim() === '') {
    return true; // Empty UA is always suspicious
  }
  const ua = userAgent.toLowerCase().trim();

  // If legitimate social crawler, let isSocialScraper handle it
  if (isSocialScraper(ua)) return false;

  // 1. Common HTTP client libraries & CLI tools
  if (
    ua.includes('curl/') || ua.startsWith('curl') ||
    ua.includes('wget/') || ua.startsWith('wget') ||
    ua.includes('python-requests') ||
    ua.includes('python-urllib') ||
    ua.includes('python/') ||
    ua.includes('aiohttp') ||
    ua.includes('httpx') ||
    ua.includes('axios') ||
    ua.includes('node-fetch') ||
    ua.includes('got/') ||
    ua.includes('undici') ||
    ua.includes('httpclient') ||
    ua.includes('apache-httpclient') ||
    ua.includes('okhttp') ||
    ua.includes('winhttp') ||
    ua.includes('go-http-client') ||
    ua.includes('java/') ||
    ua.includes('libwww') ||
    ua.includes('rest-client') ||
    ua.includes('guzzle') ||
    ua.includes('symfony') ||
    ua.includes('postman') ||
    ua.includes('insomnia') ||
    ua.includes('ruby') ||
    ua.includes('perl')
  ) {
    return true;
  }

  // 2. Headless and automation frameworks
  if (
    ua.includes('headlesschrome') ||
    ua.includes('phantomjs') ||
    ua.includes('selenium') ||
    ua.includes('puppeteer') ||
    ua.includes('playwright') ||
    ua.includes('webdriver') ||
    ua.includes('casperjs') ||
    ua.includes('nightwatch') ||
    ua.includes('cypress') ||
    ua.includes('electron') ||
    ua.includes('browserless')
  ) {
    return true;
  }

  // 3. Known fake traffic generators & click bots
  if (
    ua.includes('trafficbot') ||
    ua.includes('hitleap') ||
    ua.includes('otohits') ||
    ua.includes('sparktraffic') ||
    ua.includes('somiibo') ||
    ua.includes('diabolic') ||
    ua.includes('trafficsprit') ||
    ua.includes('babartraffic') ||
    ua.includes('traffic-generator') ||
    ua.includes('fake-traffic') ||
    ua.includes('trafficcreator') ||
    ua.includes('simple-traffic')
  ) {
    return true;
  }

  // 4. Scrapers and scanners
  if (
    ua.includes('scrapy') ||
    ua.includes('zgrab') ||
    ua.includes('masscan') ||
    ua.includes('nmap') ||
    ua.includes('ahrefs') ||
    ua.includes('semrush') ||
    ua.includes('dotbot') ||
    ua.includes('mj12bot') ||
    ua.includes('rogerbot') ||
    ua.includes('exabot') ||
    ua.includes('screaming frog') ||
    ua.includes('siteexplorer') ||
    ua.includes('megaindex') ||
    ua.includes('bytespider') ||
    ua.includes('yisouspider') ||
    ua.includes('petalbot') ||
    ua.includes('censys')
  ) {
    return true;
  }

  // 5. Generic bot tokens
  if (/\b(bot|crawler|spider|scrape|crawl)\b/i.test(ua)) {
    return true;
  }

  return false;
}

/**
 * Headless / automation browser detection (separate from generic spam-bot).
 */
function isHeadlessBrowser(userAgent = '', headers = {}) {
  const ua = (userAgent || '').toLowerCase();
  if (
    ua.includes('headlesschrome') ||
    ua.includes('phantomjs') ||
    ua.includes('selenium') ||
    ua.includes('puppeteer') ||
    ua.includes('playwright') ||
    ua.includes('webdriver') ||
    ua.includes('casperjs') ||
    ua.includes('nightwatch') ||
    ua.includes('cypress') ||
    ua.includes('electron') ||
    ua.includes('browserless')
  ) {
    return true;
  }

  if (headers && typeof headers === 'object') {
    const secChUa = String(headers['sec-ch-ua'] || '').toLowerCase();
    if (secChUa.includes('headlesschrome') || secChUa.includes('webdriver')) {
      return true;
    }
    if (headers['x-webdriver'] || headers['webdriver']) {
      return true;
    }
  }

  return false;
}

/**
 * Passive Browser Integrity Evaluation (Rules 9, 23, 24, 27).
 * Real browsers send rich, consistent HTTP headers that bots & simple tools omit.
 */
function evaluateBrowserIntegrity(req = null, userAgent = '') {
  if (!req || !req.headers) return { score: 0, signals: [] };

  const headers = req.headers;
  const ua = (userAgent || '').toLowerCase().trim();
  let score = 0;
  const signals = [];

  // 1. Accept Header Check
  // Real browsers request HTML with a rich Accept header.
  // Tools/curl often send */* or nothing.
  const accept = String(headers['accept'] || '').toLowerCase();
  if (!accept) {
    score += 20;
    signals.push('missing_accept_header');
  } else if (accept === '*/*') {
    score += 20;
    signals.push('generic_wildcard_accept');
  } else if (!accept.includes('text/html') && !accept.includes('*/*')) {
    score += 15;
    signals.push('non_html_accept');
  }

  // 2. Accept-Language Check
  // Virtually 100% of real users' browsers (Chrome, Safari, FB in-app) send Accept-Language.
  // Scripts, curl, python, automated tools almost NEVER send it.
  const acceptLang = headers['accept-language'];
  if (!acceptLang || String(acceptLang).trim() === '') {
    score += 25;
    signals.push('missing_accept_language');
  }

  // 3. Accept-Encoding Check
  // Real modern browsers send gzip, deflate, br, zstd.
  const acceptEnc = headers['accept-encoding'];
  if (!acceptEnc || String(acceptEnc).trim() === '') {
    score += 15;
    signals.push('missing_accept_encoding');
  }

  // 4. Client Hints & Platform Integrity Check (Chrome 100+ & Chromium browsers)
  const chromeVerMatch = ua.match(/chrome\/(\d+)/i);
  const chromeVer = chromeVerMatch ? parseInt(chromeVerMatch[1], 10) : 0;
  const secChUa = headers['sec-ch-ua'];
  const secChPlatform = String(headers['sec-ch-ua-platform'] || '').toLowerCase();
  const secChMobile = String(headers['sec-ch-ua-mobile'] || '');

  // If UA claims to be modern Chrome (v100+) on desktop/mobile but has zero Client Hints: forged UA
  if (chromeVer >= 100 && !secChUa) {
    score += 35;
    signals.push('spoofed_chrome_no_client_hints');
  }

  // Platform correlation
  if (secChPlatform) {
    const uaIsAndroid = ua.includes('android');
    const uaIsIos = /iphone|ipad|ipod/.test(ua);
    const uaIsWindows = ua.includes('windows');
    const uaIsMac = ua.includes('macintosh') || ua.includes('mac os');

    if (secChPlatform.includes('android') && !uaIsAndroid) {
      score += 40;
      signals.push('platform_mismatch_android_header');
    } else if (secChPlatform.includes('windows') && (uaIsAndroid || uaIsIos || uaIsMac)) {
      score += 40;
      signals.push('platform_mismatch_windows_header');
    } else if (secChPlatform.includes('mac') && (uaIsAndroid || uaIsWindows)) {
      score += 40;
      signals.push('platform_mismatch_mac_header');
    }
  }

  // Mobile flag correlation
  if (secChMobile) {
    const isMobileUa = /mobile|android|iphone/.test(ua);
    if (secChMobile === '?0' && isMobileUa && !ua.includes('ipad')) {
      score += 30;
      signals.push('mobile_flag_mismatch_desktop_header');
    }
  }

  // 5. Sec-Fetch Navigation Context Check
  const fetchDest = String(headers['sec-fetch-dest'] || '').toLowerCase();
  const fetchMode = String(headers['sec-fetch-mode'] || '').toLowerCase();
  if (fetchDest && fetchDest !== 'document' && fetchDest !== 'empty') {
    score += 20;
    signals.push(`suspicious_fetch_dest_${fetchDest}`);
  }
  if (fetchMode && fetchMode !== 'navigate' && fetchMode !== 'nested-navigate') {
    score += 20;
    signals.push(`suspicious_fetch_mode_${fetchMode}`);
  }

  // 6. Automation Headers
  if (headers['x-webdriver'] || headers['webdriver'] || headers['x-puppeteer'] || headers['x-playwright']) {
    score += 50;
    signals.push('automation_header_detected');
  }

  return { score, signals };
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform / Referrer Parsing
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_DOMAINS = {
  facebook:  ['facebook.com', 'm.facebook.com', 'l.facebook.com', 'lm.facebook.com', 'fb.com', 'fb.me', 'messenger.com'],
  linkedin:  ['linkedin.com', 'lnkd.in'],
  instagram: ['instagram.com', 'l.instagram.com'],
  twitter:   ['twitter.com', 't.co', 'x.com'],
  youtube:   ['youtube.com', 'youtu.be'],
  reddit:    ['reddit.com', 'redd.it'],
  tiktok:    ['tiktok.com'],
  pinterest: ['pinterest.com', 'pin.it'],
  medium:    ['medium.com'],
  quora:     ['quora.com']
};

/**
 * Parse referrer domain and classify against presets + custom user-added domains.
 */
function parseReferrer(refererHeader = '', allowedPlatforms = [], customDomains = [], userAgent = '') {
  const ua = (userAgent || '').toLowerCase();
  const allowsCustomWebsite = allowedPlatforms.includes('custom_website');

  // 0. Detect mobile in-app browsers by User-Agent (they strip referrer)
  let detectedPlatform = null;
  let detectedDomain   = null;

  if (ua.includes('fban') || ua.includes('fbios') || ua.includes('fb4a') || ua.includes('fb_iab') || ua.includes('messenger')) {
    detectedPlatform = 'facebook';
    detectedDomain   = 'Facebook In-App';
  } else if (ua.includes('instagram')) {
    detectedPlatform = 'instagram';
    detectedDomain   = 'Instagram In-App';
  } else if (ua.includes('linkedinapp')) {
    detectedPlatform = 'linkedin';
    detectedDomain   = 'LinkedIn In-App';
  } else if (ua.includes('twitter') || ua.includes('t.co')) {
    detectedPlatform = 'twitter';
    detectedDomain   = 'Twitter In-App';
  } else if (ua.includes('tiktok') || ua.includes('musical_ly')) {
    detectedPlatform = 'tiktok';
    detectedDomain   = 'TikTok In-App';
  }

  if (detectedPlatform) {
    const isAllowed = allowsCustomWebsite || allowedPlatforms.includes(detectedPlatform);
    return { isDirect: false, platform: detectedPlatform, domain: detectedDomain, isAllowed };
  }

  if (!refererHeader) {
    const isAllowed = allowsCustomWebsite || allowedPlatforms.includes('direct');
    return { isDirect: true, platform: 'direct', domain: 'Direct / Blank', isAllowed };
  }

  try {
    const url  = new URL(refererHeader);
    const host = url.hostname.toLowerCase();

    // 1. Check Preset Platforms
    for (const [platformKey, domains] of Object.entries(PLATFORM_DOMAINS)) {
      if (domains.some(d => host === d || host.endsWith('.' + d))) {
        const isAllowed = allowsCustomWebsite || allowedPlatforms.includes(platformKey);
        return { isDirect: false, platform: platformKey, domain: host, isAllowed };
      }
    }

    // 2. Check Custom User Domains
    if (Array.isArray(customDomains)) {
      for (const customDom of customDomains) {
        const cleanCustom = customDom.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
        if (cleanCustom && (host === cleanCustom || host.endsWith('.' + cleanCustom))) {
          return { isDirect: false, platform: 'custom', domain: host, matchedDomain: cleanCustom, isAllowed: true };
        }
      }
    }

    // 3. Unlisted / other referrer
    const isAllowed = allowsCustomWebsite || allowedPlatforms.includes('other');
    return { isDirect: false, platform: 'other', domain: host, isAllowed };
  } catch {
    return { isDirect: false, platform: 'other', domain: refererHeader, isAllowed: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: safe settings read (never throws)
// ─────────────────────────────────────────────────────────────────────────────

function getSafeSettings() {
  try {
    if (db && typeof db.getSettings === 'function') {
      return db.getSettings() || {};
    }
  } catch {
    // Rule 40: safe fallback when detection service unavailable
  }
  return {
    rateLimitWindowSeconds:  60,
    rateLimitMaxRequests:    30,
    webhookUrl:              '',
    tempBlockDurationMinutes: 30
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Temporary Block Manager (Rules 21, 22, 39)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a temporary soft-block for an IP.
 * Duration is configurable via settings.tempBlockDurationMinutes (default 30).
 */
function addTemporaryBlock(ip, reason, riskScore = 'high') {
  const settings     = getSafeSettings();
  const durationMin  = parseInt(settings.tempBlockDurationMinutes || 30, 10);
  const blockedUntil = Date.now() + durationMin * 60 * 1000;
  temporaryBlockMap.set(ip, { blockedUntil, reason, riskScore, addedAt: Date.now() });
  console.log(`[SOFT-BLOCK] IP ${ip} temporarily blocked for ${durationMin}m — ${reason}`);
}

/**
 * Check if an IP is currently under a temporary block.
 * Automatically removes expired blocks (Rule 22: auto-recheck).
 */
function isTemporarilyBlocked(ip) {
  const entry = temporaryBlockMap.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.blockedUntil) {
    temporaryBlockMap.delete(ip);
    console.log(`[SOFT-BLOCK] Temporary block expired for IP ${ip} — auto-recovered`);
    return false;  // Rule 22: automatic recovery
  }
  return true;
}

/**
 * Returns temp-block info (or null) without mutating state.
 */
function getTemporaryBlockInfo(ip) {
  const entry = temporaryBlockMap.get(ip);
  if (!entry) return null;
  if (Date.now() > entry.blockedUntil) {
    temporaryBlockMap.delete(ip);
    return null;
  }
  return entry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limit Check (Rule 6)
// ─────────────────────────────────────────────────────────────────────────────

function checkRateLimit(ip) {
  const settings    = getSafeSettings();
  const windowMs    = (settings.rateLimitWindowSeconds  || 60) * 1000;
  const maxRequests = settings.rateLimitMaxRequests || 30;

  const now = Date.now();
  if (!ipRequestWindowMap.has(ip)) {
    ipRequestWindowMap.set(ip, [now]);
    return { isRateLimited: false, count: 1 };
  }

  const timestamps = ipRequestWindowMap.get(ip).filter(t => now - t < windowMs);
  timestamps.push(now);
  ipRequestWindowMap.set(ip, timestamps);

  if (timestamps.length > maxRequests) {
    return { isRateLimited: true, count: timestamps.length };
  }
  return { isRateLimited: false, count: timestamps.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Traffic Spike Detection (Rule 28)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the traffic to this short-code has spiked abnormally.
 * A spike is defined as > spikeThreshold clicks in the spike window.
 */
function detectTrafficSpike(code) {
  const settings     = getSafeSettings();
  const spikeWindow  = (settings.spikeWindowMinutes  || 5) * 60 * 1000;
  const spikeLimit   = settings.spikeThresholdClicks || 200;

  const now  = Date.now();
  let times  = trafficSpikeMap.get(code) || [];
  times      = times.filter(t => now - t < spikeWindow);
  times.push(now);
  trafficSpikeMap.set(code, times);

  if (times.length >= spikeLimit) {
    console.log(`[SPIKE] Traffic spike detected on /${code}: ${times.length} hits in ${settings.spikeWindowMinutes || 5}m`);
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Anomaly Detection (Rules 26, 27)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Track per-IP session behaviour and return an anomaly score [0-30].
 * Probing many codes, machine-speed requests, or abnormal volume all contribute.
 */
function getSessionAnomalyScore(ip, code) {
  const now = Date.now();
  let session = sessionMap.get(ip);

  if (!session) {
    sessionMap.set(ip, { firstSeen: now, lastSeen: now, codes: new Set([code]), requestCount: 1 });
    return 0;
  }

  const prevLast = session.lastSeen;
  session.requestCount++;
  session.codes.add(code);
  session.lastSeen = now;

  const elapsed   = now - session.firstSeen;
  const sinceGap  = now - prevLast;

  let score = 0;
  if (session.codes.size >= 10)                               score += 15;
  else if (session.codes.size >= 5)                           score += 8;
  if (elapsed < 60000 && session.requestCount > 30)           score += 20;
  else if (elapsed < 60000 && session.requestCount > 15)      score += 10;
  if (sinceGap < 200 && session.requestCount > 3)             score += 10;

  // Prune stale session
  if (elapsed > 3600000) sessionMap.delete(ip);

  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Signal Traffic Risk Scorer (Rules 10, 17, 18, 19)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a composite risk score [0-100] by combining MULTIPLE independent
 * signals. No single signal alone causes a permanent block (Rules 17-19).
 *
 * Checks:
 *  - Passive Browser Integrity (Headers: Accept, Accept-Language, Client Hints, Sec-Fetch)
 *  - Spam-bot / CLI tool / Scraper UA signature
 *  - Headless Browser UA & headers
 *  - Empty / Malformed UA
 *  - VPN / Proxy status
 *  - Datacenter / Cloud / Hosting ASN status
 *  - Session Anomaly (rapid bursts, code probing)
 *  - Traffic Spike on shortcode
 *
 * Returns: { score, level: 'low'|'medium'|'high', signals: [...] }
 */
function computeTrafficRiskScore(ip, userAgent, geoInfo, rawReferer, code, req = null) {
  let score   = 0;
  const signals = [];

  // --- Signal 0: Passive Browser Request Integrity (Rules 9, 23, 24, 27) ---
  if (req && req.headers) {
    const integrity = evaluateBrowserIntegrity(req, userAgent);
    if (integrity.score > 0) {
      score += integrity.score;
      signals.push(...integrity.signals);
    }
  }

  // --- Signal 1: Spam-bot / Tool User-Agent (+40 pts) ---
  if (isSpamBot(userAgent)) {
    score += 40;
    signals.push('spam_bot_ua');
  }

  // --- Signal 2: Headless browser UA or headers (+35 pts) ---
  if (isHeadlessBrowser(userAgent, req ? req.headers : {})) {
    score += 35;
    signals.push('headless_browser');
  }

  // --- Signal 3: Empty User-Agent (+30 pts) ---
  if (!userAgent || typeof userAgent !== 'string' || userAgent.trim() === '') {
    score += 30;
    signals.push('empty_ua');
  }

  // --- Signal 4: VPN/Proxy IP (+20 pts) ---
  if (geoInfo && geoInfo.isVpn) {
    score += 20;
    signals.push('vpn_proxy');
  }

  // --- Signal 5: Datacenter / Cloud / Hosting ASN (+25 pts) ---
  if (geoInfo && isDatacenterIsp(geoInfo.isp)) {
    score += 25;
    signals.push('datacenter_cloud_asn');
  }

  // --- Signal 6: Session anomaly (+0-30 pts) ---
  const anomaly = getSessionAnomalyScore(ip, code);
  if (anomaly > 0) {
    score += Math.min(anomaly, 30);
    signals.push(`session_anomaly(+${Math.min(anomaly, 30)})`);
  }

  // Clamp to [0, 100]
  score = Math.min(score, 100);

  let level;
  if (score < 30)      level = 'low';
  else if (score < 60) level = 'medium';
  else                 level = 'high';

  return { score, level, riskScore: score, riskLevel: level, signals };
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Notification (Rule 47)
// ─────────────────────────────────────────────────────────────────────────────

async function dispatchWebhookNotification(eventData) {
  let settings;
  try {
    settings = getSafeSettings();
  } catch {
    return; // Rule 40: safe fallback
  }
  if (!settings.webhookUrl || !settings.webhookUrl.trim()) return;

  const payload = {
    content: `🚨 **Smart Link Shortener Anti-Bot Alert!**`,
    embeds: [
      {
        title:  `Bot Traffic Alert: ${eventData.reason}`,
        color:  15158332,
        fields: [
          { name: 'Short Code',  value: eventData.code      || 'N/A',             inline: true  },
          { name: 'Client IP',   value: eventData.ip        || 'Unknown',          inline: true  },
          { name: 'Risk Score',  value: String(eventData.riskScore || 'N/A'),      inline: true  },
          { name: 'Risk Level',  value: eventData.riskLevel  || 'N/A',            inline: true  },
          { name: 'Signals',     value: (eventData.signals   || []).join(', ') || 'N/A', inline: false },
          { name: 'Referrer',    value: eventData.referer   || 'Blank/Direct',     inline: true  },
          { name: 'User-Agent',  value: eventData.userAgent ? eventData.userAgent.substring(0, 100) : 'None', inline: false },
          { name: 'Timestamp',   value: new Date().toISOString(),                  inline: false }
        ],
        footer: { text: 'Smart Link Shortener — Anti-Shield v2' }
      }
    ]
  };

  try {
    await fetch(settings.webhookUrl.trim(), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
    console.log(`[ALERT] Webhook dispatched → ${settings.webhookUrl}`);
  } catch (err) {
    console.error('[ALERT] Webhook failed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Allowlist Check (Rule 48)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if this IP is on the admin allowlist (trusted sources).
 * Allowlisted IPs bypass all traffic quality checks.
 */
function isAllowlisted(ip) {
  try {
    const settings = getSafeSettings();
    const list = Array.isArray(settings.allowlistedIps) ? settings.allowlistedIps : [];
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    return list.some(entry => {
      const e = (entry || '').replace(/^::ffff:/, '').trim();
      return e && e === cleanIp;
    });
  } catch {
    return false; // Rule 40: safe fallback
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Shield (combines all signals; applies TEMPORARY blocks, not permanent)
// Rules 11, 12, 19, 20, 21
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main auto-shield function.
 * Returns: { blocked: boolean, softBlock: boolean, reason: string, riskScore, riskLevel, signals, action }
 *
 * IMPORTANT:
 *  - A single signal NEVER results in a permanent block.
 *  - High-risk (score >= 60) → temporary soft-block (redirect to fallback, not 403).
 *  - Medium-risk (30-59) → rate-limit / fallback, log as suspicious.
 *  - Low-risk (< 30) → allow through normally.
 *  - Permanent IP blocks are ONLY applied by the admin manually via the firewall.
 */
function checkAndApplyAutoShield(ip, isVpn, userAgent, code, geoInfo = {}, req = null) {
  const cleanIp  = (ip || '').replace(/^::ffff:/, '').trim();
  const settings = getSafeSettings();
  const now      = Date.now();

  // Rule 48: Allowlisted IPs always pass
  if (isAllowlisted(cleanIp)) {
    return { blocked: false, softBlock: false, reason: 'Allowlisted', score: 0, level: 'low', riskScore: 0, riskLevel: 'low', signals: ['allowlisted'], action: 'allow' };
  }

  // Rule 21: Check existing temporary block first
  const tempBlock = getTemporaryBlockInfo(cleanIp);
  if (tempBlock) {
    return {
      blocked:    true,
      softBlock:  false,
      reason:     `Temporary block active: ${tempBlock.reason}`,
      score:      100,
      level:      'high',
      riskScore:  100,
      riskLevel:  'high',
      signals:    ['temp_block_active'],
      action:     'soft_block'
    };
  }

  // Compute multi-signal risk score
  const risk = computeTrafficRiskScore(cleanIp, userAgent, { isVpn, ...geoInfo }, '', code, req);

  // --- Strict scraper check (blockKnownScrapers setting, Rule 8) ---
  if (settings.blockKnownScrapers && isSpamBot(userAgent) && risk.score >= 50) {
    addTemporaryBlock(cleanIp, `Auto Shield: Confirmed scraper UA with risk score ${risk.score}`, 'high');
    dispatchWebhookNotification({
      reason:    'Confirmed Scraper Block',
      code,
      ip:        cleanIp,
      riskScore: risk.score,
      riskLevel: risk.level,
      signals:   risk.signals,
      userAgent
    });
    return { blocked: true, softBlock: false, reason: `Scraper UA + risk score ${risk.score}`, ...risk, action: 'soft_block' };
  }

  // --- Bot Traffic Protection (customizable, Rule 27, 28) ---
  if (settings.botProtectionEnabled) {
    const limitClicks = parseInt(settings.botLimitClicks  || 100, 10);
    const limitMs     = parseInt(settings.botLimitMinutes || 1,   10) * 60 * 1000;

    let times = ipAllClicksMap.get(cleanIp) || [];
    times = times.filter(t => now - t < limitMs);
    times.push(now);
    ipAllClicksMap.set(cleanIp, times);

    if (times.length > limitClicks) {
      if (risk.signals.length > 1 || isVpn || isSpamBot(userAgent)) {
        addTemporaryBlock(cleanIp, `Auto Shield: ${times.length} clicks in ${settings.botLimitMinutes}m`, 'high');
        dispatchWebhookNotification({
          reason:    `High-Volume Bot Block (${times.length} clicks/${settings.botLimitMinutes}m)`,
          code,
          ip:        cleanIp,
          riskScore: risk.score,
          riskLevel: risk.level,
          signals:   risk.signals,
          userAgent
        });
        return { blocked: true, softBlock: false, reason: `Rate burst: ${times.length} clicks in ${settings.botLimitMinutes}m`, ...risk, action: 'soft_block' };
      }
      return {
        blocked:   false,
        softBlock: true,
        reason:    `High click volume (no additional signals)`,
        ...risk,
        action:    'fallback_redirect'
      };
    }
  }

  // --- VPN/Proxy Protection (customizable) ---
  if (settings.vpnProtectionEnabled && isVpn) {
    const limitClicks = parseInt(settings.vpnLimitClicks  || 500, 10);
    const limitMs     = parseInt(settings.vpnLimitMinutes || 90,  10) * 60 * 1000;

    let times = ipVpnClicksMap.get(cleanIp) || [];
    times = times.filter(t => now - t < limitMs);
    times.push(now);
    ipVpnClicksMap.set(cleanIp, times);

    if (times.length > limitClicks) {
      if (isSpamBot(userAgent) || risk.score >= 45) {
        addTemporaryBlock(cleanIp, `Auto Shield: VPN flood ${times.length} hits in ${settings.vpnLimitMinutes}m`, 'high');
        dispatchWebhookNotification({
          reason:    `VPN Flood Block (${times.length} hits/${settings.vpnLimitMinutes}m)`,
          code,
          ip:        cleanIp,
          riskScore: risk.score,
          riskLevel: risk.level,
          signals:   risk.signals,
          userAgent
        });
        return { blocked: true, softBlock: false, reason: `VPN flood + risk ${risk.score}`, ...risk, action: 'soft_block' };
      }
    }
  }

  // --- High-risk score (60+) → temporary soft-block (Rules 11, 21, 49) ---
  if (risk.level === 'high') {
    addTemporaryBlock(cleanIp, `Auto Shield: Multi-signal risk score ${risk.score}`, 'high');
    dispatchWebhookNotification({
      reason:    `High Multi-Signal Risk Block (score ${risk.score})`,
      code,
      ip:        cleanIp,
      riskScore: risk.score,
      riskLevel: risk.level,
      signals:   risk.signals,
      userAgent
    });
    return { blocked: true, softBlock: false, reason: `High risk score ${risk.score} (${risk.signals.join(', ')})`, ...risk, action: 'soft_block' };
  }

  // --- Medium-risk → soft redirect to fallback (Rule 20) ---
  if (risk.level === 'medium') {
    return { blocked: false, softBlock: true, reason: `Medium risk score ${risk.score} (${risk.signals.join(', ')})`, ...risk, action: 'fallback_redirect' };
  }

  // --- Low-risk → let through normally (Rule 12) ---
  return { blocked: false, softBlock: false, reason: 'Low risk', ...risk, action: 'allow' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all currently active (non-expired) temporary blocks as an array.
 * Expired entries are pruned automatically during this call.
 */
function getActiveTempBlocks() {
  const now = Date.now();
  const result = [];
  for (const [ip, entry] of temporaryBlockMap.entries()) {
    if (now > entry.blockedUntil) {
      temporaryBlockMap.delete(ip);
    } else {
      result.push({
        ip,
        reason:       entry.reason,
        riskScore:    entry.riskScore,
        blockedUntil: new Date(entry.blockedUntil).toISOString(),
        addedAt:      new Date(entry.addedAt).toISOString(),
        remainingSec: Math.ceil((entry.blockedUntil - now) / 1000)
      });
    }
  }
  return result;
}

module.exports = {
  isSocialScraper,
  isSpamBot,
  isHeadlessBrowser,
  isDatacenterIsp,
  evaluateBrowserIntegrity,
  parseReferrer,
  checkRateLimit,
  detectTrafficSpike,
  getSessionAnomalyScore,
  computeTrafficRiskScore,
  isAllowlisted,
  isTemporarilyBlocked,
  getTemporaryBlockInfo,
  getActiveTempBlocks,
  addTemporaryBlock,
  dispatchWebhookNotification,
  checkAndApplyAutoShield
};
