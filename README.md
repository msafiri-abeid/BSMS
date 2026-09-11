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
| File storage | Multer + local disk (`backend/uploads/`) |
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
- Storage directory created automatically (`backend/uploads/`)
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

# Uploads directory (relative to backend/)
UPLOAD_DIR=./uploads

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
| Finance | Finance module full + reports + accounts (read/create/update) + collections read + Meteora assignments (create/edit) + weekly targets + machines read + Meteora machines + machine debts (create/pay/write-off) + partners + shops (create/edit, no delete) + collection record edits + tickets + users read |
| Sales | Partners, shops, reports |
| Collector | Own daily assignments only |
| Technician | Tickets + machine read |

### Token Debts
- Machine debts are always **token debts** (type = `token`)
- Auto-created on machine deployment when `tokens_paid = false`
- Collections first meet the office weekly target, then remaining amount repays outstanding token debts in FIFO order, then remainder goes to shop owner
- No auto-commission debts from owner share
- Debt payments require Operations Manager approval with a receipt attachment stored on local disk (`backend/uploads/receipts/`)

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

### Inventory (POS / Bar Stock / Kitchen Stock)
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

### Kitchen Stock (multi-restaurant daily ledger)
```
GET|POST       /api/inventory/locations
PUT|DELETE     /api/inventory/locations/:id
GET|POST       /api/inventory/kitchen/items
PUT            /api/inventory/kitchen/items/:id
DELETE         /api/inventory/kitchen/items/:id    # soft-deletes a catalog item (is_active=false), keeps history — inventory:delete
GET|POST       /api/inventory/kitchen/entries        # ?location_id (required), ?date (default today)
PUT            /api/inventory/kitchen/entries/:id
DELETE         /api/inventory/kitchen/entries/:id    # hard-deletes that day's row (owner-scoped, inventory:update)
POST           /api/inventory/kitchen/quick-adjust   # { location_id, item_id, type: received|sold|spoiled, adjustment, entry_date, expiry_date? }
GET            /api/inventory/kitchen/restock-list   # ?location_id, ?date — items at/below min_threshold
GET            /api/inventory/kitchen/restock/pdf    # ?location_id — server-side PDF (replaces CSV)
GET            /api/inventory/kitchen/stats          # KPI counts + active location count
GET            /api/inventory/kitchen/export         # Excel workbook matching the daily sheet layout
```

**Kitchen Stock business rules**: `Closing = Opening + Received − Sold − Spoiled`; `Shot = Physical Count − Closing`. Opening stock auto-carries from the previous day's closing per item. Physical count is optional; variance (shot) is auto-computed when entered. `/entries` returns a merged per-item list (items without an entry get a pre-filled row with opening carried over), and `POST /entries` upserts all rows in bulk (`findOrCreate` on `location_id + item_id + entry_date`). Empty `expiry_date` falls back to the most recent prior entry's expiry (received-lot expiry per item). `DELETE /entries/:id` uses the `inventory:update` permission (not delete) so the Stock Manager — who has no `inventory:delete` — can still remove their **own** day's rows (ownership enforced by `created_by`; Admin/GM/Ops/Finance/Sales bypass). `DELETE /items/:id` is a soft delete (`is_active=false`) gated by `inventory:delete` (Admin/GM/Ops only — Stock Manager has no delete). Categories: meats_proteins, perishables, staples, seasonings, consumables, beverages, other. Units: portions, kg, qty, packs, bottles, liters, boxes, bags. Low stock = closing ≤ item min_threshold. Seeded locations: `Dante26 Main Kitchen` (DANTE26), `Dante26 Branch B` (BRANCH-B). Seeded catalog: 41 items in `backend/config/constants.js` `KITCHEN_SEED_ITEMS`.

The Daily Entry tab is a minimal Item Name / Stock Level / Actions table: clicking an item name opens an edit popup (received/sold/spoiled/physical count/expiry/notes), clicking the clickable Stock Level pill opens a +/− popup (red **Consume**, green **Add** → `quickAdjust`), and the 3-dot menu offers Edit Entry plus Delete Entry (`inventory:update`, own rows only). Mobile cards show Category / Stock Level / Expiry with Add/Consume buttons. The Stock Overview tab adds an **Expiry** column (red when past today) and a 3-dot **Delete Item** action (soft-deactivate, Admin/GM/Ops). The top-level **Restock** button quick-adds a quantity with an optional received-batch **Expiry** date.

**Stock Manager role**: inventory read/create/update only — no delete, and the sidebar Inventory group shows **Kitchen Stock only** (all POS/bar submodules are hidden for this role only; pages/routes remain for Admin/GM/Ops/Sales). Can view every location but can only edit/delete entries they created themselves (`created_by == own user id`, enforced in `kitchenStock.controller.js`).

**Stock Manager dashboard**: `GET /api/dashboard/stockmanager` (inventory read) aggregates across all active locations — `overview` (totalItems, activeLocations, lowStockItems, outOfStockItems, todayRecordedCount), `perLocation` (today's received/sold/spoiled/closing + low/out counts), and a merged `restock` list (sorted by stock_ratio). Rendered by `StockManagerDashboard` in `Dashboard.jsx`.

**Production schema**: dev applies via `sequelize.sync({ alter: true })`. Production (`sync()` only) needs a manual `CREATE TABLE` for `locations`, `kitchen_items`, `kitchen_daily_entries` (see model definitions in `backend/models/index.js`), plus `current_qty`/`reorder_level` columns on the existing `stock_levels` table, and `ALTER TABLE kitchen_daily_entries ADD COLUMN expiry_date DATE NULL;`.

### Machines
```
GET|POST       /api/machines
GET|PUT        /api/machines/:id
POST           /api/machines/:id/deploy
POST           /api/machines/:id/exchange
POST           /api/machines/:id/refill
GET            /api/machines/:id/pdf
POST           /api/machines/:id/collections
POST           /api/machines/:id/reset-meter
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
PUT|DELETE     /api/finance/expenses/:id
GET            /api/finance/expenses/pending
PUT            /api/finance/expenses/:id/approve
PUT            /api/finance/expenses/:id/status   # Admin only — change expense status (pending/approved/rejected)
GET|POST       /api/finance/invoices
GET            /api/finance/invoices/:id/pdf
POST           /api/finance/invoices/:id/payment
GET|POST       /api/finance/payroll
GET            /api/finance/export/collections
```

### Accounting
```
GET|POST       /api/finance/accounts
GET|PUT|DELETE /api/finance/accounts/:id
GET            /api/finance/accounts/:id/transactions   # ?status=active filters cancelled out
GET            /api/finance/accounts/:id/statement
POST           /api/finance/accounts/:id/deposit
POST           /api/finance/accounts/:id/withdraw
POST           /api/finance/accounts/transfer
GET            /api/finance/transactions               # shop transactions (?shop_id=)
GET            /api/finance/transactions/:id           # transaction detail (account, recorder, transfer route, receipt)
POST           /api/finance/transactions/:id/cancel    # Admin/GM/Finance — soft-void + recalc balances (body: { reason })
```

**Transaction Cancel / Detail** — deposits, withdrawals and transfers can be cancelled from the transaction history. Cancel is a soft-void (`status='cancelled'`): the row is kept, `balance_before/after` are nulled, and the account's `current_balance` is **recomputed from the active ledger** (`opening_balance + Σin − Σout`, excluding `opening_balance` rows) — the balance is the single source of truth. Transfer legs are linked via `transfer_id` and cancel together. Cancelled rows stay visible (greyed out) but are excluded from all reports/statements. Run `node backend/scripts/backfill-transfer-links.js` once to link pre-existing transfer legs.

> Production: the new `account_transactions` columns (`status`, `receipt_url`, `charges`, `transfer_id`, `cancelled_by`, `cancelled_at`, `cancel_reason`; `balance_before/balance_after` now nullable) are applied automatically by `alter:true` in development. On production, apply them manually with an `ALTER TABLE` before restarting.

> Production: the `machines.meter_reset_at` column (Novomatic meter reset) is also added by `alter:true` in development only. On production it must be applied manually — if missing, **every** machine query (list, detail, stats, collections) throws `Unknown column 'Machine.meter_reset_at' in 'field list'` and the Machines pages fail to load entirely. Apply: `ALTER TABLE machines ADD COLUMN meter_reset_at DATETIME NULL;`

> **List pagination (Sep 2026)**: all server-driven list pages must paginate server-side with `limit`/`offset` (see AGENTS.md "Server-Side Pagination for List Pages"). Applies to `MeteoraMachinesPage`, `NovomaticMachinesPage`, `MeteoraShopsPage`, `SlotShopsPage`, `PartnersPage`; the `/machines`, `/shops`, and `/partners` list endpoints support `limit`/`offset` (default `50`).

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
GET /api/dashboard/admin       # ?date_from=&date_to= (optional chart_granularity/trend_granularity)
GET /api/dashboard/cashier
GET /api/dashboard/sales
GET /api/dashboard/technician
GET /api/dashboard/stockmanager  # Stock Manager (kitchen) — overview, per-location today, restock
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