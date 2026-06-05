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
const salesC = require('../controllers/inventory.sales.controller');
const auditsC = require('../controllers/inventory.audits.controller');
const transfersC = require('../controllers/inventory.transfers.controller');
const returnsC = require('../controllers/inventory.returns.controller');
const accountingC = require('../controllers/inventory.accounting.controller');
const alertsC = require('../controllers/inventory.alerts.controller');

// ── AUTH ──────────────────────────────────────────────────────
router.post('/auth/register', authC.register);
router.post('/auth/login', authC.login);
router.post('/auth/refresh', authC.refresh);
router.post('/auth/logout', authC.logout);
router.get('/auth/me', authenticate, authC.me);
router.put('/auth/password', authenticate, authC.changePassword);

// ── USERS ─────────────────────────────────────────────────────
const usersC = require('../controllers/users.controller');
router.get('/users', authenticate, checkPermission('users', 'read'), usersC.listUsers);
router.post('/users', authenticate, checkPermission('users', 'write'), usersC.createUser);
router.put('/users/:id', authenticate, checkPermission('users', 'write'), usersC.updateUser);

// ── PARTNERS & SHOPS ──────────────────────────────────────────
router.get('/partners', authenticate, checkPermission('partners', 'read'), partnerC.listPartners);
router.post('/partners', authenticate, checkPermission('partners', 'write'), uploadContract.single('contract'), partnerC.createPartner);
router.put('/partners/:id', authenticate, checkPermission('partners', 'write'), uploadContract.single('contract'), partnerC.updatePartner);
router.delete('/partners/:id', authenticate, checkPermission('partners', 'write'), partnerC.deletePartner);
router.get('/partners/:id', authenticate, checkPermission('partners', 'read'), partnerC.getPartner);
router.get('/shops', authenticate, checkPermission('shops', 'read'), partnerC.listShops);
router.post('/shops', authenticate, checkPermission('shops', 'write'), uploadContract.single('contract'), partnerC.createShop);
router.put('/shops/:id', authenticate, checkPermission('shops', 'write'), uploadContract.single('contract'), partnerC.updateShop);
router.delete('/shops/:id', authenticate, checkPermission('shops', 'write'), partnerC.deleteShop);
router.get('/shops/:id', authenticate, checkPermission('shops', 'read'), partnerC.getShop);

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

// Basic inventory (tokens, products)
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
router.post('/inventory/products', authenticate, checkPermission('inventory', 'write'), async (req, res, next) => {
  try {
    const { shop_id, name, category, unit, purchase_price, selling_price, expiry_date } = req.body;
    if (!shop_id || !name || !purchase_price || !selling_price) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const product = await Product.create({ shop_id, name, category, unit, purchase_price, selling_price });
    const stockLevel = await StockLevel.create({ product_id: product.id, expiry_date });
    res.status(201).json({ success: true, data: { ...product.toJSON(), stockLevel } });
  } catch (err) { next(err); }
});
router.get('/inventory/categories', authenticate, checkPermission('inventory', 'read'), async (req, res, next) => {
  try {
    const shop_id = req.query.shop_id;
    if (!shop_id) {
      return res.status(400).json({ success: false, message: 'shop_id required' });
    }
    const categories = await Product.findAll({
      attributes: [['category', 'value']],
      where: { shop_id, category: { [require('sequelize').Op.not]: null } },
      raw: true,
      group: ['category'],
    });
    res.json({ success: true, data: categories.filter(c => c.value) });
  } catch (err) { next(err); }
});

// Sales
router.get('/inventory/sales', authenticate, checkPermission('inventory', 'read'), salesC.listSales);
router.get('/inventory/sales/:id', authenticate, checkPermission('inventory', 'read'), salesC.getSale);
router.post('/inventory/sales', authenticate, checkPermission('inventory', 'write'), salesC.recordSale);
router.post('/inventory/sales/:id/payment', authenticate, checkPermission('inventory', 'write'), salesC.recordPayment);
router.get('/inventory/sales/report/summary', authenticate, checkPermission('inventory', 'read'), salesC.getSaleReport);

// Stock Audits
router.get('/inventory/audits', authenticate, checkPermission('inventory', 'audit'), auditsC.listAudits);
router.get('/inventory/audits/:id', authenticate, checkPermission('inventory', 'audit'), auditsC.getAudit);
router.post('/inventory/audits', authenticate, checkPermission('inventory', 'audit'), auditsC.startAudit);
router.put('/inventory/audits/item', authenticate, checkPermission('inventory', 'audit'), auditsC.updateAuditItem);
router.put('/inventory/audits/:id/complete', authenticate, checkPermission('inventory', 'audit'), auditsC.completeAudit);
router.put('/inventory/audits/:id/verify', authenticate, checkPermission('inventory', 'audit'), auditsC.verifyAudit);

// Stock Transfers
router.get('/inventory/transfers', authenticate, checkPermission('inventory', 'write'), transfersC.listTransfers);
router.get('/inventory/transfers/:id', authenticate, checkPermission('inventory', 'write'), transfersC.getTransfer);
router.post('/inventory/transfers', authenticate, checkPermission('inventory', 'write'), transfersC.initializeTransfer);
router.put('/inventory/transfers/:id/approve', authenticate, checkPermission('inventory', 'audit'), transfersC.approveTransfer);
router.put('/inventory/transfers/:id/receive', authenticate, checkPermission('inventory', 'write'), transfersC.receiveTransfer);
router.put('/inventory/transfers/:id/cancel', authenticate, checkPermission('inventory', 'write'), transfersC.cancelTransfer);

// Sales Returns
router.get('/inventory/returns', authenticate, checkPermission('inventory', 'read'), returnsC.listReturns);
router.get('/inventory/returns/:id', authenticate, checkPermission('inventory', 'read'), returnsC.getReturn);
router.post('/inventory/returns', authenticate, checkPermission('inventory', 'write'), returnsC.processReturn);
router.put('/inventory/returns/:id/approve', authenticate, checkPermission('inventory', 'approve'), returnsC.approveReturn);

// Low Stock Alerts
router.get('/inventory/alerts', authenticate, checkPermission('inventory', 'read'), alertsC.listAlerts);
router.get('/inventory/alerts/summary', authenticate, checkPermission('inventory', 'read'), alertsC.getAlertSummary);
router.get('/inventory/alerts/:id', authenticate, checkPermission('inventory', 'read'), alertsC.getAlert);
router.post('/inventory/alerts/check', authenticate, checkPermission('inventory', 'read'), alertsC.checkLowStock);
router.put('/inventory/alerts/:id/acknowledge', authenticate, checkPermission('inventory', 'read'), alertsC.acknowledgeAlert);

// Accounting & Reports
router.get('/inventory/accounting/profit-loss', authenticate, checkPermission('inventory', 'accounting'), accountingC.getShopProfitLoss);
router.get('/inventory/accounting/margins', authenticate, checkPermission('inventory', 'accounting'), accountingC.getProductMargins);
router.get('/inventory/accounting/valuation', authenticate, checkPermission('inventory', 'accounting'), accountingC.getInventoryValuation);
router.get('/inventory/accounting/daily-report', authenticate, checkPermission('inventory', 'accounting'), accountingC.getDailyReport);

// ── DASHBOARDS ────────────────────────────────────────────────
router.get('/dashboard/admin', authenticate, dashC.adminDashboard);
router.get('/dashboard/collector', authenticate, dashC.collectorDashboard);
router.get('/dashboard/finance', authenticate, dashC.financeDashboard);
router.get('/dashboard/director', authenticate, dashC.directorDashboard);

// ── STAFF ─────────────────────────────────────────────────────
const staffC = require('../controllers/staff.controller');
const { uploadEmployee } = require('../middleware/upload');

router.get('/staff/organization', authenticate, checkPermission('staff', 'read'), staffC.getOrganization);
router.get('/staff/departments', authenticate, checkPermission('staff', 'read'), staffC.listDepartments);
router.post('/staff/departments', authenticate, checkPermission('staff', 'write'), staffC.createDepartment);
router.put('/staff/departments/:id', authenticate, checkPermission('staff', 'write'), staffC.updateDepartment);
router.delete('/staff/departments/:id', authenticate, checkPermission('staff', 'write'), staffC.deleteDepartment);
router.get('/staff/positions', authenticate, checkPermission('staff', 'read'), staffC.listPositions);
router.post('/staff/positions', authenticate, checkPermission('staff', 'write'), staffC.createPosition);
router.put('/staff/positions/:id', authenticate, checkPermission('staff', 'write'), staffC.updatePosition);
router.delete('/staff/positions/:id', authenticate, checkPermission('staff', 'write'), staffC.deletePosition);
router.get('/staff/employees', authenticate, checkPermission('staff', 'read'), staffC.listEmployees);
router.get('/staff/employees/:id', authenticate, checkPermission('staff', 'read'), staffC.getEmployee);
router.post('/staff/employees', authenticate, checkPermission('staff', 'write'), uploadEmployee, staffC.createEmployee);
router.put('/staff/employees/:id', authenticate, checkPermission('staff', 'write'), uploadEmployee, staffC.updateEmployee);
router.delete('/staff/employees/:id', authenticate, checkPermission('staff', 'write'), staffC.deleteEmployee);
router.get('/staff/roles', authenticate, checkPermission('staff', 'read'), usersC.listRoles);

module.exports = router;
