// services/auth.service.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRY, JWT_REFRESH_EXPIRY, BCRYPT_ROUNDS } = require('../config/constants');
const { User, Role, Permission, RefreshToken, Employee, Department, Position } = require('../models');

const generateTokens = (user) => {
  const payload = { id: user.id, email: user.email, roleId: user.role_id };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });
  return { accessToken, refreshToken };
};

const getUserWithRole = async (userId) => {
  return User.findOne({
    where: { id: userId, is_active: true },
    attributes: { exclude: ['password_hash'] },
    include: [
      { model: Role, as: 'role', include: [{ model: Permission, as: 'permissions' }] },
      { model: Employee, as: 'employee', include: [
        { model: Department, as: 'department' },
        { model: Position, as: 'position' },
        { model: Employee, as: 'supervisor', attributes: ['id', 'full_name', 'employee_code'] },
      ] },
    ],
  });
};

const register = async ({ name, email, password, role_id, employee_id, phone }) => {
  if (!phone?.trim()) throw new Error('Phone number is required');
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error('Email already registered');

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({
    name,
    email,
    password_hash,
    role_id,
    employee_id,
    phone: phone.trim(),
  });
  return getUserWithRole(user.id);
};

const login = async (email, password) => {
  const user = await User.findOne({
    where: { email, is_active: true },
    include: [
      { model: Role, as: 'role', include: [{ model: Permission, as: 'permissions' }] },
      { model: Employee, as: 'employee', include: [
        { model: Department, as: 'department' },
        { model: Position, as: 'position' },
        { model: Employee, as: 'supervisor', attributes: ['id', 'full_name', 'employee_code'] },
      ] },
    ],
  });
  if (!user) throw new Error('Invalid credentials');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error('Invalid credentials');

  const { accessToken, refreshToken } = generateTokens(user);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ user_id: user.id, token: refreshToken, expires_at: expiresAt });

  await user.update({ last_login: new Date() });

  const { password_hash, ...userData } = user.toJSON();
  return { user: userData, accessToken, refreshToken };
};

const refresh = async (refreshToken) => {
  const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  const stored = await RefreshToken.findOne({
    where: { token: refreshToken, user_id: decoded.id, is_revoked: false },
  });
  if (!stored || stored.expires_at < new Date()) throw new Error('Invalid or expired refresh token');

  const user = await User.findOne({
    where: { id: decoded.id, is_active: true },
    include: [
      { model: Role, as: 'role', include: [{ model: Permission, as: 'permissions' }] },
      { model: Employee, as: 'employee', include: [
        { model: Department, as: 'department' },
        { model: Position, as: 'position' },
        { model: Employee, as: 'supervisor', attributes: ['id', 'full_name', 'employee_code'] },
      ] },
    ],
  });
  if (!user) throw new Error('User not found');

  const tokens = generateTokens(user);
  await stored.update({ is_revoked: true });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ user_id: user.id, token: tokens.refreshToken, expires_at: expiresAt });

  const { password_hash, ...userData } = user.toJSON();
  return { tokens, user: userData };
};

const logout = async (refreshToken) => {
  await RefreshToken.update({ is_revoked: true }, { where: { token: refreshToken } });
};

const updateProfile = async (userId, { name, email, phone, currentPassword, account_holder_name, bank_account, bank_name, bank_code, bank_branch, tax_payer_id }) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');

  if (email && email !== user.email) {
    if (!currentPassword) throw new Error('Current password required to change email');
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new Error('Current password incorrect');
    const existing = await User.findOne({ where: { email: email.trim() } });
    if (existing && existing.id !== userId) throw new Error('Email already in use');
  }

  const payload = {};
  if (name != null) payload.name = name.trim();
  if (email != null) payload.email = email.trim();
  if (phone != null) payload.phone = phone.trim();
  await user.update(payload);

  const employee = await Employee.findOne({ where: { user_id: userId } });
  if (employee) {
    const empPayload = {};
    if (account_holder_name !== undefined) empPayload.account_holder_name = account_holder_name;
    if (bank_account !== undefined) empPayload.bank_account = bank_account;
    if (bank_name !== undefined) empPayload.bank_name = bank_name;
    if (bank_code !== undefined) empPayload.bank_code = bank_code;
    if (bank_branch !== undefined) empPayload.bank_branch = bank_branch;
    if (tax_payer_id !== undefined) empPayload.tax_payer_id = tax_payer_id;
    if (Object.keys(empPayload).length) await employee.update(empPayload);
  }

  return getUserWithRole(user.id);
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findByPk(userId);
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) throw new Error('Current password incorrect');
  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.update({ password_hash });
};

const uploadProfileDocs = async (userId, files) => {
  const employee = await Employee.findOne({ where: { user_id: userId } });
  if (!employee) throw new Error('Employee record not found');
  const newDocs = (files || []).map((f) => ({ url: f.path, name: f.originalname }));
  const docs = [...(employee.documents || []), ...newDocs];
  await employee.update({ documents: docs });
  return docs;
};

const deleteProfileDoc = async (userId, docUrl) => {
  const employee = await Employee.findOne({ where: { user_id: userId } });
  if (!employee) throw new Error('Employee record not found');
  const docs = (employee.documents || []).filter((d) => d.url !== docUrl);
  await employee.update({ documents: docs });
  return docs;
};

module.exports = { register, login, refresh, logout, changePassword, updateProfile, getUserWithRole, uploadProfileDocs, deleteProfileDoc };
