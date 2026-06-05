// controllers/partner.controller.js
const { Partner, Shop } = require('../models');
const { Op } = require('sequelize');

const listPartners = async (req, res, next) => {
  try {
    const { status, type, search } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) where.name = { [Op.like]: `%${search}%` };
    const data = await Partner.findAndCountAll({ where, include: [{ model: Shop, as: 'shops', attributes: ['id', 'name', 'status'] }], order: [['name', 'ASC']] });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const createPartner = async (req, res, next) => {
  try {
    const contract_url = req.file?.path;
    const partner = await Partner.create({ ...req.body, contract_url });
    res.status(201).json({ success: true, data: partner });
  } catch (err) { next(err); }
};

const updatePartner = async (req, res, next) => {
  try {
    const p = await Partner.findByPk(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Partner not found' });
    if (req.file) req.body.contract_url = req.file.path;
    await p.update(req.body);
    res.json({ success: true, data: p });
  } catch (err) { next(err); }
};

const getPartner = async (req, res, next) => {
  try {
    const partner = await Partner.findByPk(req.params.id, {
      include: [{ model: Shop, as: 'shops', attributes: ['id', 'name', 'status', 'type'] }],
    });
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });
    res.json({ success: true, data: partner });
  } catch (err) { next(err); }
};

const deletePartner = async (req, res, next) => {
  try {
    const p = await Partner.findByPk(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: 'Partner not found' });
    await p.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};

const listShops = async (req, res, next) => {
  try {
    const { partner_id, status, type } = req.query;
    const where = {};
    if (partner_id) where.partner_id = partner_id;
    if (status) where.status = status;
    if (type) where.type = type;
    const data = await Shop.findAndCountAll({
      where,
      include: [{ model: Partner, as: 'partner', attributes: ['id', 'name', 'label', 'type'] }],
      order: [['name', 'ASC']],
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const createShop = async (req, res, next) => {
  try {
    const contract_url = req.file?.path;
    const shop = await Shop.create({ ...req.body, contract_url });
    res.status(201).json({ success: true, data: shop });
  } catch (err) { next(err); }
};

const updateShop = async (req, res, next) => {
  try {
    const s = await Shop.findByPk(req.params.id);
    if (!s) return res.status(404).json({ success: false, message: 'Shop not found' });
    if (req.file) req.body.contract_url = req.file.path;
    await s.update(req.body);
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
};

const getShop = async (req, res, next) => {
  try {
    const shop = await Shop.findByPk(req.params.id, {
      include: [{ model: Partner, as: 'partner', attributes: ['name', 'type'] }],
    });
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
    res.json({ success: true, data: shop });
  } catch (err) { next(err); }
};

const deleteShop = async (req, res, next) => {
  try {
    const s = await Shop.findByPk(req.params.id);
    if (!s) return res.status(404).json({ success: false, message: 'Shop not found' });
    await s.destroy();
    res.json({ success: true });
  } catch (err) { next(err); }
};

module.exports = { listPartners, createPartner, updatePartner, getPartner, deletePartner, listShops, createShop, updateShop, getShop, deleteShop };
