// controllers/settings.controller.js
const settingsService = require('../services/settings.service');
const { sendSMS } = require('../services/sms.service');
const { Partner } = require('../models');

const getAll = async (req, res, next) => {
  try {
    const data = await settingsService.getAll();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const bulkUpdate = async (req, res, next) => {
  try {
    await settingsService.bulkSet(req.body, req.user.id);
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) { next(err); }
};

const getRoles = async (req, res, next) => {
  try {
    const roles = await settingsService.getRoles();
    res.json({ success: true, data: roles });
  } catch (err) { next(err); }
};

const createRole = async (req, res, next) => {
  try {
    const role = await settingsService.createRole(req.body.name);
    res.status(201).json({ success: true, data: role });
  } catch (err) { next(err); }
};

const updatePermissions = async (req, res, next) => {
  try {
    await settingsService.updatePermissions(req.params.roleId, req.body.permissions);
    res.json({ success: true, message: 'Permissions updated' });
  } catch (err) { next(err); }
};

const updateRole = async (req, res, next) => {
  try {
    await settingsService.updateRole(req.params.roleId, req.body);
    res.json({ success: true, message: 'Role updated' });
  } catch (err) { next(err); }
};

const deleteRole = async (req, res, next) => {
  try {
    await settingsService.deleteRole(req.params.roleId);
    res.json({ success: true, message: 'Role deleted' });
  } catch (err) { next(err); }
};

const listBusinesses = async (req, res, next) => {
  try {
    const partners = await Partner.findAll({ where: { type: 'own' }, order: [['label', 'ASC']] });
    res.json({ success: true, data: partners });
  } catch (err) { next(err); }
};

const updateBusiness = async (req, res, next) => {
  try {
    const partner = await Partner.findByPk(req.params.id);
    if (!partner) return res.status(404).json({ success: false, message: 'Business not found' });
    const { label, name, phone, type, status } = req.body;
    await partner.update({
      ...(label !== undefined && { label }),
      ...(name !== undefined && { name: name.trim() }),
      ...(phone !== undefined && { phone }),
      ...(type !== undefined && { type }),
      ...(status !== undefined && { status }),
    });
    res.json({ success: true, data: partner });
  } catch (err) { next(err); }
};

const testSMS = async (req, res, next) => {
  try {
    const result = await sendSMS(req.body.to, req.body.message || 'BENTABET: Test SMS from system.');
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const listModules = async (req, res, next) => {
  try {
    const { MODULES } = require('../config/constants');
    res.json({ success: true, data: MODULES });
  } catch (err) { next(err); }
};

module.exports = { getAll, bulkUpdate, getRoles, createRole, updateRole, deleteRole, updatePermissions, listBusinesses, updateBusiness, testSMS, listModules };
