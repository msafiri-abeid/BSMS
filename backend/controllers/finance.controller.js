// controllers/finance.controller.js
const financeService = require('../services/finance.service');
const { Expense, Invoice, Payroll, CreditNote, Payment, ExpenseCategory, Collection, Machine, User } = require('../models');

const submitExpense = async (req, res, next) => {
  try {
    const receipt_url = req.file?.path;
    const expense = await financeService.submitExpense({ ...req.body, receipt_url }, req.user.id);
    res.status(201).json({ success: true, data: expense });
  } catch (err) { next(err); }
};

const getPendingExpenses = async (req, res, next) => {
  try {
    const data = await Expense.findAndCountAll({
      where: { status: 'pending' },
      include: [
        { model: require('../models').User, as: 'submitter', attributes: ['name'] },
        { model: ExpenseCategory, as: 'category' },
        { model: require('../models').Shop, as: 'shop', attributes: ['id', 'name'] },
        { model: require('../models').Machine, as: 'machine', attributes: ['id', 'slot_code'] },
      ],
      order: [['created_at', 'ASC']],
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const approveExpense = async (req, res, next) => {
  try {
    const expense = await financeService.approveExpense(req.params.id, req.body.action, req.body.reason, req.user.id);
    res.json({ success: true, data: expense });
  } catch (err) { next(err); }
};

const updateExpense = async (req, res, next) => {
  try {
    const receipt_url = req.file?.path;
    const expense = await financeService.updateExpense(req.params.id, { ...req.body, receipt_url }, req.user.id);
    res.json({ success: true, data: expense });
  } catch (err) { next(err); }
};

const removeExpense = async (req, res, next) => {
  try {
    await financeService.removeExpense(req.params.id);
    res.json({ success: true, message: 'Expense deleted' });
  } catch (err) { next(err); }
};

const listCategories = async (req, res, next) => {
  try {
    const data = await ExpenseCategory.findAll({ where: { is_active: true }, order: [['name', 'ASC']] });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const listExpenses = async (req, res, next) => {
  try {
    const { status, category_id, shop_id, machine_id, business_type, date, limit = 50, offset = 0 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (category_id) where.category_id = category_id;
    if (shop_id) where.shop_id = shop_id;
    if (machine_id) where.machine_id = machine_id;
    if (business_type) where.business_type = business_type;
    if (date) where.expense_date = date;
    const data = await Expense.findAndCountAll({
      where, limit: +limit, offset: +offset,
      include: [
        { model: ExpenseCategory, as: 'category' },
        { model: require('../models').User, as: 'submitter', attributes: ['name'] },
        { model: require('../models').User, as: 'approver', attributes: ['name'] },
        { model: require('../models').Shop, as: 'shop', attributes: ['id', 'name'] },
        { model: require('../models').Machine, as: 'machine', attributes: ['id', 'slot_code'] },
      ],
      order: [['created_at', 'DESC']],
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const createInvoice = async (req, res, next) => {
  try {
    const inv = await financeService.createInvoice(req.body, req.user.id);
    res.status(201).json({ success: true, data: inv });
  } catch (err) { next(err); }
};

const listInvoices = async (req, res, next) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const where = status ? { status } : {};
    const data = await Invoice.findAndCountAll({
      where, limit: +limit, offset: +offset,
      include: [{ model: require('../models').Partner, as: 'partner', attributes: ['name'] }],
      order: [['created_at', 'DESC']],
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const downloadInvoicePDF = async (req, res, next) => {
  try {
    const inv = await Invoice.findByPk(req.params.id);
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
    const pdfBuffer = await financeService.generateInvoicePDF(inv.toJSON());
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${inv.reference_no}.pdf"` });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
};

const recordPayment = async (req, res, next) => {
  try {
    const payment = await financeService.recordPayment(req.params.id, req.body, req.user.id);
    res.status(201).json({ success: true, data: payment });
  } catch (err) { next(err); }
};

const listPayroll = async (req, res, next) => {
  try {
    const data = await Payroll.findAndCountAll({ order: [['created_at', 'DESC']], limit: 100 });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const createPayroll = async (req, res, next) => {
  try {
    const runs = await financeService.createPayrollRun(req.body, req.user.id);
    res.status(201).json({ success: true, data: runs });
  } catch (err) { next(err); }
};

const { ShopCashDisposition, Shop } = require('../models');

const listShopCashDispositions = async (req, res, next) => {
  try {
    const { shop_id, date_from, date_to } = req.query;
    const where = {};
    if (shop_id) where.shop_id = shop_id;
    if (date_from) where.date = { ...where.date, [require('sequelize').Op.gte]: date_from };
    if (date_to) where.date = { ...where.date, [require('sequelize').Op.lte]: date_to };
    const data = await ShopCashDisposition.findAll({
      where,
      include: [{ model: Shop, as: 'shop', attributes: ['id', 'name'] }],
      order: [['date', 'DESC']],
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const submitShopCashDisposition = async (req, res, next) => {
  try {
    const { shop_id, date, selcom_tzs, cash_allocation, bank_deposit_amount, notes } = req.body;
    if (!shop_id || !date) return res.status(400).json({ success: false, message: 'shop_id and date required' });

    // Calculate total gross from approved collections for this shop/date
    const grossResult = await require('../models').Collection.findAll({
      attributes: [[require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('gross_tzs')), 0), 'total']],
      where: { shop_id, collection_date: date, status: 'approved' },
      raw: true,
    });
    const totalGross = parseInt(grossResult[0]?.total || 0);
    const selcom = parseInt(selcom_tzs) || 0;
    const cashAtHand = totalGross - selcom;
    const selcom_receipt_url = req.files?.selcom_receipt?.[0]?.path || req.body.selcom_receipt_url || null;
    const bank_deposit_receipt_url = req.files?.bank_deposit_receipt?.[0]?.path || req.body.bank_deposit_receipt_url || null;

    const [disp, created] = await ShopCashDisposition.upsert({
      shop_id, date,
      total_gross_tzs: totalGross,
      selcom_tzs: selcom,
      cash_at_hand_tzs: cashAtHand,
      selcom_receipt_url,
      cash_allocation: cash_allocation || null,
      bank_deposit_receipt_url: cash_allocation === 'deposit' ? bank_deposit_receipt_url : null,
      bank_deposit_amount: cash_allocation === 'deposit' ? (parseInt(bank_deposit_amount) || cashAtHand) : null,
      status: 'pending',
      submitted_by: req.user.id,
      notes: notes || '',
    });

    res.status(created ? 201 : 200).json({ success: true, data: disp });
  } catch (err) { next(err); }
};

const approveShopCashDisposition = async (req, res, next) => {
  try {
    const disp = await financeService.approveShopCashDisposition(req.params.id, req.body.action, req.body.reason, req.user.id);
    res.json({ success: true, data: disp });
  } catch (err) { next(err); }
};

const exportCollections = async (req, res, next) => {
  try {
    const buffer = await financeService.exportCollectionsExcel(req.query);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="collections.xlsx"' });
    res.send(buffer);
  } catch (err) { next(err); }
};

// ── ACCOUNTING HANDLERS ────────────────────────────────────────

const listAccounts = async (req, res, next) => {
  try {
    const data = await financeService.listAccounts(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const createAccount = async (req, res, next) => {
  try {
    const account = await financeService.createAccount(req.body, req.user.id);
    res.status(201).json({ success: true, data: account });
  } catch (err) { next(err); }
};

const getAccount = async (req, res, next) => {
  try {
    const account = await financeService.getAccount(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json({ success: true, data: account });
  } catch (err) { next(err); }
};

const updateAccount = async (req, res, next) => {
  try {
    const account = await financeService.updateAccount(req.params.id, req.body);
    res.json({ success: true, data: account });
  } catch (err) { next(err); }
};

const deleteAccount = async (req, res, next) => {
  try {
    await financeService.deleteAccount(req.params.id);
    res.json({ success: true, message: 'Account deleted' });
  } catch (err) { next(err); }
};

const listTransactions = async (req, res, next) => {
  try {
    const data = await financeService.listAccountTransactions(req.params.id, req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const transferAccounts = async (req, res, next) => {
  try {
    const result = await financeService.transferBetweenAccounts(req.body, req.user.id);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

const balanceSheet = async (req, res, next) => {
  try {
    const report = await financeService.generateBalanceSheet(req.query);
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

const trialBalance = async (req, res, next) => {
  try {
    const report = await financeService.generateTrialBalance(req.query);
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

const cashFlow = async (req, res, next) => {
  try {
    const report = await financeService.generateCashFlow(req.query);
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

const accountReport = async (req, res, next) => {
  try {
    const report = await financeService.generateAccountReport(req.params.id, req.query);
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

module.exports = {
  submitExpense, updateExpense, removeExpense, getPendingExpenses, approveExpense, listExpenses, listCategories,
  createInvoice, listInvoices, downloadInvoicePDF, recordPayment, listPayroll, createPayroll, exportCollections,
  listAccounts, createAccount, getAccount, updateAccount, deleteAccount,
  listTransactions, transferAccounts,
  balanceSheet, trialBalance, cashFlow, accountReport,
  listShopCashDispositions, submitShopCashDisposition, approveShopCashDisposition,
};
