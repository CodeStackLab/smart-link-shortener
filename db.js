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
  let linksUpdated = false;
  links.forEach(l => {
    if (l && !l.id) {
      l.id = 'link_' + (l.code || (Date.now() + '_' + Math.random().toString(36).substr(2, 4)));
      linksUpdated = true;
    }
  });
  if (linksUpdated) {
    writeJson(FILES.links, links);
  }

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
    defaultFallbackUrl: 'https://www.google.com/',
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
    if (!Array.isArray(settings.editorBlockedCountries)) {
      settings.editorBlockedCountries = ['US', 'PK', 'IN', 'BD', 'EG', 'NG', 'PH', 'TW'];
      changed = true;
    }
    if (changed) {
      writeJson(FILES.settings, settings);
    }

    // Initialize blockedCountries array for Editor accounts if missing
    const users = readJson(FILES.users, []);
    let usersChanged = false;
    for (const u of users) {
      if (u && u.role === 'Editor') {
        if (!Array.isArray(u.blockedCountries)) {
          u.blockedCountries = [];
          usersChanged = true;
        }
      }
    }

    // Ensure all Editor accounts have fbTrafficSettings initialized if not already set
    const activeSettings = readJson(FILES.settings, defaultSettings);
    if (activeSettings) {
      for (const u of users) {
        if (u && u.role === 'Editor') {
          if (!u.fbTrafficSettings) {
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
    if (!link.id) {
      link.id = 'link_' + (link.code || (Date.now() + '_' + Math.random().toString(36).substr(2, 4)));
    }
    const links = readJson(FILES.links, []);
    links.unshift(link);
    writeJson(FILES.links, links);
    return link;
  },
  updateLink: (id, updatedFields) => {
    const links = readJson(FILES.links, []);
    const target = (id || '').toString().trim().toLowerCase();
    const index = links.findIndex(l => 
      l && ((l.id && l.id.toString().trim().toLowerCase() === target) ||
            (l.code && l.code.toString().trim().toLowerCase() === target))
    );
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
    const target = (id || '').toString().trim().toLowerCase();
    links = links.filter(l => {
      if (!l) return false;
      const lid = (l.id || '').toString().trim().toLowerCase();
      const lcode = (l.code || '').toString().trim().toLowerCase();
      return lid !== target && lcode !== target;
    });
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
      defaultFallbackUrl: 'https://www.google.com/',
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
      defaultFallbackUrl: 'https://www.google.com/',
      editorCountryBlockEnabled: true,
      editorBlockedCountries: ['US', 'PK', 'IN', 'BD', 'EG', 'NG', 'PH', 'TW']
    });
    if (!Array.isArray(s.editorBlockedCountries)) {
      s.editorBlockedCountries = ['US', 'PK', 'IN', 'BD', 'EG', 'NG', 'PH', 'TW'];
    }
    return s;
  },
  updateSettings: (newFields) => {
    const current = module.exports.getSettings();
    const filtered = {};
    for (const [k, v] of Object.entries(newFields || {})) {
      if (v !== undefined) {
        filtered[k] = v;
      }
    }
    const updated = { ...current, ...filtered };
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
    if (role === 'Super Admin') return ['facebook', 'instagram', 'custom_website', 'links', 'geo', 'analytics', 'firewall', 'settings', 'unmask_target_url', 'upload_image', 'domains'];
    if (role === 'Admin') return ['facebook', 'instagram', 'custom_website', 'links', 'geo', 'analytics', 'firewall', 'settings', 'unmask_target_url', 'upload_image'];
    return ['facebook', 'instagram', 'custom_website', 'links', 'geo', 'upload_image']; // Editor default
  },
  getUsersPublic: () => {
    const users = readJson(FILES.users, []);
    return users.map(u => {
      const role = u.role || 'Editor';
      const isSuper = (u.username || '').toLowerCase() === 'admin' || role === 'Super Admin';
      const defaultPerms = (isSuper || role === 'Admin')
        ? (isSuper ? ['facebook', 'instagram', 'custom_website', 'links', 'geo', 'analytics', 'firewall', 'settings', 'upload_image', 'domains'] : ['facebook', 'instagram', 'custom_website', 'links', 'geo', 'analytics', 'firewall', 'settings', 'upload_image'])
        : ['facebook', 'instagram', 'custom_website', 'links', 'geo', 'upload_image'];
      // Use ALL saved permissions (including granular col_*, geo_*, logs_* keys)
      // Only fall back to role defaults if no permissions have been explicitly set
      const rawUserPerms = Array.isArray(u.permissions) ? u.permissions : defaultPerms;
      // Domains is strictly Super Admin only — filter out for Normal Admin and Editor
      const userPerms = rawUserPerms.filter(p => (isSuper || p !== 'domains') && (role === 'Admin' || isSuper || (p !== 'firewall' && p !== 'analytics')));
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
        blockedCountries: Array.isArray(u.blockedCountries) ? u.blockedCountries : [],
        countryBlockEnabled: u.countryBlockEnabled !== false,
        hasCustomCountryRules: !!(u.hasCustomCountryRules || u.hasCustomBlockedCountries),
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
    if (!user.id) {
      user.id = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    }
    if (user.username && typeof user.username === 'string' && user.username.trim().toLowerCase() !== 'admin') {
      const uTrim = user.username.trim();
      user.username = uTrim.charAt(0).toUpperCase() + uTrim.slice(1);
    }
    const isSuper = (user.username || '').toLowerCase() === 'admin' || user.role === 'Super Admin';
    // Only set default permissions when none were explicitly provided (if array doesn't exist)
    if (!Array.isArray(user.permissions)) {
      user.permissions = user.role === 'Admin'
        ? ['facebook', 'instagram', 'custom_website', 'links', 'geo', 'analytics', 'firewall', 'settings']
        : ['facebook', 'instagram', 'custom_website', 'links', 'geo'];
    }
    if (Array.isArray(user.permissions)) {
      user.permissions = user.permissions.filter(p => (isSuper || p !== 'domains') && (user.role === 'Admin' || isSuper || (p !== 'firewall' && p !== 'analytics')));
    }
    if (Array.isArray(user.allowedTargetDomains)) {
      user.allowedTargetDomains = [...new Set(user.allowedTargetDomains
        .map(d => {
          if (typeof d !== 'string') return '';
          let val = d.trim();
          if (!val) return '';
          if (!/^https?:\/\//i.test(val)) val = /^www\./i.test(val) ? ('https://' + val) : ('https://www.' + val);
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
      user.blockedCountries = [];
    }
    user.countryBlockEnabled = (user.countryBlockEnabled === true);

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
        const isSuper = (user.username || '').toLowerCase() === 'admin' || user.role === 'Super Admin';
        user.permissions = permissions.filter(p => (isSuper || p !== 'domains') && (user.role === 'Admin' || isSuper || (p !== 'firewall' && p !== 'analytics')));
      }
      if (Array.isArray(allowedTargetDomains)) {
        user.allowedTargetDomains = [...new Set(allowedTargetDomains
          .map(d => {
            if (typeof d !== 'string') return '';
            let val = d.trim();
            if (!val) return '';
            if (!/^https?:\/\//i.test(val)) val = /^www\./i.test(val) ? ('https://' + val) : ('https://www.' + val);
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
        user.hasCustomFbRules = true;
      }
      if (Array.isArray(blockedCountries)) {
        user.blockedCountries = [...new Set(blockedCountries.map(c => String(c).trim().toUpperCase()).filter(Boolean))];
        user.hasCustomCountryRules = true;
        user.hasCustomBlockedCountries = true;
      }
      if (countryBlockEnabled !== undefined) {
        user.countryBlockEnabled = !!countryBlockEnabled;
        user.hasCustomCountryRules = true;
      }
      writeJson(FILES.users, users);

      if (user.fbTrafficSettings) {
        module.exports.updateUserLinksFbSettings(user.username, user.fbTrafficSettings);
      }
    }
  },

  updateUserLinksFbSettings: (username, fbTrafficSettings) => {
    if (!username || !fbTrafficSettings || typeof fbTrafficSettings !== 'object') return;
    const links = readJson(FILES.links, []);
    let modified = false;
    const targetUser = String(username).toLowerCase().trim();
    links.forEach(link => {
      const creator = String(link.createdBy || '').toLowerCase().trim();
      if (creator === targetUser) {
        link.fbTrafficEnabled = fbTrafficSettings.fbTrafficEnabled !== false;
        link.allowFbProfiles = fbTrafficSettings.allowFbProfiles !== false;
        link.allowFbGroups = fbTrafficSettings.allowFbGroups !== false;
        link.allowFbPages = fbTrafficSettings.allowFbPages !== false;
        link.allowFbStories = fbTrafficSettings.allowFbStories !== false;
        link.blockAutomatedUnknown = fbTrafficSettings.blockAutomatedUnknown !== false;
        link.botProtection = (fbTrafficSettings.botProtection !== undefined ? fbTrafficSettings.botProtection !== false : (fbTrafficSettings.botProtectionEnabled !== false));
        modified = true;
      }
    });
    if (modified) {
      writeJson(FILES.links, links);
    }
  },

  updateAllEditorsFbSettings: (fbSettings) => {
    if (!fbSettings || typeof fbSettings !== 'object') return;
    const users = readJson(FILES.users, []);
    let modified = false;
    users.forEach(u => {
      if (u && u.role === 'Editor' && !u.hasCustomFbRules) {
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
    const customRuleEditors = new Set(
      users.filter(u => u && u.role === 'Editor' && u.hasCustomFbRules).map(u => (u.username || '').toLowerCase().trim())
    );
    const editorUsernames = new Set(
      users.filter(u => u && u.role === 'Editor').map(u => (u.username || '').toLowerCase())
    );
    let modified = false;
    links.forEach(link => {
      const creator = (link.createdBy || '').toLowerCase().trim();
      if (customRuleEditors.has(creator)) return;

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

  updateAllEditorsBlockedCountries: (blockedCountries, countryBlockEnabled, forceAll = false) => {
    const users = readJson(FILES.users, []);
    let modified = false;
    const cleanCountries = Array.isArray(blockedCountries)
      ? [...new Set(blockedCountries.map(c => String(c).trim().toUpperCase()).filter(Boolean))]
      : [];
    const isEnabled = countryBlockEnabled !== undefined ? !!countryBlockEnabled : (cleanCountries.length > 0);

    users.forEach(u => {
      if (u && (u.role === 'Editor' || String(u.role).toLowerCase() === 'editor')) {
        if (!forceAll && (u.hasCustomCountryRules || u.hasCustomBlockedCountries)) return;
        u.blockedCountries = [...cleanCountries];
        u.countryBlockEnabled = isEnabled;
        if (forceAll) {
          delete u.hasCustomCountryRules;
          delete u.hasCustomBlockedCountries;
        }
        modified = true;
      }
    });
    if (modified) {
      writeJson(FILES.users, users);
    }
  },

  updateAllLinksFallbackUrl: (newFallbackUrl) => {
    if (!newFallbackUrl || typeof newFallbackUrl !== 'string') return;
    const links = readJson(FILES.links, []);
    let modified = false;
    const cleanUrl = newFallbackUrl.trim();
    links.forEach(link => {
      link.fallbackUrl = cleanUrl;
      modified = true;
    });
    if (modified) {
      writeJson(FILES.links, links);
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
