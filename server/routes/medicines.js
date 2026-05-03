const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { auth } = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const patientId = req.user.role === 'patient' ? req.user.id : req.query.patientId;
  if (!patientId) return res.status(400).json({ error: 'patientId required' });
  res.json(db.get('medicines').filter({ patientId }).value());
});

router.post('/', auth, (req, res) => {
  const patientId = req.user.role === 'patient' ? req.user.id : req.body.patientId;
  const { name, dosage, time, category, startDate, endDate } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const med = {
    id: uuidv4(), patientId, name, dosage: dosage || '',
    time: time || '', category: category || 'General',
    prescribedBy: req.body.prescribedBy || 'Self',
    startDate: startDate || new Date().toISOString().split('T')[0],
    endDate: endDate || '', taken: false, streak: 0
  };
  db.get('medicines').push(med).write();
  res.status(201).json(med);
});

router.patch('/:id', auth, (req, res) => {
  const med = db.get('medicines').find({ id: req.params.id }).value();
  if (!med) return res.status(404).json({ error: 'Not found' });

  const updates = {};
  ['name','dosage','time','category','taken','streak','endDate'].forEach(k => {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  });

  // Increment streak when taken
  if (req.body.taken === true && !med.taken) updates.streak = (med.streak || 0) + 1;
  if (req.body.taken === false && med.taken) updates.streak = Math.max(0, (med.streak || 0) - 1);

  db.get('medicines').find({ id: req.params.id }).assign(updates).write();
  res.json(db.get('medicines').find({ id: req.params.id }).value());
});

router.delete('/:id', auth, (req, res) => {
  db.get('medicines').remove({ id: req.params.id }).write();
  res.json({ message: 'Deleted' });
});

// POST /api/medicines/reset-daily – reset all taken flags (cron-like)
router.post('/reset-daily', auth, (req, res) => {
  const patientId = req.user.role === 'patient' ? req.user.id : req.body.patientId;
  db.get('medicines').filter({ patientId }).each(m => { m.taken = false; }).write();
  res.json({ message: 'Daily medicines reset' });
});

module.exports = router;
