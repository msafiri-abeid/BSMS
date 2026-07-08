// controllers/collection.controller.js
const { submitCollection, getCollections, updateCollection, removeCollection, getAssignments, updateAssignment, removeAssignment } = require('../services/collection.service');
const { Machine, CollectorAssignment, WeeklyTarget, Collection } = require('../models');
const { Op } = require('sequelize');


const submit = async (req, res, next) => {
  try {
    const body = req.body;
    const meterImageUrl = req.file?.path || null;

    const allowedRoles = ['Admin', 'General Manager', 'Operations Manager'];
    const skipDebtRepayment = allowedRoles.includes(req.user.role?.name) && body.skip_debt_repayment === 'true';

    const collection = await submitCollection({
      machineId: body.machine_id,
      shopId: body.shop_id,
      collectorId: req.user.id,
      currCount: parseInt(body.curr_count),
      meterImageUrl,
      novomaticData: body.novomatic_data ? JSON.parse(body.novomatic_data) : null,
      assignmentId: body.assignment_id,
      skipDebtRepayment,
      collectionDate: body.collection_date || undefined,
    });

    res.status(201).json({ success: true, data: collection });
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const data = await getCollections(req.query, req.user);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[Collections list]', err.message, err.stack);
    next(err);
  }
};

const myAssignments = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const where = { collector_id: req.user.id, assigned_date: req.query.date || today };
    const assignments = await CollectorAssignment.findAll({
      where,
      include: [
        { model: Machine, as: 'machine', attributes: ['id', 'slot_code', 'manufacturer', 'previous_count', 'credit_value_tzs', 'opening_count'] },
        { model: require('../models').Shop, as: 'shop', attributes: ['id', 'name'] },
      ],
    });
    res.json({ success: true, data: assignments });
  } catch (err) { next(err); }
};

const createAssignment = async (req, res, next) => {
  try {
    const allowed = ['Admin', 'General Manager', 'Operations Manager'];
    if (!allowed.includes(req.user.role?.name)) {
      return res.status(403).json({ success: false, message: 'Only Admin, Operations Manager, or General Manager can create assignments' });
    }
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

const openMachine = async (req, res, next) => {
  try {
    const assignment = await CollectorAssignment.findOne({
      where: { id: req.params.id, collector_id: req.user.id },
    });
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    if (assignment.status !== 'pending') return res.status(400).json({ success: false, message: 'Assignment is not pending' });
    await assignment.update({ is_opened: true, opened_at: new Date() });
    res.json({ success: true, data: assignment });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const allowed = ['Admin', 'General Manager', 'Operations Manager', 'Supervisor'];
    const roleName = req.user.role?.name;

    // Cashier: only own pending collections, cannot approve
    if (roleName === 'Cashier') {
      const existing = await Collection.findByPk(req.params.id, {
        attributes: ['id', 'collector_id', 'status'],
      });
      if (!existing) return res.status(404).json({ success: false, message: 'Collection not found' });
      if (existing.collector_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'You can only edit your own collections' });
      }
      if (existing.status !== 'pending') {
        return res.status(403).json({ success: false, message: 'Can only edit pending collections' });
      }
      if (req.body.status === 'approved') {
        delete req.body.status;
      }
    } else if (!allowed.includes(roleName)) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    if (req.file) {
      req.body.meter_image_url = req.file.path;
    }

    if (req.body.status === 'approved') {
      req.body.approved_by = req.user.id;
      req.body.approved_at = new Date();
    }
    const collection = await updateCollection(req.params.id, req.body);
    if (!collection) return res.status(404).json({ success: false, message: 'Collection not found' });
    res.json({ success: true, data: collection });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const allowed = ['Admin', 'General Manager', 'Operations Manager'];
    const roleName = req.user.role?.name;

    if (roleName === 'Cashier') {
      const existing = await Collection.findByPk(req.params.id, {
        attributes: ['id', 'collector_id', 'status'],
      });
      if (!existing) return res.status(404).json({ success: false, message: 'Collection not found' });
      if (existing.collector_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'You can only delete your own collections' });
      }
      if (existing.status !== 'pending') {
        return res.status(403).json({ success: false, message: 'Can only delete pending collections' });
      }
    } else if (!allowed.includes(roleName)) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const deleted = await removeCollection(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Collection not found' });
    res.json({ success: true, message: 'Collection deleted successfully' });
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
  } catch (err) {
    console.error('[WeeklyTargets]', err.message, err.stack);
    next(err);
  }
};

const assignAllowed = (user) => ['Admin', 'General Manager', 'Operations Manager'].includes(user.role?.name);

const listAssignments = async (req, res, next) => {
  try {
    if (!assignAllowed(req.user)) return res.status(403).json({ success: false, message: 'Permission denied' });
    const data = await getAssignments(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const editAssignment = async (req, res, next) => {
  try {
    if (!assignAllowed(req.user)) return res.status(403).json({ success: false, message: 'Permission denied' });
    const result = await updateAssignment(req.params.id, req.body);
    if (!result) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const deleteAssignment = async (req, res, next) => {
  try {
    if (!assignAllowed(req.user)) return res.status(403).json({ success: false, message: 'Permission denied' });
    const deleted = await removeAssignment(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Assignment not found' });
    res.json({ success: true, message: 'Assignment deleted' });
  } catch (err) { next(err); }
};

const exportAssignments = async (req, res, next) => {
  try {
    if (!assignAllowed(req.user)) return res.status(403).json({ success: false, message: 'Permission denied' });
    const buffer = await require('../services/collection.service').exportAssignmentsExcel(req.query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=assignments-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  } catch (err) { next(err); }
};

module.exports = { submit, list, myAssignments, createAssignment, openMachine, update, remove, weeklyTargets, listAssignments, editAssignment, deleteAssignment, exportAssignments };
