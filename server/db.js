/**
 * db.js — JSON file persistence using lowdb
 * Only seeds a default admin if the database is completely empty.
 * All other data is created by real user actions.
 */

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const adapter = new FileSync(path.join(__dirname, '../data/db.json'));
const db = low(adapter);

// Ensure all collections exist as empty arrays (only if not already set)
db.defaults({
  users:         [],
  appointments:  [],
  healthRecords: [],
  prescriptions: [],
  medicines:     [],
  notifications: [],
}).write();

// Only create a default admin if NO users exist at all
const userCount = db.get('users').value().length;

if (userCount === 0) {
  console.log('📦 Fresh database detected — creating default admin account...');

  db.get('users').push({
    id:        uuidv4(),
    username:  'admin',
    password:  bcrypt.hashSync('admin123', 10),
    role:      'admin',
    name:      'System Administrator',
    email:     'admin@healthms.com',
    phone:     '',
    avatar:    null,
    status:    'active',
    createdAt: new Date().toISOString().split('T')[0],
  }).write();

  console.log('✅ Admin ready  →  username: admin  |  password: admin123');
  console.log('⚠️  Please change the admin password after first login.\n');
}

module.exports = db;