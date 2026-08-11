// services/finance.service.js
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Expense, Invoice, Payment, CreditNote, Payroll, ExpenseCategory, Partner, Shop, Machine, Setting, User, Account, AccountTransaction, AccountTransfer } = require('../models');

const getSetting = async (key, def) => {
  const row = await Setting.findOne({ where: { key } });
  return row ? row.value : def;
};

const resolveBizTypeFromShop = async (shopId) => {
  if (!shopId) return null;
  const shop = await Shop.findByPk(shopId, { attributes: ['business_type'], raw: true });
  if (!shop) return null;
  return shop.business_type === 'slot' ? 'bentabet' : shop.business_type;
};

const submitExpense = async (data, userId) => {
  const expense_date = data.expense_date || new Date().toISOString().split('T')[0];
  const bizType = await resolveBizTypeFromShop(data.shop_id);
  return Expense.create({ ...data, business_type: bizType || data.business_type || 'meteora', expense_date, submitted_by: userId, status: 'pending' });
};

const resolveExpenseAccount = async (expense) => {
  // Priority 1: Use expense.account_id if set (new flow)
  if (expense.account_id) {
    const acc = await Account.findByPk(expense.account_id);
    if (acc) return acc;
  }

  const paymentSource = expense.payment_source || 'cash';
  const bizType = expense.business_type || 'meteora';

  // Priority 2: Legacy fallback — find account by business_type + payment_source
  if (bizType === 'bentabet') {
    if (paymentSource === 'selcom') {
      return Account.findOne({ where: { name: 'Bentabet Revenue Account', is_active: true } });
    }
    return expense.shop_id
      ? Account.findOne({ where: { shop_id: expense.shop_id, account_type: 'cash', business_type: 'bentabet', is_active: true } })
      : null;
  }

  const accountType = paymentSource === 'selcom' ? 'bank' : 'cash';
  const shopAccount = expense.shop_id
    ? await Account.findOne({ where: { shop_id: expense.shop_id, account_type: accountType, is_active: true } })
    : null;
  return shopAccount || Account.findOne({ where: { name: accountType === 'bank' ? 'Main Bank Account' : 'Main Office Cash', is_active: true } });
};

const createExpenseTransactionRecord = async (expense, userId, t) => {
  const account = await resolveExpenseAccount(expense);
  if (!account) return null;

  const opts = t ? { transaction: t } : {};
  const amount = expense.amount;
  const balance_before = account.current_balance;
  const balance_after = balance_before - amount;
  const paymentSource = expense.payment_source || 'cash';
  const bizType = expense.business_type || 'meteora';

  const tx = await AccountTransaction.create({
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
    transaction_date: expense.expense_date || new Date().toISOString().split('T')[0],
  }, opts);
  await account.update({ current_balance: balance_after }, opts);
  return tx;
};

const reverseExpenseTransactions = async (expenseId, t) => {
  const opts = t ? { transaction: t } : {};
  const rows = await AccountTransaction.findAll({
    where: { reference_type: 'expense', reference_id: expenseId },
    ...opts,
  });
  for (const row of rows) {
    const account = await Account.findByPk(row.account_id, opts);
    if (account) {
      const restored = (account.current_balance || 0) + (row.amount || 0);
      await account.update({ current_balance: restored }, opts);
    }
    await row.destroy(opts);
  }
  return rows.length;
};

const approveExpense = async (expenseId, action, reason, userId) => {
  const expense = await Expense.findByPk(expenseId, { include: [{ model: ExpenseCategory, as: 'category' }] });
  if (!expense || expense.status !== 'pending') throw new Error('Expense not found or already processed');
  const updates = {
    status: action === 'approve' ? 'approved' : 'rejected',
    approved_by: action === 'approve' ? userId : null,
    approved_at: action === 'approve' ? new Date() : null,
  };
  if (action === 'reject') updates.rejection_reason = reason;
  await expense.update(updates);

  // Auto-record account transaction for approved expenses
  if (action === 'approve') {
    try {
      await createExpenseTransactionRecord(expense, userId);
    } catch (err) {
      console.warn('[ACCOUNTING] Failed to auto-record expense transaction:', err.message);
    }
  }

  return expense;
};

const changeExpenseStatus = async (expenseId, status, userId, reason) => {
  const VALID = ['pending', 'approved', 'rejected'];
  if (!VALID.includes(status)) throw new Error(`Invalid status: ${status}`);
  const expense = await Expense.findByPk(expenseId, { include: [{ model: ExpenseCategory, as: 'category' }] });
  if (!expense) throw new Error('Expense not found');

  return sequelize.transaction(async (t) => {
    const updates = { status };
    if (status === 'approved') {
      updates.approved_by = userId;
      updates.approved_at = new Date();
      updates.rejection_reason = null;
    } else {
      updates.approved_by = null;
      updates.approved_at = null;
      updates.rejection_reason = status === 'rejected' ? (reason || null) : null;
    }
    await expense.update(updates, { transaction: t });

    if (status === 'approved') {
      // Ensure the debit exists exactly once (re-approval after revert is safe)
      const existing = await AccountTransaction.count({
        where: { reference_type: 'expense', reference_id: expense.id },
        transaction: t,
      });
      if (existing === 0) {
        try {
          await createExpenseTransactionRecord(expense, userId, t);
        } catch (err) {
          console.warn('[ACCOUNTING] Failed to auto-record expense transaction:', err.message);
        }
      }
    } else {
      // Moving away from approved — reverse any debit so the books stay correct
      await reverseExpenseTransactions(expense.id, t);
    }

    return Expense.findByPk(expense.id, {
      include: [
        { model: ExpenseCategory, as: 'category' },
        { model: User, as: 'submitter', attributes: ['name'] },
        { model: User, as: 'approver', attributes: ['name'] },
        { model: Shop, as: 'shop', attributes: ['id', 'name'] },
        { model: Machine, as: 'machine', attributes: ['id', 'slot_code'] },
      ],
    });
  });
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
  const employees = await require('../models').Employee.findAll({ where: { status: { [Op.in]: ['active', 'inactive'] } } });
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
  const opening = Number(data.opening_balance) || 0;
  const account = await Account.create({
    ...data,
    current_balance: opening,
    created_by: userId,
  });

  // Record opening balance transaction if non-zero
  if (opening !== 0) {
    await AccountTransaction.create({
      account_id: account.id,
      type: opening > 0 ? 'in' : 'out',
      amount: Math.abs(opening),
      balance_before: 0,
      balance_after: opening,
      reference_type: 'opening_balance',
      payment_method: 'internal',
      description: opening > 0 ? 'Opening balance' : 'Opening balance (debt)',
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
  const txCount = await AccountTransaction.count({ where: { account_id: id, status: 'active' } });
  if (txCount > 0) {
    throw new Error('Cannot delete account with transactions. Deactivate it instead.');
  }
  return account.destroy();
};

// Account balance is derived from the ledger (single source of truth).
// Recomputes current_balance = opening_balance + active in − active out
// and refreshes the running balance_before/balance_after snapshots so the
// remaining active transactions stay coherent after a cancellation.
const recomputeAccountBalances = async (accountId, t) => {
  const opts = t ? { transaction: t } : {};
  const account = await Account.findByPk(accountId, opts);
  if (!account) return null;

  const txs = await AccountTransaction.findAll({
    where: { account_id: accountId, status: 'active' },
    order: [['transaction_date', 'ASC'], ['id', 'ASC']],
    ...opts,
  });

  let running = account.opening_balance || 0;
  for (const tx of txs) {
    // opening_balance rows are already reflected in account.opening_balance — do not double count
    if (tx.reference_type === 'opening_balance') continue;
    const before = running;
    running += tx.type === 'in' ? tx.amount : -tx.amount;
    if (tx.balance_before !== before || tx.balance_after !== running) {
      await tx.update({ balance_before: before, balance_after: running }, opts);
    }
  }

  if (account.current_balance !== running) {
    await account.update({ current_balance: running }, opts);
  }
  return running;
};

const markTransactionCancelled = async (tx, userId, reason, t) => {
  const opts = t ? { transaction: t } : {};
  await tx.update({
    status: 'cancelled',
    balance_before: null,
    balance_after: null,
    cancelled_by: userId,
    cancelled_at: new Date(),
    cancel_reason: reason || null,
  }, opts);
};

const CANCELABLE_TYPES = ['adjustment', 'transfer'];

const cancelTransaction = async (txId, userId, reason) => {
  return sequelize.transaction(async (t) => {
    const tx = await AccountTransaction.findByPk(txId, { transaction: t });
    if (!tx) throw new Error('Transaction not found');
    if (tx.status === 'cancelled') throw new Error('Transaction is already cancelled');
    if (!CANCELABLE_TYPES.includes(tx.reference_type)) {
      throw new Error('Only deposits, withdrawals and transfers can be cancelled');
    }

    // Legacy transfers (created before the transfer_id link existed) may not be linked.
    // Resolve the AccountTransfer only when the match is unambiguous, otherwise refuse
    // to avoid cancelling the wrong leg.
    if (tx.reference_type === 'transfer' && !tx.transfer_id) {
      const candidates = await AccountTransfer.findAll({
        where: {
          [Op.or]: [{ from_account_id: tx.account_id }, { to_account_id: tx.account_id }],
          amount: tx.amount,
          recorded_by: tx.recorded_by,
        },
        transaction: t,
      });
      if (candidates.length !== 1) {
        throw new Error('This transfer is not linked to its counterpart and cannot be safely cancelled. Run the transfer-link backfill first.');
      }
      await tx.update({ transfer_id: candidates[0].id, reference_id: candidates[0].id }, { transaction: t });
    }

    const cancelled = [];
    const affectedAccounts = [];
    const addCancelled = async (row) => {
      await markTransactionCancelled(row, userId, reason, t);
      cancelled.push(row.id);
      if (!affectedAccounts.includes(row.account_id)) affectedAccounts.push(row.account_id);
    };

    if (tx.transfer_id) {
      // Cancel both legs of a transfer atomically
      const legs = await AccountTransaction.findAll({
        where: { transfer_id: tx.transfer_id, status: 'active' },
        transaction: t,
      });
      for (const leg of legs) await addCancelled(leg);
    } else {
      await addCancelled(tx);
    }

    for (const accountId of affectedAccounts) {
      await recomputeAccountBalances(accountId, t);
    }

    return { cancelled, affectedAccounts };
  });
};

const getTransactionDetail = async (txId) => {
  const tx = await AccountTransaction.findByPk(txId, {
    include: [
      { model: Account, as: 'account', include: [{ model: Shop, as: 'shop', attributes: ['id', 'name'] }] },
      { model: User, as: 'recorder', attributes: ['name'] },
      { model: User, as: 'canceller', attributes: ['name'] },
      {
        model: AccountTransfer, as: 'transfer',
        include: [
          { model: Account, as: 'fromAccount', include: [{ model: Shop, as: 'shop', attributes: ['id', 'name'] }] },
          { model: Account, as: 'toAccount', include: [{ model: Shop, as: 'shop', attributes: ['id', 'name'] }] },
        ],
      },
    ],
  });
  if (!tx) throw new Error('Transaction not found');
  return tx;
};

const listAccountTransactions = async (accountId, query) => {
  const { date_from, date_to, type, reference_type, status, limit = 50, offset = 0 } = query;
  const where = { account_id: accountId };
  if (date_from) where.transaction_date = { ...where.transaction_date, [Op.gte]: date_from };
  if (date_to) where.transaction_date = { ...where.transaction_date, [Op.lte]: date_to };
  if (type) where.type = type;
  if (reference_type) where.reference_type = reference_type;
  if (status) where.status = status;
  return AccountTransaction.findAndCountAll({
    where,
    limit: +limit,
    offset: +offset,
    include: [
      { model: User, as: 'recorder', attributes: ['name'] },
      { model: Account, as: 'account', attributes: ['id', 'name', 'account_type'] },
    ],
    order: [['transaction_date', 'DESC'], ['id', 'DESC']],
  });
};

const listShopTransactions = async (shopId, query) => {
  const { date_from, date_to, status, limit = 50, offset = 0 } = query;
  const accounts = await Account.findAll({ where: { shop_id: shopId }, attributes: ['id'] });
  const accountIds = accounts.map(a => a.id);
  if (accountIds.length === 0) return { rows: [], count: 0 };
  const where = { account_id: { [Op.in]: accountIds } };
  if (date_from) where.transaction_date = { ...where.transaction_date, [Op.gte]: date_from };
  if (date_to) where.transaction_date = { ...where.transaction_date, [Op.lte]: date_to };
  if (status) where.status = status;
  return AccountTransaction.findAndCountAll({
    where,
    limit: +limit,
    offset: +offset,
    include: [
      { model: User, as: 'recorder', attributes: ['name'] },
      { model: Account, as: 'account', attributes: ['id', 'name', 'account_type', 'business_type'] },
    ],
    order: [['transaction_date', 'DESC'], ['id', 'DESC']],
  });
};

const transferBetweenAccounts = async (data, userId) => {
  const { from_account_id, to_account_id, amount, description } = data;
  if (from_account_id === to_account_id) throw new Error('Cannot transfer to the same account');
  if (!amount || amount <= 0) throw new Error('Invalid amount');

  const txnDate = data.transaction_date || new Date().toISOString().split('T')[0];

  return sequelize.transaction(async (t) => {
    const fromAccount = await Account.findByPk(from_account_id, { transaction: t });
    const toAccount = await Account.findByPk(to_account_id, { transaction: t });
    if (!fromAccount || !toAccount) throw new Error('Account not found');

    // Record the transfer first so both legs can be linked and cancelled together
    const transfer = await AccountTransfer.create({
      from_account_id,
      to_account_id,
      amount,
      description: description || `Transfer from ${fromAccount.name} to ${toAccount.name}`,
      status: 'approved',
      recorded_by: userId,
      approved_by: userId,
    }, { transaction: t });

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
      reference_id: transfer.id,
      transfer_id: transfer.id,
      payment_method: 'internal',
      description: description || `Transfer to ${toAccount.name}`,
      recorded_by: userId,
      transaction_date: txnDate,
    }, { transaction: t });
    await fromAccount.update({ current_balance: fromBalanceAfter }, { transaction: t });

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
      reference_id: transfer.id,
      transfer_id: transfer.id,
      payment_method: 'internal',
      description: description || `Transfer from ${fromAccount.name}`,
      recorded_by: userId,
      transaction_date: txnDate,
    }, { transaction: t });
    await toAccount.update({ current_balance: toBalanceAfter }, { transaction: t });

    return AccountTransfer.findByPk(transfer.id, {
      transaction: t,
      include: [
        { model: Account, as: 'fromAccount', attributes: ['id', 'name'] },
        { model: Account, as: 'toAccount', attributes: ['id', 'name'] },
      ],
    });
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
      status: 'active',
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
      status: 'active',
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
      where: { account_id: a.id, type: 'in', transaction_date: { [Op.lte]: date }, status: 'active' },
      attributes: [[require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('amount')), 0), 'total']],
      raw: true,
    });
    const creditResult = await AccountTransaction.findAll({
      where: { account_id: a.id, type: 'out', transaction_date: { [Op.lte]: date }, status: 'active' },
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
      status: 'active',
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
      status: 'active',
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
      status: 'active',
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

// ── ACCOUNT DEPOSIT / WITHDRAW / STATEMENT ────────────────────

const recordDeposit = async (accountId, data, userId) => {
  const { amount, transaction_date, description, receipt_url, charges } = data;
  const account = await Account.findByPk(accountId);
  if (!account) throw new Error('Account not found');

  const netAmount = amount - (parseInt(charges) || 0);
  const balanceBefore = account.current_balance;
  const balanceAfter = balanceBefore + netAmount;
  const txnDate = transaction_date || new Date().toISOString().split('T')[0];

  await AccountTransaction.create({
    account_id: accountId,
    type: 'in',
    amount: netAmount,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    reference_type: 'adjustment',
    payment_method: 'cash',
    description: description || `Deposit to ${account.name}${charges > 0 ? ` (charges: ${charges})` : ''}`,
    recorded_by: userId,
    transaction_date: txnDate,
    receipt_url: receipt_url || null,
    charges: parseInt(charges) || 0,
  });
  await account.update({ current_balance: balanceAfter });

  return Account.findByPk(accountId, {
    include: [{ model: Shop, as: 'shop', attributes: ['id', 'name'] }],
  });
};

const recordWithdraw = async (accountId, data, userId) => {
  const { amount, transaction_date, description, receipt_url } = data;
  const account = await Account.findByPk(accountId);
  if (!account) throw new Error('Account not found');

  const balanceBefore = account.current_balance;
  const balanceAfter = balanceBefore - amount;
  const txnDate = transaction_date || new Date().toISOString().split('T')[0];

  await AccountTransaction.create({
    account_id: accountId,
    type: 'out',
    amount,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    reference_type: 'adjustment',
    payment_method: 'cash',
    description: description || `Withdrawal from ${account.name}`,
    recorded_by: userId,
    transaction_date: txnDate,
    receipt_url: receipt_url || null,
  });
  await account.update({ current_balance: balanceAfter });

  return Account.findByPk(accountId, {
    include: [{ model: Shop, as: 'shop', attributes: ['id', 'name'] }],
  });
};

const generateAccountStatement = async (accountId, query) => {
  const { date_from, date_to } = query;
  const account = await Account.findByPk(accountId, {
    include: [{ model: Shop, as: 'shop', attributes: ['id', 'name'] }],
  });
  if (!account) throw new Error('Account not found');

  const from = date_from || '2020-01-01';
  const to = date_to || new Date().toISOString().split('T')[0];

  const transactions = await AccountTransaction.findAll({
    where: {
      account_id: accountId,
      transaction_date: { [Op.between]: [from, to] },
      status: 'active',
    },
    include: [{ model: User, as: 'recorder', attributes: ['name'] }],
    order: [['transaction_date', 'ASC'], ['id', 'ASC']],
  });

  const beforeTxns = await AccountTransaction.findAll({
    where: {
      account_id: accountId,
      transaction_date: { [Op.lt]: from },
      status: 'active',
    },
    attributes: [[require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').literal("CASE WHEN type = 'in' THEN amount ELSE -amount END")), 0), 'balance']],
    raw: true,
  });
  const openingBalance = Number(beforeTxns[0]?.balance || 0) + (account.opening_balance || 0);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Statement');
  ws.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Type', key: 'type', width: 10 },
    { header: 'Amount', key: 'amount', width: 18 },
    { header: 'Balance Before', key: 'balance_before', width: 18 },
    { header: 'Balance After', key: 'balance_after', width: 18 },
    { header: 'Reference', key: 'reference', width: 16 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Recorded By', key: 'recorded_by', width: 20 },
  ];

  ws.addRow({ date: from, type: 'OPEN', amount: '', balance_before: '', balance_after: openingBalance, reference: '', description: 'Opening Balance', recorded_by: '' });
  ws.getRow(2).font = { bold: true };

  transactions.forEach(tx => {
    ws.addRow({
      date: tx.transaction_date,
      type: tx.type === 'in' ? 'IN' : 'OUT',
      amount: tx.amount,
      balance_before: tx.balance_before,
      balance_after: tx.balance_after,
      reference: tx.reference_type?.replace(/_/g, ' ') || '',
      description: tx.description || '',
      recorded_by: tx.recorder?.name || '',
    });
  });

  ws.getRow(1).font = { bold: true };
  return wb.xlsx.writeBuffer();
};

const updateExpense = async (id, data, userId) => {
  const expense = await Expense.findByPk(id);
  if (!expense) throw new Error('Expense not found');
  if (expense.status !== 'pending') throw new Error('Can only edit pending expenses');
  const bizType = await resolveBizTypeFromShop(data.shop_id);

  const updateData = { ...data };
  // Receipt semantics: no key = keep existing; empty/"null" = remove; path = replace
  if ('receipt_url' in updateData) {
    let rv = updateData.receipt_url;
    if (Array.isArray(rv)) rv = rv[rv.length - 1];
    if (rv === '' || rv === 'null' || rv === 'undefined') rv = null;
    updateData.receipt_url = rv;
  }

  const oldReceipt = expense.receipt_url;
  await expense.update({ ...updateData, business_type: bizType || updateData.business_type || expense.business_type, submitted_by: userId });

  // Best-effort cleanup of replaced/removed local receipt file
  if (oldReceipt && oldReceipt !== expense.receipt_url && oldReceipt.startsWith('/uploads/')) {
    try {
      const fs = require('fs');
      const path = require('path');
      const abs = path.join(__dirname, '..', oldReceipt.replace(/^\//, ''));
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch (err) {
      console.warn('[EXPENSE] Failed to delete old receipt file:', err.message);
    }
  }

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
  const receiptUrl = expense.receipt_url;
  await expense.destroy();

  // Best-effort cleanup of the attached local receipt file
  if (receiptUrl && receiptUrl.startsWith('/uploads/')) {
    try {
      const fs = require('fs');
      const path = require('path');
      const abs = path.join(__dirname, '..', receiptUrl.replace(/^\//, ''));
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch (err) {
      console.warn('[EXPENSE] Failed to delete receipt file:', err.message);
    }
  }

  return true;
};

module.exports = {
  submitExpense, approveExpense, changeExpenseStatus, updateExpense, removeExpense,
  createInvoice, recordPayment, generateInvoicePDF, createPayrollRun, exportCollectionsExcel,
  listAccounts, createAccount, getAccount, updateAccount, deleteAccount,
  listAccountTransactions, listShopTransactions, transferBetweenAccounts,
  cancelTransaction, getTransactionDetail,
  generateBalanceSheet, generateTrialBalance, generateCashFlow, generateAccountReport,
  recordDeposit, recordWithdraw, generateAccountStatement,
};
