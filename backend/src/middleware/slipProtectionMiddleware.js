/**
 * Payment Slip Protection Middleware — JB GROUP / Bella Design ERP
 * Intercepts requests to /uploads to ensure bank deposit slips (Payment.slipImage)
 * are strictly authenticated and authorized by role and branch.
 * Garment designs, catalogue items, and general media remain publicly accessible.
 * Fails closed with HTTP 503 on any database errors.
 */

const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../prisma');

const protectPaymentSlips = async (req, res, next) => {
  // Only intercept GET and HEAD media requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  try {
    const requestedPath = req.path;
    const filename = path.basename(requestedPath).trim();

    if (!filename || filename === '.' || filename === '/') {
      return next();
    }

    // Path traversal defense
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, message: 'Invalid file path.' });
    }

    // Check if this filename is registered as a Payment slip image
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { slipImage: { endsWith: filename } },
          { slipImage: filename }
        ]
      },
      select: {
        id: true,
        slipImage: true,
        order: {
          select: {
            id: true,
            branchId: true,
            customerId: true
          }
        }
      }
    });

    // If file is not a payment slip (e.g. Garment design reference photo, fabric swatch),
    // allow express.static to serve it publicly
    if (!payment) {
      return next();
    }

    // --- PROTECTED PAYMENT SLIP ACCESS CONTROL ---
    // Extract Bearer token strictly from Authorization header (never from query string)
    const authHeader = req.headers['authorization'];
    const token = authHeader && (
      authHeader.startsWith('Bearer ')
        ? authHeader.substring(7).trim()
        : authHeader.split(' ')[1]
    );

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Payment slips contain confidential banking data.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired authentication token.'
      });
    }

    // Role and branch authorization
    if (decoded.role === 'CUSTOMER') {
      const custId = parseInt(decoded.id || decoded.customerId, 10);
      if (!payment.order || payment.order.customerId !== custId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view payment slips for your own orders.'
        });
      }
    } else {
      // Staff / Management user verification
      const staffId = parseInt(decoded.id, 10);
      if (isNaN(staffId)) {
        return res.status(401).json({ success: false, message: 'Invalid token payload.' });
      }

      const user = await prisma.user.findUnique({
        where: { id: staffId },
        select: { id: true, role: true, branchId: true, isActive: true }
      });

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is inactive or revoked.'
        });
      }

      const isSuperAdmin = ['SUPER_ADMIN', 'CEO'].includes(user.role);
      const isAdmin = user.role === 'ADMIN';
      const isManager = user.role === 'MANAGER';

      if (isSuperAdmin || isAdmin) {
        // Company-wide authorized access
      } else if (isManager) {
        // Manager: strictly restricted to assigned branch
        if (!payment.order || !payment.order.branchId || Number(payment.order.branchId) !== Number(user.branchId)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. This payment slip belongs to another branch.'
          });
        }
      } else {
        // Tailors, Cutting, Embroidery, unverified roles: deny access
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have permission to view payment slips.'
        });
      }
    }

    // Authorized: resolve file path safely
    const fullFilePath = path.join(__dirname, '../../uploads', requestedPath);

    if (!fs.existsSync(fullFilePath)) {
      return res.status(404).json({ success: false, message: 'Payment slip file not found on disk.' });
    }

    // Disallow caching of sensitive financial documents
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.sendFile(path.resolve(fullFilePath));

  } catch (error) {
    console.error('Database/Security error in slipProtectionMiddleware:', error.message);
    // Fail closed on database errors
    return res.status(503).json({
      success: false,
      message: 'Security verification service temporarily unavailable.'
    });
  }
};

module.exports = {
  protectPaymentSlips
};

