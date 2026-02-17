const nodemailer = require('nodemailer');

/**
 * Create reusable transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Send alert notification email
 * @param {Object} options - Email options
 */
const sendAlertEmail = async ({ to, deviceName, pinName, condition, threshold, currentValue, alertName }) => {
  try {
    const transporter = createTransporter();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #0a0e1a; color: #e0e0e0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #00d4ff, #7b2ff7); padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 24px; }
          .body { background: #1a1f35; padding: 30px; border-radius: 0 0 8px 8px; }
          .alert-box { background: #ff4757; border-radius: 8px; padding: 15px; margin: 20px 0; }
          .alert-box h2 { color: white; margin: 0 0 10px 0; }
          .data-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2f45; }
          .label { color: #8892b0; }
          .value { color: #00d4ff; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; color: #8892b0; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ IoT Alert Triggered</h1>
          </div>
          <div class="body">
            <div class="alert-box">
              <h2>🚨 ${alertName}</h2>
              <p style="color: white; margin: 0;">Alert condition has been triggered on your device.</p>
            </div>
            <div class="data-row">
              <span class="label">Device</span>
              <span class="value">${deviceName}</span>
            </div>
            <div class="data-row">
              <span class="label">Virtual Pin</span>
              <span class="value">${pinName}</span>
            </div>
            <div class="data-row">
              <span class="label">Condition</span>
              <span class="value">${pinName} ${condition} ${threshold}</span>
            </div>
            <div class="data-row">
              <span class="label">Current Value</span>
              <span class="value" style="color: #ff4757;">${currentValue}</span>
            </div>
            <div class="data-row">
              <span class="label">Triggered At</span>
              <span class="value">${new Date().toLocaleString()}</span>
            </div>
            <p style="margin-top: 20px; color: #8892b0;">
              Please check your IoT Dashboard for more details and take necessary action.
            </p>
          </div>
          <div class="footer">
            <p>IoT Dashboard Platform | Automated Alert System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'IoT Dashboard <noreply@iotdashboard.com>',
      to,
      subject: `🚨 Alert: ${alertName} triggered on ${deviceName}`,
      html,
    });

    console.log(`✅ Alert email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('❌ Email send error:', error.message);
    return false;
  }
};

/**
 * Send welcome email to new user
 */
const sendWelcomeEmail = async ({ to, name }) => {
  try {
    const transporter = createTransporter();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'IoT Dashboard <noreply@iotdashboard.com>',
      to,
      subject: '🎉 Welcome to IoT Dashboard Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1f35; padding: 30px; border-radius: 8px;">
          <h1 style="color: #00d4ff;">Welcome, ${name}! 🚀</h1>
          <p style="color: #e0e0e0;">Your IoT Dashboard account has been created successfully.</p>
          <p style="color: #8892b0;">Start by creating a device template and registering your first IoT device.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error('❌ Welcome email error:', error.message);
    return false;
  }
};

module.exports = { sendAlertEmail, sendWelcomeEmail };
