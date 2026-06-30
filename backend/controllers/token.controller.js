const tokenService = require('../services/token.service');

const distribute = async (req, res, next) => {
  try {
    const t = await tokenService.distribute({ ...req.body, created_by: req.user.id });
    res.status(201).json({ success: true, data: t });
  } catch (err) { next(err); }
};

const returnTokens = async (req, res, next) => {
  try {
    const t = await tokenService.returnTokens({ ...req.body, created_by: req.user.id });
    res.status(201).json({ success: true, data: t });
  } catch (err) { next(err); }
};

const lend = async (req, res, next) => {
  try {
    const t = await tokenService.lendToVendor({ ...req.body, created_by: req.user.id });
    res.status(201).json({ success: true, data: t });
  } catch (err) { next(err); }
};

const balances = async (req, res, next) => {
  try {
    const [office, outstanding] = await Promise.all([
      tokenService.getOfficeBalance(),
      tokenService.getOutstandingBalances(),
    ]);
    res.json({ success: true, data: { office, outstanding } });
  } catch (err) { next(err); }
};

const movements = async (req, res, next) => {
  try {
    const result = await tokenService.getMovements(req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const addMovement = async (req, res, next) => {
  try {
    const m = await tokenService.recordMovement({ ...req.body, created_by: req.user.id });
    res.status(201).json({ success: true, data: m });
  } catch (err) { next(err); }
};

module.exports = { distribute, returnTokens, lend, balances, movements, addMovement };
