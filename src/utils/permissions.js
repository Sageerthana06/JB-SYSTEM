/**
 * Central Permission System — JB GROUP / Bella Design ERP
 *
 * Defines which permissions each role has.
 * Use hasPermission(role, permission) in components and route guards.
 *
 * NEVER duplicate permission logic in individual components.
 */

// Map of role → set of permissions
const ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    'dashboard.view',
    'orders.view', 'orders.create', 'orders.update', 'orders.delete',
    'customers.view', 'customers.create', 'customers.update',
    'production.view', 'production.update',
    'inventory.view', 'inventory.manage',
    'finance.view', 'finance.manage',
    'payroll.view', 'payroll.manage',
    'staff.view', 'staff.manage',
    'reports.view', 'reports.export',
    'settings.view', 'settings.manage',
    'upload.designImage',
    'pdf.generate',
    'whatsapp.send',
    'users.view', 'users.manage'
  ],
  ADMIN: [
    'dashboard.view',
    'orders.view', 'orders.create', 'orders.update',
    'customers.view', 'customers.create', 'customers.update',
    'production.view', 'production.update',
    'inventory.view',
    'finance.view',
    'payroll.view',
    'reports.view', 'reports.export',
    'staff.view',
    'upload.designImage',
    'pdf.generate',
    'whatsapp.send',
    'users.view', 'users.manage'
  ],
  MANAGER: [
    'dashboard.view',
    'orders.view', 'orders.update',
    'customers.view',
    'production.view', 'production.update',
    'inventory.view', 'inventory.manage',
    'payroll.view', 'payroll.manage',
    'reports.view', 'reports.export',
    'staff.view',
    'pdf.generate',
    'whatsapp.send',
    'users.view', 'users.manage'
  ],
  STAFF: [
    'orders.view', 'orders.create',
    'customers.view', 'customers.create',
    'production.view',
    'upload.designImage',
    'pdf.generate'
  ],
  TAILOR: [
    'production.view', 'production.update',
    'pdf.generate'
  ],
  CUTTING: [
    'production.view', 'production.update',
    'pdf.generate'
  ],
  EMBROIDERY: [
    'production.view', 'production.update',
    'pdf.generate'
  ],
  CASHIER: [
    'orders.view',
    'customers.view',
    'finance.view',
    'pdf.generate'
  ],
  Manager: [
    'orders.view',
    'customers.view',
    'finance.view',
    'inventory.view', 'inventory.manage',
    'reports.view', 'reports.export',
    'pdf.generate',
    'users.view', 'users.manage'
  ]
};

// Aliases for role naming consistency
ROLE_PERMISSIONS.CEO = ROLE_PERMISSIONS.SUPER_ADMIN;

/**
 * Normalizes role string to canonical form
 * @param {string} role
 * @returns {string}
 */
const normalizeRoleKey = (role) => {
  if (!role || typeof role !== 'string') return '';
  const upper = role.trim().toUpperCase();
  if (upper === 'CEO') return 'SUPER_ADMIN';
  return upper;
};

/**
 * Check if a role has a specific permission.
 * @param {string} role - The user's role (e.g. 'SUPER_ADMIN', 'STAFF')
 * @param {string} permission - The permission key (e.g. 'orders.create')
 * @returns {boolean}
 */
export const hasPermission = (role, permission) => {
  if (!role) return false;
  const normalized = normalizeRoleKey(role);
  const perms = ROLE_PERMISSIONS[normalized] || ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
};

/**
 * Get all permissions for a role.
 * @param {string} role
 * @returns {string[]}
 */
export const getPermissions = (role) => {
  if (!role) return [];
  const normalized = normalizeRoleKey(role);
  return ROLE_PERMISSIONS[normalized] || ROLE_PERMISSIONS[role] || [];
};

/**
 * Friendly display names for roles.
 */
export const ROLE_LABELS = {
  SUPER_ADMIN: 'CEO — Full Access',
  ADMIN: 'Admin — Management Access',
  MANAGER: 'Manager — Operations Access',
  STAFF: 'Staff — Order Entry Access',
  TAILOR: 'Tailor — Production Access',
  CUTTING: 'Cutting — Production Access',
  EMBROIDERY: 'Embroidery — Production Access',
  CASHIER: 'Cashier — Billing & Payments',
  Manager: 'Manager — Finance & Payment Access'
};

/**
 * Sidebar module permission keys.
 * Each sidebar item maps to a required permission.
 */
export const MODULE_PERMISSIONS = {
  overview: 'dashboard.view',
  sales: 'orders.view',
  production: 'production.view',
  tailors: 'production.view',
  customers: 'customers.view',
  inventory: 'inventory.view',
  payroll: 'payroll.view',
  finance: 'finance.view',
  staff: 'staff.view',
  users: 'users.view',
  marketing: 'dashboard.view',
  branches: 'dashboard.view',
  alerts: 'dashboard.view',
  bi: 'reports.view',
  mobile: 'dashboard.view',
  reports: 'reports.view'
};

/**
 * Helper to check if a user role belongs to Executive / Operations Management.
 * Management roles include CEO/SUPER_ADMIN, ADMIN, and MANAGER.
 *
 * @param {string|null|undefined} role - e.g. 'SUPER_ADMIN', 'CEO', 'MANAGER'
 * @returns {boolean}
 */
export const isManagementRole = (role) => {
  if (!role || typeof role !== 'string') return false;
  const upper = role.trim().toUpperCase();
  return upper === 'SUPER_ADMIN' || upper === 'CEO' || upper === 'ADMIN' || upper === 'MANAGER';
};

/**
 * Helper to check if a user role belongs to Production Craftsmen.
 * Craftsmen roles include TAILOR, CUTTING, and EMBROIDERY.
 *
 * @param {string|null|undefined} role - e.g. 'TAILOR', 'CUTTING', 'EMBROIDERY'
 * @returns {boolean}
 */
export const isCraftsmanRole = (role) => {
  if (!role || typeof role !== 'string') return false;
  const upper = role.trim().toUpperCase();
  return upper === 'TAILOR' || upper === 'CUTTING' || upper === 'EMBROIDERY';
};

/**
 * Helper to check if a role is authorized to switch between branch views.
 *
 * @param {string|null|undefined} role
 * @returns {boolean}
 */
export const canSwitchBranch = (role) => {
  return isManagementRole(role);
};
