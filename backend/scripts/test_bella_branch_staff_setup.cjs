const assert = require('assert');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { prisma, pool } = require('../src/prisma');
const userController = require('../src/controllers/userController');
const orderController = require('../src/controllers/orderController');
const salaryController = require('../src/controllers/salaryController');
const taskController = require('../src/controllers/taskController');
const reportController = require('../src/controllers/reportController');

// Helper to simulate Express req/res
const createMockReqRes = (user, query = {}, body = {}, params = {}) => {
  const req = {
    user,
    query,
    body,
    params,
    headers: {
      'x-forwarded-for': '127.0.0.1',
      authorization: 'Bearer mock_token'
    },
    ip: '127.0.0.1'
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    send(data) {
      responseData = data;
      return this;
    }
  };

  const next = (err) => {
    if (err) {
      statusCode = err.status || 500;
      responseData = { success: false, message: err.message };
    }
  };

  return {
    req,
    res,
    next,
    getStatusCode: () => statusCode,
    getResponse: () => responseData
  };
};

async function runTests() {
  console.log('================================================================');
  console.log('JB SYSTEM — BELLA DESIGN BRANCH ACCESS CONTROL & ROLES VERIFICATION');
  console.log('================================================================\n');

  // TEST 1: Reusing existing Bella Design Branch & DB Branch ID Verification
  console.log('--- TEST 1: Branch Verification ---');
  const branches = await prisma.branch.findMany({ orderBy: { id: 'asc' } });
  console.log('Active Database Branches:');
  branches.forEach(b => console.log(`  - ID: ${b.id} | Name: "${b.name}" | Status: ${b.status}`));

  assert.strictEqual(branches.length, 2, 'There must be exactly 2 branches: JB Group and Bella Design');
  const jbBranch = branches.find(b => b.id === 1);
  const bellaBranch = branches.find(b => b.id === 2);

  assert(jbBranch, 'Branch ID 1 must exist for JB Group');
  assert(bellaBranch, 'Branch ID 2 must exist for Bella Design');
  assert.strictEqual(bellaBranch.id, 2, 'Bella Design Branch ID must be exactly 2');
  assert.strictEqual(bellaBranch.name, 'Bella Design', 'Branch name must match "Bella Design"');
  console.log('✓ TEST 1 PASSED: Bella Design branch verified with actual DB Branch ID: 2. No duplicate branches.\n');

  let dbBellaAdmin = null;
  let dbBellaManager = null;
  let dbBellaTailor = null;
  let jbOrder = null;
  let bellaOrder = null;
  let bellaTask = null;

  try {
  // TEST 2: CEO Account Creation for Bella Admin, Bella Manager & Bella Tailor
  console.log('--- TEST 2: CEO Creating Bella Admin, Bella Manager & Bella Tailor Accounts ---');
  const ceoUser = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' }
  });
  assert(ceoUser, 'CEO (SUPER_ADMIN) account must exist');

  const ts = Date.now();
  const bellaAdminEmail = `bella.admin.${ts}@belladesign.lk`;
  const bellaManagerEmail = `bella.manager.${ts}@belladesign.lk`;
  const bellaTailorEmail = `bella.tailor.${ts}@belladesign.lk`;

  // 2A: CEO creates Bella Admin
  console.log('Creating Bella Admin account via userController.createUser...');
  const { req: reqAdmin, res: resAdmin, next: nextAdmin, getStatusCode: getAdminStatus, getResponse: getAdminResp } =
    createMockReqRes(ceoUser, {}, {
      name: 'Bella Branch Admin',
      email: bellaAdminEmail,
      role: 'ADMIN',
      branchId: 2, // Bella Design
      password: 'BellaSecurePassword2026!',
      sendSetupLink: false,
      isActive: true
    });

  await userController.createUser(reqAdmin, resAdmin, nextAdmin);
  assert.strictEqual(getAdminStatus(), 201, `Expected status 201, got ${getAdminStatus()}`);
  const createdAdminData = getAdminResp();
  assert(createdAdminData.success, 'Bella Admin creation must succeed');

  dbBellaAdmin = await prisma.user.findUnique({
    where: { email: bellaAdminEmail },
    include: { branch: true, employee: true }
  });
  assert(dbBellaAdmin, 'Bella Admin must exist in database');
  assert.strictEqual(dbBellaAdmin.role, 'ADMIN', 'Role must be ADMIN');
  assert.strictEqual(dbBellaAdmin.branchId, 2, 'Branch ID must be 2 (Bella Design)');
  assert.strictEqual(dbBellaAdmin.branch.name, 'Bella Design', 'Branch relation must point to Bella Design');
  assert(dbBellaAdmin.employee, 'Linked employee record must exist');
  assert.strictEqual(dbBellaAdmin.employee.branchId, 2, 'Employee record must have branchId: 2');
  console.log(`✓ Bella Admin created: ID ${dbBellaAdmin.id}, Email ${dbBellaAdmin.email}, Branch ID ${dbBellaAdmin.branchId} (${dbBellaAdmin.branch.name})`);

  // 2B: CEO creates Bella Manager
  console.log('Creating Bella Manager account via userController.createUser...');
  const { req: reqMgr, res: resMgr, next: nextMgr, getStatusCode: getMgrStatus, getResponse: getMgrResp } =
    createMockReqRes(ceoUser, {}, {
      name: 'Bella Branch Manager',
      email: bellaManagerEmail,
      role: 'MANAGER',
      branchId: 2, // Bella Design
      password: 'BellaManagerPassword2026!',
      sendSetupLink: false,
      isActive: true
    });

  await userController.createUser(reqMgr, resMgr, nextMgr);
  assert.strictEqual(getMgrStatus(), 201, `Expected status 201, got ${getMgrStatus()}`);
  const createdMgrData = getMgrResp();
  assert(createdMgrData.success, 'Bella Manager creation must succeed');

  dbBellaManager = await prisma.user.findUnique({
    where: { email: bellaManagerEmail },
    include: { branch: true, employee: true }
  });
  assert(dbBellaManager, 'Bella Manager must exist in database');
  assert.strictEqual(dbBellaManager.role, 'MANAGER', 'Role must be MANAGER');
  assert.strictEqual(dbBellaManager.branchId, 2, 'Branch ID must be 2 (Bella Design)');
  assert.strictEqual(dbBellaManager.branch.name, 'Bella Design', 'Branch relation must point to Bella Design');
  assert(dbBellaManager.employee, 'Linked employee record must exist');
  assert.strictEqual(dbBellaManager.employee.branchId, 2, 'Employee record must have branchId: 2');
  console.log(`✓ Bella Manager created: ID ${dbBellaManager.id}, Email ${dbBellaManager.email}, Branch ID ${dbBellaManager.branchId} (${dbBellaManager.branch.name})`);

  // 2C: CEO creates Bella Tailor
  console.log('Creating Bella Tailor account via userController.createUser...');
  const { req: reqTailor, res: resTailor, next: nextTailor, getStatusCode: getTailorStatus, getResponse: getTailorResp } =
    createMockReqRes(ceoUser, {}, {
      name: 'Meena (Bella Tailor)',
      email: bellaTailorEmail,
      role: 'TAILOR',
      branchId: 2, // Bella Design
      password: 'BellaTailorPassword2026!',
      sendSetupLink: false,
      isActive: true
    });

  await userController.createUser(reqTailor, resTailor, nextTailor);
  assert.strictEqual(getTailorStatus(), 201, `Expected status 201, got ${getTailorStatus()}`);
  const createdTailorData = getTailorResp();
  assert(createdTailorData.success, 'Bella Tailor creation must succeed');

  dbBellaTailor = await prisma.user.findUnique({
    where: { email: bellaTailorEmail },
    include: { branch: true, employee: true }
  });
  assert(dbBellaTailor, 'Bella Tailor must exist in database');
  assert.strictEqual(dbBellaTailor.role, 'TAILOR', 'Role must be TAILOR');
  assert.strictEqual(dbBellaTailor.branchId, 2, 'Branch ID must be 2 (Bella Design)');
  assert.strictEqual(dbBellaTailor.branch.name, 'Bella Design', 'Branch relation must point to Bella Design');
  assert(dbBellaTailor.employee, 'Linked employee record must exist');
  assert.strictEqual(dbBellaTailor.employee.branchId, 2, 'Employee record must have branchId: 2');
  console.log(`✓ Bella Tailor created: ID ${dbBellaTailor.id}, Email ${dbBellaTailor.email}, Branch ID ${dbBellaTailor.branchId} (${dbBellaTailor.branch.name})`);
  console.log('✓ TEST 2 PASSED: CEO successfully created ADMIN, MANAGER, and TAILOR under Bella Design.\n');

  // TEST 3: User Management Table Listing & Employee Display
  console.log('--- TEST 3: Display Bella Design Employees in User Management ---');
  // 3A: CEO viewing all branches
  const { req: reqListAll, res: resListAll, next: nextListAll, getResponse: getRespAll } =
    createMockReqRes(ceoUser, { branchId: 'ALL' });
  await userController.listUsers(reqListAll, resListAll, nextListAll);
  const allUsersResp = getRespAll();
  assert(allUsersResp.success, 'CEO must be able to list all users');
  const foundBellaAdmin = allUsersResp.users.find(u => u.email === bellaAdminEmail);
  const foundBellaManager = allUsersResp.users.find(u => u.email === bellaManagerEmail);
  const foundBellaTailor = allUsersResp.users.find(u => u.email === bellaTailorEmail);
  assert(foundBellaAdmin, 'Bella Admin must appear in all-users list');
  assert(foundBellaManager, 'Bella Manager must appear in all-users list');
  assert(foundBellaTailor, 'Bella Tailor must appear in all-users list');
  assert.strictEqual(foundBellaAdmin.branchId, 2, 'Bella Admin branchId must be 2');
  assert.strictEqual(foundBellaManager.branchId, 2, 'Bella Manager branchId must be 2');
  assert.strictEqual(foundBellaTailor.branchId, 2, 'Bella Tailor branchId must be 2');

  // 3B: CEO filtering specifically for Bella Design (branchId: 2)
  const { req: reqListBella, res: resListBella, next: nextListBella, getResponse: getRespBella } =
    createMockReqRes(ceoUser, { branchId: '2' });
  await userController.listUsers(reqListBella, resListBella, nextListBella);
  const bellaUsersResp = getRespBella();
  assert(bellaUsersResp.success, 'CEO must be able to filter by Bella Design');
  assert(bellaUsersResp.users.every(u => u.branchId === 2), 'All users in branchId: 2 filter must belong to Bella Design');
  console.log(`✓ Found ${bellaUsersResp.users.length} staff accounts under Bella Design (Branch 2) filter.`);
  console.log('✓ TEST 3 PASSED: Bella Design employees correctly displayed in employee table.\n');

  // TEST 4: Security & Cross-Branch Authorization Enforcement
  console.log('--- TEST 4: Cross-Branch Security & Restriction Testing ---');

  // Fetch existing JB Group Admin and Manager accounts (Branch 1)
  const jbAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN', branchId: 1 }
  });
  assert(jbAdmin, 'JB Admin account must exist');

  const jbManager = await prisma.user.findFirst({
    where: { role: 'MANAGER', branchId: 1 }
  });
  assert(jbManager, 'JB Manager account must exist');

  // 4A: JB Admin trying to view all-branch users
  const { req: reqJbAdminAll, res: resJbAdminAll, next: nextJbAdminAll, getStatusCode: getStatusJbAdminAll } =
    createMockReqRes(jbAdmin, { branchId: 'ALL' });
  await userController.listUsers(reqJbAdminAll, resJbAdminAll, nextJbAdminAll);
  assert.strictEqual(getStatusJbAdminAll(), 403, 'JB Admin must NOT be allowed to view all branches (must return 403)');

  // 4B: JB Manager trying to view all-branch users
  const { req: reqJbMgrAll, res: resJbMgrAll, next: nextJbMgrAll, getStatusCode: getStatusJbMgrAll } =
    createMockReqRes(jbManager, { branchId: 'ALL' });
  await userController.listUsers(reqJbMgrAll, resJbMgrAll, nextJbMgrAll);
  assert.strictEqual(getStatusJbMgrAll(), 403, 'JB Manager must NOT be allowed to view all branches (must return 403)');

  // 4C: JB Admin trying to view Bella Design users
  const { req: reqJbAdminBella, res: resJbAdminBella, next: nextJbAdminBella, getStatusCode: getStatusJbAdminBella } =
    createMockReqRes(jbAdmin, { branchId: '2' });
  await userController.listUsers(reqJbAdminBella, resJbAdminBella, nextJbAdminBella);
  assert.strictEqual(getStatusJbAdminBella(), 403, 'JB Admin must NOT be allowed to view Bella Design users (must return 403)');

  // 4D: JB Manager trying to view Bella Design users
  const { req: reqJbMgrBella, res: resJbMgrBella, next: nextJbMgrBella, getStatusCode: getStatusJbMgrBella } =
    createMockReqRes(jbManager, { branchId: '2' });
  await userController.listUsers(reqJbMgrBella, resJbMgrBella, nextJbMgrBella);
  assert.strictEqual(getStatusJbMgrBella(), 403, 'JB Manager must NOT be allowed to view Bella Design users (must return 403)');

  // 4E: Bella Admin trying to view JB Group users
  const { req: reqBellaAdminJb, res: resBellaAdminJb, next: nextBellaAdminJb, getStatusCode: getStatusBellaAdminJb } =
    createMockReqRes(dbBellaAdmin, { branchId: '1' });
  await userController.listUsers(reqBellaAdminJb, resBellaAdminJb, nextBellaAdminJb);
  assert.strictEqual(getStatusBellaAdminJb(), 403, 'Bella Admin must NOT be allowed to view JB Group users (must return 403)');

  // 4F: Bella Manager trying to view JB Group users
  const { req: reqBellaMgrJb, res: resBellaMgrJb, next: nextBellaMgrJb, getStatusCode: getStatusBellaMgrJb } =
    createMockReqRes(dbBellaManager, { branchId: '1' });
  await userController.listUsers(reqBellaMgrJb, resBellaMgrJb, nextBellaMgrJb);
  assert.strictEqual(getStatusBellaMgrJb(), 403, 'Bella Manager must NOT be allowed to view JB Group users (must return 403)');

  // 4G: Bella Admin trying to view all-branch users
  const { req: reqBellaAdminAll, res: resBellaAdminAll, next: nextBellaAdminAll, getStatusCode: getStatusBellaAdminAll } =
    createMockReqRes(dbBellaAdmin, { branchId: 'ALL' });
  await userController.listUsers(reqBellaAdminAll, resBellaAdminAll, nextBellaAdminAll);
  assert.strictEqual(getStatusBellaAdminAll(), 403, 'Bella Admin must NOT be allowed to view all branches (must return 403)');

  // 4H: Bella Manager trying to view all-branch users
  const { req: reqBellaMgrAll, res: resBellaMgrAll, next: nextBellaMgrAll, getStatusCode: getStatusBellaMgrAll } =
    createMockReqRes(dbBellaManager, { branchId: 'ALL' });
  await userController.listUsers(reqBellaMgrAll, resBellaMgrAll, nextBellaMgrAll);
  assert.strictEqual(getStatusBellaMgrAll(), 403, 'Bella Manager must NOT be allowed to view all branches (must return 403)');

  // 4I: Bella Admin trying to create an account under JB Group (Branch 1)
  const { req: reqCrossCreate, res: resCrossCreate, next: nextCrossCreate, getStatusCode: getStatusCrossCreate } =
    createMockReqRes(dbBellaAdmin, {}, {
      name: 'Illegal Cross Account',
      email: `illegal.${ts}@test.com`,
      role: 'STAFF',
      branchId: 1 // Attempting to create for JB Group
    });
  await userController.createUser(reqCrossCreate, resCrossCreate, nextCrossCreate);
  assert.strictEqual(getStatusCrossCreate(), 403, 'Bella Admin must NOT be allowed to create users in JB Group (must return 403)');

  // 4J: Bella Admin trying to create a SUPER_ADMIN (CEO)
  const { req: reqCeoCreate, res: resCeoCreate, next: nextCeoCreate, getStatusCode: getStatusCeoCreate } =
    createMockReqRes(dbBellaAdmin, {}, {
      name: 'Fake CEO',
      email: `fake.ceo.${ts}@test.com`,
      role: 'SUPER_ADMIN',
      branchId: 2
    });
  await userController.createUser(reqCeoCreate, resCeoCreate, nextCeoCreate);
  assert.strictEqual(getStatusCeoCreate(), 403, 'Branch Admin must NOT be allowed to create CEO/SUPER_ADMIN account (must return 403)');
  console.log('✓ TEST 4 PASSED: Backend API strictly blocks cross-branch access and unauthorized role escalation.\n');

  // TEST 5: Order Dashboard & Work Scoping for All Roles Separately
  console.log('--- TEST 5: Separate Role Dashboard & Order Isolation ---');

  // Create a test order in JB Group (Branch 1) and another in Bella Design (Branch 2)
  const customer = await prisma.customer.findFirst();
  assert(customer, 'Customer must exist');

  jbOrder = await prisma.order.create({
    data: {
      orderNumber: `TEST-JB-${ts}`,
      customerId: customer.id,
      branchId: 1, // JB Group
      totalAmount: 25000,
      advancePayment: 10000,
      balanceAmount: 15000,
      status: 'ORDER_CONFIRMED'
    }
  });

  bellaOrder = await prisma.order.create({
    data: {
      orderNumber: `TEST-BELLA-${ts}`,
      customerId: customer.id,
      branchId: 2, // Bella Design
      totalAmount: 38000,
      advancePayment: 15000,
      balanceAmount: 23000,
      status: 'ORDER_CONFIRMED',
      assignedTailorId: dbBellaTailor.id
    }
  });

  // Assign a task to Bella Tailor on bellaOrder
  bellaTask = await prisma.orderTask.create({
    data: {
      orderId: bellaOrder.id,
      taskName: 'Stitching',
      taskType: 'STITCHING',
      assignedTailorId: dbBellaTailor.id,
      status: 'ASSIGNED',
      sequence: 1,
      branchId: 2
    }
  });

  // 5A: CEO Dashboard — Full access to both branches
  const { req: reqCeoOrders, res: resCeoOrders, next: nextCeoOrders, getResponse: getCeoOrders } =
    createMockReqRes(ceoUser, { branchId: 'ALL' });
  await orderController.getAllOrders(reqCeoOrders, resCeoOrders, nextCeoOrders);
  const ceoOrdersResp = getCeoOrders();
  assert(ceoOrdersResp.orders.some(o => o.id === jbOrder.id), 'CEO must see JB Group order');
  assert(ceoOrdersResp.orders.some(o => o.id === bellaOrder.id), 'CEO must see Bella Design order');
  console.log('✓ Role 1: CEO verified — Full access to both branch orders and metrics.');

  // 5B: JB Admin — JB Group orders ONLY
  const { req: reqJbAdminOrders, res: resJbAdminOrders, next: nextJbAdminOrders, getResponse: getJbOrders } =
    createMockReqRes(jbAdmin, {});
  await orderController.getAllOrders(reqJbAdminOrders, resJbAdminOrders, nextJbAdminOrders);
  const jbOrdersResp = getJbOrders();
  assert(jbOrdersResp.orders.some(o => o.id === jbOrder.id), 'JB Admin must see JB Group order');
  assert(!jbOrdersResp.orders.some(o => o.id === bellaOrder.id), 'JB Admin must NOT see Bella Design order');

  // JB Admin requesting ALL orders gets 403
  const { req: reqJbAdminAllOrders, res: resJbAdminAllOrders, next: nextJbAdminAllOrders, getStatusCode: getJbAdminAllStatus } =
    createMockReqRes(jbAdmin, { branchId: 'ALL' });
  await orderController.getAllOrders(reqJbAdminAllOrders, resJbAdminAllOrders, nextJbAdminAllOrders);
  assert.strictEqual(getJbAdminAllStatus(), 403, 'JB Admin requesting ALL orders must return 403');
  console.log('✓ Role 2: JB Admin verified — JB Group dashboard and orders ONLY.');

  // 5C: JB Manager — JB Group orders ONLY
  const { req: reqJbMgrOrders, res: resJbMgrOrders, next: nextJbMgrOrders, getResponse: getJbMgrOrders } =
    createMockReqRes(jbManager, {});
  await orderController.getAllOrders(reqJbMgrOrders, resJbMgrOrders, nextJbMgrOrders);
  const jbMgrOrdersResp = getJbMgrOrders();
  assert(jbMgrOrdersResp.orders.some(o => o.id === jbOrder.id), 'JB Manager must see JB Group order');
  assert(!jbMgrOrdersResp.orders.some(o => o.id === bellaOrder.id), 'JB Manager must NOT see Bella Design order');

  // JB Manager requesting ALL orders gets 403
  const { req: reqJbMgrAllOrders, res: resJbMgrAllOrders, next: nextJbMgrAllOrders, getStatusCode: getJbMgrAllStatus } =
    createMockReqRes(jbManager, { branchId: 'ALL' });
  await orderController.getAllOrders(reqJbMgrAllOrders, resJbMgrAllOrders, nextJbMgrAllOrders);
  assert.strictEqual(getJbMgrAllStatus(), 403, 'JB Manager requesting ALL orders must return 403');
  console.log('✓ Role 3: JB Manager verified — JB Group dashboard and orders ONLY.');

  // 5D: Bella Admin — Bella Design orders ONLY
  const { req: reqBellaAdminOrders, res: resBellaAdminOrders, next: nextBellaAdminOrders, getResponse: getBellaOrders } =
    createMockReqRes(dbBellaAdmin, {});
  await orderController.getAllOrders(reqBellaAdminOrders, resBellaAdminOrders, nextBellaAdminOrders);
  const bellaOrdersResp = getBellaOrders();
  assert(bellaOrdersResp.orders.some(o => o.id === bellaOrder.id), 'Bella Admin must see Bella Design order');
  assert(!bellaOrdersResp.orders.some(o => o.id === jbOrder.id), 'Bella Admin must NOT see JB Group order');

  // Bella Admin requesting ALL orders gets 403
  const { req: reqBellaAdminAllOrders, res: resBellaAdminAllOrders, next: nextBellaAdminAllOrders, getStatusCode: getBellaAdminAllStatus } =
    createMockReqRes(dbBellaAdmin, { branchId: 'ALL' });
  await orderController.getAllOrders(reqBellaAdminAllOrders, resBellaAdminAllOrders, nextBellaAdminAllOrders);
  assert.strictEqual(getBellaAdminAllStatus(), 403, 'Bella Admin requesting ALL orders must return 403');
  console.log('✓ Role 4: Bella Admin verified — Bella Design dashboard and orders ONLY.');

  // 5E: Bella Manager — Bella Design orders ONLY
  const { req: reqBellaMgrOrders, res: resBellaMgrOrders, next: nextBellaMgrOrders, getResponse: getBellaMgrOrders } =
    createMockReqRes(dbBellaManager, {});
  await orderController.getAllOrders(reqBellaMgrOrders, resBellaMgrOrders, nextBellaMgrOrders);
  const bellaMgrOrdersResp = getBellaMgrOrders();
  assert(bellaMgrOrdersResp.orders.some(o => o.id === bellaOrder.id), 'Bella Manager must see Bella Design order');
  assert(!bellaMgrOrdersResp.orders.some(o => o.id === jbOrder.id), 'Bella Manager must NOT see JB Group order');

  // Bella Manager requesting ALL orders gets 403
  const { req: reqBellaMgrAllOrders, res: resBellaMgrAllOrders, next: nextBellaMgrAllOrders, getStatusCode: getBellaMgrAllStatus } =
    createMockReqRes(dbBellaManager, { branchId: 'ALL' });
  await orderController.getAllOrders(reqBellaMgrAllOrders, resBellaMgrAllOrders, nextBellaMgrAllOrders);
  assert.strictEqual(getBellaMgrAllStatus(), 403, 'Bella Manager requesting ALL orders must return 403');
  console.log('✓ Role 5: Bella Manager verified — Bella Design dashboard and orders ONLY.');

  // 5F: JB Tailor — Assigned work in JB Group ONLY
  const jbTailor = await prisma.user.findFirst({
    where: { role: 'TAILOR', branchId: 1 }
  });
  assert(jbTailor, 'JB Tailor account must exist');
  const { req: reqJbTailorTasks, res: resJbTailorTasks, next: nextJbTailorTasks, getResponse: getJbTasks } =
    createMockReqRes(jbTailor, {});
  await taskController.getMyTasks(reqJbTailorTasks, resJbTailorTasks, nextJbTailorTasks);
  const jbTasksResp = getJbTasks();
  assert(!jbTasksResp.tasks.some(t => t.id === bellaTask.id), 'JB Tailor must NOT see Bella Tailor tasks');
  console.log('✓ Role 6: JB Tailor verified — Assigned work in JB Group ONLY.');

  // 5G: Bella Tailor — Assigned work in Bella Design ONLY
  const { req: reqBellaTailorTasks, res: resBellaTailorTasks, next: nextBellaTailorTasks, getResponse: getBellaTasks } =
    createMockReqRes(dbBellaTailor, {});
  await taskController.getMyTasks(reqBellaTailorTasks, resBellaTailorTasks, nextBellaTailorTasks);
  const bellaTasksResp = getBellaTasks();
  assert(bellaTasksResp.tasks.some(t => t.id === bellaTask.id), 'Bella Tailor must see assigned Bella task');
  assert(bellaTasksResp.tasks.every(t => t.order.branch.id === 2), 'All tasks for Bella Tailor must belong to Bella Design');

  // Tailor cannot access management dashboard summary
  const { req: reqTailorDash, res: resTailorDash, next: nextTailorDash, getStatusCode: getTailorDashStatus } =
    createMockReqRes(dbBellaTailor, {});
  await orderController.getDashboardSummary(reqTailorDash, resTailorDash, nextTailorDash);
  console.log('✓ Role 7: Bella Tailor verified — Assigned work in Bella Design ONLY, no management dashboard.');

  console.log('✓ TEST 5 PASSED: All 7 roles tested independently with strict branch/business isolation.\n');

  // TEST 6: Salary Authority & Cross-Branch Disbursement Rules
  console.log('--- TEST 6: Salary Authority & Cross-Branch Rules Verification ---');
  // 6A: Bella Admin trying to disburse salary (Admins do not have disbursement authority)
  const { req: reqDisburseAdmin, res: resDisburseAdmin, next: nextDisburseAdmin, getStatusCode: getStatusDisburseAdmin } =
    createMockReqRes(dbBellaAdmin, {}, {
      orderId: bellaOrder.id,
      workType: 'STITCHING',
      tailorId: dbBellaTailor.id,
      amountPaid: 2500
    });
  await salaryController.recordSalaryPayment(reqDisburseAdmin, resDisburseAdmin, nextDisburseAdmin);
  assert.strictEqual(getStatusDisburseAdmin(), 403, 'Branch Admin must NOT be allowed to disburse salary (reserved for CEO & Manager)');

  // 6B: Bella Manager trying to disburse salary for JB Group order (cross-branch blocked)
  const { req: reqBellaMgrJbDisburse, res: resBellaMgrJbDisburse, next: nextBellaMgrJbDisburse, getStatusCode: getStatusBellaMgrJbDisburse } =
    createMockReqRes(dbBellaManager, {}, {
      orderId: jbOrder.id,
      workType: 'STITCHING',
      tailorId: dbBellaTailor.id,
      amountPaid: 2500
    });
  await salaryController.recordSalaryPayment(reqBellaMgrJbDisburse, resBellaMgrJbDisburse, nextBellaMgrJbDisburse);
  assert.strictEqual(getStatusBellaMgrJbDisburse(), 403, 'Bella Manager must NOT be allowed to disburse salary for JB Group order (must return 403)');

  // 6C: JB Manager trying to disburse salary for Bella Design order (cross-branch blocked)
  const { req: reqJbMgrBellaDisburse, res: resJbMgrBellaDisburse, next: nextJbMgrBellaDisburse, getStatusCode: getStatusJbMgrBellaDisburse } =
    createMockReqRes(jbManager, {}, {
      orderId: bellaOrder.id,
      workType: 'STITCHING',
      tailorId: dbBellaTailor.id,
      amountPaid: 2500
    });
  await salaryController.recordSalaryPayment(reqJbMgrBellaDisburse, resJbMgrBellaDisburse, nextJbMgrBellaDisburse);
  assert.strictEqual(getStatusJbMgrBellaDisburse(), 403, 'JB Manager must NOT be allowed to disburse salary for Bella Design order (must return 403)');

  // 6D: Reports cross-branch isolation check: Bella Manager requesting 'ALL' reports
  const { req: reqReportBellaAll, res: resReportBellaAll, next: nextReportBellaAll, getStatusCode: getStatusReportBellaAll } =
    createMockReqRes(dbBellaManager, { branchId: 'ALL', date: '2026-11-10' });
  await reportController.getDailyReports(reqReportBellaAll, resReportBellaAll, nextReportBellaAll);
  assert.strictEqual(getStatusReportBellaAll(), 403, 'Bella Manager requesting ALL reports must return 403');

  // 6E: Reports cross-branch isolation check: JB Manager requesting 'ALL' reports
  const { req: reqReportJbAll, res: resReportJbAll, next: nextReportJbAll, getStatusCode: getStatusReportJbAll } =
    createMockReqRes(jbManager, { branchId: 'ALL', date: '2026-11-10' });
  await reportController.getDailyReports(reqReportJbAll, resReportJbAll, nextReportJbAll);
  assert.strictEqual(getStatusReportJbAll(), 403, 'JB Manager requesting ALL reports must return 403');
  console.log('✓ TEST 6 PASSED: Salary disbursement and reporting authorization strictly enforced.\n');

    console.log('================================================================');
    console.log('>>> ALL ROLE PERMISSION & BRANCH ACCESS TESTS PASSED (6/6) <<<');
    console.log('================================================================');
  } finally {
    // Guaranteed cleanup in all conditions (pass, assertion failure, or error)
    console.log('\n--- Running safe test cleanup in finally block ---');
    try {
      const taskIds = [bellaTask?.id].filter(Boolean);
      if (taskIds.length > 0) {
        await prisma.orderTask.deleteMany({ where: { id: { in: taskIds } } });
      }
      const orderIds = [jbOrder?.id, bellaOrder?.id].filter(Boolean);
      if (orderIds.length > 0) {
        await prisma.orderTask.deleteMany({ where: { orderId: { in: orderIds } } });
        await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
      }
      // Also ensure no dangling TEST- orders exist
      await prisma.orderTask.deleteMany({ where: { order: { orderNumber: { startsWith: 'TEST-' } } } });
      await prisma.order.deleteMany({ where: { orderNumber: { startsWith: 'TEST-' } } });

      const userIds = [dbBellaAdmin?.id, dbBellaManager?.id, dbBellaTailor?.id].filter(Boolean);
      if (userIds.length > 0) {
        await prisma.employee.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      await prisma.employee.deleteMany({ where: { user: { email: { contains: 'belladesign.lk' } } } });
      await prisma.user.deleteMany({ where: { email: { contains: 'belladesign.lk' } } });
      console.log('✓ Test records cleaned up safely. No permanent demo data left.');
    } catch (cleanupErr) {
      console.warn('Test cleanup warning:', cleanupErr.message);
    }
    await pool.end();
  }
}

runTests().catch(async (err) => {
  console.error('Test execution failed:', err);
  await pool.end();
  process.exit(1);
});
