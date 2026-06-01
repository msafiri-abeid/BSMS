// services/ticket.service.js
const { Op } = require('sequelize');
const { Ticket, TicketActivity, TicketGroup, Machine, Shop, User } = require('../models');
const { SLA_HOURS } = require('../config/constants');

let io;
const setIO = (socketIO) => { io = socketIO; };

const generateTicketNumber = async (prefix = 'TKT') => {
  const count = await Ticket.count();
  return `${prefix}-${String(count + 1).padStart(5, '0')}`;
};

const createTicket = async (data, userId) => {
  const slaHours = SLA_HOURS[data.priority] || 48;
  const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

  const ticket = await Ticket.create({
    ...data,
    ticket_number: await generateTicketNumber(),
    sla_deadline: slaDeadline,
    status: 'open',
  });

  await TicketActivity.create({
    ticket_id: ticket.id,
    action: 'created',
    to_status: 'open',
    note: 'Ticket created',
    performed_by: userId,
  });

  if (io) io.emit('ticket:update', { type: 'new', ticket: ticket.toJSON() });
  return ticket;
};

const updateTicketStatus = async (ticketId, newStatus, note, userId) => {
  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) throw new Error('Ticket not found');

  const fromStatus = ticket.status;
  const updates = { status: newStatus };
  if (newStatus === 'resolved') updates.resolved_at = new Date();

  await ticket.update(updates);
  await TicketActivity.create({
    ticket_id: ticketId,
    action: 'status_changed',
    from_status: fromStatus,
    to_status: newStatus,
    note,
    performed_by: userId,
  });

  if (io) io.emit('ticket:update', { type: 'update', ticketId, status: newStatus });
  return ticket;
};

const addActivity = async (ticketId, action, note, attachments, userId) => {
  const activity = await TicketActivity.create({
    ticket_id: ticketId,
    action,
    note,
    attachments: attachments || [],
    performed_by: userId,
  });
  if (io) io.emit('ticket:activity', { ticketId, activity: activity.toJSON() });
  return activity;
};

const getTickets = async (filters, user) => {
  const where = {};
  const roleName = user.role?.name;

  if (['Collector', 'Technician'].includes(roleName)) {
    where[Op.or] = [{ requester_id: user.id }, { assigned_to: user.id }];
  }

  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.slot_code) where.slot_code = { [Op.like]: `%${filters.slot_code}%` };
  if (filters.ticket_number) where.ticket_number = { [Op.like]: `%${filters.ticket_number}%` };
  if (filters.group_id) where.assigned_group_id = filters.group_id;
  if (filters.date_from && filters.date_to) {
    where.created_at = { [Op.between]: [new Date(filters.date_from), new Date(filters.date_to)] };
  }

  return Ticket.findAndCountAll({
    where,
    include: [
      { model: Machine, as: 'machine', attributes: ['slot_code', 'manufacturer'], required: false },
      { model: Shop, as: 'shop', attributes: ['name'], required: false },
      { model: TicketGroup, as: 'group', required: false },
      { model: User, as: 'assignee', attributes: ['name'], required: false },
    ],
    order: [
      ['priority', 'ASC'],
      ['created_at', 'DESC'],
    ],
    limit: parseInt(filters.limit) || 50,
    offset: parseInt(filters.offset) || 0,
  });
};

const getDashboardCounts = async () => {
  const statuses = ['open', 'pending', 'in_progress', 'resolved', 'closed', 'reopened'];
  const counts = {};
  await Promise.all(
    statuses.map(async (s) => {
      counts[s] = await Ticket.count({ where: { status: s } });
    })
  );
  counts.total = await Ticket.count();
  return counts;
};

module.exports = { createTicket, updateTicketStatus, addActivity, getTickets, getDashboardCounts, setIO };
