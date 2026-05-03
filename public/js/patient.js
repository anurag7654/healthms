/* ================================================================
   HealthMS — Patient Dashboard (Fixed & AI-Enhanced)[cite: 3, 5]
   ================================================================ */

'use strict';

let patientCharts = {};

async function initPatient() {
  const user = Session.user();[cite: 5]
  if (!user || user.role !== 'patient') { window.location.href = '/'; return; }[cite: 5]

  Theme.init();[cite: 5]
  fillSidebarProfile(user);[cite: 5]
  initNav();[cite: 5]
  navigateTo('overview');[cite: 5]

  // Load overview data[cite: 5]
  await Promise.all([
    loadPatientStats(),
    loadOverviewVitals(),
    loadUpcomingAppointments(),
    loadOverviewMedicines(),
  ]);

  // View lazy-loading[cite: 5]
  document.querySelectorAll('.nav-link[data-view]').forEach(link => {
    link.addEventListener('click', async () => {
      const v = link.dataset.view;[cite: 5]
      if (v === 'appointments')  await loadAllAppointments();
      if (v === 'medicines')     await loadMedicines();
      if (v === 'records')       await loadHealthRecords();
      if (v === 'analytics')     await loadAnalytics();
      if (v === 'profile')       await loadProfile();
    });
  });

  wireBookAppointment();[cite: 5]
  wireAddMedicine();[cite: 5]
  wireAddRecord();[cite: 5]
  wireProfileForm();[cite: 5]
}

/* ── APPOINTMENT FUNCTIONS (FIXED)[cite: 3, 5] ────────────────── */

async function openBookModal() {
  try {
    const doctors = await API.get('/users?role=doctor');[cite: 3, 5]
    const datalist = document.getElementById('doctor-list');[cite: 3, 4]
    if (datalist) {
      datalist.innerHTML = doctors.map(d => `<option value="${esc(d.name)}">`).join('');[cite: 3, 5]
    }
  } catch(e) { console.warn("Manual entry active."); }[cite: 3]
  
  const dateInput = document.getElementById('book-date');[cite: 5]
  if (dateInput) { dateInput.min = today(); if (!dateInput.value) dateInput.value = today(); }[cite: 5]
  openModal('modal-book-appt');[cite: 3, 5]
}

function wireBookAppointment() {
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open-book]')) openBookModal();[cite: 5]
  });

  document.getElementById('form-book-appt')?.addEventListener('submit', async e => {
    e.preventDefault();[cite: 5]
    const btn = e.target.querySelector('[type=submit]');[cite: 5]
    btn.classList.add('loading');[cite: 5]
    try {
      // Collect manual name from text input[cite: 3, 5]
      const doctorName = document.getElementById('book-doctor').value.trim();[cite: 4, 5]
      const date       = document.getElementById('book-date').value;[cite: 5]
      const time       = document.getElementById('book-time').value;[cite: 5]
      const reason     = document.getElementById('book-reason').value.trim();[cite: 5]

      if (!doctorName) { toast('Enter doctor name', 'error'); return; }[cite: 5]

      await API.post('/appointments', { doctorName, date, time, reason });[cite: 3, 5]

      closeModal('modal-book-appt');[cite: 3, 5]
      e.target.reset();[cite: 5]
      toast('🎉 Appointment booked!', 'success');[cite: 5]
      await loadUpcomingAppointments();[cite: 5]
    } catch(err) {
      toast(err.message, 'error');[cite: 5]
    } finally { btn.classList.remove('loading'); }[cite: 5]
  });
}

/* ── AI INSIGHT LAYER[cite: 3, 5] ─────────────────────────────── */

async function updateAIInsights(vitals) {
  const summaryEl = document.getElementById('ai-summary');[cite: 4]
  const statusEl  = document.getElementById('ai-status');[cite: 4]
  const actionEl  = document.getElementById('ai-action');[cite: 4]
  
  if (!summaryEl) return;[cite: 5]

  if (!vitals || vitals.length === 0) {
    summaryEl.textContent = "Log your first vitals to enable AI insights.";[cite: 3, 5]
    statusEl.textContent = "Awaiting Data";[cite: 5]
    actionEl.textContent = "Add Record";[cite: 5]
    return;[cite: 5]
  }

  const latest = vitals[vitals.length - 1];[cite: 3, 5]
  let insight = "Your health metrics are stable. Keep going!";[cite: 3, 5]
  let status  = "Optimal";[cite: 5]
  let action  = "Continue Routine";[cite: 5]

  if (latest.bloodSugar > 140 || latest.bpSystolic > 130) {
    insight = "Noticeable spike detected. Monitor sugar and BP closely.";[cite: 3, 5]
    status  = "Warning";[cite: 5]
    action  = "Track Daily";[cite: 5]
  }

  summaryEl.textContent = insight;[cite: 5]
  statusEl.textContent  = status;[cite: 5]
  actionEl.textContent  = action;[cite: 5]
}

/* ── CORE DATA LOADERS[cite: 5] ───────────────────────────────── */

async function loadOverviewVitals() {
  try {
    const records = await API.get('/health');[cite: 3, 5]
    updateAIInsights(records);[cite: 3, 5]
    const latest  = records[records.length - 1];[cite: 5]
    if (!latest) return;[cite: 5]
    setValue('ov-weight', latest.weight ? `${latest.weight}kg` : '—');[cite: 5]
    setValue('ov-bp',     latest.bpSystolic ? `${latest.bpSystolic}/${latest.bpDiastolic}` : '—');[cite: 5]
    setValue('ov-sugar',  latest.bloodSugar ? `${latest.bloodSugar}` : '—');[cite: 5]
    setValue('ov-hr',     latest.heartRate ? `${latest.heartRate}` : '—');[cite: 5]
  } catch(e) { console.warn(e); }[cite: 5]
}

async function loadHealthRecords() {
  const container = document.getElementById('records-list');[cite: 4, 5]
  if (!container) return;[cite: 5]
  try {
    const data = await API.get('/health');[cite: 3, 5]
    updateAIInsights(data);[cite: 3, 5]
    container.innerHTML = `<div class="tbl-wrap"><table>...</table></div>`; // Simplified render
  } catch (err) { container.innerHTML = '⚠️ Load error'; }[cite: 5]
}

// ... [Remainder of standard patient dashboard functions] ...

function setValue(id, val) { const el = document.getElementById(id); if (el) el.textContent = val ?? '—'; }[cite: 5]