// controllers/finance.controller.js
const financeService = require('../services/finance.service');
const { Expense, Invoice, Payroll, CreditNote, Payment, ExpenseCategory } = require('../models');

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

const listExpenses = async (req, res, next) => {
  try {
    const { status, category_id, shop_id, limit = 50, offset = 0 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (category_id) where.category_id = category_id;
    if (shop_id) where.shop_id = shop_id;
    const data = await Expense.findAndCountAll({
      where, limit: +limit, offset: +offset,
      include: [
        { model: ExpenseCategory, as: 'category' },
        { model: require('../models').User, as: 'submitter', attributes: ['name'] },
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

const exportCollections = async (req, res, next) => {
  try {
    const buffer = await financeService.exportCollectionsExcel({});
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="collections.xlsx"' });
    res.send(buffer);
  } catch (err) { next(err); }
};

module.exports = { submitExpense, getPendingExpenses, approveExpense, listExpenses, createInvoice, listInvoices, downloadInvoicePDF, recordPayment, listPayroll, createPayroll, exportCollections };
