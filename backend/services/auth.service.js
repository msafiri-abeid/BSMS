// services/auth.service.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRY, JWT_REFRESH_EXPIRY, BCRYPT_ROUNDS } = require('../config/constants');
const { User, Role, Permission, RefreshToken } = require('../models');

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
    include: [{ model: Role, as: 'role', include: [{ model: Permission, as: 'permissions' }] }],
  });
};

const register = async ({ name, email, password, role_id, employee_id, phone }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error('Email already registered');

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ name, email, password_hash, role_id, employee_id, phone });
  return getUserWithRole(user.id);
};

const login = async (email, password) => {
  const user = await User.findOne({
    where: { email, is_active: true },
    include: [{ model: Role, as: 'role', include: [{ model: Permission, as: 'permissions' }] }],
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

  const user = await User.findOne({ where: { id: decoded.id, is_active: true } });
  if (!user) throw new Error('User not found');

  const tokens = generateTokens(user);
  await stored.update({ is_revoked: true });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ user_id: user.id, token: tokens.refreshToken, expires_at: expiresAt });

  return tokens;
};

const logout = async (refreshToken) => {
  await RefreshToken.update({ is_revoked: true }, { where: { token: refreshToken } });
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findByPk(userId);
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) throw new Error('Current password incorrect');
  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.update({ password_hash });
};

module.exports = { register, login, refresh, logout, changePassword, getUserWithRole };
