// controllers/auth.controller.js
const authService = require('../services/auth.service');

const register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const data = await authService.login(req.body.email, req.body.password);
    res.json({ success: true, data });
  } catch (err) {
    if (err.message === 'Invalid credentials') return res.status(401).json({ success: false, message: err.message });
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const result = await authService.refresh(req.body.refreshToken);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(401).json({ success: false, message: err.message });
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
};

const me = async (req, res) => {
  const user = await authService.getUserWithRole(req.user.id);
  res.json({ success: true, data: user });
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await authService.updateProfile(req.user.id, req.body);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    res.json({ success: true, message: 'Password updated' });
  } catch (err) { next(err); }
};

const uploadProfileDocs = async (req, res, next) => {
  try {
    const docs = await authService.uploadProfileDocs(req.user.id, req.files);
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

const deleteProfileDoc = async (req, res, next) => {
  try {
    const docs = await authService.deleteProfileDoc(req.user.id, req.body.url);
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

module.exports = { register, login, refresh, logout, me, updateProfile, changePassword, uploadProfileDocs, deleteProfileDoc };
