const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Device = require('../models/Device');

/**
 * Socket.io connection handler
 * Manages real-time communication between dashboard and IoT devices
 */
const socketHandler = (io) => {
  // Middleware: authenticate socket connections from dashboard users
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user && user.isActive) {
          socket.user = user;
        }
      }
      next();
    } catch (error) {
      // Allow unauthenticated connections (device connections use different auth)
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── User joins their personal room ──────────────────────────────────────
    if (socket.user) {
      const userRoom = `user:${socket.user._id}`;
      socket.join(userRoom);
      console.log(`👤 User ${socket.user.email} joined room: ${userRoom}`);

      socket.emit('connected', {
        message: 'Connected to IoT Dashboard',
        userId: socket.user._id,
        timestamp: new Date().toISOString(),
      });
    }

    // ── Subscribe to a device room ───────────────────────────────────────────
    socket.on('subscribe_device', async (data) => {
      try {
        const { deviceId } = data;
        if (!deviceId) return;

        // Verify user owns this device
        if (socket.user) {
          const device = await Device.findOne({
            deviceId,
            owner: socket.user._id,
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

    // ── Unsubscribe from a device room ───────────────────────────────────────
    socket.on('unsubscribe_device', (data) => {
      const { deviceId } = data;
      if (deviceId) {
        socket.leave(`device:${deviceId}`);
        console.log(`📴 Socket ${socket.id} unsubscribed from device:${deviceId}`);
      }
    });

    // ── Ping/Pong for connection health check ────────────────────────────────
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // ── Handle disconnect ────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} | Reason: ${reason}`);
    });
  });

  return io;
};

module.exports = socketHandler;
