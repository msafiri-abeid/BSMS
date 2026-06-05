// controllers/inventory.alerts.controller.js
const { LowStockAlert, Product, StockLevel, Shop } = require('../models');
const { Op } = require('sequelize');

const checkLowStock = async (req, res, next) => {
  try {
    const { shop_id } = req.query;
    
    if (!shop_id) return res.status(400).json({ success: false, message: 'shop_id required' });

    const products = await Product.findAll({
      where: { shop_id: parseInt(shop_id) },
      include: [{ model: StockLevel, as: 'stockLevel' }],
    });

    const alerts = [];

    for (let product of products) {
      const stockLevel = product.stockLevel;
      if (!stockLevel) continue;

      // Check if stock is below reorder level
      if (stockLevel.current_qty <= stockLevel.reorder_level) {
        // Check if alert already exists for today
        const existingAlert = await LowStockAlert.findOne({
          where: {
            product_id: product.id,
            shop_id: parseInt(shop_id),
            alert_date: {
              [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        });

        if (!existingAlert) {
          const alert = await LowStockAlert.create({
            product_id: product.id,
            shop_id: parseInt(shop_id),
            current_qty: stockLevel.current_qty,
            reorder_level: stockLevel.reorder_level,
            alert_date: new Date(),
          });
          alerts.push(alert);
        }
      }
    }

    res.json({ success: true, data: { alerts_created: alerts.length, alerts } });
  } catch (err) { next(err); }
};

const listAlerts = async (req, res, next) => {
  try {
    const { shop_id, acknowledged } = req.query;
    const where = {};

    if (shop_id) where.shop_id = parseInt(shop_id);
    if (acknowledged !== undefined) where.acknowledged = acknowledged === 'true';

    const alerts = await LowStockAlert.findAll({
      where,
      include: [
        { model: Product, as: 'product', attributes: ['name', 'category', 'selling_price'] },
        { model: Shop, as: 'shop', attributes: ['name'] },
      ],
      order: [['acknowledged', 'ASC'], ['alert_date', 'DESC']],
    });

    res.json({ success: true, data: alerts });
  } catch (err) { next(err); }
};

const getAlert = async (req, res, next) => {
  try {
    const alert = await LowStockAlert.findByPk(req.params.id, {
      include: [
        { model: Product, as: 'product' },
        { model: Shop, as: 'shop' },
      ],
    });
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    res.json({ success: true, data: alert });
  } catch (err) { next(err); }
};

const acknowledgeAlert = async (req, res, next) => {
  try {
    const { alert_id } = req.params;
    const alert = await LowStockAlert.findByPk(alert_id);

    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });

    await alert.update({
      acknowledged: true,
      acknowledged_by: req.user.id,
      acknowledged_at: new Date(),
    });

    res.json({ success: true, data: alert });
  } catch (err) { next(err); }
};

const getAlertSummary = async (req, res, next) => {
  try {
    const { shop_id } = req.query;
    const where = { acknowledged: false };

    if (shop_id) where.shop_id = parseInt(shop_id);

    const alerts = await LowStockAlert.findAll({
      where,
      include: [
        { model: Product, as: 'product', attributes: ['name'] },
      ],
    });

    const summary = {
      total_alerts: alerts.length,
      critical: alerts.filter(a => a.current_qty === 0).length,
      urgent: alerts.filter(a => a.current_qty > 0 && a.current_qty <= Math.ceil(a.reorder_level * 0.5)).length,
      warning: alerts.filter(a => a.current_qty > Math.ceil(a.reorder_level * 0.5) && a.current_qty <= a.reorder_level).length,
      products: alerts.map(a => ({
        product_id: a.product_id,
        name: a.product.name,
        current_qty: a.current_qty,
        reorder_level: a.reorder_level,
        urgency: a.current_qty === 0 ? 'critical' : a.current_qty <= Math.ceil(a.reorder_level * 0.5) ? 'urgent' : 'warning',
      })),
    };

    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
};

module.exports = {
  checkLowStock,
  listAlerts,
  getAlert,
  acknowledgeAlert,
  getAlertSummary,
};
