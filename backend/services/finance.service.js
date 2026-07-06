// services/finance.service.js
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { Expense, Invoice, Payment, CreditNote, Payroll, ExpenseCategory, Partner, Shop, Machine, Setting, User, Account, AccountTransaction, AccountTransfer, ShopCashDisposition } = require('../models');

const getSetting = async (key, def) => {
  const row = await Setting.findOne({ where: { key } });
  return row ? row.value : def;
};

const submitExpense = async (data, userId) => {
  const expense_date = data.expense_date || new Date().toISOString().split('T')[0];
  return Expense.create({ ...data, expense_date, submitted_by: userId, status: 'pending' });
};

const approveExpense = async (expenseId, action, reason, userId) => {
  const expense = await Expense.findByPk(expenseId, { include: [{ model: ExpenseCategory, as: 'category' }] });
  if (!expense || expense.status !== 'pending') throw new Error('Expense not found or already processed');
  const updates = {
    status: action === 'approve' ? 'approved' : 'rejected',
    approved_by: userId,
    approved_at: new Date(),
  };
  if (action === 'reject') updates.rejection_reason = reason;
  await expense.update(updates);

  // Auto-record account transaction for approved expenses
  if (action === 'approve') {
    try {
      const paymentSource = expense.payment_source || 'cash';
      const accountType = paymentSource === 'selcom' ? 'selcom' : 'cash';
      const bizType = expense.business_type || 'meteora';

      let account = null;
      if (bizType === 'bentabet') {
        // Bentabet expenses: find bentabet-type account
        if (accountType === 'selcom') {
          account = await Account.findOne({ where: { name: 'Bentabet Revenue Account', is_active: true } });
        } else {
          // Try shop-specific cash float first, then fall back to a generic bentabet cash account
          account = expense.shop_id
            ? await Account.findOne({ where: { shop_id: expense.shop_id, account_type: 'cash', business_type: 'bentabet', is_active: true } })
            : null;
        }
      } else {
        // Meteora expenses: existing behavior
        const shopAccount = expense.shop_id
          ? await Account.findOne({ where: { shop_id: expense.shop_id, account_type: accountType, is_active: true } })
          : null;
        account = shopAccount || await Account.findOne({ where: { name: accountType === 'selcom' ? 'Main Selcom Account' : 'Main Office Cash', is_active: true } });
      }

      if (account) {
        const amount = expense.amount;
        const balance_before = account.current_balance;
        const balance_after = balance_before - amount;
        await AccountTransaction.create({
          account_id: account.id,
          type: 'out',
          amount,
          balance_before,
          balance_after,
          reference_type: 'expense',
          reference_id: expense.id,
          payment_method: paymentSource === 'selcom' ? 'mobile_money' : 'cash',
          description: `Expense (${bizType}): ${expense.category?.name || 'General'} - ${expense.description?.substring(0, 100)}`,
          recorded_by: userId,
          transaction_date: new Date().toISOString().split('T')[0],
        });
        await account.update({ current_balance: balance_after });
      }
    } catch (err) {
      console.warn('[ACCOUNTING] Failed to auto-record expense transaction:', err.message);
    }
  }

  return expense;
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

  // Auto-record account transaction for invoice payment
  try {
    const account = await Account.findOne({ where: { name: 'Main Bank Account', is_active: true } });
    if (account) {
      const amount = paymentData.amount || 0;
      const balance_before = account.current_balance;
      const balance_after = balance_before + amount;
      await AccountTransaction.create({
        account_id: account.id,
        type: 'in',
        amount,
        balance_before,
        balance_after,
        reference_type: 'sale',
        reference_id: invoiceId,
        payment_method: paymentData.method || 'bank_transfer',
        description: `Invoice payment: ${invoice.reference_no}`,
        recorded_by: userId,
        transaction_date: new Date().toISOString().split('T')[0],
      });
      await account.update({ current_balance: balance_after });
    }
  } catch (err) {
    console.warn('[ACCOUNTING] Failed to auto-record payment transaction:', err.message);
  }

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

// ── ACCOUNTING ─────────────────────────────────────────────────

const listAccounts = async (query) => {
  const { account_type, shop_id, is_active, limit = 50, offset = 0 } = query;
  const where = {};
  if (account_type) where.account_type = account_type;
  if (shop_id) where.shop_id = shop_id;
  if (is_active !== undefined) where.is_active = is_active === 'true' || is_active === true;
  return Account.findAndCountAll({
    where,
    limit: +limit,
    offset: +offset,
    include: [
      { model: Shop, as: 'shop', attributes: ['id', 'name'] },
      { model: User, as: 'creator', attributes: ['name'] },
    ],
    order: [['name', 'ASC']],
  });
};

const createAccount = async (data, userId) => {
  const account = await Account.create({
    ...data,
    current_balance: data.opening_balance || 0,
    created_by: userId,
  });

  // Record opening balance transaction if non-zero
  if ((data.opening_balance || 0) > 0) {
    await AccountTransaction.create({
      account_id: account.id,
      type: 'in',
      amount: data.opening_balance,
      balance_before: 0,
      balance_after: data.opening_balance,
      reference_type: 'opening_balance',
      payment_method: 'internal',
      description: 'Opening balance',
      recorded_by: userId,
      transaction_date: new Date().toISOString().split('T')[0],
    });
  }

  return Account.findByPk(account.id, {
    include: [
      { model: Shop, as: 'shop', attributes: ['id', 'name'] },
      { model: User, as: 'creator', attributes: ['name'] },
    ],
  });
};

const getAccount = async (id) => {
  return Account.findByPk(id, {
    include: [
      { model: Shop, as: 'shop', attributes: ['id', 'name'] },
      { model: User, as: 'creator', attributes: ['name'] },
    ],
  });
};

const updateAccount = async (id, data) => {
  const account = await Account.findByPk(id);
  if (!account) throw new Error('Account not found');
  const diff = (data.opening_balance || 0) - (account.opening_balance || 0);
  await account.update({
    ...data,
    current_balance: account.current_balance + diff,
  });
  return Account.findByPk(id, {
    include: [
      { model: Shop, as: 'shop', attributes: ['id', 'name'] },
      { model: User, as: 'creator', attributes: ['name'] },
    ],
  });
};

const deleteAccount = async (id) => {
  const account = await Account.findByPk(id);
  if (!account) throw new Error('Account not found');
  const txCount = await AccountTransaction.count({ where: { account_id: id } });
  if (txCount > 0) {
    throw new Error('Cannot delete account with transactions. Deactivate it instead.');
  }
  return account.destroy();
};

const listAccountTransactions = async (accountId, query) => {
  const { date_from, date_to, type, reference_type, limit = 50, offset = 0 } = query;
  const where = { account_id: accountId };
  if (date_from) where.transaction_date = { ...where.transaction_date, [Op.gte]: date_from };
  if (date_to) where.transaction_date = { ...where.transaction_date, [Op.lte]: date_to };
  if (type) where.type = type;
  if (reference_type) where.reference_type = reference_type;
  return AccountTransaction.findAndCountAll({
    where,
    limit: +limit,
    offset: +offset,
    include: [
      { model: User, as: 'recorder', attributes: ['name'] },
    ],
    order: [['transaction_date', 'DESC'], ['id', 'DESC']],
  });
};

const transferBetweenAccounts = async (data, userId) => {
  const { from_account_id, to_account_id, amount, description } = data;
  if (from_account_id === to_account_id) throw new Error('Cannot transfer to the same account');
  if (!amount || amount <= 0) throw new Error('Invalid amount');

  const fromAccount = await Account.findByPk(from_account_id);
  const toAccount = await Account.findByPk(to_account_id);
  if (!fromAccount || !toAccount) throw new Error('Account not found');
  if (fromAccount.current_balance < amount) throw new Error('Insufficient balance in source account');

  const today = new Date().toISOString().split('T')[0];

  // Debit from source (money out)
  const fromBalanceBefore = fromAccount.current_balance;
  const fromBalanceAfter = fromBalanceBefore - amount;
  await AccountTransaction.create({
    account_id: from_account_id,
    type: 'out',
    amount,
    balance_before: fromBalanceBefore,
    balance_after: fromBalanceAfter,
    reference_type: 'transfer',
    payment_method: 'internal',
    description: description || `Transfer to ${toAccount.name}`,
    recorded_by: userId,
    transaction_date: today,
  });
  await fromAccount.update({ current_balance: fromBalanceAfter });

  // Credit to destination (money in)
  const toBalanceBefore = toAccount.current_balance;
  const toBalanceAfter = toBalanceBefore + amount;
  await AccountTransaction.create({
    account_id: to_account_id,
    type: 'in',
    amount,
    balance_before: toBalanceBefore,
    balance_after: toBalanceAfter,
    reference_type: 'transfer',
    payment_method: 'internal',
    description: description || `Transfer from ${fromAccount.name}`,
    recorded_by: userId,
    transaction_date: today,
  });
  await toAccount.update({ current_balance: toBalanceAfter });

  // Record the transfer
  return AccountTransfer.create({
    from_account_id,
    to_account_id,
    amount,
    description: description || `Transfer from ${fromAccount.name} to ${toAccount.name}`,
    status: 'approved',
    recorded_by: userId,
    approved_by: userId,
  });
};

// ── REPORTS ────────────────────────────────────────────────────

const generateBalanceSheet = async (query) => {
  const { as_of_date } = query;
  const date = as_of_date || new Date().toISOString().split('T')[0];

  const accounts = await Account.findAll({
    where: { is_active: true },
    include: [{ model: Shop, as: 'shop', attributes: ['id', 'name'] }],
    order: [['account_type', 'ASC'], ['name', 'ASC']],
  });

  // Get revenue (in transactions for collections and sales)
  const revenueResult = await AccountTransaction.findAll({
    where: {
      type: 'in',
      transaction_date: { [Op.lte]: date },
      reference_type: { [Op.in]: ['collection', 'sale'] },
    },
    attributes: [
      [require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('amount')), 0), 'total'],
    ],
    raw: true,
  });
  const totalRevenue = Number(revenueResult[0]?.total || 0);

  // Get expenses (out transactions for expenses)
  const expenseResult = await AccountTransaction.findAll({
    where: {
      type: 'out',
      transaction_date: { [Op.lte]: date },
      reference_type: 'expense',
    },
    attributes: [
      [require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('amount')), 0), 'total'],
    ],
    raw: true,
  });
  const totalExpenses = Number(expenseResult[0]?.total || 0);

  const netIncome = totalRevenue - totalExpenses;

  const assets = accounts.filter(a => a.account_type !== 'mobile_money' || true).map(a => ({
    id: a.id,
    name: a.name,
    type: a.account_type,
    shop: a.shop?.name || null,
    balance: a.current_balance,
  }));

  // Group by asset type
  const cashAccounts = assets.filter(a => a.type === 'cash');
  const bankAccounts = assets.filter(a => a.type === 'bank');
  const mobileAccounts = assets.filter(a => a.type === 'mobile_money');
  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);

  return {
    as_of_date: date,
    assets: {
      cash: { accounts: cashAccounts, total: cashAccounts.reduce((s, a) => s + a.balance, 0) },
      bank: { accounts: bankAccounts, total: bankAccounts.reduce((s, a) => s + a.balance, 0) },
      mobile_money: { accounts: mobileAccounts, total: mobileAccounts.reduce((s, a) => s + a.balance, 0) },
      total: totalAssets,
    },
    equity: {
      total_opening: accounts.reduce((s, a) => s + (a.opening_balance || 0), 0),
      net_income: netIncome,
      total: (accounts.reduce((s, a) => s + (a.opening_balance || 0), 0)) + netIncome,
    },
    total_liabilities_equity: totalAssets,
  };
};

const generateTrialBalance = async (query) => {
  const { as_of_date } = query;
  const date = as_of_date || new Date().toISOString().split('T')[0];

  const accounts = await Account.findAll({
    where: { is_active: true },
    include: [{ model: Shop, as: 'shop', attributes: ['id', 'name'] }],
    order: [['name', 'ASC']],
  });

  const rows = await Promise.all(accounts.map(async (a) => {
    const debitResult = await AccountTransaction.findAll({
      where: { account_id: a.id, type: 'in', transaction_date: { [Op.lte]: date } },
      attributes: [[require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('amount')), 0), 'total']],
      raw: true,
    });
    const creditResult = await AccountTransaction.findAll({
      where: { account_id: a.id, type: 'out', transaction_date: { [Op.lte]: date } },
      attributes: [[require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('amount')), 0), 'total']],
      raw: true,
    });
    const totalDebit = Number(debitResult[0]?.total || 0) + (a.opening_balance || 0);
    const totalCredit = Number(creditResult[0]?.total || 0);
    return {
      id: a.id,
      name: a.name,
      type: a.account_type,
      shop: a.shop?.name || null,
      debit: totalDebit > totalCredit ? totalDebit - totalCredit : 0,
      credit: totalCredit > totalDebit ? totalCredit - totalDebit : 0,
    };
  }));

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return { as_of_date: date, rows, total_debit: totalDebit, total_credit: totalCredit };
};

const generateCashFlow = async (query) => {
  const { date_from, date_to } = query;
  const from = date_from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const to = date_to || new Date().toISOString().split('T')[0];

  const startBalance = await Account.findAll({
    where: { account_type: { [Op.in]: ['cash', 'bank'] }, is_active: true },
    attributes: [[require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('current_balance')), 0), 'total']],
    raw: true,
  });
  const openingCash = Number(startBalance[0]?.total || 0);

  // Get transactions grouped by reference_type
  const txGroups = await AccountTransaction.findAll({
    where: {
      transaction_date: { [Op.between]: [from, to] },
    },
    attributes: [
      'reference_type',
      'type',
      [require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('amount')), 0), 'total'],
    ],
    group: ['reference_type', 'type'],
    raw: true,
  });

  const inflows = {};
  const outflows = {};
  txGroups.forEach(tx => {
    if (tx.type === 'in') inflows[tx.reference_type] = Number(tx.total);
    else outflows[tx.reference_type] = Number(tx.total);
  });

  const operatingIn = (inflows.collection || 0) + (inflows.sale || 0);
  const operatingOut = (outflows.expense || 0) + (outflows.sale || 0);
  const investingIn = inflows.transfer || 0;
  const investingOut = outflows.transfer || 0;

  return {
    date_from: from,
    date_to: to,
    opening_cash_balance: openingCash,
    operating_activities: {
      inflows: operatingIn,
      outflows: operatingOut,
      net: operatingIn - operatingOut,
      items: txGroups.filter(tx => tx.reference_type !== 'transfer').map(tx => ({
        reference_type: tx.reference_type,
        type: tx.type,
        amount: Number(tx.total),
      })),
    },
    investing_activities: {
      inflows: investingIn,
      outflows: investingOut,
      net: investingIn - investingOut,
      items: txGroups.filter(tx => tx.reference_type === 'transfer').map(tx => ({
        reference_type: tx.reference_type,
        type: tx.type,
        amount: Number(tx.total),
      })),
    },
    net_cash_flow: (operatingIn - operatingOut) + (investingIn - investingOut),
  };
};

const generateAccountReport = async (accountId, query) => {
  const { date_from, date_to } = query;
  const account = await Account.findByPk(accountId, {
    include: [{ model: Shop, as: 'shop', attributes: ['id', 'name'] }],
  });
  if (!account) throw new Error('Account not found');

  const from = date_from || account.created_at?.toISOString().split('T')[0] || '2020-01-01';
  const to = date_to || new Date().toISOString().split('T')[0];

  const transactions = await AccountTransaction.findAll({
    where: {
      account_id: accountId,
      transaction_date: { [Op.between]: [from, to] },
    },
    include: [
      { model: User, as: 'recorder', attributes: ['name'] },
    ],
    order: [['transaction_date', 'ASC'], ['id', 'ASC']],
  });

  // Calculate opening balance as of "from" date
  const beforeTxs = await AccountTransaction.findAll({
    where: {
      account_id: accountId,
      transaction_date: { [Op.lt]: from },
    },
    attributes: [
      [require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').literal("CASE WHEN type = 'in' THEN amount ELSE -amount END")), 0), 'balance'],
    ],
    raw: true,
  });
  const openingBalance = Number(beforeTxs[0]?.balance || 0) + (account.opening_balance || 0);

  return {
    account: { id: account.id, name: account.name, type: account.account_type, shop: account.shop?.name || null },
    date_from: from,
    date_to: to,
    opening_balance: openingBalance,
    closing_balance: account.current_balance,
    transactions: transactions.map(t => ({
      id: t.id,
      date: t.transaction_date,
      type: t.type,
      amount: t.amount,
      balance_before: t.balance_before,
      balance_after: t.balance_after,
      reference_type: t.reference_type,
      reference_id: t.reference_id,
      description: t.description,
      recorded_by: t.recorder?.name || null,
    })),
  };
};

// ── SHOP CASH DISPOSITION APPROVAL ────────────────────────────

const approveShopCashDisposition = async (dispositionId, action, reason, userId) => {
  const disp = await ShopCashDisposition.findByPk(dispositionId, {
    include: [{ model: Shop, as: 'shop', attributes: ['id', 'name', 'business_type'] }],
  });
  if (!disp || disp.status !== 'pending') throw new Error('Disposition not found or already processed');

  if (action === 'reject') {
    await disp.update({ status: 'rejected', approved_by: userId, approved_at: new Date(), rejection_reason: reason || '' });
    return disp;
  }

  // Approve — create account transactions
  const today = new Date().toISOString().split('T')[0];
  const shopId = disp.shop_id;

  try {
    // 1. Credit selcom_tzs to Bentabet Revenue Account
    const selcomAccount = await Account.findOne({ where: { name: 'Bentabet Revenue Account', is_active: true } });
    if (selcomAccount && disp.selcom_tzs > 0) {
      const selcomBalBefore = selcomAccount.current_balance;
      const selcomBalAfter = selcomBalBefore + disp.selcom_tzs;
      await AccountTransaction.create({
        account_id: selcomAccount.id,
        type: 'in',
        amount: disp.selcom_tzs,
        balance_before: selcomBalBefore,
        balance_after: selcomBalAfter,
        reference_type: 'cash_disposition',
        reference_id: disp.id,
        payment_method: 'mobile_money',
        description: `Selcom revenue - ${disp.shop?.name || `Shop #${shopId}`} (${disp.date})`,
        recorded_by: userId,
        transaction_date: disp.date,
      });
      await selcomAccount.update({ current_balance: selcomBalAfter });
    }

    // 2. Handle cash_at_hand based on allocation
    if (disp.cash_at_hand_tzs > 0) {
      if (disp.cash_allocation === 'deposit') {
        // Deposit to Bentabet Bank Account
        const bankAccount = await Account.findOne({ where: { name: 'Bentabet Bank Account', is_active: true } });
        if (bankAccount) {
          const depositAmount = disp.bank_deposit_amount || disp.cash_at_hand_tzs;
          const bankBalBefore = bankAccount.current_balance;
          const bankBalAfter = bankBalBefore + depositAmount;
          await AccountTransaction.create({
            account_id: bankAccount.id,
            type: 'in',
            amount: depositAmount,
            balance_before: bankBalBefore,
            balance_after: bankBalAfter,
            reference_type: 'cash_disposition',
            reference_id: disp.id,
            payment_method: 'cash',
            description: `Bank deposit - ${disp.shop?.name || `Shop #${shopId}`} (${disp.date})`,
            recorded_by: userId,
            transaction_date: disp.date,
          });
          await bankAccount.update({ current_balance: bankBalAfter });
        }
      } else {
        // Add to shop cash float
        const cashAccount = await Account.findOne({ where: { shop_id: shopId, account_type: 'cash', business_type: 'bentabet', is_active: true } });
        if (cashAccount) {
          const cashBalBefore = cashAccount.current_balance;
          const cashBalAfter = cashBalBefore + disp.cash_at_hand_tzs;
          await AccountTransaction.create({
            account_id: cashAccount.id,
            type: 'in',
            amount: disp.cash_at_hand_tzs,
            balance_before: cashBalBefore,
            balance_after: cashBalAfter,
            reference_type: 'cash_disposition',
            reference_id: disp.id,
            payment_method: 'cash',
            description: `Cash float addition - ${disp.shop?.name || `Shop #${shopId}`} (${disp.date})`,
            recorded_by: userId,
            transaction_date: disp.date,
          });
          await cashAccount.update({ current_balance: cashBalAfter });
        }
      }
    }
  } catch (err) {
    console.warn('[ACCOUNTING] Failed to auto-record cash disposition transactions:', err.message);
  }

  await disp.update({ status: 'approved', approved_by: userId, approved_at: new Date() });
  return disp;
};

const updateExpense = async (id, data, userId) => {
  const expense = await Expense.findByPk(id);
  if (!expense) throw new Error('Expense not found');
  if (expense.status !== 'pending') throw new Error('Can only edit pending expenses');
  await expense.update({ ...data, submitted_by: userId });
  return Expense.findByPk(id, {
    include: [
      { model: ExpenseCategory, as: 'category' },
      { model: User, as: 'submitter', attributes: ['name'] },
      { model: User, as: 'approver', attributes: ['name'] },
      { model: Shop, as: 'shop', attributes: ['id', 'name'] },
      { model: Machine, as: 'machine', attributes: ['id', 'slot_code'] },
    ],
  });
};

const removeExpense = async (id) => {
  const expense = await Expense.findByPk(id);
  if (!expense) throw new Error('Expense not found');
  if (expense.status !== 'pending') throw new Error('Can only delete pending expenses');
  await expense.destroy();
  return true;
};

module.exports = {
  submitExpense, approveExpense, updateExpense, removeExpense,
  createInvoice, recordPayment, generateInvoicePDF, createPayrollRun, exportCollectionsExcel,
  listAccounts, createAccount, getAccount, updateAccount, deleteAccount,
  listAccountTransactions, transferBetweenAccounts,
  generateBalanceSheet, generateTrialBalance, generateCashFlow, generateAccountReport,
  approveShopCashDisposition,
};
