const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { BCRYPT_ROUNDS } = require('../config/constants');
const { Employee, Department, Position, User, Role, Attendance } = require('../models');

const employeeIncludes = [
  { model: User, as: 'user', attributes: { exclude: ['password_hash'] }, required: false, include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }] },
  { model: Department, as: 'department' },
  { model: Position, as: 'position' },
  { model: Employee, as: 'supervisor', attributes: ['id', 'full_name', 'employee_code'] },
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

const getDocumentProxyUrl = async (docUrl) => {
  if (!docUrl) return null;
  // Local paths are served directly by express static — no proxy needed
  if (docUrl.startsWith('/uploads/')) return docUrl;
  // External URLs (legacy Cloudinary) returned as-is
  return docUrl;
};

const enrichEmployee = (emp) => {
  const json = emp.toJSON ? emp.toJSON() : { ...emp };
  json.documents = normalizeDocuments(json.documents);
  return json;
};

const empName = (e) => e?.full_name || e?.user?.name || e?.employee_code || '�';

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
    account_holder_name: body.account_holder_name || null,
    bank_account: body.bank_account || null,
    bank_name: body.bank_name || null,
    bank_code: body.bank_code || null,
    bank_branch: body.bank_branch || null,
    tax_payer_id: body.tax_payer_id || null,
    status: body.status || existing?.status || 'active',
    reports_to: body.reports_to ? Number(body.reports_to) : null,
  };
  if (documents.length) {
    payload.documents = [...normalizeDocuments(existing?.documents), ...documents];
  }
  if (body.user_role_id !== undefined && body.user_role_id !== null && body.user_role_id !== '') payload.user_role_id = Number(body.user_role_id);
  if (body.user_password) payload.user_password = body.user_password;
  if (body.user_email?.trim()) payload.user_email = body.user_email.trim();
  if (body.user_is_active !== undefined) payload.user_is_active = body.user_is_active === 'true' || body.user_is_active === true;
  return payload;
};

const listEmployees = async ({ search, status, department_id, has_user, page, limit, sort_by, sort_order } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (department_id) where.department_id = Number(department_id);

  if (search) {
    where[Op.or] = [
      { employee_code: { [Op.like]: `%${search}%` } },
      { full_name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
    ];
  }

  if (has_user === 'true') {
    where.user_id = { [Op.ne]: null };
  } else if (has_user === 'false') {
    where.user_id = null;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const sortField = ['employee_code', 'full_name', 'created_at', 'email', 'phone', 'status'].includes(sort_by)
    ? sort_by : 'created_at';
  const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

  const { count, rows } = await Employee.findAndCountAll({
    where,
    include: employeeIncludes,
    order: [[sortField, sortDir]],
    offset,
    limit: limitNum,
  });

  const todayLogins = await User.count({ where: { last_login: { [Op.gte]: todayStart } } });

  return {
    data: rows.map(enrichEmployee),
    total: count,
    page: pageNum,
    limit: limitNum,
    todayLogins,
  };
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

const exportEmployees = async () => {
  const ExcelJS = require('exceljs');
  const rows = await Employee.findAll({
    include: employeeIncludes,
    order: [['created_at', 'DESC']],
  });
  const data = rows.map(enrichEmployee).map((e) => ({
    employeeCode: e.employee_code,
    name: empName(e),
    email: e.email || e.user?.email || '',
    phone: e.phone || e.user?.phone || '',
    department: e.department?.name || '',
    position: e.position?.name || '',
    status: e.status,
    userAccount: e.user ? 'Yes' : 'No',
    role: e.user?.role?.name || '',
    lastLogin: e.user?.last_login || '',
    basicSalary: e.basic_salary || 0,
    hireDate: e.hire_date || '',
    reportingTo: e.supervisor ? `${e.supervisor.employee_code} — ${e.supervisor.full_name}` : '',
  }));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bentabet BSMS';
  wb.created = new Date();
  const ws = wb.addWorksheet('Employees');

  ws.columns = [
    { header: 'Employee ID', key: 'employeeCode', width: 16 },
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Email', key: 'email', width: 32 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Department', key: 'department', width: 22 },
    { header: 'Position', key: 'position', width: 22 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'User Account', key: 'userAccount', width: 14 },
    { header: 'Role', key: 'role', width: 20 },
    { header: 'Last Login', key: 'lastLogin', width: 16 },
    { header: 'Reporting To', key: 'reportingTo', width: 28 },
    { header: 'Basic Salary', key: 'basicSalary', width: 16 },
    { header: 'Hire Date', key: 'hireDate', width: 16 },
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

const generateEmployeeCode = async () => {
  const count = await Employee.count();
  return `EMP-${String(count + 1).padStart(3, '0')}`;
};

const createEmployee = async (data) => {
  if (!data.full_name?.trim()) throw new Error('Employee name is required');
  if (!data.phone?.trim()) throw new Error('Phone number is required');

  const { user_role_id, user_password, user_email, user_is_active, ...empData } = data;
  const employeeCode = await generateEmployeeCode();

  if (user_role_id && !user_password) throw new Error('Password is required to create a user account');

  const row = await Employee.create({
    ...empData,
    full_name: empData.full_name.trim(),
    phone: empData.phone.trim(),
    employee_code: employeeCode,
    documents: normalizeDocuments(empData.documents),
  });

  if (user_role_id && user_password) {
    const email = user_email || empData.email || `${employeeCode}@bentabet.co.tz`;
    const password_hash = await bcrypt.hash(user_password, BCRYPT_ROUNDS);
    const user = await User.create({
      name: empData.full_name.trim(),
      email,
      phone: empData.phone.trim(),
      role_id: user_role_id,
      password_hash,
      employee_id: employeeCode,
      is_active: user_is_active !== undefined ? user_is_active : true,
    });
    await row.update({ user_id: user.id });
  }

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
  const { user_role_id, user_password, user_email, user_is_active, employee_code, ...safe } = data;
  if (safe.documents) safe.documents = normalizeDocuments(safe.documents);
  await employee.update(safe);

  if (employee.user_id) {
    const userUpdates = {};
    if (user_role_id) userUpdates.role_id = user_role_id;
    if (user_password) userUpdates.password_hash = await bcrypt.hash(user_password, BCRYPT_ROUNDS);
    if (safe.full_name) userUpdates.name = safe.full_name;
    if (safe.phone) userUpdates.phone = safe.phone;
    const newEmail = user_email || safe.email;
    if (newEmail) {
      const existingUser = await User.findOne({ where: { email: newEmail } });
      if (existingUser && existingUser.id !== employee.user_id) {
        throw new Error('Email already in use by another user account');
      }
      userUpdates.email = newEmail;
    }
    const empStatus = safe.status || employee.status;
    if (empStatus === 'inactive' || empStatus === 'terminated') {
      userUpdates.is_active = false;
    } else if (empStatus === 'active' && user_is_active !== undefined) {
      userUpdates.is_active = user_is_active === 'true' || user_is_active === true;
    } else if (empStatus === 'active') {
      userUpdates.is_active = true;
    }
    if (Object.keys(userUpdates).length) {
      await User.update(userUpdates, { where: { id: employee.user_id } });
    }
  } else if (user_role_id && user_password) {
    const email = user_email || safe.email || employee.email || `${employee.employee_code}@bentabet.co.tz`;
    const password_hash = await bcrypt.hash(user_password, BCRYPT_ROUNDS);
    const user = await User.create({
      name: safe.full_name?.trim() || employee.full_name,
      email,
      phone: safe.phone?.trim() || employee.phone,
      role_id: user_role_id,
      password_hash,
      employee_id: employee.employee_code,
      is_active: user_is_active !== undefined ? user_is_active : true,
    });
    await employee.update({ user_id: user.id });
  }

  return getEmployee(id);
};

const deleteEmployee = async (id) => {
  const employee = await Employee.findByPk(id);
  if (!employee) throw new Error('Employee not found');
  await employee.destroy();
};

const deleteEmployeeDocument = async (employeeId, docUrl) => {
  if (!docUrl) throw new Error('Document URL is required');
  const employee = await Employee.findByPk(employeeId);
  if (!employee) throw new Error('Employee not found');
  const docs = normalizeDocuments(employee.documents).filter((d) => d.url !== docUrl);
  await employee.update({ documents: docs });
  return { documents: docs };
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
  getDocumentProxyUrl,
  listEmployees,
  getEmployee,
  exportEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  deleteEmployeeDocument,
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  createPosition,
  updatePosition,
  deletePosition,
  listPositions,
};
