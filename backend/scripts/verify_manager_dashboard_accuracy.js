const fs = require('fs');
const path = require('path');
const { prisma } = require('../src/prisma');
const orderController = require('../src/controllers/orderController');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runAudit() {
  console.log('================================================================');
  console.log('JB SYSTEM – Manager Dashboard Accuracy & Security Audit');
  console.log('================================================================\n');

  // CHECKPOINT 1: BRANCH COUNT
  console.log('[CHECKPOINT 1] Branch Count Audit:');
  const sidebarPath = path.join(__dirname, '..', '..', 'src', 'components', 'Sidebar.jsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
  assert(!sidebarContent.includes('3 Branches Linked'), 'Sidebar has no "3 Branches Linked"');
  assert(sidebarContent.includes('2 Active Branches'), 'Sidebar displays "2 Active Branches"');

  const moduleRendererPath = path.join(__dirname, '..', '..', 'src', 'components', 'ModuleRenderer.jsx');
  const moduleRendererContent = fs.readFileSync(moduleRendererPath, 'utf8');
  assert(!moduleRendererContent.includes('All 3 Branches Combined'), 'ModuleRenderer has no "All 3 Branches Combined"');

  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  assert(branches.length === 2, `Exactly 2 branches in DB (found ${branches.length})`);
  assert(branches.some(b => b.id === 1 && b.name.includes('JB Group')), 'Branch 1 is JB Group (Main)');
  assert(branches.some(b => b.id === 2 && b.name.includes('Bella Design')), 'Branch 2 is Bella Design');
  assert(!branches.some(b => b.id === 3), 'No Branch 3 exists in DB');

  // CHECKPOINT 2: MANAGER BRANCH SECURITY
  console.log('\n[CHECKPOINT 2] Manager Branch Security Audit:');
  const salesERPPath = path.join(__dirname, '..', '..', 'src', 'components', 'SalesERP.jsx');
  const salesERPContent = fs.readFileSync(salesERPPath, 'utf8');
  assert(!salesERPContent.includes('<p style={{ fontSize: \'0.75rem\', color: \'var(--text-muted)\' }}>\n              Latest orders from all branches\n            </p>'), 'SalesERP Recent Orders table does not hardcode "Latest orders from all branches"');
  assert(salesERPContent.includes('userRole === \'MANAGER\''), 'SalesERP Recent Orders table dynamically displays manager assigned branch');

  // Backend test: Manager branch 1 requesting branch 2 via getAllOrders -> 403
  let resAllOrdersCross = null;
  await orderController.getAllOrders(
    { user: { role: 'MANAGER', branchId: 1 }, query: { branchId: '2' } },
    { status: (code) => ({ json: (data) => { resAllOrdersCross = { code, data }; } }) },
    () => {}
  );
  assert(resAllOrdersCross?.code === 403, `getAllOrders cross-branch returns HTTP 403 (got ${resAllOrdersCross?.code})`);

  // Backend test: Manager branch 1 requesting ALL via getAllOrders -> 403
  let resAllOrdersAll = null;
  await orderController.getAllOrders(
    { user: { role: 'MANAGER', branchId: 1 }, query: { branchId: 'ALL' } },
    { status: (code) => ({ json: (data) => { resAllOrdersAll = { code, data }; } }) },
    () => {}
  );
  assert(resAllOrdersAll?.code === 403, `getAllOrders ALL branch returns HTTP 403 (got ${resAllOrdersAll?.code})`);

  // Backend test: Manager branch 1 requesting branch 2 summary -> 403
  let resSummaryCross = null;
  await orderController.getDashboardSummary(
    { user: { role: 'MANAGER', branchId: 1 }, query: { branchId: '2' } },
    { status: (code) => ({ json: (data) => { resSummaryCross = { code, data }; } }) },
    () => {}
  );
  assert(resSummaryCross?.code === 403, `getDashboardSummary cross-branch returns HTTP 403 (got ${resSummaryCross?.code})`);

  // Backend test: Manager branch 2 requesting branch 1 order by ID -> 403
  const b1Order = await prisma.order.findFirst({ where: { branchId: 1 }, select: { id: true } });
  let resOrderCross = null;
  await orderController.getOrderById(
    { user: { role: 'MANAGER', branchId: 2 }, params: { id: String(b1Order.id) } },
    { status: (code) => ({ json: (data) => { resOrderCross = { code, data }; } }) },
    () => {}
  );
  assert(resOrderCross?.code === 403, `getOrderById cross-branch returns HTTP 403 (got ${resOrderCross?.code})`);

  // Backend test: Manager branch 1 requesting their own order by ID -> 200
  let resOrderOwn = null;
  await orderController.getOrderById(
    { user: { role: 'MANAGER', branchId: 1 }, params: { id: String(b1Order.id) } },
    { status: (code) => ({ json: (data) => { resOrderOwn = { code, data }; } }) },
    () => {}
  );
  assert(resOrderOwn?.code === 200, `getOrderById own branch returns HTTP 200 (got ${resOrderOwn?.code})`);

  // CHECKPOINT 3: SALES METRICS
  console.log('\n[CHECKPOINT 3] Sales Metrics Verification:');
  let summaryRes = null;
  await orderController.getDashboardSummary(
    { user: { role: 'SUPER_ADMIN', branchId: null }, query: { branchId: 'ALL' } },
    { status: (code) => ({ json: (data) => { summaryRes = { code, data }; } }) },
    () => {}
  );
  const sum = summaryRes?.data?.summary;
  assert(sum?.monthlyOrders === 22, `Monthly orders is 22 (got ${sum?.monthlyOrders})`);
  assert(sum?.pricedOrdersCount === 27, `Priced orders count is 27 (got ${sum?.pricedOrdersCount})`);
  assert(sum?.monthlySales === 7700, `Monthly sales is LKR 7,700 (got ${sum?.monthlySales})`);
  assert(sum?.averageOrderValue === 1433, `Average Order Value is LKR 1,433 (got ${sum?.averageOrderValue})`);

  // CHECKPOINT 4: LAST 7 DAYS CHART
  console.log('\n[CHECKPOINT 4] Last 7 Days Chart Verification:');
  assert(Array.isArray(sum?.weeklySales) && sum.weeklySales.length === 7, 'Weekly sales array contains exactly 7 days');
  const day0 = sum?.weeklySales[0];
  assert(day0.revenue === 0 && day0.orders === 0, `Zero-sales day handled correctly: ${day0.date} (${day0.formattedDate}) rev=${day0.revenue}, ord=${day0.orders}`);
  const hasValidDates = sum?.weeklySales.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.formattedDate && d.day);
  assert(hasValidDates, 'All 7 days have valid Asia/Colombo date strings, formatted dates, and day names');

  // CHECKPOINT 5: PRESERVATION CHECK
  console.log('\n[CHECKPOINT 5] Data & Model Preservation Check:');
  const orderCount = await prisma.order.count();
  assert(orderCount >= 28, `All orders preserved in DB (found ${orderCount})`);
  const paymentCount = await prisma.payment.count();
  assert(paymentCount >= 7, `All payments preserved in DB (found ${paymentCount})`);
  const userCount = await prisma.user.count();
  assert(userCount >= 8, `All users preserved in DB (found ${userCount})`);

  console.log('\n================================================================');
  console.log(`TOTAL AUDIT RESULT: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());

