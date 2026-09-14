const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Running Verification Tests for Publytics Tracking & Facebook Anti-Spam...\n');

// 1. Verify admin.html UI changes
const adminHtml = fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf8');

// A. Verify Publytics tab is removed from navigation
assert(!adminHtml.includes('id="tab-btn-publytics"'), 'FAIL: tab-btn-publytics still in admin.html');
console.log('✅ PASS: tab-btn-publytics removed from top desktop navigation');

assert(!adminHtml.includes('id="mobile-nav-publytics"'), 'FAIL: mobile-nav-publytics still in admin.html');
console.log('✅ PASS: mobile-nav-publytics removed from bottom mobile navigation bar');

assert(!adminHtml.includes('id="tab-publytics"'), 'FAIL: tab-publytics still in admin.html');
console.log('✅ PASS: tab-publytics iframe container card completely removed from admin.html');

// B. Verify publytics-tracking-card exists in Settings
assert(adminHtml.includes('id="publytics-tracking-card"'), 'FAIL: publytics-tracking-card missing in admin.html');
console.log('✅ PASS: publytics-tracking-card exists in admin.html');

// Check placement: after default-fallback-url-card and before change-password-card
const fallbackPos = adminHtml.indexOf('id="default-fallback-url-card"');
const publyticsPos = adminHtml.indexOf('id="publytics-tracking-card"');
const changePassPos = adminHtml.indexOf('id="change-password-card"');

assert(fallbackPos > 0, 'FAIL: default-fallback-url-card not found');
assert(publyticsPos > fallbackPos, 'FAIL: publytics-tracking-card is not positioned after default-fallback-url-card');
assert(changePassPos > publyticsPos, 'FAIL: publytics-tracking-card is not positioned before change-password-card');
console.log('✅ PASS: publytics-tracking-card is precisely placed under Fallback Redirect in Settings tab');

// C. Verify all sub-components match simplified mockup
assert(adminHtml.includes('Add Publytics Tracking Code'), 'FAIL: Add Publytics Tracking Code title missing');
assert(adminHtml.includes('id="publytics-tracking-script-input"'), 'FAIL: publytics-tracking-script-input textarea missing');
assert(adminHtml.includes('id="btn-save-publytics-tracking"'), 'FAIL: Save button missing');
assert(adminHtml.includes('id="publytics-status-bar"'), 'FAIL: publytics-status-bar missing');
assert(adminHtml.includes('id="publytics-status-dot"'), 'FAIL: publytics-status-dot missing');
assert(adminHtml.includes('id="publytics-status-text"'), 'FAIL: publytics-status-text missing');
console.log('✅ PASS: All Publytics tracking UI elements match user simplified mockup');

// 2. Verify dashboard.js
const dashboardJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'dashboard.js'), 'utf8');
assert(!dashboardJs.includes("tabId: 'tab-publytics'"), 'FAIL: tab-publytics still in dashboard.js navMap');
assert(dashboardJs.includes('savePublyticsTrackingCode'), 'FAIL: savePublyticsTrackingCode missing in dashboard.js');
assert(dashboardJs.includes('updatePublyticsStatusDisplay'), 'FAIL: updatePublyticsStatusDisplay missing in dashboard.js');
assert(dashboardJs.includes("'publytics-tracking-card'"), 'FAIL: publytics-tracking-card not in adminOnlyFirewallCards');
console.log('✅ PASS: dashboard.js properly manages publytics-tracking-card and scoping');

// 3. Verify server.js
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
assert(serverJs.includes('delete sanitized.publyticsTrackingScript;'), 'FAIL: publyticsTrackingScript not sanitized from settings');
assert(serverJs.includes("app.post('/api/admin/publytics/test'"), 'FAIL: /api/admin/publytics/test endpoint missing');
assert(!serverJs.includes('href="/s/honeypot"'), 'FAIL: honeypot trap still in social scraper response');
assert(serverJs.includes('@type": "NewsArticle"'), 'FAIL: NewsArticle JSON-LD schema missing from crawler response');
console.log('✅ PASS: server.js protects settings, includes verification API, and eliminates honeypot spam flags');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
process.exit(0);
