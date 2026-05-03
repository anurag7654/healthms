/* ================================================================
   HealthMS — Doctor Dashboard
   ================================================================ */

'use strict';

let docCharts = {};

async function initDoctor() {
  const user = Session.user();
  if (!user || user.role !== 'doctor') { window.location.href = '/'; return; }

  Theme.init();
  fillSidebarProfile(user);
  initNav();
  navigateTo('overview');

  await Promise.all([loadDoctorStats(), loadDoctorRecentAppointments()]);

  document.querySelectorAll('.nav-link[data-view]').forEach(link => {
    link.addEventListener('click', async () => {
      const v = link.dataset.view;
      if (v === 'appointments') await loadDoctorAllAppointments();
      if (v === 'patients')     await loadDoctorPatients();
      if (v === 'prescriptions') await loadDoctorPrescriptions();
    });
  });

  wireAddNoteModal();
  wirePrescriptionModal();
}

// ── Stats ─────────────────────────────────────────────────────────
async function loadDoctorStats() {
  try {
    const s = await API.get('/stats/doctor');
    setValue('doc-kpi-patients',    s.totalPatients);
    setValue('doc-kpi-total-appts', s.totalAppointments);
    setValue('doc-kpi-today',       s.todayAppointments);
    setValue('doc-kpi-pending',     s.pendingApprovals);
    setValue('doc-kpi-completed',   s.completedAppointments);
    setValue('doc-kpi-rx',          s.prescriptionsGiven);
  } catch(e) { toast(e.message, 'error'); }
}

// ── Recent appointments (overview) ───────────────────────────────
async function loadDoctorRecentAppointments() {
  const container = document.getElementById('doc-recent-appts');
  if (!container) return;
  setLoading(container);
  try {
    const appts = await API.get('/appointments');
    const sorted = [...appts].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
    if (!sorted.length) { container.innerHTML = emptyState('📅', 'No appointments yet'); return; }
    container.innerHTML = `
      <div class="tbl-wrap"><table>
        <thead><tr>
          <th>Patient</th><th>Date & Time</th><th>Reason</th><th>Status</th><th>Priority</th><th>Actions</th>
        </tr></thead>
        <tbody>${sorted.map(a => docApptRow(a)).join('')}</tbody>
      </table></div>`;
  } catch(e) { container.innerHTML = emptyState('⚠️', 'Could not load'); }
}

function docApptRow(a) {
  const priorityChip = a.priority === 'high' ? '<span class="chip chip-red">High</span>' : '<span class="chip chip-gray">Normal</span>';
  return `
    <tr>
      <td><div class="user-cell">
        <div class="mini-avatar">${initials(a.patientName)}</div>
        <div><div class="user-cell-name">${esc(a.patientName)}</div></div>
      </div></td>
      <td><strong>${fmtDate(a.date)}</strong><br><span style="font-size:12px;color:var(--text-muted)">${a.time}</span></td>
      <td style="max-width:200px;font-size:13px">${esc(a.reason)}</td>
      <td>${chipStatus(a.status)}</td>
      <td>${priorityChip}</td>
      <td>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          ${a.status === 'pending'   ? `<button class="btn btn-success btn-xs" onclick="docUpdateAppt('${a.id}','confirmed')">Confirm</button>` : ''}
          ${a.status === 'confirmed' ? `<button class="btn btn-flat btn-xs" onclick="docUpdateAppt('${a.id}','completed')">Complete</button>` : ''}
          ${(a.status === 'pending'||a.status === 'confirmed') ? `<button class="btn btn-danger btn-xs" onclick="docUpdateAppt('${a.id}','cancelled')">Cancel</button>` : ''}
          <button class="btn btn-ghost btn-xs" onclick="openNoteModal('${a.id}','${esc(a.notes||'')}')">Note</button>
          <button class="btn btn-flat btn-xs" onclick="viewPatient('${a.patientId}')">View</button>
        </div>
      </td>
    </tr>`;
}

window.docUpdateAppt = async function(id, status) {
  try {
    await API.patch(`/appointments/${id}`, { status });
    toast(`Appointment ${status}!`, 'success');
    await loadDoctorStats();
    await loadDoctorRecentAppointments();
    if (document.getElementById('v-appointments')?.classList.contains('active')) await loadDoctorAllAppointments();
  } catch(e) { toast(e.message, 'error'); }
};

// ── All appointments ──────────────────────────────────────────────
async function loadDoctorAllAppointments() {
  const container = document.getElementById('doc-all-appts');
  if (!container) return;
  setLoading(container);
  try {
    const appts = await API.get('/appointments');
    const filterVal = document.getElementById('doc-appt-filter')?.value || 'all';
    const searchVal = document.getElementById('doc-appt-search')?.value?.toLowerCase() || '';
    let filtered = appts;
    if (filterVal !== 'all') filtered = filtered.filter(a => a.status === filterVal);
    if (searchVal) filtered = filtered.filter(a =>
      a.patientName.toLowerCase().includes(searchVal) || a.reason.toLowerCase().includes(searchVal)
    );
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (!filtered.length) { container.innerHTML = emptyState('📅', 'No appointments found'); return; }
    container.innerHTML = `<div class="tbl-wrap"><table>
      <thead><tr><th>Patient</th><th>Date & Time</th><th>Duration</th><th>Reason</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
      <tbody>${filtered.map(a => `
        <tr>
          <td><div class="user-cell">
            <div class="mini-avatar">${initials(a.patientName)}</div>
            <div><div class="user-cell-name">${esc(a.patientName)}</div></div>
          </div></td>
          <td><strong>${fmtDate(a.date)}</strong> ${a.time}</td>
          <td>${a.duration || 30} min</td>
          <td style="max-width:180px;font-size:13px">${esc(a.reason)}</td>
          <td>${chipStatus(a.status)}</td>
          <td style="font-size:12px;color:var(--text-muted);max-width:150px">${esc(a.notes||'—')}</td>
          <td><div style="display:flex;gap:5px">
            ${a.status==='pending' ? `<button class="btn btn-success btn-xs" onclick="docUpdateAppt('${a.id}','confirmed')">Confirm</button>` : ''}
            ${a.status==='confirmed' ? `<button class="btn btn-flat btn-xs" onclick="docUpdateAppt('${a.id}','completed')">Complete</button>` : ''}
            <button class="btn btn-ghost btn-xs" onclick="openNoteModal('${a.id}','${esc(a.notes||'')}')">Note</button>
          </div></td>
        </tr>`).join('')}
      </tbody></table></div>`;
  } catch(e) { container.innerHTML = emptyState('⚠️', 'Could not load'); }
}

// Note modal
function wireAddNoteModal() {
  document.getElementById('form-add-note')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id   = document.getElementById('note-appt-id').value;
    const note = document.getElementById('note-text').value;
    try {
      await API.patch(`/appointments/${id}`, { notes: note });
      closeModal('modal-add-note');
      toast('Note saved!', 'success');
      await loadDoctorRecentAppointments();
      if (document.getElementById('v-appointments')?.classList.contains('active')) await loadDoctorAllAppointments();
    } catch(e) { toast(e.message, 'error'); }
  });
}

window.openNoteModal = function(apptId, existingNote) {
  document.getElementById('note-appt-id').value = apptId;
  document.getElementById('note-text').value = existingNote;
  openModal('modal-add-note');
};

// ── Patients list ─────────────────────────────────────────────────
async function loadDoctorPatients() {
  const container = document.getElementById('doc-patients-list');
  if (!container) return;
  setLoading(container);
  try {
    const patients = await API.get('/users?role=patient');
    const searchVal = document.getElementById('doc-pat-search')?.value?.toLowerCase() || '';
    const filtered = searchVal
      ? patients.filter(p => p.name.toLowerCase().includes(searchVal) || (p.bloodGroup||'').toLowerCase().includes(searchVal))
      : patients;

    if (!filtered.length) { container.innerHTML = emptyState('👥', 'No patients found'); return; }
    container.innerHTML = `<div class="tbl-wrap"><table>
      <thead><tr><th>Patient</th><th>Age / Gender</th><th>Blood Group</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${filtered.map(p => `
        <tr>
          <td><div class="user-cell">
            <div class="mini-avatar">${initials(p.name)}</div>
            <div><div class="user-cell-name">${esc(p.name)}</div><div class="user-cell-sub">${esc(p.email||'')}</div></div>
          </div></td>
          <td>${p.age || '—'}${p.gender ? ' · ' + p.gender : ''}</td>
          <td>${p.bloodGroup ? `<span class="chip chip-red">🩸 ${p.bloodGroup}</span>` : '—'}</td>
          <td style="font-size:13px">${esc(p.phone||'—')}</td>
          <td><span class="chip ${p.status==='active'?'chip-green':'chip-red'}">${p.status||'active'}</span></td>
          <td><div style="display:flex;gap:6px">
            <button class="btn btn-flat btn-xs" onclick="viewPatient('${p.id}')">View Health</button>
            <button class="btn btn-primary btn-xs" onclick="openPrescribeModal('${p.id}','${esc(p.name)}')">Prescribe</button>
          </div></td>
        </tr>`).join('')}
      </tbody></table></div>`;
  } catch(e) { container.innerHTML = emptyState('⚠️', 'Could not load'); }
}

// ── View patient health data ──────────────────────────────────────
window.viewPatient = async function(patientId) {
  const modal = document.getElementById('modal-patient-detail');
  const body  = document.getElementById('patient-detail-body');
  if (!modal || !body) return;
  body.innerHTML = '<div class="loading-pulse"><div class="spinner"></div> Loading patient data…</div>';
  openModal('modal-patient-detail');
  try {
    const [patient, summary] = await Promise.all([
      API.get(`/users/${patientId}`),
      API.get(`/users/${patientId}/health-summary`),
    ]);
    const latest = summary.records[summary.records.length - 1];

    body.innerHTML = `
      <div class="profile-hero" style="margin-bottom:16px">
        <div class="profile-big-avatar">${initials(patient.name)}</div>
        <div class="profile-hero-info">
          <h2>${esc(patient.name)}</h2>
          <p>${esc(patient.email||'')} · ${esc(patient.phone||'')}</p>
          <div class="profile-chips">
            ${patient.bloodGroup ? `<span class="profile-chip">🩸 ${patient.bloodGroup}</span>` : ''}
            ${patient.age ? `<span class="profile-chip">Age ${patient.age}</span>` : ''}
            ${patient.gender ? `<span class="profile-chip">${patient.gender}</span>` : ''}
          </div>
        </div>
      </div>

      ${latest ? `
      <h4 style="font-size:14px;font-weight:700;color:var(--text-strong);margin-bottom:12px">Latest Vitals (${fmtDate(latest.date)})</h4>
      <div class="vitals-row" style="margin-bottom:20px">
        <div class="vital-tile"><span class="vt-icon">⚖️</span><div class="vt-value">${latest.weight||'—'}</div><div class="vt-unit">kg</div><div class="vt-label">Weight</div></div>
        <div class="vital-tile"><span class="vt-icon">🩺</span><div class="vt-value">${latest.bpSystolic?`${latest.bpSystolic}/${latest.bpDiastolic}`:'—'}</div><div class="vt-unit">mmHg</div><div class="vt-label">Blood Pressure</div></div>
        <div class="vital-tile"><span class="vt-icon">🩸</span><div class="vt-value">${latest.bloodSugar||'—'}</div><div class="vt-unit">mg/dL</div><div class="vt-label">Blood Sugar</div></div>
        <div class="vital-tile"><span class="vt-icon">❤️</span><div class="vt-value">${latest.heartRate||'—'}</div><div class="vt-unit">bpm</div><div class="vt-label">Heart Rate</div></div>
      </div>` : '<p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">No health records on file.</p>'}

      ${summary.prescriptions.length ? `
      <h4 style="font-size:14px;font-weight:700;color:var(--text-strong);margin-bottom:12px">Prescriptions (${summary.prescriptions.length})</h4>
      ${summary.prescriptions.slice(0,2).map(rx => `
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;margin-bottom:8px">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px">${esc(rx.diagnosis)} <span style="font-size:11px;color:var(--text-muted)">${fmtDate(rx.date)}</span></div>
          ${rx.medicines.map(m => `<div style="font-size:12.5px;color:var(--text-muted)">• ${esc(m.name)} — ${esc(m.dosage)}</div>`).join('')}
        </div>`).join('')}` : ''}

      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        <button class="btn btn-primary btn-sm" onclick="closeModal('modal-patient-detail'); openPrescribeModal('${patient.id}','${esc(patient.name)}')">+ Add Prescription</button>
      </div>`;
  } catch(e) { body.innerHTML = emptyState('⚠️', 'Could not load patient data'); }
};

// ── Prescriptions ─────────────────────────────────────────────────
async function loadDoctorPrescriptions() {
  const container = document.getElementById('doc-rx-list');
  if (!container) return;
  setLoading(container);
  try {
    const rxs = await API.get('/prescriptions');
    if (!rxs.length) { container.innerHTML = emptyState('📋', 'No prescriptions yet', 'Add prescriptions from the Patients tab'); return; }
    container.innerHTML = rxs.map(rx => `
      <div class="rx-card" style="margin-bottom:14px">
        <div class="rx-head">
          <div>
            <div class="rx-head-title">${esc(rx.diagnosis)}</div>
            <div class="rx-head-meta">👤 Patient ID: ${esc(rx.patientId)} · ${fmtDate(rx.date)}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <div class="rx-watermark">Rx</div>
            <button class="btn btn-xs" style="background:rgba(255,255,255,0.15);color:white;border:none" onclick="deleteDocRx('${rx.id}')">Delete</button>
          </div>
        </div>
        <div class="rx-body">
          ${rx.medicines.map(m => `
            <div class="rx-med-row">
              <div class="rx-med-name">${esc(m.name)}</div>
              <div class="rx-med-detail">${esc(m.dosage)} · ${esc(m.frequency)} · ${esc(m.duration)}</div>
            </div>`).join('')}
          ${rx.advice ? `<div class="rx-advice">💡 ${esc(rx.advice)}</div>` : ''}
          ${rx.followUp ? `<div style="font-size:12px;color:var(--text-muted);margin-top:8px">Follow-up: ${fmtDate(rx.followUp)}</div>` : ''}
        </div>
      </div>`).join('');
  } catch { container.innerHTML = emptyState('⚠️', 'Could not load'); }
}

window.deleteDocRx = async function(id) {
  if (!confirm('Delete this prescription?')) return;
  try {
    await API.delete(`/prescriptions/${id}`);
    toast('Prescription deleted', 'info');
    await loadDoctorPrescriptions();
  } catch(e) { toast(e.message, 'error'); }
};

// ── Prescribe modal ───────────────────────────────────────────────
let rxMedCount = 0;

function wirePrescriptionModal() {
  document.getElementById('btn-add-rx-med')?.addEventListener('click', () => {
    const container = document.getElementById('rx-med-rows');
    rxMedCount++;
    container.insertAdjacentHTML('beforeend', rxMedRow(rxMedCount));
  });

  document.getElementById('form-prescribe')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.classList.add('loading');
    try {
      const medicines = [];
      document.querySelectorAll('.rx-med-row').forEach(row => {
        const name = row.querySelector('.rxm-name')?.value;
        if (name) medicines.push({
          name,
          dosage:       row.querySelector('.rxm-dosage')?.value || '',
          frequency:    row.querySelector('.rxm-freq')?.value || '',
          duration:     row.querySelector('.rxm-dur')?.value || '',
          instructions: row.querySelector('.rxm-instr')?.value || '',
        });
      });
      if (!medicines.length) { toast('Add at least one medicine', 'error'); return; }
      await API.post('/prescriptions', {
        patientId: document.getElementById('rx-patient-id').value,
        diagnosis: document.getElementById('rx-diagnosis').value,
        advice:    document.getElementById('rx-advice').value,
        followUp:  document.getElementById('rx-followup').value,
        medicines,
      });
      closeModal('modal-prescribe');
      e.target.reset();
      document.getElementById('rx-med-rows').innerHTML = rxMedRow(0);
      rxMedCount = 0;
      toast('Prescription saved & added to patient tracker!', 'success');
      await loadDoctorStats();
      if (document.getElementById('v-prescriptions')?.classList.contains('active')) await loadDoctorPrescriptions();
    } catch(err) { toast(err.message, 'error'); }
    finally { btn.classList.remove('loading'); }
  });
}

function rxMedRow(idx) {
  return `<div class="rx-med-row" id="rx-row-${idx}" style="display:grid;grid-template-columns:2fr 1fr 1.5fr 1fr;gap:8px;margin-bottom:8px">
    <input class="field-raw rxm-name" placeholder="Medicine name *" style="font-size:13px">
    <input class="field-raw rxm-dosage" placeholder="Dosage" style="font-size:13px">
    <input class="field-raw rxm-freq" placeholder="Frequency" style="font-size:13px">
    <input class="field-raw rxm-dur" placeholder="Duration" style="font-size:13px">
  </div>`;
}

window.openPrescribeModal = function(patientId, patientName) {
  document.getElementById('rx-patient-id').value = patientId;
  document.getElementById('rx-patient-name').textContent = patientName;
  document.getElementById('rx-med-rows').innerHTML = rxMedRow(0);
  rxMedCount = 0;
  openModal('modal-prescribe');
};

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}
