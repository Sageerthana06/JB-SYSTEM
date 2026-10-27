const nodemailer = require('nodemailer');

/**
 * Configure Nodemailer transport with Brevo SMTP credentials
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false, // 587 uses STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

/**
 * Helper to get clean FROM email header
 */
const getFromAddress = () => {
  const rawFrom = process.env.SMTP_FROM || 'jbgrouptrinco@gmail.com';
  if (rawFrom.includes('<') && rawFrom.includes('>')) {
    return rawFrom;
  }
  // If format is like "Email jbgrouptrinco@gmail.com" or just email
  const match = rawFrom.match(/[\w.-]+@[\w.-]+\.\w+/);
  const email = match ? match[0] : 'jbgrouptrinco@gmail.com';
  return `"JB GROUP System" <${email}>`;
};

/**
 * Send Password Reset Link via Brevo SMTP
 */
exports.sendPasswordResetEmail = async ({ to, name, resetUrl, isManagerInitiated = false, expiresMinutes = 60 }) => {
  try {
    const transporter = createTransporter();
    const from = getFromAddress();

    const subject = isManagerInitiated
      ? 'Password Reset Request by Administrator — JB GROUP'
      : 'Password Reset Request — JB GROUP System';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { background: #071324; padding: 28px 24px; text-align: center; }
          .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 1px; }
          .header p { margin: 6px 0 0 0; color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; }
          .content { padding: 32px 28px; }
          .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0; }
          .btn-container { text-align: center; margin: 30px 0; }
          .btn { background: #0052cc; color: #ffffff !important; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(0, 82, 204, 0.3); }
          .link-fallback { background: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 12px; word-break: break-all; color: #0f172a; border: 1px solid #cbd5e1; margin-top: 10px; }
          .warning { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px 14px; border-radius: 8px; font-size: 12px; line-height: 1.5; margin-top: 24px; }
          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>JB GROUP</h1>
            <p>Enterprise Management System</p>
          </div>
          <div class="content">
            <div class="greeting">Hello ${name || 'Team Member'},</div>
            <p class="text">
              ${isManagerInitiated
                ? 'An authorized manager or CEO has requested a secure password reset for your JB GROUP account.'
                : 'A password reset request was received for your JB GROUP account.'}
            </p>
            <p class="text">
              Click the button below to choose a new secure password. This single-use link will expire in <strong>${expiresMinutes} minutes</strong>.
            </p>
            <div class="btn-container">
              <a href="${resetUrl}" target="_blank" class="btn">Reset My Password</a>
            </div>
            <p class="text" style="font-size: 12px; color: #64748b;">
              If the button does not work, copy and paste this link into your browser:
            </p>
            <div class="link-fallback">${resetUrl}</div>
            <div class="warning">
              <strong>Security Notice:</strong> If you did not request this password reset, please notify your branch manager or system administrator immediately.
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} JB GROUP &bull; Secure Enterprise Portal
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Hello ${name || 'Team Member'},

${isManagerInitiated ? 'An authorized manager or CEO has requested a password reset for your JB GROUP account.' : 'A password reset request was received for your JB GROUP account.'}

To choose a new password, open this secure link in your browser:
${resetUrl}

This link is single-use and will expire in ${expiresMinutes} minutes.

If you did not request this, please contact your manager immediately.

JB GROUP Enterprise Management System
    `.trim();

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html
    });

    console.log(`[EmailService] Password reset email sent to ${to}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EmailService] Failed to send password reset email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send Account Setup / Welcome Link via Brevo SMTP
 */
exports.sendAccountSetupEmail = async ({ to, name, setupUrl, role, branchName, expiresMinutes = 60 }) => {
  try {
    const transporter = createTransporter();
    const from = getFromAddress();

    const subject = 'Welcome to JB GROUP — Set Up Your Login Password';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { background: #071324; padding: 28px 24px; text-align: center; }
          .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 1px; }
          .header p { margin: 6px 0 0 0; color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; }
          .content { padding: 32px 28px; }
          .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
          .text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }
          .badge-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin: 18px 0; }
          .badge-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
          .badge-label { color: #64748b; font-weight: 600; }
          .badge-val { color: #0f172a; font-weight: 700; }
          .btn-container { text-align: center; margin: 28px 0; }
          .btn { background: #d90429; color: #ffffff !important; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(217, 4, 41, 0.3); }
          .link-fallback { background: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 12px; word-break: break-all; color: #0f172a; border: 1px solid #cbd5e1; margin-top: 10px; }
          .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>JB GROUP</h1>
            <p>Welcome to the Team</p>
          </div>
          <div class="content">
            <div class="greeting">Welcome, ${name || 'Team Member'}!</div>
            <p class="text">
              Your login account for the JB GROUP Business Management System has been created.
            </p>
            <div class="badge-box">
              <div class="badge-row">
                <span class="badge-label">Assigned Role:</span>
                <span class="badge-val">${role}</span>
              </div>
              <div class="badge-row" style="margin-bottom: 0;">
                <span class="badge-label">Branch:</span>
                <span class="badge-val">${branchName || 'Main Branch'}</span>
              </div>
            </div>
            <p class="text">
              To activate your account and establish your secure password, click the button below within the next <strong>${expiresMinutes} minutes</strong>:
            </p>
            <div class="btn-container">
              <a href="${setupUrl}" target="_blank" class="btn">Set Up Your Password</a>
            </div>
            <p class="text" style="font-size: 12px; color: #64748b;">
              Or copy this link into your browser:
            </p>
            <div class="link-fallback">${setupUrl}</div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} JB GROUP &bull; Confidential &amp; Protected
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to JB GROUP, ${name}!

Your login account has been created with role: ${role} (${branchName || 'Main Branch'}).
To set up your password, visit:
${setupUrl}

This setup link will expire in ${expiresMinutes} minutes.

JB GROUP Business Management System
    `.trim();

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html
    });

    console.log(`[EmailService] Account setup email sent to ${to}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EmailService] Failed to send setup email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};
