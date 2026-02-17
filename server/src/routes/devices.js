const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Device = require('../models/Device');
const Template = require('../models/Template');
const VirtualPin = require('../models/VirtualPin');
const SensorData = require('../models/SensorData');
const Alert = require('../models/Alert');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// ─── GET /api/devices ─────────────────────────────────────────────────────────
// Get all devices for the logged-in user
router.get('/', async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { owner: req.user._id };
    const devices = await Device.find({ ...query, isActive: true })
      .populate('template', 'name category hardwareType templateId')
      .sort({ createdAt: -1 });

    // Update status based on lastSeen
    const now = Date.now();
    const devicesWithStatus = devices.map((d) => {
      const obj = d.toObject();
      if (d.lastSeen) {
        obj.status = now - new Date(d.lastSeen).getTime() < 5 * 60 * 1000 ? 'online' : 'offline';
      }
      return obj;
    });

    res.json({ success: true, count: devicesWithStatus.length, devices: devicesWithStatus });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST /api/devices ────────────────────────────────────────────────────────
// Register a new device
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Device name is required'),
    body('templateId').notEmpty().withMessage('Template ID is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, description, templateId, location, metadata } = req.body;

      // Verify template exists
      const template = await Template.findOne({ templateId });
      if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found.' });
      }

      // Create device
      const device = await Device.create({
        name,
        description,
        templateId,
        template: template._id,
        owner: req.user._id,
        location: location || {},
        metadata: metadata || {},
      });

      // Auto-create virtual pins from template defaults
      if (template.defaultPins && template.defaultPins.length > 0) {
        const pinDocs = template.defaultPins.map((p, idx) => ({
          device: device._id,
          deviceId: device.deviceId,
          pinName: `V${idx}`,
          label: p.pinName || `Sensor ${idx}`,
          sensorType: p.sensorType || 'custom',
          unit: p.unit || '',
          minValue: p.minValue ?? 0,
          maxValue: p.maxValue ?? 100,
        }));
        await VirtualPin.insertMany(pinDocs);
      }

      // Fetch device with token for initial response
      const deviceWithToken = await Device.findById(device._id).select('+authToken');

      res.status(201).json({
        success: true,
        message: 'Device registered successfully.',
        device: deviceWithToken,
      });
    } catch (error) {
      console.error('Create device error:', error);
      res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// ─── GET /api/devices/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const device = await Device.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { deviceId: req.params.id }],
      ...(req.user.role !== 'admin' ? { owner: req.user._id } : {}),
      isActive: true,
    }).populate('template', 'name category hardwareType templateId');

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    // Get virtual pins
    const virtualPins = await VirtualPin.find({ device: device._id, isActive: true });

    res.json({ success: true, device, virtualPins });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET /api/devices/:id/token ───────────────────────────────────────────────
// Get device auth token (owner only)
router.get('/:id/token', async (req, res) => {
  try {
    const device = await Device.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { deviceId: req.params.id }],
      owner: req.user._id,
      isActive: true,
    }).select('+authToken');

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    res.json({
      success: true,
      authToken: device.authToken,
      templateId: device.templateId,
      deviceId: device.deviceId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── PUT /api/devices/:id ─────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const device = await Device.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { deviceId: req.params.id }],
      owner: req.user._id,
      isActive: true,
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const { name, description, location, metadata, dashboardLayout } = req.body;
    if (name) device.name = name;
    if (description !== undefined) device.description = description;
    if (location) device.location = { ...device.location, ...location };
    if (metadata) device.metadata = { ...device.metadata, ...metadata };
    if (dashboardLayout !== undefined) device.dashboardLayout = dashboardLayout;

    await device.save();

    // Broadcast layout update via WebSocket
    const io = req.app.get('io');
    if (io && dashboardLayout !== undefined) {
      io.to(`device:${device.deviceId}`).emit('layout_updated', {
        deviceId: device.deviceId,
        dashboardLayout,
      });
    }

    res.json({ success: true, message: 'Device updated.', device });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST /api/devices/:id/regenerate-token ───────────────────────────────────
// Regenerate auth token (revoke old one)
router.post('/:id/regenerate-token', async (req, res) => {
  try {
    const crypto = require('crypto');
    const device = await Device.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { deviceId: req.params.id }],
      owner: req.user._id,
      isActive: true,
    }).select('+authToken');

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    device.authToken = crypto.randomBytes(32).toString('hex');
    await device.save();

    res.json({
      success: true,
      message: 'Auth token regenerated. Update your device firmware.',
      authToken: device.authToken,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DELETE /api/devices/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const device = await Device.findOne({
      $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { deviceId: req.params.id }],
      owner: req.user._id,
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    // Soft delete
    device.isActive = false;
    device.status = 'inactive';
    await device.save();

    res.json({ success: true, message: 'Device deleted successfully.' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
