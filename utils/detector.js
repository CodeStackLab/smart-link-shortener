const db = require('../db');

// In-memory rate limiting map: ip -> array of timestamps
const ipRequestWindowMap = new Map();

/**
 * Checks if User-Agent belongs to a known social link crawler / bot / scraper
 */
function isSocialScraper(userAgent = '') {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes('facebookexternalhit') ||
    ua.includes('facebot') ||
    ua.includes('whatsapp') ||
    ua.includes('telegrambot') ||
    ua.includes('twitterbot') ||
    ua.includes('linkedinbot') ||
    ua.includes('slackbot') ||
    ua.includes('discordbot') ||
    ua.includes('googlebot') ||
    ua.includes('bingbot')
  );
}

/**
 * Checks if User-Agent belongs to suspicious automated tools / spam bots
 */
function isSpamBot(userAgent = '') {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes('python-requests') ||
    ua.includes('python-urllib') ||
    ua.includes('curl') ||
    ua.includes('wget') ||
    ua.includes('go-http-client') ||
    ua.includes('postman') ||
    ua.includes('headlesschrome') ||
    ua.includes('phantomjs') ||
    ua.includes('selenium') ||
    ua.includes('puppet') ||
    ua.includes('httpx') ||
    ua.includes('scrapy') ||
    ua.includes('zgrab') ||
    ua === ''
  );
}

/**
 * Map of preset platform domain matchers
 */
const PLATFORM_DOMAINS = {
  facebook: ['facebook.com', 'm.facebook.com', 'l.facebook.com', 'lm.facebook.com', 'fb.com', 'fb.me', 'messenger.com'],
  linkedin: ['linkedin.com', 'lnkd.in'],
  instagram: ['instagram.com', 'l.instagram.com'],
  twitter: ['twitter.com', 't.co', 'x.com'],
  youtube: ['youtube.com', 'youtu.be'],
  reddit: ['reddit.com', 'redd.it'],
  tiktok: ['tiktok.com'],
  pinterest: ['pinterest.com', 'pin.it'],
  medium: ['medium.com'],
  quora: ['quora.com']
};

/**
 * Parse referrer domain and classify against presets + custom user-added domains
 */
function parseReferrer(refererHeader = '', allowedPlatforms = [], customDomains = [], userAgent = '') {
  const ua = (userAgent || '').toLowerCase();
  // "Custom Website" is the unrestricted traffic-source option. When it is
  // selected, a visit from any referrer (including direct/app traffic) is a
  // genuine target visit rather than an incorrect fallback redirect.
  const allowsCustomWebsite = allowedPlatforms.includes('custom_website');

  // 0. Check User-Agent for known mobile app in-app browsers (which often strip referrer)
  let detectedPlatform = null;
  let detectedDomain = null;

  if (ua.includes('fban') || ua.includes('fbios') || ua.includes('fb4a') || ua.includes('fb_iab') || ua.includes('messenger')) {
    detectedPlatform = 'facebook';
    detectedDomain = 'Facebook In-App';
  } else if (ua.includes('instagram')) {
    detectedPlatform = 'instagram';
    detectedDomain = 'Instagram In-App';
  } else if (ua.includes('linkedinapp')) {
    detectedPlatform = 'linkedin';
    detectedDomain = 'LinkedIn In-App';
  } else if (ua.includes('twitter') || ua.includes('t.co')) {
    detectedPlatform = 'twitter';
    detectedDomain = 'Twitter In-App';
  } else if (ua.includes('tiktok') || ua.includes('musical_ly')) {
    detectedPlatform = 'tiktok';
    detectedDomain = 'TikTok In-App';
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
    const url = new URL(refererHeader);
    const host = url.hostname.toLowerCase();

    // 1. Check Preset Platforms
    for (const [platformKey, domains] of Object.entries(PLATFORM_DOMAINS)) {
      if (domains.some(d => host === d || host.endsWith('.' + d))) {
        const isAllowed = allowsCustomWebsite || allowedPlatforms.includes(platformKey);
        return { isDirect: false, platform: platformKey, domain: host, isAllowed };
      }
    }

    // 2. Check Custom User Domains (e.g. myblog.com, custompartner.org)
    if (Array.isArray(customDomains)) {
      for (const customDom of customDomains) {
        const cleanCustom = customDom.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
        if (cleanCustom && (host === cleanCustom || host.endsWith('.' + cleanCustom))) {
          return { isDirect: false, platform: 'custom', domain: host, matchedDomain: cleanCustom, isAllowed: true };
        }
      }
    }

    // 3. Unlisted Other Referrer
    const isAllowed = allowsCustomWebsite || allowedPlatforms.includes('other');
    return { isDirect: false, platform: 'other', domain: host, isAllowed };
  } catch (err) {
    return { isDirect: false, platform: 'other', domain: refererHeader, isAllowed: false };
  }
}

function getSafeSettings() {
  if (db && typeof db.getSettings === 'function') {
    return db.getSettings() || {};
  }
  return { rateLimitWindowSeconds: 60, rateLimitMaxRequests: 30, webhookUrl: '' };
}

/**
 * Rate limit check per IP address
 */
function checkRateLimit(ip) {
  const settings = getSafeSettings();
  const windowMs = (settings.rateLimitWindowSeconds || 60) * 1000;
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

/**
 * Dispatch Webhook Notification when bot / rate limit burst detected
 */
async function dispatchWebhookNotification(eventData) {
  const settings = getSafeSettings();
  if (!settings.webhookUrl || !settings.webhookUrl.trim()) return;

  const payload = {
    content: `🚨 **Smart Link Shortener Anti-Bot Alert!**`,
    embeds: [
      {
        title: `Bot Traffic Alert: ${eventData.reason}`,
        color: 15158332, // Red color
        fields: [
          { name: 'Short Code', value: eventData.code || 'N/A', inline: true },
          { name: 'Client IP', value: eventData.ip || 'Unknown', inline: true },
          { name: 'Referrer', value: eventData.referer || 'Blank/Direct', inline: true },
          { name: 'User-Agent', value: eventData.userAgent ? eventData.userAgent.substring(0, 100) : 'None', inline: false },
          { name: 'Timestamp', value: new Date().toISOString(), inline: false }
        ],
        footer: { text: 'Coolify Link Shortener Anti-Shield' }
      }
    ]
  };

  try {
    await fetch(settings.webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`[ALERT] Webhook notification dispatched to ${settings.webhookUrl}`);
  } catch (err) {
    console.error('[ALERT] Failed to dispatch webhook:', err.message);
  }
}

// IP click history tracking maps for Auto-Blocking Firewall
const ipAllClicksMap = new Map();
const ipVpnClicksMap = new Map();

function checkAndApplyAutoShield(ip, isVpn, userAgent, code) {
  const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
  const settings = getSafeSettings();
  const now = Date.now();

  // 1. Strict User-Agent Scraper Check (Advanced Option)
  if (settings.blockKnownScrapers && isSpamBot(userAgent)) {
    db.blockIp(cleanIp, `Auto Shield: Blocked known scraper UA: ${userAgent.substring(0, 60)}`);
    dispatchWebhookNotification({
      reason: 'Strict Scraper Block',
      code: code,
      ip: cleanIp,
      referer: 'Auto Shield',
      userAgent: userAgent
    });
    return true; // Blocked
  }

  // 2. Standard Bot Traffic Protection (Customizable)
  if (settings.botProtectionEnabled) {
    const limitClicks = parseInt(settings.botLimitClicks || 100, 10);
    const limitMs = parseInt(settings.botLimitMinutes || 1, 10) * 60 * 1000;

    let times = ipAllClicksMap.get(cleanIp) || [];
    times = times.filter(t => now - t < limitMs);
    times.push(now);
    ipAllClicksMap.set(cleanIp, times);

    if (times.length > limitClicks) {
      db.blockIp(cleanIp, `Auto Shield: Bot protection triggered (${times.length} clicks in ${settings.botLimitMinutes}m)`);
      dispatchWebhookNotification({
        reason: `Auto Bot Traffic Block (${times.length} clicks in ${settings.botLimitMinutes}m)`,
        code: code,
        ip: cleanIp,
        referer: 'Auto Shield',
        userAgent: userAgent
      });
      return true; // Blocked
    }
  }

  // 3. VPN/Proxy Traffic Protection (Customizable)
  if (settings.vpnProtectionEnabled && isVpn) {
    const limitClicks = parseInt(settings.vpnLimitClicks || 500, 10);
    const limitMs = parseInt(settings.vpnLimitMinutes || 90, 10) * 60 * 1000;

    let times = ipVpnClicksMap.get(cleanIp) || [];
    times = times.filter(t => now - t < limitMs);
    times.push(now);
    ipVpnClicksMap.set(cleanIp, times);

    if (times.length > limitClicks) {
      db.blockIp(cleanIp, `Auto Shield: VPN protection triggered (${times.length} VPN hits in ${settings.vpnLimitMinutes}m)`);
      dispatchWebhookNotification({
        reason: `Auto VPN Traffic Block (${times.length} VPN hits in ${settings.vpnLimitMinutes}m)`,
        code: code,
        ip: cleanIp,
        referer: 'Auto Shield',
        userAgent: userAgent
      });
      return true; // Blocked
    }
  }

  return false;
}

module.exports = {
  isSocialScraper,
  isSpamBot,
  parseReferrer,
  checkRateLimit,
  dispatchWebhookNotification,
  checkAndApplyAutoShield
};
