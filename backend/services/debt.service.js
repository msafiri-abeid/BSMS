const { MachineDebt, Machine, Shop, User, Collection, TokenInventory } = require('../models');
const { Op } = require('sequelize');

const list = async (filters = {}) => {
  const where = {};
  if (filters.machine_id) where.machine_id = filters.machine_id;
  if (filters.shop_id) where.shop_id = filters.shop_id;
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  return MachineDebt.findAndCountAll({
    where,
    include: [
      { model: Machine, as: 'machine', attributes: ['id', 'slot_code'] },
      { model: Shop, as: 'shop', attributes: ['id', 'name'] },
      { model: User, as: 'recorder', attributes: ['id', 'name'] },
      { model: Collection, as: 'collection', attributes: ['id', 'gross_tzs', 'collected_at'] },
    ],
    order: [['created_at', 'DESC']],
    limit: +(filters.limit || 50),
    offset: +(filters.offset || 0),
  });
};

const create = async (data, userId) => {
  return MachineDebt.create({
    machine_id: data.machine_id,
    shop_id: data.shop_id,
    type: data.type || 'other',
    amount: data.amount,
    reason: data.reason || '',
    recorded_by: userId,
    status: 'pending',
  });
};

const recordPayment = async (id, amount, userId, receiptUrl) => {
  const debt = await MachineDebt.findByPk(id);
  if (!debt) return null;
  if (debt.status === 'paid' || debt.status === 'written_off') {
    throw new Error('Debt is already settled');
  }

  const newPaid = debt.paid_amount + amount;
  const newStatus = newPaid >= debt.amount ? 'paid' : 'partial';
  const paidAt = newStatus === 'paid' ? new Date() : null;

  await debt.update({
    paid_amount: newPaid,
    status: newStatus,
    paid_at: paidAt,
    receipt_url: receiptUrl || debt.receipt_url,
  });

  if (newStatus === 'paid' && debt.type === 'token') {
    const unitValue = 200;
    const tokenQty = Math.floor(debt.amount / unitValue) || 0;
    if (tokenQty > 0) {
      const machine = await Machine.findByPk(debt.machine_id);
      await TokenInventory.create({
        qty: tokenQty,
        movement_type: 'debt_repayment',
        unit_value_tzs: unitValue,
        total_value_tzs: tokenQty * unitValue,
        recipient_type: 'shop',
        recipient_id: debt.shop_id,
        note: `Token debt repaid — ${machine?.slot_code || `Machine #${debt.machine_id}`} at Shop #${debt.shop_id}`,
        created_by: userId,
        debt_id: debt.id,
      });
    }
  }

  return debt;
};

const writeOff = async (id, reason) => {
  const debt = await MachineDebt.findByPk(id);
  if (!debt) return null;
  await debt.update({ status: 'written_off', reason: reason || debt.reason });
  return debt;
};

const ExcelJS = require('exceljs');

const exportDebtsExcel = async (filters = {}) => {
  const where = {};
  if (filters.machine_id) where.machine_id = filters.machine_id;
  if (filters.shop_id) where.shop_id = filters.shop_id;
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;

  const debts = await MachineDebt.findAll({
    where,
    include: [
      { model: Machine, as: 'machine', attributes: ['id', 'slot_code'] },
      { model: Shop, as: 'shop', attributes: ['id', 'name'] },
    ],
    order: [['created_at', 'DESC']],
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Debts');
  ws.columns = [
    { header: 'Machine', key: 'machine', width: 15 },
    { header: 'Shop', key: 'shop', width: 20 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Amount (TZS)', key: 'amount', width: 15 },
    { header: 'Paid (TZS)', key: 'paid_amount', width: 15 },
    { header: 'Outstanding (TZS)', key: 'outstanding', width: 18 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Date', key: 'date', width: 15 },
  ];

  debts.forEach(d => {
    ws.addRow({
      machine: d.machine?.slot_code,
      shop: d.shop?.name,
      type: d.type,
      amount: d.amount,
      paid_amount: d.paid_amount,
      outstanding: d.amount - d.paid_amount,
      status: d.status,
      date: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '',
    });
  });

  ws.getRow(1).font = { bold: true };
  return wb.xlsx.writeBuffer();
};

module.exports = { list, create, recordPayment, writeOff, exportDebtsExcel };