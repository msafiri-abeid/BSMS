// controllers/settings.controller.js
const settingsService = require('../services/settings.service');
const { sendSMS } = require('../services/sms.service');

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

const testSMS = async (req, res, next) => {
  try {
    const result = await sendSMS(req.body.to, req.body.message || 'BENTABET: Test SMS from system.');
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

module.exports = { getAll, bulkUpdate, getRoles, createRole, updatePermissions, testSMS };
