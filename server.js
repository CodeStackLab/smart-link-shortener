const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = require('./db');
const { requireAuth } = require('./middleware/auth');
const {
  isSocialScraper,
  isSpamBot,
  parseReferrer,
  checkRateLimit,
  checkAndApplyAutoShield
} = require('./utils/detector');
const { lookupIp, lookupIpAsync } = require('./utils/geoDetector');
const { generateQrDataUrl } = require('./utils/qrGenerator');
const { fetchOgMeta } = require('./utils/ogFetcher');

const totp = require('./utils/totp');

function ensureAbsoluteUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return 'https://' + trimmed;
}

function isAdminRole(role) {
  return typeof role === 'string' && role.trim().toLowerCase() === 'admin';
}

function getUserPermissions(username, role) {
  if (isAdminRole(role)) return db.getDefaultPermissions('Admin');
  const user = db.getUserByUsername(username);
  return user && Array.isArray(user.permissions) && user.permissions.length > 0
    ? user.permissions
    : db.getDefaultPermissions('Editor');
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (isAdminRole(req.session.role) || getUserPermissions(req.session.username, req.session.role).includes(permission)) {
      return next();
    }
    return res.status(403).json({ error: `Access denied. Your account does not have ${permission} permission.` });
  };
}

function normaliseAllowedDomains(domains) {
  if (!Array.isArray(domains)) return [];

  return [...new Set(domains
    .map(domain => {
      if (typeof domain !== 'string' || !domain.trim()) return '';
      try {
        const value = /^https?:\/\//i.test(domain.trim()) ? domain.trim() : `https://${domain.trim()}`;
        return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
      } catch {
        return '';
      }
    })
    .filter(Boolean))];
}

function getClientIp(req) {
  // Proxies append their own address to X-Forwarded-For; the first valid value
  // is the visitor address. Cloudflare's dedicated header takes precedence.
  const candidates = [
    req.headers['cf-connecting-ip'],
    req.headers['x-forwarded-for'],
    req.headers['x-real-ip'],
    req.socket && req.socket.remoteAddress
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const ip = candidate.split(',')[0].trim().replace(/^\[|\]$/g, '').replace(/^::ffff:/i, '');
    if (ip) return ip;
  }
  return '127.0.0.1';
}

function isSocialRelayRequest(geoInfo, referer = '', userAgent = '') {
  const network = String(geoInfo && geoInfo.isp || '').toLowerCase();
  const source = String(referer || '').toLowerCase();
  const ua = String(userAgent || '').toLowerCase();
  const fromFacebook = /(^https?:\/\/)?([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me|messenger\.com)/.test(source);
  const isFacebookApp = /fb_iab|fb4a|fban|fbios|messenger/.test(ua);
  // Facebook's link-preview/relay fleet often sends a desktop browser UA, so
  // UA matching alone cannot distinguish it from a real visit. It may use a
  // Meta IP or a hosted cloud IP, but it does not use Facebook's mobile app UA.
  const isMetaNetwork = /facebook|meta platforms|instagram/.test(network);
  const isHostedPreview = Boolean(geoInfo && geoInfo.isVpn) && !isFacebookApp && /windows nt|macintosh|x11/.test(ua);
  return fromFacebook && (isMetaNetwork || isHostedPreview);
}

function isDuplicateTrafficClick(code, ip, windowMs = 5000) {
  const now = Date.now();
  return db.getLogs().some(log => {
    if (!log || log.code !== code || log.ip !== ip) return false;
    if (log.status !== 'ORGANIC_CLICK' && log.status !== 'FALLBACK_REDIRECT') return false;
    const timestamp = new Date(log.timestamp).getTime();
    return Number.isFinite(timestamp) && now - timestamp >= 0 && now - timestamp < windowMs;
  });
}

function isTargetUrlAllowedForUser(username, userRole, targetUrl, iosUrl, androidUrl) {
  // Administrators are never subject to editor target-site restrictions.
  if (isAdminRole(userRole)) {
    return { allowed: true };
  }

  const userObj = db.getUserByUsername(username);
  const userPerms = (userObj && Array.isArray(userObj.permissions)) ? userObj.permissions : [];

  // If Editor has 'custom_website' permission, allow any custom website target URL!
  if (userPerms.includes('custom_website')) {
    return { allowed: true };
  }

  const userAllowed = normaliseAllowedDomains(userObj && userObj.allowedTargetDomains);
  const settings = db.getSettings();
  if (settings.restrictEditorDomains === false) {
    return { allowed: true };
  }
  const globalAllowed = normaliseAllowedDomains(settings.allowedTargetDomains);

  const combinedAllowed = userAllowed.length > 0 ? userAllowed : globalAllowed;

  if (combinedAllowed.length === 0) {
    return { allowed: true };
  }

  const cleanAllowed = normaliseAllowedDomains(combinedAllowed);

  if (cleanAllowed.length === 0) {
    return { allowed: true };
  }

  const urlsToCheck = [targetUrl, iosUrl, androidUrl].filter(Boolean);

  for (const urlStr of urlsToCheck) {
    try {
      const parsed = new URL(/^https?:\/\//i.test(urlStr) ? urlStr : 'https://' + urlStr);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

      const isMatched = cleanAllowed.some(cleanAllowedDom => host === cleanAllowedDom || host.endsWith('.' + cleanAllowedDom));

      if (!isMatched) {
        return {
          allowed: false,
          error: `Access Denied: Target website '${host}' is not in your assigned allowed websites list (${cleanAllowed.join(', ')}). Contact Admin to assign this website or grant Custom Website permission.`
        };
      }
    } catch (e) {
      return { allowed: false, error: `Invalid URL format: ${urlStr}` };
    }
  }

  return { allowed: true };
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'link_shortener_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// AUTHENTICATION ROUTES
// ----------------------------------------------------

app.post('/api/login', (req, res) => {
  const { username, password, totpCode } = req.body;
  const targetUsername = (username || 'admin').trim();

  const user = db.getUserByUsername(targetUsername);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  let authenticated = false;

  // Option 1: Authenticate via 6-digit Authenticator TOTP Code
  if (totpCode && totpCode.toString().trim().length > 0) {
    const user2FA = db.get2FAStatus(user.username);
    if (user2FA.secret && totp.verifyTOTP(totpCode, user2FA.secret)) {
      authenticated = true;
    } else {
      return res.status(401).json({ error: 'Invalid or expired 6-digit Authenticator code.' });
    }
  }

  // Option 2: Authenticate via Admin Password
  if (!authenticated && password && password.toString().trim().length > 0) {
    if (bcrypt.compareSync(password.trim(), user.passwordHash)) {
      authenticated = true;
    } else {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
  }

  if (!authenticated) {
    return res.status(400).json({ error: 'Please enter a valid password or 6-digit Authenticator code.' });
  }

  const userPerms = getUserPermissions(user.username, user.role || 'Admin');
  req.session.isAdmin = true;
  req.session.authenticated = true;
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role || 'Admin';
  req.session.permissions = userPerms;

  return res.json({ success: true, message: 'Login successful', username: user.username, role: user.role, permissions: userPerms });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out' });
});

app.get('/api/session', (req, res) => {
  if (req.session && req.session.isAdmin) {
    const userObj = db.getUserByUsername(req.session.username);
    if (req.session.username !== 'admin' && !userObj) {
      req.session.destroy();
      return res.json({ authenticated: false });
    }

    const settings = db.getSettings();
    const userAllowed = normaliseAllowedDomains(userObj && userObj.allowedTargetDomains);
    const globalAllowed = normaliseAllowedDomains(settings.allowedTargetDomains);
    const role = (userObj && userObj.role) ? userObj.role : req.session.role;
    // A personal assignment takes precedence; otherwise editors see the same
    // global list that the server will enforce when restrictions are enabled.
    const finalAllowed = !isAdminRole(role) && settings.restrictEditorDomains !== false
      ? (userAllowed.length > 0 ? userAllowed : globalAllowed)
      : [];

    // Always read fresh permissions from DB (respects admin edits without requiring re-login)
    const perms = getUserPermissions(req.session.username, role);

    return res.json({
      authenticated: true,
      username: req.session.username,
      role,
      permissions: perms,
      allowedTargetDomains: finalAllowed
    });
  }
  return res.json({ authenticated: false });
});


// ----------------------------------------------------
// ADMIN LINK MANAGEMENT APIs (Protected)
// ----------------------------------------------------

app.get('/api/admin/links', requireAuth, (req, res) => {
  const links = db.getLinks();
  if (isAdminRole(req.session.role)) {
    return res.json(links);
  }
  const userLinks = links.filter(l => l.createdBy === req.session.username);
  res.json(userLinks);
});

app.post('/api/admin/links', requireAuth, requirePermission('links'), (req, res) => {

  const {
    code,
    targetUrl,
    fallbackUrl,
    allowedPlatforms,
    customDomains,
    delaySeconds,
    maxClicks,
    hourlyLimit,
    dailyLimit,
    monthlyLimit,
    expiresAt,
    iosUrl,
    androidUrl,
    domain
  } = req.body;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Target URL is required.' });
  }

  const domainCheck = isTargetUrlAllowedForUser(req.session.username, req.session.role, targetUrl, iosUrl, androidUrl);
  if (!domainCheck.allowed) {
    return res.status(403).json({ error: domainCheck.error });
  }

  let cleanCode = '';
  if (code && code.trim()) {
    cleanCode = code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanCode) {
      return res.status(400).json({ error: 'Invalid short code characters.' });
    }
    const existing = db.getLinkByCode(cleanCode);
    if (existing) {
      return res.status(400).json({ error: 'Short code already exists. Please choose another.' });
    }
  } else {
    // Generate automated short code slug (6 random alphanumeric characters)
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 15) {
      cleanCode = Math.random().toString(36).substring(2, 8);
      if (!db.getLinkByCode(cleanCode)) {
        isUnique = true;
      }
      attempts++;
    }
    if (!isUnique) {
      return res.status(500).json({ error: 'Failed to generate a unique short code slug. Please try again.' });
    }
  }

  let processedCustomDomains = [];
  if (Array.isArray(customDomains)) {
    processedCustomDomains = customDomains
      .map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0])
      .filter(Boolean);
  } else if (typeof customDomains === 'string') {
    processedCustomDomains = customDomains
      .split(',')
      .map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0])
      .filter(Boolean);
  }

  // Server-side: enforce platform permissions for non-Admin users
  let finalAllowedPlatforms = Array.isArray(allowedPlatforms) ? allowedPlatforms : ['facebook', 'direct'];
  if (!isAdminRole(req.session.role)) {
    const userPerms = getUserPermissions(req.session.username, req.session.role);
    // Only keep platforms the user has permission for
    const platformPermMap = { facebook: 'facebook', instagram: 'instagram', custom_website: 'custom_website' };
    finalAllowedPlatforms = finalAllowedPlatforms.filter(p => {
      const permKey = platformPermMap[p];
      return !permKey || userPerms.includes(permKey);
    });
    if (finalAllowedPlatforms.length === 0) finalAllowedPlatforms = ['facebook'];
  }

  const newLink = {
    id: 'link_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    code: cleanCode,
    targetUrl: ensureAbsoluteUrl(targetUrl),
    fallbackUrl: 'https://www.google.com/',
    allowedPlatforms: finalAllowedPlatforms,
    customDomains: processedCustomDomains,
    delaySeconds: Math.max(0, parseInt(delaySeconds || 0, 10)),
    maxClicks: Math.max(0, parseInt(maxClicks || 0, 10)),
    hourlyLimit: Math.max(0, parseInt(hourlyLimit || 0, 10)),
    dailyLimit: Math.max(0, parseInt(dailyLimit || 0, 10)),
    monthlyLimit: Math.max(0, parseInt(monthlyLimit || 0, 10)),
    expiresAt: expiresAt ? expiresAt.trim() : '',
    iosUrl: iosUrl ? ensureAbsoluteUrl(iosUrl) : '',
    androidUrl: androidUrl ? ensureAbsoluteUrl(androidUrl) : '',
    active: true,
    createdAt: new Date().toISOString(),
    clicks: 0,
    domain: domain ? domain.trim().toLowerCase() : '',
    createdBy: req.session.username || 'admin'
  };

  db.addLink(newLink);
  res.json({ success: true, link: newLink });
});

app.put('/api/admin/links/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const existingLink = db.getLinks().find(l => l.id === id);
  if (!existingLink) {
    return res.status(404).json({ error: 'Link not found.' });
  }
  if (!isAdminRole(req.session.role)) {
    const userPerms = getUserPermissions(req.session.username, req.session.role);
    if (!userPerms.includes('links')) {
      return res.status(403).json({ error: 'Access denied. Your account does not have Shortlinks edit permission.' });
    }
    if (existingLink.createdBy !== req.session.username) {
      return res.status(403).json({ error: 'Access denied. You can only modify your own created links.' });
    }
  }

  const {
    targetUrl,
    fallbackUrl,
    allowedPlatforms,
    customDomains,
    delaySeconds,
    maxClicks,
    hourlyLimit,
    dailyLimit,
    monthlyLimit,
    expiresAt,
    iosUrl,
    androidUrl,
    active,
    domain
  } = req.body;

  if (targetUrl) {
    const domainCheck = isTargetUrlAllowedForUser(req.session.username, req.session.role, targetUrl, iosUrl, androidUrl);
    if (!domainCheck.allowed) {
      return res.status(403).json({ error: domainCheck.error });
    }
  }

  let processedCustomDomains = undefined;
  if (Array.isArray(customDomains)) {
    processedCustomDomains = customDomains
      .map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0])
      .filter(Boolean);
  } else if (typeof customDomains === 'string') {
    processedCustomDomains = customDomains
      .split(',')
      .map(d => d.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0])
      .filter(Boolean);
  }

  const updated = db.updateLink(id, {
    targetUrl: targetUrl ? ensureAbsoluteUrl(targetUrl) : undefined,
    fallbackUrl: 'https://www.google.com/',
    allowedPlatforms: Array.isArray(allowedPlatforms) ? allowedPlatforms : undefined,
    customDomains: processedCustomDomains,
    delaySeconds: delaySeconds !== undefined ? Math.max(0, parseInt(delaySeconds, 10)) : undefined,
    maxClicks: maxClicks !== undefined ? Math.max(0, parseInt(maxClicks, 10)) : undefined,
    hourlyLimit: hourlyLimit !== undefined ? Math.max(0, parseInt(hourlyLimit, 10)) : undefined,
    dailyLimit: dailyLimit !== undefined ? Math.max(0, parseInt(dailyLimit, 10)) : undefined,
    monthlyLimit: monthlyLimit !== undefined ? Math.max(0, parseInt(monthlyLimit, 10)) : undefined,
    expiresAt: expiresAt !== undefined ? expiresAt.trim() : undefined,
    iosUrl: iosUrl !== undefined ? (iosUrl ? ensureAbsoluteUrl(iosUrl) : '') : undefined,
    androidUrl: androidUrl !== undefined ? (androidUrl ? ensureAbsoluteUrl(androidUrl) : '') : undefined,
    active: typeof active === 'boolean' ? active : undefined,
    domain: domain !== undefined ? (domain ? domain.trim().toLowerCase() : '') : undefined
  });

  res.json({ success: true, link: updated });
});

app.delete('/api/admin/links/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const existingLink = db.getLinks().find(l => l.id === id);
  if (existingLink && !isAdminRole(req.session.role)) {
    const userPerms = getUserPermissions(req.session.username, req.session.role);
    if (!userPerms.includes('links')) {
      return res.status(403).json({ error: 'Access denied. Your account does not have Shortlinks delete permission.' });
    }
    if (existingLink.createdBy !== req.session.username) {
      return res.status(403).json({ error: 'Access denied. You can only delete your own created links.' });
    }
  }
  db.deleteLink(id);
  res.json({ success: true });
});

// QR Code API (Publicly accessible for shortlink QR generation)
app.get('/api/admin/qrcode/:code', async (req, res) => {
  const { code } = req.params;
  const link = db.getLinkByCode(code);
  if (!link) return res.status(404).json({ error: 'Link not found' });

  const fullUrl = `${req.protocol}://${req.get('host')}/s/${link.code}`;
  const qrUrl = await generateQrDataUrl(fullUrl, 300);
  res.json({ code: link.code, fullUrl, qrUrl });
});

// CSV Export Endpoint
app.get('/api/admin/export-csv', requireAuth, requirePermission('analytics'), (req, res) => {
  const logs = db.getLogs();
  
  let csv = 'Timestamp,ShortCode,IP,ISP,Country,City,ConnectionType,Status,Referrer,DwellTimeSeconds\n';
  logs.forEach(l => {
    const isVpn = l.isVpn || l.isVps ? 'VPN/Proxy' : 'Residential';
    const row = [
      `"${l.timestamp}"`,
      `"${l.code || ''}"`,
      `"${l.ip || ''}"`,
      `"${(l.isp || '').replace(/"/g, '""')}"`,
      `"${l.countryName || ''}"`,
      `"${l.city || ''}"`,
      `"${isVpn}"`,
      `"${l.status || ''}"`,
      `"${(l.referer || '').replace(/"/g, '""')}"`,
      l.durationSeconds || 0
    ].join(',');
    csv += row + '\n';
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=traffic_logs_${Date.now()}.csv`);
  res.send(csv);
});

// ----------------------------------------------------
// IP FIREWALL & BLOCKING APIs (Protected)
// ----------------------------------------------------

app.get('/api/admin/blocked-ips', requireAuth, requirePermission('firewall'), (req, res) => {
  const blocked = db.getBlockedIps();
  res.json(blocked);
});

app.post('/api/admin/block-ip', requireAuth, requirePermission('firewall'), (req, res) => {
  const { ip, reason } = req.body;
  if (!ip || !ip.trim()) {
    return res.status(400).json({ error: 'IP address is required.' });
  }

  const result = db.blockIp(ip.trim(), reason || 'Manual Firewall Block');
  if (!result) {
    return res.status(400).json({ error: 'IP address is already blocked.' });
  }

  res.json({ success: true, entry: result });
});

app.delete('/api/admin/blocked-ips/:ip', requireAuth, requirePermission('firewall'), (req, res) => {
  const { ip } = req.params;
  db.unblockIp(decodeURIComponent(ip));
  res.json({ success: true });
});

app.get('/api/admin/settings', requireAuth, requirePermission('settings'), (req, res) => {
  res.json(db.getSettings());
});

app.post('/api/admin/settings', requireAuth, requirePermission('settings'), (req, res) => {
  const {
    rateLimitWindowSeconds,
    rateLimitMaxRequests,
    webhookUrl,
    botProtectionEnabled,
    vpnProtectionEnabled,
    botLimitClicks,
    botLimitMinutes,
    vpnLimitClicks,
    vpnLimitMinutes,
    blockSuspiciousCountries,
    blockKnownScrapers,
    honeypotProtectionEnabled,
    restrictEditorDomains,
    allowedTargetDomains
  } = req.body;

  let processedAllowedDomains = undefined;
  if (Array.isArray(allowedTargetDomains)) {
    processedAllowedDomains = allowedTargetDomains
      .map(d => (typeof d === 'string' ? d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : ''))
      .filter(Boolean);
  }

  const updated = db.updateSettings({
    rateLimitWindowSeconds: rateLimitWindowSeconds !== undefined ? parseInt(rateLimitWindowSeconds, 10) : undefined,
    rateLimitMaxRequests: rateLimitMaxRequests !== undefined ? parseInt(rateLimitMaxRequests, 10) : undefined,
    webhookUrl: webhookUrl !== undefined ? webhookUrl.trim() : undefined,
    botProtectionEnabled: botProtectionEnabled !== undefined ? !!botProtectionEnabled : undefined,
    vpnProtectionEnabled: vpnProtectionEnabled !== undefined ? !!vpnProtectionEnabled : undefined,
    botLimitClicks: botLimitClicks !== undefined ? parseInt(botLimitClicks, 10) : undefined,
    botLimitMinutes: botLimitMinutes !== undefined ? parseInt(botLimitMinutes, 10) : undefined,
    vpnLimitClicks: vpnLimitClicks !== undefined ? parseInt(vpnLimitClicks, 10) : undefined,
    vpnLimitMinutes: vpnLimitMinutes !== undefined ? parseInt(vpnLimitMinutes, 10) : undefined,
    blockSuspiciousCountries: blockSuspiciousCountries !== undefined ? !!blockSuspiciousCountries : undefined,
    blockKnownScrapers: blockKnownScrapers !== undefined ? !!blockKnownScrapers : undefined,
    honeypotProtectionEnabled: honeypotProtectionEnabled !== undefined ? !!honeypotProtectionEnabled : undefined,
    restrictEditorDomains: restrictEditorDomains !== undefined ? !!restrictEditorDomains : undefined,
    allowedTargetDomains: processedAllowedDomains
  });

  res.json({ success: true, settings: updated });
});

// ----------------------------------------------------
// ADVANCED COUNTRY & VPN ANALYTICS APIs (Protected)
// ----------------------------------------------------

app.get('/api/admin/analytics/countries', requireAuth, requirePermission('geo'), (req, res) => {
  const { startDate, endDate } = req.query;
  let logs = db.getLogs();

  if (!isAdminRole(req.session.role)) {
    const userCodes = db.getLinks()
      .filter(l => l.createdBy === req.session.username)
      .map(l => (l.code || '').toLowerCase());
    logs = logs.filter(l => l.code && userCodes.includes(l.code.toLowerCase()));
  }

  let filteredLogs = logs;
  if (startDate && endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime() + 86400000;
    filteredLogs = logs.filter(l => {
      const t = new Date(l.timestamp).getTime();
      return t >= start && t <= end;
    });
  }

  const countryMap = {};
  let totalVpnClicks = 0;
  let totalGenuineClicks = 0;
  const dailyTraffic = {};

  filteredLogs.forEach(log => {
    // Ignore social crawlers (e.g. Facebook preview bot) & firewall blocked logs from country traffic stats
    if (log.status === 'SOCIAL_CRAWLER' || log.status === 'IP_FIREWALL_BLOCKED') return;

    // Never label unknown/legacy traffic as United States. That caused the
    // country report to show incorrect US traffic for logs without geo data.
    const code = log.countryCode || 'UN';
    const countryName = log.countryName || 'Unknown Country';
    const flag = log.flag || '🌐';
    const isVpn = log.isVpn || log.isVps || false;

    if (!countryMap[code]) {
      countryMap[code] = {
        code,
        name: countryName,
        flag,
        totalClicks: 0,
        organicClicks: 0,
        fallbackClicks: 0,
        vpnClicks: 0
      };
    }

    countryMap[code].totalClicks++;
    if (log.status === 'ORGANIC_CLICK') countryMap[code].organicClicks++;
    if (log.status === 'FALLBACK_REDIRECT') countryMap[code].fallbackClicks++;
    if (isVpn) {
      countryMap[code].vpnClicks++;
      totalVpnClicks++;
    } else if (log.status === 'ORGANIC_CLICK') {
      totalGenuineClicks++;
    }

    const ts = log && log.timestamp ? String(log.timestamp) : new Date().toISOString();
    const dayKey = ts.includes('T') ? ts.split('T')[0] : ts.slice(0, 10);
    if (!dailyTraffic[dayKey]) {
      dailyTraffic[dayKey] = { date: dayKey, total: 0, vpn: 0, organic: 0 };
    }
    dailyTraffic[dayKey].total++;
    if (isVpn) dailyTraffic[dayKey].vpn++;
    if (log.status === 'ORGANIC_CLICK') dailyTraffic[dayKey].organic++;
  });

  const countryList = Object.values(countryMap).sort((a, b) => b.totalClicks - a.totalClicks);

  res.json({
    totalLogs: filteredLogs.length,
    totalVpnClicks,
    totalGenuineClicks,
    countries: countryList,
    dailyTraffic: Object.values(dailyTraffic).sort((a, b) => a.date.localeCompare(b.date))
  });
});

// Visitor Duration Pingback endpoint
app.post('/api/pingback', (req, res) => {
  const processPingback = (bodyObj) => {
    if (!bodyObj) return;
    const { logId, durationSeconds } = bodyObj;
    if (logId && typeof durationSeconds === 'number') {
      db.updateLogDuration(logId, durationSeconds);
    }
  };

  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    processPingback(req.body);
    return res.json({ ok: true });
  }

  // Parse raw text/plain body from navigator.sendBeacon
  let rawData = '';
  req.on('data', chunk => {
    rawData += chunk;
  });
  req.on('end', () => {
    try {
      if (rawData) {
        const parsed = JSON.parse(rawData);
        processPingback(parsed);
      }
    } catch (_) {}
    res.json({ ok: true });
  });
});

// ----------------------------------------------------
// USER & TEAM MANAGEMENT APIs (Protected)
// ----------------------------------------------------

app.get('/api/admin/users', requireAuth, (req, res) => {
  if (!isAdminRole(req.session.role)) {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  res.json(db.getUsersPublic());
});


app.post('/api/admin/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const currentUser = db.getUserByUsername(req.session.username);
  if (!currentUser) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const isMatch = bcrypt.compareSync(currentPassword.trim(), currentUser.passwordHash);
  if (!isMatch) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const newHash = bcrypt.hashSync(newPassword.trim(), salt);
  db.updateUserPassword(currentUser.username, newHash);

  res.json({ success: true, message: 'Password updated successfully' });
});

// ----------------------------------------------------
// GOOGLE AUTHENTICATOR 2FA APIs
// ----------------------------------------------------

app.get('/api/admin/2fa/status', requireAuth, (req, res) => {
  const username = req.session.username || 'admin';
  const status = db.get2FAStatus(username);
  res.json(status);
});

app.post('/api/admin/2fa/setup', requireAuth, async (req, res) => {
  try {
    const username = req.session.username || 'admin';
    const secret = totp.generateSecret();
    db.updateUser2FA(username, secret, false);

    const otpauthUrl = totp.getOtpauthUrl('Smart Link Shortener', username, secret);
    const qrCode = await totp.generateQRCodeDataUrl(otpauthUrl);

    res.json({
      success: true,
      secret,
      qrCode,
      otpauthUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate 2FA setup details.' });
  }
});

app.post('/api/admin/2fa/enable', requireAuth, (req, res) => {
  const { code } = req.body;
  const username = req.session.username || 'admin';
  const status = db.get2FAStatus(username);

  if (!status.secret) {
    return res.status(400).json({ error: '2FA setup required first. Please click Setup 2FA.' });
  }

  const isValid = totp.verifyTOTP(code, status.secret);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid 6-digit Authenticator code. Please check app & try again.' });
  }

  db.updateUser2FA(username, status.secret, true);
  res.json({ success: true, message: 'Google Authenticator 2FA active! Both Admin Password and 6-digit App Code can now be used for login.' });
});

app.post('/api/admin/2fa/disable', requireAuth, (req, res) => {
  const username = req.session.username || 'admin';
  db.updateUser2FA(username, undefined, false);
  res.json({ success: true, message: 'Google Authenticator 2FA has been disabled.' });
});

// ----------------------------------------------------
// ADMIN ANALYTICS & LOGS APIs (Protected)
// ----------------------------------------------------

app.get('/api/admin/logs', requireAuth, requirePermission('analytics'), (req, res) => {
  const logs = db.getLogs();
  const cleanLogs = logs.filter(l => l.status !== 'SOCIAL_CRAWLER');
  if (isAdminRole(req.session.role)) {
    return res.json(cleanLogs);
  }
  const userCodes = db.getLinks()
    .filter(l => l.createdBy === req.session.username)
    .map(l => (l.code || '').toLowerCase());
  const userLogs = cleanLogs.filter(l => l.code && userCodes.includes(l.code.toLowerCase()));
  res.json(userLogs);
});

app.post('/api/admin/clear-logs', requireAuth, requirePermission('analytics'), (req, res) => {
  db.clearLogs();
  res.json({ success: true });
});

// Helper to count clicks in a time window for a link
function countLinkClicksInWindow(code, timeWindowMs) {
  const logs = db.getLogs();
  const now = Date.now();
  const threshold = now - timeWindowMs;
  return logs.filter(l => l.code && l.code.toLowerCase() === code.toLowerCase() && new Date(l.timestamp).getTime() >= threshold).length;
}

// ----------------------------------------------------
// TEAM USER MANAGEMENT & INVITES APIs
// ----------------------------------------------------
app.get('/api/admin/me', requireAuth, (req, res) => {
  res.json({
    username: req.session.username || 'admin',
    role: req.session.role || 'Admin',
    permissions: req.session.permissions || db.getDefaultPermissions(req.session.role || 'Admin')
  });
});


app.post('/api/admin/users/invite', requireAuth, (req, res) => {
  if (!isAdminRole(req.session.role)) {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }

  const { username, password, role, permissions, allowedTargetDomains } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const cleanUser = username.trim().toLowerCase();
  if (db.getUserByUsername(cleanUser)) {
    return res.status(400).json({ error: 'Username already exists. Choose another.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password.trim(), salt);
  const assignedRole = ['Admin', 'Editor'].includes(role) ? role : 'Editor';
  const assignedPerms = Array.isArray(permissions) ? permissions : db.getDefaultPermissions(assignedRole);

  let processedAllowed = [];
  if (Array.isArray(allowedTargetDomains)) {
    processedAllowed = allowedTargetDomains
      .map(d => {
        if (typeof d !== 'string') return '';
        let val = d.trim();
        if (!val) return '';
        if (!/^https?:\/\//i.test(val)) val = 'https://' + val.replace(/^www\./i, '');
        return val;
      })
      .filter(Boolean);
  }

  const newUser = {
    id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    username: cleanUser,
    passwordHash: passwordHash,
    rawPassword: password.trim(),
    role: assignedRole,
    permissions: assignedPerms,
    allowedTargetDomains: processedAllowed,
    createdAt: new Date().toISOString()
  };

  db.addUser(newUser);

  const host = req.get('host');
  const directLoginUrl = `https://${host}/login?u=${encodeURIComponent(cleanUser)}&p=${encodeURIComponent(password.trim())}`;

  res.json({
    success: true,
    user: {
      id: newUser.id,
      username: newUser.username,
      rawPassword: newUser.rawPassword,
      role: newUser.role,
      permissions: newUser.permissions,
      allowedTargetDomains: newUser.allowedTargetDomains,
      directLoginUrl: directLoginUrl,
      createdAt: newUser.createdAt
    }
  });
});

app.post('/api/admin/users/update-role', requireAuth, (req, res) => {
  if (!isAdminRole(req.session.role)) {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }

  const { id, role, permissions, allowedTargetDomains } = req.body;
  const users = db.getUsers();
  const target = users.find(u => u.id === id);

  if (!target) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (target.username.toLowerCase() === 'admin' && role !== 'Admin') {
    return res.status(400).json({ error: 'Cannot change role of primary Admin account.' });
  }

  db.updateUserRole(id, role, permissions, allowedTargetDomains);
  res.json({ success: true });
});

app.post('/api/admin/users/reset-password', requireAuth, (req, res) => {
  const { username, newPassword } = req.body;
  
  if (!isAdminRole(req.session.role) && req.session.username !== username) {
    return res.status(403).json({ error: 'Access denied. Admin permission required.' });
  }

  if (!username || !newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const user = db.getUserByUsername(username);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const newHash = bcrypt.hashSync(newPassword.trim(), salt);
  db.updateUserPassword(username, newHash, newPassword.trim());
  res.json({ success: true, message: 'Password updated successfully.' });
});

app.delete('/api/admin/users/:id', requireAuth, (req, res) => {
  if (!isAdminRole(req.session.role)) {
    return res.status(403).json({ error: 'Access denied. Admin role required to delete users.' });
  }

  const { id } = req.params;
  const users = db.getUsers();
  const target = users.find(u => u.id === id);

  if (target) {
    if (target.username.toLowerCase() === 'admin' || isAdminRole(target.role)) {
      return res.status(400).json({ error: 'Admin user accounts cannot be deleted.' });
    }
  }

  db.deleteUser(id);

  res.json({ success: true });
});

// ----------------------------------------------------
// CUSTOM DOMAINS API
// ----------------------------------------------------
app.get('/api/admin/domains', requireAuth, requirePermission('domains'), (req, res) => {
  res.json(db.getCustomDomains());
});

app.post('/api/admin/domains', requireAuth, requirePermission('domains'), (req, res) => {
  const { domain } = req.body;
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required.' });
  }
  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  const newDomain = db.addCustomDomain(cleanDomain);
  if (!newDomain) {
    return res.status(400).json({ error: 'Domain already exists or is invalid.' });
  }
  res.json({ success: true, domain: newDomain });
});

app.delete('/api/admin/domains/:id', requireAuth, requirePermission('domains'), (req, res) => {
  const { id } = req.params;
  db.deleteCustomDomain(id);
  res.json({ success: true });
});

// Caddy validation route (unauthenticated, called internally by Caddy)
app.get('/api/admin/domains/check', (req, res) => {
  const domain = req.query.domain;
  if (db.isCustomDomainAllowed(domain)) {
    return res.status(200).send('OK');
  }
  return res.status(404).send('Not Allowed');
});

// ----------------------------------------------------
// DYNAMIC SHORTLINK REDIRECT ROUTE (/s/:code & /:code)
// ----------------------------------------------------

async function handleShortlinkRedirect(req, res) {
  const code = req.params.code;
  if (!code || code === 'admin' || code === 'login' || code.startsWith('api') || code.endsWith('.html') || code.endsWith('.css') || code.endsWith('.js') || code.endsWith('.ico')) {
    return res.status(404).send('Not Found');
  }

  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const rawReferer = req.headers['referer'] || req.headers['referrer'] || '';

  // Real-Time GeoIP & VPN Lookup (ip-api.com API + geoip-lite + Cloudflare headers)
  const geoInfo = await lookupIpAsync(clientIp, req.headers);
  const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

  // 0. Check IP Firewall (IP Blocking)
  if (db.isIpBlocked(clientIp)) {
    const logEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      code: code,
      ip: clientIp,
      countryCode: geoInfo.countryCode,
      countryName: geoInfo.countryName,
      flag: geoInfo.flag,
      city: geoInfo.city,
      isp: geoInfo.isp,
      isVpn: geoInfo.isVpn,
      referer: rawReferer || 'Blocked IP Attempt',
      userAgent: userAgent,
      status: 'IP_FIREWALL_BLOCKED',
      actionTaken: 'HTTP 403 Forbidden Access'
    };
    db.addLog(logEntry);
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Access Blocked - IP Firewall</title><style>body{font-family:sans-serif;background:#0f172a;color:#ef4444;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;} .box{text-align:center;padding:2.5rem;background:#1e293b;border-radius:12px;border:1px solid #ef4444;box-shadow:0 10px 25px rgba(0,0,0,0.5);}</style></head>
        <body><div class="box"><h1>🚫 Access Blocked by Security Firewall</h1><p>Your IP address (${clientIp}) has been restricted by administrator security policy.</p></div></body>
      </html>
    `);
  }

  const settings = db.getSettings();

  // A. Check Honeypot trigger
  if (settings.honeypotProtectionEnabled && (code === 'honeypot' || code === 'security-honeypot')) {
    db.blockIp(clientIp, 'Auto Shield: Honey pot trap triggered');
    const logEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      code: code,
      ip: clientIp,
      countryCode: geoInfo.countryCode,
      countryName: geoInfo.countryName,
      flag: geoInfo.flag,
      city: geoInfo.city,
      isp: geoInfo.isp,
      isVpn: geoInfo.isVpn,
      referer: rawReferer || 'Honey Pot Trap',
      userAgent: userAgent,
      status: 'IP_FIREWALL_BLOCKED',
      actionTaken: 'Auto-Blocked IP via Honeypot'
    };
    db.addLog(logEntry);
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Access Blocked - IP Firewall</title><style>body{font-family:sans-serif;background:#0f172a;color:#ef4444;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;} .box{text-align:center;padding:2.5rem;background:#1e293b;border-radius:12px;border:1px solid #ef4444;box-shadow:0 10px 25px rgba(0,0,0,0.5);}</style></head>
        <body><div class="box"><h1>🚫 Access Blocked by Security Firewall</h1><p>Your IP address (${clientIp}) has been restricted: Auto Shield: Honey pot trap triggered.</p></div></body>
      </html>
    `);
  }

  // B. Check high-risk country block
  if (settings.blockSuspiciousCountries) {
    const highRiskCountries = ['CN', 'RU', 'KP', 'IR'];
    if (highRiskCountries.includes(geoInfo.countryCode)) {
      db.blockIp(clientIp, `Auto Shield: Restricted Country Access (${geoInfo.countryCode})`);
      const logEntry = {
        id: logId,
        timestamp: new Date().toISOString(),
        code: code,
        ip: clientIp,
        countryCode: geoInfo.countryCode,
        countryName: geoInfo.countryName,
        flag: geoInfo.flag,
        city: geoInfo.city,
        isp: geoInfo.isp,
        isVpn: geoInfo.isVpn,
        referer: rawReferer || 'Restricted Country Access',
        userAgent: userAgent,
        status: 'IP_FIREWALL_BLOCKED',
        actionTaken: 'Auto-Blocked Restricted Country IP'
      };
      db.addLog(logEntry);
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Access Blocked - IP Firewall</title><style>body{font-family:sans-serif;background:#0f172a;color:#ef4444;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;} .box{text-align:center;padding:2.5rem;background:#1e293b;border-radius:12px;border:1px solid #ef4444;box-shadow:0 10px 25px rgba(0,0,0,0.5);}</style></head>
          <body><div class="box"><h1>🚫 Access Blocked by Security Firewall</h1><p>Your IP address (${clientIp}) has been restricted: Auto Shield: Restricted Country Access.</p></div></body>
        </html>
      `);
    }
  }

  // C. Check automatic firewall traffic shields (Bot & VPN Protection)
  const isAutoBlocked = checkAndApplyAutoShield(clientIp, geoInfo.isVpn, userAgent, code);
  if (isAutoBlocked) {
    const logEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      code: code,
      ip: clientIp,
      countryCode: geoInfo.countryCode,
      countryName: geoInfo.countryName,
      flag: geoInfo.flag,
      city: geoInfo.city,
      isp: geoInfo.isp,
      isVpn: geoInfo.isVpn,
      referer: rawReferer || 'Auto Shield Protection',
      userAgent: userAgent,
      status: 'IP_FIREWALL_BLOCKED',
      actionTaken: 'Auto-Blocked IP via Traffic Shield'
    };
    db.addLog(logEntry);
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Access Blocked - IP Firewall</title><style>body{font-family:sans-serif;background:#0f172a;color:#ef4444;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;} .box{text-align:center;padding:2.5rem;background:#1e293b;border-radius:12px;border:1px solid #ef4444;box-shadow:0 10px 25px rgba(0,0,0,0.5);}</style></head>
        <body><div class="box"><h1>🚫 Access Blocked by Security Firewall</h1><p>Your IP address (${clientIp}) has been restricted: Auto Shield auto-block triggered due to suspicious traffic pattern.</p></div></body>
      </html>
    `);
  }

  const link = db.getLinkByCode(code);
  if (link && link.domain) {
    const reqHost = req.hostname.toLowerCase();
    if (link.domain !== reqHost && reqHost !== 'goo33.online' && reqHost !== 'localhost' && reqHost !== '127.0.0.1' && reqHost !== '89.117.51.151') {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Link Not Found</title><style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;} .box{text-align:center;padding:2rem;background:#1e293b;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.5);}</style></head>
          <body><div class="box"><h1>404 - Link Not Found</h1><p>This link is configured to work only on a specific domain.</p></div></body>
        </html>
      `);
    }
  }

  if (!link) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Link Not Found</title><style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;} .box{text-align:center;padding:2rem;background:#1e293b;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.5);}</style></head>
        <body><div class="box"><h1>404 - Link Not Found</h1><p>The requested short link does not exist or has been removed.</p></div></body>
      </html>
    `);
  }

  if (!link.active) {
    return res.redirect(link.fallbackUrl);
  }

  // Check Link Expiration Timestamp
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) {
    const logEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      code: link.code,
      ip: clientIp,
      countryCode: geoInfo.countryCode,
      countryName: geoInfo.countryName,
      flag: geoInfo.flag,
      city: geoInfo.city,
      isp: geoInfo.isp,
      isVpn: geoInfo.isVpn,
      referer: rawReferer || 'Expired Link Attempt',
      userAgent: userAgent,
      status: 'LINK_EXPIRED',
      actionTaken: 'Redirected to Fallback (Link Expired)'
    };
    db.addLog(logEntry);
    return res.redirect(link.fallbackUrl);
  }

  // 1. Check Rate Limiter per IP
  const rateCheck = checkRateLimit(clientIp);
  if (rateCheck.isRateLimited) {
    const logEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      code: link.code,
      ip: clientIp,
      countryCode: geoInfo.countryCode,
      countryName: geoInfo.countryName,
      flag: geoInfo.flag,
      city: geoInfo.city,
      isp: geoInfo.isp,
      isVpn: geoInfo.isVpn,
      referer: rawReferer || 'None',
      userAgent: userAgent,
      status: 'RATE_LIMITED',
      actionTaken: 'HTTP 429 / Blocked'
    };
    db.addLog(logEntry);
    return res.status(429).send('Too Many Requests. Please try again later.');
  }

  // 2. Check Link Traffic Quota Limits (Max Total, Hourly, Daily, Monthly)
  if (link.maxClicks > 0 && (link.clicks || 0) >= link.maxClicks) {
    const logEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      code: link.code,
      ip: clientIp,
      countryCode: geoInfo.countryCode,
      countryName: geoInfo.countryName,
      flag: geoInfo.flag,
      city: geoInfo.city,
      isp: geoInfo.isp,
      isVpn: geoInfo.isVpn,
      referer: rawReferer || 'Max Clicks Reached',
      userAgent: userAgent,
      status: 'TRAFFIC_CAP_EXCEEDED',
      actionTaken: 'Redirected to Fallback (Max Clicks Cap)'
    };
    db.addLog(logEntry);
    return res.redirect(link.fallbackUrl);
  }

  if (link.hourlyLimit > 0) {
    const hourlyCount = countLinkClicksInWindow(link.code, 3600 * 1000);
    if (hourlyCount >= link.hourlyLimit) {
      const logEntry = {
        id: logId,
        timestamp: new Date().toISOString(),
        code: link.code,
        ip: clientIp,
        countryCode: geoInfo.countryCode,
        countryName: geoInfo.countryName,
        flag: geoInfo.flag,
        city: geoInfo.city,
        isp: geoInfo.isp,
        isVpn: geoInfo.isVpn,
        referer: rawReferer || 'Hourly Limit Reached',
        userAgent: userAgent,
        status: 'HOURLY_LIMIT_EXCEEDED',
        actionTaken: 'Redirected to Fallback (Hourly Cap)'
      };
      db.addLog(logEntry);
      return res.redirect(link.fallbackUrl);
    }
  }

  if (link.dailyLimit > 0) {
    const dailyCount = countLinkClicksInWindow(link.code, 86400 * 1000);
    if (dailyCount >= link.dailyLimit) {
      const logEntry = {
        id: logId,
        timestamp: new Date().toISOString(),
        code: link.code,
        ip: clientIp,
        countryCode: geoInfo.countryCode,
        countryName: geoInfo.countryName,
        flag: geoInfo.flag,
        city: geoInfo.city,
        isp: geoInfo.isp,
        isVpn: geoInfo.isVpn,
        referer: rawReferer || 'Daily Limit Reached',
        userAgent: userAgent,
        status: 'DAILY_LIMIT_EXCEEDED',
        actionTaken: 'Redirected to Fallback (Daily Cap)'
      };
      db.addLog(logEntry);
      return res.redirect(link.fallbackUrl);
    }
  }

  if (link.monthlyLimit > 0) {
    const monthlyCount = countLinkClicksInWindow(link.code, 30 * 86400 * 1000);
    if (monthlyCount >= link.monthlyLimit) {
      const logEntry = {
        id: logId,
        timestamp: new Date().toISOString(),
        code: link.code,
        ip: clientIp,
        countryCode: geoInfo.countryCode,
        countryName: geoInfo.countryName,
        flag: geoInfo.flag,
        city: geoInfo.city,
        isp: geoInfo.isp,
        isVpn: geoInfo.isVpn,
        referer: rawReferer || 'Monthly Limit Reached',
        userAgent: userAgent,
        status: 'MONTHLY_LIMIT_EXCEEDED',
        actionTaken: 'Redirected to Fallback (Monthly Cap)'
      };
      db.addLog(logEntry);
      return res.redirect(link.fallbackUrl);
    }
  }

  // 3. Check Social Scrapers — Serve Rich OG Meta Tags fetched from Target URL SILENTLY without logging!
  if (isSocialScraper(userAgent) || isSocialRelayRequest(geoInfo, rawReferer, userAgent)) {

    // Fetch real OG metadata from the target URL
    const ogMeta = await fetchOgMeta(link.targetUrl);
    const ogTitle = (ogMeta && ogMeta.title) ? ogMeta.title : `${link.code} - Shared Link`;
    const ogDesc = (ogMeta && ogMeta.description) ? ogMeta.description : 'Click to view full content';
    const ogImage = (ogMeta && ogMeta.image) ? ogMeta.image : '';
    const ogSiteName = (ogMeta && ogMeta.siteName) ? ogMeta.siteName : '';
    const shortUrl = `${req.protocol}://${req.get('host')}/s/${link.code}`;

    const ogImageTag = ogImage ? `<meta property="og:image" content="${ogImage}" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta name="twitter:image" content="${ogImage}" />` : '';
    const ogSiteTag = ogSiteName ? `<meta property="og:site_name" content="${ogSiteName}" />` : '';

    return res.send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${ogTitle}</title>
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:description" content="${ogDesc}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${shortUrl}" />
    ${ogImageTag}
    ${ogSiteTag}
    <meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${ogTitle}" />
    <meta name="twitter:description" content="${ogDesc}" />
    <meta http-equiv="refresh" content="0;url=${link.targetUrl}">
  </head>
  <body>
    <p>Redirecting... <a href="${link.targetUrl}">Click here if not redirected.</a></p>
    <a href="/s/honeypot" style="display:none; position:absolute; left:-9999px;" aria-hidden="true" tabindex="-1">Click here for more details</a>
  </body>
</html>`);
  }

  // 4. Check Spam Bots
  if (isSpamBot(userAgent)) {
    const logEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      code: link.code,
      ip: clientIp,
      countryCode: geoInfo.countryCode,
      countryName: geoInfo.countryName,
      flag: geoInfo.flag,
      city: geoInfo.city,
      isp: geoInfo.isp,
      isVpn: true,
      referer: rawReferer || 'None',
      userAgent: userAgent,
      status: 'SPAM_BOT_BLOCKED',
      actionTaken: 'Redirected to Fallback'
    };
    db.addLog(logEntry);
    return res.redirect(link.fallbackUrl);
  }

  // 5. Parse Referrer against Allowed Presets + Custom User Domains
  const parsedRef = parseReferrer(rawReferer, link.allowedPlatforms || ['facebook'], link.customDomains || [], userAgent);
  let destinationUrl = parsedRef.isAllowed ? link.targetUrl : link.fallbackUrl;

  // Smart Device OS Targeting (iOS vs Android override)
  if (parsedRef.isAllowed) {
    const isIos = /iPhone|iPad|iPod/i.test(userAgent);
    const isAndroid = /Android/i.test(userAgent);

    if (isIos && link.iosUrl) {
      destinationUrl = link.iosUrl;
    } else if (isAndroid && link.androidUrl) {
      destinationUrl = link.androidUrl;
    }
  }

  // Mobile in-app browsers and social relays can issue more than one request
  // for one tap. Count only the first request from the same visitor and link.
  if (isDuplicateTrafficClick(link.code, clientIp)) {
    return res.redirect(destinationUrl);
  }

  db.incrementClicks(link.code);

  const clickStatus = parsedRef.isAllowed ? 'ORGANIC_CLICK' : 'FALLBACK_REDIRECT';
  const delaySec = link.delaySeconds || 0;

  const logEntry = {
    id: logId,
    timestamp: new Date().toISOString(),
    code: link.code,
    ip: clientIp,
    countryCode: geoInfo.countryCode,
    countryName: geoInfo.countryName,
    flag: geoInfo.flag,
    city: geoInfo.city,
    isp: geoInfo.isp,
    isVpn: geoInfo.isVpn,
    referer: rawReferer || 'Direct/WhatsApp/Other',
    userAgent: userAgent,
    status: clickStatus,
    platform: parsedRef.platform,
    matchedDomain: parsedRef.domain,
    durationSeconds: 0,
    actionTaken: `Redirected to ${parsedRef.isAllowed ? 'Target' : 'Fallback'} (${delaySec > 0 ? delaySec + 's Delay' : 'Instant'})`
  };
  db.addLog(logEntry);

  // If Delay Timer set (> 0 seconds), serve dynamic countdown screen!
  if (delaySec > 0) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Redirecting in ${delaySec}s...</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;800&family=Inter:wght@400;600&display=swap');
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Inter', sans-serif;
              background: #0f172a;
              color: #f8fafc;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              padding: 1rem;
              background-image: radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.25) 0%, transparent 60%);
            }
            .card {
              background: rgba(30, 41, 59, 0.85);
              backdrop-filter: blur(16px);
              border: 1px solid rgba(255, 255, 255, 0.12);
              border-radius: 16px;
              padding: 2.5rem 2rem;
              text-align: center;
              max-width: 420px;
              width: 100%;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            }
            h1 { font-family: 'Outfit', sans-serif; font-size: 1.5rem; margin-bottom: 0.5rem; }
            p { color: #94a3b8; font-size: 0.875rem; margin-bottom: 1.5rem; }
            .timer-circle {
              width: 100px;
              height: 100px;
              border-radius: 50%;
              background: linear-gradient(135deg, #6366f1, #a855f7);
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 1.5rem;
              font-family: 'Outfit', sans-serif;
              font-size: 2.5rem;
              font-weight: 800;
              box-shadow: 0 0 25px rgba(99, 102, 241, 0.4);
            }
            .progress-bar-bg {
              width: 100%;
              height: 8px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 4px;
              overflow: hidden;
              margin-bottom: 1.5rem;
            }
            .progress-bar-fill {
              height: 100%;
              width: 100%;
              background: linear-gradient(90deg, #6366f1, #ec4899);
              transition: width 1s linear;
            }
            .btn {
              display: inline-block;
              padding: 0.6rem 1.25rem;
              background: #6366f1;
              color: #fff;
              text-decoration: none;
              font-weight: 600;
              font-size: 0.85rem;
              border-radius: 8px;
            }
          </style>
          <script>
            let secondsLeft = ${delaySec};
            const startTime = Date.now();
            
            window.addEventListener('beforeunload', () => {
              const duration = Math.round((Date.now() - startTime) / 1000);
              navigator.sendBeacon('/api/pingback', JSON.stringify({ logId: "${logId}", durationSeconds: duration }));
            });

            document.addEventListener('DOMContentLoaded', () => {
              const timerEl = document.getElementById('seconds-text');
              const progressEl = document.getElementById('progress-fill');
              const totalSec = ${delaySec};

              const interval = setInterval(() => {
                secondsLeft--;
                if (timerEl) timerEl.textContent = secondsLeft;
                if (progressEl) {
                  const pct = Math.max(0, (secondsLeft / totalSec) * 100);
                  progressEl.style.width = pct + '%';
                }

                if (secondsLeft <= 0) {
                  clearInterval(interval);
                  window.location.href = "${destinationUrl}";
                }
              }, 1000);
            });
          </script>
        </head>
        <body>
          <div class="card">
            <div class="timer-circle" id="seconds-text">${delaySec}</div>
            <h1>⏳ Please Wait...</h1>
            <p>You will be automatically redirected to your destination in a few seconds.</p>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" id="progress-fill"></div>
            </div>
            <a href="${destinationUrl}" class="btn">Skip Countdown & Go Now →</a>
          </div>
        </body>
      </html>
    `);
  }

  // Instant redirect with client pingback tracker
  return res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Redirecting...</title>
        <script>
          const startTime = Date.now();
          window.addEventListener('beforeunload', () => {
            const duration = Math.round((Date.now() - startTime) / 1000);
            navigator.sendBeacon('/api/pingback', JSON.stringify({ logId: "${logId}", durationSeconds: duration }));
          });
          window.location.href = "${destinationUrl}";
        </script>
      </head>
      <body style="background:#0f172a; color:#f8fafc; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh;">
        <p>Redirecting to destination... <a href="${destinationUrl}" style="color:#93c5fd;">Click here if not redirected.</a></p>
      </body>
    </html>
  `);
}

app.get('/s/:code', handleShortlinkRedirect);

// Serve Admin UI directly at /admin
app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  }
  return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Root fallback route -> redirect to /admin
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Catch-all shortlink handler for root level codes like domain.com/xyz
app.get('/:code', handleShortlinkRedirect);

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Smart Link Shortener running on port ${PORT}`);
  console.log(`🔗 Admin Portal: http://localhost:${PORT}/admin`);
  console.log(`===================================================`);
});
