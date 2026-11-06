/**
 * Dedicated Financial Audit Logger for JB GROUP
 * Records tamper-evident audit records into FinancialAuditLog in PostgreSQL.
 */

const { pool } = require('../prisma');

const sanitizePayload = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  const sanitized = { ...obj };
  const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'apiKey', 'tokenHash'];
  for (const k of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof sanitized[k] === 'object' && sanitized[k] !== null) {
      sanitized[k] = sanitizePayload(sanitized[k]);
    }
  }
  return sanitized;
};

/**
 * Log financial event to FinancialAuditLog
 */
const logFinancialAudit = async ({
  action,
  entityType,
  entityId,
  amount = null,
  branchId = null,
  req = null,
  actor = null,
  previousState = null,
  newState = null,
  reason = null
}) => {
  try {
    const performedById = actor?.id || req?.user?.id || 1;
    const performedByName = actor?.name || req?.user?.name || req?.user?.email || 'SYSTEM';
    const performedByRole = actor?.role || req?.user?.role || 'SYSTEM';
    const ipAddress = req?.headers?.['x-forwarded-for'] || req?.ip || req?.socket?.remoteAddress || null;

    const safePrev = sanitizePayload(previousState);
    const safeNew = sanitizePayload(newState);

    await pool.query(`
      INSERT INTO "FinancialAuditLog" (
        "action", "entityType", "entityId", "amount", "branchId",
        "performedById", "performedByName", "performedByRole",
        "previousState", "newState", "ipAddress", "reason", "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    `, [
      action,
      entityType,
      entityId,
      amount !== null && amount !== undefined ? Number(amount) : null,
      branchId ? Number(branchId) : null,
      performedById,
      performedByName,
      performedByRole,
      safePrev ? JSON.stringify(safePrev) : null,
      safeNew ? JSON.stringify(safeNew) : null,
      ipAddress,
      reason
    ]);
  } catch (err) {
    console.error('[FinancialAuditLogger] Failed to write financial audit log:', err.message);
  }
};

module.exports = {
  logFinancialAudit
};
