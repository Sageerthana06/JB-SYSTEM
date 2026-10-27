const { pool } = require('../prisma');

/**
 * Clean details payload to ensure no sensitive credentials or tokens are ever logged
 */
const sanitizeDetails = (details) => {
  if (!details || typeof details !== 'object') return {};
  const sanitized = { ...details };
  const sensitiveKeys = ['password', 'plainPassword', 'token', 'resetToken', 'tokenHash', 'secret', 'authorization', 'apiKey'];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeDetails(sanitized[key]);
    }
  }
  return sanitized;
};

/**
 * Record an audit log event
 *
 * @param {Object} options
 * @param {string} options.action - e.g. 'USER_CREATED', 'USER_LINKED', 'ROLE_CHANGED', 'USER_DEACTIVATED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED'
 * @param {string} options.entityType - 'USER' or 'EMPLOYEE'
 * @param {number} [options.entityId] - ID of target User/Employee
 * @param {Object} [options.req] - Express request object for actor info & IP
 * @param {Object} [options.actor] - Optional override actor { id, name, role }
 * @param {Object} [options.details] - Metadata details (sanitized)
 */
exports.logAudit = async ({
  action,
  entityType = 'USER',
  entityId = null,
  req = null,
  actor = null,
  details = {}
}) => {
  try {
    const userId = actor?.id || req?.user?.id || null;
    const userName = actor?.name || req?.user?.name || req?.user?.email || 'SYSTEM';
    const userRole = actor?.role || req?.user?.role || 'SYSTEM';
    const ipAddress = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || null;

    const safeDetails = sanitizeDetails(details);

    // 1. Insert into AuditLog table
    await pool.query(`
      INSERT INTO "AuditLog" ("action", "entityType", "entityId", "userId", "userName", "userRole", "details", "ipAddress", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [action, entityType, entityId, userId, userName, userRole, JSON.stringify(safeDetails), ipAddress]);

    // 2. Also record in InventoryAuditLog for backward compatibility if table exists
    try {
      await pool.query(`
        INSERT INTO "InventoryAuditLog" ("action", "entityType", "entityId", "userId", "userName", "userRole", "details", "ipAddress", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [action, entityType, entityId, userId, userName, userRole, JSON.stringify(safeDetails), ipAddress]);
    } catch (_) {}

  } catch (error) {
    console.error('[AuditLogger] Failed to write audit log:', error.message);
  }
};
