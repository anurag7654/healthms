const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

router.get('/overview', auth, requireRole('admin'), (req, res) => {
  const users = db.get('users').value();
  const appointments = db.get('appointments').value();
  const prescriptions = db.get('prescriptions').value();
  const healthRecords = db.get('healthRecords').value();

  const today = new Date().toISOString().split('T')[0];

  res.json({
    users: {
      total: users.length,
      patients: users.filter(u => u.role === 'patient').length,
      doctors: users.filter(u => u.role === 'doctor').length,
      admins: users.filter(u => u.role === 'admin').length,
      active: users.filter(u => u.status === 'active').length,
    },
    appointments: {
      total: appointments.length,
      pending: appointments.filter(a => a.status === 'pending').length,
      confirmed: appointments.filter(a => a.status === 'confirmed').length,
      completed: appointments.filter(a => a.status === 'completed').length,
      cancelled: appointments.filter(a => a.status === 'cancelled').length,
      today: appointments.filter(a => a.date === today).length,
    },
    prescriptions: {
      total: prescriptions.length,
      active: prescriptions.filter(p => p.status === 'active').length,
    },
    healthRecords: { total: healthRecords.length },

    // Last 7 days appointment trend
    trend: Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      return {
        date: dateStr,
        label: d.toLocaleDateString('en', { weekday: 'short' }),
        count: appointments.filter(a => a.date === dateStr).length
      };
    }),
  });
});

// Doctor stats
router.get('/doctor', auth, requireRole('doctor'), (req, res) => {
  const appts = db.get('appointments').filter({ doctorId: req.user.id }).value();
  const today = new Date().toISOString().split('T')[0];
  const patientIds = [...new Set(appts.map(a => a.patientId))];

  res.json({
    totalPatients: patientIds.length,
    totalAppointments: appts.length,
    todayAppointments: appts.filter(a => a.date === today).length,
    pendingApprovals: appts.filter(a => a.status === 'pending').length,
    completedAppointments: appts.filter(a => a.status === 'completed').length,
    prescriptionsGiven: db.get('prescriptions').filter({ doctorId: req.user.id }).value().length,
  });
});

// Patient stats
router.get('/patient', auth, requireRole('patient'), (req, res) => {
  const appts = db.get('appointments').filter({ patientId: req.user.id }).value();
  const medicines = db.get('medicines').filter({ patientId: req.user.id }).value();
  const records = db.get('healthRecords').filter({ patientId: req.user.id }).value();
  const today = new Date().toISOString().split('T')[0];
  const upcoming = appts.filter(a => a.date >= today && a.status !== 'cancelled');

  res.json({
    upcomingAppointments: upcoming.length,
    totalAppointments: appts.length,
    medicinesTotal: medicines.length,
    medicinesTaken: medicines.filter(m => m.taken).length,
    healthRecords: records.length,
    prescriptions: db.get('prescriptions').filter({ patientId: req.user.id }).value().length,
    avgAdherence: medicines.length > 0 ? Math.round((medicines.filter(m => m.taken).length / medicines.length) * 100) : 0,
  });
});

module.exports = router;
