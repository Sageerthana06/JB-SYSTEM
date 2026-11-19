const { prisma } = require('../src/prisma');
const orderController = require('../src/controllers/orderController');

async function testWeeklySales() {
  // Mock req, res for SUPER_ADMIN
  const req = {
    user: { role: 'SUPER_ADMIN', branchId: null },
    query: { branchId: 'ALL' }
  };
  let result = null;
  const res = {
    status: (code) => ({
      json: (data) => {
        result = { code, data };
        return res;
      }
    })
  };

  await orderController.getDashboardSummary(req, res, () => {});

  console.log('Summary status:', result?.code);
  const summary = result?.data?.summary;
  console.log('Today sales:', summary?.todaySales, 'Today orders:', summary?.todayOrders);
  console.log('Monthly sales:', summary?.monthlySales, 'Monthly orders:', summary?.monthlyOrders);
  console.log('AOV:', summary?.averageOrderValue, 'Priced orders count:', summary?.pricedOrdersCount);
  console.log('Weekly sales (last 7 days):');
  console.table(summary?.weeklySales);

  // Test Manager for Branch 1
  const reqMgr1 = {
    user: { role: 'MANAGER', branchId: 1 },
    query: { branchId: '1' }
  };
  let resultMgr1 = null;
  const resMgr1 = {
    status: (code) => ({
      json: (data) => {
        resultMgr1 = { code, data };
        return resMgr1;
      }
    })
  };
  await orderController.getDashboardSummary(reqMgr1, resMgr1, () => {});
  console.log('\nManager Branch 1 summary code:', resultMgr1?.code);
  console.log('Manager Branch 1 monthly orders:', resultMgr1?.data?.summary?.monthlyOrders);
  console.log('Manager Branch 1 weekly sales:');
  console.table(resultMgr1?.data?.summary?.weeklySales);

  // Test Manager attempting Branch 2 (Unauthorized)
  const reqMgrCross = {
    user: { role: 'MANAGER', branchId: 1 },
    query: { branchId: '2' }
  };
  let resultMgrCross = null;
  const resMgrCross = {
    status: (code) => ({
      json: (data) => {
        resultMgrCross = { code, data };
        return resMgrCross;
      }
    })
  };
  await orderController.getDashboardSummary(reqMgrCross, resMgrCross, () => {});
  console.log('\nManager Branch 1 attempting Branch 2 code (expected 403):', resultMgrCross?.code, resultMgrCross?.data?.message);

  // Test Manager attempting ALL branches (Unauthorized)
  const reqMgrAll = {
    user: { role: 'MANAGER', branchId: 1 },
    query: { branchId: 'ALL' }
  };
  let resultMgrAll = null;
  const resMgrAll = {
    status: (code) => ({
      json: (data) => {
        resultMgrAll = { code, data };
        return resMgrAll;
      }
    })
  };
  await orderController.getDashboardSummary(reqMgrAll, resMgrAll, () => {});
  console.log('\nManager Branch 1 attempting ALL code (expected 403):', resultMgrAll?.code, resultMgrAll?.data?.message);
}

testWeeklySales().catch(console.error).finally(() => prisma.$disconnect());

