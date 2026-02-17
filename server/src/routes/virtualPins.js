const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const VirtualPin = require('../models/VirtualPin');
const Device = require('../models/Device');
const { protect } = require('../middleware/auth');

router.use(protect);

// ─── GET /api/virtual-pins/:deviceId ─────────────────────────────────────────
router.get('/:deviceId', async (req, res) => {
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

    const pins = await VirtualPin.find({ deviceId, isActive: true }).sort({ pinName: 1 });
    res.json({ success: true, count: pins.length, pins });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST /api/virtual-pins/:deviceId ────────────────────────────────────────
router.post(
  '/:deviceId',
  [
    body('pinName')
      .notEmpty()
      .matches(/^V\d+$/i)
      .withMessage('Pin name must be in format V0, V1, V2, etc.'),
    body('sensorType').optional().isIn([
      'temperature', 'humidity', 'gas', 'smoke', 'carbon_emission',
      'pressure', 'light', 'motion', 'voltage', 'current', 'custom',
    ]),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { deviceId } = req.params;
      const { pinName, label, sensorType, unit, minValue, maxValue, color } = req.body;

      const device = await Device.findOne({
        deviceId,
        owner: req.user._id,
        isActive: true,
      });

      if (!device) {
        return res.status(404).json({ success: false, message: 'Device not found.' });
      }

      // Check if pin already exists
      const existing = await VirtualPin.findOne({ deviceId, pinName: pinName.toUpperCase() });
      if (existing) {
        return res.status(400).json({ success: false, message: `Pin ${pinName.toUpperCase()} already exists.` });
      }

      const pin = await VirtualPin.create({
        device: device._id,
        deviceId,
        pinName: pinName.toUpperCase(),
        label: label || pinName.toUpperCase(),
        sensorType: sensorType || 'custom',
        unit: unit || '',
        minValue: minValue ?? 0,
        maxValue: maxValue ?? 100,
        color: color || '#00d4ff',
      });

      res.status(201).json({ success: true, message: 'Virtual pin created.', pin });
    } catch (error) {
      console.error('Create pin error:', error);
      res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// ─── PUT /api/virtual-pins/:deviceId/:pinName ─────────────────────────────────
router.put('/:deviceId/:pinName', async (req, res) => {
  try {
    const { deviceId, pinName } = req.params;

    const device = await Device.findOne({ deviceId, owner: req.user._id, isActive: true });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const pin = await VirtualPin.findOne({ deviceId, pinName: pinName.toUpperCase() });
    if (!pin) {
      return res.status(404).json({ success: false, message: 'Virtual pin not found.' });
    }

    const { label, sensorType, unit, minValue, maxValue, color } = req.body;
    if (label !== undefined) pin.label = label;
    if (sensorType) pin.sensorType = sensorType;
    if (unit !== undefined) pin.unit = unit;
    if (minValue !== undefined) pin.minValue = minValue;
    if (maxValue !== undefined) pin.maxValue = maxValue;
    if (color) pin.color = color;

    await pin.save();
    res.json({ success: true, message: 'Virtual pin updated.', pin });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DELETE /api/virtual-pins/:deviceId/:pinName ──────────────────────────────
router.delete('/:deviceId/:pinName', async (req, res) => {
  try {
    const { deviceId, pinName } = req.params;

    const device = await Device.findOne({ deviceId, owner: req.user._id, isActive: true });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const pin = await VirtualPin.findOne({ deviceId, pinName: pinName.toUpperCase() });
    if (!pin) {
      return res.status(404).json({ success: false, message: 'Virtual pin not found.' });
    }

    pin.isActive = false;
    await pin.save();

    res.json({ success: true, message: 'Virtual pin removed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
