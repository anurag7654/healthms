/* ================================================================
   HealthMS — Patient Dashboard
   Handles both brand-new users (zero data) and returning users
   ================================================================ */

'use strict';

let patientCharts = {};

async function initPatient() {
  const user = Session.user();
  if (!user || user.role !== 'patient') { window.location.href = '/'; return; }

  Theme.init();
  fillSidebarProfile(user);
  initNav();
  navigateTo('overview');

  // Load overview data in parallel
  await Promise.all([
    loadPatientStats(),
    loadOverviewVitals(),
    loadUpcomingAppointments(),
    loadOverviewMedicines(),
  ]);

  // Lazy-load sections when nav is clicked
  document.querySelectorAll('.nav-link[data-view]').forEach(link => {
    link.addEventListener('click', async () => {
      const v = link.dataset.view;
      if (v === 'appointments')  await loadAllAppointments();
      if (v === 'medicines')     await loadMedicines();
      if (v === 'records')       await loadHealthRecords();
      if (v === 'analytics')     await loadAnalytics();
      if (v === 'symptoms')      initSymptomChecker();
      if (v === 'prescriptions') await loadPatientPrescriptions();
      if (v === 'profile')       await loadProfile();
    });
  });

  // Wire all forms
  wireBookAppointment();
  wireAddMedicine();
  wireAddRecord();
  wireProfileForm();
  wirePDFReport();
}

/* ──────────────────────────────────────────────────────────────────
   STATS KPIs
────────────────────────────────────────────────────────────────── */
async function loadPatientStats() {
  try {
    const s = await API.get('/stats/patient');
    setValue('kpi-upcoming',      s.upcomingAppointments);
    setValue('kpi-med-taken',     `${s.medicinesTaken}/${s.medicinesTotal}`);
    setValue('kpi-records',       s.healthRecords);
    setValue('kpi-prescriptions', s.prescriptions);

    // Adherence bar
    const pct = s.avgAdherence || 0;
    setValue('kpi-adherence', `${pct}%`);
    const bar = document.getElementById('adherence-bar');
    if (bar) bar.style.width = `${pct}%`;
  } catch(e) { console.warn('stats error', e.message); }
}

/* ──────────────────────────────────────────────────────────────────
   OVERVIEW — VITALS
────────────────────────────────────────────────────────────────── */
async function loadOverviewVitals() {
  try {
    const records = await API.get('/health');
    const latest  = records[records.length - 1];

    if (!latest) {
      // Fresh user — show welcoming prompt instead of dashes
      ['ov-weight','ov-bp','ov-sugar','ov-hr'].forEach(id => setValue(id, '—'));
      const hint = document.getElementById('vitals-hint');
      if (hint) hint.style.display = 'flex';
      return;
    }

    setValue('ov-weight', latest.weight     ? `${latest.weight}`                         : '—');
    setValue('ov-bp',     latest.bpSystolic ? `${latest.bpSystolic}/${latest.bpDiastolic}` : '—');
    setValue('ov-sugar',  latest.bloodSugar ? `${latest.bloodSugar}`                     : '—');
    setValue('ov-hr',     latest.heartRate  ? `${latest.heartRate}`                      : '—');

    setVitalStatus('bp-status',    bpStatus(latest.bpSystolic, latest.bpDiastolic));
    setVitalStatus('sugar-status', sugarStatus(latest.bloodSugar));
    setVitalStatus('hr-status',    hrStatus(latest.heartRate));
  } catch(e) { console.warn(e); }
}

function bpStatus(s, d) {
  if (!s) return null;
  if (s > 140 || d > 90) return ['danger',  '⚠ High'];
  if (s > 130 || d > 85) return ['warning', '↑ Elevated'];
  return ['normal', '✓ Normal'];
}
function sugarStatus(v) {
  if (!v) return null;
  if (v > 126) return ['danger',  '⚠ High'];
  if (v > 100) return ['warning', '↑ Pre-diabetic'];
  return ['normal', '✓ Normal'];
}
function hrStatus(v) {
  if (!v) return null;
  if (v > 100 || v < 50) return ['danger',  '⚠ Abnormal'];
  if (v > 90)             return ['warning', '↑ Elevated'];
  return ['normal', '✓ Normal'];
}
function setVitalStatus(id, result) {
  const el = document.getElementById(id);
  if (!el || !result) return;
  el.className  = `vt-status ${result[0]}`;
  el.textContent = result[1];
}

/* ──────────────────────────────────────────────────────────────────
   OVERVIEW — UPCOMING APPOINTMENTS
────────────────────────────────────────────────────────────────── */
async function loadUpcomingAppointments() {
  const container = document.getElementById('ov-appts');
  if (!container) return;
  setLoading(container);
  try {
    const all      = await API.get('/appointments');
    const upcoming = all
      .filter(a => a.date >= today() && a.status !== 'cancelled')
      .sort((a,b) => a.date.localeCompare(b.date))
      .slice(0, 4);

    if (!upcoming.length) {
      container.innerHTML = `
        <div class="empty-state" style="padding:28px 16px">
          <div class="es-icon">📅</div>
          <h4>No upcoming appointments</h4>
          <p>Book your first appointment with a doctor</p>
          <button class="btn btn-primary btn-sm" style="margin-top:14px" data-open-book>+ Book Appointment</button>
        </div>`;
      // Re-wire the button inside the empty state
      container.querySelector('[data-open-book]')?.addEventListener('click', () => {
        document.querySelector('[data-open-book]')?.click();
      });
      return;
    }
    container.innerHTML = `<div class="appt-list">${upcoming.map(a => renderApptCard(a, false)).join('')}</div>`;
  } catch(e) {
    container.innerHTML = emptyState('⚠️', 'Could not load appointments');
  }
}

/* ──────────────────────────────────────────────────────────────────
   OVERVIEW — MEDICINES WIDGET
────────────────────────────────────────────────────────────────── */
async function loadOverviewMedicines() {
  try {
    const meds = await API.get('/medicines');
    const done = meds.filter(m => m.taken).length;
    const pct  = meds.length ? Math.round(done / meds.length * 100) : 0;

    setValue('ov-med-label', meds.length ? `${done} of ${meds.length} taken today` : 'No medicines tracked yet');

    const fill = document.getElementById('ov-med-fill');
    if (fill) {
      fill.style.width      = `${pct}%`;
      fill.className        = `progress-fill ${pct === 100 ? 'green' : pct > 50 ? '' : 'amber'}`;
    }

    const list = document.getElementById('ov-med-list');
    if (!list) return;

    if (!meds.length) {
      list.innerHTML = `
        <div style="font-size:13px;color:var(--text-faint);text-align:center;padding:12px 0">
          💊 Add your medicines to track them here
        </div>`;
      return;
    }

    const pending = meds.filter(m => !m.taken);
    if (!pending.length) {
      list.innerHTML = `<div style="color:var(--green);font-weight:600;font-size:13.5px;text-align:center;padding:8px 0">✅ All medicines taken today!</div>`;
      return;
    }

    list.innerHTML = pending.slice(0, 3).map(m => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-subtle)">
        <div class="med-check" onclick="quickToggleMed('${m.id}', false)" title="Mark taken" style="flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text-strong);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div>
          <div style="font-size:11.5px;color:var(--text-muted)">${esc(m.time)}</div>
        </div>
      </div>`).join('') +
      (pending.length > 3 ? `<div style="font-size:12px;color:var(--text-faint);margin-top:6px">+${pending.length-3} more pending</div>` : '');
  } catch(e) { console.warn(e); }
}

window.quickToggleMed = async function(id) {
  try {
    await API.patch(`/medicines/${id}`, { taken: true });
    toast('💊 Medicine marked as taken!', 'success');
    await loadOverviewMedicines();
    await loadPatientStats();
  } catch(e) { toast(e.message, 'error'); }
};

/* ──────────────────────────────────────────────────────────────────
   ALL APPOINTMENTS PAGE
────────────────────────────────────────────────────────────────── */
async function loadAllAppointments() {
  const container = document.getElementById('all-appts');
  if (!container) return;
  setLoading(container);
  try {
    const appts = await API.get('/appointments');
    renderFilteredAppts(container, appts);
  } catch(e) {
    container.innerHTML = emptyState('⚠️', 'Could not load appointments');
  }
}

function renderFilteredAppts(container, appts) {
  const filterVal = document.getElementById('appt-filter-sel')?.value  || 'all';
  const searchVal = document.getElementById('appt-search-input')?.value?.toLowerCase() || '';
  let filtered = appts;
  if (filterVal !== 'all') filtered = filtered.filter(a => a.status === filterVal);
  if (searchVal)           filtered = filtered.filter(a =>
    a.reason.toLowerCase().includes(searchVal) || a.doctorName.toLowerCase().includes(searchVal)
  );
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">📅</div>
        <h4>${appts.length === 0 ? 'No appointments yet' : 'No results found'}</h4>
        <p>${appts.length === 0
          ? 'Book your first appointment with a doctor to get started'
          : 'Try adjusting your search or filter'}</p>
        ${appts.length === 0
          ? `<button class="btn btn-primary btn-sm" style="margin-top:14px" data-open-book>+ Book Your First Appointment</button>`
          : ''}
      </div>`;
    container.querySelector('[data-open-book]')?.addEventListener('click', openBookModal);
    return;
  }
  container.innerHTML = `<div class="appt-list" style="padding:16px">${filtered.map(a => renderApptCard(a, true)).join('')}</div>`;
}

function renderApptCard(a, showCancel = false) {
  const { day, month } = fmtShortDate(a.date);
  const canCancel = showCancel && (a.status === 'pending' || a.status === 'confirmed');
  return `
  <div class="appt-item">
    <div class="appt-date-col"><div class="adc-day">${day}</div><div class="adc-month">${month}</div></div>
    <div class="appt-info">
      <div class="appt-title">${esc(a.reason)}</div>
      <div class="appt-meta">
        <span>👨‍⚕️ ${esc(a.doctorName)}</span>
        <span>🕐 ${a.time}</span>
        ${a.specialization ? `<span>📋 ${esc(a.specialization)}</span>` : ''}
      </div>
      <div style="margin-top:6px;display:flex;align-items:center;gap:6px">
        ${chipStatus(a.status)}
        ${a.priority === 'high' ? '<span class="chip chip-red">High Priority</span>' : ''}
        ${a.notes ? `<span style="font-size:11.5px;color:var(--text-muted)">📝 ${esc(a.notes)}</span>` : ''}
      </div>
    </div>
    ${canCancel ? `<div class="appt-actions"><button class="btn btn-danger btn-xs" onclick="cancelAppt('${a.id}')">Cancel</button></div>` : ''}
  </div>`;
}

window.cancelAppt = async function(id) {
  if (!confirm('Cancel this appointment?')) return;
  try {
    await API.patch(`/appointments/${id}`, { status: 'cancelled' });
    toast('Appointment cancelled', 'warning');
    await loadAllAppointments();
    await loadUpcomingAppointments();
    await loadPatientStats();
  } catch(e) { toast(e.message, 'error'); }
};

/* ──────────────────────────────────────────────────────────────────
   BOOK APPOINTMENT FORM
────────────────────────────────────────────────────────────────── */
async function openBookModal() {
  try {
    const doctors = await API.get('/users?role=doctor');
    const sel = document.getElementById('book-doctor');
    if (!sel) return;
    if (!doctors.length) {
      sel.innerHTML = '<option value="">No doctors available yet</option>';
    } else {
      sel.innerHTML = '<option value="">Select a doctor…</option>' +
        doctors.map(d => `<option value="${d.id}">${esc(d.name)}${d.specialization ? ' — ' + esc(d.specialization) : ''}</option>`).join('');
    }
  } catch {}
  const dateInput = document.getElementById('book-date');
  if (dateInput) { dateInput.min = today(); if (!dateInput.value) dateInput.value = today(); }
  openModal('modal-book-appt');
}

function wireBookAppointment() {
  document.querySelectorAll('[data-open-book]').forEach(btn => {
    btn.addEventListener('click', openBookModal);
  });

  document.getElementById('form-book-appt')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.classList.add('loading');
    try {
      const doctorId = document.getElementById('book-doctor').value;
      const date     = document.getElementById('book-date').value;
      const time     = document.getElementById('book-time').value;
      const reason   = document.getElementById('book-reason').value.trim();

      if (!doctorId) { toast('Please select a doctor', 'error'); btn.classList.remove('loading'); return; }
      if (!reason)   { toast('Please describe your reason for the visit', 'error'); btn.classList.remove('loading'); return; }

      await API.post('/appointments', {
        doctorId, date, time, reason,
        priority: document.getElementById('book-priority').value,
      });

      closeModal('modal-book-appt');
      e.target.reset();
      toast('🎉 Appointment booked successfully!', 'success');
      await loadAllAppointments();
      await loadUpcomingAppointments();
      await loadPatientStats();
    } catch(err) {
      toast(err.message, 'error');
    } finally { btn.classList.remove('loading'); }
  });
}

/* ──────────────────────────────────────────────────────────────────
   MEDICINES
────────────────────────────────────────────────────────────────── */
async function loadMedicines() {
  const container = document.getElementById('med-list');
  if (!container) return;
  setLoading(container);
  try {
    const meds = await API.get('/medicines');
    const done = meds.filter(m => m.taken).length;
    const pct  = meds.length ? Math.round(done / meds.length * 100) : 0;

    setValue('med-progress-label', meds.length
      ? `${done} of ${meds.length} taken today — ${pct}%`
      : 'No medicines added yet');

    const fill = document.getElementById('med-progress-fill');
    if (fill) {
      fill.style.width = `${pct}%`;
      fill.className   = `progress-fill ${pct === 100 ? 'green' : pct > 50 ? '' : 'amber'}`;
    }

    if (!meds.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="es-icon">💊</div>
          <h4>No medicines tracked yet</h4>
          <p>Add your daily medicines to track them and build streaks</p>
          <button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="openModal('modal-add-med')">+ Add Your First Medicine</button>
        </div>`;
      return;
    }

    container.innerHTML = meds.map(m => `
      <div class="med-item ${m.taken ? 'done-item' : ''}">
        <div class="med-check ${m.taken ? 'done' : ''}"
             onclick="toggleMed('${m.id}', ${m.taken})"
             title="${m.taken ? 'Mark undone' : 'Mark as taken'}">
          ${m.taken ? '✓' : ''}
        </div>
        <div class="med-info">
          <div class="med-name">${esc(m.name)}</div>
          <div class="med-dose">${esc(m.dosage || '')}${m.category ? ' · ' + esc(m.category) : ''}</div>
        </div>
        <div class="med-time-tag">${esc(m.time || '')}</div>
        ${m.streak > 0 ? `<div class="med-streak">🔥 ${m.streak}d streak</div>` : ''}
        <button class="btn btn-ghost btn-xs" onclick="deleteMed('${m.id}')" title="Remove">✕</button>
      </div>`).join('');
  } catch(e) {
    container.innerHTML = emptyState('⚠️', 'Could not load medicines');
  }
}

window.toggleMed = async function(id, wasTaken) {
  try {
    await API.patch(`/medicines/${id}`, { taken: !wasTaken });
    await loadMedicines();
    await loadPatientStats();
    await loadOverviewMedicines();
    toast(wasTaken ? 'Medicine unmarked' : '💊 Medicine marked as taken!', wasTaken ? 'info' : 'success');
  } catch(e) { toast(e.message, 'error'); }
};

window.deleteMed = async function(id) {
  if (!confirm('Remove this medicine from your tracker?')) return;
  try {
    await API.delete(`/medicines/${id}`);
    await loadMedicines();
    await loadPatientStats();
    await loadOverviewMedicines();
    toast('Medicine removed', 'info');
  } catch(e) { toast(e.message, 'error'); }
};

function wireAddMedicine() {
  document.getElementById('btn-add-med')?.addEventListener('click', () => openModal('modal-add-med'));

  document.getElementById('form-add-med')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.classList.add('loading');
    try {
      const name = document.getElementById('med-name').value.trim();
      if (!name) { toast('Please enter a medicine name', 'error'); btn.classList.remove('loading'); return; }

      await API.post('/medicines', {
        name,
        dosage:    document.getElementById('med-dosage').value,
        time:      document.getElementById('med-time').value,
        category:  document.getElementById('med-category').value,
        startDate: document.getElementById('med-start').value || today(),
        endDate:   document.getElementById('med-end').value,
      });

      closeModal('modal-add-med');
      e.target.reset();
      toast('Medicine added!', 'success');
      await loadMedicines();
      await loadPatientStats();
      await loadOverviewMedicines();
    } catch(err) {
      toast(err.message, 'error');
    } finally { btn.classList.remove('loading'); }
  });
}

/* ──────────────────────────────────────────────────────────────────
   HEALTH RECORDS
────────────────────────────────────────────────────────────────── */
async function loadHealthRecords() {
  const container = document.getElementById('records-list');
  if (!container) return;
  setLoading(container);
  try {
    const records = await API.get('/health');
    records.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!records.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="es-icon">📋</div>
          <h4>No health records yet</h4>
          <p>Start logging your vitals — weight, blood pressure, sugar level, heart rate</p>
          <button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="document.getElementById('btn-add-record').click()">+ Log Your First Record</button>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="tbl-wrap"><table>
        <thead><tr>
          <th>Date</th><th>Weight</th><th>Blood Pressure</th><th>Blood Sugar</th>
          <th>Heart Rate</th><th>Temp</th><th>SpO₂</th><th>Notes</th><th></th>
        </tr></thead>
        <tbody>${records.map(r => `
          <tr>
            <td><strong>${fmtDate(r.date)}</strong></td>
            <td>${r.weight     ? r.weight + ' kg'      : '—'}</td>
            <td>${r.bpSystolic ? `${r.bpSystolic}/${r.bpDiastolic} mmHg` : '—'}</td>
            <td>${r.bloodSugar ? r.bloodSugar + ' mg/dL': '—'}</td>
            <td>${r.heartRate  ? r.heartRate  + ' bpm'  : '—'}</td>
            <td>${r.temperature? r.temperature+ ' °C'   : '—'}</td>
            <td>${r.oxygenSat  ? r.oxygenSat  + '%'     : '—'}</td>
            <td style="font-size:12px;color:var(--text-muted);max-width:180px">${esc(r.notes || '—')}</td>
            <td><button class="btn btn-ghost btn-xs" onclick="deleteRecord('${r.id}')">Delete</button></td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
  } catch(e) {
    container.innerHTML = emptyState('⚠️', 'Could not load records');
  }
}

window.deleteRecord = async function(id) {
  if (!confirm('Delete this health record?')) return;
  try {
    await API.delete(`/health/${id}`);
    toast('Record deleted', 'info');
    await loadHealthRecords();
    await loadOverviewVitals();
    await loadPatientStats();
    if (document.getElementById('v-analytics')?.classList.contains('active')) await loadAnalytics();
  } catch(e) { toast(e.message, 'error'); }
};

function wireAddRecord() {
  document.getElementById('btn-add-record')?.addEventListener('click', () => {
    document.getElementById('rec-date').value = today();
    openModal('modal-add-record');
  });

  document.getElementById('form-add-record')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.classList.add('loading');
    try {
      await API.post('/health', {
        date:        document.getElementById('rec-date').value,
        weight:      parseFloat(document.getElementById('rec-weight').value) || null,
        bpSystolic:  parseInt(document.getElementById('rec-bp-s').value)     || null,
        bpDiastolic: parseInt(document.getElementById('rec-bp-d').value)     || null,
        bloodSugar:  parseFloat(document.getElementById('rec-sugar').value)  || null,
        heartRate:   parseInt(document.getElementById('rec-hr').value)       || null,
        temperature: parseFloat(document.getElementById('rec-temp').value)   || null,
        oxygenSat:   parseInt(document.getElementById('rec-spo2').value)     || null,
        notes:       document.getElementById('rec-notes').value,
      });
      closeModal('modal-add-record');
      e.target.reset();
      toast('Health record saved!', 'success');
      await loadHealthRecords();
      await loadOverviewVitals();
      await loadPatientStats();
      if (document.getElementById('v-analytics')?.classList.contains('active')) await loadAnalytics();
    } catch(err) {
      toast(err.message, 'error');
    } finally { btn.classList.remove('loading'); }
  });
}

/* ──────────────────────────────────────────────────────────────────
   ANALYTICS CHARTS
────────────────────────────────────────────────────────────────── */
async function loadAnalytics() {
  const container = document.getElementById('analytics-wrap');
  try {
    const records = await API.get('/health');
    records.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (!records.length) {
      if (container) container.innerHTML = `
        <div class="empty-state" style="padding:64px 24px">
          <div class="es-icon">📈</div>
          <h4>No data to chart yet</h4>
          <p>Add health records from the Health Records tab to see your trend charts here</p>
          <button class="btn btn-primary btn-sm" style="margin-top:14px"
            onclick="navigateTo('records'); document.querySelector('[data-view=records]')?.classList.add('active')">
            Go to Health Records →
          </button>
        </div>`;
      return;
    }

    if (container) container.style.display = '';

    if (typeof Chart === 'undefined') return;

    const labels = records.map(r => fmtDate(r.date));
    const baseOpts = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { font: { family: 'Instrument Sans', size: 12 }, boxWidth: 12 } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Instrument Sans', size: 11 }, maxTicksLimit: 7 } },
        y: { grid: { color: 'rgba(128,128,128,0.08)' }, ticks: { font: { family: 'Instrument Sans', size: 11 } } },
      },
    };

    const mk = (id, type, data, extraOpts = {}) => {
      const ctx = document.getElementById(id);
      if (!ctx) return;
      if (patientCharts[id]) patientCharts[id].destroy();
      patientCharts[id] = new Chart(ctx, { type, data, options: { ...baseOpts, ...extraOpts } });
    };

    mk('chart-weight', 'line', {
      labels,
      datasets: [{ label: 'Weight (kg)', data: records.map(r => r.weight), borderColor: '#0066FF', backgroundColor: 'rgba(0,102,255,0.08)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#0066FF' }],
    });
    mk('chart-bp', 'line', {
      labels,
      datasets: [
        { label: 'Systolic',  data: records.map(r => r.bpSystolic),  borderColor: '#DE350B', backgroundColor: 'transparent', tension: 0.4, pointRadius: 4 },
        { label: 'Diastolic', data: records.map(r => r.bpDiastolic), borderColor: '#FF8B00', backgroundColor: 'transparent', tension: 0.4, pointRadius: 4 },
      ],
    });
    mk('chart-sugar', 'bar', {
      labels,
      datasets: [{ label: 'Blood Sugar (mg/dL)', data: records.map(r => r.bloodSugar), backgroundColor: 'rgba(101,84,192,0.75)', borderRadius: 5 }],
    });
    mk('chart-hr', 'line', {
      labels,
      datasets: [{ label: 'Heart Rate (bpm)', data: records.map(r => r.heartRate), borderColor: '#00875A', backgroundColor: 'rgba(0,135,90,0.08)', fill: true, tension: 0.4, pointRadius: 4 }],
    });
  } catch(e) { console.warn(e); }
}

/* ──────────────────────────────────────────────────────────────────
   SYMPTOM CHECKER
────────────────────────────────────────────────────────────────── */
const SYMPTOM_RULES = [
  { symptoms: ['fever','cough','runny nose','sore throat'],                                      condition: 'Common Cold / Flu',         advice: 'Rest, drink fluids, and take paracetamol. See a doctor if fever persists beyond 3 days.',                                              severity: 'normal'  },
  { symptoms: ['fever','headache','body aches','chills','fatigue'],                              condition: 'Influenza (Flu)',            advice: 'Rest and stay hydrated. Consider antivirals if caught early. Consult a doctor promptly.',                                              severity: 'warning' },
  { symptoms: ['chest pain','breathlessness','dizziness','arm pain','sweating'],                 condition: 'Possible Cardiac Emergency', advice: '🚨 CALL EMERGENCY SERVICES IMMEDIATELY. Do not drive yourself. Chew aspirin if available and not allergic.',                            severity: 'danger'  },
  { symptoms: ['headache','nausea','sensitivity to light','blurred vision'],                     condition: 'Migraine / Severe Headache', advice: 'Rest in a dark quiet room. OTC pain relievers may help. Consult a doctor if recurring.',                                              severity: 'warning' },
  { symptoms: ['abdominal pain','nausea','vomiting','diarrhea'],                                 condition: 'Gastroenteritis',            advice: 'Stay hydrated with ORS. Eat light foods. Consult a doctor if symptoms persist beyond 24 hours.',                                      severity: 'warning' },
  { symptoms: ['fatigue','frequent urination','excessive thirst','blurred vision','weight loss'],condition: 'Possible Diabetes Symptoms', advice: 'Consult a doctor promptly. Get fasting blood sugar tested. Monitor your diet carefully.',                                              severity: 'warning' },
  { symptoms: ['cough','breathlessness','wheezing','chest tightness'],                          condition: 'Respiratory / Asthma Issue', advice: 'Use your prescribed inhaler if available. Consult a doctor. Avoid known triggers.',                                                   severity: 'warning' },
  { symptoms: ['rash','itching','hives','swelling'],                                             condition: 'Allergic Reaction',          advice: 'Take antihistamines if available. Seek emergency care immediately if you experience breathing difficulty.',                             severity: 'normal'  },
  { symptoms: ['joint pain','stiffness','swelling'],                                             condition: 'Arthritis / Joint Issue',    advice: 'Rest the joint, apply ice or heat. Anti-inflammatory drugs may help. Consult a doctor for diagnosis.',                               severity: 'normal'  },
  { symptoms: ['back pain','neck pain','muscle pain'],                                           condition: 'Musculoskeletal Pain',       advice: 'Rest, apply heat or cold packs. Gentle stretches may help. See a doctor if severe or persistent.',                                   severity: 'normal'  },
];

function initSymptomChecker() {
  const grid = document.getElementById('sym-grid');
  if (!grid || grid.dataset.inited) return;
  grid.dataset.inited = '1';
  const all = [...new Set(SYMPTOM_RULES.flatMap(r => r.symptoms))];
  grid.innerHTML = all.map(s =>
    `<div class="sym-tag" onclick="this.classList.toggle('sel')">${s.charAt(0).toUpperCase()+s.slice(1)}</div>`
  ).join('');
}

window.runDiagnosis = function() {
  const selected = [...document.querySelectorAll('.sym-tag.sel')].map(e => e.textContent.toLowerCase());
  const box = document.getElementById('diagnosis-box');
  if (!selected.length) { toast('Please select at least one symptom', 'warning'); return; }
  let best = null, bestScore = 0;
  SYMPTOM_RULES.forEach(r => {
    const score = r.symptoms.filter(s => selected.includes(s)).length;
    if (score > bestScore) { bestScore = score; best = r; }
  });
  if (!best || bestScore === 0) {
    box.className = 'diagnosis-box show normal';
    box.innerHTML = `<div class="dx-title">No specific match found</div>
      <div class="dx-desc">Your symptoms don't match common patterns in our database. Please consult a healthcare provider for a proper evaluation.</div>`;
    return;
  }
  const icons = { normal: '✅', warning: '⚠️', danger: '🚨' };
  box.className = `diagnosis-box show ${best.severity}`;
  box.innerHTML = `
    <div class="dx-title">${icons[best.severity]} Possible Condition: ${esc(best.condition)}</div>
    <div class="dx-desc">${esc(best.advice)}</div>
    <div class="dx-disclaimer">This is a rule-based preliminary assessment only — it does not replace professional medical advice. Please consult a doctor.</div>`;
};

window.clearSymptoms = function() {
  document.querySelectorAll('.sym-tag').forEach(t => t.classList.remove('sel'));
  const box = document.getElementById('diagnosis-box');
  if (box) { box.className = 'diagnosis-box'; box.innerHTML = ''; }
};

/* ──────────────────────────────────────────────────────────────────
   PRESCRIPTIONS
────────────────────────────────────────────────────────────────── */
async function loadPatientPrescriptions() {
  const container = document.getElementById('patient-rx-list');
  if (!container) return;
  setLoading(container);
  try {
    const rxs = await API.get('/prescriptions');
    if (!rxs.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="es-icon">📋</div>
          <h4>No prescriptions yet</h4>
          <p>When a doctor writes a prescription for you, it will appear here automatically</p>
        </div>`;
      return;
    }
    container.innerHTML = rxs.map(rx => `
      <div class="rx-card" style="margin-bottom:16px">
        <div class="rx-head">
          <div>
            <div class="rx-head-title">${esc(rx.diagnosis)}</div>
            <div class="rx-head-meta">👨‍⚕️ ${esc(rx.doctorName)} · ${fmtDate(rx.date)}${rx.followUp ? ' · Follow-up: ' + fmtDate(rx.followUp) : ''}</div>
          </div>
          <div class="rx-watermark">Rx</div>
        </div>
        <div class="rx-body">
          ${rx.medicines.map(m => `
            <div class="rx-med-row">
              <div class="rx-med-name">${esc(m.name)}</div>
              <div class="rx-med-detail">${esc(m.dosage)} · ${esc(m.frequency)} · ${esc(m.duration)}</div>
            </div>`).join('')}
          ${rx.advice ? `<div class="rx-advice">💡 ${esc(rx.advice)}</div>` : ''}
        </div>
      </div>`).join('');
  } catch(e) {
    container.innerHTML = emptyState('⚠️', 'Could not load prescriptions');
  }
}

/* ──────────────────────────────────────────────────────────────────
   PROFILE
────────────────────────────────────────────────────────────────── */
async function loadProfile() {
  try {
    const user = await API.get('/auth/me');

    // Fill hero banner
    const heroAvatar = document.getElementById('pf-avatar');
    if (heroAvatar) heroAvatar.textContent = initials(user.name);
    setValue('pf-hero-name',  user.name);
    setValue('pf-hero-email', user.email);
    const bgEl  = document.getElementById('pf-hero-bg');
    const ageEl = document.getElementById('pf-hero-age');
    if (bgEl)  { bgEl.textContent  = user.bloodGroup ? `🩸 ${user.bloodGroup}` : ''; bgEl.style.display  = user.bloodGroup ? '' : 'none'; }
    if (ageEl) { ageEl.textContent = user.age        ? `Age ${user.age}`       : ''; ageEl.style.display = user.age        ? '' : 'none'; }

    // Fill form
    const fields = ['name','email','phone','age','bloodGroup','address','emergencyContact'];
    fields.forEach(f => {
      const el = document.getElementById(`pf-${f}`);
      if (el) el.value = user[f] || '';
    });
    const usEl = document.getElementById('pf-username');
    if (usEl) usEl.value = user.username;

    // Gender select
    const genderEl = document.getElementById('pf-gender');
    if (genderEl) genderEl.value = user.gender || '';

  } catch(e) { toast(e.message, 'error'); }
}

function wireProfileForm() {
  document.getElementById('form-profile')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.classList.add('loading');
    try {
      const updates = {};
      ['name','email','phone','age','gender','bloodGroup','address','emergencyContact'].forEach(f => {
        const el = document.getElementById(`pf-${f}`);
        if (el) updates[f] = el.value;
      });
      const user = await API.patch('/auth/me', updates);
      Session.save(Session.token(), user);
      fillSidebarProfile(user);
      toast('Profile updated!', 'success');
      await loadProfile();
    } catch(err) { toast(err.message, 'error'); }
    finally { btn.classList.remove('loading'); }
  });

  document.getElementById('form-password')?.addEventListener('submit', async e => {
    e.preventDefault();
    const cur = document.getElementById('pw-current').value;
    const nw  = document.getElementById('pw-new').value;
    const btn = e.target.querySelector('[type=submit]');
    btn.classList.add('loading');
    try {
      await API.patch('/auth/password', { currentPassword: cur, newPassword: nw });
      e.target.reset();
      toast('Password changed successfully!', 'success');
    } catch(err) { toast(err.message, 'error'); }
    finally { btn.classList.remove('loading'); }
  });
}

/* ──────────────────────────────────────────────────────────────────
   PDF REPORT
────────────────────────────────────────────────────────────────── */
function wirePDFReport() {
  document.getElementById('btn-pdf-report')?.addEventListener('click',  generateReport);
  document.getElementById('btn-pdf-report2')?.addEventListener('click', generateReport);
}

async function generateReport() {
  if (!window.jspdf) { toast('PDF library not available. Please wait and try again.', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  try {
    const [user, records, appointments, prescriptions] = await Promise.all([
      API.get('/auth/me'),
      API.get('/health'),
      API.get('/appointments'),
      API.get('/prescriptions'),
    ]);

    // Header
    doc.setFillColor(0, 102, 255);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('HealthMS — Patient Health Report', 14, 12);
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text(`Generated: ${new Date().toLocaleString()} | Confidential`, 14, 22);

    // Patient info
    doc.setFillColor(235,243,255);
    doc.roundedRect(12, 32, 186, 38, 3, 3, 'F');
    doc.setTextColor(9,30,66);
    doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text(user.name || '', 18, 43);
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(107,119,140);
    const info = [
      `Age: ${user.age||'N/A'}`, `Gender: ${user.gender||'N/A'}`,
      `Blood Group: ${user.bloodGroup||'N/A'}`, `Phone: ${user.phone||'N/A'}`,
      `Email: ${user.email||'N/A'}`, `Address: ${user.address||'N/A'}`,
    ];
    info.forEach((t,i) => doc.text(t, 18+(i%3)*62, 53+Math.floor(i/3)*8));

    // Records table
    let y = 80;
    doc.setTextColor(9,30,66); doc.setFontSize(12); doc.setFont('helvetica','bold');
    doc.text('Health Records', 14, y); y += 7;
    doc.setFillColor(245,246,250); doc.rect(12, y, 186, 7, 'F');
    doc.setFontSize(8); doc.setTextColor(107,119,140);
    ['Date','Weight','BP','Sugar','HR','SpO2'].forEach((h,i) => doc.text(h, 14+i*30, y+5));
    y += 9;
    records.slice(-10).forEach(r => {
      doc.setTextColor(9,30,66); doc.setFont('helvetica','normal');
      doc.text(fmtDate(r.date),                                       14, y);
      doc.text(r.weight     ? `${r.weight}kg`              : '—',     44, y);
      doc.text(r.bpSystolic ? `${r.bpSystolic}/${r.bpDiastolic}` : '—', 74, y);
      doc.text(r.bloodSugar ? `${r.bloodSugar}`             : '—',    104, y);
      doc.text(r.heartRate  ? `${r.heartRate}`              : '—',    134, y);
      doc.text(r.oxygenSat  ? `${r.oxygenSat}%`             : '—',    164, y);
      y += 7;
    });

    // Appointments
    y += 4;
    doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text('Appointments', 14, y); y += 7;
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    appointments.slice(-6).forEach(a => {
      doc.text(`${fmtDate(a.date)}  ${a.doctorName}  ${a.reason}  [${a.status}]`, 14, y); y += 7;
    });

    // Prescriptions
    if (prescriptions.length) {
      y += 4;
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text('Prescriptions', 14, y); y += 7;
      prescriptions.slice(-3).forEach(rx => {
        doc.setFontSize(9); doc.setFont('helvetica','bold');
        doc.text(`${rx.diagnosis} — ${fmtDate(rx.date)} by ${rx.doctorName}`, 14, y); y += 6;
        rx.medicines.forEach(m => {
          doc.setFont('helvetica','normal'); doc.setFontSize(8);
          doc.text(`  • ${m.name} — ${m.dosage} — ${m.frequency}`, 14, y); y += 6;
        });
      });
    }

    // Footer
    doc.setFillColor(0,102,255); doc.rect(0, 284, 210, 13, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(7.5); doc.setFont('helvetica','normal');
    doc.text('HealthMS Digital Health Management System — Confidential Patient Record — Not a substitute for professional medical advice', 14, 292);

    doc.save(`HealthMS_Report_${(user.name||'Patient').replace(/\s+/g,'_')}_${today()}.pdf`);
    toast('PDF report downloaded!', 'success');
  } catch(e) { toast('Could not generate report: ' + e.message, 'error'); }
}

/* ──────────────────────────────────────────────────────────────────
   HELPERS
────────────────────────────────────────────────────────────────── */
function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

// Wire prescriptions tab on nav click
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.nav-link[data-view="prescriptions"]')?.addEventListener('click', loadPatientPrescriptions);
  document.querySelector('.nav-link[data-view="analytics"]')?.addEventListener('click', loadAnalytics);
});