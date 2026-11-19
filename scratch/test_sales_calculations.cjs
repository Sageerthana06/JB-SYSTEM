const { prisma } = require('../backend/src/prisma');

function toColomboDateKey(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const colomboStr = d.toLocaleString('en-US', { timeZone: 'Asia/Colombo' });
  const cd = new Date(colomboStr);
  const y = cd.getFullYear();
  const m = String(cd.getMonth() + 1).padStart(2, '0');
  const day = String(cd.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DASHBOARD_EXCLUDED_STATUSES = new Set(['CANCELLED', 'REJECTED', 'DECLINED']);

async function testAll() {
  console.log('=== COMPREHENSIVE SALES CALCULATIONS AUDIT ===\n');

  const orders = await prisma.order.findMany({
    include: {
      payments: true,
      branch: true,
      customer: true
    }
  });

  const validOrders = orders.filter(o => !DASHBOARD_EXCLUDED_STATUSES.has(String(o.status || '').toUpperCase()));

  console.log(`Total orders in DB: ${orders.length}, Valid orders: ${validOrders.length}`);

  // Test across branches
  for (const branchScope of ['ALL', '1', '2']) {
    console.log(`\n================= BRANCH SCOPE: ${branchScope} =================`);
    const branchOrders = branchScope === 'ALL' 
      ? validOrders 
      : validOrders.filter(o => o.branchId === parseInt(branchScope, 10));

    // Test across periods
    for (const period of ['all', 'this_year', 'this_month', 'today']) {
      const now = new Date();
      const todayKey = toColomboDateKey(now);
      const monthPrefix = todayKey ? todayKey.slice(0, 7) : '';
      const yearPrefix = todayKey ? todayKey.slice(0, 4) : '';

      const periodOrders = branchOrders.filter(o => {
        if (period === 'all') return true;
        const dKey = toColomboDateKey(o.orderDate || o.createdAt);
        if (!dKey) return false;
        if (period === 'today') return dKey === todayKey;
        if (period === 'this_month') return dKey.startsWith(monthPrefix);
        if (period === 'this_year') return dKey.startsWith(yearPrefix);
        return true;
      });

      let sumOrderValue = 0;
      let sumTotalCashPaid = 0;
      let sumAppliedPaid = 0;
      let sumOverpayment = 0;
      let sumGrossBalanceDue = 0;
      let sumDbBalance = 0;
      let fullyPaidCount = 0;
      let partiallyPaidCount = 0;
      let unpaidCount = 0;

      for (const o of periodOrders) {
        const orderTotal = Number(o.agreedTotal) > 0 ? Number(o.agreedTotal) : Number(o.totalAmount || 0);
        
        const verifiedPayments = (o.payments || []).filter(p => String(p.status || 'VERIFIED').toUpperCase() === 'VERIFIED');
        const verifiedPaid = verifiedPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
        const advance = Number(o.advancePayment || 0);
        const legacyAdvance = Math.max(0, advance - verifiedPaid);
        const actualPaid = verifiedPaid + legacyAdvance;

        const appliedPaid = Math.min(orderTotal, actualPaid);
        const overpayment = Math.max(0, actualPaid - orderTotal);
        const balanceDue = Math.max(0, orderTotal - actualPaid);

        sumOrderValue += orderTotal;
        sumTotalCashPaid += actualPaid;
        sumAppliedPaid += appliedPaid;
        sumOverpayment += overpayment;
        sumGrossBalanceDue += balanceDue;
        sumDbBalance += Number(o.balanceAmount || 0);

        if (balanceDue === 0) {
          fullyPaidCount++;
        } else if (actualPaid > 0) {
          partiallyPaidCount++;
        } else {
          unpaidCount++;
        }
      }

      console.log(`\n--- Period: ${period} (${periodOrders.length} orders) ---`);
      console.log(`  Total Order Value:       LKR ${sumOrderValue.toFixed(2)}`);
      console.log(`  Total Cash Received:     LKR ${sumTotalCashPaid.toFixed(2)}`);
      console.log(`  Applied to Orders:       LKR ${sumAppliedPaid.toFixed(2)}`);
      console.log(`  Customer Overpayments:   LKR ${sumOverpayment.toFixed(2)}`);
      console.log(`  Gross Pending Balance:   LKR ${sumGrossBalanceDue.toFixed(2)}`);
      console.log(`  Sum DB balanceAmount:    LKR ${sumDbBalance.toFixed(2)}`);
      console.log(`  Net Pending Balance:     LKR ${(sumGrossBalanceDue - sumOverpayment).toFixed(2)}`);
      console.log(`  Counts: Fully Paid=${fullyPaidCount}, Partial=${partiallyPaidCount}, Unpaid=${unpaidCount}, Outstanding=${partiallyPaidCount + unpaidCount}`);
      
      // Verification of identities
      const identity1 = Math.abs(sumOrderValue - (sumAppliedPaid + sumGrossBalanceDue)) < 0.01;
      const identity2 = Math.abs(sumTotalCashPaid - (sumAppliedPaid + sumOverpayment)) < 0.01;
      const identity3 = Math.abs((sumOrderValue - sumTotalCashPaid) - (sumGrossBalanceDue - sumOverpayment)) < 0.01;
      const identity4 = Math.abs(sumGrossBalanceDue - sumDbBalance) < 0.01;

      console.log(`  Reconciliation checks:`);
      console.log(`    Identity 1 (OrderValue = Applied + GrossPending): ${identity1 ? 'PASS' : 'FAIL'}`);
      console.log(`    Identity 2 (CashReceived = Applied + Overpayment): ${identity2 ? 'PASS' : 'FAIL'}`);
      console.log(`    Identity 3 (OrderValue - CashReceived = NetPending): ${identity3 ? 'PASS' : 'FAIL'}`);
      console.log(`    Identity 4 (GrossPending = Sum DB Balance): ${identity4 ? 'PASS' : 'FAIL'}`);
    }
  }

  await prisma.$disconnect();
}

testAll().catch(e => {
  console.error(e);
  process.exit(1);
});
