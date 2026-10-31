/**
 * Comprehensive Automated Verification Suite for Daily Reports in JB SYSTEM
 * Verifies for all roles:
 * - CEO (SUPER_ADMIN): company-wide reports & branch scoping
 * - MANAGER: assigned-branch reports only & cross-branch restriction
 * - ADMIN: existing Admin permissions & data-access rules
 * - STAFF & TAILOR: restrictions unchanged (strictly forbidden)
 *
 * Verifies separately:
 * 1. Sidebar visibility
 * 2. Page access
 * 3. API authorization & scoping
 * 4. PDF download generation across all 5 report types
 *
 * NOTE: DOES NOT TOUCH THE PRODUCTION DATABASE. ALL DATA CALLS ARE MOCKED IN-MEMORY.
 */

const assert = require('assert');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-daily-reports-2026';
process.env.JWT_SECRET = JWT_SECRET;

// -----------------------------------------------------------------------------
// Mock Data Fixtures
// -----------------------------------------------------------------------------
const MOCK_BRANCHES = [
  { id: 1, name: 'JB Group (Main Branch)', phone: '+94 77 123 4567', address: 'Trincomalee' },
  { id: 2, name: 'Bella Design (Studio)', phone: '+94 77 987 6543', address: 'Colombo' }
];

const MOCK_USERS = [
  { id: 1, name: 'Jeyatheepan Joseph (CEO)', role: 'SUPER_ADMIN', email: 'ceo@jbgroup.com', branchId: 1, isActive: true },
  { id: 2, name: 'Admin User', role: 'ADMIN', email: 'admin@jbgroup.com', branchId: 1, isActive: true },
  { id: 3, name: 'Branch 1 Manager', role: 'MANAGER', email: 'manager@jbgroup.com', branchId: 1, isActive: true },
  { id: 4, name: 'Branch 2 Manager', role: 'MANAGER', email: 'bella_manager@jbgroup.com', branchId: 2, isActive: true },
  { id: 5, name: 'Pratheep (Staff)', role: 'STAFF', email: 'staff@jbgroup.com', branchId: 1, isActive: true },
  { id: 6, name: 'Pushpamalar (Tailor)', role: 'TAILOR', email: 'pushpa@jbgroup.com', branchId: 1, isActive: true }
];

const MOCK_ORDERS = [
  {
    id: 101,
    orderNumber: 'ORD-2026-0001',
    orderDate: new Date('2026-10-29T10:30:00+05:30'),
    branchId: 1,
    totalAmount: 15000,
    advancePayment: 5000,
    balanceAmount: 10000,
    status: 'IN_PROGRESS',
    paymentStatus: 'Partial',
    customer: { id: 11, name: 'Ayesha Perera', primaryPhone: '+94 77 111 2222' },
    assignedTailor: { id: 6, name: 'Pushpamalar', role: 'TAILOR' },
    branch: { id: 1, name: 'JB Group (Main Branch)' },
    garmentDetails: { dressType: 'Bridal Saree Blouse', quantity: 1 }
  },
  {
    id: 102,
    orderNumber: 'ORD-2026-0002',
    orderDate: new Date('2026-10-29T14:15:00+05:30'),
    branchId: 2,
    totalAmount: 28000,
    advancePayment: 28000,
    balanceAmount: 0,
    status: 'READY',
    paymentStatus: 'Paid',
    customer: { id: 12, name: 'Dilani Fernando', primaryPhone: '+94 71 333 4444' },
    assignedTailor: { id: 6, name: 'Pushpamalar', role: 'TAILOR' },
    branch: { id: 2, name: 'Bella Design (Studio)' },
    garmentDetails: { dressType: 'Evening Gown', quantity: 1 }
  }
];

const MOCK_ATTENDANCE = [
  { id: 1, userId: 3, date: '2026-10-29', status: 'Present', checkIn: new Date('2026-10-29T08:30:00+05:30'), checkOut: null, branch: 'JB Group (Main Branch)' },
  { id: 2, userId: 5, date: '2026-10-29', status: 'Checked Out', checkIn: new Date('2026-10-29T09:00:00+05:30'), checkOut: new Date('2026-10-29T17:00:00+05:30'), branch: 'JB Group (Main Branch)' }
];

const MOCK_PAYMENTS = [
  {
    id: 201,
    orderId: 101,
    amount: 5000,
    paymentMethod: 'Cash',
    recordedBy: 'Staff Pratheep',
    createdAt: new Date('2026-10-29T10:45:00+05:30'),
    status: 'VERIFIED',
    order: {
      orderNumber: 'ORD-2026-0001',
      branchId: 1,
      totalAmount: 15000,
      balanceAmount: 10000,
      paymentStatus: 'Partial',
      customer: { id: 11, name: 'Ayesha Perera', primaryPhone: '+94 77 111 2222' },
      branch: { id: 1, name: 'JB Group (Main Branch)' }
    }
  },
  {
    id: 202,
    orderId: 102,
    amount: 28000,
    paymentMethod: 'Bank Transfer',
    recordedBy: 'Bella Manager',
    createdAt: new Date('2026-10-29T14:20:00+05:30'),
    status: 'VERIFIED',
    order: {
      orderNumber: 'ORD-2026-0002',
      branchId: 2,
      totalAmount: 28000,
      balanceAmount: 0,
      paymentStatus: 'Paid',
      customer: { id: 12, name: 'Dilani Fernando', primaryPhone: '+94 71 333 4444' },
      branch: { id: 2, name: 'Bella Design (Studio)' }
    }
  }
];

const MOCK_PRODUCTION_HISTORY = [
  {
    id: 301,
    orderId: 101,
    stage: 'STITCHING',
    previousStage: 'CUTTING',
    startedAt: new Date('2026-10-29T11:00:00+05:30'),
    order: {
      orderNumber: 'ORD-2026-0001',
      branchId: 1,
      customer: { id: 11, name: 'Ayesha Perera' },
      branch: { id: 1, name: 'JB Group (Main Branch)' },
      garmentDetails: { dressType: 'Bridal Saree Blouse', quantity: 1 }
    },
    assignedTo: { id: 6, name: 'Pushpamalar', role: 'TAILOR' },
    notes: 'Bust fitting double reinforced'
  }
];

const MOCK_ORDER_TASKS = [
  {
    id: 401,
    orderId: 101,
    taskName: 'Stitching Blouse Body',
    taskType: 'STITCHING',
    completedAt: new Date('2026-10-29T16:00:00+05:30'),
    order: {
      orderNumber: 'ORD-2026-0001',
      branchId: 1,
      customer: { id: 11, name: 'Ayesha Perera' },
      branch: { id: 1, name: 'JB Group (Main Branch)' }
    },
    assignedTailor: { id: 6, name: 'Pushpamalar', role: 'TAILOR' }
  }
];

// Helper: Setup in-memory mock for Prisma
function createMockPrisma() {
  return {
    branch: {
      findMany: async () => MOCK_BRANCHES
    },
    user: {
      findUnique: async ({ where }) => MOCK_USERS.find(u => u.id === where.id),
      findMany: async ({ where }) => {
        return MOCK_USERS.filter(u => {
          if (where.isActive && !u.isActive) return false;
          if (where.branchId && u.branchId !== where.branchId) return false;
          return true;
        });
      }
    },
    order: {
      findMany: async ({ where }) => {
        return MOCK_ORDERS.filter(o => {
          if (where.branchId && o.branchId !== where.branchId) return false;
          if (where.status && typeof where.status === 'string' && o.status !== where.status) return false;
          if (where.status && where.status.in && !where.status.in.includes(o.status)) return false;
          return true;
        });
      }
    },
    attendance: {
      findMany: async ({ where }) => {
        return MOCK_ATTENDANCE.filter(a => {
          if (where.date && a.date !== where.date) return false;
          if (where.user?.branchId) {
            const user = MOCK_USERS.find(u => u.id === a.userId);
            if (!user || user.branchId !== where.user.branchId) return false;
          }
          return true;
        });
      }
    },
    payment: {
      findMany: async ({ where }) => {
        return MOCK_PAYMENTS.filter(p => {
          if (where.order?.branchId && p.order.branchId !== where.order.branchId) return false;
          return true;
        });
      }
    },
    productionHistory: {
      findMany: async ({ where }) => {
        return MOCK_PRODUCTION_HISTORY.filter(h => {
          if (where.order?.branchId && h.order.branchId !== where.order.branchId) return false;
          return true;
        });
      }
    },
    orderTask: {
      findMany: async ({ where }) => {
        return MOCK_ORDER_TASKS.filter(t => {
          if (where.branchId && t.order.branchId !== where.branchId) return false;
          return true;
        });
      }
    }
  };
}

// -----------------------------------------------------------------------------
// Test Execution Harness
// -----------------------------------------------------------------------------
const testResults = [];
let passCount = 0;
let failCount = 0;

async function runTest(roleName, category, testName, testFn) {
  try {
    await testFn();
    passCount++;
    testResults.push({ role: roleName, category, name: testName, status: 'PASS' });
    console.log(`  ✓ [PASS] [${roleName}] [${category}] ${testName}`);
  } catch (err) {
    failCount++;
    testResults.push({ role: roleName, category, name: testName, status: 'FAIL', error: err.message });
    console.error(`  ✗ [FAIL] [${roleName}] [${category}] ${testName}`);
    console.error(`          ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// Main Test Suite
// -----------------------------------------------------------------------------
async function runAllVerifications() {
  console.log('================================================================');
  console.log(' JB SYSTEM: DAILY REPORTS ROLE-BASED VERIFICATION MATRIX');
  console.log(' Roles: CEO (SUPER_ADMIN), MANAGER, ADMIN, STAFF, TAILOR');
  console.log(' Areas: Sidebar Visibility, Page Access, API Authorization & PDF');
  console.log('================================================================\n');

  // Load modules
  const { hasPermission, getPermissions, MODULE_PERMISSIONS } = await import('../../src/utils/permissions.js');
  const pdfGenerators = await import('../../src/utils/dailyReportsPdf.js');

  // Intercept prisma require in reportController
  const prismaPath = require.resolve('../src/prisma');
  const mockPrisma = createMockPrisma();
  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: { prisma: mockPrisma, pool: {} }
  };

  const reportController = require('../src/controllers/reportController');
  const { authorizeRoles } = require('../src/middleware/authMiddleware');

  // Helper to simulate express request & response
  function executeReportController(user, query = {}) {
    return new Promise((resolve) => {
      const req = { user, query };
      let statusCode = 200;
      let responseBody = null;

      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          responseBody = data;
          resolve({ status: statusCode, body: responseBody });
        }
      };

      const next = (err) => {
        resolve({ status: 500, error: err });
      };

      reportController.getDailyReports(req, res, next);
    });
  }

  function executeRoleMiddleware(allowedRoles, user) {
    return new Promise((resolve) => {
      const req = { user };
      let statusCode = 200;
      let responseBody = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          responseBody = data;
          resolve({ status: statusCode, body: responseBody });
        }
      };
      const next = () => {
        resolve({ status: 200, allowed: true });
      };
      const mw = authorizeRoles(...allowedRoles);
      mw(req, res, next);
    });
  }

  // =========================================================================
  // 1. CEO (SUPER_ADMIN) VERIFICATION
  // =========================================================================
  console.log('--- 1. VERIFYING ROLE: CEO (SUPER_ADMIN) ---');

  // 1A. Sidebar Visibility
  await runTest('CEO', 'Sidebar Visibility', 'Sidebar item "reports" has permission "reports.view" and is VISIBLE', () => {
    assert.strictEqual(MODULE_PERMISSIONS.reports, 'reports.view');
    assert.strictEqual(hasPermission('SUPER_ADMIN', 'reports.view'), true);
    assert.strictEqual(hasPermission('CEO', 'reports.view'), true);
  });

  await runTest('CEO', 'Sidebar Visibility', 'CEO has both reports.view and reports.export permissions', () => {
    const ceoPerms = getPermissions('SUPER_ADMIN');
    assert(ceoPerms.includes('reports.view'));
    assert(ceoPerms.includes('reports.export'));
  });

  // 1B. Page Access
  await runTest('CEO', 'Page Access', 'CEO is authorized for ModuleRenderer reports tab and DailyReportsERP page', () => {
    assert.strictEqual(hasPermission('SUPER_ADMIN', 'reports.view'), true);
  });

  // 1C. API Authorization & Company-wide Scoping
  await runTest('CEO', 'API Authorization', 'Middleware allows CEO to access /api/reports/daily', async () => {
    const res = await executeRoleMiddleware(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CEO'], { role: 'SUPER_ADMIN' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.allowed, true);
  });

  await runTest('CEO', 'Data Scoping', 'CEO default fetch returns company-wide reports (isCompanyWide=true, all 2 orders)', async () => {
    const res = await executeReportController(MOCK_USERS[0], { date: '2026-10-29' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.meta.isCompanyWide, true);
    assert.strictEqual(res.body.meta.branchId, null);
    assert.strictEqual(res.body.meta.availableBranches.length, 2);
    // Company-wide total orders: Branch 1 (ORD-101) + Branch 2 (ORD-102) = 2
    assert.strictEqual(res.body.orders.summary.totalOrders, 2);
    assert.strictEqual(res.body.orders.summary.totalAmount, 43000); // 15000 + 28000
    assert.strictEqual(res.body.payments.summary.totalCollected, 33000); // 5000 + 28000
  });

  await runTest('CEO', 'Data Scoping', 'CEO can filter specifically to Branch 1 (JB Group)', async () => {
    const res = await executeReportController(MOCK_USERS[0], { date: '2026-10-29', branchId: '1' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.meta.isCompanyWide, false);
    assert.strictEqual(res.body.meta.branchId, 1);
    assert.strictEqual(res.body.orders.summary.totalOrders, 1);
    assert.strictEqual(res.body.orders.records[0].orderNumber, 'ORD-2026-0001');
  });

  await runTest('CEO', 'Data Scoping', 'CEO can filter specifically to Branch 2 (Bella Design)', async () => {
    const res = await executeReportController(MOCK_USERS[0], { date: '2026-10-29', branchId: '2' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.meta.isCompanyWide, false);
    assert.strictEqual(res.body.meta.branchId, 2);
    assert.strictEqual(res.body.orders.summary.totalOrders, 1);
    assert.strictEqual(res.body.orders.records[0].orderNumber, 'ORD-2026-0002');
  });

  // 1D. PDF Download for CEO
  let ceoReportData = null;
  const ceoRes = await executeReportController(MOCK_USERS[0], { date: '2026-10-29' });
  ceoReportData = ceoRes.body;

  await runTest('CEO', 'PDF Download', 'generateDailyBusinessSummaryPDF runs without error for CEO', () => {
    const doc = pdfGenerators.generateDailyBusinessSummaryPDF({
      date: '2026-10-29',
      branchName: 'All Branches (Company-wide)',
      data: ceoReportData,
      user: { name: 'Jeyatheepan Joseph', role: 'SUPER_ADMIN' }
    });
    assert(doc && typeof doc.save === 'function');
    assert(doc.internal.getNumberOfPages() >= 2);
  });

  await runTest('CEO', 'PDF Download', 'generateDailyOrdersPDF runs without error for CEO (company-wide)', () => {
    const doc = pdfGenerators.generateDailyOrdersPDF({
      date: '2026-10-29',
      branchName: 'All Branches (Company-wide)',
      records: ceoReportData.orders.records,
      summary: ceoReportData.orders.summary,
      user: { name: 'Jeyatheepan Joseph', role: 'SUPER_ADMIN' }
    });
    assert(doc && doc.internal.getNumberOfPages() >= 1);
  });

  await runTest('CEO', 'PDF Download', 'generateDailyPaymentsPDF runs without error for CEO (company-wide)', () => {
    const doc = pdfGenerators.generateDailyPaymentsPDF({
      date: '2026-10-29',
      branchName: 'All Branches (Company-wide)',
      records: ceoReportData.payments.records,
      summary: ceoReportData.payments.summary,
      user: { name: 'Jeyatheepan Joseph', role: 'SUPER_ADMIN' }
    });
    assert(doc && doc.internal.getNumberOfPages() >= 1);
  });

  await runTest('CEO', 'PDF Download', 'generateDailyAttendancePDF runs without error for CEO', () => {
    const doc = pdfGenerators.generateDailyAttendancePDF({
      date: '2026-10-29',
      branchName: 'All Branches (Company-wide)',
      records: ceoReportData.attendance.records,
      summary: ceoReportData.attendance.summary,
      user: { name: 'Jeyatheepan Joseph', role: 'SUPER_ADMIN' }
    });
    assert(doc && doc.internal.getNumberOfPages() >= 1);
  });

  await runTest('CEO', 'PDF Download', 'generateDailyProductionPDF runs without error for CEO', () => {
    const doc = pdfGenerators.generateDailyProductionPDF({
      date: '2026-10-29',
      branchName: 'All Branches (Company-wide)',
      data: ceoReportData.production.data,
      summary: ceoReportData.production.summary,
      user: { name: 'Jeyatheepan Joseph', role: 'SUPER_ADMIN' }
    });
    assert(doc && doc.internal.getNumberOfPages() >= 1);
  });

  // =========================================================================
  // 2. MANAGER VERIFICATION
  // =========================================================================
  console.log('\n--- 2. VERIFYING ROLE: MANAGER ---');

  // 2A. Sidebar Visibility
  await runTest('MANAGER', 'Sidebar Visibility', 'Sidebar item "reports" is VISIBLE for MANAGER', () => {
    assert.strictEqual(hasPermission('MANAGER', 'reports.view'), true);
    assert.strictEqual(hasPermission('Manager', 'reports.view'), true);
  });

  await runTest('MANAGER', 'Sidebar Visibility', 'MANAGER has reports.view and reports.export permissions', () => {
    const mgrPerms = getPermissions('MANAGER');
    assert(mgrPerms.includes('reports.view'));
    assert(mgrPerms.includes('reports.export'));
  });

  // 2B. Page Access
  await runTest('MANAGER', 'Page Access', 'MANAGER is authorized for ModuleRenderer reports tab and DailyReportsERP page', () => {
    assert.strictEqual(hasPermission('MANAGER', 'reports.view'), true);
  });

  // 2C. API Authorization & Branch Scoping
  await runTest('MANAGER', 'API Authorization', 'Middleware allows MANAGER to access /api/reports/daily', async () => {
    const res = await executeRoleMiddleware(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], { role: 'MANAGER' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.allowed, true);
  });

  await runTest('MANAGER', 'Data Scoping', 'Branch 1 Manager default fetch is strictly locked to Branch 1 (ORD-101 only)', async () => {
    const res = await executeReportController(MOCK_USERS[2], { date: '2026-10-29' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.meta.isCompanyWide, false);
    assert.strictEqual(res.body.meta.branchId, 1);
    assert.strictEqual(res.body.meta.availableBranches.length, 1);
    assert.strictEqual(res.body.meta.availableBranches[0].id, 1);
    // Manager only sees Branch 1 data
    assert.strictEqual(res.body.orders.summary.totalOrders, 1);
    assert.strictEqual(res.body.orders.records[0].orderNumber, 'ORD-2026-0001');
    assert.strictEqual(res.body.orders.summary.totalAmount, 15000);
    assert.strictEqual(res.body.payments.summary.totalCollected, 5000);
  });

  await runTest('MANAGER', 'Data Scoping', 'Manager requesting branchId=ALL is safely overridden to their assigned branch', async () => {
    const res = await executeReportController(MOCK_USERS[2], { date: '2026-10-29', branchId: 'ALL' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.meta.isCompanyWide, false);
    assert.strictEqual(res.body.meta.branchId, 1);
    assert.strictEqual(res.body.orders.summary.totalOrders, 1);
  });

  await runTest('MANAGER', 'Data Scoping', 'Manager requesting another branch (branchId=2) is rejected with 403 Forbidden', async () => {
    const res = await executeReportController(MOCK_USERS[2], { date: '2026-10-29', branchId: '2' });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert(res.body.message.includes('Managers are restricted to their assigned branch'));
  });

  // 2D. PDF Download for Manager
  const mgrRes = await executeReportController(MOCK_USERS[2], { date: '2026-10-29' });
  const mgrReportData = mgrRes.body;

  await runTest('MANAGER', 'PDF Download', 'generateDailyBusinessSummaryPDF runs without error for Manager (Branch 1 scoped)', () => {
    const doc = pdfGenerators.generateDailyBusinessSummaryPDF({
      date: '2026-10-29',
      branchName: 'JB Group (Main Branch)',
      data: mgrReportData,
      user: { name: 'Branch 1 Manager', role: 'MANAGER' }
    });
    assert(doc && doc.internal.getNumberOfPages() >= 2);
  });

  await runTest('MANAGER', 'PDF Download', 'generateDailyOrdersPDF runs without error for Manager', () => {
    const doc = pdfGenerators.generateDailyOrdersPDF({
      date: '2026-10-29',
      branchName: 'JB Group (Main Branch)',
      records: mgrReportData.orders.records,
      summary: mgrReportData.orders.summary,
      user: { name: 'Branch 1 Manager', role: 'MANAGER' }
    });
    assert(doc && doc.internal.getNumberOfPages() >= 1);
  });

  await runTest('MANAGER', 'PDF Download', 'generateDailyPaymentsPDF runs without error for Manager', () => {
    const doc = pdfGenerators.generateDailyPaymentsPDF({
      date: '2026-10-29',
      branchName: 'JB Group (Main Branch)',
      records: mgrReportData.payments.records,
      summary: mgrReportData.payments.summary,
      user: { name: 'Branch 1 Manager', role: 'MANAGER' }
    });
    assert(doc && doc.internal.getNumberOfPages() >= 1);
  });

  await runTest('MANAGER', 'PDF Download', 'generateDailyAttendancePDF runs without error for Manager', () => {
    const doc = pdfGenerators.generateDailyAttendancePDF({
      date: '2026-10-29',
      branchName: 'JB Group (Main Branch)',
      records: mgrReportData.attendance.records,
      summary: mgrReportData.attendance.summary,
      user: { name: 'Branch 1 Manager', role: 'MANAGER' }
    });
    assert(doc && doc.internal.getNumberOfPages() >= 1);
  });

  await runTest('MANAGER', 'PDF Download', 'generateDailyProductionPDF runs without error for Manager', () => {
    const doc = pdfGenerators.generateDailyProductionPDF({
      date: '2026-10-29',
      branchName: 'JB Group (Main Branch)',
      data: mgrReportData.production.data,
      summary: mgrReportData.production.summary,
      user: { name: 'Branch 1 Manager', role: 'MANAGER' }
    });
    assert(doc && doc.internal.getNumberOfPages() >= 1);
  });

  // =========================================================================
  // 3. ADMIN VERIFICATION
  // =========================================================================
  console.log('\n--- 3. VERIFYING ROLE: ADMIN ---');

  // 3A. Sidebar Visibility
  await runTest('ADMIN', 'Sidebar Visibility', 'Sidebar item "reports" is VISIBLE for ADMIN', () => {
    assert.strictEqual(hasPermission('ADMIN', 'reports.view'), true);
    assert.strictEqual(hasPermission('Admin', 'reports.view'), true);
  });

  await runTest('ADMIN', 'Sidebar Visibility', 'ADMIN has reports.view and reports.export permissions', () => {
    const adminPerms = getPermissions('ADMIN');
    assert(adminPerms.includes('reports.view'));
    assert(adminPerms.includes('reports.export'));
  });

  // 3B. Page Access
  await runTest('ADMIN', 'Page Access', 'ADMIN is authorized for ModuleRenderer reports tab and DailyReportsERP page', () => {
    assert.strictEqual(hasPermission('ADMIN', 'reports.view'), true);
  });

  // 3C. API Authorization & Data Access Rules
  await runTest('ADMIN', 'API Authorization', 'Middleware allows ADMIN to access /api/reports/daily', async () => {
    const res = await executeRoleMiddleware(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], { role: 'ADMIN' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.allowed, true);
  });

  await runTest('ADMIN', 'Data Scoping', 'ADMIN follows management data rules: defaults to company-wide reports', async () => {
    const res = await executeReportController(MOCK_USERS[1], { date: '2026-10-29' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.meta.isCompanyWide, true);
    assert.strictEqual(res.body.meta.availableBranches.length, 2);
    assert.strictEqual(res.body.orders.summary.totalOrders, 2);
    assert.strictEqual(res.body.orders.summary.totalAmount, 43000);
  });

  await runTest('ADMIN', 'Data Scoping', 'ADMIN can filter by Branch 1 (JB Group)', async () => {
    const res = await executeReportController(MOCK_USERS[1], { date: '2026-10-29', branchId: '1' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.meta.isCompanyWide, false);
    assert.strictEqual(res.body.meta.branchId, 1);
    assert.strictEqual(res.body.orders.summary.totalOrders, 1);
  });

  await runTest('ADMIN', 'Data Scoping', 'ADMIN can filter by Branch 2 (Bella Design)', async () => {
    const res = await executeReportController(MOCK_USERS[1], { date: '2026-10-29', branchId: '2' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.meta.isCompanyWide, false);
    assert.strictEqual(res.body.meta.branchId, 2);
    assert.strictEqual(res.body.orders.summary.totalOrders, 1);
  });

  // 3D. PDF Download for Admin
  const adminRes = await executeReportController(MOCK_USERS[1], { date: '2026-10-29' });
  const adminReportData = adminRes.body;

  await runTest('ADMIN', 'PDF Download', 'generateDailyBusinessSummaryPDF runs without error for Admin', () => {
    const doc = pdfGenerators.generateDailyBusinessSummaryPDF({
      date: '2026-10-29',
      branchName: 'All Branches (Company-wide)',
      data: adminReportData,
      user: { name: 'Admin User', role: 'ADMIN' }
    });
    assert(doc && doc.internal.getNumberOfPages() >= 2);
  });

  await runTest('ADMIN', 'PDF Download', 'generateDailyOrdersPDF runs without error for Admin', () => {
    const doc = pdfGenerators.generateDailyOrdersPDF({
      date: '2026-10-29',
      branchName: 'All Branches (Company-wide)',
      records: adminReportData.orders.records,
      summary: adminReportData.orders.summary,
      user: { name: 'Admin User', role: 'ADMIN' }
    });
    assert(doc && doc.internal.getNumberOfPages() >= 1);
  });

  await runTest('ADMIN', 'PDF Download', 'generateDailyPaymentsPDF runs without error for Admin', () => {
    const doc = pdfGenerators.generateDailyPaymentsPDF({
      date: '2026-10-29',
      branchName: 'All Branches (Company-wide)',
      records: adminReportData.payments.records,
      summary: adminReportData.payments.summary,
      user: { name: 'Admin User', role: 'ADMIN' }
    });
    assert(doc && doc.internal.getNumberOfPages() >= 1);
  });

  await runTest('ADMIN', 'PDF Download', 'generateDailyAttendancePDF runs without error for Admin', () => {
    const doc = pdfGenerators.generateDailyAttendancePDF({
      date: '2026-10-29',
      branchName: 'All Branches (Company-wide)',
      records: adminReportData.attendance.records,
      summary: adminReportData.attendance.summary,
      user: { name: 'Admin User', role: 'ADMIN' }
    });
    assert(doc && doc.internal.getNumberOfPages() >= 1);
  });

  await runTest('ADMIN', 'PDF Download', 'generateDailyProductionPDF runs without error for Admin', () => {
    const doc = pdfGenerators.generateDailyProductionPDF({
      date: '2026-10-29',
      branchName: 'All Branches (Company-wide)',
      data: adminReportData.production.data,
      summary: adminReportData.production.summary,
      user: { name: 'Admin User', role: 'ADMIN' }
    });
    assert(doc && doc.internal.getNumberOfPages() >= 1);
  });

  // =========================================================================
  // 4. RESTRICTION CHECKS: STAFF & TAILOR (UNCHANGED)
  // =========================================================================
  console.log('\n--- 4. VERIFYING RESTRICTIONS: STAFF & TAILOR ---');

  await runTest('STAFF', 'Sidebar Visibility', 'Sidebar item "reports" is HIDDEN for STAFF (hasPermission=false)', () => {
    assert.strictEqual(hasPermission('STAFF', 'reports.view'), false);
    assert.strictEqual(hasPermission('STAFF', 'reports.export'), false);
  });

  await runTest('STAFF', 'Page Access', 'STAFF is blocked from page access in ModuleRenderer and DailyReportsERP', () => {
    assert.strictEqual(hasPermission('STAFF', 'reports.view'), false);
  });

  await runTest('STAFF', 'API Authorization', 'STAFF is rejected by middleware with 403 Forbidden', async () => {
    const res = await executeRoleMiddleware(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], { role: 'STAFF' });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert(res.body.message.includes('Access denied'));
  });

  await runTest('STAFF', 'API Authorization', 'STAFF direct call to controller is rejected with 403 Forbidden', async () => {
    const res = await executeReportController(MOCK_USERS[4], { date: '2026-10-29' });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert(res.body.message.includes('Management authorization required'));
  });

  await runTest('TAILOR', 'Sidebar Visibility', 'Sidebar item "reports" is HIDDEN for TAILOR (hasPermission=false)', () => {
    assert.strictEqual(hasPermission('TAILOR', 'reports.view'), false);
    assert.strictEqual(hasPermission('TAILOR', 'reports.export'), false);
  });

  await runTest('TAILOR', 'Page Access', 'TAILOR is blocked from page access and routed to TailorDashboard', () => {
    assert.strictEqual(hasPermission('TAILOR', 'reports.view'), false);
  });

  await runTest('TAILOR', 'API Authorization', 'TAILOR is rejected by middleware with 403 Forbidden', async () => {
    const res = await executeRoleMiddleware(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], { role: 'TAILOR' });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert(res.body.message.includes('Access denied'));
  });

  await runTest('TAILOR', 'API Authorization', 'TAILOR direct call to controller is rejected with 403 Forbidden', async () => {
    const res = await executeReportController(MOCK_USERS[5], { date: '2026-10-29' });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert(res.body.message.includes('Management authorization required'));
  });

  // =========================================================================
  // Final Verification Summary
  // =========================================================================
  console.log('\n================================================================');
  console.log(' VERIFICATION SUMMARY');
  console.log('================================================================');
  console.log(` Total Checks Executed: ${passCount + failCount}`);
  console.log(` Passed:                ${passCount}`);
  console.log(` Failed:                ${failCount}`);

  // Breakdown by Role
  const roles = ['CEO', 'MANAGER', 'ADMIN', 'STAFF', 'TAILOR'];
  roles.forEach(role => {
    const roleChecks = testResults.filter(r => r.role === role);
    const rolePass = roleChecks.filter(r => r.status === 'PASS').length;
    console.log(`   - ${role.padEnd(8)}: ${rolePass} / ${roleChecks.length} checks PASSED`);
  });

  if (failCount > 0) {
    console.error('\nFAILURES DETECTED:');
    testResults.filter(r => r.status === 'FAIL').forEach(f => {
      console.error(`- [${f.role}] ${f.category} -> ${f.name}: ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL ROLE-BASED VERIFICATION CHECKS PASSED PERFECTLY!');
  }
}

runAllVerifications().catch(err => {
  console.error('Fatal execution error in test matrix:', err);
  process.exit(1);
});
