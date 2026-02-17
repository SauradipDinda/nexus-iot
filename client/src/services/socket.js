import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

let socket = null;

/**
 * Initialize socket connection with JWT token
 */
export const initSocket = (token) => {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  return socket;
};

/**
 * Get current socket instance
 */
export const getSocket = () => socket;

/**
 * Subscribe to a device room for real-time updates
 */
export const subscribeToDevice = (deviceId) => {
  if (socket) {
    socket.emit('subscribe_device', { deviceId });
  }
};

/**
 * Unsubscribe from a device room
 */
export const unsubscribeFromDevice = (deviceId) => {
  if (socket) {
    socket.emit('unsubscribe_device', { deviceId });
  }
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default { initSocket, getSocket, subscribeToDevice, unsubscribeFromDevice, disconnectSocket };
