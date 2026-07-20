// sockets/notification.socket.js
let io = null;

const setIO = (socketIO) => { io = socketIO; };

const notifyUser = (userId, payload) => {
  if (io) io.to(`user-${userId}`).emit('notification:new', payload);
};

module.exports = (socketIO) => {
  setIO(socketIO);

  socketIO.on('connection', (socket) => {
    socket.on('join:user', (userId) => {
      socket.join(`user-${userId}`);
    });

    socket.on('leave:user', (userId) => {
      socket.leave(`user-${userId}`);
    });
  });
};

module.exports.notifyUser = notifyUser;
