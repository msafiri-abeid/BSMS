// models/index.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ─── AUTH & RBAC ──────────────────────────────────────────────
const Role = sequelize.define('Role', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  is_system: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'roles', updatedAt: false });

const Permission = sequelize.define('Permission', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  role_id: { type: DataTypes.INTEGER, allowNull: false },
  module: { type: DataTypes.STRING(50), allowNull: false },
  action: { type: DataTypes.ENUM('read', 'write', 'approve', 'delete'), allowNull: false },
}, { tableName: 'permissions', updatedAt: false });

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  email: { type: DataTypes.STRING(200), allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  role_id: { type: DataTypes.INTEGER, allowNull: false },
  employee_id: { type: DataTypes.STRING(50) },
  phone: { type: DataTypes.STRING(20) },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  last_login: { type: DataTypes.DATE },
}, { tableName: 'users' });

const RefreshToken = sequelize.define('RefreshToken', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  token: { type: DataTypes.TEXT, allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  is_revoked: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'refresh_tokens', updatedAt: false });

const Setting = sequelize.define('Setting', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  value: { type: DataTypes.TEXT },
  description: { type: DataTypes.STRING(255) },
  updated_by: { type: DataTypes.INTEGER },
}, { tableName: 'settings', createdAt: false });

// ─── PARTNERS & SHOPS ─────────────────────────────────────────
const Partner = sequelize.define('Partner', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id: { type: DataTypes.STRING(50) },
  label: { type: DataTypes.STRING(100) },
  name: { type: DataTypes.STRING(150), allowNull: false },
  phone: { type: DataTypes.STRING(20) },
  address: { type: DataTypes.TEXT },
  type: { type: DataTypes.ENUM('own', 'partner'), defaultValue: 'partner' },
  contract_url: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
}, { tableName: 'partners' });

const Shop = sequelize.define('Shop', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  partner_id: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(150), allowNull: false },
  type: { type: DataTypes.ENUM('slot_only', 'bar', 'grocery', 'mixed'), defaultValue: 'slot_only' },
  address: { type: DataTypes.TEXT },
  lat: { type: DataTypes.DECIMAL(10, 8) },
  lng: { type: DataTypes.DECIMAL(11, 8) },
  contract_url: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('active', 'inactive', 'suspended'), defaultValue: 'active' },
}, { tableName: 'shops' });

// ─── MACHINES ─────────────────────────────────────────────────
const Machine = sequelize.define('Machine', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  slot_code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  serial_number: { type: DataTypes.STRING(100) },
  sticker_no: { type: DataTypes.STRING(50) },
  manufacturer: { type: DataTypes.ENUM('Meteora', 'Novomatic', 'EGT'), allowNull: false },
  credit_value_tzs: { type: DataTypes.INTEGER, allowNull: false },
  opening_count: { type: DataTypes.BIGINT, defaultValue: 0 },
  previous_count: { type: DataTypes.BIGINT, defaultValue: 0 },
  current_shop_id: { type: DataTypes.INTEGER },
  status: { type: DataTypes.ENUM('active', 'inactive', 'maintenance', 'transferred'), defaultValue: 'inactive' },
}, { tableName: 'machines' });

const MachineDeployment = sequelize.define('MachineDeployment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  machine_id: { type: DataTypes.INTEGER, allowNull: false },
  shop_id: { type: DataTypes.INTEGER, allowNull: false },
  deployed_by: { type: DataTypes.INTEGER, allowNull: false },
  opening_count: { type: DataTypes.BIGINT, defaultValue: 0 },
  initial_load_tzs: { type: DataTypes.INTEGER, defaultValue: 0 },
  deployed_at: { type: DataTypes.DATE, allowNull: false },
  withdrawn_at: { type: DataTypes.DATE },
}, { tableName: 'machine_deployments' });

const MachineExchange = sequelize.define('MachineExchange', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  machine_id: { type: DataTypes.INTEGER, allowNull: false },
  from_shop_id: { type: DataTypes.INTEGER, allowNull: false },
  to_shop_id: { type: DataTypes.INTEGER, allowNull: false },
  transferred_by: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.TEXT },
  exchanged_at: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'machine_exchanges' });

const MachineRefill = sequelize.define('MachineRefill', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  machine_id: { type: DataTypes.INTEGER, allowNull: false },
  shop_id: { type: DataTypes.INTEGER, allowNull: false },
  refilled_by: { type: DataTypes.INTEGER, allowNull: false },
  token_qty: { type: DataTypes.INTEGER, allowNull: false },
  token_value_tzs: { type: DataTypes.INTEGER, allowNull: false },
  total_tzs: { type: DataTypes.INTEGER, allowNull: false },
  refilled_at: { type: DataTypes.DATE, allowNull: false },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'machine_refills' });

// ─── COLLECTIONS ──────────────────────────────────────────────
const CollectorAssignment = sequelize.define('CollectorAssignment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  collector_id: { type: DataTypes.INTEGER, allowNull: false },
  machine_id: { type: DataTypes.INTEGER, allowNull: false },
  shop_id: { type: DataTypes.INTEGER, allowNull: false },
  assigned_date: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'done', 'skipped'), defaultValue: 'pending' },
  assigned_by: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'collector_assignments' });

const Collection = sequelize.define('Collection', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  machine_id: { type: DataTypes.INTEGER, allowNull: false },
  shop_id: { type: DataTypes.INTEGER, allowNull: false },
  collector_id: { type: DataTypes.INTEGER, allowNull: false },
  prev_count: { type: DataTypes.BIGINT, allowNull: false },
  curr_count: { type: DataTypes.BIGINT, allowNull: false },
  difference: { type: DataTypes.BIGINT, allowNull: false },
  credit_value_tzs: { type: DataTypes.INTEGER, allowNull: false },
  gross_tzs: { type: DataTypes.INTEGER, allowNull: false },
  office_pct: { type: DataTypes.INTEGER, defaultValue: 0 },
  office_tzs: { type: DataTypes.INTEGER, defaultValue: 0 },
  owner_pct: { type: DataTypes.INTEGER, defaultValue: 0 },
  owner_tzs: { type: DataTypes.INTEGER, defaultValue: 0 },
  operator_pct: { type: DataTypes.INTEGER, defaultValue: 0 },
  operator_tzs: { type: DataTypes.INTEGER, defaultValue: 0 },
  net_tzs: { type: DataTypes.INTEGER, defaultValue: 0 },
  meter_image_url: { type: DataTypes.TEXT },
  collected_at: { type: DataTypes.DATE, allowNull: false },
  approved_by: { type: DataTypes.INTEGER },
  status: { type: DataTypes.ENUM('pending', 'approved', 'disputed'), defaultValue: 'pending' },
}, { tableName: 'collections' });

const NovomaticReading = sequelize.define('NovomaticReading', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  collection_id: { type: DataTypes.INTEGER, allowNull: false },
  total_in_tzs: { type: DataTypes.INTEGER, allowNull: false },
  total_out_tzs: { type: DataTypes.INTEGER, allowNull: false },
  net_tzs: { type: DataTypes.INTEGER, allowNull: false },
  coins_in_tzs: { type: DataTypes.INTEGER, defaultValue: 0 },
  remote_in_tzs: { type: DataTypes.INTEGER, defaultValue: 0 },
  handpay_out_tzs: { type: DataTypes.INTEGER, defaultValue: 0 },
  screenshot_url: { type: DataTypes.TEXT },
  read_at: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'novomatic_readings', updatedAt: false });

const WeeklyTarget = sequelize.define('WeeklyTarget', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  machine_id: { type: DataTypes.INTEGER, allowNull: false },
  shop_id: { type: DataTypes.INTEGER, allowNull: false },
  target_tzs: { type: DataTypes.INTEGER, allowNull: false },
  week_start: { type: DataTypes.DATEONLY, allowNull: false },
  week_end: { type: DataTypes.DATEONLY, allowNull: false },
  collected_tzs: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM('pending', 'met', 'unmet'), defaultValue: 'pending' },
}, { tableName: 'weekly_targets' });

// ─── FINANCE ──────────────────────────────────────────────────
const ExpenseCategory = sequelize.define('ExpenseCategory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'expense_categories', updatedAt: false });

const Expense = sequelize.define('Expense', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  category_id: { type: DataTypes.INTEGER, allowNull: false },
  shop_id: { type: DataTypes.INTEGER },
  machine_id: { type: DataTypes.INTEGER },
  amount: { type: DataTypes.INTEGER, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  receipt_url: { type: DataTypes.TEXT },
  submitted_by: { type: DataTypes.INTEGER, allowNull: false },
  approved_by: { type: DataTypes.INTEGER },
  approved_at: { type: DataTypes.DATE },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
  rejection_reason: { type: DataTypes.TEXT },
}, { tableName: 'expenses' });

const Invoice = sequelize.define('Invoice', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  reference_no: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  partner_id: { type: DataTypes.INTEGER },
  shop_id: { type: DataTypes.INTEGER },
  line_items: { type: DataTypes.JSON, defaultValue: [] },
  subtotal: { type: DataTypes.INTEGER, allowNull: false },
  tax_pct: { type: DataTypes.INTEGER, defaultValue: 0 },
  tax_amount: { type: DataTypes.INTEGER, defaultValue: 0 },
  total: { type: DataTypes.INTEGER, allowNull: false },
  notes: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled'), defaultValue: 'draft' },
  due_date: { type: DataTypes.DATEONLY },
  generated_by: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'invoices' });

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  invoice_id: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.INTEGER, allowNull: false },
  method: { type: DataTypes.ENUM('cash', 'bank_transfer', 'mobile_money', 'cheque'), allowNull: false },
  reference_no: { type: DataTypes.STRING(100) },
  paid_at: { type: DataTypes.DATE, allowNull: false },
  recorded_by: { type: DataTypes.INTEGER, allowNull: false },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'payments', updatedAt: false });

const CreditNote = sequelize.define('CreditNote', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  invoice_id: { type: DataTypes.INTEGER, allowNull: false },
  reference_no: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  amount: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  issued_by: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'credit_notes', updatedAt: false });

const Payroll = sequelize.define('Payroll', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  employee_id: { type: DataTypes.INTEGER, allowNull: false },
  period_start: { type: DataTypes.DATEONLY, allowNull: false },
  period_end: { type: DataTypes.DATEONLY, allowNull: false },
  basic_salary: { type: DataTypes.INTEGER, allowNull: false },
  allowances: { type: DataTypes.INTEGER, defaultValue: 0 },
  deductions: { type: DataTypes.INTEGER, defaultValue: 0 },
  net_pay: { type: DataTypes.INTEGER, allowNull: false },
  notes: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM('draft', 'approved', 'paid'), defaultValue: 'draft' },
  approved_by: { type: DataTypes.INTEGER },
  paid_at: { type: DataTypes.DATE },
}, { tableName: 'payroll' });

// ─── INVENTORY ────────────────────────────────────────────────
const TokenInventory = sequelize.define('TokenInventory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  qty: { type: DataTypes.INTEGER, allowNull: false },
  unit_value_tzs: { type: DataTypes.INTEGER, allowNull: false },
  total_value_tzs: { type: DataTypes.INTEGER, allowNull: false },
  movement_type: { type: DataTypes.ENUM('purchase', 'refill_out', 'adjustment'), allowNull: false },
  reference_id: { type: DataTypes.INTEGER },
  note: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'token_inventory', updatedAt: false });

const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  shop_id: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(150), allowNull: false },
  category: { type: DataTypes.STRING(100) },
  purchase_price: { type: DataTypes.INTEGER, allowNull: false },
  selling_price: { type: DataTypes.INTEGER, allowNull: false },
  unit: { type: DataTypes.STRING(30) },
}, { tableName: 'products' });

const StockMovement = sequelize.define('StockMovement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  qty_change: { type: DataTypes.INTEGER, allowNull: false },
  movement_type: { type: DataTypes.ENUM('purchase', 'sale', 'adjustment', 'waste'), allowNull: false },
  reference_no: { type: DataTypes.STRING(100) },
  note: { type: DataTypes.TEXT },
  created_by: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'stock_movements', updatedAt: false });

const StockLevel = sequelize.define('StockLevel', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  product_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  current_qty: { type: DataTypes.INTEGER, defaultValue: 0 },
  reorder_level: { type: DataTypes.INTEGER, defaultValue: 10 },
  expiry_date: { type: DataTypes.DATEONLY },
}, { tableName: 'stock_levels', createdAt: false });

const VipOffer = sequelize.define('VipOffer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  shop_id: { type: DataTypes.INTEGER, allowNull: false },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  offer_description: { type: DataTypes.TEXT, allowNull: false },
  discount_pct: { type: DataTypes.INTEGER, defaultValue: 0 },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'vip_offers' });

const Sale = sequelize.define('Sale', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  shop_id: { type: DataTypes.INTEGER, allowNull: false },
  sale_date: { type: DataTypes.DATE, allowNull: false },
  total_amount_tzs: { type: DataTypes.INTEGER, allowNull: false },
  discount_amount_tzs: { type: DataTypes.INTEGER, defaultValue: 0 },
  net_amount_tzs: { type: DataTypes.INTEGER, allowNull: false },
  payment_method: { type: DataTypes.ENUM('cash', 'card', 'mobile', 'credit'), defaultValue: 'cash' },
  customer_name: { type: DataTypes.STRING(150) },
  notes: { type: DataTypes.TEXT },
  recorded_by: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('completed', 'returned', 'partial_returned'), defaultValue: 'completed' },
}, { tableName: 'sales' });

const SaleItem = sequelize.define('SaleItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sale_id: { type: DataTypes.INTEGER, allowNull: false },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  qty: { type: DataTypes.INTEGER, allowNull: false },
  unit_price_tzs: { type: DataTypes.INTEGER, allowNull: false },
  discount_pct: { type: DataTypes.INTEGER, defaultValue: 0 },
  line_total_tzs: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'sale_items', updatedAt: false });

const SalesReturn = sequelize.define('SalesReturn', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sale_id: { type: DataTypes.INTEGER, allowNull: false },
  return_date: { type: DataTypes.DATE, allowNull: false },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  qty_returned: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  refund_amount_tzs: { type: DataTypes.INTEGER, allowNull: false },
  refund_method: { type: DataTypes.ENUM('cash', 'credit'), defaultValue: 'cash' },
  processed_by: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'sales_returns', updatedAt: false });

const SalePayment = sequelize.define('SalePayment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sale_id: { type: DataTypes.INTEGER, allowNull: false },
  amount_tzs: { type: DataTypes.INTEGER, allowNull: false },
  payment_method: { type: DataTypes.ENUM('cash', 'card', 'mobile', 'credit'), allowNull: false },
  reference: { type: DataTypes.STRING(100) },
  notes: { type: DataTypes.TEXT },
  recorded_by: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'sale_payments', updatedAt: false });

const StockAudit = sequelize.define('StockAudit', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  shop_id: { type: DataTypes.INTEGER, allowNull: false },
  audit_date: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.ENUM('draft', 'completed', 'verified'), defaultValue: 'draft' },
  auditor_id: { type: DataTypes.INTEGER, allowNull: false },
  verified_by: { type: DataTypes.INTEGER },
  total_variance_items: { type: DataTypes.INTEGER, defaultValue: 0 },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'stock_audits' });

const AuditItem = sequelize.define('AuditItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  audit_id: { type: DataTypes.INTEGER, allowNull: false },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  system_qty: { type: DataTypes.INTEGER, allowNull: false },
  counted_qty: { type: DataTypes.INTEGER, allowNull: false },
  variance: { type: DataTypes.INTEGER, defaultValue: 0 },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'audit_items', updatedAt: false });

const StockTransfer = sequelize.define('StockTransfer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  from_shop_id: { type: DataTypes.INTEGER, allowNull: false },
  to_shop_id: { type: DataTypes.INTEGER, allowNull: false },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  qty: { type: DataTypes.INTEGER, allowNull: false },
  transfer_date: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'in_transit', 'received', 'cancelled'), defaultValue: 'pending' },
  initiated_by: { type: DataTypes.INTEGER, allowNull: false },
  received_by: { type: DataTypes.INTEGER },
  received_at: { type: DataTypes.DATE },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'stock_transfers' });

const LowStockAlert = sequelize.define('LowStockAlert', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  shop_id: { type: DataTypes.INTEGER, allowNull: false },
  current_qty: { type: DataTypes.INTEGER, allowNull: false },
  reorder_level: { type: DataTypes.INTEGER, allowNull: false },
  threshold_pct: { type: DataTypes.INTEGER, defaultValue: 50 },
  alert_date: { type: DataTypes.DATE, allowNull: false },
  acknowledged: { type: DataTypes.BOOLEAN, defaultValue: false },
  acknowledged_by: { type: DataTypes.INTEGER },
  acknowledged_at: { type: DataTypes.DATE },
}, { tableName: 'low_stock_alerts', updatedAt: false });

// ─── TICKETS ──────────────────────────────────────────────────
const TicketGroup = sequelize.define('TicketGroup', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
}, { tableName: 'ticket_groups', updatedAt: false });

const Ticket = sequelize.define('Ticket', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ticket_number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  subject: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT },
  requester_type: { type: DataTypes.ENUM('staff', 'partner', 'system'), defaultValue: 'staff' },
  requester_name: { type: DataTypes.STRING(150) },
  requester_id: { type: DataTypes.INTEGER },
  machine_id: { type: DataTypes.INTEGER },
  shop_id: { type: DataTypes.INTEGER },
  slot_code: { type: DataTypes.STRING(50) },
  ticket_type: { type: DataTypes.ENUM('technical', 'financial', 'operational', 'complaint', 'other'), defaultValue: 'other' },
  priority: { type: DataTypes.ENUM('urgent', 'high', 'medium', 'low'), defaultValue: 'medium' },
  status: { type: DataTypes.ENUM('open', 'pending', 'in_progress', 'resolved', 'closed', 'reopened'), defaultValue: 'open' },
  assigned_group_id: { type: DataTypes.INTEGER },
  assigned_to: { type: DataTypes.INTEGER },
  channel: { type: DataTypes.ENUM('sms', 'system', 'email'), defaultValue: 'system' },
  sla_deadline: { type: DataTypes.DATE },
  resolved_at: { type: DataTypes.DATE },
}, { tableName: 'tickets' });

const TicketActivity = sequelize.define('TicketActivity', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ticket_id: { type: DataTypes.INTEGER, allowNull: false },
  action: { type: DataTypes.STRING(100), allowNull: false },
  from_status: { type: DataTypes.STRING(50) },
  to_status: { type: DataTypes.STRING(50) },
  note: { type: DataTypes.TEXT },
  attachments: { type: DataTypes.JSON, defaultValue: [] },
  performed_by: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'ticket_activities', updatedAt: false });

// ─── STAFF & HR ───────────────────────────────────────────────
const Department = sequelize.define('Department', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  parent_id: { type: DataTypes.INTEGER },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'departments', updatedAt: false });

const Position = sequelize.define('Position', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  department_id: { type: DataTypes.INTEGER },
}, { tableName: 'positions', updatedAt: false });

const Employee = sequelize.define('Employee', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, unique: true },
  employee_code: { type: DataTypes.STRING(50), unique: true },
  full_name: { type: DataTypes.STRING(150) },
  email: { type: DataTypes.STRING(200) },
  phone: { type: DataTypes.STRING(20) },
  department_id: { type: DataTypes.INTEGER },
  position_id: { type: DataTypes.INTEGER },
  hire_date: { type: DataTypes.DATEONLY },
  basic_salary: { type: DataTypes.INTEGER, defaultValue: 0 },
  bank_account: { type: DataTypes.STRING(100) },
  national_id: { type: DataTypes.STRING(50) },
  documents: { type: DataTypes.JSON, defaultValue: [] },
  status: { type: DataTypes.ENUM('active', 'inactive', 'terminated'), defaultValue: 'active' },
}, { tableName: 'employees' });

const Attendance = sequelize.define('Attendance', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  employee_id: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  check_in: { type: DataTypes.TIME },
  check_out: { type: DataTypes.TIME },
  status: { type: DataTypes.ENUM('present', 'absent', 'late', 'half_day', 'leave'), defaultValue: 'present' },
  notes: { type: DataTypes.TEXT },
}, { tableName: 'attendance' });

// ─── SMS LOGS ─────────────────────────────────────────────────
const SmsLog = sequelize.define('SmsLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  to: { type: DataTypes.STRING(20), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.ENUM('sent', 'failed', 'pending'), defaultValue: 'pending' },
  response: { type: DataTypes.TEXT },
  sent_at: { type: DataTypes.DATE },
}, { tableName: 'sms_logs', updatedAt: false });

// ─── ASSOCIATIONS ─────────────────────────────────────────────
Role.hasMany(Permission, { foreignKey: 'role_id', as: 'permissions' });
Permission.belongsTo(Role, { foreignKey: 'role_id' });

Role.hasMany(User, { foreignKey: 'role_id' });
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

User.hasMany(RefreshToken, { foreignKey: 'user_id' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

Partner.hasMany(Shop, { foreignKey: 'partner_id', as: 'shops' });
Shop.belongsTo(Partner, { foreignKey: 'partner_id', as: 'partner' });

Shop.hasMany(Machine, { foreignKey: 'current_shop_id', as: 'machines' });
Machine.belongsTo(Shop, { foreignKey: 'current_shop_id', as: 'currentShop' });

Machine.hasMany(MachineDeployment, { foreignKey: 'machine_id', as: 'deployments' });
MachineDeployment.belongsTo(Machine, { foreignKey: 'machine_id' });
MachineDeployment.belongsTo(Shop, { foreignKey: 'shop_id', as: 'shop' });
MachineDeployment.belongsTo(User, { foreignKey: 'deployed_by', as: 'deployedBy' });

Machine.hasMany(MachineExchange, { foreignKey: 'machine_id', as: 'exchanges' });

Machine.hasMany(Collection, { foreignKey: 'machine_id', as: 'collections' });
Collection.belongsTo(Machine, { foreignKey: 'machine_id', as: 'machine' });
Collection.belongsTo(Shop, { foreignKey: 'shop_id', as: 'shop' });
Collection.belongsTo(User, { foreignKey: 'collector_id', as: 'collector' });

Collection.hasOne(NovomaticReading, { foreignKey: 'collection_id', as: 'novomaticReading' });

CollectorAssignment.belongsTo(User, { foreignKey: 'collector_id', as: 'collector' });
CollectorAssignment.belongsTo(Machine, { foreignKey: 'machine_id', as: 'machine' });
CollectorAssignment.belongsTo(Shop, { foreignKey: 'shop_id', as: 'shop' });

Expense.belongsTo(User, { foreignKey: 'submitted_by', as: 'submitter' });
Expense.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });
Expense.belongsTo(ExpenseCategory, { foreignKey: 'category_id', as: 'category' });

Invoice.belongsTo(Partner, { foreignKey: 'partner_id', as: 'partner' });
Invoice.belongsTo(Shop, { foreignKey: 'shop_id', as: 'shop' });
Invoice.hasMany(Payment, { foreignKey: 'invoice_id', as: 'payments' });
Invoice.hasMany(CreditNote, { foreignKey: 'invoice_id', as: 'creditNotes' });

Product.belongsTo(Shop, { foreignKey: 'shop_id', as: 'shop' });
Product.hasMany(StockMovement, { foreignKey: 'product_id', as: 'movements' });
Product.hasOne(StockLevel, { foreignKey: 'product_id', as: 'stockLevel' });

Sale.belongsTo(Shop, { foreignKey: 'shop_id', as: 'shop' });
Sale.belongsTo(User, { foreignKey: 'recorded_by', as: 'recorder' });
Sale.hasMany(SaleItem, { foreignKey: 'sale_id', as: 'items' });
Sale.hasMany(SalePayment, { foreignKey: 'sale_id', as: 'payments' });
Sale.hasMany(SalesReturn, { foreignKey: 'sale_id', as: 'returns' });

SaleItem.belongsTo(Sale, { foreignKey: 'sale_id' });
SaleItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

SalesReturn.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });
SalesReturn.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
SalesReturn.belongsTo(User, { foreignKey: 'processed_by', as: 'processor' });

SalePayment.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });
SalePayment.belongsTo(User, { foreignKey: 'recorded_by', as: 'recorder' });

StockAudit.belongsTo(Shop, { foreignKey: 'shop_id', as: 'shop' });
StockAudit.belongsTo(User, { foreignKey: 'auditor_id', as: 'auditor' });
StockAudit.belongsTo(User, { foreignKey: 'verified_by', as: 'verifier' });
StockAudit.hasMany(AuditItem, { foreignKey: 'audit_id', as: 'items' });

AuditItem.belongsTo(StockAudit, { foreignKey: 'audit_id' });
AuditItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

StockTransfer.belongsTo(Shop, { foreignKey: 'from_shop_id', as: 'fromShop' });
StockTransfer.belongsTo(Shop, { foreignKey: 'to_shop_id', as: 'toShop' });
StockTransfer.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
StockTransfer.belongsTo(User, { foreignKey: 'initiated_by', as: 'initiator' });
StockTransfer.belongsTo(User, { foreignKey: 'received_by', as: 'receiver' });

LowStockAlert.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
LowStockAlert.belongsTo(Shop, { foreignKey: 'shop_id', as: 'shop' });
LowStockAlert.belongsTo(User, { foreignKey: 'acknowledged_by', as: 'acknowledger' });

Ticket.belongsTo(Machine, { foreignKey: 'machine_id', as: 'machine' });
Ticket.belongsTo(Shop, { foreignKey: 'shop_id', as: 'shop' });
Ticket.belongsTo(TicketGroup, { foreignKey: 'assigned_group_id', as: 'group' });
Ticket.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
Ticket.hasMany(TicketActivity, { foreignKey: 'ticket_id', as: 'activities' });

Department.hasMany(Department, { foreignKey: 'parent_id', as: 'children' });
Department.belongsTo(Department, { foreignKey: 'parent_id', as: 'parent' });

Employee.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Employee.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });
Employee.belongsTo(Position, { foreignKey: 'position_id', as: 'position' });
Employee.hasMany(Attendance, { foreignKey: 'employee_id', as: 'attendance' });
Attendance.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
Position.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });

module.exports = {
  sequelize,
  Role, Permission, User, RefreshToken, Setting,
  Partner, Shop,
  Machine, MachineDeployment, MachineExchange, MachineRefill,
  CollectorAssignment, Collection, NovomaticReading, WeeklyTarget,
  ExpenseCategory, Expense, Invoice, Payment, CreditNote, Payroll, SalePayment,
  TokenInventory, Product, StockMovement, StockLevel, VipOffer,
  Sale, SaleItem, SalesReturn, StockAudit, AuditItem, StockTransfer, LowStockAlert,
  TicketGroup, Ticket, TicketActivity,
  Department, Position, Employee, Attendance,
  SmsLog,
};
