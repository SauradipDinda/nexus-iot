const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../db/prisma');

/**
 * Rate limiter for login attempts
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Middleware: Protect routes — requires valid JWT
 */
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired.' });
    }
    return res.status(500).json({ success: false, message: 'Server error during authentication.' });
  }
};

/**
 * Middleware: Restrict to specific roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route.`,
      });
    }
    next();
  };
};

/**
 * Middleware: Authenticate IoT device via Auth Token
 */
const deviceAuth = async (req, res, next) => {
  try {
    const authToken =
      req.headers['x-auth-token'] ||
      req.headers['authorization']?.replace('Bearer ', '') ||
      req.body?.auth_token;

    if (!authToken) {
      return res.status(401).json({ success: false, message: 'Device auth token required.' });
    }

    const device = await prisma.device.findUnique({ where: { authToken } });

    if (!device || !device.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid or revoked device token.' });
    }

    // Update last seen
    await prisma.device.update({
      where: { id: device.id },
      data: { lastSeen: new Date(), status: 'online' },
    });

    req.device = device;
    next();
  } catch (error) {
    console.error('Device auth error:', error);
    return res.status(500).json({ success: false, message: 'Server error during device authentication.' });
  }
};

module.exports = { protect, authorize, deviceAuth, loginRateLimiter };
