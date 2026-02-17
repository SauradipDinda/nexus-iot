const mongoose = require('mongoose');

const virtualPinSchema = new mongoose.Schema(
  {
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    pinName: {
      type: String,
      required: [true, 'Pin name is required'],
      match: [/^V\d+$/, 'Pin name must be in format V0, V1, V2, etc.'],
      uppercase: true,
    },
    label: {
      type: String,
      trim: true,
      maxlength: [50, 'Label cannot exceed 50 characters'],
      default: '',
    },
    sensorType: {
      type: String,
      enum: [
        'temperature',
        'humidity',
        'gas',
        'smoke',
        'carbon_emission',
        'pressure',
        'light',
        'motion',
        'voltage',
        'current',
        'custom',
      ],
      default: 'custom',
    },
    unit: {
      type: String,
      default: '',
      maxlength: [20, 'Unit cannot exceed 20 characters'],
    },
    minValue: {
      type: Number,
      default: 0,
    },
    maxValue: {
      type: Number,
      default: 100,
    },
    currentValue: {
      type: Number,
      default: null,
    },
    lastUpdated: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    color: {
      type: String,
      default: '#00d4ff',
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: one pin name per device
virtualPinSchema.index({ device: 1, pinName: 1 }, { unique: true });
virtualPinSchema.index({ deviceId: 1 });

module.exports = mongoose.model('VirtualPin', virtualPinSchema);
