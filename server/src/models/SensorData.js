const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema(
  {
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    pin: {
      type: String,
      required: true,
      uppercase: true,
    },
    value: {
      type: Number,
      required: true,
    },
    sensorType: {
      type: String,
      default: 'custom',
    },
    unit: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    // Disable default timestamps since we manage timestamp manually
    timestamps: false,
    // TTL index: auto-delete data older than 90 days
    // (set in index below)
  }
);

// Compound index for efficient queries
sensorDataSchema.index({ deviceId: 1, pin: 1, timestamp: -1 });
sensorDataSchema.index({ device: 1, timestamp: -1 });

// TTL index: auto-delete records older than 90 days
sensorDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('SensorData', sensorDataSchema);
