const assert = require('assert');
const http = require('http');
const bcrypt = require('bcryptjs');
const db = require('./db');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch(e) { json = body; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Full Publytics & RBAC Verification Test Suite...\n');

  // 1. Default permissions check
  console.log('Test 1: Default permissions verification in db.js');
  assert(db.getDefaultPermissions('Super Admin').includes('publytics'), 'Super Admin must have publytics');
  assert(db.getDefaultPermissions('Master Admin').includes('publytics'), 'Master Admin must have publytics');
  assert(!db.getDefaultPermissions('Editor').includes('publytics'), 'Editor must not have publytics by default');
  console.log('  ✅ Default permissions verified.');

  // 2. Setup temporary test users
  const ts = Date.now();
  const superUser = db.addUser({
    username: 'SuperTester_' + ts,
    passwordHash: bcrypt.hashSync('TestSuperPass!1', 4),
    role: 'Super Admin',
    permissions: ['publytics', 'links', 'settings', 'analytics']
  });

  const editorNoPub = db.addUser({
    username: 'EditorNoPub_' + ts,
    passwordHash: bcrypt.hashSync('TestEditorPass!1', 4),
    role: 'Editor',
    permissions: ['links']
  });

  const editorWithPub = db.addUser({
    username: 'EditorWithPub_' + ts,
    passwordHash: bcrypt.hashSync('TestEditorPass!1', 4),
    role: 'Editor',
    permissions: ['links', 'publytics']
  });

  try {
    // 3. Test Unauthenticated Access
    console.log('Test 2: Unauthenticated Access Guard');
    const unauthRes = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/publytics/config',
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    assert(unauthRes.status === 401 || unauthRes.status === 302, `Should reject unauthenticated with 401/302, got ${unauthRes.status}`);
    console.log('  ✅ Unauthenticated access successfully blocked.');

    // 4. Test Super Admin Access
    console.log('Test 3: Super Admin Access');
    const superLogin = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: superUser.username, password: 'TestSuperPass!1' });

    const superCookie = superLogin.headers['set-cookie'] ? superLogin.headers['set-cookie'][0].split(';')[0] : '';
    assert(superCookie, 'Super Admin login must succeed');

    const superConfig = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/publytics/config',
      method: 'GET',
      headers: { 'Cookie': superCookie, 'Accept': 'application/json' }
    });
    assert.strictEqual(superConfig.status, 200, `Super Admin must access /api/publytics/config (got ${superConfig.status})`);
    console.log('  ✅ Super Admin accessed /api/publytics/config (200 OK).');

    const superSites = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/publytics/sites',
      method: 'GET',
      headers: { 'Cookie': superCookie, 'Accept': 'application/json' }
    });
    assert.strictEqual(superSites.status, 200, `Super Admin must access /api/publytics/sites (got ${superSites.status})`);
    console.log('  ✅ Super Admin accessed /api/publytics/sites (200 OK).');

    // 5. Test Editor WITHOUT publytics permission
    console.log('Test 4: Editor WITHOUT publytics permission (RBAC Block)');
    const editorNoPubLogin = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: editorNoPub.username, password: 'TestEditorPass!1' });

    const editorNoPubCookie = editorNoPubLogin.headers['set-cookie'] ? editorNoPubLogin.headers['set-cookie'][0].split(';')[0] : '';
    assert(editorNoPubCookie, 'Editor login must succeed');

    const editorDeniedConfig = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/publytics/config',
      method: 'GET',
      headers: { 'Cookie': editorNoPubCookie, 'Accept': 'application/json' }
    });
    assert.strictEqual(editorDeniedConfig.status, 403, `Editor without publytics must get 403 on /config (got ${editorDeniedConfig.status})`);

    const editorDeniedOverview = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/publytics/overview?siteId=test.com',
      method: 'GET',
      headers: { 'Cookie': editorNoPubCookie, 'Accept': 'application/json' }
    });
    assert.strictEqual(editorDeniedOverview.status, 403, `Editor without publytics must get 403 on /overview (got ${editorDeniedOverview.status})`);

    const editorDeniedDim = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/publytics/dimension/utm_source?siteId=test.com',
      method: 'GET',
      headers: { 'Cookie': editorNoPubCookie, 'Accept': 'application/json' }
    });
    assert.strictEqual(editorDeniedDim.status, 403, `Editor without publytics must get 403 on /dimension/utm_source (got ${editorDeniedDim.status})`);

    const editorDeniedUsers = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/publytics/users?siteId=test.com',
      method: 'GET',
      headers: { 'Cookie': editorNoPubCookie, 'Accept': 'application/json' }
    });
    assert.strictEqual(editorDeniedUsers.status, 403, `Editor without publytics must get 403 on /users (got ${editorDeniedUsers.status})`);
    console.log('  ✅ Editor without publytics permission strictly blocked with 403 Forbidden across all Publytics endpoints.');

    // 6. Test Editor WITH publytics permission
    console.log('Test 5: Editor WITH publytics permission granted by Super Admin');
    const editorWithPubLogin = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: editorWithPub.username, password: 'TestEditorPass!1' });

    const editorWithPubCookie = editorWithPubLogin.headers['set-cookie'] ? editorWithPubLogin.headers['set-cookie'][0].split(';')[0] : '';
    assert(editorWithPubCookie, 'Editor with publytics login must succeed');

    const editorAllowedConfig = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/publytics/config',
      method: 'GET',
      headers: { 'Cookie': editorWithPubCookie, 'Accept': 'application/json' }
    });
    assert.strictEqual(editorAllowedConfig.status, 200, `Editor with publytics must get 200 on /config (got ${editorAllowedConfig.status})`);

    // Editor cannot update token configuration
    const editorBlockedPost = await request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/publytics/config',
      method: 'POST',
      headers: { 'Cookie': editorWithPubCookie, 'Content-Type': 'application/json' }
    }, { apiToken: 'malicious_token' });
    assert.strictEqual(editorBlockedPost.status, 403, `Editor must get 403 when attempting to modify Publytics token (got ${editorBlockedPost.status})`);
    console.log('  ✅ Editor with publytics permission can view analytics (200 OK) but is strictly forbidden from changing API tokens (403 Forbidden).');

  } finally {
    // Clean up test users
    db.deleteUser(superUser.id);
    db.deleteUser(editorNoPub.id);
    db.deleteUser(editorWithPub.id);
    console.log('  ✅ Cleaned up temporary test users.');
  }

  console.log('\n=======================================================');
  console.log('🎉 ALL TESTS PASSED! PUBLYTICS RBAC & INTEGRATION 100% COMPLETE! 🎉');
  console.log('=======================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
