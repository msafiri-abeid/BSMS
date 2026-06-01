// controllers/dashboard.controller.js
const { sequelize, Collection, Machine, Shop, Ticket, Expense, WeeklyTarget, CollectorAssignment, Invoice } = require('../models');
const { Op } = require('sequelize');

const adminDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);

    const [totalMachines, activeShops, openTickets, pendingExpenses, todayCollections, weekCollections] = await Promise.all([
      Machine.count({ where: { status: 'active' } }),
      Shop.count({ where: { status: 'active' } }),
      Ticket.count({ where: { status: ['open', 'in_progress', 'reopened'] } }),
      Expense.count({ where: { status: 'pending' } }),
      Collection.sum('gross_tzs', { where: { collected_at: { [Op.gte]: today } } }),
      Collection.sum('gross_tzs', { where: { collected_at: { [Op.gte]: weekStart } } }),
    ]);

    // Last 30 days chart
    const last30Days = await sequelize.query(`
      SELECT DATE(collected_at) as date, SUM(gross_tzs) as total
      FROM collections
      WHERE collected_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(collected_at)
      ORDER BY date ASC
    `, { type: sequelize.QueryTypes.SELECT });

    const topMachines = await Collection.findAll({
      attributes: ['machine_id', [sequelize.fn('SUM', sequelize.col('gross_tzs')), 'total_tzs']],
      where: { collected_at: { [Op.gte]: weekStart } },
      group: ['machine_id'],
      order: [[sequelize.fn('SUM', sequelize.col('gross_tzs')), 'DESC']],
      limit: 5,
      include: [{ model: Machine, as: 'machine', attributes: ['slot_code', 'manufacturer'] }],
    });

    res.json({
      success: true,
      data: {
        kpis: { totalMachines, activeShops, openTickets, pendingExpenses, todayCollections: todayCollections || 0, weekCollections: weekCollections || 0 },
        chart: last30Days,
        topMachines,
      },
    });
  } catch (err) { next(err); }
};

const collectorDashboard = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);

    const [assignments, myWeekCollections, openTickets] = await Promise.all([
      CollectorAssignment.findAll({
        where: { collector_id: req.user.id, assigned_date: today },
        include: [{ model: Machine, as: 'machine', attributes: ['slot_code', 'manufacturer'] }, { model: Shop, as: 'shop', attributes: ['name'] }],
      }),
      Collection.findAll({
        where: { collector_id: req.user.id, collected_at: { [Op.gte]: weekStart } },
        attributes: ['id', 'gross_tzs', 'collected_at', 'machine_id'],
      }),
      Ticket.count({ where: { requester_id: req.user.id, status: ['open', 'in_progress'] } }),
    ]);

    res.json({ success: true, data: { assignments, myWeekCollections, openTickets } });
  } catch (err) { next(err); }
};

const financeDashboard = async (req, res, next) => {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [pendingExpenses, dueSoonInvoices, monthIncome, monthExpenses] = await Promise.all([
      Expense.findAll({ where: { status: 'pending' }, include: [{ model: require('../models').User, as: 'submitter', attributes: ['name'] }], limit: 10 }),
      Invoice.findAll({ where: { status: ['sent', 'overdue'], due_date: { [Op.lte]: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }, limit: 10 }),
      Collection.sum('gross_tzs', { where: { collected_at: { [Op.gte]: monthStart } } }),
      Expense.sum('amount', { where: { status: 'approved', created_at: { [Op.gte]: monthStart } } }),
    ]);

    res.json({ success: true, data: { pendingExpenses, dueSoonInvoices, monthIncome: monthIncome || 0, monthExpenses: monthExpenses || 0 } });
  } catch (err) { next(err); }
};

const directorDashboard = async (req, res, next) => {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [monthRevenue, monthExpenses] = await Promise.all([
      Collection.sum('gross_tzs', { where: { collected_at: { [Op.gte]: monthStart } } }),
      Expense.sum('amount', { where: { status: 'approved', created_at: { [Op.gte]: monthStart } } }),
    ]);

    const last6Months = await sequelize.query(`
      SELECT DATE_FORMAT(collected_at, '%Y-%m') as month, SUM(gross_tzs) as revenue
      FROM collections GROUP BY month ORDER BY month DESC LIMIT 6
    `, { type: sequelize.QueryTypes.SELECT });

    res.json({ success: true, data: { monthRevenue: monthRevenue || 0, monthExpenses: monthExpenses || 0, netProfit: (monthRevenue || 0) - (monthExpenses || 0), trend: last6Months.reverse() } });
  } catch (err) { next(err); }
};

module.exports = { adminDashboard, collectorDashboard, financeDashboard, directorDashboard };
