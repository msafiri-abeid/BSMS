// middleware/auth.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const { User, Role, Permission } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findOne({
      where: { id: decoded.id, is_active: true },
      include: [{ model: Role, as: 'role', include: [{ model: Permission, as: 'permissions' }] }],
    });

    if (!user) return res.status(401).json({ success: false, message: 'User not found or inactive', code: 'TOKEN_EXPIRED' });

    req.user = user;
    req.permissions = user.role?.permissions || [];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const checkPermission = (module, action) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  const roleName = req.user.role?.name;
  if (roleName === 'Admin') return next(); // Admin has all permissions

  const has = req.permissions.some(p => p.module === module && p.action === action);
  if (!has) {
    return res.status(403).json({ success: false, message: `Permission denied: ${module}:${action}` });
  }
  next();
};

module.exports = { authenticate, checkPermission };
