/**
 * Inventory & Material Management — central permission matrix (backend-enforced).
 *
 * SUPER_ADMIN (CEO) always passes every check (same convention as authorizeRoles).
 * ADMIN and CASHIER roles are intentionally NOT granted inventory access.
 *
 * Approval permissions are configurable via environment variables without code changes:
 *   INVENTORY_PO_APPROVER_ROLES=MANAGER          (comma separated, CEO always allowed)
 *   INVENTORY_ADJUST_ROLES=MANAGER
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
  VIEW_ITEMS:          ['MANAGER', 'STAFF', ...PRODUCTION],
  VIEW_COSTS:          ['MANAGER', 'STAFF'],          // production roles never see unit cost / valuation
  MANAGE_ITEMS:        ['MANAGER', 'STAFF'],
  DEACTIVATE_ITEMS:    ['MANAGER'],

  // Stock control
  STOCK_RECEIVE:       ['MANAGER', 'STAFF'],          // manual stock-in & generic returns
  STOCK_ISSUE:         ['MANAGER', 'STAFF'],          // non-order issues
  STOCK_WRITE_OFF:     ['MANAGER', 'STAFF'],          // wastage / damaged (reason mandatory)
  STOCK_ADJUST:        fromEnv('INVENTORY_ADJUST_ROLES', ['MANAGER']),

  // Tailoring order integration
  MATERIAL_REQUEST:    ['MANAGER', 'STAFF', ...PRODUCTION],
  MATERIAL_ISSUE:      ['MANAGER', 'STAFF'],          // issue / return / wastage / close
  VIEW_ALL_REQUESTS:   ['MANAGER', 'STAFF'],          // production roles only see their own

  // Purchasing
  SUPPLIER_MANAGE:     ['MANAGER', 'STAFF'],
  PO_CREATE:           ['MANAGER', 'STAFF'],
  PO_APPROVE:          fromEnv('INVENTORY_PO_APPROVER_ROLES', ['MANAGER']),
  PO_RECEIVE:          ['MANAGER', 'STAFF'],

  // Reporting / audit
  VIEW_REPORTS:        ['MANAGER', 'STAFF'],
  VIEW_AUDIT:          ['MANAGER']
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
