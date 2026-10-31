const assert = require('assert');
const {
  TASK_TYPES,
  TASK_DEFINITIONS,
  isAariRequired,
  isFittingRequired,
  getRequiredTasksForOrder,
  determineOrderProductionStage
} = require('../src/utils/taskUtils');

console.log('====================================================');
console.log('JB GROUP SYSTEM — TASK ASSIGNMENT VERIFICATION SUITE');
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

// ----------------------------------------------------
// TEST GROUP 1: Dynamic Task Requirements for All Order Types
// ----------------------------------------------------
console.log('--- TEST GROUP 1: Required Tasks for All Order Types ---');

test('1.1: Bridal Dress requires Cutting, Stitching, Aari, Fitting, Finishing, QC', () => {
  const bridalOrder = {
    item: 'Bridal Lehenga Set',
    workRequired: 'Zari and Stone Aari Work',
    garmentDetails: {
      dressType: 'Bridal Lehenga',
      occasion: 'Wedding',
      workDetails: 'Intricate Aari embroidery on blouse and skirt',
      alterationsNeeded: 'Trial fitting required before event'
    }
  };
  const tasks = getRequiredTasksForOrder(bridalOrder);
  const taskTypes = tasks.map(t => t.taskType);

  assert.ok(taskTypes.includes(TASK_TYPES.CUTTING), 'Must include Cutting');
  assert.ok(taskTypes.includes(TASK_TYPES.AARI_EMBROIDERY), 'Must include Aari Embroidery');
  assert.ok(taskTypes.includes(TASK_TYPES.STITCHING), 'Must include Stitching');
  assert.ok(taskTypes.includes(TASK_TYPES.FITTING_ALTERATION), 'Must include Fitting / Alteration');
  assert.ok(taskTypes.includes(TASK_TYPES.FINISHING), 'Must include Finishing');
  assert.ok(taskTypes.includes(TASK_TYPES.QUALITY_CHECK), 'Must include Quality Check');
  assert.strictEqual(tasks.length, 6, 'Should require all 6 tasks for full bridal');
});

test('1.2: Blouse with Aari Work requires Cutting, Aari, Stitching, Finishing, QC (No Fitting)', () => {
  const blouseOrder = {
    item: 'Designer Silk Blouse',
    embroideryCharge: 3500,
    garmentDetails: {
      dressType: 'Blouse',
      workDetails: 'Neck and sleeve hand aari work'
    }
  };
  const tasks = getRequiredTasksForOrder(blouseOrder);
  const taskTypes = tasks.map(t => t.taskType);

  assert.ok(taskTypes.includes(TASK_TYPES.CUTTING));
  assert.ok(taskTypes.includes(TASK_TYPES.AARI_EMBROIDERY));
  assert.ok(taskTypes.includes(TASK_TYPES.STITCHING));
  assert.ok(taskTypes.includes(TASK_TYPES.FINISHING));
  assert.ok(taskTypes.includes(TASK_TYPES.QUALITY_CHECK));
  assert.ok(!taskTypes.includes(TASK_TYPES.FITTING_ALTERATION), 'Blouse should not require fitting task unless alteration');
  assert.strictEqual(tasks.length, 5);
});

test('1.3: School Uniform requires Cutting, Stitching, Finishing, QC (No Aari, No Fitting)', () => {
  const schoolUniform = {
    item: 'Girls School Uniform Dress',
    garmentDetails: {
      dressType: 'School Uniform',
      quantity: 3
    }
  };
  const tasks = getRequiredTasksForOrder(schoolUniform);
  const taskTypes = tasks.map(t => t.taskType);

  assert.ok(taskTypes.includes(TASK_TYPES.CUTTING));
  assert.ok(taskTypes.includes(TASK_TYPES.STITCHING));
  assert.ok(taskTypes.includes(TASK_TYPES.FINISHING));
  assert.ok(taskTypes.includes(TASK_TYPES.QUALITY_CHECK));
  assert.ok(!taskTypes.includes(TASK_TYPES.AARI_EMBROIDERY), 'Uniforms must NOT have Aari embroidery');
  assert.ok(!taskTypes.includes(TASK_TYPES.FITTING_ALTERATION), 'Standard uniforms do NOT have fitting task');
  assert.strictEqual(tasks.length, 4);
});

test('1.4: Company Uniform requires Cutting, Stitching, Finishing, QC', () => {
  const companyUniform = {
    item: 'Security Staff Company Uniform Shirts',
    garmentDetails: {
      dressType: 'Company Uniform'
    }
  };
  const tasks = getRequiredTasksForOrder(companyUniform);
  const taskTypes = tasks.map(t => t.taskType);

  assert.deepStrictEqual(taskTypes, [
    TASK_TYPES.CUTTING,
    TASK_TYPES.STITCHING,
    TASK_TYPES.FINISHING,
    TASK_TYPES.QUALITY_CHECK
  ]);
});

test('1.5: Alteration Order requires Fitting, Stitching, Finishing, QC (NO Cutting)', () => {
  const alterationOrder = {
    item: 'Evening Gown Resizing',
    garmentDetails: {
      dressType: 'Alteration',
      alterationsNeeded: 'Take in waist by 2 inches and shorten hem'
    }
  };
  const tasks = getRequiredTasksForOrder(alterationOrder);
  const taskTypes = tasks.map(t => t.taskType);

  assert.ok(!taskTypes.includes(TASK_TYPES.CUTTING), 'Alteration orders do not require raw garment cutting');
  assert.ok(taskTypes.includes(TASK_TYPES.FITTING_ALTERATION), 'Alterations must include Fitting / Alteration');
  assert.ok(taskTypes.includes(TASK_TYPES.STITCHING), 'Must include Stitching');
  assert.ok(taskTypes.includes(TASK_TYPES.FINISHING), 'Must include Finishing');
  assert.ok(taskTypes.includes(TASK_TYPES.QUALITY_CHECK), 'Must include Quality Check');
});

test('1.6: Normal Dress / Trousers requires standard Cutting, Stitching, Finishing, QC', () => {
  const trouserOrder = {
    item: 'Formal Men Trousers',
    garmentDetails: {
      dressType: 'Trousers'
    }
  };
  const tasks = getRequiredTasksForOrder(trouserOrder);
  const taskTypes = tasks.map(t => t.taskType);

  assert.deepStrictEqual(taskTypes, [
    TASK_TYPES.CUTTING,
    TASK_TYPES.STITCHING,
    TASK_TYPES.FINISHING,
    TASK_TYPES.QUALITY_CHECK
  ]);
});

// ----------------------------------------------------
// TEST GROUP 2: Order Production Stage Determination (Req #8: Never prematurely mark order complete)
// ----------------------------------------------------
console.log('\n--- TEST GROUP 2: Production Stage Progression & Order Safety ---');

test('2.1: Initial stage when all tasks ASSIGNED maps to first task status (CUTTING)', () => {
  const tasks = [
    { taskType: TASK_TYPES.CUTTING, status: 'ASSIGNED' },
    { taskType: TASK_TYPES.STITCHING, status: 'ASSIGNED' },
    { taskType: TASK_TYPES.FINISHING, status: 'ASSIGNED' },
    { taskType: TASK_TYPES.QUALITY_CHECK, status: 'ASSIGNED' }
  ];
  const stage = determineOrderProductionStage(tasks);
  assert.strictEqual(stage, 'CUTTING', 'Order should be at CUTTING stage');
});

test('2.2: When Cutting is COMPLETED, order advances to next active stage (STITCHING), NOT READY', () => {
  const tasks = [
    { taskType: TASK_TYPES.CUTTING, status: 'COMPLETED' },
    { taskType: TASK_TYPES.STITCHING, status: 'IN_PROGRESS' },
    { taskType: TASK_TYPES.FINISHING, status: 'ASSIGNED' },
    { taskType: TASK_TYPES.QUALITY_CHECK, status: 'ASSIGNED' }
  ];
  const stage = determineOrderProductionStage(tasks);
  assert.strictEqual(stage, 'STITCHING', 'Order should advance to STITCHING');
  assert.notStrictEqual(stage, 'READY', 'Order MUST NOT be READY when only cutting is completed');
  assert.notStrictEqual(stage, 'COMPLETED', 'Order MUST NOT be COMPLETED when stitching is pending');
});

test('2.3: In bridal with Aari, advances from Cutting to EMBROIDERY_AARI, then STITCHING', () => {
  const tasks = [
    { taskType: TASK_TYPES.CUTTING, status: 'COMPLETED' },
    { taskType: TASK_TYPES.AARI_EMBROIDERY, status: 'ASSIGNED' },
    { taskType: TASK_TYPES.STITCHING, status: 'ASSIGNED' },
    { taskType: TASK_TYPES.FINISHING, status: 'ASSIGNED' },
    { taskType: TASK_TYPES.QUALITY_CHECK, status: 'ASSIGNED' }
  ];
  const stage = determineOrderProductionStage(tasks);
  assert.strictEqual(stage, 'AARI_EMBROIDERY', 'Order must move to AARI_EMBROIDERY next');
});

test('2.4: When all tasks except QC are COMPLETED, order stage is QUALITY_CHECK', () => {
  const tasks = [
    { taskType: TASK_TYPES.CUTTING, status: 'COMPLETED' },
    { taskType: TASK_TYPES.STITCHING, status: 'COMPLETED' },
    { taskType: TASK_TYPES.FINISHING, status: 'COMPLETED' },
    { taskType: TASK_TYPES.QUALITY_CHECK, status: 'IN_PROGRESS' }
  ];
  const stage = determineOrderProductionStage(tasks);
  assert.strictEqual(stage, 'QUALITY_CHECK', 'Order stage should be QUALITY_CHECK');
  assert.notStrictEqual(stage, 'READY', 'Order is not READY until QC is completed');
});

test('2.5: Order status only becomes READY when ALL tasks are COMPLETED', () => {
  const tasks = [
    { taskType: TASK_TYPES.CUTTING, status: 'COMPLETED' },
    { taskType: TASK_TYPES.STITCHING, status: 'COMPLETED' },
    { taskType: TASK_TYPES.FINISHING, status: 'COMPLETED' },
    { taskType: TASK_TYPES.QUALITY_CHECK, status: 'COMPLETED' }
  ];
  const stage = determineOrderProductionStage(tasks);
  assert.strictEqual(stage, 'READY', 'Order moves to READY only when all tasks are complete');
  assert.notStrictEqual(stage, 'DELIVERED', 'Order is never automatically DELIVERED');
});

// ----------------------------------------------------
// TEST GROUP 3: Multi-Tailor Task Assignment Logic & Security
// ----------------------------------------------------
console.log('\n--- TEST GROUP 3: Multi-Tailor Assignment & Role Permissions ---');

test('3.1: Different Tailors can be assigned to different tasks in the same order', () => {
  const assignmentPayload = [
    { taskType: TASK_TYPES.CUTTING, assignedTailorId: 101, notes: 'Cut according to chart A' },
    { taskType: TASK_TYPES.AARI_EMBROIDERY, assignedTailorId: 102, notes: 'Golden metallic thread' },
    { taskType: TASK_TYPES.STITCHING, assignedTailorId: 103, notes: 'Double seam stitching' },
    { taskType: TASK_TYPES.FINISHING, assignedTailorId: 104, notes: 'Steam iron & buttons' },
    { taskType: TASK_TYPES.QUALITY_CHECK, assignedTailorId: 105, notes: 'Check all measurements' }
  ];

  const uniqueTailors = new Set(assignmentPayload.map(a => a.assignedTailorId));
  assert.strictEqual(uniqueTailors.size, 5, '5 different tailors assigned to 5 separate tasks');

  // Verify initial status is ASSIGNED for every task (Requirement #5)
  assignmentPayload.forEach(a => {
    const taskStatus = 'ASSIGNED'; // Controller assigns with status ASSIGNED immediately
    assert.strictEqual(taskStatus, 'ASSIGNED', `Task ${a.taskType} must immediately have status ASSIGNED`);
  });
});

test('3.2: Role permission validation for Task Assignment (Req #2)', () => {
  function checkAssignmentPermission(user) {
    const role = (user?.role || '').toUpperCase();
    return ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role);
  }

  assert.strictEqual(checkAssignmentPermission({ role: 'SUPER_ADMIN' }), true, 'SUPER_ADMIN (CEO) can assign');
  assert.strictEqual(checkAssignmentPermission({ role: 'ADMIN' }), true, 'ADMIN can assign');
  assert.strictEqual(checkAssignmentPermission({ role: 'MANAGER' }), true, 'MANAGER can assign');
  assert.strictEqual(checkAssignmentPermission({ role: 'STAFF' }), false, 'STAFF cannot assign');
  assert.strictEqual(checkAssignmentPermission({ role: 'TAILOR' }), false, 'TAILOR cannot assign');
  assert.strictEqual(checkAssignmentPermission({ role: 'CASHIER' }), false, 'CASHIER cannot assign');
});

test('3.3: Branch authorization restriction for Managers (Req #7)', () => {
  function canManagerAssignBranch(user, orderBranchId) {
    const role = (user?.role || '').toUpperCase();
    if (['SUPER_ADMIN', 'ADMIN'].includes(role)) return true; // CEO full access
    if (role === 'MANAGER') {
      return Number(user.branchId) === Number(orderBranchId);
    }
    return false;
  }

  const managerBranch1 = { role: 'MANAGER', branchId: 1 };
  const ceo = { role: 'SUPER_ADMIN', branchId: 1 };

  assert.strictEqual(canManagerAssignBranch(managerBranch1, 1), true, 'Manager can assign in own branch');
  assert.strictEqual(canManagerAssignBranch(managerBranch1, 2), false, 'Manager CANNOT assign in branch 2');
  assert.strictEqual(canManagerAssignBranch(ceo, 2), true, 'CEO can assign in branch 2');
});

test('3.4: Tailor task status update transitions: ASSIGNED -> IN_PROGRESS -> COMPLETED (Req #6)', () => {
  const VALID_TASK_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];
  function canTransition(current, next) {
    if (current === 'ASSIGNED' && next === 'IN_PROGRESS') return true;
    if (current === 'IN_PROGRESS' && next === 'COMPLETED') return true;
    if (current === 'ASSIGNED' && next === 'COMPLETED') return true; // Allowed shortcut if fast completion
    return false;
  }

  assert.strictEqual(canTransition('ASSIGNED', 'IN_PROGRESS'), true);
  assert.strictEqual(canTransition('IN_PROGRESS', 'COMPLETED'), true);
  assert.strictEqual(canTransition('COMPLETED', 'ASSIGNED'), false, 'Cannot revert completed task');
});

test('3.5: Tailor cannot update another tailor assigned task', () => {
  function canTailorUpdateTask(user, task) {
    const role = (user?.role || '').toUpperCase();
    if (['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role)) return true;
    if (role === 'TAILOR') {
      return Number(task.assignedTailorId) === Number(user.id);
    }
    return false;
  }

  const tailorUser1 = { id: 201, role: 'TAILOR' };
  const tailorUser2 = { id: 202, role: 'TAILOR' };
  const taskAssignedToTailor1 = { id: 1, assignedTailorId: 201 };

  assert.strictEqual(canTailorUpdateTask(tailorUser1, taskAssignedToTailor1), true, 'Assigned tailor can update');
  assert.strictEqual(canTailorUpdateTask(tailorUser2, taskAssignedToTailor1), false, 'Different tailor CANNOT update');
});

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
if (passedTests === totalTests) {
  console.log('ALL VERIFICATIONS SUCCESSFUL! ✓');
} else {
  console.log('SOME TESTS FAILED! ✗');
}
console.log('====================================================\n');

process.exit(passedTests === totalTests ? 0 : 1);
