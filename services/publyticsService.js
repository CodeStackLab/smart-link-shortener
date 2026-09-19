const db = require('../db');

const PUBLYTICS_BASE_URL = 'https://publytics.net/api';

// In-memory cache to respect Publytics rate limits and speed up client queries
const cache = new Map();

function getCache(key, maxAgeMs) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > maxAgeMs) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
  if (cache.size > 200) {
    // Evict oldest entries
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

function clearCache() {
  cache.clear();
}

/**
 * Extracts default site ID if not explicitly configured, e.g. from tracking script:
 * <script defer data-domain="33gb.online/bCatRU" src="https://api.publytics.net/js/script.manual.min.js"></script>
 */
function extractSiteIdFromScript(scriptString) {
  if (!scriptString || typeof scriptString !== 'string') return '';
  const match = scriptString.match(/data-domain=["']([^"']+)["']/i);
  return match ? match[1].trim() : '';
}

function getEffectiveConfig() {
  const settings = db.getSettings();
  const token = (process.env.PUBLYTICS_API_TOKEN || settings.publyticsApiToken || '').trim();
  let siteId = (settings.publyticsSiteId || '').trim();
  if (!siteId && settings.publyticsTrackingScript) {
    siteId = extractSiteIdFromScript(settings.publyticsTrackingScript);
  }
  const sitesList = Array.isArray(settings.publyticsSitesList) && settings.publyticsSitesList.length > 0
    ? settings.publyticsSitesList
    : (siteId ? [{ id: siteId, name: siteId }] : []);

  return { token, siteId, sitesList };
}

async function apiRequest(endpointPath, { query = {}, siteIdOverride = null, cacheMs = 30000, method = 'GET' } = {}) {
  const config = getEffectiveConfig();
  if (!config.token) {
    const error = new Error('Publytics API Token is not configured. Please configure your API token in settings.');
    error.code = 'PUB_TOKEN_MISSING';
    error.statusCode = 400;
    throw error;
  }

  const activeSiteId = (siteIdOverride || config.siteId || '').trim();
  if (!activeSiteId && !endpointPath.startsWith('/sites')) {
    const error = new Error('No Publytics Site ID specified. Please select or configure a Site ID.');
    error.code = 'PUB_SITE_MISSING';
    error.statusCode = 400;
    throw error;
  }

  // Replace {siteId} placeholder in endpoint path if present
  let resolvedPath = endpointPath.replace('{siteId}', encodeURIComponent(activeSiteId));
  if (!resolvedPath.startsWith('/')) resolvedPath = '/' + resolvedPath;

  // Build query string
  const url = new URL(PUBLYTICS_BASE_URL + resolvedPath);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  const cacheKey = `${method}:${url.toString()}`;
  if (method === 'GET' && cacheMs > 0) {
    const cached = getCache(cacheKey, cacheMs);
    if (cached) return { ...cached, _cached: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/json',
        'User-Agent': 'SmartLinkShortener-PublyticsClient/1.0'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';
    let body;
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      const text = await response.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }

    if (!response.ok) {
      const err = new Error(body.message || body.error || `Publytics API request failed with status ${response.status}`);
      err.statusCode = response.status;
      err.code = response.status === 401 ? 'PUB_UNAUTHORIZED'
               : response.status === 403 ? 'PUB_FORBIDDEN'
               : response.status === 429 ? 'PUB_RATE_LIMITED'
               : response.status === 404 ? 'PUB_NOT_FOUND'
               : 'PUB_API_ERROR';
      err.details = body;
      throw err;
    }

    if (method === 'GET' && cacheMs > 0) {
      setCache(cacheKey, body);
    }

    return body;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Publytics API request timed out (12s).');
      timeoutErr.statusCode = 504;
      timeoutErr.code = 'PUB_TIMEOUT';
      throw timeoutErr;
    }
    throw err;
  }
}

const publyticsService = {
  getConfig() {
    const config = getEffectiveConfig();
    const masked = config.token ? (config.token.slice(0, 4) + '••••••••' + config.token.slice(-4)) : '';
    return {
      hasToken: Boolean(config.token),
      tokenMasked: masked,
      maskedToken: masked,
      currentSiteId: config.siteId,
      sitesList: config.sitesList
    };
  },

  updateConfig({ apiToken, siteId, sitesList }) {
    const updates = {};
    if (apiToken !== undefined) updates.publyticsApiToken = String(apiToken || '').trim();
    if (siteId !== undefined) updates.publyticsSiteId = String(siteId || '').trim();
    if (Array.isArray(sitesList)) updates.publyticsSitesList = sitesList;

    const saved = db.updateSettings(updates);
    clearCache();

    return this.getConfig();
  },

  async testConnection({ apiToken, siteId }) {
    const token = (apiToken || getEffectiveConfig().token || '').trim();
    const site = (siteId || getEffectiveConfig().siteId || '').trim();

    if (!token) {
      throw new Error('Please provide an API Bearer token to test.');
    }
    if (!site) {
      throw new Error('Please provide a Site ID to test.');
    }

    // Attempt a lightweight test call to visitors/hostname or realtime
    const url = `${PUBLYTICS_BASE_URL}/site/${encodeURIComponent(site)}/visitors/hostname`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (res.status === 401) {
      throw new Error('Invalid API Bearer Token (401 Unauthorized). Please check your token in Publytics.');
    }
    if (res.status === 403) {
      throw new Error('Access Forbidden (403). Ensure this site has an active Publytics subscription.');
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Publytics API returned HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    return { success: true, message: 'Successfully connected to Publytics API!' };
  },

  async getSites() {
    const config = getEffectiveConfig();
    if (!config.token) {
      return { sites: config.sitesList, currentSiteId: config.siteId };
    }

    // Try fetching available sites from Publytics API if endpoint exists
    try {
      const res = await apiRequest('/sites', { cacheMs: 60000 });
      if (Array.isArray(res)) {
        return { sites: res, currentSiteId: config.siteId };
      }
      if (res && Array.isArray(res.data)) {
        return { sites: res.data, currentSiteId: config.siteId };
      }
    } catch {
      // Fall back to configured list
    }

    return { sites: config.sitesList, currentSiteId: config.siteId };
  },

  // 1. Real-Time Analytics
  async getRealtime(siteId, query = {}) {
    // 5s cache for real-time
    try {
      return await apiRequest('/site/{siteId}/realtime', {
        siteIdOverride: siteId,
        query,
        cacheMs: 5000
      });
    } catch (err) {
      // If /realtime is not the exact path, attempt fallback to visitors/realtime
      if (err.statusCode === 404) {
        return await apiRequest('/site/{siteId}/visitors/realtime', {
          siteIdOverride: siteId,
          query,
          cacheMs: 5000
        });
      }
      throw err;
    }
  },

  // 2. Main Analytics / Overview (Users, Sessions, Pageviews, Duration, Bounce Rate)
  async getOverview(siteId, query = {}) {
    try {
      return await apiRequest('/site/{siteId}/visitors/overview', {
        siteIdOverride: siteId,
        query,
        cacheMs: 30000
      });
    } catch (err) {
      if (err.statusCode === 404) {
        return await apiRequest('/site/{siteId}/overview', {
          siteIdOverride: siteId,
          query,
          cacheMs: 30000
        });
      }
      throw err;
    }
  },

  // 3 & 4. Dimension breakdown (country, device, browser, os, hostname, page, utm_*, referrer, source)
  async getDimension(siteId, dimension, query = {}) {
    const validDimensions = [
      'hostname', 'country', 'device', 'browser', 'os', 'page', 'content',
      'referrer', 'source', 'source_medium', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'
    ];

    const cleanDim = String(dimension || '').trim().toLowerCase();
    if (!validDimensions.includes(cleanDim)) {
      throw new Error(`Invalid dimension requested: ${cleanDim}`);
    }

    return await apiRequest(`/site/{siteId}/visitors/${cleanDim}`, {
      siteIdOverride: siteId,
      query,
      cacheMs: 30000
    });
  },

  // 5. User List & Individual User Deep Dive
  async getUsers(siteId, query = {}) {
    try {
      return await apiRequest('/site/{siteId}/users', {
        siteIdOverride: siteId,
        query,
        cacheMs: 30000
      });
    } catch (err) {
      if (err.statusCode === 404) {
        return await apiRequest('/site/{siteId}/visitors/users', {
          siteIdOverride: siteId,
          query,
          cacheMs: 30000
        });
      }
      throw err;
    }
  },

  async getUserDetails(siteId, userId, query = {}) {
    if (!userId) throw new Error('User ID is required.');
    return await apiRequest(`/site/{siteId}/users/${encodeURIComponent(userId)}`, {
      siteIdOverride: siteId,
      query,
      cacheMs: 30000
    });
  },

  clearCache() {
    clearCache();
  }
};

module.exports = publyticsService;
