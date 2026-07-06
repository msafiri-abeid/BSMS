// routes/index.js
const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth');
const { uploadContract, uploadDocuments, uploadReceipt, uploadMeter, uploadTicket, uploadEmployee } = require('../middleware/upload');

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
const stockC = require('../controllers/inventory.stock.controller');

// ── AUTH ──────────────────────────────────────────────────────
router.post('/auth/register', authC.register);
router.post('/auth/login', authC.login);
router.post('/auth/refresh', authC.refresh);
router.post('/auth/logout', authC.logout);
router.get('/auth/me', authenticate, authC.me);
router.put('/auth/password', authenticate, authC.changePassword);
router.put('/auth/profile', authenticate, authC.updateProfile);
router.post('/auth/profile/documents', authenticate, uploadEmployee, authC.uploadProfileDocs);
router.delete('/auth/profile/documents', authenticate, authC.deleteProfileDoc);

// ── USERS ─────────────────────────────────────────────────────
const usersC = require('../controllers/users.controller');
router.get('/users', authenticate, checkPermission('users', 'read'), usersC.listUsers);
router.post('/users', authenticate, checkPermission('users', 'create'), usersC.createUser);
router.put('/users/:id', authenticate, checkPermission('users', 'update'), usersC.updateUser);

// ── PARTNERS & SHOPS ──────────────────────────────────────────
router.get('/partners', authenticate, checkPermission('partners', 'read'), partnerC.listPartners);
router.get('/partners/own', authenticate, checkPermission('partners', 'read'), partnerC.listOwnPartners);
router.post('/partners', authenticate, checkPermission('partners', 'create'), uploadDocuments, partnerC.createPartner);
router.put('/partners/:id', authenticate, checkPermission('partners', 'update'), uploadDocuments, partnerC.updatePartner);
router.delete('/partners/:id', authenticate, checkPermission('partners', 'delete'), partnerC.deletePartner);
router.get('/partners/:id', authenticate, checkPermission('partners', 'read'), partnerC.getPartner);
router.get('/shops', authenticate, checkPermission('shops', 'read'), partnerC.listShops);
router.post('/shops', authenticate, checkPermission('shops', 'create'), uploadDocuments, partnerC.createShop);
router.put('/shops/:id', authenticate, checkPermission('shops', 'update'), uploadDocuments, partnerC.updateShop);
router.delete('/shops/:id', authenticate, checkPermission('shops', 'delete'), partnerC.deleteShop);
router.get('/shops/:id', authenticate, checkPermission('shops', 'read'), partnerC.getShop);
router.get('/regions', authenticate, partnerC.listRegions);
router.get('/districts', authenticate, partnerC.listDistricts);
router.get('/wards', authenticate, partnerC.listWards);
router.get('/streets', authenticate, partnerC.listStreets);

// ── MACHINES ──────────────────────────────────────────────────
router.get('/machines', authenticate, checkPermission('machines', 'read'), machineC.list);
router.post('/machines', authenticate, checkPermission('machines', 'create'), machineC.create);
router.get('/machines/:id', authenticate, checkPermission('machines', 'read'), machineC.getOne);
router.get('/machines/:id/stats', authenticate, checkPermission('machines', 'read'), machineC.getMachineStats);
router.put('/machines/:id', authenticate, checkPermission('machines', 'update'), machineC.update);
router.delete('/machines/:id', authenticate, checkPermission('machines', 'delete'), machineC.remove);
router.post('/machines/:id/deploy', authenticate, checkPermission('machines', 'create'), machineC.deploy);
router.post('/machines/:id/exchange', authenticate, checkPermission('machines', 'create'), machineC.exchange);
router.post('/machines/:id/refill', authenticate, checkPermission('machines', 'create'), machineC.refill);
router.get('/machines/export', authenticate, checkPermission('machines', 'read'), machineC.exportExcel);
router.get('/machines/:id/pdf', authenticate, checkPermission('machines', 'read'), machineC.downloadPDF);
router.post('/machines/:id/collections', authenticate, checkPermission('machines', 'create'), machineC.recordCollection);

// ── COLLECTIONS ───────────────────────────────────────────────
router.get('/collections/my-assignments', authenticate, collectionC.myAssignments);
router.get('/collections/assignments', authenticate, checkPermission('collections', 'read'), collectionC.listAssignments);
router.post('/collections/assignments', authenticate, checkPermission('collections', 'create'), collectionC.createAssignment);
router.put('/collections/assignments/:id', authenticate, checkPermission('collections', 'update'), collectionC.editAssignment);
router.delete('/collections/assignments/:id', authenticate, checkPermission('collections', 'delete'), collectionC.deleteAssignment);
router.get('/collections', authenticate, checkPermission('collections', 'read'), collectionC.list);
router.post('/collections', authenticate, uploadMeter.single('meter_image'), collectionC.submit);
router.post('/collections/assignments/:id/open', authenticate, collectionC.openMachine);
router.get('/collections/assignments/export', authenticate, checkPermission('collections', 'read'), collectionC.exportAssignments);
router.get('/collections/weekly-targets', authenticate, checkPermission('collections', 'read'), collectionC.weeklyTargets);
router.put('/collections/:id', authenticate, uploadMeter.single('meter_image'), (req, res, next) => {
  const allowed = ['Admin', 'General Manager', 'Operations Manager', 'Supervisor', 'Cashier'];
  if (allowed.includes(req.user.role?.name)) return collectionC.update(req, res, next);
  return res.status(403).json({ success: false, message: 'Permission denied' });
});
router.delete('/collections/:id', authenticate, (req, res, next) => {
  const allowed = ['Admin', 'General Manager', 'Operations Manager', 'Cashier'];
  if (allowed.includes(req.user.role?.name)) return collectionC.remove(req, res, next);
  return res.status(403).json({ success: false, message: 'Permission denied' });
});

// ── FINANCE ───────────────────────────────────────────────────
router.get('/finance/expenses', authenticate, checkPermission('finance', 'read'), financeC.listExpenses);
router.post('/finance/expenses', authenticate, checkPermission('finance', 'create'), uploadReceipt.single('receipt'), financeC.submitExpense);
router.put('/finance/expenses/:id', authenticate, checkPermission('finance', 'update'), uploadReceipt.single('receipt'), financeC.updateExpense);
router.delete('/finance/expenses/:id', authenticate, checkPermission('finance', 'delete'), financeC.removeExpense);
router.get('/finance/expenses/categories', authenticate, financeC.listCategories);
router.get('/finance/shop-cash', authenticate, checkPermission('finance', 'read'), financeC.listShopCashDispositions);
router.post('/finance/shop-cash', authenticate, checkPermission('finance', 'create'), uploadReceipt.fields([{ name: 'selcom_receipt', maxCount: 1 }, { name: 'bank_deposit_receipt', maxCount: 1 }]), financeC.submitShopCashDisposition);
router.put('/finance/shop-cash/:id/approve', authenticate, checkPermission('finance', 'approve'), financeC.approveShopCashDisposition);
router.get('/finance/expenses/pending', authenticate, checkPermission('finance', 'approve'), financeC.getPendingExpenses);
router.put('/finance/expenses/:id/approve', authenticate, checkPermission('finance', 'approve'), financeC.approveExpense);
router.get('/finance/invoices', authenticate, checkPermission('finance', 'read'), financeC.listInvoices);
router.post('/finance/invoices', authenticate, checkPermission('finance', 'create'), financeC.createInvoice);
router.get('/finance/invoices/:id/pdf', authenticate, financeC.downloadInvoicePDF);
router.post('/finance/invoices/:id/payment', authenticate, checkPermission('finance', 'create'), financeC.recordPayment);
router.get('/finance/payroll', authenticate, checkPermission('finance', 'read'), financeC.listPayroll);
router.post('/finance/payroll', authenticate, checkPermission('finance', 'create'), financeC.createPayroll);
router.get('/finance/export/collections', authenticate, checkPermission('reports', 'read'), financeC.exportCollections);

// ── ACCOUNTING ─────────────────────────────────────────────────
router.get('/finance/accounts', authenticate, checkPermission('accounts', 'read'), financeC.listAccounts);
router.post('/finance/accounts', authenticate, checkPermission('accounts', 'create'), financeC.createAccount);
router.get('/finance/accounts/:id', authenticate, checkPermission('accounts', 'read'), financeC.getAccount);
router.put('/finance/accounts/:id', authenticate, checkPermission('accounts', 'update'), financeC.updateAccount);
router.delete('/finance/accounts/:id', authenticate, checkPermission('accounts', 'delete'), financeC.deleteAccount);
router.get('/finance/accounts/:id/transactions', authenticate, checkPermission('accounts', 'read'), financeC.listTransactions);
router.post('/finance/accounts/transfer', authenticate, checkPermission('accounts', 'create'), financeC.transferAccounts);
router.get('/finance/reports/balance-sheet', authenticate, checkPermission('accounts', 'read'), financeC.balanceSheet);
router.get('/finance/reports/trial-balance', authenticate, checkPermission('accounts', 'read'), financeC.trialBalance);
router.get('/finance/reports/cash-flow', authenticate, checkPermission('accounts', 'read'), financeC.cashFlow);
router.get('/finance/reports/account-report/:id', authenticate, checkPermission('accounts', 'read'), financeC.accountReport);

// ── TICKETS ───────────────────────────────────────────────────
router.get('/tickets', authenticate, ticketC.list);
router.post('/tickets', authenticate, uploadTicket.array('attachments', 5), ticketC.create);
router.get('/tickets/counts', authenticate, ticketC.dashboardCounts);
router.get('/tickets/groups', authenticate, ticketC.listGroups);
router.get('/tickets/:id', authenticate, ticketC.getOne);
router.put('/tickets/:id/status', authenticate, ticketC.updateStatus);
router.post('/tickets/:id/activity', authenticate, uploadTicket.array('attachments', 5), ticketC.addActivity);

// ── DEBTS ──────────────────────────────────────────────────────
const debtC = require('../controllers/debt.controller');

router.get('/debts', authenticate, checkPermission('machines', 'read'), debtC.list);
router.post('/debts', authenticate, checkPermission('machines', 'create'), debtC.create);
router.put('/debts/:id/pay', authenticate, checkPermission('machines', 'update'), uploadReceipt.single('receipt'), debtC.recordPayment);
router.put('/debts/:id/write-off', authenticate, checkPermission('machines', 'update'), debtC.writeOff);
router.get('/debts/export', authenticate, checkPermission('machines', 'read'), debtC.exportDebts);

// ── SETTINGS ──────────────────────────────────────────────────
router.get('/settings', authenticate, settingsC.getAll);
router.put('/settings', authenticate, checkPermission('settings', 'update'), settingsC.bulkUpdate);
router.get('/settings/roles', authenticate, checkPermission('settings', 'read'), settingsC.getRoles);
router.post('/settings/roles', authenticate, checkPermission('settings', 'create'), settingsC.createRole);
router.put('/settings/roles/:roleId', authenticate, checkPermission('settings', 'update'), settingsC.updateRole);
router.delete('/settings/roles/:roleId', authenticate, checkPermission('settings', 'delete'), settingsC.deleteRole);
router.put('/settings/roles/:roleId/permissions', authenticate, checkPermission('settings', 'update'), settingsC.updatePermissions);
router.post('/settings/sms-test', authenticate, checkPermission('settings', 'create'), settingsC.testSMS);

// Settings – Modules list
router.get('/settings/modules', authenticate, settingsC.listModules);

// Settings – Business management (own-partners)
router.get('/settings/businesses', authenticate, checkPermission('settings', 'read'), settingsC.listBusinesses);
router.put('/settings/businesses/:id', authenticate, checkPermission('settings', 'update'), settingsC.updateBusiness);

// ── INVENTORY ─────────────────────────────────────────────────
const { Product, StockMovement, StockLevel } = require('../models');

// Token-specific controller
const tokenC = require('../controllers/token.controller');

// Token operations
router.get('/inventory/tokens', authenticate, checkPermission('inventory', 'read'), tokenC.movements);
router.post('/inventory/tokens', authenticate, checkPermission('inventory', 'create'), tokenC.addMovement);
router.get('/tokens/balances', authenticate, checkPermission('inventory', 'read'), tokenC.balances);
router.post('/tokens/distribute', authenticate, checkPermission('inventory', 'create'), tokenC.distribute);
router.post('/tokens/return', authenticate, checkPermission('inventory', 'create'), tokenC.returnTokens);
router.post('/tokens/lend', authenticate, checkPermission('inventory', 'create'), tokenC.lend);
router.get('/inventory/products', authenticate, checkPermission('inventory', 'read'), async (req, res, next) => {
  try {
    const products = await Product.findAll({ where: req.query.shop_id ? { shop_id: req.query.shop_id } : {}, include: [{ model: StockLevel, as: 'stockLevel' }] });
    res.json({ success: true, data: products });
  } catch (err) { next(err); }
});
router.post('/inventory/products', authenticate, checkPermission('inventory', 'create'), async (req, res, next) => {
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
router.post('/inventory/stock/add', authenticate, checkPermission('inventory', 'create'), uploadReceipt.single('receipt'), stockC.addStock);

// Sales
router.get('/inventory/sales', authenticate, checkPermission('inventory', 'read'), salesC.listSales);
router.get('/inventory/sales/:id', authenticate, checkPermission('inventory', 'read'), salesC.getSale);
router.post('/inventory/sales', authenticate, checkPermission('inventory', 'create'), salesC.recordSale);
router.post('/inventory/sales/:id/payment', authenticate, checkPermission('inventory', 'create'), salesC.recordPayment);
router.get('/inventory/sales/report/summary', authenticate, checkPermission('inventory', 'read'), salesC.getSaleReport);

// Stock Audits
router.get('/inventory/audits', authenticate, checkPermission('inventory', 'audit'), auditsC.listAudits);
router.get('/inventory/audits/:id', authenticate, checkPermission('inventory', 'audit'), auditsC.getAudit);
router.post('/inventory/audits', authenticate, checkPermission('inventory', 'audit'), auditsC.startAudit);
router.put('/inventory/audits/item', authenticate, checkPermission('inventory', 'audit'), auditsC.updateAuditItem);
router.put('/inventory/audits/:id/complete', authenticate, checkPermission('inventory', 'audit'), auditsC.completeAudit);
router.put('/inventory/audits/:id/verify', authenticate, checkPermission('inventory', 'audit'), auditsC.verifyAudit);

// Stock Transfers
router.get('/inventory/transfers', authenticate, checkPermission('inventory', 'read'), transfersC.listTransfers);
router.get('/inventory/transfers/:id', authenticate, checkPermission('inventory', 'read'), transfersC.getTransfer);
router.post('/inventory/transfers', authenticate, checkPermission('inventory', 'create'), transfersC.initializeTransfer);
router.put('/inventory/transfers/:id/approve', authenticate, checkPermission('inventory', 'audit'), transfersC.approveTransfer);
router.put('/inventory/transfers/:id/receive', authenticate, checkPermission('inventory', 'update'), transfersC.receiveTransfer);
router.put('/inventory/transfers/:id/cancel', authenticate, checkPermission('inventory', 'update'), transfersC.cancelTransfer);

// Sales Returns
router.get('/inventory/returns', authenticate, checkPermission('inventory', 'read'), returnsC.listReturns);
router.get('/inventory/returns/:id', authenticate, checkPermission('inventory', 'read'), returnsC.getReturn);
router.post('/inventory/returns', authenticate, checkPermission('inventory', 'create'), returnsC.processReturn);
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
router.get('/dashboard/cashier', authenticate, dashC.cashierDashboard);
router.get('/dashboard/sales', authenticate, dashC.salesDashboard);
router.get('/dashboard/technician', authenticate, dashC.technicianDashboard);

// ── STAFF ─────────────────────────────────────────────────────
const staffC = require('../controllers/staff.controller');

router.get('/staff/departments', authenticate, checkPermission('staff', 'read'), staffC.listDepartments);
router.post('/staff/departments', authenticate, checkPermission('staff', 'create'), staffC.createDepartment);
router.put('/staff/departments/:id', authenticate, checkPermission('staff', 'update'), staffC.updateDepartment);
router.delete('/staff/departments/:id', authenticate, checkPermission('staff', 'delete'), staffC.deleteDepartment);
router.get('/staff/positions', authenticate, checkPermission('staff', 'read'), staffC.listPositions);
router.post('/staff/positions', authenticate, checkPermission('staff', 'create'), staffC.createPosition);
router.put('/staff/positions/:id', authenticate, checkPermission('staff', 'update'), staffC.updatePosition);
router.delete('/staff/positions/:id', authenticate, checkPermission('staff', 'delete'), staffC.deletePosition);
router.get('/staff/employees', authenticate, checkPermission('staff', 'read'), staffC.listEmployees);
router.get('/staff/employees/export', authenticate, checkPermission('staff', 'read'), staffC.exportEmployeesExcel);
router.get('/staff/employees/:id', authenticate, checkPermission('staff', 'read'), staffC.getEmployee);
router.post('/staff/employees', authenticate, checkPermission('staff', 'create'), uploadEmployee, staffC.createEmployee);
router.put('/staff/employees/:id', authenticate, checkPermission('staff', 'update'), uploadEmployee, staffC.updateEmployee);
router.delete('/staff/employees/:id', authenticate, checkPermission('staff', 'delete'), staffC.deleteEmployee);
router.delete('/staff/employees/:id/documents', authenticate, checkPermission('staff', 'delete'), staffC.deleteDocument);
router.get('/staff/documents/proxy', authenticate, staffC.proxyDocument);
router.get('/staff/roles', authenticate, checkPermission('staff', 'read'), usersC.listRoles);

module.exports = router;
