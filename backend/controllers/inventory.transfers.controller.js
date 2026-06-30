// controllers/inventory.transfers.controller.js
const { StockTransfer, Product, StockLevel, StockMovement } = require('../models');
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
    const transfer = await StockTransfer.findByPk(transfer_id);

    if (!transfer) return res.status(404).json({ success: false, message: 'Transfer not found' });
    if (transfer.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending transfers can be approved' });
    }

    // Verify product still belongs to source shop and has enough stock
    const product = await Product.findOne({
      where: { id: transfer.product_id, shop_id: transfer.from_shop_id },
    });
    if (!product) {
      return res.status(400).json({ success: false, message: 'Source product not found in the source shop' });
    }

    const stockLevel = await StockLevel.findOne({
      where: { product_id: transfer.product_id },
    });
    if (!stockLevel || stockLevel.current_qty < transfer.qty) {
      return res.status(400).json({ success: false, message: 'Insufficient stock to complete transfer' });
    }

    // Deduct from source shop
    await StockLevel.decrement('current_qty', {
      by: transfer.qty,
      where: { product_id: transfer.product_id },
    });

    // Log outgoing movement
    await StockMovement.create({
      product_id: transfer.product_id,
      qty_change: -transfer.qty,
      movement_type: 'transfer',
      reference_no: `TRANSFER-OUT-${transfer.id}`,
      created_by: req.user.id,
    });

    await transfer.update({ status: 'in_transit' });
    res.json({ success: true, data: transfer });
  } catch (err) { next(err); }
};

const receiveTransfer = async (req, res, next) => {
  try {
    const { transfer_id } = req.params;
    const transfer = await StockTransfer.findByPk(transfer_id, {
      include: [{ model: Product, as: 'product' }],
    });

    if (!transfer) return res.status(404).json({ success: false, message: 'Transfer not found' });
    if (transfer.status !== 'in_transit') {
      return res.status(400).json({ success: false, message: 'Transfer must be in transit to receive' });
    }

    // Find or create product at destination shop
    let destProduct = await Product.findOne({
      where: { shop_id: transfer.to_shop_id, name: transfer.product.name },
    });

    if (!destProduct) {
      destProduct = await Product.create({
        shop_id: transfer.to_shop_id,
        name: transfer.product.name,
        category: transfer.product.category,
        unit: transfer.product.unit,
        purchase_price: transfer.product.purchase_price,
        selling_price: transfer.product.selling_price,
      });
      await StockLevel.create({ product_id: destProduct.id });
    }

    // Add to destination shop stock
    await StockLevel.increment('current_qty', {
      by: transfer.qty,
      where: { product_id: destProduct.id },
    });

    // Log incoming movement
    await StockMovement.create({
      product_id: destProduct.id,
      qty_change: transfer.qty,
      movement_type: 'transfer',
      reference_no: `TRANSFER-IN-${transfer.id}`,
      created_by: req.user.id,
    });

    await transfer.update({
      status: 'received',
      received_by: req.user.id,
      received_at: new Date(),
    });

    res.json({ success: true, data: transfer });
  } catch (err) { next(err); }
};

const cancelTransfer = async (req, res, next) => {
  try {
    const { transfer_id } = req.params;
    const transfer = await StockTransfer.findByPk(transfer_id);

    if (!transfer) return res.status(404).json({ success: false, message: 'Transfer not found' });
    if (transfer.status === 'received' || transfer.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot cancel completed or already cancelled transfers' });
    }

    if (transfer.status === 'in_transit') {
      // Restore stock to source shop (source product)
      await StockLevel.increment('current_qty', {
        by: transfer.qty,
        where: { product_id: transfer.product_id },
      });
    }

    await transfer.update({ status: 'cancelled' });
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
