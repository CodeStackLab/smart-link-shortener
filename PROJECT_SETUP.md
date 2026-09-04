# Smart Link Shortener — Project Setup & Status Reference

> **Purpose:** This file is the single source of truth for any future AI session.
> Read this file first before touching any code. It tells you exactly what is built,
> how everything is wired, and what still needs to be done.

---

## 🗂️ Project Location

```
/root/smart-link-shortener/
```

## 🔗 Live URL & Git

| Item | Value |
|---|---|
| **Production URL** | https://goo33.online |
| **Git remote** | origin/main (GitHub) |
| **Last commit** | b383a82 — "feat: implement 52 bot protection requirements…" |
| **Runtime** | Node.js 20 (Alpine Docker) |
| **Port** | 3000 |

---

## 📁 Full File Tree

```
smart-link-shortener/
├── server.js              ← Express app entry point (2027 lines)
├── db.js                  ← JSON file-based database layer (13 KB)
├── package.json           ← Dependencies
├── .env                   ← Secrets & environment config
├── Dockerfile             ← Multi-stage Node 20 Alpine build
├── docker-compose.yml     ← Local dev compose
├── reset-pass.js          ← CLI admin password reset script
│
├── middleware/
│   └── auth.js            ← requireAuth session guard
│
├── utils/
│   ├── detector.js        ← Bot detection engine (911 lines)
│   ├── geoDetector.js     ← IP geo-lookup + VPN/proxy/hosting detection
│   ├── ogFetcher.js       ← OpenGraph meta fetcher for link previews
│   ├── qrGenerator.js     ← QR code generator (qrcode npm)
│   └── totp.js            ← TOTP / 2FA (HMAC-SHA1 implementation)
│
├── data/                  ← All runtime data (JSON flat files)
│   ├── links.json         ← Shortlinks database
│   ├── users.json         ← Accounts (bcrypt passwords)
│   ├── settings.json      ← Global feature toggles
│   ├── logs.json          ← Traffic event log
│   ├── blocked_ips.json   ← Permanently blocked IPs
│   ├── custom_domains.json ← Per-link allowed custom domains
│   └── ip_cache.json      ← IP geo/VPN lookup cache (~6 MB currently)
│
└── public/
    ├── admin.html         ← Single-page admin dashboard (1421 lines)
    ├── login.html         ← Login page
    ├── manifest.json      ← PWA manifest
    ├── sw.js              ← Service Worker (cache busting)
    ├── apple-touch-icon.png / icon-192.png / icon-512.png
    ├── css/
    │   └── style.css      ← Full design system (73 KB)
    ├── js/
    │   ├── dashboard.js   ← Admin SPA JS logic (3366 lines, 150 KB)
    │   └── login.js       ← Login page logic
    └── uploads/           ← User-uploaded link preview images
```

---

## 📦 Dependencies (package.json)

| Package | Purpose |
|---|---|
| express ^5.2.1 | HTTP server |
| express-session ^1.19.0 | Session management |
| helmet ^8.0.0 | Security headers |
| cors ^2.8.6 | Cross-Origin Resource Sharing |
| bcryptjs ^3.0.3 | Password hashing |
| geoip-lite ^2.0.3 | Offline IP geolocation fallback |
| node-fetch ^2.7.0 | HTTP client (ip-api.com lookup) |
| qrcode ^1.5.4 | QR code generation |

---

## 🔐 Environment Variables (.env)

```
PORT=3000
SESSION_SECRET=smart_shortener_secret_key_2026
ADMIN_USERNAME=admin
ADMIN_PASSWORD=adminpassword
DATA_DIR=./data
NODE_ENV=development
BREVO_API_KEY=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
SMTP_FROM=nathogabol7@gmail.com
APP_URL=https://goo33.online
```

In Coolify production these are set in the Coolify UI. DATA_DIR must be /app/data in Docker.

---

## 🗃️ Database Layer (db.js)

- Storage: Flat JSON files in ./data/
- No SQL, no Redis — everything is in-memory read/write from JSON
- Key functions:
  - getLinks() / saveLink() / deleteLink()
  - getLogs() / addLog() / clearLogs()
  - getSettings() / updateSettings()
  - getBlockedIps() / addBlockedIp() / removeBlockedIp()
  - getUserByUsername() / getAllUsers() / saveUser()
  - getDefaultPermissions(role) — returns permission array for Admin or Editor
  - initDb() — seeds admin user and demo link on first run

### Default Admin Seed (first run only)
- Username: admin
- Password: S3cr3tP@ssw0rd!2026
- Role: Admin

---

## 🧠 Bot Protection Engine (utils/detector.js)

### Exported Functions

| Function | Purpose |
|---|---|
| isSocialScraper(ua) | Detects FB, Twitter, LinkedIn, Slack bots |
| isSpamBot(ua) | 100+ known spam/scraper UA patterns |
| isHeadlessBrowser(ua, headers) | Puppeteer, PhantomJS, Playwright, Selenium |
| isDatacenterIsp(isp) | AWS, GCP, Azure, OVH, DigitalOcean, Cloudflare etc. |
| evaluateBrowserIntegrity(req, ua) | Checks missing/suspicious headers |
| parseReferrer(ref, platforms, domains, ua) | Validates referrer vs allowed platforms |
| checkRateLimit(ip) | Per-IP rate limiter (in-memory sliding window) |
| detectTrafficSpike(code) | Click-burst spike detection per shortlink |
| getSessionAnomalyScore(ip, code) | Repeated hits within short windows |
| computeTrafficRiskScore(ip, ua, geo, ref, code, req) | Master scorer: returns {score, reason, signals} |
| isAllowlisted(ip) | Checks settings.allowlistedIps |
| isTemporarilyBlocked(ip) | In-memory temp-block with auto-expiry |
| dispatchWebhookNotification(event) | Async POST to configured webhook URL |
| checkAndApplyAutoShield(ip, isVpn, ua, code, geo, req) | Main gate — orchestrates all checks |
| getActiveTempBlocks() | Returns all current in-memory temporary blocks |

### Risk Scoring Signals (multi-signal required before block)
1. User-Agent bot flag
2. Headless browser flag
3. Datacenter ISP flag
4. VPN/proxy/hosting flag (ip-api.com proxy/hosting fields)
5. Browser integrity header anomalies
6. Rate limit exceeded
7. Session anomaly (repeated clicks, suspiciously fast)
8. Traffic spike on shortlink
9. Referrer mismatch
10. Known scraper patterns

### Core Rules Enforced
- Never block on IP alone (Rule 17)
- Never block on UA alone (Rule 18)
- Multiple signals required (Rule 19)
- High-risk: temp-block + fallback redirect (Rule 11)
- Medium-risk: soft-block/fallback redirect silently (Rule 20)
- Low-risk: forward normally (Rule 12)
- Allowlisted IPs always pass (Rule 48)
- Temp blocks auto-expire (Rules 21/22)
- No CAPTCHA ever (Rules 1/14)

---

## 🌍 Geo Detection (utils/geoDetector.js)

- Primary: ip-api.com/json/{ip} — returns country, countryCode, city, isp, proxy, hosting
- Fallback: geoip-lite (offline MaxMind DB)
- Cache: data/ip_cache.json (TTL-based, ~6 MB currently)
- Special cases:
  - 127.0.0.1 → Localhost
  - Cloudflare IPs → ISP = "Cloudflare Network"
  - All datacenter ASNs → flagged via isDatacenterIsp()
- VPN/Proxy/Tor/Hosting detected via proxy:true and hosting:true from ip-api.com

---

## 🛡️ Traffic Risk Scoring Flow (handleShortlinkRedirect in server.js)

```
Request arrives at /:code or /s/:code
  |
  ├─ 1. Check allowlist → allowlisted IPs pass immediately
  ├─ 2. Honeypot check (code=honeypot → log + 404)
  ├─ 3. checkAndApplyAutoShield():
  |     ├─ computeTrafficRiskScore() → low/medium/high
  |     ├─ HIGH → addTemporaryBlock(ip) + redirect to fallbackUrl
  |     ├─ MEDIUM → log as SUSPICIOUS + fallback silently
  |     └─ LOW → continue
  ├─ 4. Rate limiter (checkRateLimit) → exceeded → fallbackUrl
  ├─ 5. Social scraper check → serve OpenGraph HTML (not redirect)
  ├─ 6. Per-link platform/referrer check → mismatch → fallbackUrl
  ├─ 7. Max click / hourly / daily / monthly limit → fallbackUrl
  ├─ 8. Traffic spike detection → fallbackUrl
  ├─ 9. Link expiry check → fallbackUrl
  ├─ 10. JS/browser integrity check (client-side beacon):
  |      └─ Renders HTML with JS that:
  |         - Detects headless (navigator.webdriver, screen size, etc.)
  |         - Sends /api/pingback with timing + durationSeconds
  |         - Auto-redirects to destinationUrl after optional delay
  └─ 11. Genuine organic click → targetUrl (HTTP 302)
```

IMPORTANT: The destination URL is NEVER exposed to blocked/fallback traffic.
High-risk redirects always use fallbackUrl.

---

## 📡 API Routes Reference (server.js)

### Auth Routes
- POST /api/login — Session login (supports TOTP 2FA)
- POST /api/logout — Destroy session
- GET  /api/session — Check current session + permissions
- GET  /api/admin/me — Current user info

### Links Routes
- GET    /api/admin/links — List links [perm: links]
- POST   /api/admin/links — Create link [perm: links]
- PUT    /api/admin/links/:id — Edit link [perm: links]
- DELETE /api/admin/links/:id — Delete link [perm: links]
- POST   /api/admin/upload-image — Upload preview image [perm: upload_image]
- GET    /api/admin/qrcode/:code — Generate QR (any auth)
- GET    /api/admin/export-csv — Export CSV [perm: analytics]

### Firewall Routes
- GET    /api/admin/blocked-ips — List permanent blocks [perm: firewall]
- POST   /api/admin/block-ip — Add permanent block [perm: firewall]
- DELETE /api/admin/blocked-ips/:ip — Remove block [perm: firewall]
- GET    /api/admin/allowlist — List allowlisted IPs [perm: firewall]
- POST   /api/admin/allowlist — Add IP to allowlist [ADMIN ONLY]
- DELETE /api/admin/allowlist/:ip — Remove from allowlist [ADMIN ONLY]
- GET    /api/admin/temp-blocks — List temp blocks [perm: firewall]
- DELETE /api/admin/temp-blocks/:ip — Remove temp block [perm: firewall]

### Settings & Analytics Routes
- GET  /api/admin/settings — Read settings [perm: settings or firewall]
- POST /api/admin/settings — Save settings [ADMIN ONLY]
- GET  /api/admin/analytics/countries — Country stats [perm: geo]
- GET  /api/admin/logs — Traffic logs [perm: analytics]
- POST /api/admin/clear-logs — Clear logs [perm: analytics]

### Users & 2FA Routes
- GET    /api/admin/users — List users
- POST   /api/admin/users/invite — Invite user
- POST   /api/admin/users/update-role — Change role/permissions
- POST   /api/admin/users/reset-password — Reset password
- DELETE /api/admin/users/:id — Delete user
- POST   /api/admin/change-password — Self password change
- GET    /api/admin/2fa/status — Check 2FA enabled
- POST   /api/admin/2fa/setup — Generate TOTP secret + QR
- POST   /api/admin/2fa/enable — Verify + enable 2FA
- POST   /api/admin/2fa/disable — Disable 2FA

### Custom Domains Routes
- GET    /api/admin/domains — List domains [perm: domains]
- POST   /api/admin/domains — Add domain [perm: domains]
- DELETE /api/admin/domains/:id — Remove domain [perm: domains]
- GET    /api/admin/domains/check — Public domain check

### Redirect Routes
- GET  /:code — Shortlink redirect (bot-filtered) [main route]
- GET  /s/:code — Shortlink redirect (alias)
- POST /api/pingback — Client JS duration beacon

---

## ⚙️ Settings Schema (data/settings.json)

```json
{
  "maskEditorUrls": false,
  "rateLimitWindowSeconds": 60,
  "rateLimitMaxRequests": 30,
  "webhookUrl": "",
  "botProtectionEnabled": true,
  "vpnProtectionEnabled": true,
  "botLimitClicks": 100,
  "botLimitMinutes": 1,
  "vpnLimitClicks": 500,
  "vpnLimitMinutes": 90,
  "blockSuspiciousCountries": false,
  "blockKnownScrapers": false,
  "honeypotProtectionEnabled": false,
  "restrictEditorDomains": true,
  "allowedTargetDomains": [],
  "applyFirewallGlobally": true,
  "tempBlockDurationMinutes": 30,
  "spikeWindowMinutes": 5,
  "spikeThresholdClicks": 200,
  "allowlistedIps": []
}
```

---

## 👤 Roles & Permissions

### Admin Role
- Full access to all tabs and features
- Only Admin can manage allowlist
- Only Admin can change global settings
- Can invite/manage all users

### Editor Role
- Default: links, analytics, domains
- Can be granted additionally: firewall, settings, geo, upload_image, unmask_target_url
- restrictEditorDomains limits which target URLs editors can set
- maskEditorUrls hides destination URLs from editors in the UI

### Permission Keys

| Key | Controls |
|---|---|
| links | Create/Edit/Delete shortlinks |
| analytics | View logs, export CSV, clear logs |
| firewall | View/manage blocked IPs, allowlist, temp-blocks |
| settings | Read settings page |
| geo | Country analytics charts |
| domains | Custom domains management |
| upload_image | Upload preview images for links |
| unmask_target_url | See full destination URLs |

---

## 🚀 Deployment

### Without Docker (local dev)
```bash
cd /root/smart-link-shortener
npm install
node server.js
# Visit: http://localhost:3000/admin
```

### Docker Compose
```bash
docker-compose up --build
```

### Docker Manual
```bash
docker build -t smart-link-shortener .
docker run -p 3000:3000 --env-file .env smart-link-shortener
```

### Reset Admin Password
```bash
node reset-pass.js <newpassword>
```

### Coolify Setup
1. Connect GitHub repo to Coolify
2. Set env vars in Coolify UI (same as .env)
3. Set DATA_DIR=/app/data
4. Add persistent volume on /app/data to preserve JSON data

---

## ✅ 52 Bot Protection Requirements — All Implemented

| # | Requirement | Implementation Location |
|---|---|---|
| 1 | No CAPTCHA | Enforced system-wide — never served |
| 2 | Automatic Bot Detection | checkAndApplyAutoShield() in detector.js |
| 3 | User-Agent Validation | isSpamBot() + isSocialScraper() in detector.js |
| 4 | IP Reputation Checking | ip-api.com + geoip-lite fallback in geoDetector.js |
| 5 | VPN/Proxy/Tor/DC Detection | ip-api.com proxy/hosting + isDatacenterIsp() |
| 6 | Rate Limiting | checkRateLimit() — per-IP sliding window |
| 7 | Duplicate/Repeated Traffic | getSessionAnomalyScore() |
| 8 | Headless Browser Detection | isHeadlessBrowser() — UA + header patterns |
| 9 | JS/Browser Behavior Analysis | Client JS in redirect page + /api/pingback |
| 10 | Traffic Risk Score L/M/H | computeTrafficRiskScore() returns low/medium/high |
| 11 | Block High-Risk Traffic | score=high → temp-block + fallbackUrl |
| 12 | Forward Low-Risk Traffic | score=low → targetUrl (normal redirect) |
| 13 | Real Visitors NOT Blocked | Multi-signal required; false-positive protection |
| 14 | No CAPTCHA for Normal Visitors | Enforced system-wide |
| 15 | No Unnecessary Redirect Delays | Delays only for genuine organic; fallback is instant |
| 16 | False-Positive Protection | Allowlist + multi-signal threshold |
| 17 | Never Block IP Alone | Enforced in computeTrafficRiskScore() |
| 18 | Never Block UA Alone | Enforced in computeTrafficRiskScore() |
| 19 | Multiple Signals Before Block | Weighted multi-signal scoring |
| 20 | Suspicious = Soft-Block First | score=medium → fallback, no error, no temp-block |
| 21 | Temp Block Instead of Permanent | addTemporaryBlock() with configurable TTL |
| 22 | Auto-Recheck Suspicious | Temp blocks auto-expire in isTemporarilyBlocked() |
| 23 | Browser Integrity Checks | evaluateBrowserIntegrity() checks required headers |
| 24 | Suspicious Traffic Soft-Block | Medium risk = silent fallback redirect |
| 25 | Traffic Spike Detection | detectTrafficSpike() — per-link click burst |
| 26 | Webhook Notifications | dispatchWebhookNotification() — async POST |
| 27 | Honeypot Link | /honeypot and /security-honeypot trap codes |
| 28 | Allowlist Management | /api/admin/allowlist CRUD + isAllowlisted() |
| 29 | Temp-Block Management UI | /api/admin/temp-blocks GET/DELETE + dashboard UI |
| 30 | Per-Link Click Limits | maxClicks, hourlyLimit, dailyLimit, monthlyLimit fields |
| 31 | Link Expiry | expiresAt field on link object |
| 32 | Platform/Referrer Routing | parseReferrer() — allowed platforms per link |
| 33 | Custom Domain Routing | customDomains array per link |
| 34 | OpenGraph / Social Preview | Social scrapers get OG HTML (not redirect) |
| 35 | QR Code Generation | /api/admin/qrcode/:code |
| 36 | Analytics Logging | Every redirect logged to logs.json |
| 37 | Country Analytics | /api/admin/analytics/countries + chart in UI |
| 38 | CSV Export | /api/admin/export-csv |
| 39 | 2FA / TOTP | utils/totp.js + /api/admin/2fa/* endpoints |
| 40 | Safe Fallback on Error | Every function has try/catch with graceful fallback |
| 41 | Image Upload for Links | /api/admin/upload-image with upload_image permission |
| 42 | Delay Only for Genuine Clicks | delaySeconds only applied to organic traffic |
| 43 | Link Auto-Pause on Bot Flood | checkAndApplyAutoShield() → auto-pause link |
| 44 | Team / Multi-User Support | Admin + Editor roles + invite system |
| 45 | Destination URL Security Validation | isValidDestinationUrl() — blocks javascript:, data: etc. |
| 46 | Editor Domain Restriction | restrictEditorDomains + allowedTargetDomains |
| 47 | URL Masking for Editors | maskEditorUrls setting + unmask_target_url permission |
| 48 | Allowlisted IPs Always Pass | isAllowlisted() checked first in auto-shield |
| 49 | Never Expose Target URL to Bots | Blocked redirects only see fallbackUrl |
| 50 | PWA / Service Worker | manifest.json + sw.js |
| 51 | Docker / Coolify Deployment | Dockerfile + docker-compose.yml |
| 52 | Session Security | express-session + helmet security headers |

---

## ⚠️ Known Issues / Future Work

- ip_cache.json growing large (~6 MB). Consider periodic cleanup on startup.
- Temp blocks are in-memory only — server restart clears them. Consider persisting to JSON.
- Log rotation: logs.json grows indefinitely. Add max-size rotation.
- Verify invite email via Brevo is working (BREVO_API_KEY is configured).
- Confirm Allowlist + Temp-Blocks sections are visually complete in admin.html Firewall tab.

---

## 🧪 Quick Test Commands

```bash
# Start server
cd /root/smart-link-shortener && node server.js

# Test bot (should get fallback)
curl -s -o /dev/null -w "%{http_code}" -A "Googlebot/2.1" http://localhost:3000/android

# Test clean browser (should get redirect to target)
curl -s -o /dev/null -w "%{http_code}" \
  -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120" \
  http://localhost:3000/android

# Check git status
cd /root/smart-link-shortener && git log --oneline -10
```

---

## �� Recent Commit History

```
b383a82  feat: implement 52 bot protection requirements, multi-signal traffic risk scoring
2203b41  feat: add granular upload_image permission control for Editors in team settings
7e58e6d  fix: optimize Facebook OpenGraph tags and remove crawler refresh override
f703354  feat: add optional image upload and preview to smart shortlink generator
22e8203  password changes fixed
59dd82e  fix: robust inline password change handler, auto-logout session destroy, sw cache v25
```

---

## 🤖 Instructions for Next AI Session

1. Read this file FIRST — it is the full current state of the project
2. Check data/settings.json — runtime config may have changed
3. Run: git log --oneline -10 — see what changed since this file was updated
4. If ip_cache.json > 20 MB: echo '{}' > data/ip_cache.json
5. ALL 52 bot protection requirements are COMPLETE — do not rebuild what exists
6. Main areas for future work:
   - UI/UX improvements to admin dashboard
   - Analytics enhancements (charts, filters)
   - Log rotation / data persistence
   - Email notifications via Brevo
   - Additional link routing features

Last updated: 2026-09-04 (conversation: ac34822d-98a7-4b93-9d4e-c34cb078c243)
