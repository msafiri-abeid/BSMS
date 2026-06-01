// controllers/ticket.controller.js
const ticketService = require('../services/ticket.service');
const { Ticket, TicketActivity, TicketGroup } = require('../models');

const create = async (req, res, next) => {
  try {
    const attachments = req.files?.map(f => f.path) || [];
    const ticket = await ticketService.createTicket({ ...req.body, requester_id: req.user.id }, req.user.id);
    if (attachments.length > 0) {
      await ticketService.addActivity(ticket.id, 'files_attached', 'Initial attachments', attachments, req.user.id);
    }
    res.status(201).json({ success: true, data: ticket });
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const data = await ticketService.getTickets(req.query, req.user);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id, {
      include: [
        { model: TicketActivity, as: 'activities', include: [{ model: require('../models').User, as: 'actor', attributes: ['name'], required: false }], order: [['created_at', 'ASC']] },
        { model: require('../models').Machine, as: 'machine', attributes: ['slot_code'], required: false },
        { model: require('../models').Shop, as: 'shop', attributes: ['name'], required: false },
      ],
    });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, data: ticket });
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const ticket = await ticketService.updateTicketStatus(req.params.id, req.body.status, req.body.note, req.user.id);
    res.json({ success: true, data: ticket });
  } catch (err) { next(err); }
};

const addActivity = async (req, res, next) => {
  try {
    const files = req.files?.map(f => f.path) || [];
    const activity = await ticketService.addActivity(req.params.id, req.body.action || 'comment', req.body.note, files, req.user.id);
    res.status(201).json({ success: true, data: activity });
  } catch (err) { next(err); }
};

const dashboardCounts = async (req, res, next) => {
  try {
    const counts = await ticketService.getDashboardCounts();
    res.json({ success: true, data: counts });
  } catch (err) { next(err); }
};

const listGroups = async (req, res, next) => {
  try {
    const groups = await TicketGroup.findAll({ order: [['name', 'ASC']] });
    res.json({ success: true, data: groups });
  } catch (err) { next(err); }
};

module.exports = { create, list, getOne, updateStatus, addActivity, dashboardCounts, listGroups };
