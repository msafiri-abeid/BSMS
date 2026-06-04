const staffService = require('../services/staff.service');

const createEmployee = async (req, res, next) => {
  try {
    const payload = staffService.buildEmployeePayload(req.body, req.files);
    const data = await staffService.createEmployee(payload);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

const listEmployees = async (req, res, next) => {
  try {
    const data = await staffService.listEmployees();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const getEmployee = async (req, res, next) => {
  try {
    const data = await staffService.getEmployee(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const updateEmployee = async (req, res, next) => {
  try {
    const existing = await staffService.getEmployee(req.params.id);
    const payload = staffService.buildEmployeePayload(req.body, req.files, existing);
    const data = await staffService.updateEmployee(req.params.id, payload);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const deleteEmployee = async (req, res, next) => {
  try {
    await staffService.deleteEmployee(req.params.id);
    res.json({ success: true, message: 'Employee deleted' });
  } catch (err) { next(err); }
};

const listDepartments = async (req, res, next) => {
  try {
    const data = await staffService.listDepartments();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const getOrganization = async (req, res, next) => {
  try {
    const data = await staffService.getOrganization();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const createDepartment = async (req, res, next) => {
  try {
    const department = await staffService.createDepartment(req.body);
    res.status(201).json({ success: true, data: department });
  } catch (err) { next(err); }
};

const updateDepartment = async (req, res, next) => {
  try {
    const data = await staffService.updateDepartment(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const deleteDepartment = async (req, res, next) => {
  try {
    await staffService.deleteDepartment(req.params.id);
    res.json({ success: true, message: 'Department deleted' });
  } catch (err) { next(err); }
};

const createPosition = async (req, res, next) => {
  try {
    const position = await staffService.createPosition(req.body);
    res.status(201).json({ success: true, data: position });
  } catch (err) { next(err); }
};

const updatePosition = async (req, res, next) => {
  try {
    const data = await staffService.updatePosition(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const deletePosition = async (req, res, next) => {
  try {
    await staffService.deletePosition(req.params.id);
    res.json({ success: true, message: 'Position deleted' });
  } catch (err) { next(err); }
};

const listPositions = async (req, res, next) => {
  try {
    const data = await staffService.listPositions();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

module.exports = {
  createEmployee,
  listEmployees,
  getEmployee,
  updateEmployee,
  deleteEmployee,
  listDepartments,
  getOrganization,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createPosition,
  updatePosition,
  deletePosition,
  listPositions,
};
