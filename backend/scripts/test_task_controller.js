const assert = require('assert');
const {
  TASK_TYPES,
  TASK_DEFINITIONS,
  getRequiredTasksForOrder,
  determineOrderProductionStage
} = require('../src/utils/taskUtils');

console.log('====================================================');
console.log('JB GROUP SYSTEM — TASK CONTROLLER & API MOCK TESTS');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [FAIL] ${description}`);
    console.error(`  Error: ${err.message}`);
  }
}

// Mock database storage
const db = {
  users: [
    { id: 1, name: 'CEO Super Admin', role: 'SUPER_ADMIN', branchId: 1 },
    { id: 2, name: 'Manager Batticaloa', role: 'MANAGER', branchId: 1 },
    { id: 3, name: 'Manager Colombo', role: 'MANAGER', branchId: 2 },
    { id: 10, name: 'Staff User', role: 'STAFF', branchId: 1 },
    { id: 20, name: 'Tailor Ramesh (Cutting & Stitching)', role: 'TAILOR', branchId: 1 },
    { id: 21, name: 'Tailor Priya (Aari Art)', role: 'TAILOR', branchId: 1 },
    { id: 22, name: 'Tailor Kamal (Colombo Branch)', role: 'TAILOR', branchId: 2 },
    { id: 30, name: 'Cashier User', role: 'CASHIER', branchId: 1 }
  ],
  orders: [
    {
      id: 501,
      orderNumber: 'ORD-2026-501',
      branchId: 1,
      status: 'APPROVED',
      priceStatus: 'ACCEPTED',
      item: 'Bridal Saree & Blouse',
      garmentDetails: {
        dressType: 'Bridal Blouse',
        occasion: 'Wedding',
        workRequired: true,
        workDetails: 'Aari stone work and embroidery'
      },
      tasks: [],
      tailorAccepted: false
    },
    {
      id: 502,
      orderNumber: 'ORD-2026-502',
      branchId: 2, // Colombo Branch order
      status: 'APPROVED',
      priceStatus: 'ACCEPTED',
      item: 'School Uniform Set',
      garmentDetails: {
        dressType: 'School Uniform'
      },
      tasks: [],
      tailorAccepted: false
    }
  ],
  orderTasks: []
};

// Helper to simulate mock controller functions
function mockAssignTasks({ user, orderId, tasks }) {
  // 1. Role verification (Req #2)
  const role = (user?.role || '').toUpperCase();
  if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role)) {
    return { status: 403, body: { success: false, message: 'Unauthorized. Only CEO and Managers can assign tasks.' } };
  }

  // 2. Order retrieval & branch restriction (Req #7)
  const order = db.orders.find(o => o.id === orderId);
  if (!order) {
    return { status: 404, body: { success: false, message: 'Order not found.' } };
  }

  if (role === 'MANAGER' && Number(order.branchId) !== Number(user.branchId)) {
    return { status: 403, body: { success: false, message: 'Forbidden. Managers can only assign tasks for orders in their authorized branch.' } };
  }

  // 3. Tailor branch verification
  for (const t of tasks) {
    if (t.assignedTailorId) {
      const tailor = db.users.find(u => u.id === t.assignedTailorId && u.role === 'TAILOR');
      if (!tailor) {
        return { status: 400, body: { success: false, message: `Tailor ID ${t.assignedTailorId} not found.` } };
      }
      if (role === 'MANAGER' && Number(tailor.branchId) !== Number(user.branchId)) {
        return { status: 403, body: { success: false, message: `Cannot assign tailor from branch ${tailor.branchId} to order in branch ${order.branchId}.` } };
      }
    }
  }

  // 4. Assign tasks immediately with status ASSIGNED (Req #5 - no tailor acceptance)
  const createdTasks = [];
  tasks.forEach((t, index) => {
    const taskDef = TASK_DEFINITIONS[t.taskType] || { name: t.taskType, defaultSequence: index + 1 };
    const newTask = {
      id: db.orderTasks.length + 1,
      orderId: order.id,
      taskType: t.taskType,
      taskName: taskDef.name || t.taskType,
      assignedTailorId: t.assignedTailorId || null,
      assignedById: user.id,
      assignedBy: user.name,
      assignedAt: new Date(),
      status: 'ASSIGNED', // Immediately ASSIGNED without tailor acceptance
      startedAt: null,
      completedAt: null,
      notes: t.notes || null,
      sequence: t.sequence || index + 1,
      branchId: order.branchId
    };
    db.orderTasks.push(newTask);
    createdTasks.push(newTask);
  });

  order.tasks = createdTasks;
  order.tailorAccepted = true; // Acceptance step bypassed
  order.tailorAcceptedAt = new Date();

  // Determine stage
  const nextStage = determineOrderProductionStage(createdTasks);
  order.status = nextStage;

  return {
    status: 200,
    body: {
      success: true,
      message: 'Production tasks assigned successfully. Tasks are immediately ASSIGNED without tailor acceptance.',
      tasks: createdTasks,
      orderStatus: order.status
    }
  };
}

function mockGetMyTasks({ user, statusFilter }) {
  if (user.role !== 'TAILOR') {
    return { status: 403, body: { success: false, message: 'Access denied. Tailor role required.' } };
  }

  let tasks = db.orderTasks.filter(t => t.assignedTailorId === user.id);
  if (statusFilter && statusFilter !== 'ALL') {
    tasks = tasks.filter(t => t.status === statusFilter);
  }

  return {
    status: 200,
    body: {
      success: true,
      tasks,
      counts: {
        total: db.orderTasks.filter(t => t.assignedTailorId === user.id).length,
        assigned: db.orderTasks.filter(t => t.assignedTailorId === user.id && t.status === 'ASSIGNED').length,
        inProgress: db.orderTasks.filter(t => t.assignedTailorId === user.id && t.status === 'IN_PROGRESS').length,
        completed: db.orderTasks.filter(t => t.assignedTailorId === user.id && t.status === 'COMPLETED').length
      }
    }
  };
}

function mockUpdateTaskStatus({ user, taskId, newStatus }) {
  const task = db.orderTasks.find(t => t.id === taskId);
  if (!task) return { status: 404, body: { success: false, message: 'Task not found' } };

  // Permission check
  const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user.role);
  if (!isPrivileged && (user.role !== 'TAILOR' || Number(task.assignedTailorId) !== Number(user.id))) {
    return { status: 403, body: { success: false, message: 'Unauthorized to update this task' } };
  }

  task.status = newStatus;
  if (newStatus === 'IN_PROGRESS' && !task.startedAt) {
    task.startedAt = new Date();
  }
  if (newStatus === 'COMPLETED') {
    task.completedAt = new Date();
  }

  // Update order stage
  const order = db.orders.find(o => o.id === task.orderId);
  const allOrderTasks = db.orderTasks.filter(t => t.orderId === order.id);
  const nextStage = determineOrderProductionStage(allOrderTasks);
  order.status = nextStage;

  return {
    status: 200,
    body: {
      success: true,
      task,
      orderStatus: order.status
    }
  };
}

// ----------------------------------------------------
// TEST GROUP 4: Controller Authorization & Security
// ----------------------------------------------------
console.log('--- TEST GROUP 4: Controller Assignment & Security Tests ---');

test('4.1: Staff, Tailor, Cashier are rejected from assigning tasks (403)', () => {
  const staff = db.users.find(u => u.role === 'STAFF');
  const tailor = db.users.find(u => u.role === 'TAILOR');
  const cashier = db.users.find(u => u.role === 'CASHIER');

  const payload = [{ taskType: 'CUTTING', assignedTailorId: 20 }];

  assert.strictEqual(mockAssignTasks({ user: staff, orderId: 501, tasks: payload }).status, 403);
  assert.strictEqual(mockAssignTasks({ user: tailor, orderId: 501, tasks: payload }).status, 403);
  assert.strictEqual(mockAssignTasks({ user: cashier, orderId: 501, tasks: payload }).status, 403);
});

test('4.2: Manager cannot assign tasks on order in another branch (403)', () => {
  const managerBatticaloa = db.users.find(u => u.id === 2); // branchId: 1
  const colomboOrder = 502; // branchId: 2

  const res = mockAssignTasks({
    user: managerBatticaloa,
    orderId: colomboOrder,
    tasks: [{ taskType: 'CUTTING', assignedTailorId: 22 }]
  });

  assert.strictEqual(res.status, 403);
  assert.ok(res.body.message.includes('authorized branch'));
});

test('4.3: Manager cannot assign a tailor from another branch (403)', () => {
  const managerBatticaloa = db.users.find(u => u.id === 2); // branchId: 1
  const ownBranchOrder = 501; // branchId: 1
  const colomboTailor = 22; // branchId: 2

  const res = mockAssignTasks({
    user: managerBatticaloa,
    orderId: ownBranchOrder,
    tasks: [{ taskType: 'CUTTING', assignedTailorId: colomboTailor }]
  });

  assert.strictEqual(res.status, 403);
  assert.ok(res.body.message.includes('Cannot assign tailor from branch 2'));
});

test('4.4: CEO (SUPER_ADMIN) can assign tasks across branches', () => {
  const ceo = db.users.find(u => u.role === 'SUPER_ADMIN');
  const res = mockAssignTasks({
    user: ceo,
    orderId: 502, // Branch 2 order
    tasks: [
      { taskType: 'CUTTING', assignedTailorId: 22 },
      { taskType: 'STITCHING', assignedTailorId: 22 },
      { taskType: 'FINISHING', assignedTailorId: 22 },
      { taskType: 'QUALITY_CHECK', assignedTailorId: 22 }
    ]
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
});

// ----------------------------------------------------
// TEST GROUP 5: Immediate ASSIGNED Visibility & Progress
// ----------------------------------------------------
console.log('\n--- TEST GROUP 5: Immediate Visibility & Progress Updates ---');

test('5.1: Assigning tasks sets status immediately to ASSIGNED (no acceptance needed)', () => {
  const manager = db.users.find(u => u.id === 2); // Branch 1
  const res = mockAssignTasks({
    user: manager,
    orderId: 501,
    tasks: [
      { taskType: 'CUTTING', assignedTailorId: 20 },
      { taskType: 'AARI_EMBROIDERY', assignedTailorId: 21 },
      { taskType: 'STITCHING', assignedTailorId: 20 },
      { taskType: 'FINISHING', assignedTailorId: 20 },
      { taskType: 'QUALITY_CHECK', assignedTailorId: 20 }
    ]
  });

  assert.strictEqual(res.status, 200);
  res.body.tasks.forEach(t => {
    assert.strictEqual(t.status, 'ASSIGNED', 'Task status must be immediately ASSIGNED');
  });

  const order = db.orders.find(o => o.id === 501);
  assert.strictEqual(order.tailorAccepted, true, 'tailorAccepted must be true');
});

test('5.2: Tailor 20 sees assigned Cutting, Stitching, Finishing, QC in getMyTasks', () => {
  const tailor20 = db.users.find(u => u.id === 20);
  const res = mockGetMyTasks({ user: tailor20, statusFilter: 'ALL' });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.tasks.length, 4, 'Tailor 20 has 4 tasks');
  assert.strictEqual(res.body.counts.assigned, 4, 'All 4 tasks start with ASSIGNED');
});

test('5.3: Tailor 21 sees Aari Embroidery task in getMyTasks', () => {
  const tailor21 = db.users.find(u => u.id === 21);
  const res = mockGetMyTasks({ user: tailor21, statusFilter: 'ALL' });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.tasks.length, 1, 'Tailor 21 has 1 Aari task');
  assert.strictEqual(res.body.tasks[0].taskType, 'AARI_EMBROIDERY');
});

test('5.4: Tailor 21 cannot modify Tailor 20 task (403)', () => {
  const tailor21 = db.users.find(u => u.id === 21);
  const tailor20Task = db.orderTasks.find(t => t.assignedTailorId === 20);

  const res = mockUpdateTaskStatus({
    user: tailor21,
    taskId: tailor20Task.id,
    newStatus: 'IN_PROGRESS'
  });

  assert.strictEqual(res.status, 403, 'Tailor 21 cannot touch Tailor 20 task');
});

test('5.5: Tailor 20 starts Cutting -> Status becomes IN_PROGRESS', () => {
  const tailor20 = db.users.find(u => u.id === 20);
  const cuttingTask = db.orderTasks.find(t => t.taskType === 'CUTTING' && t.orderId === 501);

  const res = mockUpdateTaskStatus({
    user: tailor20,
    taskId: cuttingTask.id,
    newStatus: 'IN_PROGRESS'
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.task.status, 'IN_PROGRESS');
  assert.ok(res.body.task.startedAt !== null, 'startedAt must be recorded');
  assert.strictEqual(res.body.orderStatus, 'CUTTING', 'Order status remains CUTTING while in progress');
});

test('5.6: Tailor 20 completes Cutting -> Order advances to AARI_EMBROIDERY, NOT READY or COMPLETED', () => {
  const tailor20 = db.users.find(u => u.id === 20);
  const cuttingTask = db.orderTasks.find(t => t.taskType === 'CUTTING' && t.orderId === 501);

  const res = mockUpdateTaskStatus({
    user: tailor20,
    taskId: cuttingTask.id,
    newStatus: 'COMPLETED'
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.task.status, 'COMPLETED');
  assert.ok(res.body.task.completedAt !== null, 'completedAt must be recorded');
  assert.strictEqual(res.body.orderStatus, 'AARI_EMBROIDERY', 'Order moves to AARI_EMBROIDERY');
  assert.notStrictEqual(res.body.orderStatus, 'READY');
  assert.notStrictEqual(res.body.orderStatus, 'COMPLETED');
});

test('5.7: Completing remaining tasks (Aari, Stitching, Finishing, QC) moves order to READY', () => {
  const tailor21 = db.users.find(u => u.id === 21);
  const tailor20 = db.users.find(u => u.id === 20);

  const aariTask = db.orderTasks.find(t => t.taskType === 'AARI_EMBROIDERY' && t.orderId === 501);
  const stitchingTask = db.orderTasks.find(t => t.taskType === 'STITCHING' && t.orderId === 501);
  const finishingTask = db.orderTasks.find(t => t.taskType === 'FINISHING' && t.orderId === 501);
  const qcTask = db.orderTasks.find(t => t.taskType === 'QUALITY_CHECK' && t.orderId === 501);

  mockUpdateTaskStatus({ user: tailor21, taskId: aariTask.id, newStatus: 'COMPLETED' });
  mockUpdateTaskStatus({ user: tailor20, taskId: stitchingTask.id, newStatus: 'COMPLETED' });
  mockUpdateTaskStatus({ user: tailor20, taskId: finishingTask.id, newStatus: 'COMPLETED' });
  const finalRes = mockUpdateTaskStatus({ user: tailor20, taskId: qcTask.id, newStatus: 'COMPLETED' });

  assert.strictEqual(finalRes.status, 200);
  assert.strictEqual(finalRes.body.orderStatus, 'READY', 'Order status must be READY when all tasks are complete');
  assert.notStrictEqual(finalRes.body.orderStatus, 'DELIVERED', 'Order is never automatically DELIVERED');
});

console.log('\n====================================================');
console.log(`CONTROLLER TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
if (passedTests === totalTests) {
  console.log('ALL CONTROLLER & WORKFLOW VERIFICATIONS SUCCESSFUL! ✓');
} else {
  console.log('SOME TESTS FAILED! ✗');
}
console.log('====================================================\n');

process.exit(passedTests === totalTests ? 0 : 1);
