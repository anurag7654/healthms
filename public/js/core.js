/* ================================================================
   HealthMS — API Client + Core Utilities
   ================================================================ */

'use strict';

// ── API Client ────────────────────────────────────────────────────
const API = {
  base: '/api',

  _token() { return localStorage.getItem('hms_token'); },

  async req(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const tok = this._token();
    if (tok) opts.headers['Authorization'] = `Bearer ${tok}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(this.base + path, opts);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  get(path)           { return this.req('GET', path); },
  post(path, body)    { return this.req('POST', path, body); },
  patch(path, body)   { return this.req('PATCH', path, body); },
  delete(path)        { return this.req('DELETE', path); },
};

// ── Session ───────────────────────────────────────────────────────
const Session = {
  save(token, user) {
    localStorage.setItem('hms_token', token);
    localStorage.setItem('hms_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('hms_token');
    localStorage.removeItem('hms_user');
  },
  user()  { try { return JSON.parse(localStorage.getItem('hms_user')); } catch { return null; } },
  token() { return localStorage.getItem('hms_token'); },
  valid() { return !!(this.token() && this.user()); },
};

// ── Theme ─────────────────────────────────────────────────────────
const Theme = {
  init() {
    const t = localStorage.getItem('hms_theme') || 'light';
    this.apply(t);
    document.querySelectorAll('.sw-track').forEach(el => el.classList.toggle('on', t === 'dark'));
  },
  toggle() {
    const cur = localStorage.getItem('hms_theme') || 'light';
    const next = cur === 'light' ? 'dark' : 'light';
    this.apply(next);
    localStorage.setItem('hms_theme', next);
    document.querySelectorAll('.sw-track').forEach(el => el.classList.toggle('on', next === 'dark'));
  },
  apply(t) { document.documentElement.setAttribute('data-theme', t); },
};

// ── Toast ─────────────────────────────────────────────────────────
function toast(msg, type = 'info', dur = 3500) {
  let root = document.getElementById('toast-root');
  if (!root) { root = document.createElement('div'); root.id = 'toast-root'; document.body.appendChild(root); }
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span class="toast-msg">${esc(msg)}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.style.animation = 'toast-out 0.3s ease forwards'; setTimeout(() => el.remove(), 300); }, dur);
}

// ── Modal helpers ─────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}

// ── Utilities ─────────────────────────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}

function initials(name = '') {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtShortDate(d) {
  if (!d) return { day: '—', month: '—' };
  const dt = new Date(d);
  return { day: dt.getDate(), month: dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() };
}

function chipStatus(status) {
  const map = {
    pending: 'chip-amber', confirmed: 'chip-green',
    completed: 'chip-gray', cancelled: 'chip-red', active: 'chip-green',
  };
  return `<span class="chip ${map[status] || 'chip-gray'}">${status}</span>`;
}

function today() { return new Date().toISOString().split('T')[0]; }

// Nav wiring
function initNav() {
  document.querySelectorAll('.nav-link[data-view]').forEach(link => {
    link.addEventListener('click', () => {
      const vid = link.dataset.view;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      const target = document.getElementById('v-' + vid);
      if (target) target.classList.add('active');
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const titleEl = document.getElementById('topbar-title');
      if (titleEl) titleEl.textContent = link.querySelector('.nav-label')?.textContent || '';
      // mobile close
      document.querySelector('.sidebar')?.classList.remove('open');
      document.querySelector('.mob-overlay')?.classList.remove('show');
    });
  });

  // mobile hamburger
  document.querySelector('.hamburger')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
    document.querySelector('.mob-overlay')?.classList.toggle('show');
  });
  document.querySelector('.mob-overlay')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('.mob-overlay')?.classList.remove('show');
  });

  // modal close
  document.querySelectorAll('.modal-close-btn, [data-close]').forEach(b => {
    b.addEventListener('click', () => {
      b.closest('.modal-backdrop')?.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', e => {
      if (e.target === bd) { bd.classList.remove('open'); document.body.style.overflow = ''; }
    });
  });

  // logout
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    if (confirm('Sign out of HealthMS?')) { Session.clear(); window.location.href = '/'; }
  });

  // theme
  document.querySelectorAll('.theme-toggle-btn').forEach(b => {
    b.addEventListener('click', () => Theme.toggle());
  });
}

function navigateTo(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('v-' + viewId);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const link = document.querySelector(`.nav-link[data-view="${viewId}"]`);
  if (link) link.classList.add('active');
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = link?.querySelector('.nav-label')?.textContent || '';
}

// Fill sidebar profile
function fillSidebarProfile(user) {
  const avatarClass = user.role === 'doctor' ? 'green' : user.role === 'admin' ? 'violet' : '';
  const el = document.getElementById('sb-avatar');
  const nameEl = document.getElementById('sb-name');
  const roleEl = document.getElementById('sb-role');
  if (el) { el.textContent = initials(user.name); el.className = `sidebar-avatar ${avatarClass}`; }
  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = user.specialization || user.role.charAt(0).toUpperCase() + user.role.slice(1);
}

// Loading state
function setLoading(el, msg = 'Loading…') {
  if (!el) return;
  el.innerHTML = `<div class="loading-pulse"><div class="spinner"></div> ${msg}</div>`;
}

function emptyState(icon, title, desc = '') {
  return `<div class="empty-state"><div class="es-icon">${icon}</div><h4>${title}</h4>${desc ? `<p>${desc}</p>` : ''}</div>`;
}
