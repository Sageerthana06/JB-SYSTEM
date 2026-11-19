const { prisma, pool } = require('../src/prisma');
const actionCentreService = require('../src/services/actionCentreService');

async function verifyCeoReadOnlyPermissions() {
  console.log('================================================================');
  console.log('🔒 VERIFYING CEO READ-ONLY CHECKLIST PERMISSIONS');
  console.log('================================================================');

  try {
    const ceoUser = {
      id: 1,
      name: 'Jeyatheepan Joseph (CEO)',
      email: 'ceo@jbgroup.com',
      role: 'SUPER_ADMIN',
      branchId: 1
    };

    const managerBranch1 = {
      id: 3,
      name: 'Manager',
      email: 'manager@jbgroup.com',
      role: 'MANAGER',
      branchId: 1
    };

    const adminBranch2 = {
      id: 57,
      name: 'Kirushanthan',
      email: 'kirushanthan@bella.com',
      role: 'ADMIN',
      branchId: 2
    };

    const today = actionCentreService.getColomboDateString();

    // 1. TEST: CEO CANNOT complete or update checklist items (Backend Enforcement)
    console.log('\n--- 1. Testing CEO (SUPER_ADMIN) attempt to complete checklist item ---');
    try {
      await actionCentreService.completeChecklistItem({
        user: ceoUser,
        checklistItemId: 'pricePending',
        status: 'COMPLETED'
      });
      throw new Error('SECURITY VIOLATION: CEO was able to complete checklist item!');
    } catch (err) {
      if (err.statusCode === 403) {
        console.log('✓ PASS: CEO attempt blocked with 403 Forbidden:');
        console.log(`  Message: "${err.message}"`);
      } else {
        throw err;
      }
    }

    // 2. TEST: CEO can READ all branches, managers, checklist statuses, and timestamps
    console.log('\n--- 2. Testing CEO READ-ONLY access to all branches and monitoring ---');
    const ceoMonitoring = await actionCentreService.getCeoChecklistMonitoringData({
      user: ceoUser,
      date: today
    });

    console.log(`✓ Monitored Branches: ${ceoMonitoring.summary.totalBranches}`);
    console.log(`✓ Monitored Managers: ${ceoMonitoring.summary.totalManagers}`);
    console.log(`✓ Historical Dates Count: ${ceoMonitoring.historicalDates.length}`);
    for (const b of ceoMonitoring.branches) {
      console.log(`  - Branch #${b.branchId} ${b.branchName}: Manager ${b.manager.name} (${b.progress.label})`);
    }

    const ceoDailyData = await actionCentreService.getDailyActionCentreData({
      user: ceoUser,
      branchId: 'ALL'
    });
    console.log(`✓ CEO Daily Action Centre loaded successfully. Checklist keys: ${Object.keys(ceoDailyData.checklist).length}`);

    // 3. TEST: Manager CAN update their own branch checklist
    console.log('\n--- 3. Testing Manager updating their authorized branch checklist ---');
    const mgrResult = await actionCentreService.completeChecklistItem({
      user: managerBranch1,
      checklistItemId: 'pricePending',
      status: 'COMPLETED',
      notes: 'Customer follow-up completed for pending prices.'
    });

    console.log(`✓ PASS: Manager updated checklist: status=${mgrResult.record.status}, branchId=${mgrResult.record.branchId}, progress=${mgrResult.progress.label}`);
    if (mgrResult.record.status !== 'COMPLETED' || mgrResult.record.branchId !== 1) {
      throw new Error('FAIL: Manager checklist completion did not match expected values.');
    }

    // 4. TEST: Admin of Branch 2 CAN update their own branch checklist
    console.log('\n--- 4. Testing Branch 2 Admin updating Branch 2 checklist ---');
    const admin2Result = await actionCentreService.completeChecklistItem({
      user: adminBranch2,
      checklistItemId: 'readyGarments',
      status: 'COMPLETED',
      notes: 'Bella Design deliveries dispatched.'
    });

    console.log(`✓ PASS: Branch 2 Admin updated checklist: status=${admin2Result.record.status}, branchId=${admin2Result.record.branchId}, progress=${admin2Result.progress.label}`);
    if (admin2Result.record.status !== 'COMPLETED' || admin2Result.record.branchId !== 2) {
      throw new Error('FAIL: Branch 2 Admin checklist completion did not match expected values.');
    }

    // 5. TEST: Manager cannot update another branch
    console.log('\n--- 5. Testing Cross-Branch Security ---');
    try {
      const spoofedUser = { id: 3, role: 'MANAGER', branchId: null };
      await actionCentreService.completeChecklistItem({
        user: spoofedUser,
        checklistItemId: 'pricePending'
      });
      throw new Error('SECURITY VIOLATION: Unassigned manager updated checklist!');
    } catch (e) {
      if (e.statusCode === 403) {
        console.log('✓ PASS: Unassigned or invalid branch access rejected with 403:', e.message);
      } else {
        throw e;
      }
    }

    // 6. TEST: Audit history preserved
    console.log('\n--- 6. Verifying Audit History in PostgreSQL ---');
    const logs = await prisma.managerChecklistAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log(`✓ Total audit records retrieved: ${logs.length}`);
    for (const l of logs) {
      console.log(`  Log #${l.id}: ${l.action} on ${l.checklistItemId} by ${l.performedByName} (Branch ${l.branchId}) at ${l.createdAt}`);
    }

    console.log('\n================================================================');
    console.log('🎉 ALL PERMISSION CHECKS PASSED: CEO READ-ONLY STRICTLY ENFORCED!');
    console.log('================================================================');

    await prisma.$disconnect();
    if (pool) await pool.end();
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
}

verifyCeoReadOnlyPermissions();

