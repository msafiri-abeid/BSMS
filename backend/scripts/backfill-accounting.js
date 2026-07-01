// scripts/backfill-accounting.js
// One-time script: creates AccountTransaction records for existing approved expenses and collections
// Run: node scripts/backfill-accounting.js
const { Op } = require('sequelize');
const { sequelize, Expense, Collection, Account, AccountTransaction, ExpenseCategory } = require('../models');

async function backfill() {
  console.log('[BACKFILL] Starting accounting backfill...');

  const mainCashAccount = await Account.findOne({ where: { name: 'Main Office Cash' } });
  const mainBankAccount = await Account.findOne({ where: { name: 'Main Bank Account' } });

  if (!mainCashAccount) console.warn('[BACKFILL] Main Office Cash account not found — create it first');
  if (!mainBankAccount) console.warn('[BACKFILL] Main Bank Account not found — create it first');

  // Backfill approved expenses
  const expenses = await Expense.findAll({
    where: { status: 'approved' },
    include: [{ model: ExpenseCategory, as: 'category' }],
  });
  console.log(`[BACKFILL] Found ${expenses.length} approved expenses`);

  let expenseTxCount = 0;
  for (const expense of expenses) {
    const existing = await AccountTransaction.findOne({ where: { reference_type: 'expense', reference_id: expense.id } });
    if (existing) continue;

    const shopAccount = expense.shop_id
      ? await Account.findOne({ where: { shop_id: expense.shop_id, account_type: 'cash' } })
      : null;
    const account = shopAccount || mainCashAccount;
    if (!account) continue;

    const balance_before = account.current_balance;
    const balance_after = balance_before - expense.amount;
    await AccountTransaction.create({
      account_id: account.id,
      type: 'out',
      amount: expense.amount,
      balance_before,
      balance_after,
      reference_type: 'expense',
      reference_id: expense.id,
      payment_method: 'cash',
      description: `Expense: ${expense.category?.name || 'General'} - ${(expense.description || '').substring(0, 100)}`,
      recorded_by: expense.approved_by || expense.submitted_by || 1,
      transaction_date: expense.approved_at ? new Date(expense.approved_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    });
    await account.update({ current_balance: balance_after });
    expenseTxCount++;
  }
  console.log(`[BACKFILL] Created ${expenseTxCount} expense transactions`);

  // Backfill approved collections
  const collections = await Collection.findAll({
    where: { status: 'approved' },
    include: [{ model: require('../models').Machine, as: 'machine' }],
  });
  console.log(`[BACKFILL] Found ${collections.length} approved collections`);

  let collectionTxCount = 0;
  for (const collection of collections) {
    const existing = await AccountTransaction.findOne({ where: { reference_type: 'collection', reference_id: collection.id } });
    if (existing) continue;

    const isNovomatic = collection.machine?.manufacturer === 'Novomatic';
    const account = isNovomatic ? mainBankAccount : mainCashAccount;
    if (!account) continue;

    const amount = collection.gross_tzs || 0;
    if (amount <= 0) continue;

    const balance_before = account.current_balance;
    const balance_after = balance_before + amount;
    await AccountTransaction.create({
      account_id: account.id,
      type: 'in',
      amount,
      balance_before,
      balance_after,
      reference_type: 'collection',
      reference_id: collection.id,
      payment_method: isNovomatic ? 'bank_transfer' : 'cash',
      description: `Collection: ${collection.machine?.slot_code || 'Unknown'}${isNovomatic ? ' (Bank Transfer)' : ' (Cash)'}`,
      recorded_by: collection.approved_by || collection.collector_id || 1,
      transaction_date: collection.collected_at ? new Date(collection.collected_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    });
    await account.update({ current_balance: balance_after });
    collectionTxCount++;
  }
  console.log(`[BACKFILL] Created ${collectionTxCount} collection transactions`);

  console.log('[BACKFILL] Done!');
  process.exit(0);
}

backfill().catch(err => {
  console.error('[BACKFILL] Error:', err);
  process.exit(1);
});
