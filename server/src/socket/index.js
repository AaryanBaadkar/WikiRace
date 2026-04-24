// server/src/socket/index.js
const { verifyAccess } = require('../utils/jwt');
const { registerMatchEvents } = require('./matchEvents');

function registerSocketEvents(io, pool) {
  // JWT auth middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = verifyAccess(token);
      socket.userId   = payload.userId;
      socket.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.username} (${socket.userId})`);
    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected: ${socket.username} reason=${reason}`);
    });
    registerMatchEvents(io, socket, pool);
  });
}

module.exports = { registerSocketEvents };
