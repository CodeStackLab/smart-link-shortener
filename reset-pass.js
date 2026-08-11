const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const usersFile = path.join(__dirname, 'data', 'users.json');
let users = [];

try {
  users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
} catch (e) {
  console.error('Error reading users.json:', e);
}

const salt = bcrypt.genSaltSync(10);
const newPassword = 'admin123456';
const newHash = bcrypt.hashSync(newPassword, salt);

let adminUser = users.find(u => u.username === 'admin');
if (adminUser) {
  adminUser.passwordHash = newHash;
} else {
  users.push({
    id: 'usr_admin_1',
    username: 'admin',
    passwordHash: newHash,
    role: 'Admin',
    createdAt: new Date().toISOString()
  });
}

fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
console.log('✅ Admin password successfully reset!');
console.log('Username: admin');
console.log('New Password:', newPassword);
