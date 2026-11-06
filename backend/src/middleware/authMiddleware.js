const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma');

/**
 * Middleware: Verify JWT token and attach live, verified user state from database.
 * Rejects inactive users immediately, refreshes live role & branchId,
 * handles customer portal tokens, and fails closed with HTTP 503 on database errors.
 * Never accepts tokens through query parameters.
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && (
    authHeader.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : authHeader.split(' ')[1]
  );

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
  }

  try {
    // 1. Customer Portal Token
    if (decoded.role === 'CUSTOMER') {
      const custId = parseInt(decoded.id || decoded.customerId, 10);
      if (isNaN(custId)) {
        return res.status(401).json({ success: false, message: 'Invalid customer token payload.' });
      }

      const customer = await prisma.customer.findUnique({
        where: { id: custId },
        select: { id: true, name: true, email: true, primaryPhone: true }
      });

      if (!customer) {
        return res.status(401).json({ success: false, message: 'Customer account not found or revoked.' });
      }

      req.user = {
        id: customer.id,
        customerId: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.primaryPhone,
        role: 'CUSTOMER'
      };
      return next();
    }

    // 2. Staff / Management Token
    const staffId = parseInt(decoded.id, 10);
    if (isNaN(staffId)) {
      return res.status(401).json({ success: false, message: 'Invalid staff token payload.' });
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: staffId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          branchId: true,
          isActive: true
        }
      });
    } catch (transientErr) {
      // Retry once on transient Neon serverless socket wakeups
      await new Promise(res => setTimeout(res, 350));
      user = await prisma.user.findUnique({
        where: { id: staffId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          branchId: true,
          isActive: true
        }
      });
    }

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is inactive or revoked.' });
    }

    // Refresh dynamic live role and branchId from current database record
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      isActive: user.isActive
    };
    return next();
  } catch (dbError) {
    console.error('Database verification error in authMiddleware:', dbError.message);
    // Fail closed on database or network failure
    return res.status(503).json({
      success: false,
      message: 'Authentication service temporarily unavailable.'
    });
  }
};

/**
 * Middleware: Restrict access to specified roles.
 * SUPER_ADMIN always passes.
 * Usage: authorizeRoles('ADMIN', 'STAFF')
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    // SUPER_ADMIN bypasses all role restrictions
    if (req.user.role === 'SUPER_ADMIN') return next();

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}`
      });
    }
    next();
  };
};

module.exports = { authenticateToken, authorizeRoles };
