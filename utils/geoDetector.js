/**
 * Real-Time GeoIP & VPN / Proxy Detection Utility
 * Uses Real-Time API (ip-api.com) + geoip-lite + Cloudflare headers + Caching
 */

const geoip = require('geoip-lite');
const fetch = require('node-fetch');

const ipGeoCache = new Map();

const COUNTRY_FLAGS = {
  AF: '🇦🇫', AL: '🇦🇱', DZ: '🇩🇿', AD: '🇦🇩', AO: '🇦🇴', AR: '🇦🇷', AM: '🇦🇲', AU: '🇦🇺', AT: '🇦🇹', AZ: '🇦🇿',
  BS: '🇧🇸', BH: '🇧🇭', BD: '🇧🇩', BB: '🇧🇧', BY: '🇧🇾', BE: '🇧🇪', BZ: '🇧🇿', BJ: '🇧🇯', BT: '🇧🇹', BO: '🇧🇴',
  BA: '🇧🇦', BW: '🇧🇼', BR: '🇧🇷', BN: '🇧🇳', BG: '🇧🇬', BF: '🇧🇫', BI: '🇧🇮', KH: '🇰🇭', CM: '🇨🇲', CA: '🇨🇦',
  CL: '🇨🇱', CN: '🇨🇳', CO: '🇨🇴', CR: '🇨🇷', HR: '🇭🇷', CU: '🇨🇺', CY: '🇨🇾', CZ: '🇨🇿', DK: '🇩🇰', DJ: '🇩🇯',
  DO: '🇩🇴', EC: '🇪🇨', EG: '🇪🇬', SV: '🇸🇻', EE: '🇪🇪', ET: '🇪🇹', FJ: '🇫🇯', FI: '🇫🇮', FR: '🇫🇷', GA: '🇬🇦',
  GE: '🇬🇪', DE: '🇩🇪', GH: '🇬🇭', GR: '🇬🇷', GT: '🇬🇹', GN: '🇬🇳', GY: '🇬🇾', HT: '🇭🇹', HN: '🇭🇳', HK: '🇭🇰',
  HU: '🇭🇺', IS: '🇮🇸', IN: '🇮🇳', ID: '🇮🇩', IR: '🇮🇷', IQ: '🇮🇶', IE: '🇮🇪', IL: '🇮🇱', IT: '🇮🇹', JM: '🇯🇲',
  JP: '🇯🇵', JO: '🇯🇴', KZ: '🇰🇿', KE: '🇰🇪', KW: '🇰🇼', KG: '🇰🇬', LA: '🇱🇦', LV: '🇱🇻', LB: '🇱🇧', LY: '🇱🇾',
  LT: '🇱🇹', LU: '🇱🇺', MO: '🇲🇴', MK: '🇲🇰', MG: '🇲🇬', MY: '🇲🇾', MV: '🇲🇻', ML: '🇲🇱', MT: '🇲🇹', MX: '🇲🇽',
  MD: '🇲🇩', MC: '🇲🇨', MN: '🇲🇳', ME: '🇲🇪', MA: '🇲🇦', MZ: '🇲🇿', MM: '🇲🇲', NA: '🇳🇦', NP: '🇳🇵', NL: '🇳🇱',
  NZ: '🇳🇿', NI: '🇳🇮', NE: '🇳🇪', NG: '🇳🇬', NO: '🇳🇴', OM: '🇴🇲', PK: '🇵🇰', PA: '🇵🇦', PY: '🇵🇾', PE: '🇵🇪',
  PH: '🇵🇭', PL: '🇵🇱', PT: '🇵🇹', QA: '🇶🇦', RO: '🇷🇴', RU: '🇷🇺', RW: '🇷🇼', SA: '🇸🇦', SN: '🇸🇳', RS: '🇷🇸',
  SG: '🇸🇬', SK: '🇸🇰', SI: '🇸🇮', ZA: '🇿🇦', ES: '🇪🇸', LK: '🇱🇰', SD: '🇸🇩', SE: '🇸🇪', CH: '🇨🇭', SY: '🇸🇾',
  TW: '🇹🇼', TJ: '🇹🇯', TZ: '🇹🇿', TH: '🇹🇭', TN: '🇹🇳', TR: '🇹🇷', TM: '🇹🇲', UG: '🇺🇬', UA: '🇺🇦', AE: '🇦🇪',
  GB: '🇬🇧', US: '🇺🇸', UY: '🇺🇾', UZ: '🇺🇿', VE: '🇻🇪', VN: '🇻🇳', YE: '🇾🇪', ZM: '🇿🇲', ZW: '🇿🇼'
};

const COUNTRY_NAMES_INTL = new Intl.DisplayNames(['en'], { type: 'region' });

function getCountryName(code) {
  if (!code || code === 'DEV' || code === 'UN') return code === 'DEV' ? 'Local Dev Traffic' : 'Unknown Country';
  try {
    return COUNTRY_NAMES_INTL.of(code.toUpperCase()) || code.toUpperCase();
  } catch (e) {
    return code.toUpperCase();
  }
}

function getCountryFlag(code) {
  if (!code || code === 'UN') return '🌐';
  if (code === 'DEV') return '💻';
  const upper = code.toUpperCase();
  if (COUNTRY_FLAGS[upper]) return COUNTRY_FLAGS[upper];
  if (upper.length === 2) {
    try {
      return String.fromCodePoint(...[...upper].map(c => 127397 + c.charCodeAt(0)));
    } catch (e) {
      return '🌐';
    }
  }
  return '🌐';
}

function isPrivateIp(cleanIp) {
  return !cleanIp || 
         cleanIp === '127.0.0.1' || 
         cleanIp === '::1' || 
         cleanIp.startsWith('192.168.') || 
         cleanIp.startsWith('10.') || 
         /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp);
}

/**
 * Real-Time Async GeoIP Lookup (Multi-Layer: Cache -> Cloudflare -> Online API -> geoip-lite -> Fallback)
 */
async function lookupIpAsync(ip = '', headers = {}) {
  const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();

  // 0. Cache check
  if (ipGeoCache.has(cleanIp)) {
    return ipGeoCache.get(cleanIp);
  }

  // 1. Cloudflare Header (if behind Cloudflare)
  const cfCountry = headers['cf-ipcountry'] || headers['CF-IPCOUNTRY'];
  if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1' && cfCountry.length === 2) {
    const code = cfCountry.toUpperCase();
    const info = {
      ip: cleanIp,
      countryCode: code,
      countryName: getCountryName(code),
      flag: getCountryFlag(code),
      city: headers['cf-ipcity'] || 'Cloudflare Verified',
      isp: 'Cloudflare Network',
      isVpn: false,
      isProxy: false,
      trafficType: 'Residential ISP'
    };
    ipGeoCache.set(cleanIp, info);
    return info;
  }

  // 2. Private/Local Network Check
  if (isPrivateIp(cleanIp)) {
    const info = {
      ip: cleanIp || '127.0.0.1',
      countryCode: 'DEV',
      countryName: 'Local Dev Traffic',
      flag: '💻',
      city: 'Local Network',
      isp: 'Localhost',
      isVpn: false,
      isProxy: false,
      trafficType: 'Residential ISP'
    };
    return info;
  }

  // 3. Try Real-Time Online API (ip-api.com) with 1.5s timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode,city,isp,proxy,hosting`, { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();

    if (data && data.status === 'success' && data.countryCode) {
      const code = data.countryCode.toUpperCase();
      const isVpnOrHosting = Boolean(data.proxy || data.hosting);
      const info = {
        ip: cleanIp,
        countryCode: code,
        countryName: data.country || getCountryName(code),
        flag: getCountryFlag(code),
        city: data.city || 'Standard City',
        isp: data.isp || 'Standard ISP',
        isVpn: isVpnOrHosting,
        isProxy: isVpnOrHosting,
        trafficType: isVpnOrHosting ? 'VPN / Proxy / Datacenter' : 'Residential ISP'
      };
      ipGeoCache.set(cleanIp, info);
      return info;
    }
  } catch (err) {
    // API timeout or network error, proceed to geoip-lite
  }

  // 4. Offline GeoIP lookup using geoip-lite database
  const geo = geoip.lookup(cleanIp);
  if (geo && geo.country) {
    const code = geo.country.toUpperCase();
    const info = {
      ip: cleanIp,
      countryCode: code,
      countryName: getCountryName(code),
      flag: getCountryFlag(code),
      city: geo.city || geo.region || 'Standard Region',
      isp: 'Standard ISP',
      isVpn: false,
      isProxy: false,
      trafficType: 'Residential ISP'
    };
    ipGeoCache.set(cleanIp, info);
    return info;
  }

  // 5. Fallback for unmapped public IP
  const info = {
    ip: cleanIp,
    countryCode: 'UN',
    countryName: 'Unknown Country',
    flag: '🌐',
    city: 'Global Network',
    isp: 'Standard ISP',
    isVpn: false,
    isProxy: false,
    trafficType: 'Residential ISP'
  };
  return info;
}

function lookupIp(ip = '', headers = {}) {
  const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();

  if (ipGeoCache.has(cleanIp)) {
    return ipGeoCache.get(cleanIp);
  }

  const cfCountry = headers['cf-ipcountry'] || headers['CF-IPCOUNTRY'];
  if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1' && cfCountry.length === 2) {
    const code = cfCountry.toUpperCase();
    return {
      ip: cleanIp,
      countryCode: code,
      countryName: getCountryName(code),
      flag: getCountryFlag(code),
      city: headers['cf-ipcity'] || 'Cloudflare Verified',
      isp: 'Cloudflare Network',
      isVpn: false,
      isProxy: false,
      trafficType: 'Residential ISP'
    };
  }

  if (isPrivateIp(cleanIp)) {
    return {
      ip: cleanIp || '127.0.0.1',
      countryCode: 'DEV',
      countryName: 'Local Dev Traffic',
      flag: '💻',
      city: 'Local Network',
      isp: 'Localhost',
      isVpn: false,
      isProxy: false,
      trafficType: 'Residential ISP'
    };
  }

  const geo = geoip.lookup(cleanIp);
  if (geo && geo.country) {
    const code = geo.country.toUpperCase();
    return {
      ip: cleanIp,
      countryCode: code,
      countryName: getCountryName(code),
      flag: getCountryFlag(code),
      city: geo.city || geo.region || 'Standard Region',
      isp: 'Standard ISP',
      isVpn: false,
      isProxy: false,
      trafficType: 'Residential ISP'
    };
  }

  return {
    ip: cleanIp,
    countryCode: 'UN',
    countryName: 'Unknown Country',
    flag: '🌐',
    city: 'Global Network',
    isp: 'Standard ISP',
    isVpn: false,
    isProxy: false,
    trafficType: 'Residential ISP'
  };
}

module.exports = {
  lookupIp,
  lookupIpAsync,
  COUNTRY_FLAGS,
  COUNTRY_NAMES: {}
};
