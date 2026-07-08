const debtService = require('../services/debt.service');

const list = async (req, res, next) => {
  try {
    const data = await debtService.list(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const debt = await debtService.create(req.body, req.user.id);
    res.status(201).json({ success: true, data: debt });
  } catch (err) { next(err); }
};

const recordPayment = async (req, res, next) => {
  try {
    const receiptUrl = req.file?.path || null;

    const amount = parseInt(req.body.amount, 10);
    const debt = await debtService.recordPayment(req.params.id, amount, req.user.id, receiptUrl);
    if (!debt) return res.status(404).json({ success: false, message: 'Debt not found' });
    res.json({ success: true, data: debt });
  } catch (err) { next(err); }
};

const writeOff = async (req, res, next) => {
  try {
    const debt = await debtService.writeOff(req.params.id, req.body.reason);
    if (!debt) return res.status(404).json({ success: false, message: 'Debt not found' });
    res.json({ success: true, data: debt });
  } catch (err) { next(err); }
};

const exportDebts = async (req, res, next) => {
  try {
    const buffer = await debtService.exportDebtsExcel(req.query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=debts-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  } catch (err) { next(err); }
};

module.exports = { list, create, recordPayment, writeOff, exportDebts };