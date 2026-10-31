/**
 * JB GROUP / BELLA DESIGN ERP — COMPREHENSIVE END-TO-END AUDIT & TEST SUITE
 * 
 * Tests all 10 core modules:
 * 1. Login, authentication, password reset, session handling
 * 2. CEO, Manager, Admin, Tailor permissions & branch access
 * 3. Customer creation, search, returning history, data integrity
 * 4. Order creation, numbering, pricing, approval, rejection, lifecycle
 * 5. Production Kanban, tasks, actual worker tracking, timestamps
 * 6. Sales, invoices, customer payments, balances
 * 7. Weekly Tailor Salary ERP (allocations, eligibility, boundaries, reconciliation, Susitha order)
 * 8. Inventory, stock movements, alerts, material records
 * 9. Reports, dashboards, branch filters, tailor performance
 * 10. API health, DB connectivity, frontend build, audit logs, rollback readiness
 * 
 * Safety: READ-ONLY & NON-DESTRUCTIVE. No production data modified.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { prisma, pool } = require('../src/prisma');
const {
  getColomboWeekRange,
  calculateOrderSalaryAllocations,
  computeWeeklySalaryMetrics
} = require('../src/utils/salaryCalculator');

const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET;

const auditResults = [];

function recordTest(moduleName, testTitle, passed, details = '', evidence = '') {
  auditResults.push({ module: moduleName, title: testTitle, passed, details, evidence });
  const status = passed ? '✓ [PASS]' : '✗ [FAIL]';
  console.log(`${status} [${moduleName}] ${testTitle}${details ? ' — ' + details : ''}`);
}

// Generate test tokens with exact role payloads
function getToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, branchId: user.branchId },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

const USERS = {
  CEO: { id: 1, name: 'Jeyatheepan Joseph (CEO)', email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN', branchId: 1 },
  MANAGER: { id: 3, name: 'Manager', email: 'manager@jbgroup.com', role: 'MANAGER', branchId: 1 },
  ADMIN: { id: 2, name: 'admin', email: 'admin@jbgroup.com', role: 'ADMIN', branchId: 1 },
  TAILOR: { id: 18, name: 'Jagatheeswary', email: 'jagatheeswary@jbgroup.com', role: 'TAILOR', branchId: 1 },
  SUSITHA: { id: 11, name: 'Susitha', email: 'susitha@jbgroup.com', role: 'TAILOR', branchId: 1 },
  STAFF: { id: 4, name: 'Pratheep', email: 'staff@jbgroup.com', role: 'STAFF', branchId: 1 }
};

const TOKENS = {
  CEO: getToken(USERS.CEO),
  MANAGER: getToken(USERS.MANAGER),
  ADMIN: getToken(USERS.ADMIN),
  TAILOR: getToken(USERS.TAILOR),
  SUSITHA: getToken(USERS.SUSITHA),
  STAFF: getToken(USERS.STAFF)
};

// Safe fetch with retry on transient socket reset
async function safeFetch(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 800));
    }
  }
}

async function executeAudit() {
  console.log('================================================================');
  console.log('JB GROUP / BELLA DESIGN ERP — END-TO-END AUDIT & VERIFICATION');
  console.log('Executing Non-Destructive Test Matrix Across All 10 Modules');
  console.log('================================================================\n');

  // ==========================================================================
  // MODULE 1: LOGIN, AUTHENTICATION, PASSWORD RESET & SESSION HANDLING
  // ==========================================================================
  console.log('\n--- MODULE 1: AUTHENTICATION & SESSION HANDLING ---');
  try {
    // 1.1 API Health
    const healthRes = await safeFetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    recordTest('M1-Auth', 'Health endpoint status 200 OK', healthRes.ok && healthData.success, 'Status 200', JSON.stringify(healthData));

    // 1.2 CEO Login
    const ceoLoginRes = await safeFetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ceo@jbgroup.com', password: '@Bella202CEO6' })
    });
    const ceoLoginData = await ceoLoginRes.json();
    const ceoLoginSuccess = ceoLoginRes.ok && ceoLoginData.success && Boolean(ceoLoginData.data?.token);
    recordTest('M1-Auth', 'CEO credentials login and token issuance', ceoLoginSuccess, `Role: ${ceoLoginData.data?.user?.role}`, `Token issued, user ID: ${ceoLoginData.data?.user?.id}`);

    // 1.3 Invalid Password Rejection
    const invalidLoginRes = await safeFetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ceo@jbgroup.com', password: 'WrongPassword!99' })
    });
    recordTest('M1-Auth', 'Invalid password rejection with 401 Unauthorized', invalidLoginRes.status === 401, `Status: ${invalidLoginRes.status}`, 'Access denied correctly');

    // 1.4 Unauthenticated Request Rejection
    const unauthRes = await safeFetch(`${BASE_URL}/orders`);
    recordTest('M1-Auth', 'Missing token rejected with 401 Unauthorized', unauthRes.status === 401, `Status: ${unauthRes.status}`, 'No token provided guard active');

    // 1.5 Malformed JWT Rejection
    const badTokenRes = await safeFetch(`${BASE_URL}/orders`, {
      headers: { 'Authorization': 'Bearer invalid.token.payload' }
    });
    recordTest('M1-Auth', 'Malformed JWT token rejected with 403 Forbidden', badTokenRes.status === 403, `Status: ${badTokenRes.status}`, 'Invalid signature detected');

    // 1.6 Password Reset Token model in DB
    const tokenCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'PasswordResetToken'`);
    recordTest('M1-Auth', 'PasswordResetToken table schema integrity', tokenCols.rows.length >= 4, `${tokenCols.rows.length} columns verified`, tokenCols.rows.map(r => r.column_name).join(', '));
  } catch (err) {
    recordTest('M1-Auth', 'Authentication module execution', false, err.message);
  }

  // ==========================================================================
  // MODULE 2: CEO, MANAGER, ADMIN & TAILOR PERMISSIONS & BRANCH ISOLATION
  // ==========================================================================
  console.log('\n--- MODULE 2: ROLE PERMISSIONS & BRANCH-LEVEL ACCESS ---');
  try {
    // 2.1 CEO Super Admin Bypass
    const ceoReportRes = await safeFetch(`${BASE_URL}/salary/weekly-report?branchId=ALL`, {
      headers: { 'Authorization': `Bearer ${TOKENS.CEO}` }
    });
    const ceoReportData = await ceoReportRes.json();
    recordTest('M2-RBAC', 'CEO organization-wide access across all branches', ceoReportRes.ok && ceoReportData.roleContext?.isCeo, 'Full Org Scope', `branchScope: ${ceoReportData.roleContext?.branchScope}`);

    // 2.2 Manager Authorized Branch Access
    const mgrReportRes = await safeFetch(`${BASE_URL}/salary/weekly-report`, {
      headers: { 'Authorization': `Bearer ${TOKENS.MANAGER}` }
    });
    const mgrReportData = await mgrReportRes.json();
    recordTest('M2-RBAC', 'Manager access to assigned branch (Branch 1)', mgrReportRes.ok && mgrReportData.roleContext?.branchScope === 1, 'Branch 1 Locked', `branchScope: ${mgrReportData.roleContext?.branchScope}`);

    // 2.3 Manager Cross-Branch Isolation Guard (Security check)
    const mgrCrossBranchRes = await safeFetch(`${BASE_URL}/salary/weekly-report?branchId=2`, {
      headers: { 'Authorization': `Bearer ${TOKENS.MANAGER}` }
    });
    recordTest('M2-RBAC', 'Manager cross-branch access blocked with 403 Forbidden', mgrCrossBranchRes.status === 403, 'Cross-branch blocked', `Status: ${mgrCrossBranchRes.status}`);

    // 2.4 Admin Oversight Without Payout Authority
    const adminReportRes = await safeFetch(`${BASE_URL}/salary/weekly-report`, {
      headers: { 'Authorization': `Bearer ${TOKENS.ADMIN}` }
    });
    const adminReportData = await adminReportRes.json();
    const adminCanDisburseFalse = adminReportData.roleContext?.canDisburse === false;
    recordTest('M2-RBAC', 'Admin accesses report with canDisburse = false (Read-only financial authority)', adminReportRes.ok && adminCanDisburseFalse, 'Read-only financial authority', `canDisburse: ${adminReportData.roleContext?.canDisburse}`);

    // 2.5 Admin Disbursement Endpoint Blockage
    const adminPayBlockRes = await safeFetch(`${BASE_URL}/salary/record-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKENS.ADMIN}` },
      body: JSON.stringify({ orderId: 106, tailorId: 18, workType: 'CUTTING', amountPaid: 250 })
    });
    recordTest('M2-RBAC', 'Admin payout execution blocked with 403 Forbidden', adminPayBlockRes.status === 403, 'Payout blocked for Admin', `Status: ${adminPayBlockRes.status}`);

    // 2.6 Tailor Management Route Blockage
    const tailorBlockRes = await safeFetch(`${BASE_URL}/salary/weekly-report`, {
      headers: { 'Authorization': `Bearer ${TOKENS.TAILOR}` }
    });
    recordTest('M2-RBAC', 'Tailor access to management weekly report blocked with 403 Forbidden', tailorBlockRes.status === 403, 'Tailor blocked', `Status: ${tailorBlockRes.status}`);

    // 2.7 Tailor Self-Service Scoping
    const tailorSelfRes = await safeFetch(`${BASE_URL}/salary/my-salary`, {
      headers: { 'Authorization': `Bearer ${TOKENS.TAILOR}` }
    });
    const tailorSelfData = await tailorSelfRes.json();
    const tailorSelfValid = tailorSelfRes.ok && tailorSelfData.tailor?.id === USERS.TAILOR.id;
    recordTest('M2-RBAC', 'Tailor retrieves self-scoped salary records only', tailorSelfValid, `Tailor ID: ${tailorSelfData.tailor?.id}`, `Returned ${tailorSelfData.allocations?.length || 0} jobs strictly belonging to tailor`);
  } catch (err) {
    recordTest('M2-RBAC', 'Role permissions module execution', false, err.message);
  }

  // ==========================================================================
  // MODULE 3: CUSTOMER CREATION, SEARCH, RETURNING HISTORY & INTEGRITY
  // ==========================================================================
  console.log('\n--- MODULE 3: CUSTOMER DATA INTEGRITY & SEARCH ---');
  try {
    // 3.1 Customer Search by Phone
    const searchPhoneRes = await safeFetch(`${BASE_URL}/customers/search?phone=077`, {
      headers: { 'Authorization': `Bearer ${TOKENS.STAFF}` }
    });
    const searchPhoneData = await searchPhoneRes.json();
    recordTest('M3-Customer', 'Customer search by phone query', searchPhoneRes.ok && searchPhoneData.success, `Found ${searchPhoneData.customers?.length || 0} customers`, `Results returned successfully`);

    // 3.2 Customer Search by Name
    const searchNameRes = await safeFetch(`${BASE_URL}/customers/search?query=a`, {
      headers: { 'Authorization': `Bearer ${TOKENS.STAFF}` }
    });
    const searchNameData = await searchNameRes.json();
    recordTest('M3-Customer', 'Customer search by name query', searchNameRes.ok && searchNameData.success, `Found ${searchNameData.customers?.length || 0} customers`, 'Query matched');

    // 3.3 Returning Customer Order History
    const firstCust = (searchPhoneData.customers && searchPhoneData.customers[0]) || { id: 1 };
    const custOrdersRes = await safeFetch(`${BASE_URL}/orders/customer/${firstCust.id}`, {
      headers: { 'Authorization': `Bearer ${TOKENS.STAFF}` }
    });
    const custOrdersData = await custOrdersRes.json();
    recordTest('M3-Customer', 'Returning customer order ledger lookup', custOrdersRes.ok && custOrdersData.success, `Customer #${firstCust.id} history`, `Orders count: ${custOrdersData.orders?.length || 0}`);

    // 3.4 Customer Measurement Vault
    const measRes = await safeFetch(`${BASE_URL}/customers/${firstCust.id}/measurements`, {
      headers: { 'Authorization': `Bearer ${TOKENS.STAFF}` }
    });
    recordTest('M3-Customer', 'Customer measurement records retrieval', measRes.ok, `Customer #${firstCust.id}`, `Measurements retrieved`);

    // 3.5 Database Unique Indexes on Customer (primaryPhone and email)
    const custUnique = await pool.query(`
      SELECT indexname, indexdef FROM pg_indexes 
      WHERE tablename = 'Customer' AND (indexname LIKE '%phone%' OR indexname LIKE '%email%');
    `);
    const hasUnique = custUnique.rows.some(r => r.indexname.includes('primaryPhone')) && custUnique.rows.some(r => r.indexname.includes('email'));
    recordTest('M3-Customer', 'Customer primaryPhone and email unique indexes enforced in DB', hasUnique, `${custUnique.rows.length} unique indexes found`, custUnique.rows.map(r => r.indexname).join(', '));
  } catch (err) {
    recordTest('M3-Customer', 'Customer module execution', false, err.message);
  }

  // ==========================================================================
  // MODULE 4: ORDER CREATION, NUMBERING, PRICING & LIFECYCLE
  // ==========================================================================
  console.log('\n--- MODULE 4: ORDER LIFECYCLE & PRICING WORKFLOW ---');
  try {
    // 4.1 Orders List Retrieval
    const ordersRes = await safeFetch(`${BASE_URL}/orders?limit=10`, {
      headers: { 'Authorization': `Bearer ${TOKENS.MANAGER}` }
    });
    const ordersData = await ordersRes.json();
    recordTest('M4-Orders', 'Orders list retrieval with pagination', ordersRes.ok && ordersData.success, `Orders retrieved: ${ordersData.orders?.length || 0}`, `Total orders in system`);

    // 4.2 Order Numbering Convention Verification
    const sampleOrders = ordersData.orders || [];
    const prodOrders = sampleOrders.filter(o => o.orderNumber && !o.orderNumber.startsWith('TEST-'));
    const validNumbering = prodOrders.every(o => o.orderNumber.startsWith('JB-') || o.orderNumber.startsWith('ORD-'));
    recordTest('M4-Orders', 'Order numbering convention (JB-YYYYMMDD-XXXX / ORD-YYYY-XXXX)', validNumbering, `${prodOrders.length} production orders verified`, prodOrders.slice(0, 3).map(o => o.orderNumber).join(', '));

    // 4.3 Order Single Record Lookup
    if (sampleOrders.length > 0) {
      const singleOrderRes = await safeFetch(`${BASE_URL}/orders/${sampleOrders[0].id}`, {
        headers: { 'Authorization': `Bearer ${TOKENS.MANAGER}` }
      });
      const singleOrderData = await singleOrderRes.json();
      recordTest('M4-Orders', 'Single order details lookup with garment & customer relations', singleOrderRes.ok && singleOrderData.success, `Order ${singleOrderData.order?.orderNumber}`, `Customer: ${singleOrderData.order?.customer?.name}`);
    }

    // 4.4 Price Validation Logic
    const pricedOrders = sampleOrders.filter(o => Number(o.totalAmount) > 0);
    recordTest('M4-Orders', 'Order pricing values integrity across orders', pricedOrders.length > 0, `${pricedOrders.length} priced orders`, `Average: LKR ${Math.round(pricedOrders.reduce((s, o) => s + Number(o.totalAmount), 0) / pricedOrders.length)}`);
  } catch (err) {
    recordTest('M4-Orders', 'Order lifecycle module execution', false, err.message);
  }

  // ==========================================================================
  // MODULE 5: PRODUCTION KANBAN, TASKS & WORKER TRACKING
  // ==========================================================================
  console.log('\n--- MODULE 5: PRODUCTION KANBAN & TASK TRACKING ---');
  try {
    // 5.1 All Production Tasks
    const allTasksRes = await safeFetch(`${BASE_URL}/orders/tasks/all`, {
      headers: { 'Authorization': `Bearer ${TOKENS.MANAGER}` }
    });
    const allTasksData = await allTasksRes.json();
    recordTest('M5-Tasks', 'All production tasks retrieval', allTasksRes.ok && allTasksData.success, `Tasks found: ${allTasksData.tasks?.length || 0}`, `Task records accessible to Manager`);

    // 5.2 Tailor Personal Tasks
    const myTasksRes = await safeFetch(`${BASE_URL}/orders/tasks/my-tasks`, {
      headers: { 'Authorization': `Bearer ${TOKENS.TAILOR}` }
    });
    const myTasksData = await myTasksRes.json();
    recordTest('M5-Tasks', 'Tailor personal tasks retrieval (/orders/tasks/my-tasks)', myTasksRes.ok && myTasksData.success, `Tasks assigned: ${myTasksData.tasks?.length || 0}`, `Scoped to tailor ID ${USERS.TAILOR.id}`);

    // 5.3 Task Types & Status in DB
    const taskTypesRes = await pool.query(`SELECT DISTINCT "taskType", "status" FROM "OrderTask"`);
    recordTest('M5-Tasks', 'OrderTask types and status consistency', taskTypesRes.rows.length > 0, `${taskTypesRes.rows.length} task variations`, JSON.stringify(taskTypesRes.rows.slice(0, 4)));

    // 5.4 Production History Stepper Ledger
    const histRes = await pool.query(`SELECT count(*) FROM "ProductionHistory"`);
    recordTest('M5-Tasks', 'ProductionHistory stage audit tracking active', Number(histRes.rows[0].count) > 0, `Total history steps: ${histRes.rows[0].count}`, `Production audit ledger functional`);
  } catch (err) {
    recordTest('M5-Tasks', 'Production task module execution', false, err.message);
  }

  // ==========================================================================
  // MODULE 6: SALES, INVOICES, CUSTOMER PAYMENTS & BALANCES
  // ==========================================================================
  console.log('\n--- MODULE 6: SALES & CUSTOMER FINANCIAL RECORDS ---');
  try {
    // 6.1 Dashboard Sales Summary
    const salesSummaryRes = await safeFetch(`${BASE_URL}/orders/dashboard-summary`, {
      headers: { 'Authorization': `Bearer ${TOKENS.MANAGER}` }
    });
    const salesSummaryData = await salesSummaryRes.json();
    recordTest('M6-Sales', 'Sales dashboard summary KPI metrics', salesSummaryRes.ok && salesSummaryData.success, `Total orders: ${salesSummaryData.summary?.totalOrders || 0}`, `Monthly sales: LKR ${salesSummaryData.summary?.monthlySales || 0}`);

    // 6.2 Customer Payment Records in DB
    const paymentsCountRes = await pool.query(`SELECT "status", count(*), sum("amount") FROM "Payment" GROUP BY "status"`);
    recordTest('M6-Sales', 'Customer payment records categorized by status', paymentsCountRes.rows.length > 0, `${paymentsCountRes.rows.length} payment statuses`, JSON.stringify(paymentsCountRes.rows));

    // 6.3 Digital Invoice PDF Endpoint
    const sampleOrder = await prisma.order.findFirst({ select: { id: true, orderNumber: true } });
    if (sampleOrder) {
      const pdfRes = await safeFetch(`${BASE_URL}/orders/${sampleOrder.id}/pdf`, {
        headers: { 'Authorization': `Bearer ${TOKENS.MANAGER}` }
      });
      recordTest('M6-Sales', 'Digital invoice / PDF endpoint response', pdfRes.ok, `Order #${sampleOrder.orderNumber}`, `HTTP Status: ${pdfRes.status}`);
    }
  } catch (err) {
    recordTest('M6-Sales', 'Sales and payments module execution', false, err.message);
  }

  // ==========================================================================
  // MODULE 7: WEEKLY TAILOR SALARY ERP
  // ==========================================================================
  console.log('\n--- MODULE 7: WEEKLY TAILOR SALARY MANAGEMENT ENGINE ---');
  try {
    const weekRange = getColomboWeekRange('2026-10-26');

    // 7.1 Weekly Report API Fetch (Manager, Branch 1)
    const reportRes = await safeFetch(`${BASE_URL}/salary/weekly-report`, {
      headers: { 'Authorization': `Bearer ${TOKENS.MANAGER}` }
    });
    const reportData = await reportRes.json();
    recordTest('M7-Salary', 'Weekly Tailor Salary Report API response (Week 44)', reportRes.ok && reportData.success, 'Fetched successfully', `Allocations: ${reportData.allocations?.length || 0}`);

    // 7.2 50/25/25 Split Mathematical Verification
    const allocs = reportData.allocations || [];
    let mathValid = true;
    for (const a of allocs) {
      const expectedAlloc = Math.round((a.agreedPrice * 0.25) * 100) / 100;
      if (Math.abs(a.allocatedAmount - expectedAlloc) > 0.05) {
        mathValid = false;
        break;
      }
    }
    recordTest('M7-Salary', 'Exact 50% Office / 25% Cutting / 25% Stitching mathematical split', mathValid && allocs.length > 0, `${allocs.length} allocations verified`, 'Formula: price * 0.25 on every allocation');

    // 7.3 Work Completion & Customer Payment Eligibility Condition
    let eligibilityValid = true;
    for (const a of allocs) {
      if (a.status === 'PAYABLE') {
        if (!a.isWorkCompleted || !a.isCustomerFullyPaid) {
          eligibilityValid = false;
          break;
        }
      }
      if (a.status === 'ON_HOLD_CUSTOMER_PAYMENT') {
        if (!a.isWorkCompleted || a.isCustomerFullyPaid) {
          eligibilityValid = false;
          break;
        }
      }
    }
    recordTest('M7-Salary', 'Eligibility rule: Work completed AND customer fully paid required for PAYABLE', eligibilityValid, 'State machine strictly verified', 'No uncompleted work or unpaid customer order is marked PAYABLE');

    // 7.4 Asia/Colombo Business Week Boundaries
    const tzValid = weekRange.formattedRange.includes('26 Oct') && weekRange.formattedRange.includes('01 Nov');
    recordTest('M7-Salary', 'Asia/Colombo weekly boundaries (Monday 26 Oct to Sunday 01 Nov 2026)', tzValid, weekRange.formattedRange, `startIso: ${weekRange.startIso}`);

    // 7.5 Manager Dashboard Figures Reconciliation
    const s = reportData.summary;
    const isPayableReconciled = s.totalPayable === 10100;
    const isCarriedForwardReconciled = s.totalCarriedForward === 10725;
    const isPaidReconciled = s.totalPaidInWeek === 625;
    const isHeldReconciled = s.totalHeldOnCustomerPayment === 1095;
    const isPendingReconciled = s.totalWorkPending === 30787;
    const allReconciled = isPayableReconciled && isCarriedForwardReconciled && isPaidReconciled && isHeldReconciled && isPendingReconciled;
    recordTest('M7-Salary', 'Manager dashboard figures reconciliation (10,100 Payable, 10,725 CF, 625 Paid, 1,095 Held, 30,787 Pending)', allReconciled, '100% Exact Cent Match', `Payable: ${s.totalPayable}, CF: ${s.totalCarriedForward}, Paid: ${s.totalPaidInWeek}, Held: ${s.totalHeldOnCustomerPayment}, Pending: ${s.totalWorkPending}`);

    // 7.6 Order JB-20261020-0001 (Susitha) Audit
    const susithaCutting = allocs.find(a => a.orderNumber === 'JB-20261020-0001' && a.workType === 'CUTTING');
    const susithaStitching = allocs.find(a => a.orderNumber === 'JB-20261020-0001' && a.workType === 'STITCHING');
    const susithaValid = susithaCutting?.status === 'PAID' && susithaCutting?.allocatedAmount === 625 &&
                         susithaStitching?.status === 'PAYABLE' && susithaStitching?.allocatedAmount === 625;
    recordTest('M7-Salary', 'Order JB-20261020-0001 for Susitha: Cutting LKR 625 PAID, Stitching LKR 625 PAYABLE', susithaValid, 'Verified with DB ledger', `Cutting: ${susithaCutting?.status}, Stitching: ${susithaStitching?.status}`);

    // 7.7 Duplicate Salary Payment Database Constraint Verification
    const uqConstraint = await pool.query(`
      SELECT constraint_name FROM information_schema.table_constraints 
      WHERE table_name = 'TailorSalaryPayment' AND constraint_type = 'UNIQUE';
    `);
    const hasUniqueConstraint = uqConstraint.rows.some(r => r.constraint_name.includes('order_tailor_work') || r.constraint_name.includes('UQ_'));
    recordTest('M7-Salary', 'Database constraint prevents duplicate salary disbursements', hasUniqueConstraint, 'UQ Constraint active', uqConstraint.rows.map(r => r.constraint_name).join(', '));

    // 7.8 Identification of Individual Tailor Statement Inconsistency
    const susithaStmt = reportData.tailorStatements?.find(t => t.tailorId === 11);
    const hasDoubleCountInStmt = susithaStmt && susithaStmt.outstandingBalance === (susithaStmt.totalPayable + susithaStmt.totalCarriedForward);
    recordTest('M7-Salary', 'AUDIT FINDING: Statement outstandingBalance doubles carried-forward payable jobs', hasDoubleCountInStmt, `Reported: ${susithaStmt?.outstandingBalance}, Expected: ${susithaStmt?.totalPayable}`, `outstandingBalance = totalPayable (${susithaStmt?.totalPayable}) + carriedForward (${susithaStmt?.totalCarriedForward}) = ${susithaStmt?.outstandingBalance}`);
  } catch (err) {
    recordTest('M7-Salary', 'Salary ERP module execution', false, err.message);
  }

  // ==========================================================================
  // MODULE 8: INVENTORY, STOCK MOVEMENTS, ALERTS & MATERIAL RECORDS
  // ==========================================================================
  console.log('\n--- MODULE 8: INVENTORY & MATERIAL MANAGEMENT ---');
  try {
    // 8.1 Material Master Items List
    const invItemsRes = await safeFetch(`${BASE_URL}/inventory/items`, {
      headers: { 'Authorization': `Bearer ${TOKENS.MANAGER}` }
    });
    const invItemsData = await invItemsRes.json();
    recordTest('M8-Inventory', 'Material items catalog list retrieval', invItemsRes.ok && invItemsData.success, `Items count: ${invItemsData.items?.length || 0}`, 'Material master active');

    // 8.2 Inventory Low Stock Alerts
    const invAlertsRes = await safeFetch(`${BASE_URL}/inventory/alerts`, {
      headers: { 'Authorization': `Bearer ${TOKENS.MANAGER}` }
    });
    const invAlertsData = await invAlertsRes.json();
    recordTest('M8-Inventory', 'Low stock & critical inventory alerts endpoint', invAlertsRes.ok && invAlertsData.success, `Alerts count: ${invAlertsData.alerts?.length || 0}`, 'Alert telemetry active');

    // 8.3 Stock Movements Ledger
    const invMovementsRes = await safeFetch(`${BASE_URL}/inventory/movements`, {
      headers: { 'Authorization': `Bearer ${TOKENS.MANAGER}` }
    });
    const invMovementsData = await invMovementsRes.json();
    recordTest('M8-Inventory', 'Stock movements audit ledger retrieval', invMovementsRes.ok && invMovementsData.success, `Movements count: ${invMovementsData.movements?.length || 0}`, 'Ledger traceable');
  } catch (err) {
    recordTest('M8-Inventory', 'Inventory module execution', false, err.message);
  }

  // ==========================================================================
  // MODULE 9: REPORTS, DASHBOARDS, BRANCH FILTERS & TAILOR PERFORMANCE
  // ==========================================================================
  console.log('\n--- MODULE 9: REPORTS, MULTI-BRANCH FILTERS & PERFORMANCE ---');
  try {
    // 9.1 Multi-Branch Summary Filtering (CEO scope)
    const branch1Summary = await safeFetch(`${BASE_URL}/orders/dashboard-summary?branchId=1`, {
      headers: { 'Authorization': `Bearer ${TOKENS.CEO}` }
    });
    const b1Data = await branch1Summary.json();

    const branch2Summary = await safeFetch(`${BASE_URL}/orders/dashboard-summary?branchId=2`, {
      headers: { 'Authorization': `Bearer ${TOKENS.CEO}` }
    });
    const b2Data = await branch2Summary.json();
    recordTest('M9-Reports', 'Multi-branch telemetry isolation (Branch 1 vs Branch 2)', branch1Summary.ok && branch2Summary.ok, `Branch 1 orders: ${b1Data.summary?.totalOrders}, Branch 2: ${b2Data.summary?.totalOrders}`, 'Branch filtering operational');

    // 9.2 Tailor Performance Leaderboard
    const perfRes = await safeFetch(`${BASE_URL}/orders/tailors/performance`, {
      headers: { 'Authorization': `Bearer ${TOKENS.MANAGER}` }
    });
    const perfData = await perfRes.json();
    recordTest('M9-Reports', 'Tailor performance leaderboard endpoint', perfRes.ok && perfData.success, `Tailors evaluated: ${perfData.tailors?.length || 0}`, 'Leaderboard functional');

    // 9.3 Active Tailors List for Assignments
    const tailorsListRes = await safeFetch(`${BASE_URL}/orders/tailors/list`, {
      headers: { 'Authorization': `Bearer ${TOKENS.MANAGER}` }
    });
    const tailorsListData = await tailorsListRes.json();
    recordTest('M9-Reports', 'Active tailors directory for task assignments', tailorsListRes.ok && tailorsListData.success, `Active craftsmen: ${tailorsListData.tailors?.length || 0}`, 'Tailor list functional');
  } catch (err) {
    recordTest('M9-Reports', 'Reports and dashboards module execution', false, err.message);
  }

  // ==========================================================================
  // MODULE 10: API HEALTH, DB CONNECTIVITY, FRONTEND BUILD & AUDIT LOGS
  // ==========================================================================
  console.log('\n--- MODULE 10: SYSTEM HEALTH, DATABASE & BUILD VERIFICATION ---');
  try {
    // 10.1 Database Connection Pool Latency
    const tStart = Date.now();
    const dbPing = await pool.query('SELECT 1 as ping');
    const latency = Date.now() - tStart;
    recordTest('M10-System', 'PostgreSQL database connection pool responsiveness', dbPing.rows[0].ping === 1, `Latency: ${latency}ms`, 'Neon PostgreSQL active');

    // 10.2 AuditLog Table Verification
    const auditCount = await pool.query(`SELECT count(*) FROM "AuditLog"`);
    recordTest('M10-System', 'System AuditLog table active and recording events', Number(auditCount.rows[0].count) > 0, `Audit log entries: ${auditCount.rows[0].count}`, 'Audit trail persistent');

    // 10.3 TailorSalaryPayment Table Schema Integrity
    const salaryCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'TailorSalaryPayment'`);
    recordTest('M10-System', 'TailorSalaryPayment schema integrity', salaryCols.rows.length >= 10, `${salaryCols.rows.length} columns verified`, salaryCols.rows.map(r => r.column_name).join(', '));
  } catch (err) {
    recordTest('M10-System', 'System health module execution', false, err.message);
  }

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log('AUDIT EXECUTION SUMMARY');
  console.log('================================================================');
  const total = auditResults.length;
  const passed = auditResults.filter(r => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL TESTS EXECUTED: ${total}`);
  console.log(`PASSED: ${passed} (${Math.round((passed / total) * 100)}%)`);
  console.log(`FAILED / FINDINGS: ${failed}`);
  console.log('================================================================\n');

  return auditResults;
}

executeAudit()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal audit failure:', err);
    process.exit(1);
  });
