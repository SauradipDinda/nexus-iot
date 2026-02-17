const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Alert = require('../models/Alert');
const Device = require('../models/Device');
const { protect } = require('../middleware/auth');

router.use(protect);

// ─── GET /api/alerts ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { owner: req.user._id };
    const alerts = await Alert.find(query)
      .populate('device', 'name deviceId')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: alerts.length, alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET /api/alerts/device/:deviceId ────────────────────────────────────────
router.get('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findOne({
      deviceId,
      ...(req.user.role !== 'admin' ? { owner: req.user._id } : {}),
      isActive: true,
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const alerts = await Alert.find({ deviceId }).sort({ createdAt: -1 });
    res.json({ success: true, count: alerts.length, alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST /api/alerts ─────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('deviceId').notEmpty().withMessage('Device ID is required'),
    body('name').trim().notEmpty().withMessage('Alert name is required'),
    body('pin').notEmpty().withMessage('Pin is required'),
    body('condition').isIn(['>', '<', '>=', '<=', '==', '!=']).withMessage('Invalid condition'),
    body('threshold').isNumeric().withMessage('Threshold must be a number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { deviceId, name, pin, condition, threshold, notificationType, message, cooldownMinutes } = req.body;

      const device = await Device.findOne({ deviceId, owner: req.user._id, isActive: true });
      if (!device) {
        return res.status(404).json({ success: false, message: 'Device not found.' });
      }

      const alert = await Alert.create({
        device: device._id,
        deviceId,
        owner: req.user._id,
        name,
        pin: pin.toUpperCase(),
        condition,
        threshold: parseFloat(threshold),
        notificationType: notificationType || ['dashboard'],
        message: message || '',
        cooldownMinutes: cooldownMinutes || 5,
      });

      res.status(201).json({ success: true, message: 'Alert created.', alert });
    } catch (error) {
      console.error('Create alert error:', error);
      res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// ─── PUT /api/alerts/:id ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const alert = await Alert.findOne({ _id: req.params.id, owner: req.user._id });
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    const { name, pin, condition, threshold, notificationType, message, isActive, cooldownMinutes } = req.body;
    if (name) alert.name = name;
    if (pin) alert.pin = pin.toUpperCase();
    if (condition) alert.condition = condition;
    if (threshold !== undefined) alert.threshold = parseFloat(threshold);
    if (notificationType) alert.notificationType = notificationType;
    if (message !== undefined) alert.message = message;
    if (isActive !== undefined) alert.isActive = isActive;
    if (cooldownMinutes) alert.cooldownMinutes = cooldownMinutes;

    await alert.save();
    res.json({ success: true, message: 'Alert updated.', alert });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DELETE /api/alerts/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const alert = await Alert.findOne({ _id: req.params.id, owner: req.user._id });
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    await alert.deleteOne();
    res.json({ success: true, message: 'Alert deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
