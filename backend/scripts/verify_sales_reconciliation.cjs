const { prisma } = require('../src/prisma');
const orderController = require('../src/controllers/orderController');

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

async function runTests() {
  console.log('=================================================================');
  console.log('   JB GROUP - SALES DASHBOARD FINANCIAL RECONCILIATION TEST');
  console.log('=================================================================\n');

  let passedAll = true;

  // Mock req & res helper
  const invokeEndpoint = async (role, branchId, period) => {
    return new Promise((resolve, reject) => {
      const req = {
        user: { role, branchId },
        query: {
          period,
          ...(branchId ? { branchId: String(branchId) } : {})
        }
      };
      const res = {
        status: function(code) {
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          this.body = data;
          resolve(this);
        }
      };
      orderController.getSalesPaymentSummary(req, res, reject).catch(reject);
    });
  };

  const testCases = [
    { name: 'CEO / HQ - All Time', role: 'CEO', branchId: null, period: 'all' },
    { name: 'CEO / HQ - This Year', role: 'CEO', branchId: null, period: 'this_year' },
    { name: 'CEO / HQ - This Month', role: 'CEO', branchId: null, period: 'this_month' },
    { name: 'CEO / HQ - Today', role: 'CEO', branchId: null, period: 'today' },
    { name: 'Admin - Branch 1 (Main) - All Time', role: 'ADMIN', branchId: 1, period: 'all' },
    { name: 'Manager - Branch 1 - All Time', role: 'MANAGER', branchId: 1, period: 'all' },
    { name: 'Manager - Branch 2 - All Time', role: 'MANAGER', branchId: 2, period: 'all' },
  ];

  for (const tc of testCases) {
    console.log(`Testing: ${tc.name}...`);
    const res = await invokeEndpoint(tc.role, tc.branchId, tc.period);

    if (res.statusCode && res.statusCode !== 200) {
      console.error(`  FAIL: HTTP status ${res.statusCode}`);
      passedAll = false;
      continue;
    }

    const s = res.body?.summary;
    if (!s) {
      console.error(`  FAIL: Missing summary payload`);
      passedAll = false;
      continue;
    }

    console.log(`    Order Value:       LKR ${s.totalOrderValue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`);
    console.log(`    Cash Received:     LKR ${s.totalCustomerPaymentsReceived.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`);
    console.log(`    Payments Applied:  LKR ${s.totalCustomerPaymentsApplied.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`);
    console.log(`    Overpayments:      LKR ${s.totalCustomerOverpayments.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`);
    console.log(`    Pending Balance:   LKR ${s.totalCustomerPendingBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`);
    console.log(`    Net Pending Due:   LKR ${s.netCustomerPendingBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`);
    console.log(`    Counts: Paid=${s.fullyPaidOrdersCount}, Partial=${s.partiallyPaidOrdersCount}, Unpaid=${s.unpaidOrdersCount}, Outstanding=${s.totalOutstandingOrdersCount}, Total=${s.processedOrdersCount}`);

    // Exact reconciliation equations (to 2 decimal places in cents)
    const orderValCents = Math.round(s.totalOrderValue * 100);
    const cashRecCents = Math.round(s.totalCustomerPaymentsReceived * 100);
    const appliedCents = Math.round(s.totalCustomerPaymentsApplied * 100);
    const overpayCents = Math.round(s.totalCustomerOverpayments * 100);
    const pendingCents = Math.round(s.totalCustomerPendingBalance * 100);
    const netDueCents = Math.round(s.netCustomerPendingBalance * 100);

    // 1. Order Value = Applied + Pending
    const eq1 = orderValCents === (appliedCents + pendingCents);
    // 2. Cash Received = Applied + Overpayments
    const eq2 = cashRecCents === (appliedCents + overpayCents);
    // 3. Order Value - Cash Received = Pending - Overpayments = Net Due
    const eq3 = (orderValCents - cashRecCents) === (pendingCents - overpayCents) && netDueCents === Math.max(0, pendingCents - overpayCents);
    // 4. Order Counts: Paid + Outstanding = Priced Orders
    const eq4 = (s.fullyPaidOrdersCount + s.totalOutstandingOrdersCount) === s.pricedOrdersCount;
    // 5. Outstanding = Partial + Unpaid
    const eq5 = s.totalOutstandingOrdersCount === (s.partiallyPaidOrdersCount + s.unpaidOrdersCount);

    if (!eq1 || !eq2 || !eq3 || !eq4 || !eq5) {
      console.error(`  FAIL: Equations violated: eq1=${eq1}, eq2=${eq2}, eq3=${eq3}, eq4=${eq4}, eq5=${eq5}`);
      passedAll = false;
    } else {
      console.log(`    PASS: All 5 reconciliation equations verified with 0.00 discrepancy.\n`);
    }
  }

  // Double counting audit
  console.log('Running Payment Double-Counting Audit...');
  const orders = await prisma.order.findMany({ include: { payments: true } });
  let doubleCountingDetected = false;
  for (const o of orders) {
    const verified = (o.payments || []).filter(p => String(p.status || 'VERIFIED').toUpperCase() === 'VERIFIED');
    const vSum = verified.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const adv = Number(o.advancePayment || 0);
    if (verified.length > 0 && adv > 0 && Math.abs(vSum - adv) > 0.01) {
      console.error(`  Double counting warning on Order ${o.id}: payments sum=${vSum}, advance=${adv}`);
      doubleCountingDetected = true;
    }
  }
  if (!doubleCountingDetected) {
    console.log('  PASS: Verified payments match advancePayment exactly. Zero double counting.\n');
  } else {
    passedAll = false;
  }

  console.log('=================================================================');
  if (passedAll) {
    console.log('  SUCCESS: ALL SALES DASHBOARD RECONCILIATION TESTS PASSED!');
  } else {
    console.log('  FAILURE: ONE OR MORE TESTS FAILED.');
  }
  console.log('=================================================================\n');

  await prisma.$disconnect();
  process.exit(passedAll ? 0 : 1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});

