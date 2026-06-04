const { Op } = require('sequelize');
const { Employee, Department, Position, User, Role, Attendance } = require('../models');

const employeeIncludes = [
  { model: User, as: 'user', attributes: { exclude: ['password_hash'] }, required: false, include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }] },
  { model: Department, as: 'department' },
  { model: Position, as: 'position' },
];

const fileUrl = (f) => f?.secure_url || f?.path || f?.url;

const normalizeDocuments = (docs) => {
  if (!docs) return [];
  let parsed = docs;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((d) => ({
    name: d.name || 'Document',
    url: d.url || d.secure_url || d.path,
  })).filter((d) => d.url);
};

const enrichEmployee = (emp) => {
  const json = emp.toJSON ? emp.toJSON() : { ...emp };
  json.documents = normalizeDocuments(json.documents);
  return json;
};

const buildEmployeePayload = (body, files, existing) => {
  const documents = (files || []).map((f) => ({
    name: f.originalname,
    url: fileUrl(f),
  })).filter((d) => d.url);

  const payload = {
    full_name: body.full_name?.trim() || existing?.full_name,
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || existing?.phone,
    department_id: body.department_id ? Number(body.department_id) : null,
    position_id: body.position_id ? Number(body.position_id) : null,
    hire_date: body.hire_date || null,
    basic_salary: body.basic_salary != null && body.basic_salary !== '' ? parseInt(body.basic_salary, 10) : 0,
    national_id: body.national_id || null,
    bank_account: body.bank_account || null,
    status: body.status || existing?.status || 'active',
  };
  if (documents.length) {
    payload.documents = [...normalizeDocuments(existing?.documents), ...documents];
  }
  return payload;
};

const listEmployees = async () => {
  const rows = await Employee.findAll({
    include: employeeIncludes,
    order: [['created_at', 'DESC']],
  });
  return rows.map(enrichEmployee);
};

const getEmployee = async (id) => {
  const employee = await Employee.findByPk(id, {
    include: [
      ...employeeIncludes,
      { model: Attendance, as: 'attendance', separate: true, order: [['date', 'DESC']], limit: 60 },
    ],
  });
  if (!employee) throw new Error('Employee not found');
  return enrichEmployee(employee);
};

const generateEmployeeCode = async () => {
  const count = await Employee.count();
  return `EMP-${String(count + 1).padStart(4, '0')}`;
};

const createEmployee = async (data) => {
  if (!data.full_name?.trim()) throw new Error('Employee name is required');
  if (!data.phone?.trim()) throw new Error('Phone number is required');

  const employeeCode = await generateEmployeeCode();
  const row = await Employee.create({
    ...data,
    full_name: data.full_name.trim(),
    phone: data.phone.trim(),
    employee_code: employeeCode,
    documents: normalizeDocuments(data.documents),
  });
  return getEmployee(row.id);
};

const updateEmployee = async (id, data) => {
  const employee = await Employee.findByPk(id);
  if (!employee) throw new Error('Employee not found');
  if (data.full_name !== undefined && !data.full_name?.trim()) {
    throw new Error('Employee name is required');
  }
  if (data.phone !== undefined && !data.phone?.trim()) {
    throw new Error('Phone number is required');
  }
  const { employee_code, ...safe } = data;
  if (safe.documents) safe.documents = normalizeDocuments(safe.documents);
  await employee.update(safe);
  return getEmployee(id);
};

const deleteEmployee = async (id) => {
  const employee = await Employee.findByPk(id);
  if (!employee) throw new Error('Employee not found');
  await employee.destroy();
};

const validateParentDepartment = async (id, parentId) => {
  if (!parentId) return;
  if (id && Number(parentId) === Number(id)) throw new Error('Department cannot be its own parent');
  let current = await Department.findByPk(parentId);
  while (current) {
    if (id && current.id === Number(id)) throw new Error('Invalid parent: circular hierarchy');
    current = current.parent_id ? await Department.findByPk(current.parent_id) : null;
  }
};

const listDepartments = async () => {
  return Department.findAll({
    include: [{ model: Department, as: 'parent', attributes: ['id', 'name'] }],
    order: [['sort_order', 'ASC'], ['name', 'ASC']],
  });
};

const buildDepartmentTree = (departments, parentId = null) => {
  return departments
    .filter((d) => (d.parent_id ?? null) === parentId)
    .map((d) => ({
      ...d.toJSON(),
      children: buildDepartmentTree(departments, d.id),
    }));
};

const getOrganization = async () => {
  const departments = await Department.findAll({ order: [['sort_order', 'ASC'], ['name', 'ASC']] });
  const employeeRows = await Employee.findAll({
    where: { status: 'active' },
    attributes: ['id', 'employee_code', 'full_name', 'department_id', 'position_id'],
    include: [
      { model: Position, as: 'position', attributes: ['id', 'name'] },
    ],
  });
  const employees = employeeRows.map((e) => e.toJSON());
  const positions = await Position.findAll({
    include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
    order: [['name', 'ASC']],
  });

  const tree = buildDepartmentTree(departments, null);
  const unassigned = employees.filter((e) => !e.department_id).map((e) => e);

  return {
    tree,
    employees,
    positions: positions.map((p) => p.toJSON()),
    unassigned,
  };
};

const createDepartment = async (data) => {
  if (!data.name?.trim()) throw new Error('Department name is required');
  if (data.parent_id) await validateParentDepartment(undefined, data.parent_id);
  return Department.create({
    name: data.name.trim(),
    parent_id: data.parent_id ? Number(data.parent_id) : null,
    sort_order: data.sort_order != null ? Number(data.sort_order) : 0,
  });
};

const updateDepartment = async (id, data) => {
  const dept = await Department.findByPk(id);
  if (!dept) throw new Error('Department not found');
  if (!data.name?.trim()) throw new Error('Department name is required');
  if (data.parent_id) await validateParentDepartment(id, data.parent_id);
  return dept.update({
    name: data.name.trim(),
    parent_id: data.parent_id ? Number(data.parent_id) : null,
    sort_order: data.sort_order != null ? Number(data.sort_order) : dept.sort_order,
  });
};

const deleteDepartment = async (id) => {
  const dept = await Department.findByPk(id);
  if (!dept) throw new Error('Department not found');
  const childCount = await Department.count({ where: { parent_id: id } });
  if (childCount) throw new Error('Cannot delete department with sub-departments');
  const empCount = await Employee.count({ where: { department_id: id } });
  if (empCount) throw new Error('Cannot delete department with assigned employees');
  const posCount = await Position.count({ where: { department_id: id } });
  if (posCount) throw new Error('Cannot delete department with assigned positions');
  await dept.destroy();
};

const createPosition = async (data) => {
  if (!data.name?.trim()) throw new Error('Position name is required');
  const row = await Position.create({
    name: data.name.trim(),
    department_id: data.department_id ? Number(data.department_id) : null,
  });
  return listPositions().then((all) => all.find((p) => p.id === row.id) || row);
};

const updatePosition = async (id, data) => {
  const pos = await Position.findByPk(id);
  if (!pos) throw new Error('Position not found');
  if (!data.name?.trim()) throw new Error('Position name is required');
  await pos.update({
    name: data.name.trim(),
    department_id: data.department_id ? Number(data.department_id) : null,
  });
  const all = await listPositions();
  return all.find((p) => p.id === pos.id);
};

const deletePosition = async (id) => {
  const pos = await Position.findByPk(id);
  if (!pos) throw new Error('Position not found');
  const empCount = await Employee.count({ where: { position_id: id } });
  if (empCount) throw new Error('Cannot delete position assigned to employees');
  await pos.destroy();
};

const listPositions = async () => {
  return Position.findAll({
    include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
    order: [['name', 'ASC']],
  });
};

module.exports = {
  normalizeDocuments,
  buildEmployeePayload,
  listEmployees,
  getEmployee,
  createEmployee,
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
