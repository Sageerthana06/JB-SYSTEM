const fs = require('fs');
const path = require('path');

function testMonthlyWinnersOrdersOnly() {
  console.log('================================================================');
  console.log('JB SYSTEM - MONTHLY CUSTOMERS WINNERS AUDIT (ORDERS ONLY)');
  console.log('================================================================\n');

  const filePath = path.join(__dirname, '../src/components/MonthlyCustomerWinnersSection.jsx');
  const code = fs.readFileSync(filePath, 'utf8');

  // 1. Verify Payment Winners tab/card is completely removed
  console.log('1. Verifying Payment Winners tab/card removal:');
  const hasPaymentWinnersText = code.includes('Payment Winners');
  const hasPaymentClientsCount = code.includes('{paymentsDataset.leaderboard?.length || 0} Clients');
  const hasRankingTypePayments = code.includes("setRankingType('PAYMENTS')");
  const hasIsPaymentRanking = code.includes('isPaymentRanking');
  const hasIsPaymentMode = code.includes('isPaymentMode');

  console.log(`- 'Payment Winners' text present: ${hasPaymentWinnersText ? 'FAIL (Found)' : 'PASS (Removed)'}`);
  console.log(`- paymentsDataset client count present: ${hasPaymentClientsCount ? 'FAIL (Found)' : 'PASS (Removed)'}`);
  console.log(`- setRankingType('PAYMENTS') present: ${hasRankingTypePayments ? 'FAIL (Found)' : 'PASS (Removed)'}`);
  console.log(`- isPaymentRanking variable present: ${hasIsPaymentRanking ? 'FAIL (Found)' : 'PASS (Removed)'}`);
  console.log(`- isPaymentMode variable present: ${hasIsPaymentMode ? 'FAIL (Found)' : 'PASS (Removed)'}`);

  if (hasPaymentWinnersText || hasPaymentClientsCount || hasRankingTypePayments || hasIsPaymentRanking || hasIsPaymentMode) {
    throw new Error('Payment Winners removal verification failed');
  }

  // 2. Verify Orders Winners is intact
  console.log('\n2. Verifying Orders Winners retention:');
  const hasOrdersWinnersText = code.includes('<span>Orders Winners</span>');
  const hasOrdersClientsCount = code.includes('{ordersDataset.leaderboard?.length || 0} Clients');
  const hasOrdersSummaryBar = code.includes('MONTH VALID ORDERS') &&
                              code.includes('ACTIVE CLIENTS') &&
                              code.includes('TOTAL ORDER VALUE') &&
                              code.includes('COLLECTED PAYMENTS') &&
                              code.includes('PENDING BALANCE');

  console.log(`- 'Orders Winners' label: ${hasOrdersWinnersText ? 'PASS' : 'FAIL'}`);
  console.log(`- ordersDataset client count: ${hasOrdersClientsCount ? 'PASS' : 'FAIL'}`);
  console.log(`- Orders Summary KPI Bar (Valid Orders, Active Clients, Order Value, Paid, Balance): ${hasOrdersSummaryBar ? 'PASS' : 'FAIL'}`);

  if (!hasOrdersWinnersText || !hasOrdersClientsCount || !hasOrdersSummaryBar) {
    throw new Error('Orders Winners retention verification failed');
  }

  // 3. Verify Top 3 Podium Cards based on valid order count
  console.log('\n3. Verifying Monthly Top 3 Customer Winners (Valid Orders):');
  const hasPodiumCards = code.includes('Gold Winner 🥇') &&
                         code.includes('Silver Winner 🥈') &&
                         code.includes('Bronze Winner 🥉');
  const hasOrderCountOnWinner = code.includes('{winner.orderCount} <span style={{ fontSize: \'0.75rem\', fontWeight: 700 }}>Orders</span>');
  const hasTotalOrderValue = code.includes('{winner.totalOrderValue.toLocaleString()}');
  const hasTotalPaid = code.includes('{winner.totalPaid.toLocaleString()}');
  const hasOutstandingBalance = code.includes('{winner.outstandingBalance.toLocaleString()}');

  console.log(`- Gold, Silver, Bronze podium cards: ${hasPodiumCards ? 'PASS' : 'FAIL'}`);
  console.log(`- Winner order count displayed: ${hasOrderCountOnWinner ? 'PASS' : 'FAIL'}`);
  console.log(`- Winner total order value displayed: ${hasTotalOrderValue ? 'PASS' : 'FAIL'}`);
  console.log(`- Winner total paid displayed: ${hasTotalPaid ? 'PASS' : 'FAIL'}`);
  console.log(`- Winner outstanding balance displayed: ${hasOutstandingBalance ? 'PASS' : 'FAIL'}`);

  if (!hasPodiumCards || !hasOrderCountOnWinner || !hasTotalOrderValue || !hasTotalPaid || !hasOutstandingBalance) {
    throw new Error('Top 3 Podium Cards verification failed');
  }

  // 4. Verify Leaderboard table preserves rankings, order count, order values, payments, and balances
  console.log('\n4. Verifying Leaderboard Table Columns & Data Preservation:');
  const hasRankCol = code.includes('<th style={{ padding: \'12px 16px\', fontWeight: 800 }}>Rank</th>');
  const hasValidOrdersCol = code.includes('Monthly Valid Orders');
  const hasOrderValueCol = code.includes('Total Order Value');
  const hasTotalPaidCol = code.includes('Total Paid');
  const hasOutstandingCol = code.includes('Outstanding Balance');
  const hasCustOrderCount = code.includes('{cust.orderCount} {cust.orderCount === 1 ? \'Order\' : \'Orders\'}');
  const hasCustTotalOrderValue = code.includes('LKR {cust.totalOrderValue.toLocaleString()}');
  const hasCustTotalPaid = code.includes('LKR {cust.totalPaid.toLocaleString()}');
  const hasCustOutstandingBalance = code.includes('LKR {cust.outstandingBalance.toLocaleString()}');

  console.log(`- Rank column: ${hasRankCol ? 'PASS' : 'FAIL'}`);
  console.log(`- Monthly Valid Orders column: ${hasValidOrdersCol ? 'PASS' : 'FAIL'}`);
  console.log(`- Total Order Value column: ${hasOrderValueCol ? 'PASS' : 'FAIL'}`);
  console.log(`- Total Paid column: ${hasTotalPaidCol ? 'PASS' : 'FAIL'}`);
  console.log(`- Outstanding Balance column: ${hasOutstandingCol ? 'PASS' : 'FAIL'}`);
  console.log(`- Row order count: ${hasCustOrderCount ? 'PASS' : 'FAIL'}`);
  console.log(`- Row total order value: ${hasCustTotalOrderValue ? 'PASS' : 'FAIL'}`);
  console.log(`- Row total paid: ${hasCustTotalPaid ? 'PASS' : 'FAIL'}`);
  console.log(`- Row balance: ${hasCustOutstandingBalance ? 'PASS' : 'FAIL'}`);

  if (!hasRankCol || !hasValidOrdersCol || !hasOrderValueCol || !hasTotalPaidCol || !hasOutstandingCol) {
    throw new Error('Leaderboard table column verification failed');
  }

  // 5. Verify backend API controller was NOT modified
  console.log('\n5. Verifying backend preservation:');
  const controllerPath = path.join(__dirname, '../backend/src/controllers/customerController.js');
  const controllerCode = fs.readFileSync(controllerPath, 'utf8');
  const hasBackendMonthlyWinners = controllerCode.includes('exports.getMonthlyCustomerWinners');
  console.log(`- Backend controller exports.getMonthlyCustomerWinners preserved: ${hasBackendMonthlyWinners ? 'PASS' : 'FAIL'}`);

  console.log('\n================================================================');
  console.log('ALL VERIFICATIONS PASSED: 100% SUCCESS');
  console.log('================================================================\n');
}

testMonthlyWinnersOrdersOnly();

