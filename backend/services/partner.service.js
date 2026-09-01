const { Partner, Shop, Region, District, Ward, Street, Address, Machine, Collection, Employee, Expense, Account } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

const partnerIncludes = (includeShops = false) => {
  const inc = [{ model: Address, as: 'address', include: [
    { model: Region, as: 'region' },
    { model: District, as: 'districtData' },
    { model: Ward, as: 'wardData' },
    { model: Street, as: 'streetData' },
  ] }];
  if (includeShops) inc.push({ model: Shop, as: 'shops', attributes: ['id', 'name', 'status', 'business_type'] });
  return inc;
};

const shopIncludes = () => [
  { model: Address, as: 'address', include: [
    { model: Region, as: 'region' },
    { model: District, as: 'districtData' },
    { model: Ward, as: 'wardData' },
    { model: Street, as: 'streetData' },
  ] },
  { model: Partner, as: 'partner', attributes: ['id', 'name', 'type', 'label', 'contract_url'] },
  { model: Employee, as: 'supervisor', attributes: ['id', 'full_name', 'phone'] },
  {
    model: Machine, as: 'machines',
    attributes: ['id', 'slot_code', 'manufacturer', 'credit_value_tzs', 'status', 'previous_count', 'opening_count'],
    include: [{
      model: Collection,
      as: 'performance',
      attributes: ['collected_at', 'gross_tzs', 'net_tzs', 'office_tzs', 'owner_tzs', 'difference'],
      where: { status: 'approved' },
      required: false,
      order: [['collected_at', 'DESC']],
      limit: 30,
    }],
  },
];

exports.listPartners = async ({ status, type, search, label, limit = 50, offset = 0 }) => {
  const where = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (search) where.name = { [Op.like]: `%${search}%` };
  if (label) where.label = label;
  const data = await Partner.findAndCountAll({
    where,
    include: partnerIncludes(false),
    limit: +limit,
    offset: +offset,
    order: [['name', 'ASC']],
  });
  return data;
};

exports.getPartner = async (id) => {
  const partner = await Partner.findByPk(id, {
    include: partnerIncludes(true),
  });
  return partner;
};

exports.createPartner = async (body, files) => {
  const documents = files?.length ? files.map(f => ({ url: f.path, name: f.originalname, mimetype: f.mimetype })) : [];
  const { address, ...partnerData } = body;
  const partner = await Partner.create({ ...partnerData, documents });
  if (address) {
    const addrData = typeof address === 'string' ? JSON.parse(address) : address;
    await Address.create({ ...addrData, partner_id: partner.id });
  }
  return exports.getPartner(partner.id);
};

exports.updatePartner = async (id, body, files) => {
  const p = await Partner.findByPk(id);
  if (!p) return null;
  const { address, ...partnerData } = body;
  if (files?.length) {
    const newDocs = files.map(f => ({ url: f.path, name: f.originalname, mimetype: f.mimetype }));
    partnerData.documents = [...(p.documents || []), ...newDocs];
  }
  await p.update(partnerData);
  if (address) {
    const addrData = typeof address === 'string' ? JSON.parse(address) : address;
    const existing = await Address.findOne({ where: { partner_id: id } });
    if (existing) {
      await existing.update(addrData);
    } else {
      await Address.create({ ...addrData, partner_id: id });
    }
  }
  return exports.getPartner(id);
};

exports.deletePartner = async (id) => {
  const p = await Partner.findByPk(id);
  if (!p) return false;
  await p.update({ status: 'inactive' });
  return true;
};

exports.listShops = async ({ partner_id, status, business_type, search, supervisor_id, limit = 50, offset = 0 }) => {
  const where = {};
  if (partner_id) where.partner_id = partner_id;
  if (status) where.status = status;
  if (business_type) where.business_type = business_type;
  if (search) where.name = { [Op.like]: `%${search}%` };
  if (supervisor_id) where.supervisor_id = supervisor_id;
  const data = await Shop.findAndCountAll({
    where,
    include: [
      { model: Address, as: 'address', include: [
        { model: Region, as: 'region' },
        { model: Ward, as: 'wardData' },
        { model: Street, as: 'streetData' },
      ] },
      { model: Partner, as: 'partner', attributes: ['id', 'name', 'label', 'type'] },
      { model: Employee, as: 'supervisor', attributes: ['id', 'full_name', 'phone'] },
    ],
    limit: +limit,
    offset: +offset,
    order: [['name', 'ASC']],
  });
  return data;
};

exports.getShop = async (id) => {
  const shop = await Shop.findByPk(id, { include: shopIncludes() });
  return shop;
};

exports.createShop = async (body, files) => {
  const documents = files?.length ? files.map(f => ({ url: f.path, name: f.originalname, mimetype: f.mimetype })) : [];
  const { address, ...shopData } = body;
  const shop = await Shop.create({ ...shopData, documents });
  if (address) {
    const addrData = typeof address === 'string' ? JSON.parse(address) : address;
    await Address.create({ ...addrData, shop_id: shop.id });
  }
  // Auto-create cash float account for Slot shops
  if (shop.business_type === 'slot') {
    await Account.findOrCreate({
      where: { shop_id: shop.id, account_type: 'cash' },
      defaults: { name: `Cash - ${shop.name}`, account_type: 'cash', business_type: 'bentabet', opening_balance: 0, current_balance: 0, is_active: true, shop_id: shop.id, created_by: shopData.created_by || 1, description: `Cash float account for ${shop.name}`, float_minimum: 400000 },
    });
  }
  return exports.getShop(shop.id);
};

exports.updateShop = async (id, body, files) => {
  const s = await Shop.findByPk(id);
  if (!s) return null;
  const { address, ...shopData } = body;
  if (files?.length) {
    const newDocs = files.map(f => ({ url: f.path, name: f.originalname, mimetype: f.mimetype }));
    shopData.documents = [...(s.documents || []), ...newDocs];
  }
  await s.update(shopData);
  if (address) {
    const addrData = typeof address === 'string' ? JSON.parse(address) : address;
    const existing = await Address.findOne({ where: { shop_id: id } });
    if (existing) {
      await existing.update(addrData);
    } else {
      await Address.create({ ...addrData, shop_id: id });
    }
  }
  return exports.getShop(id);
};

exports.deleteShop = async (id) => {
  const s = await Shop.findByPk(id);
  if (!s) return false;
  await s.destroy();
  return true;
};

exports.listRegions = async () => {
  return Region.findAll({ order: [['name', 'ASC']] });
};

exports.listDistricts = async (region_id) => {
  if (!region_id) return [];
  return District.findAll({ where: { region_id }, order: [['name', 'ASC']] });
};

exports.listWards = async (district_id) => {
  if (!district_id) return [];
  return Ward.findAll({ where: { district_id }, order: [['name', 'ASC']] });
};

exports.listStreets = async (ward_id) => {
  if (!ward_id) return [];
  return Street.findAll({ where: { ward_id }, order: [['name', 'ASC']] });
};

exports.getShopStats = async (id, { date_from, date_to }) => {
  const dateWhere = {};
  if (date_from) dateWhere.collection_date = { [Op.gte]: date_from };
  if (date_to) dateWhere.collection_date = { ...dateWhere.collection_date, [Op.lte]: date_to };

  const expenseDateWhere = {};
  if (date_from) expenseDateWhere.expense_date = { [Op.gte]: date_from };
  if (date_to) expenseDateWhere.expense_date = { ...expenseDateWhere.expense_date, [Op.lte]: date_to };

  const shop = await Shop.findByPk(id, { attributes: ['id', 'business_type'], raw: true });
  if (!shop) return null;
  const isSlot = shop.business_type === 'slot';

  const machineWhere = { current_shop_id: id };
  const collWhere = { shop_id: id, status: 'approved', ...dateWhere };
  const expenseWhere = { shop_id: id, status: 'approved', ...expenseDateWhere };

  const [machineCount, activeMachineCount, aggResult, expenseResult, chartRows] = await Promise.all([
    Machine.count({ where: machineWhere }),
    Machine.count({ where: { ...machineWhere, status: 'active' } }),
    Collection.findAll({
      attributes: [
        [fn('COALESCE', fn('SUM', col('gross_tzs')), 0), 'totalGross'],
        [fn('COALESCE', fn('SUM', col('office_tzs')), 0), 'totalOffice'],
        [fn('COALESCE', fn('SUM', col('owner_tzs')), 0), 'totalOwner'],
        [fn('COALESCE', fn('SUM', col('net_tzs')), 0), 'totalNet'],
        [fn('COUNT', col('id')), 'collectionCount'],
      ],
      where: collWhere,
      raw: true,
    }),
    Expense.findAll({
      attributes: [
        [fn('COALESCE', fn('SUM', col('amount')), 0), 'totalExpenses'],
        [fn('COUNT', col('id')), 'expenseCount'],
      ],
      where: expenseWhere,
      raw: true,
    }),
    Collection.findAll({
      attributes: [
        [fn('DATE_FORMAT', col('collection_date'), '%Y-%m-%d'), 'date'],
        [fn('SUM', col('gross_tzs')), 'gross'],
        [fn('SUM', col('net_tzs')), 'net'],
        [fn('SUM', col('office_tzs')), 'office'],
        [fn('SUM', col('owner_tzs')), 'owner'],
      ],
      where: collWhere,
      group: [fn('DATE_FORMAT', col('collection_date'), '%Y-%m-%d')],
      order: [[fn('DATE_FORMAT', col('collection_date'), '%Y-%m-%d'), 'ASC']],
      raw: true,
    }),
  ]);

  const stats = aggResult[0] || {};
  const expenses = expenseResult[0] || {};

  const totalGross = Number(stats.totalGross) || 0;
  const totalOffice = Number(stats.totalOffice) || 0;
  const totalOwner = Number(stats.totalOwner) || 0;
  const totalNet = Number(stats.totalNet) || 0;
  const collectionCount = Number(stats.collectionCount) || 0;
  const totalExpenses = Number(expenses.totalExpenses) || 0;
  const expenseCount = Number(expenses.expenseCount) || 0;

  return {
    kpis: {
      totalGross,
      totalOffice,
      totalOwner,
      totalNet,
      netRevenue: isSlot ? totalGross - totalExpenses : totalNet,
      collectionCount,
      totalExpenses,
      expenseCount,
      machineCount,
      activeMachineCount,
    },
    chartData: chartRows.map(r => ({
      date: r.date,
      gross: Number(r.gross) || 0,
      net: Number(r.net) || 0,
      office: Number(r.office) || 0,
      owner: Number(r.owner) || 0,
    })),
  };
};
