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

// Value of purchase stock movements for a shop within a date range
const sumPurchaseValue = async ({ shop_id, date_from, date_to }) => {
  try {
    const where = {
      movement_type: 'purchase',
      created_at: { [Op.gte]: new Date(date_from), [Op.lte]: new Date(date_to + 'T23:59:59.999Z') },
    };
    if (shop_id) where.shop_id = shop_id;
    const movements = await StockMovement.findAll({
      where,
      include: [{ model: Product, as: 'product', attributes: ['purchase_price'] }],
      raw: true,
    });
    return movements.reduce((sum, m) => sum + (m['product.purchase_price'] || 0) * m.qty_change, 0);
  } catch (e) {
    return 0;
  }
};

exports.adminDashboard = async (reqQuery) => {
  const today = todayStart();
  const year = yearStart();

  // Single global date filter drives every section; defaults to "this month" when absent
  const dateFrom = reqQuery.date_from || isoDate(monthStart());
  const dateTo = reqQuery.date_to || isoDate(new Date());
  const chartGranularity = reqQuery.chart_granularity || 'day';
  const trendGranularity = reqQuery.trend_granularity || 'month';

  const baseScope = { date_from: dateFrom, date_to: dateTo };
  const bentabetScope = { ...baseScope, business_type: 'slot' };
  const meteoraScope = { ...baseScope, business_type: 'meteora' };

  const meteoraCollFilter = await buildScopeFilter(meteoraScope);
  const globalCollFilter = await buildScopeFilter(baseScope);

  const slotShops = await Shop.findAll({
    where: { business_type: 'slot' },
    attributes: ['id', 'name'],
    order: [['name', 'ASC']],
    raw: true,
  });

  const [
    totalEmployees, activeEmployees, todayLogins, totalShops, totalPartners,
    bentabetMachines, bentabetShops,
    meteoraMachines, meteoraShops, meteoraCollections,
    meteoraGross, meteoraOffice, meteoraOwner, meteoraExpenses,
    officeTokenStock, pendingTokenDebts, outstandingTokenDebtAmount,
    stockAlertCount, pendingExpenses, unresolvedTickets,
  ] = await Promise.all([
    Employee.count(),
    Employee.count({ where: { status: 'active' } }),
    User.count({ where: { last_login: { [Op.gte]: today } } }),
    Shop.count(),
    Shop.count({
      distinct: true,
      col: 'partner_id',
      where: { business_type: 'meteora', partner_id: { [Op.ne]: null } },
    }),
    Machine.count({ where: { status: 'active', manufacturer: 'Novomatic' } }),
    Shop.count({ where: { status: 'active', business_type: 'slot' } }),
    Machine.count({ where: { status: 'active', manufacturer: 'Meteora' } }),
    Shop.count({ where: { status: 'active', business_type: 'meteora' } }),
    Collection.sum('gross_tzs', { where: { ...meteoraCollFilter, status: 'approved' } }),
    Collection.sum('office_tzs', { where: { ...meteoraCollFilter, status: 'approved' } }),
    Collection.sum('owner_tzs', { where: { ...meteoraCollFilter, status: 'approved' } }),
    Expense.sum('amount', { where: { ...buildExpenseScopeFilter(meteoraScope), status: 'approved' } }),
    TokenInventory.sum('qty'),
    MachineDebt.count({ where: { status: ['pending', 'partial'], type: 'token' } }),
    MachineDebt.sum('amount', { where: { status: ['pending', 'partial'], type: 'token' } }),
    LowStockAlert.count({ where: { acknowledged: false } }),
    Expense.count({ where: { status: 'pending' } }),
    Ticket.count({ where: { status: ['open', 'in_progress', 'reopened'] } }),
  ]);

  // Per-slot-shop revenue & expenses (Overview tab aggregates these; one tab per shop)
  const bentabetShopRows = await Promise.all((slotShops || []).map(async (s) => {
    const collWhere = { shop_id: s.id, status: 'approved', collected_at: { [Op.gte]: new Date(dateFrom), [Op.lte]: new Date(dateTo + 'T23:59:59.999Z') } };
    const expWhere = { shop_id: s.id, business_type: 'bentabet', status: 'approved', expense_date: { [Op.gte]: new Date(dateFrom), [Op.lte]: new Date(dateTo + 'T23:59:59.999Z') } };
    const saleWhere = { shop_id: s.id, status: 'completed', sale_date: { [Op.gte]: new Date(dateFrom), [Op.lte]: new Date(dateTo + 'T23:59:59.999Z') } };
    const [gross, owner, totalExpenses, totalSales, totalPurchase, invoiceDue, fySales] = await Promise.all([
      Collection.sum('gross_tzs', { where: collWhere }),
      Collection.sum('owner_tzs', { where: collWhere }),
      Expense.sum('amount', { where: expWhere }),
      Sale.sum('net_amount_tzs', { where: saleWhere }),
      sumPurchaseValue({ shop_id: s.id, date_from: dateFrom, date_to: dateTo }),
      Invoice.sum('total', { where: { status: ['sent', 'overdue'], shop_id: s.id } }),
      Sale.sum('net_amount_tzs', { where: { status: 'completed', sale_date: { [Op.gte]: year }, shop_id: s.id } }),
    ]);
    return {
      shop_id: s.id,
      shop_name: s.name,
      gross: gross || 0,
      owner: owner || 0,
      totalExpenses: totalExpenses || 0,
      totalSales: totalSales || 0,
      totalPurchase: totalPurchase || 0,
      invoiceDue: invoiceDue || 0,
      fySales: fySales || 0,
      net: (gross || 0) - (totalExpenses || 0),
    };
  }));

  const bentabetTotals = (bentabetShopRows || []).reduce((acc, r) => {
    acc.gross += r.gross;
    acc.owner += r.owner;
    acc.totalExpenses += r.totalExpenses;
    acc.totalSales += r.totalSales;
    acc.totalPurchase += r.totalPurchase;
    acc.invoiceDue += r.invoiceDue;
    acc.fySales += r.fySales;
    return acc;
  }, { gross: 0, owner: 0, totalExpenses: 0, totalSales: 0, totalPurchase: 0, invoiceDue: 0, fySales: 0 });

  const bentabetNet = bentabetTotals.gross - bentabetTotals.totalExpenses;
  const meteoraNet = (meteoraGross || 0) - (meteoraExpenses || 0);

  const [trends, revenueTrend, partnerEarnings, topMachines] = await Promise.all([
    Promise.all([
      getTrendData({ scope: bentabetScope, granularity: chartGranularity, date_from: dateFrom, date_to: dateTo, table: 'collections', dateCol: 'collected_at', amountCol: 'gross_tzs', statusExpr: "status = 'approved'" }),
      getTrendData({ scope: bentabetScope, granularity: chartGranularity, date_from: dateFrom, date_to: dateTo, table: 'sales', dateCol: 'sale_date', amountCol: 'net_amount_tzs', statusExpr: "status = 'completed'" }),
      getTrendData({ scope: meteoraScope, granularity: chartGranularity, date_from: dateFrom, date_to: dateTo, table: 'collections', dateCol: 'collected_at', amountCol: 'gross_tzs', statusExpr: "status = 'approved'" }),
    ]),
    Promise.all([
      getTrendData({ scope: bentabetScope, granularity: trendGranularity, date_from: dateFrom, date_to: dateTo, table: 'collections', dateCol: 'collected_at', amountCol: 'gross_tzs', statusExpr: "status = 'approved'" }),
      getTrendData({ scope: meteoraScope, granularity: trendGranularity, date_from: dateFrom, date_to: dateTo, table: 'collections', dateCol: 'collected_at', amountCol: 'gross_tzs', statusExpr: "status = 'approved'" }),
    ]),
    getPartnerEarnings({ date_from: dateFrom, date_to: dateTo }),
    (async () => {
      const topMachinesWhere = { status: 'approved', ...globalCollFilter };
      return Collection.findAll({
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
    })(),
  ]);

  return {
    overview: {
      totalEmployees: totalEmployees || 0,
      activeEmployees: activeEmployees || 0,
      todayLogins: todayLogins || 0,
      totalPartners: totalPartners || 0,
      totalShops: totalShops || 0,
    },
    operations: {
      bentabet: {
        totalMachines: bentabetMachines || 0,
        activeShops: bentabetShops || 0,
        collections: bentabetTotals.gross || 0,
      },
      meteora: {
        totalMachines: meteoraMachines || 0,
        activeShops: meteoraShops || 0,
        collections: meteoraCollections || 0,
      },
    },
    revenueExpenses: {
      bentabet: {
        gross: bentabetTotals.gross || 0,
        owner: bentabetTotals.owner || 0,
        totalExpenses: bentabetTotals.totalExpenses || 0,
        net: bentabetNet || 0,
        totalSales: bentabetTotals.totalSales || 0,
        totalPurchase: bentabetTotals.totalPurchase || 0,
        invoiceDue: bentabetTotals.invoiceDue || 0,
        fySales: bentabetTotals.fySales || 0,
        shops: bentabetShopRows || [],
      },
      meteora: {
        gross: meteoraGross || 0,
        office: meteoraOffice || 0,
        owner: meteoraOwner || 0,
        totalExpenses: meteoraExpenses || 0,
        net: meteoraNet || 0,
      },
    },
    tokenKpis: {
      officeStock: officeTokenStock || 0,
      pendingDebtCount: pendingTokenDebts || 0,
      outstandingDebtAmount: outstandingTokenDebtAmount || 0,
    },
    alerts: {
      stockAlertCount: stockAlertCount || 0,
      pendingExpenses: pendingExpenses || 0,
      unresolvedTickets: unresolvedTickets || 0,
    },
    partnerEarnings,
    trends: {
      bentabet: {
        collections: trends[0],
        sales: trends[1],
      },
      meteora: {
        collections: trends[2],
      },
    },
    revenueTrend: {
      bentabet: revenueTrend[0],
      meteora: revenueTrend[1],
    },
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
