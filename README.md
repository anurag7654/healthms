# 🏥 HealthMS — Full-Stack Health Management System

A complete, professional health management application built with **Node.js + Express** backend and vanilla JS frontend.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open browser
open http://localhost:3000
```

---

## 🔐 Demo Accounts

| Role    | Username     | Password  |
|---------|-------------|-----------|
| Patient | `john.doe`  | `pat123`  |
| Patient | `emma.wilson` | `pat123` |
| Patient | `raj.kumar` | `pat123`  |
| Doctor  | `dr.patel`  | `doc123`  |
| Doctor  | `dr.chen`   | `doc123`  |
| Doctor  | `dr.okafor` | `doc123`  |
| Admin   | `admin`     | `admin123`|

---

## 🏗️ Architecture

```
healthms/
├── server/
│   ├── index.js          ← Express app entry point
│   ├── db.js             ← lowdb JSON database layer
│   ├── middleware/
│   │   └── auth.js       ← JWT auth middleware
│   └── routes/
│       ├── auth.js       ← Login, register, profile
│       ├── users.js      ← User CRUD (admin)
│       ├── appointments.js
│       ├── health.js     ← Health records
│       ├── prescriptions.js
│       ├── medicines.js  ← Medicine tracker
│       └── stats.js      ← Analytics endpoints
├── public/
│   ├── index.html        ← Login page
│   ├── patient.html      ← Patient dashboard
│   ├── doctor.html       ← Doctor dashboard
│   ├── admin.html        ← Admin dashboard
│   ├── css/app.css       ← Full design system
│   └── js/
│       ├── core.js       ← API client, session, utilities
│       ├── patient.js    ← Patient logic
│       ├── doctor.js     ← Doctor logic
│       └── admin.js      ← Admin logic
└── data/
    └── db.json           ← Auto-generated JSON database
```

---

## 🔌 REST API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login → returns JWT |
| POST | `/api/auth/register` | Self-register (patient) |
| GET  | `/api/auth/me` | Get current user |
| PATCH | `/api/auth/me` | Update profile |
| PATCH | `/api/auth/password` | Change password |

### Users (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/users` | List users (filterable) |
| GET  | `/api/users/:id` | Get user by ID |
| POST | `/api/users` | Create user |
| PATCH | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |
| GET | `/api/users/:id/health-summary` | Patient health data |

### Appointments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/appointments` | List (scoped by role) |
| POST | `/api/appointments` | Book appointment |
| PATCH | `/api/appointments/:id` | Update status/notes |
| DELETE | `/api/appointments/:id` | Delete (admin only) |

### Health Records
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/health` | Get patient records |
| POST | `/api/health` | Add record |
| DELETE | `/api/health/:id` | Delete record |

### Prescriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/prescriptions` | List prescriptions |
| POST | `/api/prescriptions` | Create (doctor only) |
| DELETE | `/api/prescriptions/:id` | Delete |

### Medicines
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/medicines` | List medicines |
| POST | `/api/medicines` | Add medicine |
| PATCH | `/api/medicines/:id` | Mark taken / update |
| DELETE | `/api/medicines/:id` | Remove |
| POST | `/api/medicines/reset-daily` | Reset taken flags |

### Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats/overview` | Admin analytics |
| GET | `/api/stats/doctor` | Doctor stats |
| GET | `/api/stats/patient` | Patient stats |

---

## ✨ Features

### Patient Dashboard
- 📊 KPI cards with live API data
- 🩺 Latest vitals display with health status assessment
- 📅 Book / view / cancel appointments
- 💊 Medicine tracker with streak counter & adherence %
- 📋 Full health records CRUD with table view
- 📈 4 analytics charts (weight, BP, sugar, heart rate)
- 📄 Prescriptions view with Rx card design
- 🔍 Rule-based symptom checker (10 conditions)
- 👤 Profile editor with password change
- 📄 PDF health report download (jsPDF)

### Doctor Dashboard
- 📊 Practice KPIs from real API
- ✅ Confirm / complete / cancel appointments
- 📝 Clinical notes per appointment
- 👥 Patient list with health data viewer
- 📋 Full prescription writer (multi-medicine)
- 🔍 Search & filter across all views

### Admin Dashboard
- 📈 System-wide stats + 3 Chart.js visualizations
- 👥 Full user CRUD with role management
- 📅 System-wide appointment view & deletion
- 🔍 Real-time search & filter

### Technical
- 🔐 JWT authentication with 24h expiry
- 🔒 Bcrypt password hashing
- 🛡️ Role-based access control on all endpoints
- 🌙 Dark/light mode (persisted)
- 📱 Fully responsive (mobile sidebar)
- 💾 JSON file database (lowdb) — no external DB needed
- 🚀 No build step required

---

## 🎨 Design System

- **Fonts:** Bricolage Grotesque (display) + Instrument Sans (body)
- **Aesthetic:** Luxury Clinical — refined, professional, precise
- **Colors:** Semantic token system with full dark mode support
- **Components:** Cards, chips, modals, toasts, tables, charts
