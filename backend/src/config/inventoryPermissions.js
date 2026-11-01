/**
 * Inventory & Material Management — central permission matrix (backend-enforced).
 *
 * SUPER_ADMIN (CEO) always passes every check (same convention as authorizeRoles).
 * ADMIN and MANAGER are management roles with full inventory management authority.
 * CASHIER role is intentionally NOT granted inventory access.
 *
 * Approval permissions are configurable via environment variables without code changes:
 *   INVENTORY_PO_APPROVER_ROLES=ADMIN,MANAGER     (comma separated, CEO always allowed)
 *   INVENTORY_ADJUST_ROLES=ADMIN,MANAGER
 *   INVENTORY_PO_CEO_THRESHOLD=250000            (LKR; POs above this need CEO approval. Empty = no limit)
 */
const fromEnv = (key, fallback) => {
  const raw = process.env[key];
  if (!raw || !raw.trim()) return fallback;
  return raw.split(',').map(r => r.trim().toUpperCase()).filter(Boolean);
};

const PRODUCTION = ['TAILOR', 'CUTTING', 'EMBROIDERY'];

const INVENTORY_PERMISSIONS = {
  // Catalogue / visibility
  VIEW_ITEMS:          ['ADMIN', 'MANAGER', 'STAFF', ...PRODUCTION],
  VIEW_COSTS:          ['ADMIN', 'MANAGER', 'STAFF'],          // production roles never see unit cost / valuation
  MANAGE_ITEMS:        ['ADMIN', 'MANAGER', 'STAFF'],
  DEACTIVATE_ITEMS:    ['ADMIN', 'MANAGER'],

  // Stock control
  STOCK_RECEIVE:       ['ADMIN', 'MANAGER', 'STAFF'],          // manual stock-in & generic returns
  STOCK_ISSUE:         ['ADMIN', 'MANAGER', 'STAFF'],          // non-order issues
  STOCK_WRITE_OFF:     ['ADMIN', 'MANAGER', 'STAFF'],          // wastage / damaged (reason mandatory)
  STOCK_ADJUST:        fromEnv('INVENTORY_ADJUST_ROLES', ['ADMIN', 'MANAGER']),

  // Tailoring order integration
  MATERIAL_REQUEST:    ['ADMIN', 'MANAGER', 'STAFF', ...PRODUCTION],
  MATERIAL_ISSUE:      ['ADMIN', 'MANAGER', 'STAFF'],          // issue / return / wastage / close
  VIEW_ALL_REQUESTS:   ['ADMIN', 'MANAGER', 'STAFF'],          // production roles only see their own

  // Purchasing
  SUPPLIER_MANAGE:     ['ADMIN', 'MANAGER', 'STAFF'],
  PO_CREATE:           ['ADMIN', 'MANAGER', 'STAFF'],
  PO_APPROVE:          fromEnv('INVENTORY_PO_APPROVER_ROLES', ['ADMIN', 'MANAGER']),
  PO_RECEIVE:          ['ADMIN', 'MANAGER', 'STAFF'],

  // Reporting / audit
  VIEW_REPORTS:        ['ADMIN', 'MANAGER', 'STAFF'],
  VIEW_AUDIT:          ['ADMIN', 'MANAGER']
};

const PO_CEO_THRESHOLD = (() => {
  const v = Number(process.env.INVENTORY_PO_CEO_THRESHOLD);
  return Number.isFinite(v) && v > 0 ? v : null;
})();

const can = (user, action) => {
  if (!user || !user.role) return false;
  const role = String(user.role).trim().toUpperCase();
  if (role === 'SUPER_ADMIN' || role === 'CEO') return true;
  return (INVENTORY_PERMISSIONS[action] || []).includes(role);
};

/** Express middleware: require an inventory permission. */
const requireInv = (action) => (req, res, next) => {
  if (can(req.user, action)) return next();
  return res.status(403).json({
    success: false,
    message: `Access denied. Your role (${req.user?.role || 'unknown'}) cannot perform this inventory action.`
  });
};

/** Flat list sent to the frontend so UI buttons mirror backend rules. */
const capabilitiesFor = (user) =>
  Object.keys(INVENTORY_PERMISSIONS).reduce((acc, k) => { acc[k] = can(user, k); return acc; }, {});

module.exports = { INVENTORY_PERMISSIONS, PO_CEO_THRESHOLD, can, requireInv, capabilitiesFor, PRODUCTION };
