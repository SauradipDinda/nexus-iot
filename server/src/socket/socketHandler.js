const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');

/**
 * Socket.io connection handler
 */
const socketHandler = (io) => {
  // Authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (user && user.isActive) {
          socket.user = user;
        }
      }
      next();
    } catch (error) {
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    if (socket.user) {
      const userRoom = `user:${socket.user.id}`;
      socket.join(userRoom);
      console.log(`👤 User ${socket.user.email} joined room: ${userRoom}`);

      socket.emit('connected', {
        message: 'Connected to IoT Dashboard',
        userId: socket.user.id,
        timestamp: new Date().toISOString(),
      });
    }

    socket.on('subscribe_device', async (data) => {
      try {
        const { deviceId } = data;
        if (!deviceId) return;

        if (socket.user) {
          const device = await prisma.device.findFirst({
            where: { deviceId, owner: socket.user.id },
          });
          if (!device) {
            socket.emit('error', { message: 'Device not found or access denied.' });
            return;
          }
        }

        const room = `device:${deviceId}`;
        socket.join(room);
        console.log(`📡 Socket ${socket.id} subscribed to ${room}`);
        socket.emit('subscribed', { deviceId, room, timestamp: new Date().toISOString() });
      } catch (error) {
        socket.emit('error', { message: 'Failed to subscribe to device.' });
      }
    });

    socket.on('unsubscribe_device', (data) => {
      const { deviceId } = data;
      if (deviceId) {
        socket.leave(`device:${deviceId}`);
        console.log(`📴 Socket ${socket.id} unsubscribed from device:${deviceId}`);
      }
    });

    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} | Reason: ${reason}`);
    });
  });

  return io;
};

module.exports = socketHandler;
