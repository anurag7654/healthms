const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/users – admin gets all, doctor gets patients
router.get('/', auth, (req, res) => {
  let users = db.get('users').value();
  const { role, search, status } = req.query;

  if (req.user.role === 'doctor') {
    // Doctors can only see patients assigned to them
    const appts = db.get('appointments').filter({ doctorId: req.user.id }).value();
    const patientIds = [...new Set(appts.map(a => a.patientId))];
    users = users.filter(u => u.role === 'patient' && patientIds.includes(u.id));
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (role && role !== 'all') users = users.filter(u => u.role === role);
  if (status) users = users.filter(u => u.status === status);
  if (search) {
    const q = search.toLowerCase();
    users = users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }

  res.json(users.map(({ password, ...u }) => u));
});

// GET /api/users/:id
router.get('/:id', auth, (req, res) => {
  const user = db.get('users').find({ id: req.params.id }).value();
  if (!user) return res.status(404).json({ error: 'User not found' });
  // Patients can only view their own profile
  if (req.user.role === 'patient' && req.user.id !== req.params.id)
    return res.status(403).json({ error: 'Access denied' });
  const { password, ...safe } = user;
  res.json(safe);
});

// POST /api/users – admin creates user
router.post('/', auth, requireRole('admin'), (req, res) => {
  const { username, password, name, email, phone, role, specialization, qualification, experience, age, gender, bloodGroup } = req.body;
  if (!username || !password || !name || !role)
    return res.status(400).json({ error: 'Username, password, name and role are required' });

  if (db.get('users').find({ username }).value())
    return res.status(409).json({ error: 'Username already taken' });

  const newUser = {
    id: uuidv4(), username, password: bcrypt.hashSync(password, 10),
    role, name, email: email || '', phone: phone || '',
    specialization: specialization || '', qualification: qualification || '',
    experience: experience || '', age: age || null, gender: gender || '',
    bloodGroup: bloodGroup || '', address: '', emergencyContact: '',
    avatar: null, status: 'active',
    createdAt: new Date().toISOString().split('T')[0]
  };

  db.get('users').push(newUser).write();
  const { password: _, ...safe } = newUser;
  res.status(201).json(safe);
});

// PATCH /api/users/:id
router.patch('/:id', auth, requireRole('admin'), (req, res) => {
  const user = db.get('users').find({ id: req.params.id }).value();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const allowed = ['name','email','phone','status','specialization','qualification','experience','age','gender','bloodGroup','address'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  if (req.body.password) updates.password = bcrypt.hashSync(req.body.password, 10);

  db.get('users').find({ id: req.params.id }).assign(updates).write();
  const updated = db.get('users').find({ id: req.params.id }).value();
  const { password: _, ...safe } = updated;
  res.json(safe);
});

// DELETE /api/users/:id
router.delete('/:id', auth, requireRole('admin'), (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: 'Cannot delete your own account' });

  const user = db.get('users').find({ id: req.params.id }).value();
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.get('users').remove({ id: req.params.id }).write();
  res.json({ message: 'User deleted successfully' });
});

// GET /api/users/:id/health-summary – for doctor to view patient data
router.get('/:id/health-summary', auth, (req, res) => {
  const records = db.get('healthRecords').filter({ patientId: req.params.id }).sortBy('date').value();
  const prescriptions = db.get('prescriptions').filter({ patientId: req.params.id }).value();
  const appointments = db.get('appointments').filter({ patientId: req.params.id }).value();
  const medicines = db.get('medicines').filter({ patientId: req.params.id }).value();
  res.json({ records, prescriptions, appointments, medicines });
});

module.exports = router;
