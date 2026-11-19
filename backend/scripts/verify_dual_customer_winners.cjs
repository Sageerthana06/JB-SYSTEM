const { prisma, pool } = require('../src/prisma');
const customerController = require('../src/controllers/customerController');

// Mock Express req and res
function createMockReqRes({ query = {}, user = { role: 'SUPER_ADMIN', branchId: null } } = {}) {
  const req = { query, user };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return { req, res };
}

async function runVerification() {
  console.log('===============================================================');
  console.log('🧪 VERIFYING DUAL CUSTOMER WINNERS ENHANCEMENT');
  console.log('===============================================================\n');

  // Test 1: Consolidated HQ (SUPER_ADMIN) for November 2026
  console.log('Test 1: Executing GET /api/customers/monthly-winners for November 2026 (Consolidated HQ)...');
  const { req: req1, res: res1 } = createMockReqRes({
    query: { year: '2026', month: '11', branchId: 'ALL' },
    user: { role: 'SUPER_ADMIN', id: 1 }
  });
  await customerController.getMonthlyCustomerWinners(req1, res1);

  if (res1.statusCode !== 200 || !res1.body?.success) {
    throw new Error(`Test 1 Failed: Status ${res1.statusCode}, response: ${JSON.stringify(res1.body)}`);
  }

  const { ordersRanking, paymentsRanking, availableMonths, summary, topThree, leaderboard } = res1.body;

  console.log('✓ API call returned success: 200 OK');
  console.log(`✓ Month Name: ${res1.body.monthName}`);
  console.log(`✓ Available Months count: ${availableMonths.length}`);

  // Test 1a: Backward compatibility
  if (!summary || !topThree || !leaderboard) {
    throw new Error('Test 1a Failed: Missing backward compatibility fields (summary, topThree, leaderboard)');
  }
  console.log('✓ Backward compatibility verified (summary, topThree, leaderboard present)');

  // Test 1b: Orders Ranking Verification
  console.log('\n--- Orders Ranking Verification ---');
  console.log(`- Valid Orders Count: ${ordersRanking.summary.totalValidOrders}`);
  console.log(`- Ordering Customers: ${ordersRanking.summary.totalCustomers}`);
  console.log(`- Total Order Value: LKR ${ordersRanking.summary.totalOrderValue.toLocaleString()}`);
  console.log(`- Amount Paid: LKR ${ordersRanking.summary.totalPaid.toLocaleString()}`);
  console.log(`- Pending Receivables: LKR ${ordersRanking.summary.totalOutstanding.toLocaleString()}`);

  if (ordersRanking.topThree.length === 0) {
    throw new Error('Test 1b Failed: ordersRanking.topThree is empty');
  }
  console.log('✓ Orders Top 3:');
  ordersRanking.topThree.forEach(w => {
    console.log(`  🥇 Rank #${w.rank} [${w.medal}]: ${w.customerName} - ${w.orderCount} orders (LKR ${w.totalOrderValue.toLocaleString()})`);
  });

  // Verify sorting orderCount DESC, then totalOrderValue DESC
  for (let i = 0; i < ordersRanking.leaderboard.length - 1; i++) {
    const cur = ordersRanking.leaderboard[i];
    const nxt = ordersRanking.leaderboard[i + 1];
    if (cur.orderCount < nxt.orderCount) {
      throw new Error(`Test 1b Failed: Order count not sorted descending at index ${i}`);
    }
    if (cur.orderCount === nxt.orderCount && cur.totalOrderValue < nxt.totalOrderValue) {
      throw new Error(`Test 1b Failed: Tie breaker totalOrderValue not sorted descending at index ${i}`);
    }
  }
  console.log('✓ Orders ranking sort verified (Primary: orderCount DESC, Tie-breaker: totalOrderValue DESC)');

  // Test 1c: Payments Ranking Verification
  console.log('\n--- Payments Ranking Verification ---');
  console.log(`- Total Verified Payments: LKR ${paymentsRanking.summary.totalVerifiedPayments.toLocaleString()}`);
  console.log(`- Payment Transactions: ${paymentsRanking.summary.totalPaymentTransactions}`);
  console.log(`- Paying Customers: ${paymentsRanking.summary.totalCustomers}`);
  console.log(`- Unique Orders Paid: ${paymentsRanking.summary.uniqueOrdersPaid}`);
  console.log(`- Total Orders Value: LKR ${paymentsRanking.summary.totalOrderValue.toLocaleString()}`);

  if (paymentsRanking.topThree.length === 0) {
    throw new Error('Test 1c Failed: paymentsRanking.topThree is empty');
  }
  console.log('✓ Payments Top 3:');
  paymentsRanking.topThree.forEach(w => {
    console.log(`  💳 Rank #${w.rank} [${w.medal}]: ${w.customerName} - LKR ${w.totalVerifiedPayments.toLocaleString()} (${w.uniqueOrderCount} orders, ${w.paymentCount} payments)`);
  });

  // Verify sorting totalVerifiedPayments DESC, then uniqueOrderCount DESC
  for (let i = 0; i < paymentsRanking.leaderboard.length - 1; i++) {
    const cur = paymentsRanking.leaderboard[i];
    const nxt = paymentsRanking.leaderboard[i + 1];
    if (cur.totalVerifiedPayments < nxt.totalVerifiedPayments) {
      throw new Error(`Test 1c Failed: Payment amount not sorted descending at index ${i}`);
    }
    if (cur.totalVerifiedPayments === nxt.totalVerifiedPayments && cur.uniqueOrderCount < nxt.uniqueOrderCount) {
      throw new Error(`Test 1c Failed: Tie breaker uniqueOrderCount not sorted descending at index ${i}`);
    }
  }
  console.log('✓ Payments ranking sort verified (Primary: totalVerifiedPayments DESC, Tie-breaker: uniqueOrderCount DESC)');

  // Test 2: Verify only VERIFIED payments are included (check database directly)
  console.log('\nTest 2: Verifying that only VERIFIED payments are counted...');
  const directVerified = await prisma.payment.findMany({
    where: {
      status: 'VERIFIED',
      createdAt: {
        gte: new Date('2026-11-01T00:00:00.000+05:30'),
        lte: new Date('2026-11-30T23:59:59.999+05:30')
      },
      order: {
        status: { notIn: ['REJECTED', 'CANCELLED', 'PRICE_DECLINED'] }
      }
    }
  });

  const expectedPaymentTotal = directVerified.reduce((sum, p) => sum + Number(p.amount), 0);
  console.log(`- Direct DB Verified Payments Total: LKR ${expectedPaymentTotal.toLocaleString()}`);
  console.log(`- API Reported Verified Payments Total: LKR ${paymentsRanking.summary.totalVerifiedPayments.toLocaleString()}`);

  if (expectedPaymentTotal !== paymentsRanking.summary.totalVerifiedPayments) {
    throw new Error(`Test 2 Failed: Mismatch in verified payments: DB has ${expectedPaymentTotal}, API returned ${paymentsRanking.summary.totalVerifiedPayments}`);
  }
  console.log('✓ Exact match between direct DB query and API payments summary');

  // Test 3: Branch filter test (Branch 1 vs Branch 2)
  console.log('\nTest 3: Testing Branch Filters...');
  const { req: reqB1, res: resB1 } = createMockReqRes({
    query: { year: '2026', month: '11', branchId: '1' },
    user: { role: 'SUPER_ADMIN' }
  });
  await customerController.getMonthlyCustomerWinners(reqB1, resB1);
  console.log(`- Branch 1: ${resB1.body.ordersRanking.summary.totalValidOrders} orders, LKR ${resB1.body.paymentsRanking.summary.totalVerifiedPayments.toLocaleString()} payments`);

  const { req: reqB2, res: resB2 } = createMockReqRes({
    query: { year: '2026', month: '11', branchId: '2' },
    user: { role: 'SUPER_ADMIN' }
  });
  await customerController.getMonthlyCustomerWinners(reqB2, resB2);
  console.log(`- Branch 2: ${resB2.body.ordersRanking.summary.totalValidOrders} orders, LKR ${resB2.body.paymentsRanking.summary.totalVerifiedPayments.toLocaleString()} payments`);
  console.log('✓ Branch filters executed correctly');

  // Test 4: Manager Branch Restrictions test
  console.log('\nTest 4: Testing Manager branch security restrictions...');
  const { req: reqMgr, res: resMgr } = createMockReqRes({
    query: { year: '2026', month: '11', branchId: '1' }, // Manager requests branch 1
    user: { role: 'MANAGER', branchId: 2 } // But manager is locked to branch 2
  });
  await customerController.getMonthlyCustomerWinners(reqMgr, resMgr);

  // Manager locked to branch 2 should only see branch 2 data
  if (resMgr.body.branchId !== 2) {
    throw new Error(`Test 4 Failed: Manager branchId was not enforced! Expected 2, got ${resMgr.body.branchId}`);
  }
  console.log(`✓ Manager branch restriction enforced: response branchId locked to ${resMgr.body.branchId}`);

  // Test 5: Verify customer order history fields inside winners
  console.log('\nTest 5: Verifying customer orders structure for history modal...');
  const sampleWinner = paymentsRanking.leaderboard[0];
  if (!sampleWinner.orders || sampleWinner.orders.length === 0) {
    throw new Error('Test 5 Failed: Winner has no orders attached');
  }
  const sampleOrder = sampleWinner.orders[0];
  console.log(`- Winner: ${sampleWinner.customerName}`);
  console.log(`- Orders Attached: ${sampleWinner.orders.length}`);
  console.log(`- Sample Order: #${sampleOrder.orderNumber}, Design: ${sampleOrder.design}, Price: LKR ${sampleOrder.totalAmount}, Paid: LKR ${sampleOrder.paidAmount}, Balance: LKR ${sampleOrder.balanceAmount}`);
  if (!sampleOrder.orderNumber || sampleOrder.totalAmount === undefined || sampleOrder.balanceAmount === undefined) {
    throw new Error('Test 5 Failed: Order structure incomplete');
  }
  console.log('✓ Customer order history structure is complete and ready for modal display');

  console.log('\n===============================================================');
  console.log('🎉 ALL DUAL CUSTOMER WINNERS TESTS PASSED SUCCESSFULLY!');
  console.log('===============================================================\n');
}

runVerification()
  .catch(err => {
    console.error('❌ Verification Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (pool) await pool.end();
    process.exit(0);
  });

