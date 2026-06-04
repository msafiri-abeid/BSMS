const bcrypt = require('bcryptjs');
const { BCRYPT_ROUNDS } = require('../config/constants');
const { User, Role } = require('../models');
const authService = require('./auth.service');

const listUsers = async () => {
  return User.findAll({
    attributes: { exclude: ['password_hash'] },
    include: [{ model: Role, as: 'role', attributes: ['id', 'name'] }],
    order: [['name', 'ASC']],
  });
};

const createUser = async ({ name, email, password, role_id, phone, employee_id }) => {
  if (!phone?.trim()) throw new Error('Phone number is required');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

  const user = await authService.register({
    name: name?.trim(),
    email: email?.trim(),
    password,
    role_id: Number(role_id),
    phone: phone.trim(),
    employee_id: employee_id || null,
  });

  return {
    user,
    credentials: { email: email.trim(), password },
  };
};

const updateUser = async (id, data) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error('User not found');

  const payload = {};
  if (data.name !== undefined) payload.name = data.name.trim();
  if (data.email !== undefined) payload.email = data.email.trim();
  if (data.phone !== undefined) {
    if (!data.phone?.trim()) throw new Error('Phone number is required');
    payload.phone = data.phone.trim();
  }
  if (data.role_id !== undefined) payload.role_id = Number(data.role_id);
  if (data.is_active !== undefined) payload.is_active = data.is_active;
  if (data.employee_id !== undefined) payload.employee_id = data.employee_id;

  if (data.password) {
    if (data.password.length < 6) throw new Error('Password must be at least 6 characters');
    payload.password_hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  }

  await user.update(payload);
  return authService.getUserWithRole(user.id);
};

module.exports = { listUsers, createUser, updateUser };
