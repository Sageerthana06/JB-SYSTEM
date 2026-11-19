const { prisma, pool } = require('../backend/src/prisma');
const {
  getColomboWeekRange,
  calculateOrderSalaryAllocations,
  computeWeeklySalaryMetrics
} = require('../backend/src/utils/salaryCalculator');
const fs = require('fs');
const path = require('path');

// Test that jsPDF can be loaded in node
const { jsPDF } = require('jspdf');

async function testPdf() {
  console.log('Testing PDF generation logic...');

  // Fetch report data just like orderController
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

  const weekRange = getColomboWeekRange(null);
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
  }));

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
    tailorStatements,
    allocations: allAllocations,
    allAllocationsCount: allAllocations.length
  };

  console.log('Report Data Prepared:');
  console.log(`  Tailors: ${tailorStatements.length}`);
  console.log(`  Allocations: ${allAllocations.length}`);
  console.log(`  Summary: Earned=${summary.totalEarnedInWeek}, Payable=${summary.totalPayable}, Held=${summary.totalHeldOnCustomerPayment}, Pending=${summary.totalWorkPending}`);

  // Test dynamic import of weeklySalaryPdf.js
  const { generateWeeklySalaryPDF } = await import('../src/utils/weeklySalaryPdf.js');
  const { doc, fileName } = generateWeeklySalaryPDF({
    reportData,
    user: { name: 'Thirunavukkarasu Senthuran', role: 'CEO' },
    branchName: 'Consolidated HQ (All Branches)'
  });

  const outPath = path.join(__dirname, fileName);
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(outPath, pdfBuffer);

  const artifactPath = path.join('C:\\Users\\HP\\.gemini\\antigravity\\brain\\fa6cbc4b-65c1-46d7-9e4b-af31b48ba2db', fileName);
  fs.writeFileSync(artifactPath, pdfBuffer);

  console.log(`✓ Successfully generated PDF (${pdfBuffer.length} bytes): ${outPath}`);
  console.log(`✓ Copied to artifacts: ${artifactPath}`);
  console.log(`✓ Total Pages: ${doc.internal.getNumberOfPages()}`);

  await prisma.$disconnect();
}

testPdf().catch(e => {
  console.error(e);
  process.exit(1);
});

