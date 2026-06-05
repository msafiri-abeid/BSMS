// controllers/inventory.sales.controller.js
const { Sale, SaleItem, SalesReturn, SalePayment, Product, StockLevel, StockMovement, Shop } = require('../models');
const { Op } = require('sequelize');

const listSales = async (req, res, next) => {
  try {
    const { shop_id, start_date, end_date, payment_method } = req.query;
    const where = {};
    if (shop_id) where.shop_id = parseInt(shop_id);
    if (start_date || end_date) {
      where.sale_date = {};
      if (start_date) where.sale_date[Op.gte] = new Date(start_date);
      if (end_date) where.sale_date[Op.lte] = new Date(end_date);
    }
    if (payment_method) where.payment_method = payment_method;

    const sales = await Sale.findAll({
      where,
      include: [
        { model: Shop, as: 'shop', attributes: ['id', 'name'] },
        { model: SaleItem, as: 'items', include: [{ model: Product, as: 'product', attributes: ['name', 'category'] }] },
        { model: SalePayment, as: 'payments', attributes: ['amount_tzs', 'payment_method', 'reference'] },
      ],
      order: [['sale_date', 'DESC']],
    });
    res.json({ success: true, data: sales });
  } catch (err) { next(err); }
};

const getSale = async (req, res, next) => {
  try {
    const sale = await Sale.findByPk(req.params.id, {
      include: [
        { model: Shop, as: 'shop', attributes: ['id', 'name'] },
        { model: SaleItem, as: 'items', include: [{ model: Product, as: 'product' }] },
        { model: SalePayment, as: 'payments' },
        { model: SalesReturn, as: 'returns' },
      ],
    });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    res.json({ success: true, data: sale });
  } catch (err) { next(err); }
};

const recordSale = async (req, res, next) => {
  try {
    const { shop_id, items, payment_method, customer_name, discount_amount_tzs, notes } = req.body;
    
    if (!shop_id || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Calculate totals
    let total_amount_tzs = 0;
    for (let item of items) {
      const lineTotal = (item.unit_price_tzs * item.qty) - ((item.discount_pct || 0) * (item.unit_price_tzs * item.qty) / 100);
      total_amount_tzs += lineTotal;
    }
    const net_amount_tzs = Math.max(0, total_amount_tzs - (discount_amount_tzs || 0));

    const sale = await Sale.create({
      shop_id,
      sale_date: new Date(),
      total_amount_tzs,
      discount_amount_tzs: discount_amount_tzs || 0,
      net_amount_tzs,
      payment_method,
      customer_name,
      notes,
      recorded_by: req.user.id,
    });

    // Create sale items and update stock
    for (let item of items) {
      const lineTotal = (item.unit_price_tzs * item.qty) - ((item.discount_pct || 0) * (item.unit_price_tzs * item.qty) / 100);
      
      await SaleItem.create({
        sale_id: sale.id,
        product_id: item.product_id,
        qty: item.qty,
        unit_price_tzs: item.unit_price_tzs,
        discount_pct: item.discount_pct || 0,
        line_total_tzs: lineTotal,
      });

      // Reduce stock
      await StockLevel.decrement('current_qty', {
        by: item.qty,
        where: { product_id: item.product_id },
      });

      // Log movement
      await StockMovement.create({
        product_id: item.product_id,
        qty_change: -item.qty,
        movement_type: 'sale',
        reference_no: `SALE-${sale.id}`,
        created_by: req.user.id,
      });
    }

    res.status(201).json({ success: true, data: sale });
  } catch (err) { next(err); }
};

const recordPayment = async (req, res, next) => {
  try {
    const { sale_id, amount_tzs, payment_method, reference, notes } = req.body;
    
    const sale = await Sale.findByPk(sale_id);
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });

    const payment = await SalePayment.create({
      sale_id,
      amount_tzs,
      payment_method,
      reference,
      notes,
      recorded_by: req.user.id,
    });

    res.status(201).json({ success: true, data: payment });
  } catch (err) { next(err); }
};

const getSaleReport = async (req, res, next) => {
  try {
    const { shop_id, start_date, end_date } = req.query;
    const where = {};
    if (shop_id) where.shop_id = parseInt(shop_id);
    if (start_date || end_date) {
      where.sale_date = {};
      if (start_date) where.sale_date[Op.gte] = new Date(start_date);
      if (end_date) where.sale_date[Op.lte] = new Date(end_date);
    }

    const sales = await Sale.findAll({
      where,
      include: [{ model: SaleItem, as: 'items', include: [{ model: Product, as: 'product' }] }],
      attributes: ['id', 'shop_id', 'sale_date', 'total_amount_tzs', 'discount_amount_tzs', 'net_amount_tzs', 'payment_method'],
    });

    let report = {
      total_sales: sales.length,
      total_amount: 0,
      total_discount: 0,
      net_total: 0,
      by_payment_method: {},
      by_product: {},
      daily_breakdown: {},
    };

    sales.forEach(sale => {
      report.total_amount += sale.total_amount_tzs;
      report.total_discount += sale.discount_amount_tzs;
      report.net_total += sale.net_amount_tzs;

      // By payment method
      if (!report.by_payment_method[sale.payment_method]) {
        report.by_payment_method[sale.payment_method] = { count: 0, amount: 0 };
      }
      report.by_payment_method[sale.payment_method].count += 1;
      report.by_payment_method[sale.payment_method].amount += sale.net_amount_tzs;

      // By product
      sale.items.forEach(item => {
        const pkey = `${item.product.id}-${item.product.name}`;
        if (!report.by_product[pkey]) {
          report.by_product[pkey] = { qty: 0, revenue: 0, cost: 0 };
        }
        report.by_product[pkey].qty += item.qty;
        report.by_product[pkey].revenue += item.line_total_tzs;
        report.by_product[pkey].cost += item.qty * item.product.purchase_price;
      });

      // Daily breakdown
      const dateKey = sale.sale_date.toISOString().split('T')[0];
      if (!report.daily_breakdown[dateKey]) {
        report.daily_breakdown[dateKey] = { sales_count: 0, amount: 0 };
      }
      report.daily_breakdown[dateKey].sales_count += 1;
      report.daily_breakdown[dateKey].amount += sale.net_amount_tzs;
    });

    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

module.exports = {
  listSales,
  getSale,
  recordSale,
  recordPayment,
  getSaleReport,
};
