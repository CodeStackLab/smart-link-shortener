const assert = require('assert');
const fs = require('fs');
const db = require('./db');

console.log('🧪 Starting Problem 5: Logs & Facebook Analytics Gating Verification...\n');

// 1. Verify CSS Rules
const styleCss = fs.readFileSync('./public/css/style.css', 'utf8');
assert(styleCss.includes('body:not(.is-admin) .tab-btn[data-tab="tab-analytics"]'), 'style.css must hide tab-btn tab-analytics for non-admins');
assert(styleCss.includes('body:not(.is-admin) .mobile-nav-item[data-tab="tab-analytics"]'), 'style.css must hide mobile-nav-item tab-analytics for non-admins');
assert(styleCss.includes('body:not(.is-admin) #tab-analytics'), 'style.css must hide #tab-analytics for non-admins');
assert(styleCss.includes('body:not(.is-admin) .top-stats-stack'), 'style.css must hide .top-stats-stack for non-admins');
assert(styleCss.includes('body:not(.is-admin) #fb-breakdown-card'), 'style.css must hide #fb-breakdown-card for non-admins');
console.log('  ✅ PASS: 1. style.css strictly hides tab-analytics, top-stats-stack, and fb-breakdown-card from non-admins');

// 2. Verify dashboard.js scoping
const dashboardJs = fs.readFileSync('./public/js/dashboard.js', 'utf8');
assert(dashboardJs.includes("{ key: 'analytics', tabId: 'tab-analytics', adminOnly: true }"), 'dashboard.js navMap must have adminOnly: true for analytics');
assert(dashboardJs.includes("if (targetTab === 'tab-analytics' && !isFullAdminUser())"), 'dashboard.js tabBtns click must prevent non-admins from opening tab-analytics');
assert(dashboardJs.includes("const fbBreakdown = document.getElementById('fb-breakdown-card');"), 'dashboard.js must defensively manage fb-breakdown-card in applyRoleUiScoping');
console.log('  ✅ PASS: 2. dashboard.js properly configures adminOnly: true and enforces role scoping for analytics');

// 3. Verify db.js defaults and filtering
const adminDefaults = db.getDefaultPermissions('Admin');
const editorDefaults = db.getDefaultPermissions('Editor');
assert(adminDefaults.includes('analytics'), 'Admin must have analytics permission');
assert(!editorDefaults.includes('analytics'), 'Editor must NOT have analytics permission');

const publicUsers = db.getUsersPublic();
publicUsers.forEach(u => {
  if (u.role === 'Editor') {
    assert(!u.permissions.includes('analytics'), `Editor ${u.username} must not have analytics permission in public view`);
  }
});
console.log('  ✅ PASS: 3. db.js guarantees Editor never receives analytics permission');

console.log('\n🎉 All Problem 5 Verification Tests Passed successfully!');
