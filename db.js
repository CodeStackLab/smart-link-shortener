const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data folder and JSON files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FILES = {
  links: path.join(DATA_DIR, 'links.json'),
  logs: path.join(DATA_DIR, 'logs.json'),
  users: path.join(DATA_DIR, 'users.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
  blockedIps: path.join(DATA_DIR, 'blocked_ips.json'),
  customDomains: path.join(DATA_DIR, 'custom_domains.json')
};

function readJson(file, defaultValue = []) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return defaultValue;
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
}

// Initial Admin User Seed
function initDb() {
  const users = readJson(FILES.users, []);
  if (users.length === 0) {
    const salt = bcrypt.genSaltSync(10);
    const defaultAdmin = {
      id: 'usr_admin_1',
      username: 'admin',
      passwordHash: bcrypt.hashSync('S3cr3tP@ssw0rd!2026', salt),
      role: 'Admin',
      createdAt: new Date().toISOString()
    };
    users.push(defaultAdmin);
    writeJson(FILES.users, users);
    console.log('✅ Initial admin user created: admin / S3cr3tP@ssw0rd!2026');
  }

  const links = readJson(FILES.links, []);
  if (links.length === 0) {
    const demoLink = {
      id: 'link_demo_1',
      code: 'android',
      targetUrl: 'https://mywebsite.com',
      fallbackUrl: 'https://www.google.com/',
      allowedPlatforms: ['facebook', 'instagram'],
      customDomains: ['myblog.com'],
      delaySeconds: 0,
      maxClicks: 0,
      hourlyLimit: 0,
      dailyLimit: 0,
      monthlyLimit: 0,
      expiresAt: '',
      active: true,
      createdAt: new Date().toISOString(),
      clicks: 0
    };
    links.push(demoLink);
    writeJson(FILES.links, links);
  }

  const settings = readJson(FILES.settings, null);
  const defaultSettings = {
    rateLimitWindowSeconds: 60,
    rateLimitMaxRequests: 30,
    webhookUrl: '',
    botProtectionEnabled: true,
    vpnProtectionEnabled: true,
    botLimitClicks: 100,
    botLimitMinutes: 1,
    vpnLimitClicks: 500,
    vpnLimitMinutes: 90,
    blockSuspiciousCountries: false,
    blockKnownScrapers: false,
    honeypotProtectionEnabled: false,
    restrictEditorDomains: true,
    allowedTargetDomains: [],
    applyFirewallGlobally: true
  };

  if (!settings) {
    writeJson(FILES.settings, defaultSettings);
  } else {
    // Perform dynamic migrations if some settings are missing
    let changed = false;
    for (const key of Object.keys(defaultSettings)) {
      if (settings[key] === undefined) {
        settings[key] = defaultSettings[key];
        changed = true;
      }
    }
    if (changed) {
      writeJson(FILES.settings, settings);
    }
  }
}

initDb();

module.exports = {
  // Links CRUD
  getLinks: () => readJson(FILES.links, []),
  getLinkByCode: (code) => {
    const links = readJson(FILES.links, []);
    return links.find(l => l && l.code && l.code.toLowerCase() === (code || '').toLowerCase());
  },
  addLink: (link) => {
    const links = readJson(FILES.links, []);
    links.unshift(link);
    writeJson(FILES.links, links);
    return link;
  },
  updateLink: (id, updatedFields) => {
    const links = readJson(FILES.links, []);
    const index = links.findIndex(l => l.id === id);
    if (index !== -1) {
      links[index] = { ...links[index], ...updatedFields };
      writeJson(FILES.links, links);
      return links[index];
    }
    return null;
  },
  deleteLink: (id) => {
    let links = readJson(FILES.links, []);
    links = links.filter(l => l.id !== id);
    writeJson(FILES.links, links);
  },
  incrementClicks: (code) => {
    const links = readJson(FILES.links, []);
    const link = links.find(l => l && l.code && l.code.toLowerCase() === (code || '').toLowerCase());
    if (link) {
      link.clicks = (link.clicks || 0) + 1;
      writeJson(FILES.links, links);
    }
  },

  // Settings CRUD
  getSettings: () => readJson(FILES.settings, {
    rateLimitWindowSeconds: 60,
    rateLimitMaxRequests: 30,
    webhookUrl: '',
    botProtectionEnabled: true,
    vpnProtectionEnabled: true,
    botLimitClicks: 100,
    botLimitMinutes: 1,
    vpnLimitClicks: 500,
    vpnLimitMinutes: 90,
    blockSuspiciousCountries: false,
    blockKnownScrapers: false,
    honeypotProtectionEnabled: false,
    restrictEditorDomains: true,
    allowedTargetDomains: []
  }),
  updateSettings: (newFields) => {
    const current = readJson(FILES.settings, {
      rateLimitWindowSeconds: 60,
      rateLimitMaxRequests: 30,
      webhookUrl: '',
      botProtectionEnabled: true,
      vpnProtectionEnabled: true,
      botLimitClicks: 100,
      botLimitMinutes: 1,
      vpnLimitClicks: 500,
      vpnLimitMinutes: 90,
      blockSuspiciousCountries: false,
      blockKnownScrapers: false,
      honeypotProtectionEnabled: false,
      restrictEditorDomains: true,
      allowedTargetDomains: []
    });
    const updated = { ...current, ...newFields };
    writeJson(FILES.settings, updated);
    return updated;
  },

  // Traffic Logs
  getLogs: () => readJson(FILES.logs, []),
  addLog: (logEntry) => {
    const logs = readJson(FILES.logs, []);
    logs.unshift(logEntry);
    if (logs.length > 5000) logs.pop();
    writeJson(FILES.logs, logs);
  },
  updateLogDuration: (logId, durationSeconds) => {
    const logs = readJson(FILES.logs, []);
    const log = logs.find(l => l.id === logId);
    if (log) {
      log.durationSeconds = durationSeconds;
      writeJson(FILES.logs, logs);
    }
  },
  clearLogs: () => writeJson(FILES.logs, []),
  removeLogsByIds: (ids) => {
    const idSet = new Set(Array.isArray(ids) ? ids : []);
    const logs = readJson(FILES.logs, []);
    const retained = logs.filter(log => !idSet.has(log.id));
    writeJson(FILES.logs, retained);
    return logs.length - retained.length;
  },

  // IP Firewall Blocklist
  getBlockedIps: () => readJson(FILES.blockedIps, []),
  blockIp: (ip, reason = '') => {
    const blocked = readJson(FILES.blockedIps, []);
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    if (!blocked.some(b => b.ip === cleanIp)) {
      const entry = {
        id: 'ip_' + Date.now(),
        ip: cleanIp,
        reason: reason || 'Manual Firewall Block',
        blockedAt: new Date().toISOString()
      };
      blocked.unshift(entry);
      writeJson(FILES.blockedIps, blocked);
      return entry;
    }
    return null;
  },
  unblockIp: (ip) => {
    let blocked = readJson(FILES.blockedIps, []);
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    blocked = blocked.filter(b => b.ip !== cleanIp);
    writeJson(FILES.blockedIps, blocked);
  },
  isIpBlocked: (ip) => {
    const blocked = readJson(FILES.blockedIps, []);
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    return blocked.some(b => b.ip === cleanIp);
  },

  // Users CRUD
  getUsers: () => readJson(FILES.users, []),
  getDefaultPermissions: (role) => {
    if (role === 'Admin') return ['facebook', 'instagram', 'custom_website', 'links', 'domains', 'geo', 'analytics', 'firewall', 'settings'];
    return ['facebook', 'instagram', 'custom_website', 'links', 'geo', 'analytics']; // Editor default
  },
  getUsersPublic: () => {
    const users = readJson(FILES.users, []);
    return users.map(u => {
      const role = u.role || 'Editor';
      const defaultPerms = role === 'Admin'
        ? ['facebook', 'instagram', 'custom_website', 'links', 'domains', 'geo', 'analytics', 'firewall', 'settings']
        : ['facebook', 'instagram', 'custom_website', 'links', 'geo', 'analytics'];
      // Use ALL saved permissions (including granular col_*, geo_*, logs_* keys)
      // Only fall back to role defaults if no permissions have been explicitly set
      const userPerms = Array.isArray(u.permissions) && u.permissions.length > 0 ? u.permissions : defaultPerms;
      return {
        id: u.id,
        username: u.username,
        rawPassword: u.rawPassword || '',
        role: role,
        permissions: userPerms,
        allowedTargetDomains: Array.isArray(u.allowedTargetDomains) ? u.allowedTargetDomains : [],
        twoFactorEnabled: !!u.twoFactorEnabled,
        createdAt: u.createdAt || new Date().toISOString()
      };
    });
  },
  getUserByUsername: (username) => {
    const users = readJson(FILES.users, []);
    return users.find(u => u && u.username && u.username.toLowerCase() === (username || '').toLowerCase());
  },
  addUser: (user) => {
    const users = readJson(FILES.users, []);
    // Only set default permissions when none were explicitly provided
    if (!Array.isArray(user.permissions) || user.permissions.length === 0) {
      user.permissions = user.role === 'Admin'
        ? ['facebook', 'instagram', 'custom_website', 'links', 'domains', 'geo', 'analytics', 'firewall', 'settings']
        : ['facebook', 'instagram', 'custom_website', 'links', 'geo', 'analytics'];
    }
    if (Array.isArray(user.allowedTargetDomains)) {
      user.allowedTargetDomains = user.allowedTargetDomains
        .map(d => {
          if (typeof d !== 'string') return '';
          let val = d.trim();
          if (!val) return '';
          if (!/^https?:\/\//i.test(val)) val = 'https://' + val.replace(/^www\./i, '');
          return val;
        })
        .filter(Boolean);
    } else {
      user.allowedTargetDomains = [];
    }
    users.push(user);
    writeJson(FILES.users, users);
    return user;
  },
  deleteUser: (id) => {
    let users = readJson(FILES.users, []);
    users = users.filter(u => u.id !== id);
    writeJson(FILES.users, users);
  },
  updateUserRole: (id, role, permissions, allowedTargetDomains) => {
    const users = readJson(FILES.users, []);
    const user = users.find(u => u.id === id);
    if (user) {
      if (role !== undefined) user.role = role;
      if (Array.isArray(permissions)) user.permissions = permissions;
      if (Array.isArray(allowedTargetDomains)) {
        user.allowedTargetDomains = allowedTargetDomains
          .map(d => {
            if (typeof d !== 'string') return '';
            let val = d.trim();
            if (!val) return '';
            if (!/^https?:\/\//i.test(val)) val = 'https://' + val.replace(/^www\./i, '');
            return val;
          })
          .filter(Boolean);
      }
      writeJson(FILES.users, users);
    }
  },

  updateUserPassword: (username, newPasswordHash, rawPassword) => {
    const users = readJson(FILES.users, []);
    const user = users.find(u => u && u.username && u.username.toLowerCase() === (username || '').toLowerCase());
    if (user) {
      user.passwordHash = newPasswordHash;
      if (rawPassword) user.rawPassword = rawPassword;
      writeJson(FILES.users, users);
    }
  },
  updateUser2FA: (username, twoFactorSecret, twoFactorEnabled) => {
    const users = readJson(FILES.users, []);
    const user = users.find(u => u && u.username && u.username.toLowerCase() === (username || '').toLowerCase());
    if (user) {
      if (twoFactorSecret !== undefined) user.twoFactorSecret = twoFactorSecret;
      if (twoFactorEnabled !== undefined) user.twoFactorEnabled = !!twoFactorEnabled;
      writeJson(FILES.users, users);
    }
  },
  get2FAStatus: (username) => {
    const users = readJson(FILES.users, []);
    const user = users.find(u => u && u.username && u.username.toLowerCase() === (username || '').toLowerCase());
    if (!user) return { enabled: false, hasSecret: false };
    return {
      enabled: !!user.twoFactorEnabled,
      hasSecret: !!user.twoFactorSecret,
      secret: user.twoFactorSecret || ''
    };
  },

  // Custom Domains CRUD
  getCustomDomains: () => readJson(FILES.customDomains, []),
  addCustomDomain: (domain) => {
    const domains = readJson(FILES.customDomains, []);
    const cleanDomain = (domain || '').trim().toLowerCase();
    if (cleanDomain && !domains.some(d => d.domain === cleanDomain)) {
      const entry = {
        id: 'dom_' + Date.now(),
        domain: cleanDomain,
        createdAt: new Date().toISOString()
      };
      domains.push(entry);
      writeJson(FILES.customDomains, domains);
      return entry;
    }
    return null;
  },
  deleteCustomDomain: (id) => {
    let domains = readJson(FILES.customDomains, []);
    domains = domains.filter(d => d.id !== id);
    writeJson(FILES.customDomains, domains);
  },
  isCustomDomainAllowed: (domain) => {
    const domains = readJson(FILES.customDomains, []);
    const cleanDomain = (domain || '').trim().toLowerCase();
    // Allow main domain, localhost and internal IPs by default
    if (cleanDomain === 'goo33.online' || cleanDomain === 'localhost' || cleanDomain === '127.0.0.1') {
      return true;
    }
    return domains.some(d => d.domain === cleanDomain);
  }
};
