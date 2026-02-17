const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const VirtualPin = require('../models/VirtualPin');
const SensorData = require('../models/SensorData');
const { deviceAuth } = require('../middleware/auth');
const { protect } = require('../middleware/auth');
const { processAlerts } = require('../utils/alertEngine');

// ─── POST /api/data/publish ───────────────────────────────────────────────────
// IoT device publishes sensor data (uses device auth token)
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

    // Process each virtual pin
    for (const [pin, value] of Object.entries(virtual_pins)) {
      const pinName = pin.toUpperCase();
      const numericValue = parseFloat(value);

      if (isNaN(numericValue)) continue;

      // Find or create virtual pin record
      let vPin = await VirtualPin.findOne({ deviceId: device.deviceId, pinName });

      if (!vPin) {
        // Auto-create pin if it doesn't exist
        vPin = await VirtualPin.create({
          device: device._id,
          deviceId: device.deviceId,
          pinName,
          label: pinName,
          sensorType: 'custom',
        });
      }

      // Update current value on virtual pin
      vPin.currentValue = numericValue;
      vPin.lastUpdated = dataTimestamp;
      await vPin.save();

      // Save to sensor data history
      const sensorRecord = await SensorData.create({
        device: device._id,
        deviceId: device.deviceId,
        pin: pinName,
        value: numericValue,
        sensorType: vPin.sensorType,
        unit: vPin.unit,
        timestamp: dataTimestamp,
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
        io.to(`user:${device.owner.toString()}`).emit('sensor_data', payload);
      }

      // Run alert engine for this pin
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
// Get latest values for all pins of a device (dashboard polling)
router.get('/latest/:deviceId', protect, async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Verify ownership
    const device = await Device.findOne({
      deviceId,
      ...(req.user.role !== 'admin' ? { owner: req.user._id } : {}),
      isActive: true,
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const virtualPins = await VirtualPin.find({ deviceId, isActive: true });

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

    // Check device online status
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
// Get historical data for a device/pin
router.get('/history/:deviceId', protect, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { pin, from, to, limit = 100 } = req.query;

    // Verify ownership
    const device = await Device.findOne({
      deviceId,
      ...(req.user.role !== 'admin' ? { owner: req.user._id } : {}),
      isActive: true,
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const query = { deviceId };
    if (pin) query.pin = pin.toUpperCase();

    // Date range filter
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    const data = await SensorData.find(query)
      .sort({ timestamp: -1 })
      .limit(Math.min(parseInt(limit), 1000));

    res.json({
      success: true,
      deviceId,
      count: data.length,
      data: data.reverse(), // Return in chronological order
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
