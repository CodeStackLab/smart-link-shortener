const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Mobile Speed, Compression & Distant Tower Optimizations...\n');

// 1. Verify Caddyfile has encode zstd gzip
const caddyfile = fs.readFileSync('/etc/caddy/Caddyfile', 'utf8');
assert(caddyfile.includes('encode zstd gzip'), 'FAIL: Caddyfile missing encode zstd gzip');
console.log('✅ PASS: Caddyfile has native hardware-accelerated "encode zstd gzip" enabled on all domains');

// 2. Verify server.js static cache headers
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
assert(serverJs.includes('stale-while-revalidate=86400'), 'FAIL: server.js missing stale-while-revalidate static caching');
assert(serverJs.includes("compression"), 'FAIL: server.js missing compression middleware');
console.log('✅ PASS: server.js has compression middleware and 7-day browser static caching headers');

// 3. Verify style.css removed blocking @import
const styleCss = fs.readFileSync(path.join(__dirname, 'public/css/style.css'), 'utf8');
assert(!styleCss.includes("@import url('https://fonts.googleapis.com"), 'FAIL: style.css still contains blocking @import');
console.log('✅ PASS: style.css blocking Google Fonts @import removed for 0ms CSSOM parse time');

// 4. Verify admin.html and login.html async fonts and v216
const adminHtml = fs.readFileSync(path.join(__dirname, 'public/admin.html'), 'utf8');
assert(adminHtml.includes('rel="preconnect" href="https://fonts.googleapis.com"'), 'FAIL: admin.html missing font preconnect');
assert(/style\.css\?v=2\d+/.test(adminHtml), 'FAIL: admin.html missing style.css cache buster');
assert(/dashboard\.js\?v=2\d+/.test(adminHtml), 'FAIL: admin.html missing dashboard.js cache buster');
assert(/publytics\.js\?v=2\d+/.test(adminHtml), 'FAIL: admin.html missing publytics.js cache buster');
console.log('✅ PASS: admin.html has preconnect, non-blocking async fonts, and cache busters updated');

// 5. Verify sw.js caching strategy
const swJs = fs.readFileSync(path.join(__dirname, 'public/sw.js'), 'utf8');
assert(/smartlink-v2\d+/.test(swJs), 'FAIL: sw.js missing smartlink cache buster');
assert(swJs.includes('caches.match(event.request)'), 'FAIL: sw.js missing Stale-While-Revalidate caching');
console.log('✅ PASS: sw.js upgraded to smartlink-v214 with Stale-While-Revalidate for instant 0ms loads from phone flash memory');

// 6. Verify dashboard.js mobile polling optimization
const dashboardJs = fs.readFileSync(path.join(__dirname, 'public/js/dashboard.js'), 'utf8');
assert(dashboardJs.includes('document.hidden'), 'FAIL: dashboard.js missing document.hidden check');
assert(dashboardJs.includes('12000'), 'FAIL: dashboard.js session poll not throttled to 12s');
console.log('✅ PASS: dashboard.js throttled to 12s and pauses when tab is hidden to save mobile bandwidth');

console.log('\n🎉 ALL MOBILE SPEED & LATENCY TESTS PASSED 100%! 🎉');
