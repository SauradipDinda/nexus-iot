const express = require('express');
const router = express.Router();
const SensorData = require('../models/SensorData');
const Device = require('../models/Device');
const VirtualPin = require('../models/VirtualPin');
const Alert = require('../models/Alert');
const { protect } = require('../middleware/auth');

router.use(protect);

// ─── GET /api/analytics/summary/:deviceId ────────────────────────────────────
// Get summary stats for a device
router.get('/summary/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { from, to } = req.query;

    const device = await Device.findOne({
      deviceId,
      ...(req.user.role !== 'admin' ? { owner: req.user._id } : {}),
      isActive: true,
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const dateFilter = {};
    if (from || to) {
      dateFilter.timestamp = {};
      if (from) dateFilter.timestamp.$gte = new Date(from);
      if (to) dateFilter.timestamp.$lte = new Date(to);
    }

    // Aggregate stats per pin
    const stats = await SensorData.aggregate([
      { $match: { deviceId, ...dateFilter } },
      {
        $group: {
          _id: '$pin',
          min: { $min: '$value' },
          max: { $max: '$value' },
          avg: { $avg: '$value' },
          count: { $sum: 1 },
          latest: { $last: '$value' },
          latestTime: { $last: '$timestamp' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Total data points
    const totalDataPoints = await SensorData.countDocuments({ deviceId, ...dateFilter });

    // Alert stats
    const alertCount = await Alert.countDocuments({ deviceId, isActive: true });
    const triggeredAlerts = await Alert.countDocuments({ deviceId, triggerCount: { $gt: 0 } });

    res.json({
      success: true,
      deviceId,
      deviceName: device.name,
      totalDataPoints,
      alertCount,
      triggeredAlerts,
      pinStats: stats,
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET /api/analytics/chart/:deviceId ──────────────────────────────────────
// Get time-series data for chart visualization
router.get('/chart/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { pin, from, to, interval = 'hour', limit = 200 } = req.query;

    const device = await Device.findOne({
      deviceId,
      ...(req.user.role !== 'admin' ? { owner: req.user._id } : {}),
      isActive: true,
    });

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    const matchQuery = { deviceId };
    if (pin) matchQuery.pin = pin.toUpperCase();
    if (from || to) {
      matchQuery.timestamp = {};
      if (from) matchQuery.timestamp.$gte = new Date(from);
      if (to) matchQuery.timestamp.$lte = new Date(to);
    }

    // Group by time interval
    let dateGroupFormat;
    switch (interval) {
      case 'minute':
        dateGroupFormat = { year: { $year: '$timestamp' }, month: { $month: '$timestamp' }, day: { $dayOfMonth: '$timestamp' }, hour: { $hour: '$timestamp' }, minute: { $minute: '$timestamp' } };
        break;
      case 'day':
        dateGroupFormat = { year: { $year: '$timestamp' }, month: { $month: '$timestamp' }, day: { $dayOfMonth: '$timestamp' } };
        break;
      default: // hour
        dateGroupFormat = { year: { $year: '$timestamp' }, month: { $month: '$timestamp' }, day: { $dayOfMonth: '$timestamp' }, hour: { $hour: '$timestamp' } };
    }

    const chartData = await SensorData.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { pin: '$pin', time: dateGroupFormat },
          avgValue: { $avg: '$value' },
          minValue: { $min: '$value' },
          maxValue: { $max: '$value' },
          timestamp: { $first: '$timestamp' },
        },
      },
      { $sort: { timestamp: 1 } },
      { $limit: parseInt(limit) },
    ]);

    // Format for chart consumption
    const formatted = chartData.map((d) => ({
      pin: d._id.pin,
      value: Math.round(d.avgValue * 100) / 100,
      min: Math.round(d.minValue * 100) / 100,
      max: Math.round(d.maxValue * 100) / 100,
      timestamp: d.timestamp,
    }));

    res.json({ success: true, deviceId, interval, data: formatted });
  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── GET /api/analytics/export/:deviceId ─────────────────────────────────────
// Export sensor data as CSV
router.get('/export/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { pin, from, to } = req.query;

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
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    const data = await SensorData.find(query).sort({ timestamp: 1 }).limit(10000);

    // Build CSV manually
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
// Get overall stats for the user's dashboard
router.get('/dashboard-stats', async (req, res) => {
  try {
    const ownerQuery = req.user.role === 'admin' ? {} : { owner: req.user._id };

    const totalDevices = await Device.countDocuments({ ...ownerQuery, isActive: true });

    // Online devices (seen in last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineDevices = await Device.countDocuments({
      ...ownerQuery,
      isActive: true,
      lastSeen: { $gte: fiveMinutesAgo },
    });

    const totalAlerts = await Alert.countDocuments({ ...ownerQuery, isActive: true });

    // Data points in last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentDataPoints = await SensorData.countDocuments({
      timestamp: { $gte: yesterday },
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
