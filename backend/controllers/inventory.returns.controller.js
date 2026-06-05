// controllers/inventory.returns.controller.js
const { SalesReturn, Sale, SaleItem, Product, StockLevel, StockMovement } = require('../models');

const listReturns = async (req, res, next) => {
  try {
    const { shop_id, sale_id } = req.query;
    const where = {};
    if (sale_id) where.sale_id = parseInt(sale_id);

    let include = [
      { model: Sale, as: 'sale' },
      { model: Product, as: 'product', attributes: ['name', 'category'] },
    ];

    if (shop_id) {
      include.push({
        model: Sale,
        as: 'sale',
        where: { shop_id: parseInt(shop_id) },
      });
    }

    const returns = await SalesReturn.findAll({
      where,
      include,
      order: [['return_date', 'DESC']],
    });
    res.json({ success: true, data: returns });
  } catch (err) { next(err); }
};

const getReturn = async (req, res, next) => {
  try {
    const ret = await SalesReturn.findByPk(req.params.id, {
      include: [
        { model: Sale, as: 'sale' },
        { model: Product, as: 'product' },
      ],
    });
    if (!ret) return res.status(404).json({ success: false, message: 'Return not found' });
    res.json({ success: true, data: ret });
  } catch (err) { next(err); }
};

const processReturn = async (req, res, next) => {
  try {
    const { sale_id, product_id, qty_returned, reason, refund_method } = req.body;

    if (!sale_id || !product_id || !qty_returned || !reason) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const sale = await Sale.findByPk(sale_id);
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });

    const product = await Product.findByPk(product_id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Calculate refund amount
    const refund_amount_tzs = qty_returned * product.selling_price;

    const saleReturn = await SalesReturn.create({
      sale_id,
      product_id,
      return_date: new Date(),
      qty_returned,
      reason,
      refund_amount_tzs,
      refund_method: refund_method || 'cash',
      processed_by: req.user.id,
    });

    // Restore stock
    await StockLevel.increment('current_qty', {
      by: qty_returned,
      where: { product_id },
    });

    // Log movement
    await StockMovement.create({
      product_id,
      qty_change: qty_returned,
      movement_type: 'adjustment',
      reference_no: `RETURN-${saleReturn.id}`,
      note: `Sales return: ${reason}`,
      created_by: req.user.id,
    });

    // Update sale status
    const totalReturned = await SalesReturn.sum('qty_returned', {
      where: { sale_id },
    });

    const saleItems = await Sale.findByPk(sale_id, {
      include: [{ model: SaleItem, as: 'items' }],
    });

    const totalQty = saleItems.items.reduce((sum, item) => sum + item.qty, 0);

    if (totalReturned >= totalQty) {
      await sale.update({ status: 'returned' });
    } else if (totalReturned > 0) {
      await sale.update({ status: 'partial_returned' });
    }

    res.status(201).json({ success: true, data: saleReturn });
  } catch (err) { next(err); }
};

const approveReturn = async (req, res, next) => {
  try {
    const { return_id } = req.params;
    const ret = await SalesReturn.findByPk(return_id);

    if (!ret) return res.status(404).json({ success: false, message: 'Return not found' });

    // Return is already processed on creation - just confirm
    res.json({ success: true, data: ret, message: 'Return approved' });
  } catch (err) { next(err); }
};

module.exports = {
  listReturns,
  getReturn,
  processReturn,
  approveReturn,
};
