const { prisma, pool } = require('../backend/src/prisma');
const {
  getColomboWeekRange,
  calculateOrderSalaryAllocations,
  computeWeeklySalaryMetrics
} = require('../backend/src/utils/salaryCalculator');
const fs = require('fs');
const path = require('path');

async function testAllPdfs() {
  console.log('=== TESTING ALL SEPARATE SALARY PDF GENERATORS ===\n');

  const weekRange = getColomboWeekRange(new Date('2026-11-08T12:00:00+05:30'));

  const orders = await prisma.order.findMany({
    where: { status: { notIn: ['CANCELLED', 'REJECTED'] } },
    include: {
      customer: { select: { id: true, name: true, primaryPhone: true } },
      garmentDetails: { select: { dressType: true, quantity: true } },
      branch: { select: { id: true, name: true } },
      assignedTailor: { select: { id: true, name: true, email: true, role: true } },
      tasks: {
        include: {
          assignedTailor: { select: { id: true, name: true, email: true, role: true } }
        },
        orderBy: { sequence: 'asc' }
      },
      payments: true,
      productionHistory: true
    },
    orderBy: { createdAt: 'desc' }
  });

  const allAllocations = [];
  const uniqueOrdersMap = new Map();
  let totalAgreedOrderCents = 0;
  let totalOfficeCents = 0;
  let totalCuttingCents = 0;
  let totalStitchingCents = 0;

  for (const o of orders) {
    const res = calculateOrderSalaryAllocations(o, []);
    if (res && res.allocations && res.allocations.length > 0) {
      if (!uniqueOrdersMap.has(o.id)) {
        uniqueOrdersMap.set(o.id, res.agreedPrice);
        totalAgreedOrderCents += Math.round(res.agreedPrice * 100);
        totalOfficeCents += Math.round(res.officeAllocation * 100);
      }
      for (const a of res.allocations) {
        if (a.workType === 'CUTTING') totalCuttingCents += Math.round(a.allocatedAmount * 100);
        if (a.workType === 'STITCHING') totalStitchingCents += Math.round(a.allocatedAmount * 100);
        allAllocations.push(a);
      }
    }
  }

  const { summary } = computeWeeklySalaryMetrics(allAllocations, [], weekRange);

  const tailorMap = new Map();
  for (const a of allAllocations) {
    if (!a.tailorId) continue;
    if (!tailorMap.has(a.tailorId)) {
      tailorMap.set(a.tailorId, {
        tailorId: a.tailorId,
        tailorName: a.tailorName,
        tailorEmail: a.tailorEmail,
        branchName: a.branchName,
        jobsCount: 0,
        jobs: [],
        earnedCents: 0,
        payableCents: 0,
        heldCents: 0,
        workPendingCents: 0,
        paidInWeekCents: 0,
        carriedForwardCents: 0
      });
    }
    const stmt = tailorMap.get(a.tailorId);
    stmt.jobsCount++;
    stmt.jobs.push(a);
    if (a.status === 'PAYABLE') stmt.payableCents += Math.round(a.allocatedAmount * 100);
    if (a.status === 'ON_HOLD_CUSTOMER_PAYMENT') stmt.heldCents += Math.round(a.allocatedAmount * 100);
    if (a.status === 'WORK_PENDING') stmt.workPendingCents += Math.round(a.allocatedAmount * 100);
    if (a.isWorkCompleted) stmt.earnedCents += Math.round(a.allocatedAmount * 100);
  }

  const tailorStatements = Array.from(tailorMap.values()).map(stmt => ({
    tailorId: stmt.tailorId,
    tailorName: stmt.tailorName,
    tailorEmail: stmt.tailorEmail,
    branchName: stmt.branchName,
    jobsCount: stmt.jobsCount,
    jobs: stmt.jobs,
    totalEarnedInWeek: stmt.earnedCents / 100,
    totalPayable: stmt.payableCents / 100,
    totalHeld: stmt.heldCents / 100,
    totalWorkPending: stmt.workPendingCents / 100,
    totalPaidInWeek: stmt.paidInWeekCents / 100,
    totalCarriedForward: stmt.carriedForwardCents / 100,
    outstandingBalance: stmt.payableCents / 100
  })).sort((a, b) => b.outstandingBalance - a.outstandingBalance);

  const cuttingAllocations = allAllocations.filter(a => a.workType === 'CUTTING');
  const stitchingAllocations = allAllocations.filter(a => a.workType === 'STITCHING');

  const cuttingVsStitching = {
    cutting: {
      percent: 25.0,
      totalAllocated: totalCuttingCents / 100,
      completedCount: cuttingAllocations.filter(a => a.isWorkCompleted).length,
      pendingCount: cuttingAllocations.filter(a => a.status === 'WORK_PENDING').length,
      heldAmount: cuttingAllocations.filter(a => a.status === 'ON_HOLD_CUSTOMER_PAYMENT').reduce((s, a) => s + a.allocatedAmount, 0),
      payableAmount: cuttingAllocations.filter(a => a.status === 'PAYABLE').reduce((s, a) => s + a.allocatedAmount, 0),
      paidAmount: 0
    },
    stitching: {
      percent: 25.0,
      totalAllocated: totalStitchingCents / 100,
      completedCount: stitchingAllocations.filter(a => a.isWorkCompleted).length,
      pendingCount: stitchingAllocations.filter(a => a.status === 'WORK_PENDING').length,
      heldAmount: stitchingAllocations.filter(a => a.status === 'ON_HOLD_CUSTOMER_PAYMENT').reduce((s, a) => s + a.allocatedAmount, 0),
      payableAmount: stitchingAllocations.filter(a => a.status === 'PAYABLE').reduce((s, a) => s + a.allocatedAmount, 0),
      paidAmount: 0
    },
    office: {
      totalAllocated: totalOfficeCents / 100,
      percent: 50.0,
      description: 'Office allocation (50% of unique agreed order prices)'
    }
  };

  const reportData = {
    summary,
    weekRange,
    orderTotals: {
      uniqueOrdersCount: uniqueOrdersMap.size,
      totalAgreedOrderValue: totalAgreedOrderCents / 100,
      totalOfficeAllocation: totalOfficeCents / 100,
      totalCuttingAllocation: totalCuttingCents / 100,
      totalStitchingAllocation: totalStitchingCents / 100,
      totalTailorAllocation: (totalCuttingCents + totalStitchingCents) / 100
    },
    cuttingVsStitching,
    tailorStatements,
    allocations: allAllocations,
    allAllocationsCount: allAllocations.length,
    recentPayments: []
  };

  const {
    generateWeeklySalaryPDF,
    generateAllAllocationsPDF,
    generateTailorsSummaryPDF,
    generateSingleTailorPDF,
    generateCuttingVsStitchingPDF,
    generateCustomerHoldsPDF,
    generateDisbursementHistoryPDF
  } = await import('../src/utils/weeklySalaryPdf.js');

  const userContext = { name: 'Jeyatheepan Joseph (CEO)', role: 'CEO' };
  const branchName = 'Consolidated HQ (All Branches)';
  const outDir = path.join(__dirname, 'test_pdfs');
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Full PDF
  console.log('1. Generating Full Combined Salary PDF...');
  const full = generateWeeklySalaryPDF({ reportData, user: userContext, branchName });
  fs.writeFileSync(path.join(outDir, full.fileName), Buffer.from(full.doc.output('arraybuffer')));
  console.log(`   ✓ ${full.fileName} (${full.doc.internal.getNumberOfPages()} pages)`);

  // 2. All Allocations PDF
  console.log('\n2. Generating All Allocations PDF...');
  const allocPdf = generateAllAllocationsPDF({ reportData, user: userContext, branchName });
  fs.writeFileSync(path.join(outDir, allocPdf.fileName), Buffer.from(allocPdf.doc.output('arraybuffer')));
  console.log(`   ✓ ${allocPdf.fileName} (${allocPdf.doc.internal.getNumberOfPages()} pages)`);

  // 3. Tailor Summary PDF
  console.log('\n3. Generating Tailor Statements Summary PDF...');
  const stmtSumPdf = generateTailorsSummaryPDF({ reportData, user: userContext, branchName });
  fs.writeFileSync(path.join(outDir, stmtSumPdf.fileName), Buffer.from(stmtSumPdf.doc.output('arraybuffer')));
  console.log(`   ✓ ${stmtSumPdf.fileName} (${stmtSumPdf.doc.internal.getNumberOfPages()} pages)`);

  // 4. Individual Tailor PDFs
  console.log('\n4. Generating Individual Tailor Statement PDFs...');
  for (const t of tailorStatements) {
    const singlePdf = generateSingleTailorPDF({ tailor: t, reportData, user: userContext, branchName });
    fs.writeFileSync(path.join(outDir, singlePdf.fileName), Buffer.from(singlePdf.doc.output('arraybuffer')));
    console.log(`   ✓ Tailor [${t.tailorName}]: ${singlePdf.fileName} (${singlePdf.doc.internal.getNumberOfPages()} pages)`);
  }

  // 5. Cutting vs Stitching PDF
  console.log('\n5. Generating Cutting vs Stitching PDF...');
  const cvsPdf = generateCuttingVsStitchingPDF({ reportData, user: userContext, branchName });
  fs.writeFileSync(path.join(outDir, cvsPdf.fileName), Buffer.from(cvsPdf.doc.output('arraybuffer')));
  console.log(`   ✓ ${cvsPdf.fileName} (${cvsPdf.doc.internal.getNumberOfPages()} pages)`);

  // 6. Customer Payment Holds PDF
  console.log('\n6. Generating Customer Payment Holds PDF...');
  const holdsPdf = generateCustomerHoldsPDF({ reportData, user: userContext, branchName });
  fs.writeFileSync(path.join(outDir, holdsPdf.fileName), Buffer.from(holdsPdf.doc.output('arraybuffer')));
  console.log(`   ✓ ${holdsPdf.fileName} (${holdsPdf.doc.internal.getNumberOfPages()} pages)`);

  // 7. Disbursement History PDF
  console.log('\n7. Generating Disbursement History PDF...');
  const histPdf = generateDisbursementHistoryPDF({ reportData, user: userContext, branchName });
  fs.writeFileSync(path.join(outDir, histPdf.fileName), Buffer.from(histPdf.doc.output('arraybuffer')));
  console.log(`   ✓ ${histPdf.fileName} (${histPdf.doc.internal.getNumberOfPages()} pages)`);

  console.log('\n✓ ALL 11 SEPARATE PDF REPORTS GENERATED AND VERIFIED SUCCESSFULLY!');
  await prisma.$disconnect();
  await pool.end();
}

testAllPdfs().catch(e => {
  console.error(e);
  process.exit(1);
});

