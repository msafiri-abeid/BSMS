// routes/index.js
const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth');
const { uploadContract, uploadReceipt, uploadMeter, uploadTicket } = require('../middleware/upload');

const authC = require('../controllers/auth.controller');
const machineC = require('../controllers/machine.controller');
const collectionC = require('../controllers/collection.controller');
const financeC = require('../controllers/finance.controller');
const ticketC = require('../controllers/ticket.controller');
const partnerC = require('../controllers/partner.controller');
const settingsC = require('../controllers/settings.controller');
const dashC = require('../controllers/dashboard.controller');

// ── AUTH ──────────────────────────────────────────────────────
router.post('/auth/register', authC.register);
router.post('/auth/login', authC.login);
router.post('/auth/refresh', authC.refresh);
router.post('/auth/logout', authC.logout);
router.get('/auth/me', authenticate, authC.me);
router.put('/auth/password', authenticate, authC.changePassword);

// ── USERS ─────────────────────────────────────────────────────
const { User, Role, Permission } = require('../models');
router.get('/users', authenticate, checkPermission('users', 'read'), async (req, res, next) => {
  try {
    const users = await User.findAll({ attributes: { exclude: ['password_hash'] }, include: [{ model: Role, as: 'role' }], order: [['name', 'ASC']] });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});
router.put('/users/:id', authenticate, checkPermission('users', 'write'), async (req, res, next) => {
  try {
    const u = await User.findByPk(req.params.id);
    if (!u) return res.status(404).json({ success: false, message: 'Not found' });
    await u.update(req.body);
    res.json({ success: true, data: u });
  } catch (err) { next(err); }
});

// ── PARTNERS & SHOPS ──────────────────────────────────────────
router.get('/partners', authenticate, checkPermission('partners', 'read'), partnerC.listPartners);
router.post('/partners', authenticate, checkPermission('partners', 'write'), uploadContract.single('contract'), partnerC.createPartner);
router.put('/partners/:id', authenticate, checkPermission('partners', 'write'), uploadContract.single('contract'), partnerC.updatePartner);
router.get('/shops', authenticate, checkPermission('shops', 'read'), partnerC.listShops);
router.post('/shops', authenticate, checkPermission('shops', 'write'), uploadContract.single('contract'), partnerC.createShop);
router.put('/shops/:id', authenticate, checkPermission('shops', 'write'), uploadContract.single('contract'), partnerC.updateShop);

// ── MACHINES ──────────────────────────────────────────────────
router.get('/machines', authenticate, checkPermission('machines', 'read'), machineC.list);
router.post('/machines', authenticate, checkPermission('machines', 'write'), machineC.create);
router.get('/machines/:id', authenticate, checkPermission('machines', 'read'), machineC.getOne);
router.put('/machines/:id', authenticate, checkPermission('machines', 'write'), machineC.update);
router.post('/machines/:id/deploy', authenticate, checkPermission('machines', 'write'), machineC.deploy);
router.post('/machines/:id/exchange', authenticate, checkPermission('machines', 'write'), machineC.exchange);
router.post('/machines/:id/refill', authenticate, checkPermission('machines', 'write'), machineC.refill);

// ── COLLECTIONS ───────────────────────────────────────────────
router.get('/collections/my-assignments', authenticate, collectionC.myAssignments);
router.post('/collections/assignments', authenticate, checkPermission('collections', 'write'), collectionC.createAssignment);
router.get('/collections', authenticate, checkPermission('collections', 'read'), collectionC.list);
router.post('/collections', authenticate, uploadMeter.single('meter_image'), collectionC.submit);
router.post('/collections/ocr', authenticate, uploadMeter.single('meter_image'), collectionC.ocr);
router.get('/collections/weekly-targets', authenticate, checkPermission('collections', 'read'), collectionC.weeklyTargets);

// ── FINANCE ───────────────────────────────────────────────────
router.get('/finance/expenses', authenticate, checkPermission('finance', 'read'), financeC.listExpenses);
router.post('/finance/expenses', authenticate, uploadReceipt.single('receipt'), financeC.submitExpense);
router.get('/finance/expenses/pending', authenticate, checkPermission('finance', 'approve'), financeC.getPendingExpenses);
router.put('/finance/expenses/:id/approve', authenticate, checkPermission('finance', 'approve'), financeC.approveExpense);
router.get('/finance/invoices', authenticate, checkPermission('finance', 'read'), financeC.listInvoices);
router.post('/finance/invoices', authenticate, checkPermission('finance', 'write'), financeC.createInvoice);
router.get('/finance/invoices/:id/pdf', authenticate, financeC.downloadInvoicePDF);
router.post('/finance/invoices/:id/payment', authenticate, checkPermission('finance', 'write'), financeC.recordPayment);
router.get('/finance/payroll', authenticate, checkPermission('finance', 'read'), financeC.listPayroll);
router.post('/finance/payroll', authenticate, checkPermission('finance', 'write'), financeC.createPayroll);
router.get('/finance/export/collections', authenticate, checkPermission('reports', 'read'), financeC.exportCollections);

// ── TICKETS ───────────────────────────────────────────────────
router.get('/tickets', authenticate, ticketC.list);
router.post('/tickets', authenticate, uploadTicket.array('attachments', 5), ticketC.create);
router.get('/tickets/counts', authenticate, ticketC.dashboardCounts);
router.get('/tickets/groups', authenticate, ticketC.listGroups);
router.get('/tickets/:id', authenticate, ticketC.getOne);
router.put('/tickets/:id/status', authenticate, ticketC.updateStatus);
router.post('/tickets/:id/activity', authenticate, uploadTicket.array('attachments', 5), ticketC.addActivity);

// ── SETTINGS ──────────────────────────────────────────────────
router.get('/settings', authenticate, settingsC.getAll);
router.put('/settings', authenticate, checkPermission('settings', 'write'), settingsC.bulkUpdate);
router.get('/settings/roles', authenticate, checkPermission('settings', 'read'), settingsC.getRoles);
router.post('/settings/roles', authenticate, checkPermission('settings', 'write'), settingsC.createRole);
router.put('/settings/roles/:roleId/permissions', authenticate, checkPermission('settings', 'write'), settingsC.updatePermissions);
router.post('/settings/sms-test', authenticate, checkPermission('settings', 'write'), settingsC.testSMS);

// ── INVENTORY ─────────────────────────────────────────────────
const { TokenInventory, Product, StockMovement, StockLevel } = require('../models');
router.get('/inventory/tokens', authenticate, checkPermission('inventory', 'read'), async (req, res, next) => {
  try {
    const movements = await TokenInventory.findAll({ order: [['created_at', 'DESC']], limit: 100 });
    const current = await TokenInventory.sum('qty');
    res.json({ success: true, data: { current, movements } });
  } catch (err) { next(err); }
});
router.post('/inventory/tokens', authenticate, checkPermission('inventory', 'write'), async (req, res, next) => {
  try {
    const m = await TokenInventory.create({ ...req.body, created_by: req.user.id });
    res.status(201).json({ success: true, data: m });
  } catch (err) { next(err); }
});
router.get('/inventory/products', authenticate, checkPermission('inventory', 'read'), async (req, res, next) => {
  try {
    const products = await Product.findAll({ where: req.query.shop_id ? { shop_id: req.query.shop_id } : {}, include: [{ model: StockLevel, as: 'stockLevel' }] });
    res.json({ success: true, data: products });
  } catch (err) { next(err); }
});

// ── DASHBOARDS ────────────────────────────────────────────────
router.get('/dashboard/admin', authenticate, dashC.adminDashboard);
router.get('/dashboard/collector', authenticate, dashC.collectorDashboard);
router.get('/dashboard/finance', authenticate, dashC.financeDashboard);
router.get('/dashboard/director', authenticate, dashC.directorDashboard);

// ── STAFF ─────────────────────────────────────────────────────
const { Employee, Department, Position, Attendance } = require('../models');
router.get('/staff/employees', authenticate, checkPermission('staff', 'read'), async (req, res, next) => {
  try {
    const data = await Employee.findAll({ include: [{ model: User, as: 'user', attributes: { exclude: ['password_hash'] } }, { model: Department, as: 'department' }, { model: Position, as: 'position' }] });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});
router.post('/staff/employees', authenticate, checkPermission('staff', 'write'), async (req, res, next) => {
  try {
    const emp = await Employee.create(req.body);
    res.status(201).json({ success: true, data: emp });
  } catch (err) { next(err); }
});
router.get('/staff/departments', authenticate, async (req, res, next) => {
  try { res.json({ success: true, data: await Department.findAll() }); } catch (err) { next(err); }
});
router.get('/staff/positions', authenticate, async (req, res, next) => {
  try { res.json({ success: true, data: await Position.findAll() }); } catch (err) { next(err); }
});

module.exports = router;
