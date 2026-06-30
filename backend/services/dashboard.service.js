const { sequelize, Collection, Machine, Shop, Ticket, Expense, WeeklyTarget, CollectorAssignment, Invoice, TokenInventory, MachineDebt, User, Sale, StockMovement, LowStockAlert, Product, StockLevel, Partner } = require('../models');
const { Op } = require('sequelize');

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const weekStart = () => {
  const d = todayStart();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d;
};

const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const yearStart = () => {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getShopsInBusiness = async (partnerId) => {
  if (!partnerId) return null;
  const shops = await Shop.findAll({ where: { partner_id: partnerId }, attributes: ['id'], raw: true });
  return shops.map(s => s.id);
};

const buildScopeFilter = async (scope) => {
  if (!scope) return {};
  const where = {};
  if (scope.business_id) {
    const shopIds = await getShopsInBusiness(scope.business_id);
    if (shopIds?.length) where.shop_id = { [Op.in]: shopIds };
    else where.shop_id = -1; // no shops = no results
  }
  if (scope.shop_id) where.shop_id = scope.shop_id;
  if (scope.date_from || scope.date_to) {
    where.collected_at = {};
    if (scope.date_from) where.collected_at[Op.gte] = new Date(scope.date_from);
    if (scope.date_to) where.collected_at[Op.lte] = new Date(scope.date_to + 'T23:59:59.999Z');
  }
  return where;
};

const saleScopeFilter = async (scope) => {
  if (!scope) return {};
  const where = {};
  if (scope.business_id) {
    const shopIds = await getShopsInBusiness(scope.business_id);
    if (shopIds?.length) where.shop_id = { [Op.in]: shopIds };
    else where.shop_id = -1;
  }
  if (scope.shop_id) where.shop_id = scope.shop_id;
  if (scope.date_from || scope.date_to) {
    where.sale_date = {};
    if (scope.date_from) where.sale_date[Op.gte] = new Date(scope.date_from);
    if (scope.date_to) where.sale_date[Op.lte] = new Date(scope.date_to + 'T23:59:59.999Z');
  }
  return where;
};

exports.adminDashboard = async (reqQuery) => {
  const scope = {
    business_id: reqQuery.business_id || null,
    shop_id: reqQuery.shop_id || null,
    date_from: reqQuery.date_from || null,
    date_to: reqQuery.date_to || null,
  };
  const today = todayStart();
  const week = weekStart();
  const month = monthStart();
  const year = yearStart();
  const collFilter = await buildScopeFilter(scope);
  const salesFilter = await saleScopeFilter(scope);

  const [
    totalMachines, activeShops, openTickets, pendingExpenses,
    todayCollections, weekCollections,
    officeTokenStock, pendingTokenDebts, outstandingTokenDebtAmount, todayLogins,
    totalSales, totalPurchaseValue, invoiceDue, totalExpenses,
    stockAlertCount, fySales,
  ] = await Promise.all([
    Machine.count({ where: { status: 'active' } }),
    scope.shop_id ? 1 : Shop.count({ where: { status: 'active' } }),
    Ticket.count({ where: { status: ['open', 'in_progress', 'reopened'] } }),
    Expense.count({ where: { status: 'pending' } }),
    Collection.sum('gross_tzs', { where: { ...collFilter, collected_at: { [Op.gte]: today } } }),
    Collection.sum('gross_tzs', { where: { ...collFilter, collected_at: { [Op.gte]: week } } }),
    TokenInventory.sum('qty'),
    MachineDebt.count({ where: { status: ['pending', 'partial'], type: 'token' } }),
    MachineDebt.sum('amount', { where: { status: ['pending', 'partial'], type: 'token' } }),
    User.count({ where: { last_login: { [Op.gte]: today } } }),
    Sale.sum('net_amount_tzs', { where: { ...salesFilter, status: 'completed' } }),
    (async () => {
      const movements = await StockMovement.findAll({
        where: { movement_type: 'purchase' },
        include: [{ model: Product, as: 'product', attributes: ['purchase_price'] }],
        raw: true,
      });
      return movements.reduce((sum, m) => sum + (m['product.purchase_price'] || 0) * m.qty_change, 0);
    })(),
    Invoice.sum('total', { where: { status: ['sent', 'overdue'] } }),
    Expense.sum('amount', { where: { status: 'approved', created_at: { [Op.gte]: month } } }),
    LowStockAlert.count({ where: { acknowledged: false } }),
    Sale.sum('net_amount_tzs', { where: { ...salesFilter, status: 'completed', sale_date: { [Op.gte]: year } } }),
  ]);

  const net = (todayCollections || 0) + (totalSales || 0) - (totalExpenses || 0);

  // Last 30 days charts
  let chartCollFilter = '';
  let chartSalesFilter = '';
  const replacements = {};
  if (scope.business_id) {
    const shopIds = await getShopsInBusiness(scope.business_id);
    if (shopIds?.length) {
      const placeholders = shopIds.map((_, i) => `:shop_id_${i}`).join(',');
      chartCollFilter = `AND shop_id IN (${placeholders})`;
      chartSalesFilter = `AND shop_id IN (${placeholders})`;
      shopIds.forEach((id, i) => { replacements[`shop_id_${i}`] = id; });
    } else {
      chartCollFilter = 'AND 1=0';
      chartSalesFilter = 'AND 1=0';
    }
  }
  if (scope.shop_id) {
    chartCollFilter = 'AND shop_id = :shop_id';
    chartSalesFilter = 'AND shop_id = :shop_id';
    replacements.shop_id = scope.shop_id;
  }

  const last30DaysCollections = await sequelize.query(`
    SELECT DATE(collected_at) as date, SUM(gross_tzs) as total
    FROM collections
    WHERE collected_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ${chartCollFilter}
    GROUP BY DATE(collected_at)
    ORDER BY date ASC
  `, { 
    type: sequelize.QueryTypes.SELECT,
    replacements,
  });

  const last30DaysSales = await sequelize.query(`
    SELECT DATE(sale_date) as date, SUM(net_amount_tzs) as total
    FROM sales
    WHERE status = 'completed' AND sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ${chartSalesFilter}
    GROUP BY DATE(sale_date)
    ORDER BY date ASC
  `, {
    type: sequelize.QueryTypes.SELECT,
    replacements,
  });

  // Top machines this week
  const topMachines = await Collection.findAll({
    attributes: ['machine_id', [sequelize.fn('SUM', sequelize.col('gross_tzs')), 'total_tzs']],
    where: { ...collFilter, collected_at: { [Op.gte]: week } },
    group: ['machine_id'],
    order: [[sequelize.fn('SUM', sequelize.col('gross_tzs')), 'DESC']],
    limit: 5,
    include: [{ model: Machine, as: 'machine', attributes: ['slot_code', 'manufacturer'] }],
  });

  return {
    kpis: {
      totalMachines, activeShops, openTickets, pendingExpenses,
      todayCollections: todayCollections || 0, weekCollections: weekCollections || 0,
      todayLogins: todayLogins || 0,
    },
    salesKpis: {
      totalSales: totalSales || 0,
      totalPurchase: totalPurchaseValue || 0,
      net: net || 0,
      invoiceDue: invoiceDue || 0,
      totalExpenses: totalExpenses || 0,
      fySales: fySales || 0,
      stockAlertCount: stockAlertCount || 0,
    },
    tokenKpis: {
      officeStock: officeTokenStock || 0,
      pendingDebtCount: pendingTokenDebts || 0,
      outstandingDebtAmount: outstandingTokenDebtAmount || 0,
    },
    charts: {
      collections: last30DaysCollections,
      sales: last30DaysSales,
    },
    topMachines,
  };
};

exports.collectorDashboard = async (userId) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const week = weekStart();

  const [assignments, myWeekCollections, openTickets] = await Promise.all([
    CollectorAssignment.findAll({
      where: { collector_id: userId, assigned_date: todayStr },
      include: [
        { model: Machine, as: 'machine', attributes: ['slot_code', 'manufacturer'] },
        { model: Shop, as: 'shop', attributes: ['name'] },
      ],
    }),
    Collection.findAll({
      where: { collector_id: userId, collected_at: { [Op.gte]: week } },
      attributes: ['id', 'gross_tzs', 'collected_at', 'machine_id'],
    }),
    Ticket.count({ where: { requester_id: userId, status: ['open', 'in_progress'] } }),
  ]);

  return { assignments, myWeekCollections, openTickets };
};

exports.financeDashboard = async () => {
  const month = monthStart();

  const [pendingExpenses, dueSoonInvoices, monthIncome, monthExpenses] = await Promise.all([
    Expense.findAll({
      where: { status: 'pending' },
      include: [{ model: User, as: 'submitter', attributes: ['name'] }],
      limit: 10,
    }),
    Invoice.findAll({
      where: {
        status: ['sent', 'overdue'],
        due_date: { [Op.lte]: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      },
      limit: 10,
    }),
    Collection.sum('gross_tzs', { where: { collected_at: { [Op.gte]: month } } }),
    Expense.sum('amount', { where: { status: 'approved', created_at: { [Op.gte]: month } } }),
  ]);

  return {
    pendingExpenses,
    dueSoonInvoices,
    monthIncome: monthIncome || 0,
    monthExpenses: monthExpenses || 0,
  };
};

exports.directorDashboard = async () => {
  const month = monthStart();

  const [monthRevenue, monthExpenses] = await Promise.all([
    Collection.sum('gross_tzs', { where: { collected_at: { [Op.gte]: month } } }),
    Expense.sum('amount', { where: { status: 'approved', created_at: { [Op.gte]: month } } }),
  ]);

  const last6Months = await sequelize.query(`
    SELECT DATE_FORMAT(collected_at, '%Y-%m') as month, SUM(gross_tzs) as revenue
    FROM collections GROUP BY month ORDER BY month DESC LIMIT 6
  `, { type: sequelize.QueryTypes.SELECT });

  return {
    monthRevenue: monthRevenue || 0,
    monthExpenses: monthExpenses || 0,
    netProfit: (monthRevenue || 0) - (monthExpenses || 0),
    trend: last6Months.reverse(),
  };
};

exports.cashierDashboard = async (scope) => {
  const today = todayStart();
  const filter = {};
  if (scope?.shop_id) filter.shop_id = scope.shop_id;

  const [todaySales, todayTransactions, recentSales, shopCount] = await Promise.all([
    Sale.sum('net_amount_tzs', { where: { ...filter, status: 'completed', sale_date: { [Op.gte]: today } } }),
    Sale.count({ where: { ...filter, sale_date: { [Op.gte]: today } } }),
    Sale.findAll({
      where: { ...filter },
      order: [['created_at', 'DESC']],
      limit: 10,
      include: [{ model: Shop, as: 'shop', attributes: ['name'] }],
    }),
    Shop.count({ where: { status: 'active' } }),
  ]);

  return {
    kpis: {
      todaySales: todaySales || 0,
      todayTransactions: todayTransactions || 0,
      shopCount,
    },
    recentSales,
  };
};

exports.salesDashboard = async () => {
  const month = monthStart();

  const [totalPartners, activeShops, newPartnersThisMonth] = await Promise.all([
    Partner.count(),
    Shop.count({ where: { status: 'active' } }),
    Partner.count({ where: { created_at: { [Op.gte]: month } } }),
  ]);

  return {
    kpis: {
      totalPartners,
      activeShops,
      newPartnersThisMonth,
    },
  };
};

exports.technicianDashboard = async (userId) => {
  const [myOpenTickets, resolvedToday, allOpenTickets] = await Promise.all([
    Ticket.findAll({
      where: {
        assigned_to: userId,
        status: ['open', 'in_progress', 'reopened'],
      },
      include: [
        { model: Machine, as: 'machine', attributes: ['slot_code'] },
        { model: Shop, as: 'shop', attributes: ['name'] },
      ],
      limit: 20,
      order: [['created_at', 'DESC']],
    }),
    Ticket.count({
      where: {
        assigned_to: userId,
        status: 'resolved',
        updated_at: { [Op.gte]: todayStart() },
      },
    }),
    Ticket.count({
      where: { status: ['open', 'in_progress', 'reopened'] },
    }),
  ]);

  return {
    kpis: {
      myOpenTickets: myOpenTickets.length,
      resolvedToday: resolvedToday || 0,
      allOpenTickets: allOpenTickets || 0,
    },
    myOpenTickets,
  };
};
