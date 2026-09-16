// controllers/inventory.transfers.controller.js
const { sequelize, StockTransfer, Product, StockLevel, StockMovement } = require('../models');
const { Op } = require('sequelize');

const listTransfers = async (req, res, next) => {
  try {
    const { shop_id, status } = req.query;
    const where = {};
    if (shop_id) {
      where[Op.or] = [
        { from_shop_id: parseInt(shop_id) },
        { to_shop_id: parseInt(shop_id) },
      ];
    }
    if (status) where.status = status;

    const transfers = await StockTransfer.findAll({
      where,
      include: [
        { model: Product, as: 'product', attributes: ['name', 'category'] },
      ],
      order: [['transfer_date', 'DESC']],
    });
    res.json({ success: true, data: transfers });
  } catch (err) { next(err); }
};

const getTransfer = async (req, res, next) => {
  try {
    const transfer = await StockTransfer.findByPk(req.params.id, {
      include: [
        { model: Product, as: 'product' },
      ],
    });
    if (!transfer) return res.status(404).json({ success: false, message: 'Transfer not found' });
    res.json({ success: true, data: transfer });
  } catch (err) { next(err); }
};

const initializeTransfer = async (req, res, next) => {
  try {
    const { from_shop_id, to_shop_id, product_id, qty, notes } = req.body;

    if (!from_shop_id || !to_shop_id || !product_id || !qty) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Verify product belongs to source shop
    const product = await Product.findOne({
      where: { id: product_id, shop_id: from_shop_id },
    });
    if (!product) {
      return res.status(400).json({ success: false, message: 'Product does not belong to the source shop' });
    }

    // Check if stock is available
    const stockLevel = await StockLevel.findOne({
      where: { product_id },
    });

    if (!stockLevel || stockLevel.current_qty < qty) {
      return res.status(400).json({ success: false, message: 'Insufficient stock' });
    }

    const transfer = await StockTransfer.create({
      from_shop_id,
      to_shop_id,
      product_id,
      qty,
      transfer_date: new Date(),
      status: 'pending',
      initiated_by: req.user.id,
      notes,
    });

    res.status(201).json({ success: true, data: transfer });
  } catch (err) { next(err); }
};

const approveTransfer = async (req, res, next) => {
  try {
    const { transfer_id } = req.params;

    const transfer = await sequelize.transaction(async (t) => {
      const tr = await StockTransfer.findByPk(transfer_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!tr) { const e = new Error('Transfer not found'); e.status = 404; throw e; }
      if (tr.status !== 'pending') { const e = new Error('Only pending transfers can be approved'); e.status = 400; throw e; }

      // Verify product still belongs to source shop and has enough stock
      const product = await Product.findOne({
        where: { id: tr.product_id, shop_id: tr.from_shop_id },
        transaction: t,
      });
      if (!product) { const e = new Error('Source product not found in the source shop'); e.status = 400; throw e; }

      const stockLevel = await StockLevel.findOne({
        where: { product_id: tr.product_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!stockLevel || stockLevel.current_qty < tr.qty) {
        const e = new Error('Insufficient stock to complete transfer');
        e.status = 400;
        throw e;
      }

      // Deduct from source shop
      await StockLevel.decrement('current_qty', {
        by: tr.qty,
        where: { product_id: tr.product_id },
        transaction: t,
      });

      // Log outgoing movement
      await StockMovement.create({
        product_id: tr.product_id,
        qty_change: -tr.qty,
        movement_type: 'transfer',
        reference_no: `TRANSFER-OUT-${tr.id}`,
        created_by: req.user.id,
      }, { transaction: t });

      await tr.update({ status: 'in_transit' }, { transaction: t });
      return tr;
    });

    res.json({ success: true, data: transfer });
  } catch (err) { next(err); }
};

const receiveTransfer = async (req, res, next) => {
  try {
    const { transfer_id } = req.params;

    const transfer = await sequelize.transaction(async (t) => {
      const tr = await StockTransfer.findByPk(transfer_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!tr) { const e = new Error('Transfer not found'); e.status = 404; throw e; }
      if (tr.status !== 'in_transit') { const e = new Error('Transfer must be in transit to receive'); e.status = 400; throw e; }

      const srcProduct = await Product.findByPk(tr.product_id, { transaction: t });

      // Find or create product at destination shop
      let destProduct = await Product.findOne({
        where: { shop_id: tr.to_shop_id, name: srcProduct.name },
        transaction: t,
      });

      if (!destProduct) {
        destProduct = await Product.create({
          shop_id: tr.to_shop_id,
          name: srcProduct.name,
          category: srcProduct.category,
          unit: srcProduct.unit,
          purchase_price: srcProduct.purchase_price,
          selling_price: srcProduct.selling_price,
        }, { transaction: t });
        await StockLevel.create({ product_id: destProduct.id }, { transaction: t });
      }

      // Add to destination shop stock
      await StockLevel.increment('current_qty', {
        by: tr.qty,
        where: { product_id: destProduct.id },
        transaction: t,
      });

      // Log incoming movement
      await StockMovement.create({
        product_id: destProduct.id,
        qty_change: tr.qty,
        movement_type: 'transfer',
        reference_no: `TRANSFER-IN-${tr.id}`,
        created_by: req.user.id,
      }, { transaction: t });

      await tr.update({
        status: 'received',
        received_by: req.user.id,
        received_at: new Date(),
      }, { transaction: t });

      return tr;
    });

    res.json({ success: true, data: transfer });
  } catch (err) { next(err); }
};

const cancelTransfer = async (req, res, next) => {
  try {
    const { transfer_id } = req.params;

    const transfer = await sequelize.transaction(async (t) => {
      const tr = await StockTransfer.findByPk(transfer_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!tr) { const e = new Error('Transfer not found'); e.status = 404; throw e; }
      if (tr.status === 'received' || tr.status === 'cancelled') {
        const e = new Error('Cannot cancel completed or already cancelled transfers');
        e.status = 400;
        throw e;
      }

      if (tr.status === 'in_transit') {
        // Restore stock to source shop (source product)
        await StockLevel.increment('current_qty', {
          by: tr.qty,
          where: { product_id: tr.product_id },
          transaction: t,
        });
      }

      await tr.update({ status: 'cancelled' }, { transaction: t });
      return tr;
    });

    res.json({ success: true, data: transfer });
  } catch (err) { next(err); }
};

module.exports = {
  listTransfers,
  getTransfer,
  initializeTransfer,
  approveTransfer,
  receiveTransfer,
  cancelTransfer,
};
