const { TokenInventory, User, Partner } = require('../models');
const { Op } = require('sequelize');

const ROLES_MAP = { collector: 'Collector', technician: 'Technician' };
const ALLOWED_MOVEMENT_TYPES = ['purchase', 'refill_out', 'adjustment', 'distribute', 'return', 'lend', 'debt_repayment'];
const IN_TYPES = ['purchase', 'return', 'debt_repayment'];

const validateRecipient = async (type, id) => {
  if (type === 'vendor' || type === 'shop') return true;
  if (type === 'partner') {
    const p = await Partner.findByPk(id);
    if (!p) throw new Error('Partner not found');
    return true;
  }
  const roleName = ROLES_MAP[type];
  if (!roleName) throw new Error(`Invalid recipient type: ${type}`);
  const user = await User.findByPk(id, { include: [{ association: 'role', attributes: ['name'] }] });
  if (!user) throw new Error(`${type} not found`);
  if (user.role?.name !== roleName) throw new Error(`User is not a ${roleName}`);
  return true;
};

const recordMovement = async ({ movement_type, qty, unit_value_tzs, recipient_type, recipient_id, vendor_name, reference, note, created_by }) => {
  if (!ALLOWED_MOVEMENT_TYPES.includes(movement_type)) {
    throw new Error(`Invalid movement type: ${movement_type}`);
  }
  if (!qty || qty <= 0) throw new Error('Quantity must be a positive number');
  if (!unit_value_tzs || unit_value_tzs <= 0) throw new Error('Unit value must be a positive number');

  const isIn = IN_TYPES.includes(movement_type);
  const signedQty = isIn ? qty : -qty;
  const total_value_tzs = qty * unit_value_tzs;

  let defaultNote;
  switch (movement_type) {
    case 'purchase':
      defaultNote = `Purchased ${qty} tokens`;
      break;
    case 'distribute':
      defaultNote = `Distributed to ${recipient_type} #${recipient_id}`;
      break;
    case 'return':
      defaultNote = `Returned from ${recipient_type} #${recipient_id}`;
      break;
    case 'lend':
      defaultNote = `Lent to vendor: ${vendor_name}`;
      break;
    case 'adjustment':
      defaultNote = `Adjustment of ${qty} tokens`;
      break;
    case 'refill_out':
      defaultNote = `Refill of ${qty} tokens`;
      break;
    case 'debt_repayment':
      defaultNote = `Debt repayment of ${qty} tokens`;
      break;
    default:
      defaultNote = `${movement_type} of ${qty} tokens`;
  }

  return TokenInventory.create({
    movement_type,
    qty: signedQty,
    unit_value_tzs,
    total_value_tzs,
    recipient_type,
    recipient_id,
    vendor_name,
    reference,
    note: note || defaultNote,
    created_by,
  });
};

const distribute = async ({ recipient_type, recipient_id, qty, unit_value_tzs, note, created_by }) => {
  return recordMovement({ movement_type: 'distribute', qty, unit_value_tzs, recipient_type, recipient_id, note, created_by });
};

const returnTokens = async ({ recipient_type, recipient_id, qty, unit_value_tzs, note, created_by }) => {
  return recordMovement({ movement_type: 'return', qty, unit_value_tzs, recipient_type, recipient_id, note, created_by });
};

const lendToVendor = async ({ vendor_name, qty, unit_value_tzs, reference, note, created_by }) => {
  return recordMovement({ movement_type: 'lend', qty, unit_value_tzs, vendor_name, reference, note, created_by });
};

const getOfficeBalance = async () => {
  return TokenInventory.sum('qty');
};

const getOutstandingBalances = async () => {
  const rows = await TokenInventory.findAll({
    attributes: [
      'recipient_type',
      'recipient_id',
      [TokenInventory.sequelize.fn('SUM', TokenInventory.sequelize.col('qty')), 'balance'],
    ],
    where: {
      recipient_type: { [Op.ne]: null },
      recipient_id: { [Op.ne]: null },
    },
    group: ['recipient_type', 'recipient_id'],
    raw: true,
  });

  const result = [];
  for (const row of rows) {
    const balance = Number(row.balance);
    if (balance === 0) continue;
    let name = '';
    if (row.recipient_type === 'partner') {
      const p = await Partner.findByPk(row.recipient_id);
      name = p?.name || `#${row.recipient_id}`;
    } else if (row.recipient_type !== 'vendor' && row.recipient_type !== 'shop') {
      const u = await User.findByPk(row.recipient_id);
      name = u?.name || `#${row.recipient_id}`;
    } else {
      name = `#${row.recipient_id}`;
    }
    result.push({
      type: row.recipient_type,
      id: row.recipient_id,
      name,
      balance: Math.abs(balance),
      direction: balance < 0 ? 'out' : 'in',
    });
  }
  return result;
};

const getMovements = async ({ limit = 50, offset = 0 } = {}) => {
  limit = parseInt(limit, 10) || 50;
  offset = parseInt(offset, 10) || 0;
  const { count, rows } = await TokenInventory.findAndCountAll({
    order: [['created_at', 'DESC']],
    limit,
    offset,
    include: [
      { association: 'creator', attributes: ['id', 'name'] },
      { association: 'approver', attributes: ['id', 'name'] },
    ],
  });
  return { count, rows };
};

module.exports = { recordMovement, distribute, returnTokens, lendToVendor, getOfficeBalance, getOutstandingBalances, getMovements };
