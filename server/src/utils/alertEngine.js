const Alert = require('../models/Alert');
const User = require('../models/User');
const { sendAlertEmail } = require('./emailService');

/**
 * Evaluate a condition against a value
 */
const evaluateCondition = (value, condition, threshold) => {
  switch (condition) {
    case '>':  return value > threshold;
    case '<':  return value < threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '==': return value === threshold;
    case '!=': return value !== threshold;
    default:   return false;
  }
};

/**
 * Process incoming sensor data against all active alerts for a device
 * @param {Object} io - Socket.io instance
 * @param {string} deviceId - Device ID string
 * @param {string} deviceName - Device name
 * @param {string} pin - Virtual pin name (e.g., "V0")
 * @param {number} value - Sensor value
 */
const processAlerts = async (io, deviceId, deviceName, pin, value) => {
  try {
    // Find all active alerts for this device and pin
    const alerts = await Alert.find({
      deviceId,
      pin: pin.toUpperCase(),
      isActive: true,
    });

    for (const alert of alerts) {
      const triggered = evaluateCondition(value, alert.condition, alert.threshold);

      if (!triggered) continue;

      // Check cooldown
      if (alert.lastTriggered) {
        const cooldownMs = alert.cooldownMinutes * 60 * 1000;
        const timeSinceLast = Date.now() - new Date(alert.lastTriggered).getTime();
        if (timeSinceLast < cooldownMs) continue;
      }

      // Update alert record
      alert.lastTriggered = new Date();
      alert.triggerCount += 1;
      alert.history.push({ triggeredAt: new Date(), value, notified: true });

      // Keep history to last 50 entries
      if (alert.history.length > 50) {
        alert.history = alert.history.slice(-50);
      }

      await alert.save();

      const alertPayload = {
        alertId: alert._id,
        alertName: alert.name,
        deviceId,
        deviceName,
        pin,
        condition: alert.condition,
        threshold: alert.threshold,
        currentValue: value,
        message: alert.message || `${pin} ${alert.condition} ${alert.threshold} (current: ${value})`,
        triggeredAt: alert.lastTriggered,
      };

      // Broadcast alert via WebSocket to device room
      if (io) {
        io.to(`device:${deviceId}`).emit('alert_triggered', alertPayload);
        io.to(`user:${alert.owner.toString()}`).emit('alert_triggered', alertPayload);
      }

      // Send email notification if configured
      if (alert.notificationType.includes('email')) {
        const owner = await User.findById(alert.owner);
        if (owner && owner.email && owner.emailNotifications) {
          await sendAlertEmail({
            to: owner.email,
            deviceName,
            pinName: pin,
            condition: alert.condition,
            threshold: alert.threshold,
            currentValue: value,
            alertName: alert.name,
          });
        }
      }

      console.log(`🚨 Alert triggered: ${alert.name} | ${pin}=${value} ${alert.condition} ${alert.threshold}`);
    }
  } catch (error) {
    console.error('Alert engine error:', error.message);
  }
};

module.exports = { processAlerts, evaluateCondition };
