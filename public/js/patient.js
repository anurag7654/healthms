/* ================================================================
   HealthMS — Patient Dashboard (Fixed & AI-Enhanced)
   ================================================================ */

'use strict';

let patientCharts = {};
let bookDoctors = [];

async function initPatient() {
  const user = Session.user();
  if (!user || user.role !== 'patient') { window.location.href = '/'; return; }

  Theme.init();
  fillSidebarProfile(user);
  initNav();
  navigateTo('overview');

  // Load overview data
  await Promise.all([
    loadPatientStats(),
    loadOverviewVitals(),
    loadUpcomingAppointments(),
    loadOverviewMedicines(),
  ]);

  // View lazy-loading
  document.querySelectorAll('.nav-link[data-view]').forEach(link => {
    link.addEventListener('click', async () => {
      const v = link.dataset.view;
      if (v === 'appointments')  await loadAllAppointments();
      if (v === 'medicines')     await loadMedicines();
      if (v === 'records')       await loadHealthRecords();
      if (v === 'analytics')     await loadAnalytics();
      if (v === 'profile')       await loadProfile();
    });
  });

  wireBookAppointment();
  wireAddMedicine();
  wireAddRecord();
  wireProfileForm();
}

/* ── APPOINTMENT FUNCTIONS (FIXED) ────────────────── */

async function openBookModal() {
  try {
    const doctors = await API.get('/users?role=doctor');
    bookDoctors = doctors;
    const datalist = document.getElementById('doctor-list');
    if (datalist) {
      datalist.innerHTML = doctors.map(d => `<option value="${esc(d.name)}">`).join('');
    }
  } catch(e) {
    console.warn("Manual entry active.", e);
    toast('Could not load doctor list. Enter a name manually.', 'warning');
  }
  
  const dateInput = document.getElementById('book-date');
  if (dateInput) { dateInput.min = today(); if (!dateInput.value) dateInput.value = today(); }
  openModal('modal-book-appt');
}

function wireBookAppointment() {
  document.querySelectorAll('[data-open-book]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.preventDefault();
      await openBookModal();
    });
  });

  document.getElementById('form-book-appt')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.querySelector('[type=submit][form="form-book-appt"]') || e.target.querySelector('[type=submit]');
    if (btn) btn.classList.add('loading');
    try {
      // Collect manual name from text input
      const doctorName = document.getElementById('book-doctor').value.trim();
      const date       = document.getElementById('book-date').value;
      const time       = document.getElementById('book-time').value;
      const reason     = document.getElementById('book-reason').value.trim();

      if (!doctorName) { toast('Enter doctor name', 'error'); return; }
      if (!date || !time || !reason) { toast('Please fill all fields', 'error'); return; }

      const normalizedDoctorName = doctorName.toLowerCase();
      const doctor = bookDoctors.find(d => d.name.toLowerCase().trim() === normalizedDoctorName);
      const payload = { date, time, reason };
      if (doctor) payload.doctorId = doctor.id;
      else payload.doctorName = doctorName;

      await API.post('/appointments', payload);

      closeModal('modal-book-appt');
      e.target.reset();
      toast('🎉 Appointment booked!', 'success');
      await loadUpcomingAppointments();
    } catch(err) {
      toast(err.message, 'error');
    } finally { if (btn) btn.classList.remove('loading'); }
  });
}

/* ── AI INSIGHT LAYER ─────────────────────────────── */

async function updateAIInsights(vitals) {
  const summaryEl = document.getElementById('ai-summary');
  const statusEl  = document.getElementById('ai-status');
  const actionEl  = document.getElementById('ai-action');
  
  if (!summaryEl) return;

  if (!vitals || vitals.length === 0) {
    summaryEl.textContent = "Log your first vitals to enable AI insights.";
    statusEl.textContent = "Awaiting Data";
    actionEl.textContent = "Add Record";
    return;
  }

  const latest = vitals[vitals.length - 1];
  let insight = "Your health metrics are stable. Keep going!";
  let status  = "Optimal";
  let action  = "Continue Routine";

  if (latest.bloodSugar > 140 || latest.bpSystolic > 130) {
    insight = "Noticeable spike detected. Monitor sugar and BP closely.";
    status  = "Warning";
    action  = "Track Daily";
  }

  summaryEl.textContent = insight;
  statusEl.textContent  = status;
  actionEl.textContent  = action;
}

/* ── CORE DATA LOADERS ───────────────────────────────── */

async function loadOverviewVitals() {
  try {
    const records = await API.get('/health');
    updateAIInsights(records);
    const latest  = records[records.length - 1];
    if (!latest) return;
    setValue('ov-weight', latest.weight ? `${latest.weight}kg` : '—');
    setValue('ov-bp',     latest.bpSystolic ? `${latest.bpSystolic}/${latest.bpDiastolic}` : '—');
    setValue('ov-sugar',  latest.bloodSugar ? `${latest.bloodSugar}` : '—');
    setValue('ov-hr',     latest.heartRate ? `${latest.heartRate}` : '—');
  } catch(e) { console.warn(e); }
}

async function loadHealthRecords() {
  const container = document.getElementById('records-list');
  if (!container) return;
  try {
    const data = await API.get('/health');
    updateAIInsights(data);
    if (!data.length) {
      container.innerHTML = emptyState('📋', 'No health records yet', 'Log records to see your vitals and history.');
      return;
    }
    container.innerHTML = `<div class="tbl-wrap"><table>
      <thead><tr><th>Date</th><th>Weight</th><th>BP</th><th>Sugar</th><th>Heart Rate</th></tr></thead>
      <tbody>${data.slice().reverse().map(r => `
        <tr>
          <td><strong>${fmtDate(r.date)}</strong></td>
          <td>${r.weight ? `${r.weight}kg` : '—'}</td>
          <td>${r.bpSystolic && r.bpDiastolic ? `${r.bpSystolic}/${r.bpDiastolic}` : '—'}</td>
          <td>${r.bloodSugar ? `${r.bloodSugar} mg/dL` : '—'}</td>
          <td>${r.heartRate ? `${r.heartRate} bpm` : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  } catch (err) { container.innerHTML = '⚠️ Load error'; }
}

async function loadPatientStats() {
  try {
    const s = await API.get('/stats/patient');
    setValue('kpi-upcoming', s.upcomingAppointments);
    setValue('kpi-med-taken', `${s.medicinesTaken}/${s.medicinesTotal}`);
    setValue('kpi-records', s.healthRecords);
    setValue('kpi-prescriptions', s.prescriptions);
  } catch (e) {
    console.warn(e);
  }
}

async function loadOverviewMedicines() {
  try {
    const meds = await API.get('/medicines');
    const total = meds.length;
    const taken = meds.filter(m => m.taken).length;
    const percent = total ? Math.round((taken / total) * 100) : 0;

    setValue('ov-med-label', total ? `${taken}/${total} taken` : 'No medicines scheduled');
    const fill = document.getElementById('ov-med-fill');
    if (fill) fill.style.width = `${percent}%`;
    const listEl = document.getElementById('ov-med-list');
    if (listEl) {
      listEl.innerHTML = total
        ? meds.slice(0, 4).map(m => `${esc(m.name)} ${m.dosage || ''} • ${esc(m.time || 'Anytime')}`).join('<br>')
        : 'No medicines found for your plan.';
    }
  } catch (e) {
    console.warn(e);
  }
}

async function loadUpcomingAppointments() {
  try {
    const appts = await API.get('/appointments');
    const upcoming = appts.filter(a => a.status !== 'cancelled').sort((a, b) => new Date(a.date) - new Date(b.date));
    setValue('kpi-upcoming', upcoming.length);
  } catch (e) {
    console.warn(e);
  }
}

async function loadAllAppointments() {
  const container = document.getElementById('all-appts');
  if (!container) return;
  setLoading(container);
  try {
    const appts = await API.get('/appointments');
    if (!appts.length) {
      container.innerHTML = emptyState('📅', 'No appointments found', 'Book your first appointment to get started.');
      return;
    }
    appts.sort((a, b) => new Date(b.date) - new Date(a.date));
    container.innerHTML = `<div class="tbl-wrap"><table>
      <thead><tr><th>Doctor</th><th>Date & Time</th><th>Reason</th><th>Status</th></tr></thead>
      <tbody>${appts.map(a => patientApptRow(a)).join('')}</tbody>
    </table></div>`;
  } catch (e) {
    container.innerHTML = emptyState('⚠️', 'Could not load appointments');
  }
}

function patientApptRow(a) {
  return `
    <tr>
      <td><strong>${esc(a.doctorName)}</strong><br><span style="font-size:12px;color:var(--text-muted)">${esc(a.specialization || 'General')}</span></td>
      <td><strong>${fmtDate(a.date)}</strong><br><span style="font-size:12px;color:var(--text-muted)">${esc(a.time)}</span></td>
      <td style="max-width:250px;font-size:13px">${esc(a.reason)}</td>
      <td>${chipStatus(a.status)}</td>
    </tr>`;
}

async function loadMedicines() {
  await loadOverviewMedicines();
}

async function loadAnalytics() {
  const container = document.getElementById('v-analytics');
  if (container) container.innerHTML = `<div class="card"><div class="card-body">Analytics coming soon.</div></div>`;
}

async function loadProfile() {
  const container = document.getElementById('v-profile');
  if (container) container.innerHTML = `<div class="card"><div class="card-body">Profile settings are not configured yet.</div></div>`;
}

function wireAddMedicine() {}
function wireAddRecord() {}
function wireProfileForm() {}

function setValue(id, val) { const el = document.getElementById(id); if (el) el.textContent = val ?? '—'; }
