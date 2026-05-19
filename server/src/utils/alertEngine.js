const prisma = require('../db/prisma');
const { sendAlertEmail } = require('./emailService');

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

const processAlerts = async (io, deviceId, deviceName, pin, value) => {
  try {
    const alerts = await prisma.alert.findMany({
      where: { deviceId, pin: pin.toUpperCase(), isActive: true },
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
      const history = Array.isArray(alert.history) ? alert.history : [];
      history.push({ triggeredAt: new Date(), value, notified: true });
      const trimmedHistory = history.slice(-50);

      await prisma.alert.update({
        where: { id: alert.id },
        data: {
          lastTriggered: new Date(),
          triggerCount: { increment: 1 },
          history: trimmedHistory,
        },
      });

      const alertPayload = {
        alertId: alert.id,
        alertName: alert.name,
        deviceId,
        deviceName,
        pin,
        condition: alert.condition,
        threshold: alert.threshold,
        currentValue: value,
        message: alert.message || `${pin} ${alert.condition} ${alert.threshold} (current: ${value})`,
        triggeredAt: new Date(),
      };

      if (io) {
        io.to(`device:${deviceId}`).emit('alert_triggered', alertPayload);
        io.to(`user:${alert.owner}`).emit('alert_triggered', alertPayload);
      }

      const notificationType = Array.isArray(alert.notificationType) ? alert.notificationType : [];
      if (notificationType.includes('email')) {
        const owner = await prisma.user.findUnique({ where: { id: alert.owner } });
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
