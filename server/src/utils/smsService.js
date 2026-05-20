const twilio = require('twilio');

/**
 * Send SMS alert notification
 * @param {Object} options - SMS options
 */
const sendAlertSMS = async ({ to, deviceName, pinName, condition, threshold, currentValue, alertName }) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.log('⚠️ Twilio SMS not configured. Skipping SMS alert.');
      return false;
    }

    const client = twilio(accountSid, authToken);

    const messageBody = `🚨 IoT ALERT: ${alertName}\nDevice: ${deviceName}\nPin: ${pinName}\nCondition: ${condition} ${threshold}\nCurrent: ${currentValue}\nTime: ${new Date().toLocaleTimeString()}`;

    const message = await client.messages.create({
      body: messageBody,
      from: fromNumber,
      to,
    });

    console.log(`✅ Alert SMS sent to ${to} (Message SID: ${message.sid})`);
    return true;
  } catch (error) {
    console.error('❌ SMS send error:', error.message);
    return false;
  }
};

module.exports = { sendAlertSMS };
