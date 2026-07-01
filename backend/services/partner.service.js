const { Partner, Shop, Region, District, Ward, Street, Address, Machine, Collection, Employee } = require('../models');
const { Op } = require('sequelize');

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

exports.listPartners = async ({ status, type, search, label }) => {
  const where = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (search) where.name = { [Op.like]: `%${search}%` };
  if (label) where.label = label;
  const data = await Partner.findAndCountAll({
    where,
    include: partnerIncludes(false),
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

exports.listShops = async ({ partner_id, status, business_type, search, supervisor_id }) => {
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
