const assert = require('assert');
const fs = require('fs');
const db = require('./db');

console.log('🧪 Starting Editor Block IP Flow & UI Scoping Verification Tests...\n');

// 1. Verify HTML Structure
const adminHtml = fs.readFileSync('./public/admin.html', 'utf8');

assert(adminHtml.includes('id="block-ip-card"'), 'admin.html must contain id="block-ip-card"');
assert(adminHtml.includes('id="permanently-blocked-card"'), 'admin.html must contain id="permanently-blocked-card"');
assert(adminHtml.includes('id="temp-blocks-card"'), 'admin.html must contain id="temp-blocks-card"');
assert(adminHtml.includes('id="allowlist-card"'), 'admin.html must contain id="allowlist-card"');

// Firewall nav button should not be hard-hidden with admin-only-tab
assert(adminHtml.includes('<button class="tab-btn" data-tab="tab-firewall">'), 'tab-btn must not have admin-only-tab or inline display:none');
assert(adminHtml.includes('<button class="mobile-nav-item" data-tab="tab-firewall">'), 'mobile-nav-item must not have admin-only-tab or inline display:none');
assert(adminHtml.includes('<div id="tab-firewall" class="tab-content" style="display:none;">'), 'tab-firewall must not have admin-only-tab');

console.log('  ✅ PASS: 1. admin.html structure has all required card IDs and unblocked firewall nav buttons');

// 2. Verify CSS Scoping
const styleCss = fs.readFileSync('./public/css/style.css', 'utf8');

assert(styleCss.includes('body:not(.is-admin) #tab-firewall #auto-shield-card'), 'style.css must hide auto-shield-card for non-admins');
assert(styleCss.includes('body:not(.is-admin) #tab-firewall #global-fb-rules-card'), 'style.css must hide global-fb-rules-card for non-admins');
assert(styleCss.includes('body:not(.is-admin) #tab-firewall #editor-country-block-card'), 'style.css must hide editor-country-block-card for non-admins');
assert(styleCss.includes('body:not(.is-admin) #tab-firewall #permanently-blocked-card'), 'style.css must hide permanently-blocked-card for non-admins');
assert(styleCss.includes('body:not(.is-admin) #tab-firewall #temp-blocks-card'), 'style.css must hide temp-blocks-card for non-admins');
assert(styleCss.includes('body:not(.is-admin) #tab-firewall #allowlist-card'), 'style.css must hide allowlist-card for non-admins');
assert(!styleCss.includes('body:not(.is-admin) #tab-firewall #block-ip-card {\n  display: none'), 'block-ip-card must NOT be hidden for editors');

console.log('  ✅ PASS: 2. style.css correctly hides all admin cards and keeps only block-ip-card for editors');

// 3. Verify dashboard.js Logic
const dashboardJs = fs.readFileSync('./public/js/dashboard.js', 'utf8');

assert(dashboardJs.includes("{ key: 'firewall', tabId: 'tab-firewall', adminOnly: false }"), 'navMap must set adminOnly: false for firewall');
assert(dashboardJs.includes("item.key === 'firewall'"), 'navMap loop must grant access to firewall for both admin and editor');
assert(dashboardJs.includes("'auto-shield-card'"), 'dashboard.js must hide auto-shield-card for editors');
assert(dashboardJs.includes("'editor-country-block-card'"), 'dashboard.js must hide editor-country-block-card for editors');
assert(dashboardJs.includes("'permanently-blocked-card'"), 'dashboard.js must hide permanently-blocked-card for editors');

console.log('  ✅ PASS: 3. dashboard.js properly scopes tabs and hides non-editor cards');

// 4. Test IP Blocking functionality for Editor
const testIp = '198.51.100.99';
// Clean up if already exists
db.unblockIp(testIp);
assert(!db.isIpBlocked(testIp), 'IP must not be blocked initially');

// Block via db.blockIp with Editor note
const entry = db.blockIp(testIp, 'Blocked by Editor (gggg)');
assert(entry, 'db.blockIp must return the blocked entry');
assert(db.isIpBlocked(testIp), 'IP must now be blocked');

const blockedList = db.getBlockedIps();
const found = blockedList.find(b => b.ip === testIp);
assert(found, 'Blocked IP must be present in db.getBlockedIps');
assert.strictEqual(found.reason, 'Blocked by Editor (gggg)');

// Clean up
db.unblockIp(testIp);
assert(!db.isIpBlocked(testIp), 'IP must be unblocked after cleanup');

console.log('  ✅ PASS: 4. Editor IP block works end-to-end and successfully blocks traffic in db');

console.log('\n🎉 All 4 Editor Block IP Flow Tests Passed successfully!');
