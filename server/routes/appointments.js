const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/appointments
router.get('/', auth, (req, res) => {
  let appts = db.get('appointments').value();
  const { status, date, patientId, doctorId, search } = req.query;

  // Scope by role
  if (req.user.role === 'patient') appts = appts.filter(a => a.patientId === req.user.id);
  else if (req.user.role === 'doctor') appts = appts.filter(a => a.doctorId === req.user.id);

  if (status && status !== 'all') appts = appts.filter(a => a.status === status);
  if (date) appts = appts.filter(a => a.date === date);
  if (patientId) appts = appts.filter(a => a.patientId === patientId);
  if (doctorId) appts = appts.filter(a => a.doctorId === doctorId);
  if (search) {
    const q = search.toLowerCase();
    appts = appts.filter(a =>
      a.patientName.toLowerCase().includes(q) ||
      a.doctorName.toLowerCase().includes(q) ||
      a.reason.toLowerCase().includes(q)
    );
  }

  appts = appts.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(appts);
});

// POST /api/appointments
router.post('/', auth, (req, res) => {
  const { doctorId, date, time, reason, duration, priority } = req.body;
  if (!doctorId || !date || !time || !reason)
    return res.status(400).json({ error: 'doctorId, date, time, reason required' });

  const doctor = db.get('users').find({ id: doctorId, role: 'doctor' }).value();
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  // Conflict check
  const conflict = db.get('appointments').find({ doctorId, date, time, status: 'confirmed' }).value();
  if (conflict) return res.status(409).json({ error: 'Doctor has another confirmed appointment at this time' });

  let patientId = req.user.id;
  let patientName = req.user.name;

  // Admin can create for anyone
  if (req.user.role === 'admin' && req.body.patientId) {
    const patient = db.get('users').find({ id: req.body.patientId }).value();
    if (patient) { patientId = patient.id; patientName = patient.name; }
  }

  const appt = {
    id: uuidv4(), patientId, patientName, doctorId,
    doctorName: doctor.name, specialization: doctor.specialization || '',
    date, time, duration: duration || 30, reason,
    status: 'pending', priority: priority || 'normal', notes: '',
    createdAt: new Date().toISOString().split('T')[0]
  };

  db.get('appointments').push(appt).write();
  res.status(201).json(appt);
});

// PATCH /api/appointments/:id
router.patch('/:id', auth, (req, res) => {
  const appt = db.get('appointments').find({ id: req.params.id }).value();
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });

  // Permissions
  const isPatient = req.user.role === 'patient' && appt.patientId === req.user.id;
  const isDoctor = req.user.role === 'doctor' && appt.doctorId === req.user.id;
  const isAdmin = req.user.role === 'admin';

  if (!isPatient && !isDoctor && !isAdmin)
    return res.status(403).json({ error: 'Access denied' });

  const allowed = [];
  if (isAdmin || isDoctor) allowed.push('status', 'notes', 'date', 'time', 'priority');
  if (isPatient) allowed.push('status', 'reason'); // patient can cancel

  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  db.get('appointments').find({ id: req.params.id }).assign(updates).write();
  res.json(db.get('appointments').find({ id: req.params.id }).value());
});

// DELETE /api/appointments/:id
router.delete('/:id', auth, requireRole('admin'), (req, res) => {
  db.get('appointments').remove({ id: req.params.id }).write();
  res.json({ message: 'Deleted' });
});

module.exports = router;
