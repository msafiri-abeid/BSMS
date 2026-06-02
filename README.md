# Bentabet Slot Management System

Web application for Bentabet Ltd — managing slot machine operations, collections, finance, inventory, ticketing, staff, and reporting across multiple shops in Tanzania.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express.js |
| Database | MySQL 8 + Sequelize ORM |
| Frontend | React 18 + Vite + Ant Design 5 |
| State | TanStack Query + Zustand |
| Auth | JWT (15min) + Refresh tokens (7 days) + bcrypt |
| Real-time | Socket.io (ticket dashboard) |
| File storage | Multer + Cloudinary |
| OCR | Google Vision API |
| SMS | Beem Africa API |
| Scheduler | node-cron |
| Validation | Zod (frontend + backend) |
| Reports | ExcelJS + PDFKit |

---

## Project Structure

```
bentabet/
├── backend/
│   ├── config/          database.js, constants.js
│   ├── controllers/     Thin — parse req, call service, respond
│   ├── services/        All business logic
│   ├── models/          Sequelize model definitions + associations
│   ├── middleware/      auth.js, upload.js, validate.js
│   ├── routes/          Express routers (all in routes/index.js)
│   ├── jobs/            node-cron scheduled tasks
│   ├── sockets/         Socket.io event handlers
│   ├── app.js           Express app setup
│   └── server.js        HTTP + Socket.io server + DB sync + seed
└── frontend/
    └── src/
        ├── pages/       One component per module
        ├── components/  Shared UI (MainLayout)
        ├── store/       Zustand auth store
        ├── services/    Axios API helpers
        └── socket.js    Socket.io client
```

---

## Prerequisites

- Node.js 18+
- MySQL 8
- Cloudinary account (for file uploads)
- Beem Africa account (for SMS)
- Google Cloud project with Vision API enabled (for OCR)

---

## Setup — Backend

```bash
cd backend
npm install

# Create the MySQL database
mysql -u root -p -e "CREATE DATABASE bentabet_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Start the server (auto-syncs models and seeds defaults in development)
npm run dev
```

Server runs on `http://localhost:5000`

---

## Setup — Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies `/api` and `/socket.io` to the backend.

---

## Default Admin Login

| Field | Value |
|---|---|
| Email | `admin@bentabet.co.tz` |
| Password | `Admin@1234` |


---

## Environment Variables (backend/.env)

```env
NODE_ENV=development
PORT=5000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=bentabet_db
DB_USER=root
DB_PASSWORD=yourpassword

# JWT
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Beem Africa SMS
BEEM_API_KEY=...
BEEM_SECRET=...
BEEM_SENDER_NAME=BENTABET

# Google Cloud Vision (OCR)
GOOGLE_APPLICATION_CREDENTIALS=./google-vision-key.json
GOOGLE_CLOUD_PROJECT=your-project-id
```

---

## Key Business Rules

### Machine Types & Collection Calculation

**Meteora / EGT (physical tokens)**
```
Difference = Current reading − Previous reading
Gross TZS  = Difference × credit_value_tzs
Office TZS = min(Gross, Weekly target)
Owner TZS  = max(0, Gross − Weekly target)
```

**Novomatic (controller credits)**
```
Net TZS    = Total IN − Total OUT  (from Master Accounting screen)
Office TZS = min(Net, Weekly target)
Owner TZS  = max(0, Net − Weekly target)
```

### Weekly Target
- Default: **120,000 TZS per machine per week** (configurable in Settings)
- Office receives the weekly target amount first
- Remainder goes to the shop/partner owner
- node-cron checks every Sunday at 23:00 and sends SMS alerts for unmet targets

### Role Access
| Role | Access |
|---|---|
| Admin | Full system access |
| General Manager | All modules read/write (no system settings) |
| Director | Read-only dashboard and reports |
| Operations Manager | Machines, shops, collections, tickets, inventory |
| Finance | Finance module full + reports |
| Sales | Partners, shops, reports |
| Collector | Own daily assignments only |
| Technician | Tickets + machine read |

### Collector Scope
Collectors can only see their own assigned machines for the current day. They cannot view other collectors' assignments or collections.

---

## API Endpoints Reference

### Auth
```
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
PUT  /api/auth/password
```

### Partners & Shops
```
GET|POST       /api/partners
PUT            /api/partners/:id
GET|POST       /api/shops
PUT            /api/shops/:id
```

### Machines
```
GET|POST       /api/machines
GET|PUT        /api/machines/:id
POST           /api/machines/:id/deploy
POST           /api/machines/:id/exchange
POST           /api/machines/:id/refill
```

### Collections
```
GET|POST       /api/collections
POST           /api/collections/ocr
GET            /api/collections/my-assignments
POST           /api/collections/assignments
GET            /api/collections/weekly-targets
```

### Finance
```
GET|POST       /api/finance/expenses
GET            /api/finance/expenses/pending
PUT            /api/finance/expenses/:id/approve
GET|POST       /api/finance/invoices
GET            /api/finance/invoices/:id/pdf
POST           /api/finance/invoices/:id/payment
GET|POST       /api/finance/payroll
GET            /api/finance/export/collections
```

### Tickets
```
GET|POST       /api/tickets
GET            /api/tickets/counts
GET            /api/tickets/groups
GET            /api/tickets/:id
PUT            /api/tickets/:id/status
POST           /api/tickets/:id/activity
```

### Settings
```
GET|PUT        /api/settings
GET|POST       /api/settings/roles
PUT            /api/settings/roles/:roleId/permissions
POST           /api/settings/sms-test
```

### Dashboards
```
GET /api/dashboard/admin
GET /api/dashboard/collector
GET /api/dashboard/finance
GET /api/dashboard/director
```

---

## Scheduled Jobs (node-cron)

| Schedule | Job |
|---|---|
| Every Sunday 23:00 | Check weekly targets, mark met/unmet, SMS Operations Manager |
| Every 30 minutes | Check SLA breaches, SMS Operations Manager |
| Daily 08:00 | Count pending expenses, SMS Finance officer |
| Daily 09:00 | Check token stock level, SMS if below threshold |

---

## Socket.io Events

| Event | Direction | Description |
|---|---|---|
| `join:tickets` | Client → Server | Subscribe to ticket room |
| `ticket:update` | Server → Client | New ticket or status change |
| `ticket:activity` | Server → Client | New activity on a ticket |
| `ticket:counts` | Server → Client | Updated dashboard counts |
| `request:counts` | Client → Server | Request current counts |

---

## OCR Configuration

```env
GOOGLE_APPLICATION_CREDENTIALS=./google-vision-key.json
```

The OCR service supports:
- **Meteora/EGT**: Reads the CREDIT counter number from a board photo
- **Novomatic**: Reads TOTAL IN and TOTAL OUT from the Master Accounting screen

If OCR confidence < 0.8, the form flags values for manual confirmation — the collector must verify before submitting.

---

## Currency

All monetary amounts are stored and processed as **integers in TZS** (Tanzanian Shillings). No decimal values. The system displays amounts formatted with `.toLocaleString()` for readability.
 | ExcelJS + PDFKit |