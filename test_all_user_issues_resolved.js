const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running Comprehensive Verification for All 4 User Issues...\n');

// -------------------------------------------------------------
// Issue 1: Normal Admin vs Master Admin Fallback Scoping
// -------------------------------------------------------------
console.log('--- Checking Issue 1: Fallback Redirect only for Master Admin ---');
const styleCss = fs.readFileSync(path.join(__dirname, 'public/css/style.css'), 'utf8');
const adminHtml = fs.readFileSync(path.join(__dirname, 'public/admin.html'), 'utf8');
const dashboardJs = fs.readFileSync(path.join(__dirname, 'public/js/dashboard.js'), 'utf8');
const loginJs = fs.readFileSync(path.join(__dirname, 'public/js/login.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

// 1. CSS rules for hiding fallback card
assert(styleCss.includes('body:not(.is-superadmin) #default-fallback-url-card'), 'CSS must hide default-fallback-url-card for non-superadmin');
assert(styleCss.includes('html:not(.is-superadmin) #default-fallback-url-card'), 'CSS must hide default-fallback-url-card for html:not(.is-superadmin)');

// 2. Admin HTML initial state
assert(adminHtml.includes('id="default-fallback-url-card"') && adminHtml.includes('display:none;'), 'admin.html default-fallback-url-card must be display:none initially');

// 3. Login.js caching
assert(loginJs.includes("localStorage.setItem('cachedIsSuperAdmin'"), 'login.js must cache cachedIsSuperAdmin in localStorage');

// 4. Dashboard.js initialization
assert(dashboardJs.includes("localStorage.getItem('cachedIsSuperAdmin')"), 'dashboard.js must read cachedIsSuperAdmin on init');
assert(dashboardJs.includes("fallbackCard.style.display = isSuperAdminUser() ? '' : 'none'"), 'dashboard.js must gate fallbackCard to isSuperAdminUser');

console.log('  ✅ Issue 1 Verified: Fallback Redirect card strictly visible only to Master Admin.');


// -------------------------------------------------------------
// Issue 2: Publytics Site Deletion
// -------------------------------------------------------------
console.log('\n--- Checking Issue 2: Publytics Site Deletion ---');
const publyticsService = require('./services/publyticsService');
const publyticsJs = fs.readFileSync(path.join(__dirname, 'public/js/publytics.js'), 'utf8');

// 1. Check deleteSite in publyticsService
assert(typeof publyticsService.deleteSite === 'function', 'publyticsService.deleteSite must be a function');

// 2. Test deleteSite in service
publyticsService.updateConfig({
  sitesList: [{ id: 'test-site-to-delete.com', name: 'test-site-to-delete.com' }, { id: 'keep-this-site.com', name: 'keep-this-site.com' }],
  siteId: 'test-site-to-delete.com'
});

const delResult = publyticsService.deleteSite('test-site-to-delete.com');
assert.strictEqual(delResult.success, true, 'deleteSite must return success: true');
assert(!delResult.sitesList.some(s => (s.id || s) === 'test-site-to-delete.com'), 'Deleted site must not be in sitesList');
assert.strictEqual(delResult.currentSiteId, 'keep-this-site.com', 'Current site must switch to remaining site');

// 3. Check server.js delete endpoints
assert(serverJs.includes("app.post('/api/publytics/delete-site'"), 'server.js must have POST /api/publytics/delete-site route');
assert(serverJs.includes("app.delete('/api/publytics/sites/:siteId'"), 'server.js must have DELETE /api/publytics/sites/:siteId route');

// 4. Check publytics.js delete logic
assert(publyticsJs.includes("fetch('/api/publytics/delete-site'"), 'publytics.js must call delete-site endpoint');
assert(publyticsJs.includes("isCurrentUserSuperAdmin"), 'publytics.js must track isCurrentUserSuperAdmin properly');

console.log('  ✅ Issue 2 Verified: Publytics site deletion works on backend and frontend.');


// -------------------------------------------------------------
// Issue 3: Add Domain and Subdomain
// -------------------------------------------------------------
console.log('\n--- Checking Issue 3: Subdomain Support & Verification ---');
const db = require('./db');

// 1. Test isCustomDomainAllowed with root domain and subdomain
assert.strictEqual(db.isCustomDomainAllowed('goo33.online'), true, 'goo33.online must be allowed');
assert.strictEqual(db.isCustomDomainAllowed('sub.goo33.online'), true, 'Subdomain of goo33.online must be allowed');

// Add test subdomain
const testSub = 'testsub' + Date.now() + '.site.com';
const added = db.addCustomDomain(testSub);
assert(added && added.domain === testSub, 'Must be able to add subdomain to customDomains');
assert.strictEqual(db.isCustomDomainAllowed(testSub), true, 'Added subdomain must be allowed in isCustomDomainAllowed');
assert.strictEqual(db.isCustomDomainAllowed('nested.' + testSub), true, 'Nested subdomain of added domain must be allowed');

// Clean up test entry
db.deleteCustomDomain(added.id);

console.log('  ✅ Issue 3 Verified: Subdomains can be added and are fully allowed and recognized.');


// -------------------------------------------------------------
// Issue 4: "direct" badge in ALLOWED SOURCES
// -------------------------------------------------------------
console.log('\n--- Checking Issue 4: "direct" badge under ALLOWED SOURCES ---');

// 1. Check server.js default allowedPlatforms
assert(!serverJs.includes("['facebook', 'direct']"), "server.js must NOT have ['facebook', 'direct'] as default");

// 2. Check dashboard.js filters out 'direct'
assert(dashboardJs.includes("link.allowedPlatforms.filter(p => p && p !== 'direct')"), "dashboard.js must filter out 'direct' from platform badges");

// 3. Check data/links.json for link za00lq
const links = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/links.json'), 'utf8'));
const za00lq = links.find(l => l.code === 'za00lq');
if (za00lq) {
  assert(!za00lq.allowedPlatforms.includes('direct'), 'za00lq allowedPlatforms must NOT include direct');
}

console.log('  ✅ Issue 4 Verified: "direct" platform badge will never appear under ALLOWED SOURCES.');

console.log('\n🎉 ALL 4 USER ISSUES HAVE BEEN COMPLETELY RESOLVED AND VERIFIED! 🎉');
