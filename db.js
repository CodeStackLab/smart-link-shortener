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
    maskEditorUrls: true,
    applyFirewallGlobally: true,
    tempBlockDurationMinutes: 30,
    spikeWindowMinutes: 5,
    spikeThresholdClicks: 200,
    allowlistedIps: [],
    // Facebook Traffic & AdX Shield Controls
    fbTrafficEnabled: true,
    allowFbProfiles: true,
    allowFbGroups: true,
    allowFbPages: true,
    allowFbStories: true,
    blockAutomatedUnknown: true,
    // Editor Accounts Country Block System (Admin Only - Hidden from Editors)
    editorCountryBlockEnabled: true,
    editorBlockedCountries: ['US', 'PK', 'IN', 'BD', 'EG', 'NG', 'PH', 'TW']
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
    // Mandatory high-risk countries that MUST always be blocked for Editors
    const mandatoryBlocked = ['US', 'PK', 'IN', 'BD', 'EG', 'NG', 'PH', 'TW'];
    if (!Array.isArray(settings.editorBlockedCountries) || settings.editorBlockedCountries.length === 0) {
      settings.editorBlockedCountries = [...mandatoryBlocked];
      changed = true;
    } else {
      let added = false;
      for (const c of mandatoryBlocked) {
        if (!settings.editorBlockedCountries.includes(c)) {
          settings.editorBlockedCountries.push(c);
          added = true;
        }
      }
      if (added) changed = true;
    }
    if (changed) {
      writeJson(FILES.settings, settings);
    }

    // Ensure all Editor accounts also have mandatory countries active in their blocked list
    const users = readJson(FILES.users, []);
    let usersChanged = false;
    for (const u of users) {
      if (u && u.role === 'Editor') {
        if (!Array.isArray(u.blockedCountries) || u.blockedCountries.length === 0) {
          u.blockedCountries = [...mandatoryBlocked];
          usersChanged = true;
        } else {
          for (const c of mandatoryBlocked) {
            if (!u.blockedCountries.includes(c)) {
              u.blockedCountries.push(c);
              usersChanged = true;
            }
          }
        }
      }
    }

    // Ensure all Editor accounts have fbTrafficSettings initialized/synchronized from global settings
    const activeSettings = readJson(FILES.settings, defaultSettings);
    if (activeSettings && activeSettings.applyFirewallGlobally !== false) {
      for (const u of users) {
        if (u && u.role === 'Editor') {
          u.fbTrafficSettings = {
            fbTrafficEnabled: activeSettings.fbTrafficEnabled !== false,
            allowFbProfiles: activeSettings.allowFbProfiles !== false,
            allowFbGroups: activeSettings.allowFbGroups !== false,
            allowFbPages: activeSettings.allowFbPages !== false,
            allowFbStories: activeSettings.allowFbStories !== false,
            blockAutomatedUnknown: activeSettings.blockAutomatedUnknown !== false,
            botProtection: activeSettings.botProtectionEnabled !== false
          };
          usersChanged = true;
        }
      }
    }

    if (usersChanged) {
      writeJson(FILES.users, users);
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
      const cleanUpdates = {};
      for (const [key, value] of Object.entries(updatedFields || {})) {
        if (value !== undefined) {
          cleanUpdates[key] = value;
        }
      }
      links[index] = { ...links[index], ...cleanUpdates };
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
  getSettings: () => {
    const s = readJson(FILES.settings, {
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
      maskEditorUrls: true,
      applyFirewallGlobally: true,
      tempBlockDurationMinutes: 30,
      spikeWindowMinutes: 5,
      spikeThresholdClicks: 200,
      allowlistedIps: [],
      fbTrafficEnabled: true,
      allowFbProfiles: true,
      allowFbGroups: true,
      allowFbPages: true,
      allowFbStories: true,
      blockAutomatedUnknown: true,
      editorCountryBlockEnabled: true,
      editorBlockedCountries: ['US', 'PK', 'IN', 'BD', 'EG', 'NG', 'PH', 'TW']
    });
    const mandatoryBlocked = ['US', 'PK', 'IN', 'BD', 'EG', 'NG', 'PH', 'TW'];
    if (!Array.isArray(s.editorBlockedCountries) || s.editorBlockedCountries.length === 0) {
      s.editorBlockedCountries = [...mandatoryBlocked];
    } else {
      for (const c of mandatoryBlocked) {
        if (!s.editorBlockedCountries.includes(c)) {
          s.editorBlockedCountries.push(c);
        }
      }
    }
    return s;
  },
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
      allowedTargetDomains: [],
      maskEditorUrls: true,
      applyFirewallGlobally: true,
      tempBlockDurationMinutes: 30,
      spikeWindowMinutes: 5,
      spikeThresholdClicks: 200,
      allowlistedIps: [],
      fbTrafficEnabled: true,
      allowFbProfiles: true,
      allowFbGroups: true,
      allowFbPages: true,
      allowFbStories: true,
      blockAutomatedUnknown: true,
      editorCountryBlockEnabled: true,
      editorBlockedCountries: ['US', 'PK', 'IN', 'BD', 'EG', 'NG', 'PH', 'TW']
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
    if (role === 'Admin') return ['facebook', 'instagram', 'custom_website', 'links', 'domains', 'geo', 'analytics', 'firewall', 'settings', 'unmask_target_url', 'upload_image'];
    return ['facebook', 'instagram', 'custom_website', 'links', 'geo', 'upload_image']; // Editor default
  },
  getUsersPublic: () => {
    const users = readJson(FILES.users, []);
    return users.map(u => {
      const role = u.role || 'Editor';
      const defaultPerms = role === 'Admin'
        ? ['facebook', 'instagram', 'custom_website', 'links', 'domains', 'geo', 'analytics', 'firewall', 'settings', 'upload_image']
        : ['facebook', 'instagram', 'custom_website', 'links', 'geo', 'upload_image'];
      // Use ALL saved permissions (including granular col_*, geo_*, logs_* keys)
      // Only fall back to role defaults if no permissions have been explicitly set
      const rawUserPerms = Array.isArray(u.permissions) ? u.permissions : defaultPerms;
      const userPerms = role === 'Admin' ? rawUserPerms : rawUserPerms.filter(p => p !== 'firewall' && p !== 'analytics');
      return {
        id: u.id,
        username: u.username,
        rawPassword: u.rawPassword || '',
        role: role,
        permissions: userPerms,
        allowedTargetDomains: Array.isArray(u.allowedTargetDomains) ? u.allowedTargetDomains : [],
        twoFactorEnabled: !!u.twoFactorEnabled,
        fbTrafficSettings: u.fbTrafficSettings || {
          fbTrafficEnabled: true,
          allowFbProfiles: true,
          allowFbGroups: true,
          allowFbPages: true,
          allowFbStories: true,
          blockAutomatedUnknown: true,
          botProtection: true
        },
        blockedCountries: Array.isArray(u.blockedCountries) ? u.blockedCountries : ['US', 'PK', 'IN', 'BD', 'EG', 'NG', 'PH', 'TW'],
        countryBlockEnabled: u.countryBlockEnabled !== false,
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
    // Only set default permissions when none were explicitly provided (if array doesn't exist)
    if (!Array.isArray(user.permissions)) {
      user.permissions = user.role === 'Admin'
        ? ['facebook', 'instagram', 'custom_website', 'links', 'domains', 'geo', 'analytics', 'firewall', 'settings']
        : ['facebook', 'instagram', 'custom_website', 'links', 'geo'];
    }
    if (user.role !== 'Admin' && Array.isArray(user.permissions)) {
      user.permissions = user.permissions.filter(p => p !== 'firewall' && p !== 'analytics');
    }
    if (Array.isArray(user.allowedTargetDomains)) {
      user.allowedTargetDomains = [...new Set(user.allowedTargetDomains
        .map(d => {
          if (typeof d !== 'string') return '';
          let val = d.trim();
          if (!val) return '';
          if (!/^https?:\/\//i.test(val)) val = 'https://' + val;
          return val;
        })
        .filter(Boolean))];
    } else {
      user.allowedTargetDomains = [];
    }
    if (user.fbTrafficSettings && typeof user.fbTrafficSettings === 'object') {
      user.fbTrafficSettings = {
        fbTrafficEnabled: user.fbTrafficSettings.fbTrafficEnabled !== false,
        allowFbProfiles: user.fbTrafficSettings.allowFbProfiles !== false,
        allowFbGroups: user.fbTrafficSettings.allowFbGroups !== false,
        allowFbPages: user.fbTrafficSettings.allowFbPages !== false,
        allowFbStories: user.fbTrafficSettings.allowFbStories !== false,
        blockAutomatedUnknown: user.fbTrafficSettings.blockAutomatedUnknown !== false,
        botProtection: user.fbTrafficSettings.botProtection !== false
      };
    } else {
      const activeSettings = readJson(FILES.settings, {});
      user.fbTrafficSettings = {
        fbTrafficEnabled: activeSettings.fbTrafficEnabled !== false,
        allowFbProfiles: activeSettings.allowFbProfiles !== false,
        allowFbGroups: activeSettings.allowFbGroups !== false,
        allowFbPages: activeSettings.allowFbPages !== false,
        allowFbStories: activeSettings.allowFbStories !== false,
        blockAutomatedUnknown: activeSettings.blockAutomatedUnknown !== false,
        botProtection: activeSettings.botProtectionEnabled !== false
      };
    }
    if (Array.isArray(user.blockedCountries)) {
      user.blockedCountries = [...new Set(user.blockedCountries.map(c => String(c).trim().toUpperCase()).filter(Boolean))];
    } else {
      const activeSettings = readJson(FILES.settings, {});
      user.blockedCountries = Array.isArray(activeSettings.editorBlockedCountries) && activeSettings.editorBlockedCountries.length > 0
        ? [...activeSettings.editorBlockedCountries]
        : ['US', 'PK', 'IN', 'BD', 'EG', 'NG', 'PH', 'TW'];
    }
    user.countryBlockEnabled = (user.countryBlockEnabled !== false);

    users.push(user);
    writeJson(FILES.users, users);
    return user;
  },
  deleteUser: (id) => {
    let users = readJson(FILES.users, []);
    users = users.filter(u => u.id !== id);
    writeJson(FILES.users, users);
  },
  updateUserRole: (id, role, permissions, allowedTargetDomains, fbTrafficSettings, blockedCountries, countryBlockEnabled) => {
    const users = readJson(FILES.users, []);
    const user = users.find(u => u.id === id);
    if (user) {
      if (role !== undefined) user.role = role;
      if (Array.isArray(permissions)) {
        user.permissions = (user.role === 'Admin')
          ? permissions
          : permissions.filter(p => p !== 'firewall' && p !== 'analytics');
      }
      if (Array.isArray(allowedTargetDomains)) {
        user.allowedTargetDomains = [...new Set(allowedTargetDomains
          .map(d => {
            if (typeof d !== 'string') return '';
            let val = d.trim();
            if (!val) return '';
            if (!/^https?:\/\//i.test(val)) val = 'https://' + val;
            return val;
          })
          .filter(Boolean))];
      }
      if (fbTrafficSettings !== undefined && typeof fbTrafficSettings === 'object') {
        user.fbTrafficSettings = {
          fbTrafficEnabled: fbTrafficSettings.fbTrafficEnabled !== false,
          allowFbProfiles: fbTrafficSettings.allowFbProfiles !== false,
          allowFbGroups: fbTrafficSettings.allowFbGroups !== false,
          allowFbPages: fbTrafficSettings.allowFbPages !== false,
          allowFbStories: fbTrafficSettings.allowFbStories !== false,
          blockAutomatedUnknown: fbTrafficSettings.blockAutomatedUnknown !== false,
          botProtection: fbTrafficSettings.botProtection !== false
        };
      }
      if (Array.isArray(blockedCountries)) {
        user.blockedCountries = [...new Set(blockedCountries.map(c => String(c).trim().toUpperCase()).filter(Boolean))];
      }
      if (countryBlockEnabled !== undefined) {
        user.countryBlockEnabled = !!countryBlockEnabled;
      }
      writeJson(FILES.users, users);
    }
  },

  updateAllEditorsFbSettings: (fbSettings) => {
    if (!fbSettings || typeof fbSettings !== 'object') return;
    const users = readJson(FILES.users, []);
    let modified = false;
    users.forEach(u => {
      if (u && u.role === 'Editor') {
        u.fbTrafficSettings = {
          fbTrafficEnabled: fbSettings.fbTrafficEnabled !== false,
          allowFbProfiles: fbSettings.allowFbProfiles !== false,
          allowFbGroups: fbSettings.allowFbGroups !== false,
          allowFbPages: fbSettings.allowFbPages !== false,
          allowFbStories: fbSettings.allowFbStories !== false,
          blockAutomatedUnknown: fbSettings.blockAutomatedUnknown !== false,
          botProtection: (fbSettings.botProtection !== undefined ? fbSettings.botProtection !== false : (fbSettings.botProtectionEnabled !== false))
        };
        modified = true;
      }
    });
    if (modified) {
      writeJson(FILES.users, users);
    }
  },

  updateAllEditorLinksFbSettings: (fbSettings, includeAdmin = false) => {
    if (!fbSettings || typeof fbSettings !== 'object') return;
    const links = readJson(FILES.links, []);
    const users = readJson(FILES.users, []);
    const editorUsernames = new Set(
      users.filter(u => u && u.role === 'Editor').map(u => (u.username || '').toLowerCase())
    );
    let modified = false;
    links.forEach(link => {
      const creator = (link.createdBy || '').toLowerCase();
      if (includeAdmin || editorUsernames.has(creator) || (creator && creator !== 'admin')) {
        link.fbTrafficEnabled = fbSettings.fbTrafficEnabled !== false;
        link.allowFbProfiles = fbSettings.allowFbProfiles !== false;
        link.allowFbGroups = fbSettings.allowFbGroups !== false;
        link.allowFbPages = fbSettings.allowFbPages !== false;
        link.allowFbStories = fbSettings.allowFbStories !== false;
        link.blockAutomatedUnknown = fbSettings.blockAutomatedUnknown !== false;
        link.botProtection = (fbSettings.botProtection !== undefined ? fbSettings.botProtection !== false : (fbSettings.botProtectionEnabled !== false));
        modified = true;
      }
    });
    if (modified) {
      writeJson(FILES.links, links);
    }
  },

  updateAllEditorsBlockedCountries: (blockedCountries, countryBlockEnabled) => {
    const users = readJson(FILES.users, []);
    let modified = false;
    users.forEach(u => {
      if (u && u.role === 'Editor') {
        if (Array.isArray(blockedCountries)) {
          u.blockedCountries = [...new Set(blockedCountries.map(c => String(c).trim().toUpperCase()).filter(Boolean))];
          modified = true;
        }
        if (countryBlockEnabled !== undefined) {
          u.countryBlockEnabled = !!countryBlockEnabled;
          modified = true;
        }
      }
    });
    if (modified) {
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
