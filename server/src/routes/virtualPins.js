const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../db/prisma');
const { protect } = require('../middleware/auth');

router.use(protect);

// ─── GET /api/virtual-pins/:deviceId ─────────────────────────────────────────
router.get('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const where = req.user.role === 'admin'
      ? { deviceId, isActive: true }
      : { deviceId, owner: req.user.id, isActive: true };

    const device = await prisma.device.findFirst({ where });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const pins = await prisma.virtualPin.findMany({
      where: { deviceId, isActive: true },
      orderBy: { pinName: 'asc' },
    });

    res.json({ success: true, count: pins.length, pins });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST /api/virtual-pins/:deviceId ────────────────────────────────────────
router.post(
  '/:deviceId',
  [
    body('pinName').notEmpty().matches(/^V\d+$/i).withMessage('Pin name must be in format V0, V1, V2, etc.'),
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

      const device = await prisma.device.findFirst({
        where: { deviceId, owner: req.user.id, isActive: true },
      });
      if (!device) {
        return res.status(404).json({ success: false, message: 'Device not found.' });
      }

      const existing = await prisma.virtualPin.findUnique({
        where: { deviceId_pinName: { deviceId, pinName: pinName.toUpperCase() } },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: `Pin ${pinName.toUpperCase()} already exists.` });
      }

      const pin = await prisma.virtualPin.create({
        data: {
          deviceId,
          pinName: pinName.toUpperCase(),
          label: label || pinName.toUpperCase(),
          sensorType: sensorType || 'custom',
          unit: unit || '',
          minValue: minValue ?? 0,
          maxValue: maxValue ?? 100,
          color: color || '#00d4ff',
        },
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

    const device = await prisma.device.findFirst({
      where: { deviceId, owner: req.user.id, isActive: true },
    });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const pin = await prisma.virtualPin.findUnique({
      where: { deviceId_pinName: { deviceId, pinName: pinName.toUpperCase() } },
    });
    if (!pin) {
      return res.status(404).json({ success: false, message: 'Virtual pin not found.' });
    }

    const { label, sensorType, unit, minValue, maxValue, color } = req.body;
    const updateData = {};
    if (label !== undefined) updateData.label = label;
    if (sensorType) updateData.sensorType = sensorType;
    if (unit !== undefined) updateData.unit = unit;
    if (minValue !== undefined) updateData.minValue = minValue;
    if (maxValue !== undefined) updateData.maxValue = maxValue;
    if (color) updateData.color = color;

    const updated = await prisma.virtualPin.update({
      where: { id: pin.id },
      data: updateData,
    });

    res.json({ success: true, message: 'Virtual pin updated.', pin: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DELETE /api/virtual-pins/:deviceId/:pinName ──────────────────────────────
router.delete('/:deviceId/:pinName', async (req, res) => {
  try {
    const { deviceId, pinName } = req.params;

    const device = await prisma.device.findFirst({
      where: { deviceId, owner: req.user.id, isActive: true },
    });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const pin = await prisma.virtualPin.findUnique({
      where: { deviceId_pinName: { deviceId, pinName: pinName.toUpperCase() } },
    });
    if (!pin) {
      return res.status(404).json({ success: false, message: 'Virtual pin not found.' });
    }

    await prisma.virtualPin.update({
      where: { id: pin.id },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Virtual pin removed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
