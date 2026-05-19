const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { deviceAuth } = require('../middleware/auth');
const { protect } = require('../middleware/auth');
const { processAlerts } = require('../utils/alertEngine');

// ─── POST /api/data/publish ───────────────────────────────────────────────────
router.post('/publish', deviceAuth, async (req, res) => {
  try {
    const { virtual_pins, timestamp } = req.body;
    const device = req.device;

    if (!virtual_pins || typeof virtual_pins !== 'object') {
      return res.status(400).json({ success: false, message: 'virtual_pins object is required.' });
    }

    const io = req.app.get('io');
    const dataTimestamp = timestamp ? new Date(timestamp) : new Date();
    const savedData = [];

    for (const [pin, value] of Object.entries(virtual_pins)) {
      const pinName = pin.toUpperCase();
      const numericValue = parseFloat(value);
      if (isNaN(numericValue)) continue;

      // Find or create virtual pin
      let vPin = await prisma.virtualPin.findUnique({
        where: { deviceId_pinName: { deviceId: device.deviceId, pinName } },
      });

      if (!vPin) {
        vPin = await prisma.virtualPin.create({
          data: { deviceId: device.deviceId, pinName, label: pinName, sensorType: 'custom' },
        });
      }

      // Update current value
      await prisma.virtualPin.update({
        where: { id: vPin.id },
        data: { currentValue: numericValue, lastUpdated: dataTimestamp },
      });

      // Save history
      await prisma.sensorData.create({
        data: {
          deviceId: device.deviceId,
          pin: pinName,
          value: numericValue,
          sensorType: vPin.sensorType,
          unit: vPin.unit || '',
          timestamp: dataTimestamp,
        },
      });

      savedData.push({ pin: pinName, value: numericValue });

      // Broadcast real-time update via WebSocket
      if (io) {
        const payload = {
          deviceId: device.deviceId,
          deviceName: device.name,
          pin: pinName,
          value: numericValue,
          unit: vPin.unit,
          sensorType: vPin.sensorType,
          timestamp: dataTimestamp.toISOString(),
        };
        io.to(`device:${device.deviceId}`).emit('sensor_data', payload);
        io.to(`user:${device.owner}`).emit('sensor_data', payload);
      }

      // Run alert engine
      await processAlerts(io, device.deviceId, device.name, pinName, numericValue);
    }

    res.json({
      success: true,
      message: `Data published for ${savedData.length} pin(s).`,
      data: savedData,
      timestamp: dataTimestamp.toISOString(),
    });
  } catch (error) {
    console.error('Publish data error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET /api/data/latest/:deviceId ──────────────────────────────────────────
router.get('/latest/:deviceId', protect, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const whereDevice = req.user.role === 'admin'
      ? { deviceId, isActive: true }
      : { deviceId, owner: req.user.id, isActive: true };

    const device = await prisma.device.findFirst({ where: whereDevice });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const virtualPins = await prisma.virtualPin.findMany({
      where: { deviceId, isActive: true },
    });

    const latestData = virtualPins.map((vp) => ({
      pin: vp.pinName,
      label: vp.label,
      value: vp.currentValue,
      unit: vp.unit,
      sensorType: vp.sensorType,
      minValue: vp.minValue,
      maxValue: vp.maxValue,
      color: vp.color,
      lastUpdated: vp.lastUpdated,
    }));

    const isOnline = device.lastSeen && Date.now() - new Date(device.lastSeen).getTime() < 5 * 60 * 1000;

    res.json({
      success: true,
      deviceId,
      deviceName: device.name,
      status: isOnline ? 'online' : 'offline',
      lastSeen: device.lastSeen,
      data: latestData,
    });
  } catch (error) {
    console.error('Get latest data error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET /api/data/history/:deviceId ─────────────────────────────────────────
router.get('/history/:deviceId', protect, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { pin, from, to, limit = 100 } = req.query;

    const whereDevice = req.user.role === 'admin'
      ? { deviceId, isActive: true }
      : { deviceId, owner: req.user.id, isActive: true };

    const device = await prisma.device.findFirst({ where: whereDevice });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const where = { deviceId };
    if (pin) where.pin = pin.toUpperCase();
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) where.timestamp.lte = new Date(to);
    }

    const data = await prisma.sensorData.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: Math.min(parseInt(limit), 1000),
    });

    res.json({ success: true, deviceId, count: data.length, data });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
