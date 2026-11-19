const { prisma, pool } = require('../backend/src/prisma');

async function main() {
  const customerCount = await prisma.customer.count();
  const orderCount = await prisma.order.count();
  console.log('Customers in DB:', customerCount);
  console.log('Orders in DB:', orderCount);

  const orders = await prisma.order.findMany({
    select: {
      id: true,
      orderNumber: true,
      orderDate: true,
      createdAt: true,
      status: true,
      totalAmount: true,
      balanceAmount: true,
      advancePayment: true,
      customerId: true,
      customer: { select: { id: true, name: true, primaryPhone: true } },
      payments: { select: { amount: true, status: true } }
    }
  });

  const months = {};
  for (const o of orders) {
    const d = new Date(o.createdAt || o.orderDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months[key] = (months[key] || 0) + 1;
  }
  console.log('Orders by month:', months);

  const statuses = {};
  for (const o of orders) {
    statuses[o.status] = (statuses[o.status] || 0) + 1;
  }
  console.log('Order statuses:', statuses);

  // Test monthly ranking logic across months
  for (const monthKey of Object.keys(months).sort().reverse()) {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const monthOrders = orders.filter(o => {
      const d = new Date(o.createdAt || o.orderDate);
      const isValid = !['REJECTED', 'CANCELLED', 'PRICE_DECLINED'].includes(o.status);
      return d >= startOfMonth && d <= endOfMonth && isValid;
    });

    // Group by customer
    const custMap = {};
    for (const o of monthOrders) {
      if (!custMap[o.customerId]) {
        custMap[o.customerId] = {
          customerId: o.customerId,
          customerName: o.customer?.name || 'Unknown',
          primaryPhone: o.customer?.primaryPhone || '',
          orderCount: 0,
          totalOrderValue: 0,
          totalPaid: 0,
          totalBalance: 0,
          orders: []
        };
      }
      custMap[o.customerId].orderCount += 1;
      const total = Number(o.totalAmount) || 0;
      const balance = Number(o.balanceAmount) || 0;
      const paid = total - balance;
      custMap[o.customerId].totalOrderValue += total;
      custMap[o.customerId].totalPaid += Math.max(0, paid);
      custMap[o.customerId].totalBalance += balance;
      custMap[o.customerId].orders.push(o.orderNumber);
    }

    const ranked = Object.values(custMap).sort((a, b) => {
      if (b.orderCount !== a.orderCount) {
        return b.orderCount - a.orderCount;
      }
      return b.totalOrderValue - a.totalOrderValue;
    });

    console.log(`\n=== Month: ${monthKey} (Valid orders: ${monthOrders.length}) ===`);
    console.log('Total customers with orders:', ranked.length);
    ranked.slice(0, 5).forEach((c, idx) => {
      console.log(`  Rank ${idx + 1}: ${c.customerName} (${c.primaryPhone}) - Orders: ${c.orderCount}, Value: LKR ${c.totalOrderValue}, Paid: LKR ${c.totalPaid}, Balance: LKR ${c.totalBalance}`);
    });
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
