const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
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

// Allowed origins (supports multiple production URLs)
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001',
];
// Also allow any netlify.app or vercel.app subdomain
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

// Make io accessible to routes
app.set('io', io);

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
  message: { success: false, message: 'Too many requests, please try again later.' },
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

// Health check - always responds even if DB is not connected
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';
  res.json({
    success: true,
    message: 'IoT Dashboard API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: dbStatus,
    environment: process.env.NODE_ENV || 'development',
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Nexus IoT Dashboard API', version: '1.0.0' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ─── Socket.io Handler ───────────────────────────────────────────────────────
socketHandler(io);

// ─── Database Connection ─────────────────────────────────────────────────────
const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_dashboard';
  const isProduction = process.env.NODE_ENV === 'production';

  console.log(`🔌 Connecting to MongoDB... (${isProduction ? 'production' : 'development'} mode)`);

  // In production, only use the configured MONGODB_URI (must be Atlas or real DB)
  if (isProduction) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000 });
      console.log('✅ MongoDB connected successfully');
      return;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error.message);
      console.error('Check your MONGODB_URI environment variable');
      // Don't exit - let the server run so health check works
      return;
    }
  }

  // In development: try local MongoDB first, then fall back to in-memory
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log('✅ MongoDB connected successfully (local)');
    return;
  } catch (localError) {
    console.log('⚠️  Local MongoDB not available, trying in-memory server...');
  }

  // Fallback: use mongodb-memory-server (development only)
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected successfully (in-memory - dev mode)');
    console.log('ℹ️  Note: Data will be lost when server restarts (in-memory mode)');
    
    process.on('beforeExit', async () => {
      await mongod.stop();
    });
  } catch (memError) {
    console.error('❌ MongoDB connection error:', memError.message);
    console.log('⚠️  Server running without database connection');
  }
};

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// Start server FIRST, then connect to DB
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 IoT Dashboard Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API: http://localhost:${PORT}/api/health`);
});

// Connect to DB after server starts
connectDB().catch(err => {
  console.error('Database connection failed:', err.message);
});

module.exports = { app, io };
