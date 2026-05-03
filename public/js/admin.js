/* ================================================================
   HealthMS — Admin Dashboard
   ================================================================ */

'use strict';

let adminCharts = {};

async function initAdmin() {
  const user = Session.user();
  if (!user || user.role !== 'admin') { window.location.href = '/'; return; }

  Theme.init();
  fillSidebarProfile(user);
  initNav();
  navigateTo('overview');

  await loadAdminStats();

  document.querySelectorAll('.nav-link[data-view]').forEach(link => {
    link.addEventListener('click', async () => {
      const v = link.dataset.view;
      if (v === 'users')        await loadAdminUsers();
      if (v === 'appointments') await loadAdminAppointments();
    });
  });

  wireAddUserModal();
  wireEditUserModal();
}

// ── Stats & charts ────────────────────────────────────────────────
async function loadAdminStats() {
  try {
    const s = await API.get('/stats/overview');

    setValue('adm-kpi-patients',    s.users.patients);
    setValue('adm-kpi-doctors',     s.users.doctors);
    setValue('adm-kpi-appts',       s.appointments.total);
    setValue('adm-kpi-today',       s.appointments.today);
    setValue('adm-kpi-pending',     s.appointments.pending);
    setValue('adm-kpi-records',     s.healthRecords.total);

    if (typeof Chart === 'undefined') return;
    const fontOpts = { font: { family: 'Instrument Sans', size: 12 } };

    // User distribution doughnut
    const pieCtx = document.getElementById('adm-chart-users');
    if (pieCtx) {
      if (adminCharts.pie) adminCharts.pie.destroy();
      adminCharts.pie = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
          labels: ['Patients', 'Doctors', 'Admins'],
          datasets: [{
            data: [s.users.patients, s.users.doctors, s.users.admins],
            backgroundColor: ['#0066FF', '#00875A', '#6554C0'],
            borderWidth: 0, hoverOffset: 6,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '68%',
          plugins: { legend: { position: 'bottom', labels: { ...fontOpts, padding: 16, boxWidth: 12 } } },
        }
      });
    }

    // Appointment status bar
    const barCtx = document.getElementById('adm-chart-appts');
    if (barCtx) {
      if (adminCharts.bar) adminCharts.bar.destroy();
      adminCharts.bar = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
          datasets: [{
            label: 'Appointments',
            data: [s.appointments.pending, s.appointments.confirmed, s.appointments.completed, s.appointments.cancelled],
            backgroundColor: ['#FF8B00','#00875A','#6B778C','#DE350B'],
            borderRadius: 6, borderSkipped: false,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: fontOpts },
            y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.08)' }, ticks: fontOpts },
          }
        }
      });
    }

    // Trend line
    const trendCtx = document.getElementById('adm-chart-trend');
    if (trendCtx) {
      if (adminCharts.trend) adminCharts.trend.destroy();
      adminCharts.trend = new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: s.trend.map(d => d.label),
          datasets: [{
            label: 'Appointments',
            data: s.trend.map(d => d.count),
            borderColor: '#0066FF',
            backgroundColor: 'rgba(0,102,255,0.08)',
            fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#0066FF',
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: fontOpts },
            y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.08)' }, ticks: { ...fontOpts, stepSize: 1 } },
          }
        }
      });
    }
  } catch(e) { toast(e.message, 'error'); }
}

// ── Users ─────────────────────────────────────────────────────────
async function loadAdminUsers() {
  const container = document.getElementById('adm-users-list');
  if (!container) return;
  setLoading(container);
  try {
    const filterRole = document.getElementById('adm-user-role-filter')?.value || 'all';
    const search     = document.getElementById('adm-user-search')?.value?.toLowerCase() || '';
    const url = filterRole !== 'all' ? `/users?role=${filterRole}&search=${encodeURIComponent(search)}` : `/users?search=${encodeURIComponent(search)}`;
    const users = await API.get(url);

    if (!users.length) { container.innerHTML = emptyState('👥', 'No users found'); return; }
    container.innerHTML = `<div class="tbl-wrap"><table>
      <thead><tr><th>User</th><th>Username</th><th>Role</th><th>Contact</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${users.map(u => `
        <tr>
          <td><div class="user-cell">
            <div class="mini-avatar ${u.role==='doctor'?'green':u.role==='admin'?'violet':''}">${initials(u.name)}</div>
            <div><div class="user-cell-name">${esc(u.name)}</div><div class="user-cell-sub">${esc(u.email||'')}</div></div>
          </div></td>
          <td><code>${esc(u.username)}</code></td>
          <td><span class="chip ${u.role==='doctor'?'chip-green':u.role==='admin'?'chip-violet':'chip-blue'}">${u.role}</span></td>
          <td style="font-size:13px">${esc(u.phone||'—')}</td>
          <td style="font-size:12px;color:var(--text-muted)">${fmtDate(u.createdAt)}</td>
          <td><span class="chip ${u.status==='active'?'chip-green':'chip-red'}">${u.status||'active'}</span></td>
          <td><div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-xs" onclick="openEditUser('${u.id}')">Edit</button>
            ${u.id !== Session.user()?.id ? `<button class="btn btn-danger btn-xs" onclick="deleteUser('${u.id}','${esc(u.name)}')">Delete</button>` : '<span style="font-size:11px;color:var(--text-faint)">You</span>'}
          </div></td>
        </tr>`).join('')}
      </tbody></table></div>`;
  } catch(e) { container.innerHTML = emptyState('⚠️', 'Could not load users'); }
}

window.deleteUser = async function(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await API.delete(`/users/${id}`);
    toast('User deleted', 'info');
    await loadAdminUsers();
    await loadAdminStats();
  } catch(e) { toast(e.message, 'error'); }
};

// ── Add user ──────────────────────────────────────────────────────
function wireAddUserModal() {
  document.getElementById('btn-add-user')?.addEventListener('click', () => openModal('modal-add-user'));

  document.getElementById('new-user-role')?.addEventListener('change', function() {
    const specRow = document.getElementById('spec-row');
    const ageRow  = document.getElementById('age-row');
    if (specRow) specRow.style.display = this.value === 'doctor' ? 'grid' : 'none';
    if (ageRow)  ageRow.style.display  = this.value === 'patient' ? 'grid' : 'none';
  });

  document.getElementById('form-add-user')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.classList.add('loading');
    try {
      await API.post('/users', {
        name:           document.getElementById('new-user-name').value,
        username:       document.getElementById('new-user-username').value,
        password:       document.getElementById('new-user-password').value,
        email:          document.getElementById('new-user-email').value,
        phone:          document.getElementById('new-user-phone').value,
        role:           document.getElementById('new-user-role').value,
        specialization: document.getElementById('new-user-spec')?.value || '',
        qualification:  document.getElementById('new-user-qual')?.value || '',
        age:            document.getElementById('new-user-age')?.value || null,
        bloodGroup:     document.getElementById('new-user-bg')?.value || '',
        gender:         document.getElementById('new-user-gender')?.value || '',
      });
      closeModal('modal-add-user');
      e.target.reset();
      toast('User created!', 'success');
      await loadAdminUsers();
      await loadAdminStats();
    } catch(err) { toast(err.message, 'error'); }
    finally { btn.classList.remove('loading'); }
  });
}

// ── Edit user ─────────────────────────────────────────────────────
window.openEditUser = async function(id) {
  try {
    const user = await API.get(`/users/${id}`);
    document.getElementById('edit-user-id').value = id;
    document.getElementById('edit-user-name').value   = user.name || '';
    document.getElementById('edit-user-email').value  = user.email || '';
    document.getElementById('edit-user-phone').value  = user.phone || '';
    document.getElementById('edit-user-status').value = user.status || 'active';
    document.getElementById('edit-user-spec').value   = user.specialization || '';
    openModal('modal-edit-user');
  } catch(e) { toast(e.message, 'error'); }
};

function wireEditUserModal() {
  document.getElementById('form-edit-user')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id  = document.getElementById('edit-user-id').value;
    const btn = e.target.querySelector('[type=submit]');
    btn.classList.add('loading');
    try {
      await API.patch(`/users/${id}`, {
        name:           document.getElementById('edit-user-name').value,
        email:          document.getElementById('edit-user-email').value,
        phone:          document.getElementById('edit-user-phone').value,
        status:         document.getElementById('edit-user-status').value,
        specialization: document.getElementById('edit-user-spec').value,
      });
      closeModal('modal-edit-user');
      toast('User updated!', 'success');
      await loadAdminUsers();
    } catch(err) { toast(err.message, 'error'); }
    finally { btn.classList.remove('loading'); }
  });
}

// ── Appointments ──────────────────────────────────────────────────
async function loadAdminAppointments() {
  const container = document.getElementById('adm-appts-list');
  if (!container) return;
  setLoading(container);
  try {
    const filterVal = document.getElementById('adm-appt-filter')?.value || 'all';
    const search    = document.getElementById('adm-appt-search')?.value?.toLowerCase() || '';
    const url = filterVal !== 'all' ? `/appointments?status=${filterVal}&search=${encodeURIComponent(search)}` : `/appointments?search=${encodeURIComponent(search)}`;
    const appts = await API.get(url);

    if (!appts.length) { container.innerHTML = emptyState('📅', 'No appointments found'); return; }
    container.innerHTML = `<div class="tbl-wrap"><table>
      <thead><tr><th>Patient</th><th>Doctor</th><th>Date & Time</th><th>Reason</th><th>Status</th><th>Priority</th><th>Actions</th></tr></thead>
      <tbody>${appts.map(a => `
        <tr>
          <td>${esc(a.patientName)}</td>
          <td><div><div style="font-weight:600;font-size:13px">${esc(a.doctorName)}</div><div style="font-size:11.5px;color:var(--text-muted)">${esc(a.specialization||'')}</div></div></td>
          <td><strong>${fmtDate(a.date)}</strong><br><span style="font-size:12px;color:var(--text-muted)">${a.time}</span></td>
          <td style="max-width:200px;font-size:13px">${esc(a.reason)}</td>
          <td>${chipStatus(a.status)}</td>
          <td><span class="chip ${a.priority==='high'?'chip-red':'chip-gray'}">${a.priority||'normal'}</span></td>
          <td><button class="btn btn-danger btn-xs" onclick="admDeleteAppt('${a.id}')">Delete</button></td>
        </tr>`).join('')}
      </tbody></table></div>`;
  } catch(e) { container.innerHTML = emptyState('⚠️', 'Could not load'); }
}

window.admDeleteAppt = async function(id) {
  if (!confirm('Permanently delete this appointment?')) return;
  try {
    await API.delete(`/appointments/${id}`);
    toast('Appointment deleted', 'info');
    await loadAdminAppointments();
    await loadAdminStats();
  } catch(e) { toast(e.message, 'error'); }
};

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}
