const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Device = require('../models/Device');

/**
 * Middleware: Protect routes — requires valid JWT
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from DB
    const user = await User.findById(decoded.id);
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
 * Middleware: Authenticate device via Auth Token (for IoT devices)
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

    // Find device by auth token (include authToken field)
    const device = await Device.findOne({ authToken, isActive: true }).select('+authToken');

    if (!device) {
      return res.status(401).json({ success: false, message: 'Invalid or revoked device token.' });
    }

    // Update device last seen and status
    device.lastSeen = new Date();
    device.status = 'online';
    await device.save();

    req.device = device;
    next();
  } catch (error) {
    console.error('Device auth error:', error);
    return res.status(500).json({ success: false, message: 'Server error during device authentication.' });
  }
};

module.exports = { protect, authorize, deviceAuth };
