// sockets/ticket.socket.js
const { Ticket } = require('../models');
const ticketService = require('../services/ticket.service');

module.exports = (io) => {
  ticketService.setIO(io);

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('join:tickets', () => {
      socket.join('tickets-room');
      console.log(`[Socket] ${socket.id} joined tickets room`);
    });

    socket.on('leave:tickets', () => {
      socket.leave('tickets-room');
    });

    socket.on('request:counts', async () => {
      try {
        const counts = await ticketService.getDashboardCounts();
        socket.emit('ticket:counts', counts);
      } catch (err) {
        socket.emit('error', { message: 'Failed to get counts' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
};
