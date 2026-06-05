// controllers/inventory.audits.controller.js
const { StockAudit, AuditItem, Product, StockLevel, StockMovement, Shop } = require('../models');

const listAudits = async (req, res, next) => {
  try {
    const { shop_id, status } = req.query;
    const where = {};
    if (shop_id) where.shop_id = parseInt(shop_id);
    if (status) where.status = status;

    const audits = await StockAudit.findAll({
      where,
      include: [
        { model: Shop, as: 'shop', attributes: ['name'] },
        { model: AuditItem, as: 'items', include: [{ model: Product, as: 'product', attributes: ['name', 'category'] }] },
      ],
      order: [['audit_date', 'DESC']],
    });
    res.json({ success: true, data: audits });
  } catch (err) { next(err); }
};

const getAudit = async (req, res, next) => {
  try {
    const audit = await StockAudit.findByPk(req.params.id, {
      include: [
        { model: Shop, as: 'shop' },
        { model: AuditItem, as: 'items', include: [{ model: Product, as: 'product' }] },
      ],
    });
    if (!audit) return res.status(404).json({ success: false, message: 'Audit not found' });
    res.json({ success: true, data: audit });
  } catch (err) { next(err); }
};

const startAudit = async (req, res, next) => {
  try {
    const { shop_id } = req.body;
    if (!shop_id) return res.status(400).json({ success: false, message: 'shop_id required' });

    const audit = await StockAudit.create({
      shop_id,
      audit_date: new Date(),
      auditor_id: req.user.id,
      status: 'draft',
    });

    // Get all products for this shop and create audit items
    const products = await Product.findAll({
      where: { shop_id },
      include: [{ model: StockLevel, as: 'stockLevel' }],
    });

    for (let product of products) {
      await AuditItem.create({
        audit_id: audit.id,
        product_id: product.id,
        system_qty: product.stockLevel?.current_qty || 0,
        counted_qty: 0,
      });
    }

    res.status(201).json({ success: true, data: audit });
  } catch (err) { next(err); }
};

const updateAuditItem = async (req, res, next) => {
  try {
    const { audit_id, product_id, counted_qty, notes } = req.body;

    const item = await AuditItem.findOne({
      where: { audit_id, product_id },
    });

    if (!item) return res.status(404).json({ success: false, message: 'Audit item not found' });

    const variance = counted_qty - item.system_qty;
    await item.update({ counted_qty, variance, notes });

    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};

const completeAudit = async (req, res, next) => {
  try {
    const { audit_id } = req.params;
    const audit = await StockAudit.findByPk(audit_id, {
      include: [{ model: AuditItem, as: 'items' }],
    });

    if (!audit) return res.status(404).json({ success: false, message: 'Audit not found' });

    // Calculate total variance items
    const varianceItems = audit.items.filter(i => i.variance !== 0);
    
    await audit.update({
      status: 'completed',
      total_variance_items: varianceItems.length,
    });

    // Log movements for variances
    for (let item of varianceItems) {
      if (item.variance !== 0) {
        await StockMovement.create({
          product_id: item.product_id,
          qty_change: item.variance,
          movement_type: 'adjustment',
          reference_no: `AUDIT-${audit.id}`,
          note: `Stock audit adjustment: system=${item.system_qty}, counted=${item.counted_qty}`,
          created_by: req.user.id,
        });

        // Update stock level
        await StockLevel.update(
          { current_qty: item.counted_qty },
          { where: { product_id: item.product_id } }
        );
      }
    }

    res.json({ success: true, data: audit });
  } catch (err) { next(err); }
};

const verifyAudit = async (req, res, next) => {
  try {
    const { audit_id } = req.params;
    const audit = await StockAudit.findByPk(audit_id);

    if (!audit) return res.status(404).json({ success: false, message: 'Audit not found' });
    if (audit.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Audit must be completed before verification' });
    }

    await audit.update({
      status: 'verified',
      verified_by: req.user.id,
    });

    res.json({ success: true, data: audit });
  } catch (err) { next(err); }
};

module.exports = {
  listAudits,
  getAudit,
  startAudit,
  updateAuditItem,
  completeAudit,
  verifyAudit,
};
