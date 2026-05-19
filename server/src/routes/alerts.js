const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../db/prisma');
const { protect } = require('../middleware/auth');

router.use(protect);

// ─── GET /api/alerts ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const where = req.user.role === 'admin' ? {} : { owner: req.user.id };

    const alerts = await prisma.alert.findMany({
      where,
      include: { device: { select: { name: true, deviceId: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: alerts.length, alerts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET /api/alerts/device/:deviceId ────────────────────────────────────────
router.get('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const whereDevice = req.user.role === 'admin'
      ? { deviceId, isActive: true }
      : { deviceId, owner: req.user.id, isActive: true };

    const device = await prisma.device.findFirst({ where: whereDevice });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const alerts = await prisma.alert.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
    });

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

      const device = await prisma.device.findFirst({
        where: { deviceId, owner: req.user.id, isActive: true },
      });
      if (!device) {
        return res.status(404).json({ success: false, message: 'Device not found.' });
      }

      const alert = await prisma.alert.create({
        data: {
          deviceId,
          owner: req.user.id,
          name,
          pin: pin.toUpperCase(),
          condition,
          threshold: parseFloat(threshold),
          notificationType: notificationType || ['dashboard'],
          message: message || '',
          cooldownMinutes: cooldownMinutes || 5,
        },
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
    const alert = await prisma.alert.findFirst({
      where: { id: req.params.id, owner: req.user.id },
    });
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    const { name, pin, condition, threshold, notificationType, message, isActive, cooldownMinutes } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (pin) updateData.pin = pin.toUpperCase();
    if (condition) updateData.condition = condition;
    if (threshold !== undefined) updateData.threshold = parseFloat(threshold);
    if (notificationType) updateData.notificationType = notificationType;
    if (message !== undefined) updateData.message = message;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (cooldownMinutes) updateData.cooldownMinutes = cooldownMinutes;

    const updated = await prisma.alert.update({ where: { id: alert.id }, data: updateData });
    res.json({ success: true, message: 'Alert updated.', alert: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DELETE /api/alerts/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const alert = await prisma.alert.findFirst({
      where: { id: req.params.id, owner: req.user.id },
    });
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    await prisma.alert.delete({ where: { id: alert.id } });
    res.json({ success: true, message: 'Alert deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
