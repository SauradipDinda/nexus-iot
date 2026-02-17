const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      unique: true,
      default: () => 'DEV' + uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase(),
    },
    name: {
      type: String,
      required: [true, 'Device name is required'],
      trim: true,
      maxlength: [100, 'Device name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    templateId: {
      type: String,
      required: [true, 'Template ID is required'],
    },
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
    },
    authToken: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(32).toString('hex'),
      select: false, // Hidden by default for security
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'inactive'],
      default: 'offline',
    },
    lastSeen: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    location: {
      name: { type: String, default: '' },
      lat: { type: Number },
      lng: { type: Number },
    },
    metadata: {
      firmwareVersion: { type: String, default: '1.0.0' },
      hardwareType: {
        type: String,
        enum: ['ESP32', 'ESP8266', 'Arduino', 'Raspberry Pi', 'Other'],
        default: 'ESP32',
      },
      ipAddress: { type: String, default: '' },
    },
    // Dashboard widget layout for this device
    dashboardLayout: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
deviceSchema.index({ owner: 1, isActive: 1 });
deviceSchema.index({ authToken: 1 });
deviceSchema.index({ templateId: 1 });

// Update status based on lastSeen
deviceSchema.methods.updateStatus = function () {
  if (!this.lastSeen) {
    this.status = 'offline';
    return;
  }
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  this.status = this.lastSeen > fiveMinutesAgo ? 'online' : 'offline';
};

module.exports = mongoose.model('Device', deviceSchema);
