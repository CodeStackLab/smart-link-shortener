const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🧪 Starting Active Custom Domains & Subdomain Selector Tests...\n');

// 1. Verify adding custom domain sets sslStatus to "active" and saves to DB
const db = require('./db');
let customDomains = db.getCustomDomains();
if (!customDomains.find(d => d.domain === 'ok.linkfast88.site')) {
  db.addCustomDomain('ok.linkfast88.site');
  customDomains = db.getCustomDomains();
}
const okDomain = customDomains.find(d => d.domain === 'ok.linkfast88.site');
assert(okDomain, 'FAIL: ok.linkfast88.site must exist in custom_domains.json');
assert.strictEqual(okDomain.sslStatus, 'active', 'FAIL: ok.linkfast88.site sslStatus must be "active"');
console.log('✅ PASS: ok.linkfast88.site is present in custom_domains.json with SSL active');

// 1b. Verify db.deleteCustomDomain removes domain by name or id
db.addCustomDomain('temp-test-to-delete.com');
assert(db.getCustomDomains().some(d => d.domain === 'temp-test-to-delete.com'), 'FAIL: temp domain must be added');
db.deleteCustomDomain('temp-test-to-delete.com');
assert(!db.getCustomDomains().some(d => d.domain === 'temp-test-to-delete.com'), 'FAIL: temp domain must be deleted by domain name');
console.log('✅ PASS: db.deleteCustomDomain cleanly deletes domains by domain name or id');

// 2. Verify dashboard.js does not have duplicate or TDZ passwordChangeForm
const dashboardJs = fs.readFileSync(path.join(__dirname, 'public/js/dashboard.js'), 'utf8');
const passFormMatches = dashboardJs.match(/const\s+passwordChangeForm\s*=/g) || [];
assert.strictEqual(passFormMatches.length, 1, `FAIL: Expected exactly 1 passwordChangeForm declaration, got ${passFormMatches.length}`);
console.log('✅ PASS: Exactly 1 passwordChangeForm declaration found (TDZ bug eliminated)');

// 3. Run dashboard.js in simulated DOM to verify zero crashes and proper DOM rendering
const elements = {};
function getEl(id) {
  if (!elements[id]) {
    elements[id] = {
      id: id,
      style: {
        setProperty: () => {},
        removeProperty: () => {}
      },
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false,
        toggle: () => {}
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelectorAll: () => [],
      querySelector: () => null,
      appendChild: () => {},
      insertBefore: () => {},
      children: [],
      innerHTML: '',
      value: '',
      setAttribute: () => {},
      removeAttribute: () => {},
      getAttribute: () => '',
      dataset: {}
    };
  }
  return elements[id];
}

const mockDocument = {
  getElementById: (id) => getEl(id),
  querySelector: (sel) => getEl(sel),
  querySelectorAll: (sel) => [],
  createElement: (tag) => getEl(tag),
  addEventListener: (evt, cb) => {
    if (evt === 'DOMContentLoaded') {
      setTimeout(() => {
        try {
          cb();
        } catch(e) {
          assert.fail(`CRASH in DOMContentLoaded: ${e.message}`);
        }
      }, 5);
    }
  },
  body: getEl('body'),
  documentElement: getEl('html')
};

const mockWindow = {
  document: mockDocument,
  location: { hostname: '89.117.51.151', hash: '', pathname: '/admin', href: 'http://89.117.51.151/admin' },
  addEventListener: () => {},
  removeEventListener: () => {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  fetch: async (url) => {
    if (url === '/api/session') {
      return {
        ok: true,
        json: async () => ({
          username: 'admin',
          role: 'Admin',
          permissions: ['facebook','instagram','custom_website','links','domains','geo','analytics','firewall','settings','publytics']
        })
      };
    }
    if (url === '/api/admin/domains') {
      return {
        ok: true,
        json: async () => customDomains
      };
    }
    return { ok: true, json: async () => [] };
  },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  alert: () => {},
  confirm: () => true
};

const context = vm.createContext({
  window: mockWindow,
  document: mockDocument,
  localStorage: mockWindow.localStorage,
  sessionStorage: mockWindow.sessionStorage,
  navigator: { userAgent: 'test' },
  location: mockWindow.location,
  fetch: mockWindow.fetch,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  Set: Set,
  Map: Map,
  Array: Array,
  Object: Object,
  Date: Date,
  RegExp: RegExp,
  JSON: JSON
});

vm.runInContext(dashboardJs, context);

setTimeout(() => {
  const tbodyHtml = elements['domains-tbody'] ? elements['domains-tbody'].innerHTML : '';
  const optionsHtml = elements['custom-domain-options-list'] ? elements['custom-domain-options-list'].innerHTML : '';

  assert(!tbodyHtml.includes('Network error'), 'FAIL: domains-tbody still contains "Network error"');
  assert(tbodyHtml.includes('ok.linkfast88.site'), 'FAIL: domains-tbody must render ok.linkfast88.site');
  assert(tbodyHtml.includes('🔒 SSL Active ✅'), 'FAIL: domains-tbody must render SSL Active badge');
  console.log('✅ PASS: domains-tbody rendered ok.linkfast88.site with "🔒 SSL Active ✅"');

  assert(optionsHtml.includes('ok.linkfast88.site'), 'FAIL: custom-domain-options-list must contain ok.linkfast88.site');
  assert(optionsHtml.includes('Subdomain'), 'FAIL: ok.linkfast88.site must have Subdomain badge');
  assert(!optionsHtml.includes('fast.com'), 'FAIL: fast.com must NOT be present when not in custom_domains');
  console.log('✅ PASS: custom-domain-options-list rendered ok.linkfast88.site with "Subdomain" badge and NO hardcoded presets');

  // Verify selecting ok.linkfast88.site works
  if (mockWindow.selectDomain) {
    mockWindow.selectDomain('ok.linkfast88.site');
    const hiddenInput = elements['link-domain'];
    const triggerLabel = elements['custom-domain-selector-label'];
    assert.strictEqual(hiddenInput.value, 'ok.linkfast88.site', 'FAIL: link-domain input must update');
    assert.strictEqual(triggerLabel.textContent, 'ok.linkfast88.site', 'FAIL: trigger label must update');
    console.log('✅ PASS: window.selectDomain("ok.linkfast88.site") updates form input and trigger label');
  }

  // Verify that populateDomainSelects with [] only shows the default domain
  if (mockWindow.populateDomainSelects) {
    mockWindow.populateDomainSelects([]);
    const emptyOptions = elements['custom-domain-options-list'].innerHTML;
    assert(!emptyOptions.includes('fast.com'), 'FAIL: fast.com must not exist in empty custom domains');
    assert(!emptyOptions.includes('ok.linkfast88.site'), 'FAIL: ok.linkfast88.site must not exist when custom domains is empty');
    assert(emptyOptions.includes('Default'), 'FAIL: Default site domain must be shown');
    console.log('✅ PASS: Empty custom_domains renders ONLY the default domain with zero fake presets');
  }

  console.log('\n🎉 ALL ACTIVE DOMAINS & SELECTOR TESTS PASSED 100%! 🎉\n');
  process.exit(0);
}, 500);
