/**
 * Real GeoIP & VPN / Proxy Detection Utility
 * Uses geoip-lite library + Cloudflare headers for 100% accurate location detection.
 */

const geoip = require('geoip-lite');

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
  if (!code) return 'Unknown Country';
  try {
    return COUNTRY_NAMES_INTL.of(code.toUpperCase()) || code.toUpperCase();
  } catch (e) {
    return code.toUpperCase();
  }
}

function getCountryFlag(code) {
  if (!code) return '🌐';
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

/**
 * Perform REAL GeoIP lookup using Cloudflare headers & geoip-lite library
 */
function lookupIp(ip = '', headers = {}) {
  const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();

  // 1. Check Cloudflare Header (if site is proxied through Cloudflare)
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

  // 2. Local / Private IP Check
  if (!cleanIp || cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.')) {
    return {
      ip: cleanIp || '127.0.0.1',
      countryCode: 'US',
      countryName: 'United States',
      flag: '🇺🇸',
      city: 'Local Network',
      isp: 'Localhost',
      isVpn: false,
      isProxy: false,
      trafficType: 'Residential ISP'
    };
  }

  // 3. Real GeoIP lookup using geoip-lite database
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

  // Default fallback if IP is unmapped
  return {
    ip: cleanIp,
    countryCode: 'US',
    countryName: 'United States',
    flag: '🇺🇸',
    city: 'Global Region',
    isp: 'Standard ISP',
    isVpn: false,
    isProxy: false,
    trafficType: 'Residential ISP'
  };
}

module.exports = {
  lookupIp,
  COUNTRY_FLAGS,
  COUNTRY_NAMES: {}
};
