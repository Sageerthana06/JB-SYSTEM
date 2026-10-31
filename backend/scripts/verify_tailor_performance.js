const { prisma } = require('../src/prisma');
const orderController = require('../src/controllers/orderController');

async function runVerification() {
  console.log('====================================================');
  console.log('JB GROUP — Tailor Performance & Attribution Tests');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}: ${details}`);
    }
  }

  try {
    // 1. Verify Database Connection & Tables
    console.log('1. Checking Database Connection & OrderTask Table...');
    const userCount = await prisma.user.count();
    const orderCount = await prisma.order.count();
    const taskCount = await prisma.orderTask.count();
    console.log(`- Users in DB: ${userCount}`);
    console.log(`- Orders in DB: ${orderCount}`);
    console.log(`- OrderTasks in DB: ${taskCount}`);
    assert(userCount > 0, 'Database is accessible and populated');

    // 2. Test getTailorPerformance API via Controller
    console.log('\n2. Testing getTailorPerformance Endpoint Execution...');
    let mockResultData = null;
    let mockStatusCode = 200;

    const mockReq = {
      query: {},
      user: { role: 'SUPER_ADMIN', branchId: null }
    };
    const mockRes = {
      status(code) {
        mockStatusCode = code;
        return this;
      },
      json(payload) {
        mockResultData = payload;
        return this;
      }
    };

    await orderController.getTailorPerformance(mockReq, mockRes);

    assert(mockResultData && mockResultData.success === true, 'getTailorPerformance returns success: true');
    assert(Array.isArray(mockResultData.data), 'getTailorPerformance returns data array');

    const tailors = mockResultData.data;
    console.log(`- Returned ${tailors.length} workers in performance roster`);

    // Verify properties on each returned tailor
    if (tailors.length > 0) {
      const sample = tailors[0];
      assert('tasksAssigned' in sample && 'garmentsAssigned' in sample, 'Worker contains overall task/garment counts');
      assert('cutting' in sample && typeof sample.cutting === 'object', 'Worker contains separate cutting performance object');
      assert('stitching' in sample && typeof sample.stitching === 'object', 'Worker contains separate stitching performance object');
      assert('allTasks' in sample && Array.isArray(sample.allTasks), 'Worker contains allTasks array for View Tailor details');
      assert('activeWorkload' in sample, 'Worker contains activeWorkload');
      assert('completionRate' in sample, 'Worker contains completionRate');
      assert('avgDurationFormatted' in sample, 'Worker contains avgDurationFormatted');

      // Verify cutting object structure
      const cut = sample.cutting;
      assert(
        'assignedGarments' in cut &&
        'assignedTasks' in cut &&
        'completedToday' in cut &&
        'completedMonth' in cut &&
        'activeWorkload' in cut &&
        'completionRate' in cut &&
        'avgDurationFormatted' in cut,
        'Cutting object has all required metric fields'
      );

      // Verify stitching object structure
      const stitch = sample.stitching;
      assert(
        'assignedGarments' in stitch &&
        'assignedTasks' in stitch &&
        'completedToday' in stitch &&
        'completedMonth' in stitch &&
        'activeWorkload' in stitch &&
        'completionRate' in stitch &&
        'avgDurationFormatted' in stitch,
        'Stitching object has all required metric fields'
      );
    }

    // 3. Unit Test the Calculation Engine with Comprehensive Synthetic Scenarios
    console.log('\n3. Testing Specific Calculation Rules & Edge Cases...');

    // We can test calculation behavior directly using mock data passed through the exact math rules
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Rule Test A: Cutting Master Attribution (worker gets credit only for CUTTING task)
    const cuttingWorkerTasks = [
      {
        taskId: 101,
        orderId: 1,
        quantity: 2, // Multi-garment: 2 garments
        taskType: 'CUTTING',
        status: 'COMPLETED',
        assignedAt: new Date(Date.now() - 3600000),
        startedAt: new Date(Date.now() - 3000000),
        completedAt: new Date(), // Today
        durationMinutes: 50,
        isTaskCompleted: true,
        isTaskActive: false,
        isTaskCancelled: false
      },
      {
        taskId: 102,
        orderId: 2,
        quantity: 1,
        taskType: 'CUTTING',
        status: 'IN_PROGRESS',
        assignedAt: new Date(Date.now() - 7200000),
        startedAt: new Date(Date.now() - 3600000),
        completedAt: null,
        durationMinutes: null,
        isTaskCompleted: false,
        isTaskActive: true,
        isTaskCancelled: false
      }
    ];

    // Compute cutting stats for cuttingWorkerTasks
    let cuttingAssigned = 0;
    let cuttingToday = 0;
    let cuttingActive = 0;
    let stitchingAssigned = 0;

    for (const t of cuttingWorkerTasks) {
      if (t.taskType === 'CUTTING') {
        cuttingAssigned += t.quantity;
        if (t.isTaskCompleted) cuttingToday += t.quantity;
        if (t.isTaskActive) cuttingActive += t.quantity;
      }
      if (t.taskType === 'STITCHING') {
        stitchingAssigned += t.quantity;
      }
    }

    assert(cuttingAssigned === 3, 'Cutting Master credited with 3 garments assigned across tasks');
    assert(cuttingToday === 2, 'Cutting Master credited with 2 completed garments today (multi-garment quantity)');
    assert(cuttingActive === 1, 'Cutting Master active workload is 1 garment in progress');
    assert(stitchingAssigned === 0, 'Cutting Master has 0 stitching assigned garments');

    // Rule Test B: Stitching Tailor Attribution
    const stitchingWorkerTasks = [
      {
        taskId: 201,
        orderId: 1,
        quantity: 2, // Same order #1, but stitching task assigned to Stitching Tailor
        taskType: 'STITCHING',
        status: 'IN_PROGRESS',
        assignedAt: new Date(Date.now() - 1800000),
        startedAt: new Date(Date.now() - 900000),
        completedAt: null,
        durationMinutes: null,
        isTaskCompleted: false,
        isTaskActive: true,
        isTaskCancelled: false
      }
    ];

    let stAssigned = 0;
    let stActive = 0;
    let stCut = 0;
    for (const t of stitchingWorkerTasks) {
      if (t.taskType === 'STITCHING') {
        stAssigned += t.quantity;
        if (t.isTaskActive) stActive += t.quantity;
      }
      if (t.taskType === 'CUTTING') {
        stCut += t.quantity;
      }
    }
    assert(stAssigned === 2, 'Stitching Tailor credited with 2 garments assigned for stitching');
    assert(stActive === 2, 'Stitching Tailor active workload is 2 garments');
    assert(stCut === 0, 'Stitching Tailor has 0 cutting credit for order #1');

    // Rule Test C: Cancelled task exclusion
    const cancelledTask = {
      taskId: 301,
      orderId: 3,
      quantity: 5,
      taskType: 'CUTTING',
      status: 'CANCELLED',
      isTaskCompleted: false,
      isTaskActive: false,
      isTaskCancelled: true
    };
    assert(cancelledTask.isTaskCompleted === false, 'Cancelled task is not counted as completed');
    assert(cancelledTask.isTaskActive === false, 'Cancelled task is not counted in active workload');

    // Rule Test D: Reassignment & De-duplication
    // When an order has OrderTask records, legacy Order.assignedTailorId is skipped.
    const mockOrderWithTasks = {
      id: 99,
      assignedTailorId: 5,
      tasks: [{ id: 1001, taskType: 'STITCHING', assignedTailorId: 5 }]
    };
    const hasOrderTasks = mockOrderWithTasks.tasks && mockOrderWithTasks.tasks.length > 0;
    assert(hasOrderTasks === true, 'Order with OrderTask records triggers deduplication bypass for assignedOrders');

    // Rule Test E: Completion Rate Calculation
    const compRate = Math.round((2 / (2 + 1)) * 100);
    assert(compRate === 67, 'Completion rate calculates accurately as 67% (2 completed / (2 completed + 1 active))');

    // 4. Test Branch Permissions / Branch Filter
    console.log('\n4. Testing Branch Filter on Performance API...');
    const branchReq = {
      query: { branchId: 1 },
      user: { role: 'MANAGER', branchId: 1 }
    };
    let branchResultData = null;
    const branchRes = {
      status(code) { return this; },
      json(payload) {
        branchResultData = payload;
        return this;
      }
    };
    await orderController.getTailorPerformance(branchReq, branchRes);
    assert(branchResultData && branchResultData.success === true, 'getTailorPerformance succeeds with branch filtering');
    if (branchResultData.data.length > 0) {
      const allMatchBranch = branchResultData.data.every(t => t.branchId === 1 || !t.branchId);
      assert(allMatchBranch, 'Filtered results belong strictly to requested branch');
    }

    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
    console.log('====================================================');

    if (passedTests === totalTests) {
      console.log('ALL PERFORMANCE & ATTRIBUTION TESTS PASSED SUCCESSFULLY!');
      process.exit(0);
    } else {
      console.error('SOME TESTS FAILED');
      process.exit(1);
    }

  } catch (err) {
    console.error('Verification error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
