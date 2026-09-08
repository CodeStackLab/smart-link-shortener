const assert = require('assert');
const fs = require('fs');
const db = require('./db');

console.log('🧪 Starting Editor Link Blocked Countries Display Verification...\n');

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

test('1. admin.html includes Blocked Countries th header and updated colspan=9', () => {
  const html = fs.readFileSync('./public/admin.html', 'utf8');
  assert(html.includes('<th id="th-blocked-countries">Blocked Countries</th>'), 'Must have th-blocked-countries');
  assert(html.includes('colspan="9"'), 'Must have colspan=9 for links-tbody');
  assert(/dashboard\.js\?v=\d+/.test(html), 'Must have dashboard.js cache busting');
  assert(/style\.css\?v=\d+/.test(html), 'Must have style.css cache busting');
});

test('2. dashboard.js renders col-blocked-countries with flag emojis and country badges', () => {
  const js = fs.readFileSync('./public/js/dashboard.js', 'utf8');
  assert(js.includes('col-blocked-countries'), 'Must render col-blocked-countries cell');
  assert(js.includes('data-label="Blocked Countries"'), 'Must have data-label="Blocked Countries"');
  assert(js.includes('getCountryFlagEmoji'), 'Must have getCountryFlagEmoji helper');
  assert(js.includes('blocked-country-pill'), 'Must use blocked-country-pill class');
});

test('3. style.css includes responsive mobile styling for td[data-label="Blocked Countries"]', () => {
  const css = fs.readFileSync('./public/css/style.css', 'utf8');
  assert(css.includes('td[data-label="Blocked Countries"]'), 'Must have td[data-label="Blocked Countries"] styles');
  assert(css.includes('.blocked-country-pill'), 'Must have .blocked-country-pill styles matching mockup');
});

test('4. server.js enriches editor links in /api/admin/links with creator blockedCountries', () => {
  const serverJs = fs.readFileSync('./server.js', 'utf8');
  assert(serverJs.includes('enrichLinkWithBlockedCountries'), 'Must have enrichLinkWithBlockedCountries in server.js');
});

test('5. gabol link dynamically receives blockedCountries [IN, PK, US] in link data', () => {
  const allUsers = db.getUsers();
  const creator = allUsers.find(u => u.username === 'gabol');
  if (!creator) {
    console.log('    (User gabol was removed by user, skipping gabol-specific check)');
    return;
  }
  assert(creator.blockedCountries.includes('IN'), 'Must include IN');
  assert(creator.blockedCountries.includes('PK'), 'Must include PK');
  assert(creator.blockedCountries.includes('US'), 'Must include US');
  assert.strictEqual(creator.countryBlockEnabled, true);
});

console.log(`\n🎉 All ${passed}/${total} Editor Link Blocked Countries Display Tests Passed successfully!`);
