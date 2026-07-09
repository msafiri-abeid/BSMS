const dashService = require('../services/dashboard.service');

exports.adminDashboard = async (req, res, next) => {
  try {
    const data = await dashService.adminDashboard(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.collectorDashboard = async (req, res, next) => {
  try {
    const data = await dashService.collectorDashboard(req.user.id, req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.financeDashboard = async (req, res, next) => {
  try {
    const data = await dashService.financeDashboard(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.directorDashboard = async (req, res, next) => {
  try {
    const data = await dashService.directorDashboard(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.cashierDashboard = async (req, res, next) => {
  try {
    const data = await dashService.cashierDashboard(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.salesDashboard = async (req, res, next) => {
  try {
    const data = await dashService.salesDashboard(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.technicianDashboard = async (req, res, next) => {
  try {
    const data = await dashService.technicianDashboard(req.user.id, req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};
