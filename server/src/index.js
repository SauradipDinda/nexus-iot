const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const prisma = require('./db/prisma');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const dataRoutes = require('./routes/data');
const alertRoutes = require('./routes/alerts');
const templateRoutes = require('./routes/templates');
const virtualPinRoutes = require('./routes/virtualPins');
const analyticsRoutes = require('./routes/analytics');

// Import socket handler
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// Allowed origins
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001',
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/\.netlify\.app$/.test(origin)) return true;
  if (/\.vercel\.app$/.test(origin)) return true;
  if (/\.onrender\.com$/.test(origin)) return true;
  return false;
};

// Socket.io setup with CORS
const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) callback(null, true);
      else callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);
app.set('trust proxy', 1); // Crucial for Render: get real client IP

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 100,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/virtual-pins', virtualPinRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'IoT Dashboard API is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    database: 'PostgreSQL (Neon DB)',
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Nexus IoT Dashboard API', version: '2.0.0' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  logger.error('Global Error:', { message: err.message, stack: err.stack, url: req.url, method: req.method });
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ─── Socket.io Handler ───────────────────────────────────────────────────────
socketHandler(io);

// ─── Database Connection ─────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('✅ PostgreSQL (Neon DB) connected successfully');
  } catch (error) {
    logger.error('❌ Database connection error:', { message: error.message });
    logger.warn('⚠️  Server running without database connection');
  }
};

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 IoT Dashboard Server running on port ${PORT}`);
  logger.info(`📡 WebSocket server ready`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 API: http://localhost:${PORT}/api/health`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`❌ Port ${PORT} is already in use.`);
  } else {
    logger.error('Server error:', error);
  }
  process.exit(1);
});

connectDB().catch(err => {
  logger.error('Database connection failed:', { message: err.message });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => logger.info('HTTP server closed'));
  io.close(() => logger.info('Socket.io server closed'));
  await prisma.$disconnect();
  logger.info('Database connection closed');
  logger.info('Process terminated successfully');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, io };
