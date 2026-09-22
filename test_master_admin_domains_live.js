const assert = require('assert');
const http = require('http');

function post(path, body, cookie = '') {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Cookie': cookie
      }
    }, (res) => {
      let out = '';
      res.on('data', chunk => out += chunk);
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(out); } catch(e) { parsed = out; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, cookie = '') {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: path,
      method: 'GET',
      headers: { 'Cookie': cookie }
    }, (res) => {
      let out = '';
      res.on('data', chunk => out += chunk);
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(out); } catch(e) { parsed = out; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function del(path, cookie = '') {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: path,
      method: 'DELETE',
      headers: { 'Cookie': cookie }
    }, (res) => {
      let out = '';
      res.on('data', chunk => out += chunk);
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(out); } catch(e) { parsed = out; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie || !setCookie.length) return '';
  return setCookie[0].split(';')[0];
}

async function run() {
  console.log('🧪 Starting Live Server Master Admin Exclusivity Verification...\n');

  // ── TEST 1: Normal Admin (Okkooo) ──
  console.log('1. Testing Normal Admin (Okkooo)...');
  const okkoLogin = await post('/api/login', { username: 'Okkooo', password: 'Fast@123' });
  assert.strictEqual(okkoLogin.status, 200, 'Okkooo login failed');
  assert.strictEqual(okkoLogin.body.isSuperAdmin, false, 'Okkooo must have isSuperAdmin: false');
  const okkoCookie = extractCookie(okkoLogin.headers);

  // Normal Admin session check
  const okkoSession = await get('/api/session', okkoCookie);
  assert.strictEqual(okkoSession.status, 200);
  assert.strictEqual(okkoSession.body.isSuperAdmin, false, 'Okkooo /api/session must be isSuperAdmin: false');
  assert(!okkoSession.body.permissions.includes('domains'), 'Okkooo must NOT have domains permission');
  console.log('   ✅ PASS: Okkooo is acknowledged as isSuperAdmin: false without domains permission');

  // Normal Admin attempting to Add Domain
  const okkoAdd = await post('/api/admin/domains', { domain: 'hack.domain.com' }, okkoCookie);
  assert.strictEqual(okkoAdd.status, 403, 'Normal Admin must NOT be allowed to add domain (expected 403)');
  assert(JSON.stringify(okkoAdd.body).includes('Only Master Admin can manage domains'), 'Expected Master Admin error message');
  console.log('   ✅ PASS: POST /api/admin/domains rejected with 403 Forbidden for Normal Admin');

  // Normal Admin attempting to Delete Domain
  const okkoDel = await del('/api/admin/domains/some-id', okkoCookie);
  assert.strictEqual(okkoDel.status, 403, 'Normal Admin must NOT be allowed to delete domain (expected 403)');
  console.log('   ✅ PASS: DELETE /api/admin/domains/:id rejected with 403 Forbidden for Normal Admin');

  // Normal Admin attempting to view detected domains
  const okkoDet = await get('/api/admin/detected-domains', okkoCookie);
  assert.strictEqual(okkoDet.status, 403, 'Normal Admin must NOT view detected domains (expected 403)');
  console.log('   ✅ PASS: GET /api/admin/detected-domains rejected with 403 Forbidden for Normal Admin');

  // Normal Admin read access for dropdowns
  const okkoDomains = await get('/api/admin/domains', okkoCookie);
  assert.strictEqual(okkoDomains.status, 200, 'Normal Admin must be able to read domains for dropdown');
  assert(Array.isArray(okkoDomains.body), 'Normal Admin must receive array of active domains for selector');
  console.log(`   ✅ PASS: GET /api/admin/domains accessible for link creation dropdown (${okkoDomains.body.length} domains returned)`);

  // ── TEST 2: Editor (Khanliker) ──
  console.log('\n2. Testing Editor (Khanliker)...');
  const khanLogin = await post('/api/login', { username: 'Khanliker', password: 'Paki@752' });
  assert.strictEqual(khanLogin.status, 200, 'Khanliker login failed');
  assert.strictEqual(khanLogin.body.isSuperAdmin, false);
  const khanCookie = extractCookie(khanLogin.headers);

  const khanAdd = await post('/api/admin/domains', { domain: 'editor.domain.com' }, khanCookie);
  assert.strictEqual(khanAdd.status, 403, 'Editor must NOT be allowed to add domain');
  console.log('   ✅ PASS: POST /api/admin/domains rejected with 403 Forbidden for Editor');

  const khanDomains = await get('/api/admin/domains', khanCookie);
  assert.strictEqual(khanDomains.status, 200, 'Editor must be able to read domains for dropdown');
  console.log('   ✅ PASS: GET /api/admin/domains accessible for Editor link creation dropdown');

  // ── TEST 3: Master Admin (admin) ──
  console.log('\n3. Testing Master Admin (admin)...');
  const adminLogin = await post('/api/login', { username: 'admin', password: 'admin123456' });
  assert.strictEqual(adminLogin.status, 200, 'Master Admin login failed');
  assert.strictEqual(adminLogin.body.isSuperAdmin, true, 'Master Admin must have isSuperAdmin: true');
  const adminCookie = extractCookie(adminLogin.headers);

  const adminSession = await get('/api/session', adminCookie);
  assert.strictEqual(adminSession.status, 200);
  assert.strictEqual(adminSession.body.isSuperAdmin, true, 'Master Admin /api/session must be isSuperAdmin: true');
  assert(adminSession.body.permissions.includes('domains'), 'Master Admin must have domains permission');
  console.log('   ✅ PASS: Master Admin is acknowledged as isSuperAdmin: true with domains permission');

  // Master Admin adds a test domain
  const testDom = 'test-master-auth-verified-' + Date.now() + '.site';
  const adminAdd = await post('/api/admin/domains', { domain: testDom }, adminCookie);
  assert.strictEqual(adminAdd.status, 200, 'Master Admin must be able to add domain');
  assert(adminAdd.body.success, 'Add domain must succeed for Master Admin');
  const createdDomainId = adminAdd.body.domain.id;
  console.log(`   ✅ PASS: POST /api/admin/domains succeeded for Master Admin (id: ${createdDomainId}, domain: ${testDom})`);

  // Verify domain exists in domain list
  const adminList = await get('/api/admin/domains', adminCookie);
  const found = adminList.body.find(d => d.domain === testDom);
  assert(found, 'Created test domain must exist in domains list');
  console.log('   ✅ PASS: New domain verified in custom domains database');

  // Master Admin deletes the test domain cleanly
  const adminDel = await del(`/api/admin/domains/${createdDomainId}`, adminCookie);
  assert.strictEqual(adminDel.status, 200, 'Master Admin must be able to delete domain');
  assert(adminDel.body.success, 'Delete domain must succeed for Master Admin');
  console.log('   ✅ PASS: DELETE /api/admin/domains/:id cleanly deleted test domain for Master Admin');

  // Verify domain is gone
  const afterList = await get('/api/admin/domains', adminCookie);
  const stillFound = afterList.body.find(d => d.domain === testDom);
  assert(!stillFound, 'Deleted test domain must no longer exist');
  console.log('   ✅ PASS: Cleaned up test domain successfully');

  console.log('\n🎉 ALL LIVE SERVER MASTER ADMIN DOMAIN PERMISSION TESTS PASSED 100%! 🎉\n');
}

run().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
