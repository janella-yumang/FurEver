const nodemailer = require('nodemailer');
require('dotenv').config();

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
  });

  try {
    await transporter.verify();
    console.log('SMTP connection OK');
  } catch (err) {
    console.log('SMTP verify FAILED:', err.message);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: '"FurEver Pet Shop" <' + process.env.SMTP_USER + '>',
      to: 'erpemem.pascua@gmail.com',
      subject: 'FurEver Verification Test - ' + new Date().toLocaleTimeString(),
      html: '<h1>Test Verification</h1><p>Code: <b>123456</b></p><p>If you see this, verification emails will work!</p>',
    });
    console.log('Email SENT successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
  } catch (err) {
    console.log('Send FAILED:', err.message);
  }
}

main();
