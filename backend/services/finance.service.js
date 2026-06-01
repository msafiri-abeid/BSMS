// services/finance.service.js
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { Expense, Invoice, Payment, CreditNote, Payroll, ExpenseCategory, Partner, Shop, Setting, User } = require('../models');

const getSetting = async (key, def) => {
  const row = await Setting.findOne({ where: { key } });
  return row ? row.value : def;
};

const submitExpense = async (data, userId) => {
  return Expense.create({ ...data, submitted_by: userId, status: 'pending' });
};

const approveExpense = async (expenseId, action, reason, userId) => {
  const expense = await Expense.findByPk(expenseId);
  if (!expense || expense.status !== 'pending') throw new Error('Expense not found or already processed');
  const updates = {
    status: action === 'approve' ? 'approved' : 'rejected',
    approved_by: userId,
    approved_at: new Date(),
  };
  if (action === 'reject') updates.rejection_reason = reason;
  return expense.update(updates);
};

const createInvoice = async (data, userId) => {
  const prefix = await getSetting('invoice_prefix', 'INV-');
  const count = await Invoice.count();
  const reference_no = `${prefix}${String(count + 1).padStart(5, '0')}`;
  const subtotal = data.line_items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const tax_amount = Math.round(subtotal * (data.tax_pct || 0) / 100);
  const total = subtotal + tax_amount;
  return Invoice.create({ ...data, reference_no, subtotal, tax_amount, total, generated_by: userId });
};

const recordPayment = async (invoiceId, paymentData, userId) => {
  const invoice = await Invoice.findByPk(invoiceId);
  if (!invoice) throw new Error('Invoice not found');
  const payment = await Payment.create({ ...paymentData, invoice_id: invoiceId, recorded_by: userId });
  const totalPaid = await Payment.sum('amount', { where: { invoice_id: invoiceId } });
  if (totalPaid >= invoice.total) await invoice.update({ status: 'paid' });
  return payment;
};

const generateInvoicePDF = (invoice) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ margin: 50 });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  doc.fontSize(20).text('BENTABET LTD', 50, 50);
  doc.fontSize(12).text('Invoice', 50, 80);
  doc.text(`Reference: ${invoice.reference_no}`, 50, 100);
  doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 50, 115);
  if (invoice.due_date) doc.text(`Due: ${invoice.due_date}`, 50, 130);

  let y = 180;
  doc.fontSize(10)
    .text('Item', 50, y).text('Qty', 300, y).text('Unit Price', 380, y).text('Total', 470, y);
  doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();

  y += 30;
  (invoice.line_items || []).forEach(item => {
    doc.text(item.description, 50, y)
       .text(item.qty, 300, y)
       .text(`TZS ${item.unit_price?.toLocaleString()}`, 360, y)
       .text(`TZS ${(item.qty * item.unit_price)?.toLocaleString()}`, 460, y);
    y += 20;
  });

  y += 10;
  doc.moveTo(50, y).lineTo(550, y).stroke();
  y += 15;
  doc.text(`Subtotal: TZS ${invoice.subtotal?.toLocaleString()}`, 400, y);
  y += 15;
  doc.text(`Tax (${invoice.tax_pct}%): TZS ${invoice.tax_amount?.toLocaleString()}`, 400, y);
  y += 15;
  doc.fontSize(12).text(`TOTAL: TZS ${invoice.total?.toLocaleString()}`, 400, y);

  if (invoice.notes) {
    y += 40;
    doc.fontSize(10).text('Notes:', 50, y);
    doc.text(invoice.notes, 50, y + 15);
  }
  doc.end();
});

const createPayrollRun = async (data, userId) => {
  const employees = await require('../models').Employee.findAll({ where: { status: 'active' } });
  const runs = await Promise.all(employees.map(emp =>
    Payroll.create({
      employee_id: emp.id,
      period_start: data.period_start,
      period_end: data.period_end,
      basic_salary: emp.basic_salary,
      allowances: 0,
      deductions: 0,
      net_pay: emp.basic_salary,
      status: 'draft',
    })
  ));
  return runs;
};

const exportCollectionsExcel = async (filters) => {
  const { Collection, Machine, Shop, User } = require('../models');
  const collections = await Collection.findAll({
    include: [
      { model: Machine, as: 'machine', attributes: ['slot_code', 'manufacturer'] },
      { model: Shop, as: 'shop', attributes: ['name'] },
      { model: User, as: 'collector', attributes: ['name'] },
    ],
    where: filters,
    order: [['collected_at', 'DESC']],
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Collections');
  ws.columns = [
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Slot Code', key: 'slot_code', width: 15 },
    { header: 'Shop', key: 'shop', width: 20 },
    { header: 'Collector', key: 'collector', width: 20 },
    { header: 'Prev Count', key: 'prev_count', width: 15 },
    { header: 'Curr Count', key: 'curr_count', width: 15 },
    { header: 'Difference', key: 'difference', width: 15 },
    { header: 'Gross (TZS)', key: 'gross_tzs', width: 15 },
    { header: 'Office (TZS)', key: 'office_tzs', width: 15 },
    { header: 'Owner (TZS)', key: 'owner_tzs', width: 15 },
    { header: 'Net (TZS)', key: 'net_tzs', width: 15 },
  ];

  collections.forEach(c => {
    ws.addRow({
      date: new Date(c.collected_at).toLocaleString(),
      slot_code: c.machine?.slot_code,
      shop: c.shop?.name,
      collector: c.collector?.name,
      prev_count: c.prev_count,
      curr_count: c.curr_count,
      difference: c.difference,
      gross_tzs: c.gross_tzs,
      office_tzs: c.office_tzs,
      owner_tzs: c.owner_tzs,
      net_tzs: c.net_tzs,
    });
  });

  ws.getRow(1).font = { bold: true };
  return wb.xlsx.writeBuffer();
};

module.exports = { submitExpense, approveExpense, createInvoice, recordPayment, generateInvoicePDF, createPayrollRun, exportCollectionsExcel };
