// controllers/machine.controller.js
const { Machine, MachineDeployment, MachineExchange, MachineRefill, Shop } = require('../models');
const { Op } = require('sequelize');
const { DEFAULT_CREDIT_VALUES } = require('../config/constants');

const list = async (req, res, next) => {
  try {
    const { shop_id, status, manufacturer, search, limit = 50, offset = 0 } = req.query;
    const where = {};
    if (shop_id) where.current_shop_id = shop_id;
    if (status) where.status = status;
    if (manufacturer) where.manufacturer = manufacturer;
    if (search) where.slot_code = { [Op.like]: `%${search}%` };

    const data = await Machine.findAndCountAll({
      where, limit: +limit, offset: +offset,
      include: [{ model: Shop, as: 'currentShop', attributes: ['name'] }],
      order: [['slot_code', 'ASC']],
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const machine = await Machine.findByPk(req.params.id, {
      include: [
        { model: Shop, as: 'currentShop', attributes: ['name'] },
        { model: MachineDeployment, as: 'deployments', include: [{ model: Shop, as: 'shop', attributes: ['name'] }], order: [['deployed_at', 'DESC']] },
        { model: MachineExchange, as: 'exchanges' },
      ],
    });
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });
    res.json({ success: true, data: machine });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { manufacturer } = req.body;
    if (!req.body.credit_value_tzs) {
      req.body.credit_value_tzs = DEFAULT_CREDIT_VALUES[manufacturer] || 100;
    }
    const machine = await Machine.create(req.body);
    res.status(201).json({ success: true, data: machine });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const machine = await Machine.findByPk(req.params.id);
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });
    await machine.update(req.body);
    res.json({ success: true, data: machine });
  } catch (err) { next(err); }
};

const deploy = async (req, res, next) => {
  try {
    const machine = await Machine.findByPk(req.params.id);
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });
    const { shop_id, opening_count, initial_load_tzs } = req.body;
    const deployment = await MachineDeployment.create({
      machine_id: machine.id, shop_id, deployed_by: req.user.id,
      opening_count: opening_count || 0, initial_load_tzs: initial_load_tzs || 0,
      deployed_at: new Date(),
    });
    await machine.update({ current_shop_id: shop_id, status: 'active', previous_count: opening_count || 0 });
    res.json({ success: true, data: deployment });
  } catch (err) { next(err); }
};

const exchange = async (req, res, next) => {
  try {
    const machine = await Machine.findByPk(req.params.id);
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });
    const { to_shop_id, reason } = req.body;
    const exchangeRecord = await MachineExchange.create({
      machine_id: machine.id, from_shop_id: machine.current_shop_id,
      to_shop_id, transferred_by: req.user.id, reason, exchanged_at: new Date(),
    });
    await machine.update({ current_shop_id: to_shop_id });
    res.json({ success: true, data: exchangeRecord });
  } catch (err) { next(err); }
};

const refill = async (req, res, next) => {
  try {
    const machine = await Machine.findByPk(req.params.id);
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });
    const { token_qty, token_value_tzs, notes } = req.body;
    const refillRecord = await MachineRefill.create({
      machine_id: machine.id, shop_id: machine.current_shop_id,
      refilled_by: req.user.id, token_qty, token_value_tzs,
      total_tzs: token_qty * token_value_tzs, notes, refilled_at: new Date(),
    });
    res.json({ success: true, data: refillRecord });
  } catch (err) { next(err); }
};

module.exports = { list, getOne, create, update, deploy, exchange, refill };
