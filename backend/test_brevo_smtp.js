const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSMTP() {
  console.log("Testing SMTP Connection...");
  
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("Missing SMTP credentials in .env");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: process.env.SMTP_PORT || 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: 'sthana249@gmail.com', // test email from screenshot
      subject: 'SMTP Integration Test - JB SYSTEM',
      text: 'This is a test email to verify the Brevo SMTP integration is working correctly.'
    });
    
    console.log("Success! Test email sent. Message ID:", info.messageId);
  } catch (error) {
    console.error("SMTP Error encountered:");
    if (error.responseCode) {
      console.error(`Response Code: ${error.responseCode}`);
    }
    if (error.command) {
      console.error(`Failed Command: ${error.command}`);
    }
    // Mask the stack and sensitive details
    console.error("Error Message:", error.message);
  }
}

testSMTP();
