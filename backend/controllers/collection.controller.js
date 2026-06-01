// controllers/collection.controller.js
const { submitCollection, getCollections } = require('../services/collection.service');
const { extractMeterReading } = require('../services/ocr.service');
const { Machine, CollectorAssignment, WeeklyTarget, Collection } = require('../models');
const { Op } = require('sequelize');
const { cloudinary } = require('../middleware/upload');

const submit = async (req, res, next) => {
  try {
    const body = req.body;
    let meterImageUrl = null;

    if (req.file) {
      const uploadRes = await cloudinary.uploader.upload_stream({ folder: 'bentabet/meters' }, async (err, result) => {
        if (result) meterImageUrl = result.secure_url;
      });
      uploadRes.end(req.file.buffer);
    }

    const collection = await submitCollection({
      machineId: body.machine_id,
      shopId: body.shop_id,
      collectorId: req.user.id,
      currCount: parseInt(body.curr_count),
      meterImageUrl,
      novomaticData: body.novomatic_data ? JSON.parse(body.novomatic_data) : null,
      assignmentId: body.assignment_id,
    });

    res.status(201).json({ success: true, data: collection });
  } catch (err) { next(err); }
};

const ocr = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    const machine = await Machine.findByPk(req.body.machine_id);
    if (!machine) return res.status(404).json({ success: false, message: 'Machine not found' });
    const result = await extractMeterReading(req.file.buffer, machine.manufacturer);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const data = await getCollections(req.query, req.user);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const myAssignments = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const where = { collector_id: req.user.id, assigned_date: req.query.date || today };
    const assignments = await CollectorAssignment.findAll({
      where,
      include: [
        { model: Machine, as: 'machine', attributes: ['id', 'slot_code', 'manufacturer', 'previous_count', 'credit_value_tzs'] },
        { model: require('../models').Shop, as: 'shop', attributes: ['id', 'name'] },
      ],
    });
    res.json({ success: true, data: assignments });
  } catch (err) { next(err); }
};

const createAssignment = async (req, res, next) => {
  try {
    const { collector_id, machine_ids, date } = req.body;
    const machines = await Machine.findAll({ where: { id: machine_ids } });
    const assignments = await CollectorAssignment.bulkCreate(
      machines.map(m => ({
        collector_id, machine_id: m.id,
        shop_id: m.current_shop_id, assigned_date: date,
        assigned_by: req.user.id,
      }))
    );
    res.status(201).json({ success: true, data: assignments });
  } catch (err) { next(err); }
};

const weeklyTargets = async (req, res, next) => {
  try {
    const targets = await WeeklyTarget.findAll({
      where: req.query.machine_id ? { machine_id: req.query.machine_id } : {},
      include: [
        { model: Machine, as: 'machine', attributes: ['slot_code', 'manufacturer'], required: false },
        { model: require('../models').Shop, as: 'shop', attributes: ['name'], required: false },
      ],
      order: [['week_start', 'DESC']],
      limit: 100,
    });
    res.json({ success: true, data: targets });
  } catch (err) { next(err); }
};

module.exports = { submit, ocr, list, myAssignments, createAssignment, weeklyTargets };
