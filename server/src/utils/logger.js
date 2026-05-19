const winston = require('winston');

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'iot-dashboard' },
  transports: [
    // File transport for general logs
    new winston.transports.File({ 
      filename: 'logs/app.log',
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // File transport specifically for error logs
    new winston.transports.File({ 
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
    })
  ]
});

module.exports = logger;