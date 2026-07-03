# Bentabet Slot Management System

Web application for Bentabet Ltd — managing slot machine operations, collections, sales, finance, inventory, ticketing, staff, and reporting across multiple slot shops in Tanzania.

---

## 🚀 Production Deployment

See **[deploy/production-checklist.md](deploy/production-checklist.md)** for the full step-by-step deployment guide.

**Quick start on a VPS:**
```bash
# Server setup
apt install -y nginx mysql-server-8.0 certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && apt install -y nodejs
npm install -g pm2

# App setup
cd /opt/bentabet
cd backend && npm install --production
cd ../frontend && npm install && npm run build
cd ../backend && pm2 start ecosystem.config.js

# SSL
certbot --nginx -d yourdomain.com
```

**Database backups** — see [BACKUP_GUIDE.md](BACKUP_GUIDE.md) for automated daily dumps with off-site sync and point-in-time recovery.

| File | Purpose |
|---|---|
| `deploy/nginx-bentabet.conf` | nginx config with SSL, WebSocket, rate limiting |
| `backend/ecosystem.config.js` | PM2 cluster mode config |
| `backend/scripts/backup-db.sh` | Linux backup script |
| `backend/scripts/backup-db.ps1` | Windows backup script |
| `BACKUP_GUIDE.md` | Full backup & restore documentation |

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

### Token Debts
- Machine debts are always **token debts** (type = `token`)
- Auto-created on machine deployment when `tokens_paid = false`
- Collections first meet the office weekly target, then remaining amount repays outstanding token debts in FIFO order, then remainder goes to shop owner
- No auto-commission debts from owner share
- Debt payments require Operations Manager approval with a receipt attachment uploaded to Cloudinary

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
PUT|DELETE     /api/partners/:id
GET|POST       /api/shops
PUT|DELETE     /api/shops/:id
GET            /api/regions
GET            /api/wards?region_id=X
GET            /api/streets?ward_id=X
```

**Address hierarchy**: Country → Region (select) → Ward (cascading select, filtered by region) → Street (cascading select, filtered by ward). Uses `wards` and `streets` DB tables with FK references.

**Multi-document upload**: Partners and Shops support drag-and-drop upload of multiple documents (contracts, letters, agreements) — PDF, JPG, PNG, WebP, DOC, DOCX, XLS, XLSX. Stored as JSON array in the `documents` field on each model.

### Inventory (POS / Bar Stock)
```
GET|POST       /api/inventory/products
GET            /api/inventory/categories
POST           /api/inventory/stock/add
GET|POST       /api/inventory/sales
POST           /api/inventory/sales/:id/payment
GET            /api/inventory/sales/report/summary
GET|POST       /api/inventory/audits
PUT            /api/inventory/audits/item
PUT            /api/inventory/audits/:id/complete|verify
GET|POST       /api/inventory/transfers
PUT            /api/inventory/transfers/:id/approve|receive|cancel
GET|POST       /api/inventory/returns
GET|POST       /api/inventory/alerts
PUT            /api/inventory/alerts/:id/acknowledge
GET            /api/inventory/accounting/profit-loss|margins|valuation|daily-report
```

### Machines
```
GET|POST       /api/machines
GET|PUT        /api/machines/:id
POST           /api/machines/:id/deploy
POST           /api/machines/:id/exchange
POST           /api/machines/:id/refill
GET            /api/machines/:id/pdf
POST           /api/machines/:id/collections
```

### Collections
```
GET|POST       /api/collections
POST           /api/collections/ocr
GET            /api/collections/my-assignments
GET|POST       /api/collections/assignments
PUT|DELETE     /api/collections/assignments/:id
POST           /api/collections/assignments/:id/open
GET            /api/collections/assignments/export
GET            /api/collections/weekly-targets
```
Collections list response includes `debt_outstanding_tzs` and `debt_id` computed fields from outstanding MachineDebt records.

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

### Debts
```
GET|POST       /api/debts
PUT            /api/debts/:id/pay
PUT            /api/debts/:id/write-off
GET            /api/debts/export
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
GET /api/dashboard/admin       # ?shop_id=&date_from=&date_to=
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