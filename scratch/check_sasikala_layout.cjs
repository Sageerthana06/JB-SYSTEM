const { prisma, pool } = require('../backend/src/prisma');
const {
  getColomboWeekRange,
  calculateOrderSalaryAllocations,
  computeWeeklySalaryMetrics
} = require('../backend/src/utils/salaryCalculator');

async function checkSasikalaLayout() {
  const weekRange = getColomboWeekRange(new Date('2026-11-08T12:00:00+05:30'));
  const orders = await prisma.order.findMany({
    where: { status: { notIn: ['CANCELLED', 'REJECTED'] } },
    include: {
      customer: true, garmentDetails: true, branch: true,
      assignedTailor: true, tasks: { include: { assignedTailor: true } },
      payments: true, productionHistory: true
    }
  });

  const allAllocations = [];
  for (const o of orders) {
    const res = calculateOrderSalaryAllocations(o, []);
    if (res && res.allocations) allAllocations.push(...res.allocations);
  }

  const sasikalaJobs = allAllocations.filter(a => a.tailorName === 'Sasikala');
  console.log(`Sasikala has ${sasikalaJobs.length} jobs.`);

  // Let's trace currentY on page 1, 2, 3...
  let currentY = 10 + 5 + 7.5 + 11 + 3; // header = 36.5
  currentY += 18; // mini card = 54.5
  currentY += 6.5; // table header = 61.0

  let page = 1;
  for (let i = 0; i < sasikalaJobs.length; i++) {
    const rowHeight = 6.2;
    if (currentY + rowHeight > 210 - 16) {
      console.log(`[Page ${page} End] currentY before break: ${currentY.toFixed(1)} mm. Total rows on this page: ${i}`);
      page++;
      currentY = 36.5 + 6.5; // header + table header
    }
    currentY += rowHeight;
  }
  console.log(`[Page ${page} End] currentY after last row: ${currentY.toFixed(1)} mm.`);
  console.log(`Subtotal row: currentY becomes ${(currentY + 6.5).toFixed(1)} mm.`);
  currentY += 6.5 + 10;
  console.log(`Sign-off block start: ${currentY.toFixed(1)} mm. Block height: 24 mm -> ends at ${(currentY + 24).toFixed(1)} mm. Page height: 210 mm.`);

  await prisma.$disconnect();
  await pool.end();
}

checkSasikalaLayout().catch(console.error);

