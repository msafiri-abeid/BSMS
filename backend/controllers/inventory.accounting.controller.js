// controllers/inventory.accounting.controller.js
const { Sale, SaleItem, SalesReturn, Product, StockLevel, Shop } = require('../models');
const { Op } = require('sequelize');

const getShopProfitLoss = async (req, res, next) => {
  try {
    const { shop_id, start_date, end_date } = req.query;
    
    if (!shop_id) return res.status(400).json({ success: false, message: 'shop_id required' });

    const where = { shop_id: parseInt(shop_id) };
    if (start_date || end_date) {
      where.sale_date = {};
      if (start_date) where.sale_date[Op.gte] = new Date(start_date);
      if (end_date) where.sale_date[Op.lte] = new Date(end_date);
    }

    const sales = await Sale.findAll({
      where,
      include: [
        {
          model: SaleItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['purchase_price'] }],
        },
        { model: SalesReturn, as: 'returns' },
      ],
    });

    let profitLoss = {
      period: { start: start_date || 'all', end: end_date || 'all' },
      total_revenue: 0,
      total_cost: 0,
      total_gross_profit: 0,
      total_returns_refund: 0,
      net_profit: 0,
      transactions: [],
      by_product: {},
    };

    sales.forEach(sale => {
      sale.items.forEach(item => {
        const cost = item.qty * item.product.purchase_price;
        const revenue = item.line_total_tzs;
        const gross_profit = revenue - cost;

        profitLoss.total_revenue += revenue;
        profitLoss.total_cost += cost;
        profitLoss.total_gross_profit += gross_profit;

        // By product breakdown
        const pkey = `${item.product_id}-${item.product.name}`;
        if (!profitLoss.by_product[pkey]) {
          profitLoss.by_product[pkey] = {
            qty_sold: 0,
            revenue: 0,
            cost: 0,
            gross_profit: 0,
            margin_pct: 0,
          };
        }
        profitLoss.by_product[pkey].qty_sold += item.qty;
        profitLoss.by_product[pkey].revenue += revenue;
        profitLoss.by_product[pkey].cost += cost;
        profitLoss.by_product[pkey].gross_profit += gross_profit;
      });

      // Handle returns
      sale.returns.forEach(ret => {
        profitLoss.total_returns_refund += ret.refund_amount_tzs;
      });
    });

    // Calculate margins
    Object.keys(profitLoss.by_product).forEach(key => {
      const item = profitLoss.by_product[key];
      item.margin_pct = item.revenue > 0 ? Math.round((item.gross_profit / item.revenue) * 100) : 0;
    });

    profitLoss.net_profit = profitLoss.total_gross_profit - profitLoss.total_returns_refund;

    res.json({ success: true, data: profitLoss });
  } catch (err) { next(err); }
};

const getProductMargins = async (req, res, next) => {
  try {
    const { shop_id } = req.query;
    
    if (!shop_id) return res.status(400).json({ success: false, message: 'shop_id required' });

    const products = await Product.findAll({
      where: { shop_id: parseInt(shop_id) },
      include: [{ model: StockLevel, as: 'stockLevel' }],
    });

    const margins = products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      purchase_price: p.purchase_price,
      selling_price: p.selling_price,
      margin_tzs: p.selling_price - p.purchase_price,
      margin_pct: Math.round(((p.selling_price - p.purchase_price) / p.purchase_price) * 100),
      current_stock: p.stockLevel?.current_qty || 0,
      stock_value_cost: (p.stockLevel?.current_qty || 0) * p.purchase_price,
      stock_value_selling: (p.stockLevel?.current_qty || 0) * p.selling_price,
    }));

    // Sort by margin percentage
    margins.sort((a, b) => b.margin_pct - a.margin_pct);

    res.json({ success: true, data: margins });
  } catch (err) { next(err); }
};

const getInventoryValuation = async (req, res, next) => {
  try {
    const { shop_id, method } = req.query; // method: FIFO, LIFO, or Average
    
    if (!shop_id) return res.status(400).json({ success: false, message: 'shop_id required' });

    const products = await Product.findAll({
      where: { shop_id: parseInt(shop_id) },
      include: [{ model: StockLevel, as: 'stockLevel' }],
    });

    let valuation = {
      method: method || 'Average',
      shop_id: parseInt(shop_id),
      total_qty_on_hand: 0,
      total_valuation_cost: 0,
      total_valuation_retail: 0,
      items: [],
    };

    products.forEach(p => {
      const qty = p.stockLevel?.current_qty || 0;
      const cost_value = qty * p.purchase_price;
      const retail_value = qty * p.selling_price;

      valuation.total_qty_on_hand += qty;
      valuation.total_valuation_cost += cost_value;
      valuation.total_valuation_retail += retail_value;

      valuation.items.push({
        product_id: p.id,
        name: p.name,
        category: p.category,
        qty: qty,
        unit_cost: p.purchase_price,
        total_cost_value: cost_value,
        unit_retail: p.selling_price,
        total_retail_value: retail_value,
        potential_profit: retail_value - cost_value,
      });
    });

    res.json({ success: true, data: valuation });
  } catch (err) { next(err); }
};

const getDailyReport = async (req, res, next) => {
  try {
    const { shop_id, date } = req.query;
    
    if (!shop_id || !date) {
      return res.status(400).json({ success: false, message: 'shop_id and date required' });
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const sales = await Sale.findAll({
      where: {
        shop_id: parseInt(shop_id),
        sale_date: {
          [Op.between]: [startDate, endDate],
        },
      },
      include: [
        {
          model: SaleItem,
          as: 'items',
          include: [{ model: Product, as: 'product' }],
        },
        { model: SalesReturn, as: 'returns' },
      ],
    });

    let report = {
      date,
      shop_id: parseInt(shop_id),
      num_transactions: sales.length,
      total_sales_amount: 0,
      total_discount: 0,
      net_sales: 0,
      total_cost: 0,
      gross_profit: 0,
      returns: 0,
      net_profit: 0,
      items_sold: 0,
      payment_methods: {},
      top_products: {},
    };

    sales.forEach(sale => {
      report.total_sales_amount += sale.total_amount_tzs;
      report.total_discount += sale.discount_amount_tzs;
      report.net_sales += sale.net_amount_tzs;

      // Payment method breakdown
      if (!report.payment_methods[sale.payment_method]) {
        report.payment_methods[sale.payment_method] = 0;
      }
      report.payment_methods[sale.payment_method] += sale.net_amount_tzs;

      // Items and cost
      sale.items.forEach(item => {
        const cost = item.qty * item.product.purchase_price;
        report.items_sold += item.qty;
        report.total_cost += cost;
        report.gross_profit += item.line_total_tzs - cost;

        // Top products
        const pkey = item.product.name;
        if (!report.top_products[pkey]) {
          report.top_products[pkey] = { qty: 0, revenue: 0 };
        }
        report.top_products[pkey].qty += item.qty;
        report.top_products[pkey].revenue += item.line_total_tzs;
      });

      // Returns
      sale.returns.forEach(ret => {
        report.returns += ret.refund_amount_tzs;
      });
    });

    report.net_profit = report.gross_profit - report.returns;

    res.json({ success: true, data: report });
  } catch (err) { next(err); }
};

module.exports = {
  getShopProfitLoss,
  getProductMargins,
  getInventoryValuation,
  getDailyReport,
};
