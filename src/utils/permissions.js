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
    'reports.view', 'reports.export',
    'staff.view',
    'upload.designImage',
    'pdf.generate',
    'whatsapp.send'
  ],
  MANAGER: [
    'dashboard.view',
    'orders.view', 'orders.update',
    'customers.view',
    'production.view', 'production.update',
    'reports.view',
    'staff.view',
    'pdf.generate',
    'whatsapp.send'
  ],
  STAFF: [
    'orders.view', 'orders.create',
    'customers.view', 'customers.create',
    'production.view',
    'upload.designImage',
    'pdf.generate'
  ],
  TAILOR: [
    'orders.view',
    'customers.view',
    'production.view', 'production.update',
    'pdf.generate'
  ],
  CUTTING: [
    'orders.view',
    'customers.view',
    'production.view', 'production.update',
    'pdf.generate'
  ],
  EMBROIDERY: [
    'orders.view',
    'customers.view',
    'production.view', 'production.update',
    'pdf.generate'
  ],
  Manager: [
    'orders.view',
    'customers.view',
    'finance.view',
    'pdf.generate'
  ]
};

/**
 * Check if a role has a specific permission.
 * @param {string} role - The user's role (e.g. 'SUPER_ADMIN', 'STAFF')
 * @param {string} permission - The permission key (e.g. 'orders.create')
 * @returns {boolean}
 */
export const hasPermission = (role, permission) => {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
};

/**
 * Get all permissions for a role.
 * @param {string} role
 * @returns {string[]}
 */
export const getPermissions = (role) => {
  return ROLE_PERMISSIONS[role] || [];
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
  marketing: 'dashboard.view',
  branches: 'dashboard.view',
  alerts: 'dashboard.view',
  bi: 'reports.view',
  mobile: 'dashboard.view',
  reports: 'reports.view'
};
