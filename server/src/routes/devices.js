const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const prisma = require('../db/prisma');
const { protect } = require('../middleware/auth');

router.use(protect);

const formatDevice = (device) => ({
  ...device,
  location: { name: device.locationName, lat: device.lat, lng: device.lng },
  metadata: { firmwareVersion: device.firmwareVersion, hardwareType: device.hardwareType, ipAddress: device.ipAddress },
  _id: device.id,
});

// ─── GET /api/devices ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const where = req.user.role === 'admin'
      ? { isActive: true }
      : { owner: req.user.id, isActive: true };

    const devices = await prisma.device.findMany({
      where,
      include: {
        template: { select: { name: true, category: true, hardwareType: true, templateId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();
    const devicesWithStatus = devices.map((d) => {
      const obj = formatDevice(d);
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

      const template = await prisma.template.findUnique({ where: { templateId } });
      if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found.' });
      }

      const device = await prisma.device.create({
        data: {
          name,
          description,
          templateId,
          owner: req.user.id,
          authToken: crypto.randomBytes(32).toString('hex'),
          locationName: location?.name || '',
          lat: location?.lat || null,
          lng: location?.lng || null,
          firmwareVersion: metadata?.firmwareVersion || '1.0.0',
          hardwareType: metadata?.hardwareType || 'ESP32',
          ipAddress: metadata?.ipAddress || '',
        },
      });

      // Auto-create virtual pins from template defaults
      const defaultPins = template.defaultPins || [];
      if (defaultPins.length > 0) {
        await prisma.virtualPin.createMany({
          data: defaultPins.map((p, idx) => ({
            deviceId: device.deviceId,
            pinName: `V${idx}`,
            label: p.pinName || `Sensor ${idx}`,
            sensorType: p.sensorType || 'custom',
            unit: p.unit || '',
            minValue: p.minValue ?? 0,
            maxValue: p.maxValue ?? 100,
          })),
        });
      }

      res.status(201).json({
        success: true,
        message: 'Device registered successfully.',
        device: { ...formatDevice(device), authToken: device.authToken },
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
    const { id } = req.params;
    const where = req.user.role === 'admin'
      ? { OR: [{ id }, { deviceId: id }], isActive: true }
      : { OR: [{ id }, { deviceId: id }], owner: req.user.id, isActive: true };

    const device = await prisma.device.findFirst({
      where,
      include: {
        template: { select: { name: true, category: true, hardwareType: true, templateId: true } },
      },
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const virtualPins = await prisma.virtualPin.findMany({
      where: { deviceId: device.deviceId, isActive: true },
    });

    res.json({ success: true, device: formatDevice(device), virtualPins });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET /api/devices/:id/token ───────────────────────────────────────────────
router.get('/:id/token', async (req, res) => {
  try {
    const { id } = req.params;
    const device = await prisma.device.findFirst({
      where: { OR: [{ id }, { deviceId: id }], owner: req.user.id, isActive: true },
    });

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
    const { id } = req.params;
    const device = await prisma.device.findFirst({
      where: { OR: [{ id }, { deviceId: id }], owner: req.user.id, isActive: true },
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const { name, description, location, metadata, dashboardLayout } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (location?.name !== undefined) updateData.locationName = location.name;
    if (location?.lat !== undefined) updateData.lat = location.lat;
    if (location?.lng !== undefined) updateData.lng = location.lng;
    if (metadata?.firmwareVersion) updateData.firmwareVersion = metadata.firmwareVersion;
    if (metadata?.hardwareType) updateData.hardwareType = metadata.hardwareType;
    if (metadata?.ipAddress !== undefined) updateData.ipAddress = metadata.ipAddress;
    if (dashboardLayout !== undefined) updateData.dashboardLayout = dashboardLayout;

    const updated = await prisma.device.update({ where: { id: device.id }, data: updateData });

    const io = req.app.get('io');
    if (io && dashboardLayout !== undefined) {
      io.to(`device:${device.deviceId}`).emit('layout_updated', {
        deviceId: device.deviceId,
        dashboardLayout,
      });
    }

    res.json({ success: true, message: 'Device updated.', device: formatDevice(updated) });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── POST /api/devices/:id/regenerate-token ───────────────────────────────────
router.post('/:id/regenerate-token', async (req, res) => {
  try {
    const { id } = req.params;
    const device = await prisma.device.findFirst({
      where: { OR: [{ id }, { deviceId: id }], owner: req.user.id, isActive: true },
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    await prisma.device.update({ where: { id: device.id }, data: { authToken: newToken } });

    res.json({
      success: true,
      message: 'Auth token regenerated. Update your device firmware.',
      authToken: newToken,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── DELETE /api/devices/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const device = await prisma.device.findFirst({
      where: { OR: [{ id }, { deviceId: id }], owner: req.user.id },
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    await prisma.device.update({
      where: { id: device.id },
      data: { isActive: false, status: 'inactive' },
    });

    res.json({ success: true, message: 'Device deleted successfully.' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
