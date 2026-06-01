// services/collection.service.js
const { Op } = require('sequelize');
const { Collection, Machine, WeeklyTarget, NovomaticReading, CollectorAssignment, Setting } = require('../models');

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

const calculateMeteora = (prevCount, currCount, creditValueTzs, weeklyTargetTzs) => {
  const difference = currCount - prevCount;
  if (difference < 0) throw new Error('Current count cannot be less than previous count');
  const gross_tzs = difference * creditValueTzs;
  const office_tzs = Math.min(gross_tzs, weeklyTargetTzs);
  const owner_tzs = Math.max(0, gross_tzs - weeklyTargetTzs);
  return { difference, gross_tzs, office_tzs, owner_tzs, net_tzs: gross_tzs };
};

const calculateNovomatic = (totalInTzs, totalOutTzs, weeklyTargetTzs) => {
  const net_tzs = totalInTzs - totalOutTzs;
  const gross_tzs = net_tzs;
  const office_tzs = Math.min(gross_tzs, weeklyTargetTzs);
  const owner_tzs = Math.max(0, gross_tzs - weeklyTargetTzs);
  return { difference: 0, gross_tzs, office_tzs, owner_tzs, net_tzs };
};

const getOrCreateWeeklyTarget = async (machineId, shopId, weekStart, weekEnd) => {
  const settingRow = await Setting.findOne({ where: { key: 'weekly_target_tzs' } });
  const targetTzs = settingRow ? parseInt(settingRow.value) : 120000;

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

const submitCollection = async ({ machineId, shopId, collectorId, currCount, meterImageUrl, novomaticData, assignmentId }) => {
  const machine = await Machine.findByPk(machineId);
  if (!machine) throw new Error('Machine not found');

  const { weekStart, weekEnd } = getWeekBounds();
  const { target, targetTzs } = await getOrCreateWeeklyTarget(machineId, shopId, weekStart, weekEnd);

  let calcData;
  if (machine.manufacturer === 'Novomatic' && novomaticData) {
    calcData = calculateNovomatic(novomaticData.total_in_tzs, novomaticData.total_out_tzs, targetTzs);
  } else {
    calcData = calculateMeteora(machine.previous_count, currCount, machine.credit_value_tzs, targetTzs);
  }

  const collection = await Collection.create({
    machine_id: machineId,
    shop_id: shopId,
    collector_id: collectorId,
    prev_count: machine.previous_count,
    curr_count: currCount,
    difference: calcData.difference,
    credit_value_tzs: machine.credit_value_tzs,
    gross_tzs: calcData.gross_tzs,
    office_tzs: calcData.office_tzs,
    owner_tzs: calcData.owner_tzs,
    net_tzs: calcData.net_tzs,
    meter_image_url: meterImageUrl,
    collected_at: new Date(),
  });

  if (machine.manufacturer === 'Novomatic' && novomaticData) {
    await NovomaticReading.create({
      collection_id: collection.id,
      total_in_tzs: novomaticData.total_in_tzs,
      total_out_tzs: novomaticData.total_out_tzs,
      net_tzs: calcData.net_tzs,
      coins_in_tzs: novomaticData.coins_in_tzs || 0,
      remote_in_tzs: novomaticData.remote_in_tzs || 0,
      handpay_out_tzs: novomaticData.handpay_out_tzs || 0,
      screenshot_url: novomaticData.screenshot_url,
      read_at: new Date(),
    });
  }

  await machine.update({ previous_count: currCount });
  await target.increment('collected_tzs', { by: calcData.gross_tzs });
  if (assignmentId) await CollectorAssignment.update({ status: 'done' }, { where: { id: assignmentId } });

  return collection;
};

const getCollections = async (filters = {}, user) => {
  const where = {};
  if (user.role?.name === 'Collector') where.collector_id = user.id;
  if (filters.machine_id) where.machine_id = filters.machine_id;
  if (filters.shop_id) where.shop_id = filters.shop_id;
  if (filters.collector_id) where.collector_id = filters.collector_id;
  if (filters.date_from && filters.date_to) {
    where.collected_at = { [Op.between]: [new Date(filters.date_from), new Date(filters.date_to)] };
  }
  return Collection.findAndCountAll({
    where,
    include: [
      { model: Machine, as: 'machine', attributes: ['slot_code', 'manufacturer'] },
      { model: require('../models').Shop, as: 'shop', attributes: ['name'] },
      { model: require('../models').User, as: 'collector', attributes: ['name'] },
    ],
    order: [['collected_at', 'DESC']],
    limit: filters.limit || 50,
    offset: filters.offset || 0,
  });
};

module.exports = { submitCollection, getCollections, getWeekBounds, calculateMeteora, calculateNovomatic };
