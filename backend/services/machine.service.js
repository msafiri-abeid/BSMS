const { Machine, MachineDeployment, MachineExchange, MachineRefill, Shop, Collection, TokenInventory, MachineDebt, Setting, WeeklyTarget, Expense, NovomaticReading } = require('../models');
const { Op, literal, fn, col } = require('sequelize');
const { DEFAULT_CREDIT_VALUES } = require('../config/constants');

const list = async (query) => {
  const { shop_id, status, manufacturer, search, limit = 50, offset = 0 } = query;
  const where = {};
  if (shop_id) where.current_shop_id = shop_id;
  if (status) where.status = status;
  if (manufacturer) where.manufacturer = manufacturer;
  if (search) where.slot_code = { [Op.like]: `%${search}%` };

  const result = await Machine.findAndCountAll({
    where, limit: +limit, offset: +offset,
    include: [{ model: Shop, as: 'currentShop', attributes: ['name'] }],
    attributes: {
      include: [
        [
          literal(`(
            SELECT COALESCE(SUM(amount - paid_amount), 0)
            FROM machine_debts
            WHERE machine_id = Machine.id
              AND status NOT IN ('paid', 'written_off')
          )`),
          'outstanding_debt_tzs',
        ],
        [
          literal(`(
            SELECT COALESCE(weekly_target_tzs, (SELECT value FROM settings WHERE \`key\` = 'weekly_target_tzs'))
          )`),
          'effective_target_tzs',
        ],
      ],
    },
    order: [['slot_code', 'ASC']],
  });

  const targetsMet = await WeeklyTarget.count({
    where: {
      week_start: { [Op.lte]: literal('CURDATE()') },
      week_end: { [Op.gte]: literal('CURDATE()') },
      [Op.and]: literal('collected_tzs >= target_tzs'),
    },
  });

  return { ...result, targetsMet };
};

const getOne = async (id) => {
  const machine = await Machine.findByPk(id, {
    include: [
      { model: Shop, as: 'currentShop', attributes: ['name'] },
      {
        model: MachineDeployment, as: 'deployments',
        include: [{ model: Shop, as: 'shop', attributes: ['name'] }],
        order: [['deployed_at', 'DESC']],
      },
      {
        model: MachineExchange, as: 'exchanges',
        include: [
          { model: Shop, as: 'fromShop', attributes: ['name'] },
          { model: Shop, as: 'toShop', attributes: ['name'] },
        ],
        order: [['exchanged_at', 'DESC']],
      },
      {
        model: Collection,
        as: 'performance',
        attributes: ['collected_at', 'net_tzs', 'gross_tzs', 'office_tzs', 'owner_tzs', 'difference'],
        order: [['collected_at', 'DESC']],
        limit: 10,
      },
      {
        model: MachineDebt, as: 'debts',
        attributes: ['id', 'type', 'amount', 'paid_amount', 'status', 'created_at'],
        order: [['created_at', 'DESC']],
        limit: 20,
      },
    ],
  });

  if (!machine) return null;

  const formatted = machine.toJSON();
  if (formatted.performance) {
    formatted.performance = formatted.performance.map(p => ({
      date: p.collected_at,
      net: p.net_tzs,
      gross: p.gross_tzs,
      office_share: p.office_tzs,
      owner_share: p.owner_tzs,
      difference: p.difference,
    }));
  }
  const lastCollection = await Collection.findOne({
    where: { machine_id: id },
    order: [['collected_at', 'DESC']],
    include: [{ model: NovomaticReading, as: 'novomaticReading', attributes: ['closing_credits'] }],
  });
  formatted.lastNovomaticReading = lastCollection?.novomaticReading || null;
  return formatted;
};

const getMachineStats = async (id, filters = {}) => {
  const dateWhere = {};
  if (filters.date_from) dateWhere.collected_at = { [Op.gte]: new Date(filters.date_from) };
  if (filters.date_to) dateWhere.collected_at = { ...dateWhere.collected_at, [Op.lte]: new Date(filters.date_to + 'T23:59:59.999Z') };

  const collectionsWhere = { machine_id: id, status: 'approved', ...dateWhere };

  const [aggResult, weeklyTargets, monthlyRevenue, expenseResult, debtResult] = await Promise.all([
    Collection.findAll({
      attributes: [
        [fn('COALESCE', fn('SUM', col('gross_tzs')), 0), 'totalGross'],
        [fn('COALESCE', fn('SUM', col('office_tzs')), 0), 'totalOffice'],
        [fn('COALESCE', fn('SUM', col('owner_tzs')), 0), 'totalOwner'],
        [fn('COUNT', col('id')), 'collectionCount'],
      ],
      where: collectionsWhere,
      raw: true,
    }),
    WeeklyTarget.findAll({
      where: { machine_id: id },
      order: [['week_start', 'DESC']],
      limit: 12,
      raw: true,
    }),
    Collection.findAll({
      attributes: [
        [fn('DATE_FORMAT', col('collected_at'), '%Y-%m'), 'month'],
        [fn('SUM', col('gross_tzs')), 'revenue'],
      ],
      where: { machine_id: id, status: 'approved' },
      group: [fn('DATE_FORMAT', col('collected_at'), '%Y-%m')],
      order: [[fn('DATE_FORMAT', col('collected_at'), '%Y-%m'), 'ASC']],
      raw: true,
    }),
    Expense.findAll({
      attributes: [
        [fn('COALESCE', fn('SUM', col('amount')), 0), 'totalExpenses'],
        [fn('COUNT', col('id')), 'expenseCount'],
      ],
      where: { machine_id: id, status: 'approved' },
      raw: true,
    }),
    MachineDebt.findAll({
      attributes: [
        [fn('COALESCE', fn('SUM', col('amount')), 0), 'totalDebt'],
        [fn('COALESCE', fn('SUM', col('paid_amount')), 0), 'totalPaid'],
        [fn('COUNT', col('id')), 'debtCount'],
      ],
      where: { machine_id: id, status: ['pending', 'partial'] },
      raw: true,
    }),
  ]);

  const stats = aggResult[0] || {};
  const expenses = expenseResult[0] || {};
  const debts = debtResult[0] || {};

  const totalWeeks = weeklyTargets.length;
  const metWeeks = weeklyTargets.filter(w => Number(w.collected_tzs) >= Number(w.target_tzs)).length;
  const attainmentRate = totalWeeks > 0 ? Math.round((metWeeks / totalWeeks) * 100) : 0;

  const outcome = monthRevenue => {
    const current = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const found = monthRevenue.find(r => r.month === key);
      result.push({ month: key, revenue: found ? Number(found.revenue) : 0 });
    }
    return result;
  };

  return {
    kpis: {
      totalGross: Number(stats.totalGross) || 0,
      totalOffice: Number(stats.totalOffice) || 0,
      totalOwner: Number(stats.totalOwner) || 0,
      collectionCount: Number(stats.collectionCount) || 0,
      totalExpenses: Number(expenses.totalExpenses) || 0,
      expenseCount: Number(expenses.expenseCount) || 0,
      netRevenue: (Number(stats.totalGross) || 0) - (Number(expenses.totalExpenses) || 0),
      outstandingDebt: (Number(debts.totalDebt) || 0) - (Number(debts.totalPaid) || 0),
      debtCount: Number(debts.debtCount) || 0,
    },
    targetAttainment: {
      rate: attainmentRate,
      metWeeks,
      totalWeeks,
    },
    weeklyTargets,
    monthlyRevenue: outcome(monthlyRevenue),
  };
};

const create = async (body) => {
  const { manufacturer } = body;
  if (!body.credit_value_tzs) {
    body.credit_value_tzs = DEFAULT_CREDIT_VALUES[manufacturer] || 10;
  }
  // Novomatic machines don't have weekly targets
  if (manufacturer === 'Novomatic') {
    delete body.weekly_target_tzs;
  }
  return Machine.create(body);
};

const update = async (id, body) => {
  const machine = await Machine.findByPk(id);
  if (!machine) return null;
  await machine.update(body);
  return machine;
};

const remove = async (id) => {
  const machine = await Machine.findByPk(id);
  if (!machine) return false;
  await machine.destroy();
  return true;
};

const deploy = async (id, { shop_id, opening_count, initial_load_tzs, machine_load_tzs, tray_tzs, tokens_paid }, userId) => {
  const machine = await Machine.findByPk(id);
  if (!machine) return null;

  const loadTzs = machine_load_tzs || 0;
  const tray = tray_tzs || 0;
  const totalLoad = initial_load_tzs || (loadTzs + tray);

  const deployment = await MachineDeployment.create({
    machine_id: machine.id, shop_id, deployed_by: userId,
    opening_count: opening_count || 0,
    initial_load_tzs: totalLoad,
    machine_load_tzs: loadTzs,
    tray_tzs: tray,
    deployed_at: new Date(),
  });

  const now = new Date();
  await machine.update({
    current_shop_id: shop_id,
    status: 'active',
    opening_count: opening_count || 0,
    previous_count: opening_count || 0,
    cycle_start_date: now.toISOString().split('T')[0],
  });

  if (totalLoad > 0) {
    const lastPurchase = await TokenInventory.findOne({
      where: { movement_type: 'purchase' },
      order: [['created_at', 'DESC']],
    });
    const unitValueTzs = lastPurchase ? lastPurchase.unit_value_tzs : 200;
    const tokenQty = Math.floor(totalLoad / unitValueTzs);
    if (tokenQty > 0) {
      await TokenInventory.create({
        qty: -tokenQty,
        movement_type: 'refill_out',
        unit_value_tzs: unitValueTzs,
        total_value_tzs: tokenQty * unitValueTzs,
        reference_id: deployment.id,
        recipient_type: 'shop',
        recipient_id: shop_id,
        note: `Deploy: ${machine.slot_code} → Shop #${shop_id}`,
        created_by: userId,
      });

      if (tokens_paid === false) {
        const debtType = 'token';
        if (!['token', 'commission', 'advance', 'shortage', 'other'].includes(debtType)) {
          throw new Error(`Invalid debt type: ${debtType}`);
        }
        await MachineDebt.create({
          machine_id: machine.id,
          shop_id,
          type: debtType,
          amount: tokenQty * unitValueTzs,
          reason: `Token debt from deployment of ${machine.slot_code} at Shop #${shop_id}`,
          recorded_by: userId,
          status: 'pending',
        });
      }
    }
  }

  return deployment;
};

const exchange = async (id, { to_shop_id, reason, reset_cycle }, userId) => {
  const machine = await Machine.findByPk(id);
  if (!machine) return null;

  const exchangeRecord = await MachineExchange.create({
    machine_id: machine.id, from_shop_id: machine.current_shop_id,
    to_shop_id, transferred_by: userId, reason, exchanged_at: new Date(),
  });

  const updateData = { current_shop_id: to_shop_id };
  if (reset_cycle) {
    updateData.cycle_start_date = new Date().toISOString().split('T')[0];
  }
  await machine.update(updateData);
  return exchangeRecord;
};

const refill = async (id, { token_qty, token_value_tzs, notes }, userId) => {
  const machine = await Machine.findByPk(id);
  if (!machine) return null;

  const refillRecord = await MachineRefill.create({
    machine_id: machine.id, shop_id: machine.current_shop_id,
    refilled_by: userId, token_qty, token_value_tzs,
    total_tzs: token_qty * token_value_tzs, notes, refilled_at: new Date(),
  });

  await TokenInventory.create({
    qty: -token_qty,
    movement_type: 'refill_out',
    unit_value_tzs: token_value_tzs,
    total_value_tzs: token_qty * token_value_tzs,
    reference_id: refillRecord.id,
    recipient_type: 'shop',
    recipient_id: machine.current_shop_id,
    note: `Refill: ${machine.slot_code} → Shop #${machine.current_shop_id}` + (notes ? ` — ${notes}` : ''),
    created_by: userId,
  });

  return refillRecord;
};


const exportExcel = async () => {
  const ExcelJS = require('exceljs');
  const { Machine, Shop } = require('../models');
  const { literal } = require('sequelize');

  const machines = await Machine.findAll({
    include: [{ model: Shop, as: 'currentShop', attributes: ['name'] }],
    attributes: {
      include: [
        [
          literal('SELECT COALESCE(SUM(amount - paid_amount), 0) FROM machine_debts WHERE machine_id = Machine.id AND status NOT IN ("paid", "written_off")'),
          'outstanding_debt_tzs',
        ],
        [
          literal('SELECT COALESCE(weekly_target_tzs, (SELECT value FROM settings WHERE `key` = "weekly_target_tzs"))'),
          'effective_target_tzs',
        ],
      ],
    },
    order: [['slot_code', 'ASC']],
  });

  const data = machines.map((m) => {
    const json = m.toJSON();
    return {
      slot_code: json.slot_code,
      manufacturer: json.manufacturer,
      serial_number: json.serial_number || '',
      sticker_no: json.sticker_no || '',
      location: json.currentShop?.name || 'Office',
      credit_value_tzs: json.credit_value_tzs,
      weekly_target: json.effective_target_tzs || 0,
      debt: json.outstanding_debt_tzs || 0,
      status: json.status,
    };
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bentabet BSMS';
  wb.created = new Date();
  const ws = wb.addWorksheet('Machines');

  ws.columns = [
    { header: 'Slot Code', key: 'slot_code', width: 18 },
    { header: 'Manufacturer', key: 'manufacturer', width: 16 },
    { header: 'Serial No.', key: 'serial_number', width: 22 },
    { header: 'Sticker No.', key: 'sticker_no', width: 16 },
    { header: 'Location', key: 'location', width: 22 },
    { header: 'Credit (TZS)', key: 'credit_value_tzs', width: 16 },
    { header: 'Weekly Target (TZS)', key: 'weekly_target', width: 22 },
    { header: 'Debt (TZS)', key: 'debt', width: 16 },
    { header: 'Status', key: 'status', width: 16 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021559' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 22;

  data.forEach((r) => ws.addRow(r));

  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      };
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  return buf;
};
const generateMachinePDF = async (id) => new Promise(async (resolve, reject) => {
  try {
    const machine = await Machine.findByPk(id, {
      include: [
        { model: Shop, as: 'currentShop', attributes: ['name'] },
        {
          model: Collection,
          as: 'performance',
          attributes: ['collected_at', 'net_tzs', 'gross_tzs', 'office_tzs', 'owner_tzs', 'difference', 'prev_count', 'curr_count'],
          where: { status: 'approved' },
          order: [['collected_at', 'DESC']],
          limit: 50,
        },
      ],
    });
    if (!machine) return reject(new Error('Machine not found'));

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 45, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const m = machine.toJSON();
    const perf = m.performance || [];
    const totalGross = perf.reduce((s, p) => s + (p.gross_tzs || 0), 0);
    const totalNet = perf.reduce((s, p) => s + (p.net_tzs || 0), 0);
    const totalOffice = perf.reduce((s, p) => s + (p.office_tzs || 0), 0);
    const totalOwner = perf.reduce((s, p) => s + (p.owner_tzs || 0), 0);

    const brandColor = '#021559';
    const lightGray = '#f1f5f9';
    const textColor = '#1e293b';
    const mutedColor = '#64748b';

    doc.fontSize(18).fillColor(brandColor).font('Helvetica-Bold').text('BENTABET LTD', 45, 40);
    doc.fontSize(10).fillColor(mutedColor).font('Helvetica').text('Machine Performance Report', 45, 65);
    doc.moveTo(45, 82).lineTo(545, 82).strokeColor('#e2e8f0').lineWidth(1).stroke();

    let y = 100;
    doc.fontSize(9).fillColor(mutedColor).text('Report Date:', 45, y);
    doc.fillColor(textColor).text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), 120, y);

    y = 130;
    doc.rect(45, y, 500, 80).fill(lightGray).strokeColor('#e2e8f0').lineWidth(0.5);
    y += 10;
    doc.fillColor(brandColor).fontSize(14).font('Helvetica-Bold').text(m.slot_code, 55, y);
    doc.fillColor(mutedColor).fontSize(9).font('Helvetica').text(m.status.toUpperCase(), 350, y + 3);

    y += 25;
    const leftX = 55;
    const rightX = 300;
    doc.fillColor(mutedColor).fontSize(8);
    doc.text('Manufacturer', leftX, y);
    doc.text('Serial Number', rightX, y);
    y += 12;
    doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold');
    doc.text(m.manufacturer || '—', leftX, y);
    doc.text(m.serial_number || '—', rightX, y);
    y += 18;
    doc.fillColor(mutedColor).fontSize(8).font('Helvetica');
    doc.text('Sticker No.', leftX, y);
    doc.text('Current Location', rightX, y);
    y += 12;
    doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold');
    doc.text(m.sticker_no || '—', leftX, y);
    doc.text(m.currentShop?.name || 'Office (Undeployed)', rightX, y);

    y = 230;
    doc.fillColor(brandColor).fontSize(13).font('Helvetica-Bold').text('Performance Summary', 45, y);
    y += 25;
    doc.rect(45, y, 115, 50).fill(lightGray).strokeColor('#e2e8f0').lineWidth(0.5);
    doc.rect(165, y, 115, 50).fill(lightGray).strokeColor('#e2e8f0').lineWidth(0.5);
    doc.rect(285, y, 115, 50).fill(lightGray).strokeColor('#e2e8f0').lineWidth(0.5);
    doc.rect(405, y, 115, 50).fill(lightGray).strokeColor('#e2e8f0').lineWidth(0.5);

    doc.fillColor(mutedColor).fontSize(7).font('Helvetica').text('TOTAL GROSS', 55, y + 6, { width: 100 });
    doc.fillColor(textColor).fontSize(12).font('Helvetica-Bold').text(`TZS ${totalGross.toLocaleString()}`, 55, y + 18, { width: 100 });

    doc.fillColor(mutedColor).fontSize(7).font('Helvetica').text('TOTAL NET', 175, y + 6, { width: 100 });
    doc.fillColor(textColor).fontSize(12).font('Helvetica-Bold').text(`TZS ${totalNet.toLocaleString()}`, 175, y + 18, { width: 100 });

    doc.fillColor(mutedColor).fontSize(7).font('Helvetica').text('OFFICE SHARE', 295, y + 6, { width: 100 });
    doc.fillColor(textColor).fontSize(12).font('Helvetica-Bold').text(`TZS ${totalOffice.toLocaleString()}`, 295, y + 18, { width: 100 });

    doc.fillColor(mutedColor).fontSize(7).font('Helvetica').text('OWNER SHARE', 415, y + 6, { width: 100 });
    doc.fillColor(textColor).fontSize(12).font('Helvetica-Bold').text(`TZS ${totalOwner.toLocaleString()}`, 415, y + 18, { width: 100 });

    y += 70;
    doc.fillColor(brandColor).fontSize(11).font('Helvetica-Bold').text('Recent Collections', 45, y);

    if (perf.length > 0) {
      y += 20;
      doc.rect(45, y, 500, 16).fill(brandColor);
      doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
      doc.text('Date', 50, y + 4, { width: 70 });
      doc.text('Prev', 120, y + 4, { width: 50 });
      doc.text('Curr', 170, y + 4, { width: 50 });
      doc.text('Diff', 220, y + 4, { width: 50 });
      doc.text('Gross (TZS)', 270, y + 4, { width: 70 });
      doc.text('Office (TZS)', 340, y + 4, { width: 70 });
      doc.text('Owner (TZS)', 410, y + 4, { width: 70 });
      doc.text('Status', 480, y + 4, { width: 50 });

      y += 20;
      perf.slice(0, 50).forEach((p, i) => {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }
        const bg = i % 2 === 0 ? '#ffffff' : lightGray;
        doc.rect(45, y - 2, 500, 16).fill(bg);
        doc.fillColor(textColor).fontSize(7).font('Helvetica');
        const date = new Date(p.collected_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        doc.text(date, 50, y, { width: 70 });
        doc.text((p.prev_count || 0).toLocaleString(), 120, y, { width: 50 });
        doc.text((p.curr_count || 0).toLocaleString(), 170, y, { width: 50 });
        doc.text((p.difference || 0).toLocaleString(), 220, y, { width: 50 });
        doc.text((p.gross_tzs || 0).toLocaleString(), 270, y, { width: 70 });
        doc.text((p.office_tzs || 0).toLocaleString(), 340, y, { width: 70 });
        doc.text((p.owner_tzs || 0).toLocaleString(), 410, y, { width: 70 });
        doc.text('—', 480, y, { width: 50 });
        y += 16;
      });

      y += 6;
      doc.moveTo(45, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(0.5);
      y += 2;
      doc.rect(45, y, 500, 16).fill(brandColor);
      doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
      doc.text(`Total (${perf.length} records)`, 50, y + 4, { width: 170 });
      doc.text(totalGross.toLocaleString(), 270, y + 4, { width: 70 });
      doc.text(totalOffice.toLocaleString(), 340, y + 4, { width: 70 });
      doc.text(totalOwner.toLocaleString(), 410, y + 4, { width: 70 });
    } else {
      doc.fillColor(mutedColor).fontSize(9).font('Helvetica').text('No collections recorded for this machine.', 45, y + 20);
    }

    doc.end();
  } catch (err) { reject(err); }
});

const recordCollection = async ({ machineId, shopId, userId, currCount, novomaticData, collectionDate }) => {
  const { submitCollection } = require('./collection.service');
  const allowed = ['Admin', 'General Manager', 'Operations Manager'];

  const machine = await Machine.findByPk(machineId, { attributes: ['current_shop_id'] });
  if (!machine) throw new Error('Machine not found');

  return submitCollection({
    machineId,
    shopId: shopId || machine.current_shop_id,
    collectorId: userId,
    currCount,
    novomaticData,
    assignmentId: null,
    skipDebtRepayment: false,
    collectionDate,
  });
};

module.exports = { list, getOne, getMachineStats, create, update, remove, deploy, exchange, refill, exportExcel, generateMachinePDF, recordCollection };
