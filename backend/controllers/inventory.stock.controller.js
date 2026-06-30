const { Product, StockLevel, StockMovement } = require('../models');

const addStock = async (req, res, next) => {
  try {
    const { product_id, qty, reference_no, note } = req.body;
    const receipt_url = req.file?.path || null;

    if (!product_id || !qty || qty < 1) {
      return res.status(400).json({ success: false, message: 'product_id and positive qty required' });
    }

    const product = await Product.findByPk(product_id, {
      include: [{ model: StockLevel, as: 'stockLevel' }],
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const [stockLevel] = await StockLevel.findOrCreate({
      where: { product_id },
      defaults: { current_qty: 0, reorder_level: 10 },
    });

    await stockLevel.increment('current_qty', { by: parseInt(qty) });

    const movement = await StockMovement.create({
      product_id,
      qty_change: parseInt(qty),
      movement_type: 'purchase',
      reference_no: reference_no || null,
      note: note || null,
      receipt_url,
      created_by: req.user.id,
    });

    const updated = await Product.findByPk(product_id, {
      include: [{ model: StockLevel, as: 'stockLevel' }],
    });

    res.status(201).json({
      success: true,
      data: { product: updated, movement },
    });
  } catch (err) { next(err); }
};

module.exports = { addStock };
