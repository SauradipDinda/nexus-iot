const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { protect } = require('../middleware/auth');

router.use(protect);

// ─── GET /api/analytics/summary/:deviceId ────────────────────────────────────
router.get('/summary/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { from, to } = req.query;

    const whereDevice = req.user.role === 'admin'
      ? { deviceId, isActive: true }
      : { deviceId, owner: req.user.id, isActive: true };

    const device = await prisma.device.findFirst({ where: whereDevice });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const timestampFilter = {};
    if (from) timestampFilter.gte = new Date(from);
    if (to) timestampFilter.lte = new Date(to);

    const whereData = { deviceId, ...(from || to ? { timestamp: timestampFilter } : {}) };

    // Get all sensor data for this device in range
    const sensorData = await prisma.sensorData.findMany({ where: whereData });

    // Calculate stats per pin
    const pinMap = {};
    for (const record of sensorData) {
      if (!pinMap[record.pin]) {
        pinMap[record.pin] = { values: [], latest: record.value, latestTime: record.timestamp };
      }
      pinMap[record.pin].values.push(record.value);
      if (record.timestamp > pinMap[record.pin].latestTime) {
        pinMap[record.pin].latest = record.value;
        pinMap[record.pin].latestTime = record.timestamp;
      }
    }

    const pinStats = Object.entries(pinMap).map(([pin, data]) => ({
      id: pin,
      min: Math.min(...data.values),
      max: Math.max(...data.values),
      avg: data.values.reduce((a, b) => a + b, 0) / data.values.length,
      count: data.values.length,
      latest: data.latest,
      latestTime: data.latestTime,
    })).sort((a, b) => a.id.localeCompare(b.id));

    const totalDataPoints = sensorData.length;
    const alertCount = await prisma.alert.count({ where: { deviceId, isActive: true } });
    const triggeredAlerts = await prisma.alert.count({ where: { deviceId, triggerCount: { gt: 0 } } });

    res.json({
      success: true,
      deviceId,
      deviceName: device.name,
      totalDataPoints,
      alertCount,
      triggeredAlerts,
      pinStats,
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET /api/analytics/chart/:deviceId ──────────────────────────────────────
router.get('/chart/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { pin, from, to, limit = 200 } = req.query;

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
      take: Math.min(parseInt(limit), 500),
    });

    const formatted = data.map((d) => ({
      pin: d.pin,
      value: Math.round(d.value * 100) / 100,
      timestamp: d.timestamp,
    }));

    res.json({ success: true, deviceId, data: formatted });
  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET /api/analytics/export/:deviceId ─────────────────────────────────────
router.get('/export/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { pin, from, to } = req.query;

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
      take: 10000,
    });

    const csvRows = ['Timestamp,Device ID,Pin,Value,Sensor Type,Unit'];
    data.forEach((row) => {
      csvRows.push(
        `${new Date(row.timestamp).toISOString()},${row.deviceId},${row.pin},${row.value},${row.sensorType},${row.unit}`
      );
    });

    const csvContent = csvRows.join('\n');
    const filename = `${deviceId}_${pin || 'all'}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET /api/analytics/dashboard-stats ──────────────────────────────────────
router.get('/dashboard-stats', async (req, res) => {
  try {
    const ownerFilter = req.user.role === 'admin' ? {} : { owner: req.user.id };

    const totalDevices = await prisma.device.count({ where: { ...ownerFilter, isActive: true } });

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineDevices = await prisma.device.count({
      where: { ...ownerFilter, isActive: true, lastSeen: { gte: fiveMinutesAgo } },
    });

    const totalAlerts = await prisma.alert.count({ where: { ...ownerFilter, isActive: true } });

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentDataPoints = await prisma.sensorData.count({
      where: { timestamp: { gte: yesterday } },
    });

    res.json({
      success: true,
      stats: {
        totalDevices,
        onlineDevices,
        offlineDevices: totalDevices - onlineDevices,
        totalAlerts,
        recentDataPoints,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
