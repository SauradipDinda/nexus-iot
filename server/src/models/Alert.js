const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
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
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Alert name is required'],
      trim: true,
      maxlength: [100, 'Alert name cannot exceed 100 characters'],
    },
    pin: {
      type: String,
      required: [true, 'Pin is required'],
      uppercase: true,
    },
    condition: {
      type: String,
      enum: ['>', '<', '>=', '<=', '==', '!='],
      required: [true, 'Condition is required'],
    },
    threshold: {
      type: Number,
      required: [true, 'Threshold value is required'],
    },
    notificationType: {
      type: [String],
      enum: ['email', 'sms', 'dashboard'],
      default: ['dashboard'],
    },
    message: {
      type: String,
      default: '',
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Cooldown: minimum minutes between repeated alerts
    cooldownMinutes: {
      type: Number,
      default: 5,
      min: 1,
    },
    lastTriggered: {
      type: Date,
      default: null,
    },
    triggerCount: {
      type: Number,
      default: 0,
    },
    // Alert history log
    history: [
      {
        triggeredAt: { type: Date, default: Date.now },
        value: Number,
        notified: Boolean,
      },
    ],
  },
  {
    timestamps: true,
  }
);

alertSchema.index({ device: 1, isActive: 1 });
alertSchema.index({ deviceId: 1, pin: 1 });

module.exports = mongoose.model('Alert', alertSchema);
