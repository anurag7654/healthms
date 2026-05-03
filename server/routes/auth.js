const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { auth, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role)
    return res.status(400).json({ error: 'Username, password and role are required' });

  const user = db.get('users').find({ username: username.trim(), role }).value();
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid credentials' });

  if (user.status !== 'active')
    return res.status(403).json({ error: 'Account suspended. Contact administrator.' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  const { password: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

// POST /api/auth/register (patient self-registration)
router.post('/register', (req, res) => {
  const { username, password, name, email, phone, age, gender, bloodGroup } = req.body;
  if (!username || !password || !name || !email)
    return res.status(400).json({ error: 'Required fields missing' });

  const exists = db.get('users').find({ username }).value();
  if (exists) return res.status(409).json({ error: 'Username already taken' });

  const emailExists = db.get('users').find({ email }).value();
  if (emailExists) return res.status(409).json({ error: 'Email already registered' });

  const newUser = {
    id: uuidv4(), username, password: bcrypt.hashSync(password, 10),
    role: 'patient', name, email, phone: phone || '', age: age || null,
    gender: gender || '', bloodGroup: bloodGroup || '', address: '',
    emergencyContact: '', avatar: null, status: 'active',
    createdAt: new Date().toISOString().split('T')[0]
  };

  db.get('users').push(newUser).write();

  const token = jwt.sign({ id: newUser.id, username: newUser.username, role: newUser.role, name: newUser.name }, JWT_SECRET, { expiresIn: '24h' });
  const { password: _, ...safeUser } = newUser;
  res.status(201).json({ token, user: safeUser });
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password: _, ...safe } = user;
  res.json(safe);
});

// PATCH /api/auth/me - update own profile
router.patch('/me', auth, (req, res) => {
  const allowed = ['name','email','phone','age','gender','bloodGroup','address','emergencyContact'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  db.get('users').find({ id: req.user.id }).assign(updates).write();
  const user = db.get('users').find({ id: req.user.id }).value();
  const { password: _, ...safe } = user;
  res.json(safe);
});

// PATCH /api/auth/password
router.patch('/password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.get('users').find({ id: req.user.id }).value();
  if (!bcrypt.compareSync(currentPassword, user.password))
    return res.status(400).json({ error: 'Current password is incorrect' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  db.get('users').find({ id: req.user.id }).assign({ password: bcrypt.hashSync(newPassword, 10) }).write();
  res.json({ message: 'Password updated successfully' });
});

module.exports = router;
