// services/collection.service.js
const { Op, literal } = require('sequelize');
const sequelize = require('../config/database');
const { Collection, Machine, MachineDeployment, WeeklyTarget, NovomaticReading, CollectorAssignment, Setting, Shop, User, Partner, MachineDebt, Address, Account, AccountTransaction } = require('../models');

const getWeekBounds = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
};

const getMachineWeekBounds = (cycleStartDate, now = new Date()) => {
  const start = new Date(cycleStartDate);
  const daysSince = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  const weeksSince = Math.floor(daysSince / 7);
  const weekStart = new Date(start);
  weekStart.setDate(start.getDate() + weeksSince * 7);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
};

const getMachineCycleStart = async (machine) => {
  if (machine.cycle_start_date) return new Date(machine.cycle_start_date);
  const latestDeploy = await MachineDeployment.findOne({
    where: { machine_id: machine.id },
    order: [['deployed_at', 'DESC']],
  });
  if (latestDeploy) return new Date(latestDeploy.deployed_at);
  return null;
};

const calculateMeteora = (prevCount, currCount, creditValueTzs, weeklyTargetTzs, alreadyCollected = 0) => {
  const difference = currCount - prevCount;
  if (difference < 0) throw new Error('Current count cannot be less than previous count');
  const gross_tzs = difference * creditValueTzs;
  const remainingTarget = Math.max(0, weeklyTargetTzs - alreadyCollected);
  const office_tzs = Math.min(gross_tzs, remainingTarget);
  const owner_tzs = gross_tzs - office_tzs;
  return { difference, gross_tzs, office_tzs, owner_tzs, net_tzs: gross_tzs };
};

// Novomatic: no weekly target, no debt. Gross = (closing - opening) * credit_value. Office fixed at 50%.
const calculateNovomatic = (openingCredits, closingCredits, creditValueTzs) => {
  const totalCredits = closingCredits - openingCredits;
  const gross_tzs = totalCredits * creditValueTzs;
  const net_tzs = gross_tzs;
  const office_tzs = Math.round(gross_tzs * 0.5);
  const owner_tzs = gross_tzs - office_tzs;
  return { difference: totalCredits, gross_tzs, office_tzs, owner_tzs, net_tzs, total_credits: totalCredits };
};

const getOrCreateWeeklyTarget = async (machineId, shopId, weekStart, weekEnd, machineTargetTzs) => {
  const targetTzs = machineTargetTzs || 120000;

  const [target] = await WeeklyTarget.findOrCreate({
    where: { machine_id: machineId, week_start: weekStart.toISOString().split('T')[0] },
    defaults: {
      shop_id: shopId,
      target_tzs: targetTzs,
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      collected_tzs: 0,
      status: 'pending',
    },
  });
  return { target, targetTzs };
};

const payOutstandingDebts = async (machineId, amount, options = {}) => {
  if (amount <= 0) return 0;

  const outstandingDebts = await MachineDebt.findAll({
    where: {
      machine_id: machineId,
      status: { [Op.in]: ['pending', 'partial'] },
    },
    order: [['created_at', 'ASC']],
    ...options,
  });

  let remaining = amount;

  for (const debt of outstandingDebts) {
    if (remaining <= 0) break;
    const owed = debt.amount - debt.paid_amount;
    if (owed <= 0) continue;

    const payment = Math.min(remaining, owed);
    debt.paid_amount += payment;
    remaining -= payment;

    if (debt.paid_amount >= debt.amount) {
      debt.status = 'paid';
      debt.paid_at = new Date();
    } else {
      debt.status = 'partial';
    }
    await debt.save(options);
  }

  return amount - remaining;
};

const submitCollection = async ({ machineId, shopId, collectorId, currCount, meterImageUrl, novomaticData, assignmentId, skipDebtRepayment, collectionDate }) => {
  const machine = await Machine.findByPk(machineId);
  if (!machine) throw new Error('Machine not found');

  const isNovomatic = machine.manufacturer === 'Novomatic' && novomaticData;

  return sequelize.transaction(async (t) => {
    let calcData;
    let currCountFinal = currCount;
    let openingCredits = 0;

    if (isNovomatic) {
      const closingCredits = novomaticData.closing_credits;
      openingCredits = novomaticData.opening_credits;
      if (openingCredits === null || openingCredits === undefined) {
        const prevCollection = await Collection.findOne({
          where: { machine_id: machineId },
          order: [['collected_at', 'DESC']],
          include: [{ model: NovomaticReading, as: 'novomaticReading' }],
          transaction: t,
        });
        openingCredits = machine.previous_count || machine.opening_count || 0;
      }
      calcData = calculateNovomatic(openingCredits, closingCredits, machine.credit_value_tzs);
      currCountFinal = closingCredits;
    } else {
      const cycleStart = await getMachineCycleStart(machine);
      const { weekStart, weekEnd } = cycleStart
        ? getMachineWeekBounds(cycleStart)
        : getWeekBounds();

      const machineTarget = machine.weekly_target_tzs || null;
      const finalTarget = machineTarget || (await Setting.findOne({ where: { key: 'weekly_target_tzs' }, transaction: t }));

      const { target, targetTzs } = await getOrCreateWeeklyTarget(
        machineId, shopId, weekStart, weekEnd,
        finalTarget ? parseInt(finalTarget.value || finalTarget) : 120000
      );

      const alreadyCollected = target.collected_tzs || 0;
      calcData = calculateMeteora(machine.previous_count, currCount, machine.credit_value_tzs, targetTzs, alreadyCollected);

      let finalOwnerTzs = calcData.owner_tzs;
      if (!skipDebtRepayment && calcData.owner_tzs > 0) {
        const repaid = await payOutstandingDebts(machineId, calcData.owner_tzs, { transaction: t });
        finalOwnerTzs = calcData.owner_tzs - repaid;
      }
      calcData.owner_tzs = finalOwnerTzs;

      await target.increment('collected_tzs', { by: calcData.gross_tzs, transaction: t });
      await machine.update({ previous_count: currCount }, { transaction: t });
    }

    const colDate = collectionDate || new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const collection = await Collection.create({
      machine_id: machineId,
      shop_id: shopId,
      collector_id: collectorId,
      prev_count: isNovomatic ? (novomaticData?.opening_credits ?? machine.previous_count) : machine.previous_count,
      curr_count: currCountFinal,
      difference: calcData.difference,
      credit_value_tzs: machine.credit_value_tzs,
      gross_tzs: calcData.gross_tzs,
      office_tzs: calcData.office_tzs,
      owner_tzs: calcData.owner_tzs,
      net_tzs: calcData.net_tzs,
      meter_image_url: meterImageUrl,
      collection_date: colDate,
      collected_at: new Date(),
    }, { transaction: t });

    if (isNovomatic) {
      await NovomaticReading.create({
        collection_id: collection.id,
        opening_credits: openingCredits,
        closing_credits: novomaticData.closing_credits,
        total_credits: calcData.total_credits,
        screenshot_url: novomaticData.screenshot_url || meterImageUrl,
        read_at: new Date(),
      }, { transaction: t });
      await machine.update({ previous_count: novomaticData.closing_credits }, { transaction: t });
    }

    if (assignmentId) {
      await CollectorAssignment.update({ status: 'done' }, { where: { id: assignmentId }, transaction: t });
    }

    return collection;
  });
};

const getCollections = async (filters = {}, user) => {
  const where = {};
  if (user.role?.name === 'Collector') where.collector_id = user.id;
  if (user.role?.name === 'Cashier') where.collector_id = user.id;
  if (filters.machine_id) where.machine_id = filters.machine_id;
  if (filters.shop_id) where.shop_id = filters.shop_id;
  if (filters.collector_id) where.collector_id = filters.collector_id;
  if (filters.status) where.status = filters.status;
  // manufacturer filter handled via include.where below
  if (filters.date) {
    where.collection_date = filters.date;
  } else if (filters.date_from && filters.date_to) {
    where.collection_date = { [Op.between]: [filters.date_from, filters.date_to] };
  }
  return Collection.findAndCountAll({
    where,
    attributes: {
      include: [
        [
          literal(`(
            SELECT COALESCE(SUM(md.amount - md.paid_amount), 0)
            FROM machine_debts md
            WHERE md.machine_id = Collection.machine_id
              AND md.status IN ('pending', 'partial')
          )`),
          'debt_outstanding_tzs',
        ],
        [
          literal(`(
            SELECT md.id
            FROM machine_debts md
            WHERE md.machine_id = Collection.machine_id
              AND md.status IN ('pending', 'partial')
            ORDER BY md.created_at ASC
            LIMIT 1
          )`),
          'debt_id',
        ],
      ],
    },
    include: [
      {
        model: Machine, as: 'machine',
        attributes: ['id', 'slot_code', 'manufacturer', 'credit_value_tzs', 'weekly_target_tzs'],
        ...(filters.manufacturer ? { where: { manufacturer: filters.manufacturer } } : {}),
      },
      { model: Shop, as: 'shop', attributes: ['id', 'name'] },
      { model: User, as: 'collector', attributes: ['id', 'name'] },
      { model: User, as: 'approver', attributes: ['id', 'name'] },
      { model: User, as: 'supervisorApprover', attributes: ['id', 'name'] },
      { model: NovomaticReading, as: 'novomaticReading', attributes: ['opening_credits', 'closing_credits', 'total_credits', 'screenshot_url', 'read_at'] },
    ],
    order: [['collected_at', 'DESC']],
    limit: +(filters.limit || 50),
    offset: +(filters.offset || 0),
    distinct: true,
  });
};

const updateCollection = async (id, data) => {
  const collection = await Collection.findByPk(id, {
    include: [{ model: NovomaticReading, as: 'novomaticReading' }]
  });
  if (!collection) return null;

  return sequelize.transaction(async (t) => {
    const updateData = { ...data };
    delete updateData.collector_id;
    delete updateData.machine_id;
    delete updateData.shop_id;

    // Handle Novomatic meter reading + recalculation
    if (data.novomatic_data) {
      const nd = typeof data.novomatic_data === 'string'
        ? JSON.parse(data.novomatic_data)
        : data.novomatic_data;
      delete updateData.novomatic_data;

      const machine = await Machine.findByPk(collection.machine_id, { transaction: t });
      if (!machine) throw new Error('Machine not found');

      const totalCredits = nd.closing_credits - nd.opening_credits;

      // Update NovomaticReading record
      const nrUpdate = {
        opening_credits: nd.opening_credits,
        closing_credits: nd.closing_credits,
        total_credits: totalCredits,
        screenshot_url: 'meter_image_url' in data ? (data.meter_image_url || null) : collection.novomaticReading?.screenshot_url,
        read_at: new Date(),
      };
      await NovomaticReading.update(nrUpdate, {
        where: { collection_id: id },
        transaction: t,
      });

      // Update machine previous_count for next collection
      await machine.update({ previous_count: nd.closing_credits }, { transaction: t });

      // Update Collection meter-derived fields
      Object.assign(updateData, {
        prev_count: nd.opening_credits,
        curr_count: nd.closing_credits,
        difference: totalCredits,
        credit_value_tzs: machine.credit_value_tzs,
      });
    }

    if ('meter_image_url' in data) {
      updateData.meter_image_url = data.meter_image_url || null;
    }

    await collection.update(updateData, { transaction: t });
    // Reload to return fresh state
    return collection.reload({ transaction: t });
  });
};

const removeCollection = async (id) => {
  const collection = await Collection.findByPk(id);
  if (!collection) return false;
  await collection.destroy();
  return true;
};

const getAssignments = async (filters = {}) => {
  const where = {};
  if (filters.collector_id) where.collector_id = filters.collector_id;
  if (filters.machine_id) where.machine_id = filters.machine_id;
  if (filters.status) where.status = filters.status;
  if (filters.date_from) where.assigned_date = { ...where.assigned_date, [Op.gte]: filters.date_from };
  if (filters.date_to) where.assigned_date = { ...where.assigned_date, [Op.lte]: filters.date_to };
  if (filters.date) where.assigned_date = filters.date;

  return CollectorAssignment.findAndCountAll({
    where,
    include: [
      { model: Machine, as: 'machine', attributes: ['id', 'slot_code', 'manufacturer', 'previous_count', 'credit_value_tzs'] },
      { model: Shop, as: 'shop', attributes: ['id', 'name'] },
      { model: User, as: 'collector', attributes: ['id', 'name'] },
    ],
    order: [['assigned_date', 'DESC'], ['created_at', 'DESC']],
    limit: +(filters.limit || 50),
    offset: +(filters.offset || 0),
    distinct: true,
  });
};

const updateAssignment = async (id, data) => {
  const assignment = await CollectorAssignment.findByPk(id);
  if (!assignment) return null;
  await assignment.update(data);
  return assignment;
};

const removeAssignment = async (id) => {
  const assignment = await CollectorAssignment.findByPk(id);
  if (!assignment) return false;
  await assignment.destroy();
  return true;
};

const ExcelJS = require('exceljs');

const exportAssignmentsExcel = async (filters = {}) => {
  const assignments = await CollectorAssignment.findAll({
    where: filters,
    include: [
      { model: Machine, as: 'machine', attributes: ['id', 'slot_code', 'manufacturer'] },
      { model: Shop, as: 'shop', attributes: ['id', 'name'] },
      { model: User, as: 'collector', attributes: ['id', 'name'] },
    ],
    order: [['assigned_date', 'DESC'], ['created_at', 'DESC']],
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Assignments');
  ws.columns = [
    { header: 'Slot Code', key: 'slot_code', width: 15 },
    { header: 'Shop', key: 'shop', width: 20 },
    { header: 'Collector', key: 'collector', width: 20 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Opened', key: 'opened', width: 10 },
  ];

  assignments.forEach(a => {
    ws.addRow({
      slot_code: a.machine?.slot_code,
      shop: a.shop?.name,
      collector: a.collector?.name,
      date: a.assigned_date,
      status: a.status,
      opened: a.is_opened ? 'Yes' : 'No',
    });
  });

  ws.getRow(1).font = { bold: true };
  return wb.xlsx.writeBuffer();
};

module.exports = { submitCollection, getCollections, getWeekBounds, getMachineWeekBounds, calculateMeteora, calculateNovomatic, updateCollection, removeCollection, getAssignments, updateAssignment, removeAssignment, exportAssignmentsExcel };
