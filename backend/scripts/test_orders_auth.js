const { prisma } = require('../src/prisma');
const orderController = require('../src/controllers/orderController');

async function testOrdersAuth() {
  console.log('--- Testing getAllOrders authorization ---');

  // Manager Branch 1 requests their branch
  const req1 = {
    user: { role: 'MANAGER', branchId: 1 },
    query: { branchId: '1' }
  };
  let res1 = null;
  await orderController.getAllOrders(req1, {
    status: (code) => ({ json: (data) => { res1 = { code, data }; } })
  }, () => {});
  console.log('Manager Branch 1 requesting branch 1:', res1?.code, `Found ${res1?.data?.orders?.length} orders`);

  // Manager Branch 1 requests branch 2
  const req2 = {
    user: { role: 'MANAGER', branchId: 1 },
    query: { branchId: '2' }
  };
  let res2 = null;
  await orderController.getAllOrders(req2, {
    status: (code) => ({ json: (data) => { res2 = { code, data }; } })
  }, () => {});
  console.log('Manager Branch 1 requesting branch 2 (expected 403):', res2?.code, res2?.data?.message);

  // Manager Branch 1 requests ALL
  const reqAll = {
    user: { role: 'MANAGER', branchId: 1 },
    query: { branchId: 'ALL' }
  };
  let resAll = null;
  await orderController.getAllOrders(reqAll, {
    status: (code) => ({ json: (data) => { resAll = { code, data }; } })
  }, () => {});
  console.log('Manager Branch 1 requesting ALL (expected 403):', resAll?.code, resAll?.data?.message);

  // Testing getOrderById
  console.log('\n--- Testing getOrderById authorization ---');
  // Find an order
  const anyOrder = await prisma.order.findFirst({
    where: { branchId: 1 },
    select: { id: true, branchId: true }
  });
  console.log(`Found Branch 1 order ID: ${anyOrder?.id}`);

  // Manager Branch 1 requests order in Branch 1
  let resOrder1 = null;
  await orderController.getOrderById({
    user: { role: 'MANAGER', branchId: 1 },
    params: { id: String(anyOrder.id) }
  }, {
    status: (code) => ({ json: (data) => { resOrder1 = { code, data }; } })
  }, () => {});
  console.log('Manager Branch 1 accessing Branch 1 order:', resOrder1?.code, resOrder1?.data?.order?.id);

  // Manager Branch 2 requests order in Branch 1 (Cross branch!)
  let resOrderCross = null;
  await orderController.getOrderById({
    user: { role: 'MANAGER', branchId: 2 },
    params: { id: String(anyOrder.id) }
  }, {
    status: (code) => ({ json: (data) => { resOrderCross = { code, data }; } })
  }, () => {});
  console.log('Manager Branch 2 accessing Branch 1 order (current behavior):', resOrderCross?.code, resOrderCross?.data?.message || 'Returned order data without 403!');
}

testOrdersAuth().catch(console.error).finally(() => prisma.$disconnect());

