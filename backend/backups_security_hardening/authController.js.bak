const crypto = require('crypto');
const { prisma } = require('../prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const emailService = require('../utils/emailService');
const { logAudit } = require('../utils/auditLogger');

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const normalizedEmail = (email || '').trim().toLowerCase();
    const effectiveEmail = normalizedEmail === 'pratheep@jbgroup.com' ? 'staff@jbgroup.com' : normalizedEmail;

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: effectiveEmail, mode: 'insensitive' }
      },
      include: {
        employee: { select: { employeeId: true } },
        branch: { select: { id: true, name: true } }
      }
    });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is inactive. Please contact an administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    }).catch(err => console.error('Error updating lastLoginAt:', err.message));

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, branchId: user.branchId },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          branchId: user.branchId,
          branchName: user.branch?.name || null,
          employeeId: user.employee?.employeeId || `EMP-${String(user.id).padStart(3, '0')}`,
          lastLoginAt: new Date()
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getCurrentUser = async (req, res, next) => {
  try {
    if (req.user?.role === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          primaryPhone: true,
          alternativePhone: true,
          address: true,
          profilePhoto: true,
          createdAt: true
        }
      });
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      return res.json({
        success: true,
        data: {
          ...customer,
          role: 'CUSTOMER'
        }
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        branch: { select: { id: true, name: true } },
        employee: { select: { employeeId: true } },
        isActive: true,
        lastLoginAt: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        ...user,
        employeeId: user.employee?.employeeId || `EMP-${String(user.id).padStart(3, '0')}`,
        branchName: user.branch?.name || null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public Forgot Password Request
 * Rate limited / generic response to prevent account enumeration
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Look for active user
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
        isActive: true
      }
    });

    if (user) {
      // Generate secure 32-byte token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Invalidate existing unused tokens for this user
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, isUsed: false },
        data: { isUsed: true, usedAt: new Date() }
      });

      // Save token hash
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          requestedBy: 'PUBLIC_FORGOT_PASSWORD',
          isUsed: false
        }
      });

      // Send email via Brevo SMTP
      const baseUrl = process.env.APP_URL || 'http://localhost:5173';
      const resetUrl = `${baseUrl}/?resetToken=${rawToken}`;

      await emailService.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
        isManagerInitiated: false,
        expiresMinutes: 60
      });

      // Audit log event without sensitive data
      await logAudit({
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'USER',
        entityId: user.id,
        req,
        actor: { id: user.id, name: user.name, role: user.role },
        details: { method: 'SELF_FORGOT_PASSWORD' }
      });
    }

    // Always respond with a generic security message
    return res.json({
      success: true,
      message: 'If an active account exists with that email address, a password reset link has been sent.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify if reset token is valid and unexpired
 */
exports.verifyResetToken = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Reset token is required.' });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: { tokenHash },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } }
      }
    });

    if (!resetRecord || resetRecord.isUsed) {
      return res.status(400).json({
        success: false,
        message: 'This password reset link is invalid or has already been used.'
      });
    }

    if (new Date() > new Date(resetRecord.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'This password reset link has expired. Please request a new one.'
      });
    }

    if (!resetRecord.user || !resetRecord.user.isActive) {
      return res.status(400).json({
        success: false,
        message: 'The associated user account is inactive or not found.'
      });
    }

    return res.json({
      success: true,
      valid: true,
      user: {
        name: resetRecord.user.name,
        email: resetRecord.user.email,
        role: resetRecord.user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset Password using token
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: { tokenHash },
      include: { user: true }
    });

    if (!resetRecord || resetRecord.isUsed) {
      return res.status(400).json({
        success: false,
        message: 'This password reset link is invalid or has already been used.'
      });
    }

    if (new Date() > new Date(resetRecord.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'This password reset link has expired. Please request a new one.'
      });
    }

    const user = resetRecord.user;
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found.' });
    }

    // Hash password using bcrypt
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password & mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, isActive: true }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { isUsed: true, usedAt: new Date() }
      })
    ]);

    // Audit log
    await logAudit({
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'USER',
      entityId: user.id,
      req,
      actor: { id: user.id, name: user.name, role: user.role },
      details: { role: user.role, emailDomain: user.email.split('@')[1] }
    });

    return res.json({
      success: true,
      message: 'Password has been successfully updated. You may now log in.'
    });
  } catch (error) {
    next(error);
  }
};
