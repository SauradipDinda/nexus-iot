const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const templateSchema = new mongoose.Schema(
  {
    templateId: {
      type: String,
      unique: true,
      default: () => 'TMPL' + uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase(),
    },
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      maxlength: [100, 'Template name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    category: {
      type: String,
      enum: [
        'Smart Agriculture',
        'Fire Monitoring',
        'Industrial Safety',
        'Carbon Emission Tracking',
        'Environmental Monitoring',
        'Custom',
      ],
      default: 'Custom',
    },
    hardwareType: {
      type: String,
      enum: ['ESP32', 'ESP8266', 'Arduino', 'Raspberry Pi', 'Other'],
      default: 'ESP32',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    defaultPins: [
      {
        pinName: String,
        sensorType: String,
        unit: String,
        minValue: Number,
        maxValue: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Template', templateSchema);
