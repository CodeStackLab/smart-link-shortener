const assert = require('assert');
const db = require('./db');

console.log('🧪 Starting Editor Firewall Gating & Global Backend Enforcement Tests...\n');

// 1. Check data/users.json — No editor has 'firewall' permission
let users = db.getUsers();
let editors = users.filter(u => u.role === 'Editor');
let createdTempEditor = null;
if (editors.length === 0) {
  createdTempEditor = db.addUser({ username: 'temp_firewall_editor', role: 'Editor', rawPassword: 'tempPass123' });
  users = db.getUsers();
  editors = users.filter(u => u.role === 'Editor');
}
assert(editors.length > 0, 'Must have at least one editor');

editors.forEach(ed => {
  const perms = Array.isArray(ed.permissions) ? ed.permissions : [];
  assert(!perms.includes('firewall'), `Editor ${ed.username} must NOT have firewall permission`);
});
console.log('  ✅ PASS: 1. No Editor in data/users.json has firewall permission');

// 2. Check db.getDefaultPermissions
const adminDefaults = db.getDefaultPermissions('Admin');
const editorDefaults = db.getDefaultPermissions('Editor');
assert(adminDefaults.includes('firewall'), 'Admin default permissions must include firewall');
assert(!editorDefaults.includes('firewall'), 'Editor default permissions must NOT include firewall');
console.log('  ✅ PASS: 2. Default permissions: Admin has firewall, Editor does NOT');

// 3. Check db.getUsersPublic() strips firewall for editors even if present
const publicUsers = db.getUsersPublic();
publicUsers.forEach(u => {
  if (u.role === 'Editor') {
    assert(!u.permissions.includes('firewall'), `Public user ${u.username} must not have firewall in permissions`);
  }
  if (u.role === 'Admin') {
    assert(u.permissions.includes('firewall'), `Public user ${u.username} (Admin) must have firewall`);
  }
});
console.log('  ✅ PASS: 3. db.getUsersPublic() ensures firewall is never exposed to Editor role');

// 4. Check db.addUser strips firewall for Editor
const testEd = {
  id: 'usr_test_firewall_' + Date.now(),
  username: 'test_ed_fw',
  passwordHash: 'hash',
  rawPassword: 'pass',
  role: 'Editor',
  permissions: ['links', 'firewall', 'geo']
};
db.addUser(testEd);
const savedEd = db.getUserByUsername('test_ed_fw');
assert(savedEd, 'User must be saved');
assert(!savedEd.permissions.includes('firewall'), 'db.addUser must filter out firewall permission for Editor');
db.deleteUser(testEd.id);
console.log('  ✅ PASS: 4. db.addUser automatically filters out firewall permission for Editor');

// 5. Check db.updateUserRole strips firewall for Editor
const testEd2 = {
  id: 'usr_test_firewall_2_' + Date.now(),
  username: 'test_ed_fw2',
  passwordHash: 'hash',
  rawPassword: 'pass',
  role: 'Editor',
  permissions: ['links', 'geo']
};
db.addUser(testEd2);
db.updateUserRole(testEd2.id, 'Editor', ['links', 'firewall', 'analytics']);
const updatedEd2 = db.getUserByUsername('test_ed_fw2');
assert(!updatedEd2.permissions.includes('firewall'), 'db.updateUserRole must filter out firewall for Editor');
db.deleteUser(testEd2.id);
console.log('  ✅ PASS: 5. db.updateUserRole automatically filters out firewall permission for Editor');

// 6. Check Super Admin panel retention
const adminUser = users.find(u => u.username === 'admin');
assert(adminUser, 'Admin user must exist');
assert(adminUser.permissions.includes('firewall'), 'Super Admin MUST retain firewall permission');
console.log('  ✅ PASS: 6. Super Admin panel retains full firewall permission');

// 7. Check backend settings enforcement
const settings = db.getSettings();
assert(settings.applyFirewallGlobally !== false, 'applyFirewallGlobally must be active by default');
console.log('  ✅ PASS: 7. Firewall applies globally to all editors in backend by default');

if (createdTempEditor && createdTempEditor.id) {
  db.deleteUser(createdTempEditor.id);
}

console.log('\n🎉 All 7 Editor Firewall Gating Tests Passed successfully!');
