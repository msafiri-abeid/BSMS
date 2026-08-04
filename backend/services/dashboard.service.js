const { sequelize, Collection, Machine, Shop, Ticket, Expense, WeeklyTarget, CollectorAssignment, Invoice, TokenInventory, MachineDebt, User, Sale, StockMovement, LowStockAlert, Product, StockLevel, Partner, Employee, Department, Position } = require('../models');
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

const isoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const daysAgoISO = (n) => isoDate(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
const monthsAgoISO = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return isoDate(d);
};

const getShopsByBusinessType = async (businessType) => {
  if (!businessType) return null;
  const shops = await Shop.findAll({ where: { business_type: businessType }, attributes: ['id'], raw: true });
  return shops.map(s => s.id);
};

const buildScopeFilter = async (scope) => {
  if (!scope) return {};
  const where = {};
  if (scope.business_type) {
    const shopIds = await getShopsByBusinessType(scope.business_type);
    if (shopIds?.length) where.shop_id = { [Op.in]: shopIds };
    else where.shop_id = -1;
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
  if (scope.business_type) {
    const shopIds = await getShopsByBusinessType(scope.business_type);
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

const buildTicketScopeFilter = (scope) => {
  const where = {};
  if (scope?.shop_id) where.shop_id = scope.shop_id;
  if (scope?.date_from || scope?.date_to) {
    where.created_at = {};
    if (scope?.date_from) where.created_at[Op.gte] = new Date(scope.date_from);
    if (scope?.date_to) where.created_at[Op.lte] = new Date(scope.date_to + 'T23:59:59.999Z');
  }
  return where;
};

const buildExpenseScopeFilter = (scope) => {
  const where = {};
  if (scope?.shop_id) where.shop_id = scope.shop_id;
  if (scope?.business_type === 'slot') {
    where.business_type = 'bentabet';
  } else if (scope?.business_type === 'meteora') {
    where.business_type = 'meteora';
  }
  if (scope?.date_from || scope?.date_to) {
    where.expense_date = {};
    if (scope?.date_from) where.expense_date[Op.gte] = new Date(scope.date_from);
    if (scope?.date_to) where.expense_date[Op.lte] = new Date(scope.date_to + 'T23:59:59.999Z');
  }
  return where;
};

const buildMachineScopeFilter = (scope) => {
  const where = {};
  if (scope?.shop_id) where.current_shop_id = scope.shop_id;
  return where;
};

const parseSectionScope = (query, prefix, legacy = false) => {
  const val = (k) => (query[k] !== undefined && query[k] !== null && query[k] !== '') ? query[k] : null;
  return {
    business_type: val(`${prefix}_business_type`) || (legacy ? val('business_type') : null),
    shop_id: val(`${prefix}_shop_id`) || (legacy ? val('shop_id') : null),
    date_from: val(`${prefix}_date_from`) || (legacy ? val('date_from') : null),
    date_to: val(`${prefix}_date_to`) || (legacy ? val('date_to') : null),
  };
};

// Builds "AND shop_id IN (...) / = :shop_id" SQL fragment + replacements for raw chart queries
const buildShopFilterSQL = async (scope) => {
  let sql = '';
  const replacements = {};
  if (scope.business_type) {
    const shopIds = await getShopsByBusinessType(scope.business_type);
    if (shopIds?.length) {
      const placeholders = shopIds.map((_, i) => `:shop_id_${i}`).join(',');
      sql = ` AND shop_id IN (${placeholders})`;
      shopIds.forEach((id, i) => { replacements[`shop_id_${i}`] = id; });
    } else {
      sql = ' AND 1=0';
    }
  }
  if (scope.shop_id) {
    sql = ' AND shop_id = :shop_id';
    replacements.shop_id = scope.shop_id;
  }
  return { sql, replacements };
};

const granularitySelect = (granularity, column) => {
  if (granularity === 'week') return `DATE_FORMAT(${column}, '%x-W%v')`;
  if (granularity === 'month') return `DATE_FORMAT(${column}, '%Y-%m')`;
  return `DATE(${column})`;
};

// Generic trend query: table = 'collections' | 'sales', dateCol = date/datetime column, statusExpr = raw WHERE fragment
const getTrendData = async ({ scope, granularity = 'day', date_from, date_to, table, dateCol, amountCol = 'gross_tzs', statusExpr }) => {
  const { sql: shopSql, replacements } = await buildShopFilterSQL(scope);
  const periodCol = granularitySelect(granularity, dateCol);
  const rows = await sequelize.query(`
    SELECT ${periodCol} AS period, COALESCE(SUM(${amountCol}), 0) AS total
    FROM ${table}
    WHERE ${statusExpr} AND ${dateCol} >= :date_from AND ${dateCol} <= :date_to ${shopSql}
    GROUP BY period
    ORDER BY period ASC
  `, {
    type: sequelize.QueryTypes.SELECT,
    replacements: { ...replacements, date_from: `${date_from} 00:00:00`, date_to: `${date_to} 23:59:59` },
  });
  return rows;
};

// Per-partner earnings over a period (external partners only — Bentabet shops have no partner_id)
const getPartnerEarnings = async ({ date_from, date_to }) => {
  const rows = await sequelize.query(`
    SELECT p.id AS partner_id, p.label AS partner_label, p.name AS partner_name,
      COUNT(DISTINCT c.shop_id) AS shop_count,
      COUNT(c.id) AS collection_count,
      COALESCE(SUM(c.gross_tzs), 0) AS gross_tzs,
      COALESCE(SUM(c.office_tzs), 0) AS office_tzs,
      COALESCE(SUM(c.owner_tzs), 0) AS owner_tzs
    FROM collections c
    INNER JOIN shops s ON s.id = c.shop_id AND s.partner_id IS NOT NULL
    INNER JOIN partners p ON p.id = s.partner_id
    WHERE c.status = 'approved'
      AND c.collected_at >= :date_from AND c.collected_at <= :date_to
    GROUP BY p.id, p.label, p.name
    ORDER BY gross_tzs DESC
    LIMIT 15
  `, {
    type: sequelize.QueryTypes.SELECT,
    replacements: { date_from: `${date_from} 00:00:00`, date_to: `${date_to} 23:59:59` },
  });
  return rows;
};

exports.adminDashboard = async (reqQuery) => {
  const today = todayStart();
  const week = weekStart();
  const month = monthStart();
  const year = yearStart();

  // Per-section scopes (legacy flat params keep working as the Operations scope fallback)
  const opsScope = parseSectionScope(reqQuery, 'ops', true);
  const revScope = parseSectionScope(reqQuery, 'rev', true);
  const tokenShopId = reqQuery.token_shop_id || null;
  const chartScope = {
    business_type: reqQuery.chart_business_type || null,
    shop_id: reqQuery.chart_shop_id || null,
    date_from: reqQuery.chart_from || null,
    date_to: reqQuery.chart_to || null,
  };
  const trendScope = {
    business_type: reqQuery.trend_business_type || null,
    shop_id: reqQuery.trend_shop_id || null,
    date_from: reqQuery.trend_from || null,
    date_to: reqQuery.trend_to || null,
  };
  const chartGranularity = reqQuery.chart_granularity || 'day';
  const trendGranularity = reqQuery.trend_granularity || 'month';
  const partnerFrom = reqQuery.partner_from || daysAgoISO(30);
  const partnerTo = reqQuery.partner_to || isoDate(new Date());

  const collFilter = await buildScopeFilter(opsScope);
  const salesFilter = await saleScopeFilter(revScope);

  // Operations KPIs — today/week defaults when no ops date range selected
  const collWhere = { ...collFilter, status: 'approved' };
  if (!collWhere.collected_at) collWhere.collected_at = { [Op.gte]: today };

  const weekCollWhere = { ...collFilter, status: 'approved' };
  if (!weekCollWhere.collected_at) weekCollWhere.collected_at = { [Op.gte]: week };

  const loginWhere = {};
  if (opsScope.date_from || opsScope.date_to) {
    loginWhere.last_login = {};
    if (opsScope.date_from) loginWhere.last_login[Op.gte] = new Date(opsScope.date_from);
    if (opsScope.date_to) loginWhere.last_login[Op.lte] = new Date(opsScope.date_to + 'T23:59:59.999Z');
  } else {
    loginWhere.last_login = { [Op.gte]: today };
  }

  // Operations machine / shop counts scoped to business/shop
  const machineWhere = { status: 'active' };
  const shopCountWhere = { status: 'active' };
  if (opsScope.business_type) {
    shopCountWhere.business_type = opsScope.business_type;
    const btShopIds = await getShopsByBusinessType(opsScope.business_type);
    if (btShopIds?.length) {
      machineWhere.current_shop_id = { [Op.in]: btShopIds };
    } else {
      machineWhere.id = -1;
      shopCountWhere.id = -1;
    }
  }
  if (opsScope.shop_id) {
    machineWhere.current_shop_id = opsScope.shop_id;
    shopCountWhere.id = opsScope.shop_id;
  }

  // Revenue & Expenses — month default when no rev date range selected
  const monthExpenseWhere = { status: 'approved' };
  if (revScope.date_from || revScope.date_to) {
    monthExpenseWhere.created_at = {};
    if (revScope.date_from) monthExpenseWhere.created_at[Op.gte] = new Date(revScope.date_from);
    if (revScope.date_to) monthExpenseWhere.created_at[Op.lte] = new Date(revScope.date_to + 'T23:59:59.999Z');
  } else {
    monthExpenseWhere.created_at = { [Op.gte]: month };
  }

  const fySalesWhere = { ...salesFilter, status: 'completed' };
  if (!fySalesWhere.sale_date) fySalesWhere.sale_date = { [Op.gte]: year };

  const periodRevenueWhere = await buildScopeFilter(revScope);
  periodRevenueWhere.status = 'approved';
  if (!periodRevenueWhere.collected_at) periodRevenueWhere.collected_at = { [Op.gte]: month };

  // Token Management — Meteora only, debts optionally scoped to a shop
  const tokenDebtWhere = { status: ['pending', 'partial'], type: 'token' };
  if (tokenShopId) tokenDebtWhere.shop_id = tokenShopId;

  // Alerts & Risks — global, no business scope
  const ticketCountWhere = { status: ['open', 'in_progress', 'reopened'] };

  const [
    totalMachines, activeShops, openTickets, pendingExpenses,
    todayCollections, weekCollections,
    officeTokenStock, pendingTokenDebts, outstandingTokenDebtAmount, todayLogins,
    totalSales, totalPurchaseValue, invoiceDue, totalExpenses,
    stockAlertCount, fySales,
    periodGross, periodOffice, periodOwner,
    totalEmployees, activeEmployees, totalPartners, totalShops,
  ] = await Promise.all([
    Machine.count({ where: machineWhere }),
    Shop.count({ where: shopCountWhere }),
    Ticket.count({ where: ticketCountWhere }),
    Expense.count({ where: { status: 'pending' } }),
    Collection.sum('gross_tzs', { where: collWhere }),
    Collection.sum('gross_tzs', { where: weekCollWhere }),
    TokenInventory.sum('qty'),
    MachineDebt.count({ where: tokenDebtWhere }),
    MachineDebt.sum('amount', { where: tokenDebtWhere }),
    User.count({ where: loginWhere }),
    Sale.sum('net_amount_tzs', { where: { ...salesFilter, status: 'completed' } }),
    (async () => {
      try {
        const movements = await StockMovement.findAll({
          where: { movement_type: 'purchase' },
          include: [{ model: Product, as: 'product', attributes: ['purchase_price'] }],
          raw: true,
        });
        return movements.reduce((sum, m) => sum + (m['product.purchase_price'] || 0) * m.qty_change, 0);
      } catch (e) {
        return 0;
      }
    })(),
    Invoice.sum('total', { where: { status: ['sent', 'overdue'] } }),
    Expense.sum('amount', { where: monthExpenseWhere }),
    LowStockAlert.count({ where: { acknowledged: false } }),
    Sale.sum('net_amount_tzs', { where: fySalesWhere }),
    Collection.sum('gross_tzs', { where: periodRevenueWhere }),
    Collection.sum('office_tzs', { where: periodRevenueWhere }),
    Collection.sum('owner_tzs', { where: periodRevenueWhere }),
    Employee.count(),
    Employee.count({ where: { status: 'active' } }),
    Partner.count(),
    Shop.count(),
  ]);

  const netRevenue = (periodGross || 0) - (totalExpenses || 0);

  // Dynamic trends — charts (last 30d default) + revenue trend (last 6 months default)
  const chartFrom = chartScope.date_from || daysAgoISO(30);
  const chartTo = chartScope.date_to || isoDate(new Date());
  const trendFrom = trendScope.date_from || monthsAgoISO(6);
  const trendTo = trendScope.date_to || isoDate(new Date());

  const [lastCollections, lastSales, revenueTrend, partnerEarnings, unresolvedTickets] = await Promise.all([
    getTrendData({ scope: chartScope, granularity: chartGranularity, date_from: chartFrom, date_to: chartTo, table: 'collections', dateCol: 'collected_at', amountCol: 'gross_tzs', statusExpr: "status = 'approved'" }),
    getTrendData({ scope: chartScope, granularity: chartGranularity, date_from: chartFrom, date_to: chartTo, table: 'sales', dateCol: 'sale_date', amountCol: 'net_amount_tzs', statusExpr: "status = 'completed'" }),
    getTrendData({ scope: trendScope, granularity: trendGranularity, date_from: trendFrom, date_to: trendTo, table: 'collections', dateCol: 'collected_at', amountCol: 'gross_tzs', statusExpr: "status = 'approved'" }),
    getPartnerEarnings({ date_from: partnerFrom, date_to: partnerTo }),
    Ticket.findAll({
      where: ticketCountWhere,
      order: [[sequelize.literal("FIELD(priority, 'urgent', 'high', 'medium', 'low')"), 'ASC'], ['created_at', 'DESC']],
      limit: 8,
      attributes: ['id', 'ticket_number', 'ticket_type', 'priority', 'status', 'created_at', 'slot_code'],
      include: [
        { model: Machine, as: 'machine', attributes: ['slot_code'] },
        { model: Shop, as: 'shop', attributes: ['name'] },
      ],
    }),
  ]);

  // Top machines — respect ops date range when set, otherwise "this week"
  const topMachinesWhere = { status: 'approved', ...collFilter };
  if (!topMachinesWhere.collected_at) topMachinesWhere.collected_at = { [Op.gte]: week };

  const topMachines = await Collection.findAll({
    attributes: [
      'machine_id',
      'shop_id',
      [sequelize.fn('SUM', sequelize.col('gross_tzs')), 'total_tzs'],
      [sequelize.fn('SUM', sequelize.col('office_tzs')), 'office_tzs'],
      [sequelize.fn('SUM', sequelize.col('owner_tzs')), 'owner_tzs'],
    ],
    where: topMachinesWhere,
    group: ['machine_id', 'shop_id'],
    order: [[sequelize.fn('SUM', sequelize.col('gross_tzs')), 'DESC']],
    limit: 5,
    include: [
      { model: Machine, as: 'machine', attributes: ['slot_code', 'manufacturer'] },
      { model: Shop, as: 'shop', attributes: ['name'] },
    ],
  });

  return {
    kpis: {
      totalMachines, activeShops, openTickets, pendingExpenses,
      todayCollections: todayCollections || 0, weekCollections: weekCollections || 0,
      todayLogins: todayLogins || 0,
    },
    financialKpis: {
      periodGross: periodGross || 0,
      periodOffice: periodOffice || 0,
      periodOwner: periodOwner || 0,
      totalExpenses: totalExpenses || 0,
      netRevenue: netRevenue || 0,
    },
    salesKpis: {
      totalSales: totalSales || 0,
      totalPurchase: totalPurchaseValue || 0,
      invoiceDue: invoiceDue || 0,
      fySales: fySales || 0,
      stockAlertCount: stockAlertCount || 0,
    },
    tokenKpis: {
      officeStock: officeTokenStock || 0,
      pendingDebtCount: pendingTokenDebts || 0,
      outstandingDebtAmount: outstandingTokenDebtAmount || 0,
    },
    overview: {
      totalEmployees: totalEmployees || 0,
      activeEmployees: activeEmployees || 0,
      totalPartners: totalPartners || 0,
      totalShops: totalShops || 0,
    },
    partnerEarnings,
    unresolvedTickets,
    charts: {
      collections: lastCollections,
      sales: lastSales,
    },
    trend: revenueTrend,
    topMachines,
  };
};

exports.collectorDashboard = async (userId, scope = {}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const week = weekStart();

  const assignWhere = { collector_id: userId, assigned_date: todayStr };
  if (scope.shop_id) assignWhere.shop_id = scope.shop_id;

  const collWhere = { collector_id: userId, status: 'approved', collected_at: { [Op.gte]: week } };
  if (scope.shop_id) collWhere.shop_id = scope.shop_id;
  if (scope.date_from) collWhere.collected_at[Op.gte] = new Date(scope.date_from);
  if (scope.date_to) collWhere.collected_at[Op.lte] = new Date(scope.date_to + 'T23:59:59.999Z');

  const ticketWhere = { requester_id: userId, status: ['open', 'in_progress'] };

  const [assignments, myWeekCollections, openTickets] = await Promise.all([
    CollectorAssignment.findAll({
      where: assignWhere,
      include: [
        { model: Machine, as: 'machine', attributes: ['slot_code', 'manufacturer'] },
        { model: Shop, as: 'shop', attributes: ['name'] },
      ],
    }),
    Collection.findAll({
      where: collWhere,
      attributes: ['id', 'gross_tzs', 'collected_at', 'machine_id'],
    }),
    Ticket.count({ where: ticketWhere }),
  ]);

  const doneCount = assignments.filter(a => a.status === 'done').length;
  const collectionEfficiency = assignments.length > 0 ? Math.round((doneCount / assignments.length) * 100) : 0;

  return { assignments, myWeekCollections, openTickets, collectionEfficiency };
};

exports.financeDashboard = async (scope = {}) => {
  const month = monthStart();

  const hasDateFilter = !!(scope.date_from || scope.date_to);
  const effectiveDateFrom = scope.date_from || month.toISOString().split('T')[0];
  const effectiveDateTo = scope.date_to;
  const collFilter = await buildScopeFilter({ ...scope, date_from: effectiveDateFrom, date_to: effectiveDateTo });

  const expenseWhere = buildExpenseScopeFilter(scope);
  const monthExpenseWhere = { ...expenseWhere, status: 'approved' };
  if (scope.date_from || scope.date_to) {
    monthExpenseWhere.created_at = {};
    if (scope.date_from) monthExpenseWhere.created_at[Op.gte] = new Date(scope.date_from);
    if (scope.date_to) monthExpenseWhere.created_at[Op.lte] = new Date(scope.date_to + 'T23:59:59.999Z');
  } else {
    monthExpenseWhere.created_at = { [Op.gte]: month };
  }

  const invoiceWhere = {
    status: ['sent', 'overdue'],
    due_date: { [Op.lte]: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  };

  const [pendingExpenses, dueSoonInvoices, monthIncome, monthExpenses, stockAlertCount, invoiceDueAmount, pendingExpensesTotal, activeMachines, activeShops, collectionCount, outstandingDebt] = await Promise.all([
    Expense.findAll({
      where: { ...expenseWhere, status: 'pending' },
      include: [{ model: User, as: 'submitter', attributes: ['name'] }],
      limit: 10,
    }),
    Invoice.findAll({ where: invoiceWhere, limit: 10 }),
    Collection.sum('gross_tzs', { where: { ...collFilter, status: 'approved' } }),
    Expense.sum('amount', { where: monthExpenseWhere }),
    LowStockAlert.count({ where: { acknowledged: false } }),
    Invoice.sum('total', { where: invoiceWhere }),
    Expense.sum('amount', { where: { ...expenseWhere, status: 'pending' } }),
    Machine.count({ where: { status: 'active' } }),
    Shop.count({ where: { status: 'active' } }),
    Collection.count({ where: { ...collFilter, status: 'approved' } }),
    MachineDebt.findOne({
      attributes: [[sequelize.fn('SUM', sequelize.literal('`amount` - `paid_amount`')), 'outstanding']],
      where: { status: ['pending', 'partial'] },
      plain: true,
    }).then(r => Number(r?.get('outstanding') || 0)),
  ]);

  return {
    pendingExpenses,
    dueSoonInvoices,
    monthIncome: monthIncome || 0,
    monthExpenses: monthExpenses || 0,
    stockAlertCount: stockAlertCount || 0,
    invoiceDueAmount: invoiceDueAmount || 0,
    pendingExpensesTotal: pendingExpensesTotal || 0,
    activeMachines: activeMachines || 0,
    activeShops: activeShops || 0,
    collectionCount: collectionCount || 0,
    outstandingDebt: outstandingDebt || 0,
  };
};

exports.directorDashboard = async (scope = {}) => {
  const month = monthStart();

  const hasDateFilter = !!(scope.date_from || scope.date_to);
  const effectiveDateFrom = scope.date_from || month.toISOString().split('T')[0];
  const effectiveDateTo = scope.date_to;
  const collFilter = await buildScopeFilter({ ...scope, date_from: effectiveDateFrom, date_to: effectiveDateTo });

  const expenseWhere = buildExpenseScopeFilter(scope);
  const monthExpenseWhere = { ...expenseWhere, status: 'approved' };
  if (scope.date_from || scope.date_to) {
    monthExpenseWhere.created_at = {};
    if (scope.date_from) monthExpenseWhere.created_at[Op.gte] = new Date(scope.date_from);
    if (scope.date_to) monthExpenseWhere.created_at[Op.lte] = new Date(scope.date_to + 'T23:59:59.999Z');
  } else {
    monthExpenseWhere.created_at = { [Op.gte]: month };
  }
  const machineWhere = buildMachineScopeFilter(scope);

  const shopWhere = { status: 'active' };
  if (scope.shop_id) shopWhere.id = scope.shop_id;
  if (scope.business_type) shopWhere.business_type = scope.business_type;

  const [monthRevenue, monthExpenses, activeShops, activeMachines, openTickets] = await Promise.all([
    Collection.sum('gross_tzs', { where: { ...collFilter, status: 'approved' } }),
    Expense.sum('amount', { where: monthExpenseWhere }),
    Shop.count({ where: shopWhere }),
    Machine.count({ where: { status: 'active', ...machineWhere } }),
    Ticket.count({ where: { status: ['open', 'in_progress', 'reopened'] } }),
  ]);

  let trendFilter = '';
  const trendReplacements = {};
  if (scope.business_type) {
    const shopIds = await getShopsByBusinessType(scope.business_type);
    if (shopIds?.length) {
      const placeholders = shopIds.map((_, i) => `:shop_id_${i}`).join(',');
      trendFilter = `AND shop_id IN (${placeholders})`;
      shopIds.forEach((id, i) => { trendReplacements[`shop_id_${i}`] = id; });
    } else {
      trendFilter = 'AND 1=0';
    }
  }
  if (scope.shop_id) {
    trendFilter = 'AND shop_id = :shop_id';
    trendReplacements.shop_id = scope.shop_id;
  }

  const last6Months = await sequelize.query(`
    SELECT DATE_FORMAT(collected_at, '%Y-%m') as month, SUM(gross_tzs) as revenue
    FROM collections WHERE status = 'approved' ${trendFilter} GROUP BY month ORDER BY month DESC LIMIT 6
  `, { type: sequelize.QueryTypes.SELECT, replacements: trendReplacements });

  return {
    monthRevenue: monthRevenue || 0,
    monthExpenses: monthExpenses || 0,
    netProfit: (monthRevenue || 0) - (monthExpenses || 0),
    trend: last6Months.reverse(),
    kpis: {
      activeShops: activeShops || 0,
      activeMachines: activeMachines || 0,
      openTickets: openTickets || 0,
      stockAlerts: await LowStockAlert.count({ where: { acknowledged: false } }),
    },
  };
};

exports.cashierDashboard = async (scope = {}) => {
  const today = todayStart();

  const shopFilter = {};
  if (scope.shop_id) shopFilter.id = scope.shop_id;
  const slotShopIds = await Shop.findAll({
    where: { business_type: 'slot', status: 'active', ...shopFilter },
    attributes: ['id'],
    raw: true,
  });
  const shopIds = slotShopIds.map(s => s.id);
  const hasShopScope = shopIds.length > 0;
  const noMatch = shopIds.length === 0 && scope.shop_id;

  if (noMatch) {
    return {
      kpis: {
        activeMachines: 0, activeShops: 0, todayCollections: 0,
        todaySales: 0, todayTransactions: 0, todayPurchases: 0,
        todayExpenses: 0, pendingExpenses: 0, openTickets: 0,
      },
      recentSales: [],
    };
  }

  const collFilter = { status: 'approved', collected_at: { [Op.gte]: today } };
  if (hasShopScope) collFilter.shop_id = { [Op.in]: shopIds };
  if (scope.date_from) collFilter.collected_at[Op.gte] = new Date(scope.date_from);
  if (scope.date_to) collFilter.collected_at[Op.lte] = new Date(scope.date_to + 'T23:59:59.999Z');

  const salesFilter = { status: 'completed', sale_date: { [Op.gte]: today } };
  if (hasShopScope) salesFilter.shop_id = { [Op.in]: shopIds };
  if (scope.date_from) salesFilter.sale_date[Op.gte] = new Date(scope.date_from);
  if (scope.date_to) salesFilter.sale_date[Op.lte] = new Date(scope.date_to + 'T23:59:59.999Z');

  const machineWhere = { status: 'active', manufacturer: 'Novomatic' };
  if (hasShopScope) machineWhere.current_shop_id = { [Op.in]: shopIds };

  const expenseWhere = { status: 'approved', expense_date: { [Op.gte]: today } };
  if (hasShopScope) expenseWhere.shop_id = { [Op.in]: shopIds };
  if (scope.date_from) expenseWhere.expense_date[Op.gte] = new Date(scope.date_from);
  if (scope.date_to) expenseWhere.expense_date[Op.lte] = new Date(scope.date_to + 'T23:59:59.999Z');

  const pendingExpenseWhere = { status: 'pending' };
  if (hasShopScope) pendingExpenseWhere.shop_id = { [Op.in]: shopIds };

  const ticketWhere = { status: ['open', 'in_progress', 'reopened'] };
  if (hasShopScope) ticketWhere.shop_id = { [Op.in]: shopIds };

  const purchaseWhere = { movement_type: 'purchase', created_at: { [Op.gte]: today } };
  if (scope.date_from) purchaseWhere.created_at[Op.gte] = new Date(scope.date_from);
  if (scope.date_to) purchaseWhere.created_at[Op.lte] = new Date(scope.date_to + 'T23:59:59.999Z');

  const [
    activeMachines, activeShops, todayCollections,
    todaySales, todayTransactions, todayPurchasesValue,
    todayExpenses, pendingExpenses, openTickets,
    recentSales,
  ] = await Promise.all([
    Machine.count({ where: machineWhere }),
    Shop.count({ where: { business_type: 'slot', status: 'active', ...shopFilter } }),
    Collection.sum('gross_tzs', { where: collFilter }),
    Sale.sum('net_amount_tzs', { where: salesFilter }),
    Sale.count({ where: salesFilter }),
    (async () => {
      const movements = await StockMovement.findAll({
        where: purchaseWhere,
        include: [{ model: Product, as: 'product', attributes: ['purchase_price'] }],
        raw: true,
      });
      return movements.reduce((sum, m) => sum + (m['product.purchase_price'] || 0) * m.qty_change, 0);
    })(),
    Expense.sum('amount', { where: expenseWhere }),
    Expense.count({ where: pendingExpenseWhere }),
    Ticket.count({ where: ticketWhere }),
    Sale.findAll({
      where: salesFilter,
      order: [['created_at', 'DESC']],
      limit: 10,
      include: [{ model: Shop, as: 'shop', attributes: ['name'] }],
    }),
  ]);

  return {
    kpis: {
      activeMachines: activeMachines || 0,
      activeShops: activeShops || 0,
      todayCollections: todayCollections || 0,
      todaySales: todaySales || 0,
      todayTransactions: todayTransactions || 0,
      todayPurchases: todayPurchasesValue || 0,
      todayExpenses: todayExpenses || 0,
      pendingExpenses: pendingExpenses || 0,
      openTickets: openTickets || 0,
    },
    recentSales,
  };
};

exports.salesDashboard = async (scope = {}) => {
  const month = monthStart();
  const partnerWhere = {};
  if (scope.date_from) partnerWhere.created_at = { [Op.gte]: new Date(scope.date_from) };
  if (scope.date_to) partnerWhere.created_at = { ...partnerWhere.created_at, [Op.lte]: new Date(scope.date_to + 'T23:59:59.999Z') };

  const shopWhere = { status: 'active' };
  if (scope.business_type) shopWhere.business_type = scope.business_type;

  const newPartnerWhere = { ...partnerWhere, created_at: { [Op.gte]: month } };
  if (scope.date_from) newPartnerWhere.created_at[Op.gte] = new Date(scope.date_from);

  const [totalPartners, activeShops, newPartnersThisMonth] = await Promise.all([
    Partner.count(scope.business_type ? {} : {}),
    Shop.count({ where: shopWhere }),
    Partner.count({ where: newPartnerWhere }),
  ]);

  return {
    kpis: {
      totalPartners,
      activeShops,
      newPartnersThisMonth,
    },
  };
};

exports.technicianDashboard = async (userId, scope = {}) => {
  const ticketWhere = {
    assigned_to: userId,
    status: ['open', 'in_progress', 'reopened'],
  };
  if (scope.date_from) ticketWhere.created_at = { [Op.gte]: new Date(scope.date_from) };
  if (scope.date_to) ticketWhere.created_at = { ...(ticketWhere.created_at || {}), [Op.lte]: new Date(scope.date_to + 'T23:59:59.999Z') };

  const resolvedWhere = {
    assigned_to: userId,
    status: 'resolved',
    updated_at: { [Op.gte]: todayStart() },
  };
  if (scope.date_from) resolvedWhere.updated_at[Op.gte] = new Date(scope.date_from);
  if (scope.date_to) resolvedWhere.updated_at[Op.lte] = new Date(scope.date_to + 'T23:59:59.999Z');

  const [myOpenTickets, resolvedToday, allOpenTickets] = await Promise.all([
    Ticket.findAll({
      where: ticketWhere,
      include: [
        { model: Machine, as: 'machine', attributes: ['slot_code'] },
        { model: Shop, as: 'shop', attributes: ['name'] },
      ],
      limit: 20,
      order: [['created_at', 'DESC']],
    }),
    Ticket.count({ where: resolvedWhere }),
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

exports.hrDashboard = async () => {
  const month = monthStart();
  const year = yearStart();

  const [
    totalEmployees, activeEmployees, totalDepartments, totalPositions,
    newHiresThisMonth, openTickets, pendingExpenses,
  ] = await Promise.all([
    Employee.count(),
    Employee.count({ where: { status: 'active' } }),
    Department.count(),
    Position.count(),
    Employee.count({ where: { hire_date: { [Op.gte]: month } } }),
    Ticket.count({ where: { status: ['open', 'in_progress', 'reopened'] } }),
    Expense.count({ where: { status: 'pending' } }),
  ]);

  const recentHires = await Employee.findAll({
    where: { status: 'active' },
    order: [['hire_date', 'DESC']],
    limit: 5,
    attributes: ['id', 'employee_code', 'full_name', 'email', 'phone', 'hire_date', 'status'],
    include: [
      { model: Department, as: 'department', attributes: ['name'] },
      { model: Position, as: 'position', attributes: ['name'] },
    ],
  });

  return {
    kpis: {
      totalEmployees: totalEmployees || 0,
      activeEmployees: activeEmployees || 0,
      totalDepartments: totalDepartments || 0,
      totalPositions: totalPositions || 0,
      newHiresThisMonth: newHiresThisMonth || 0,
      openTickets: openTickets || 0,
      pendingExpenses: pendingExpenses || 0,
    },
    recentHires,
  };
};
