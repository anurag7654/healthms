const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  let rxs = db.get('prescriptions').value();
  if (req.user.role === 'patient') rxs = rxs.filter(r => r.patientId === req.user.id);
  else if (req.user.role === 'doctor') rxs = rxs.filter(r => r.doctorId === req.user.id);
  if (req.query.patientId) rxs = rxs.filter(r => r.patientId === req.query.patientId);
  res.json(rxs.sort((a,b) => new Date(b.date) - new Date(a.date)));
});

router.post('/', auth, requireRole('doctor'), (req, res) => {
  const { patientId, diagnosis, medicines, advice, followUp } = req.body;
  if (!patientId || !diagnosis || !medicines?.length)
    return res.status(400).json({ error: 'patientId, diagnosis and medicines required' });

  const doctor = db.get('users').find({ id: req.user.id }).value();
  const rx = {
    id: uuidv4(), patientId, doctorId: req.user.id,
    doctorName: doctor.name, specialization: doctor.specialization || '',
    date: new Date().toISOString().split('T')[0],
    diagnosis, medicines, advice: advice || '', followUp: followUp || '',
    status: 'active'
  };

  db.get('prescriptions').push(rx).write();

  // Auto-add medicines to tracker
  medicines.forEach(m => {
    db.get('medicines').push({
      id: uuidv4(), patientId, name: m.name, dosage: m.dosage,
      time: m.frequency, category: 'Prescribed',
      prescribedBy: doctor.name,
      startDate: new Date().toISOString().split('T')[0],
      endDate: followUp || '',
      taken: false, streak: 0
    }).write();
  });

  res.status(201).json(rx);
});

router.delete('/:id', auth, (req, res) => {
  const rx = db.get('prescriptions').find({ id: req.params.id }).value();
  if (!rx) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'doctor' && rx.doctorId !== req.user.id)
    return res.status(403).json({ error: 'Access denied' });
  db.get('prescriptions').remove({ id: req.params.id }).write();
  res.json({ message: 'Deleted' });
});

module.exports = router;
