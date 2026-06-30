const usersService = require('../services/users.service');
const { Role } = require('../models');

const listUsers = async (req, res, next) => {
  try {
    const data = await usersService.listUsers(req.query);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const createUser = async (req, res, next) => {
  try {
    const data = await usersService.createUser(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await usersService.updateUser(req.params.id, req.body);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

const listRoles = async (req, res, next) => {
  try {
    const data = await Role.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

module.exports = { listUsers, createUser, updateUser, listRoles };
