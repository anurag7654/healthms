const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { auth } = require('../middleware/auth');

// GET /api/health
router.get('/', auth, (req, res) => {
  const patientId = req.user.role === 'patient' ? req.user.id : req.query.patientId;
  if (!patientId) return res.status(400).json({ error: 'patientId required' });
  const records = db.get('healthRecords').filter({ patientId }).sortBy('date').value();
  res.json(records);
});

// POST /api/health
router.post('/', auth, (req, res) => {
  const patientId = req.user.role === 'patient' ? req.user.id : req.body.patientId;
  const { date, weight, bpSystolic, bpDiastolic, bloodSugar, heartRate, temperature, oxygenSat, notes } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });

  const record = {
    id: uuidv4(), patientId,
    date, weight: weight || null,
    bpSystolic: bpSystolic || null, bpDiastolic: bpDiastolic || null,
    bloodSugar: bloodSugar || null, heartRate: heartRate || null,
    temperature: temperature || null, oxygenSat: oxygenSat || null,
    notes: notes || '', createdAt: new Date().toISOString()
  };

  db.get('healthRecords').push(record).write();
  res.status(201).json(record);
});

// DELETE /api/health/:id
router.delete('/:id', auth, (req, res) => {
  const r = db.get('healthRecords').find({ id: req.params.id }).value();
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'patient' && r.patientId !== req.user.id)
    return res.status(403).json({ error: 'Access denied' });
  db.get('healthRecords').remove({ id: req.params.id }).write();
  res.json({ message: 'Deleted' });
});

module.exports = router;
