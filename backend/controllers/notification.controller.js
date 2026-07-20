// controllers/notification.controller.js
const { Notification } = require('../models');

const list = async (req, res, next) => {
  try {
    const notifications = await Notification.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    res.json({ success: true, data: notifications });
  } catch (err) { next(err); }
};

const markRead = async (req, res, next) => {
  try {
    await Notification.update({ is_read: true }, {
      where: { id: req.params.id, user_id: req.user.id },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
};

const readAll = async (req, res, next) => {
  try {
    await Notification.update({ is_read: true }, {
      where: { user_id: req.user.id, is_read: false },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
};

module.exports = { list, markRead, readAll };
