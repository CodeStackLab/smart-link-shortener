const assert = require('assert');
const fs = require('fs');
const db = require('./db');

console.log('🧪 Starting Facebook Traffic & AdX Rules Editor-Hiding Verification...\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

test('1. style.css strictly hides .btn-traffic-rules and #traffic-rules-modal for non-admins and editors', () => {
  const css = fs.readFileSync('./public/css/style.css', 'utf8');
  assert(css.includes('body:not(.is-admin) .btn-traffic-rules'), 'Must hide .btn-traffic-rules for non-admin');
  assert(css.includes('body:not(.is-admin) #traffic-rules-modal'), 'Must hide #traffic-rules-modal for non-admin');
  assert(css.includes('body.is-editor .btn-traffic-rules'), 'Must hide .btn-traffic-rules for is-editor');
  assert(css.includes('body.is-editor #traffic-rules-modal'), 'Must hide #traffic-rules-modal for is-editor');
});

test('2. dashboard.js renders btn-traffic-rules ONLY for full admin users', () => {
  const js = fs.readFileSync('./public/js/dashboard.js', 'utf8');
  assert(js.includes('const trafficRulesBtn = isFullAdminUser()'), 'Must check isFullAdminUser before rendering rules button');
  assert(js.includes('btn-traffic-rules'), 'Must include btn-traffic-rules class on button');
});

test('3. dashboard.js guards showTrafficRulesModal and saveTrafficRulesModal for Admin only', () => {
  const js = fs.readFileSync('./public/js/dashboard.js', 'utf8');
  const showModalIdx = js.indexOf('window.showTrafficRulesModal = function');
  assert(showModalIdx !== -1, 'showTrafficRulesModal must exist');
  const showModalChunk = js.slice(showModalIdx, showModalIdx + 250);
  assert(showModalChunk.includes('if (!isFullAdminUser())'), 'showTrafficRulesModal must check isFullAdminUser');

  const saveModalIdx = js.indexOf('window.saveTrafficRulesModal = async function');
  assert(saveModalIdx !== -1, 'saveTrafficRulesModal must exist');
  const saveModalChunk = js.slice(saveModalIdx, saveModalIdx + 250);
  assert(saveModalChunk.includes('if (!isFullAdminUser())'), 'saveTrafficRulesModal must check isFullAdminUser');
});

test('4. server.js restricts traffic rules modifications to Admin only', () => {
  const serverJs = fs.readFileSync('./server.js', 'utf8');
  assert(serverJs.includes('const canEditRules = isAdminRole(req.session.role);'), 'canEditRules must require isAdminRole');
});

test('5. Admin rule configuration saves properly and applies in backend', () => {
  const testCode = 'admx_' + Date.now().toString(36);
  const createdLink = db.addLink({
    code: testCode,
    targetUrl: 'https://example.com/target',
    fallbackUrl: 'https://example.com/fallback',
    createdBy: 'test_editor_x',
    fbTrafficEnabled: false,
    allowFbProfiles: false
  });

  assert.strictEqual(createdLink.fbTrafficEnabled, false);

  // Update via db (as Admin would do)
  const updatedLink = db.updateLink(createdLink.id, {
    fbTrafficEnabled: true,
    allowFbProfiles: true,
    allowFbGroups: false
  });

  assert.strictEqual(updatedLink.fbTrafficEnabled, true);
  assert.strictEqual(updatedLink.allowFbProfiles, true);
  assert.strictEqual(updatedLink.allowFbGroups, false);

  // Clean up
  db.deleteLink(createdLink.id);
});

console.log(`\n🎉 All ${passed}/${total} Facebook Traffic & AdX Rules Editor-Hiding Tests Passed successfully!`);
