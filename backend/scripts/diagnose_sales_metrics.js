const { prisma } = require('../src/prisma');

const COLOMBO_OFFSET_MS = 330 * 60 * 1000;
const toColomboDateKey = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const shifted = new Date(parsed.getTime() + COLOMBO_OFFSET_MS);
  const yr = shifted.getUTCFullYear();
  const mo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dt = String(shifted.getUTCDate()).padStart(2, '0');
  return `${yr}-${mo}-${dt}`;
};

const shiftColomboDateKey = (dateKey, offsetDays) => {
  const [yr, mo, dt] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(yr, mo - 1, dt + offsetDays));
  const rYr = shifted.getUTCFullYear();
  const rMo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const rDt = String(shifted.getUTCDate()).padStart(2, '0');
  return `${rYr}-${rMo}-${rDt}`;
};

async function main() {
  const orders = await prisma.order.findMany({
    select: {
      id: true,
      orderNumber: true,
      branchId: true,
      orderDate: true,
      totalAmount: true,
      agreedTotal: true,
      advancePayment: true,
      balanceAmount: true,
      status: true,
      createdAt: true
    },
    orderBy: { id: 'asc' }
  });

  const payments = await prisma.payment.findMany({
    select: {
      id: true,
      orderId: true,
      amount: true,
      status: true,
      createdAt: true
    }
  });

  console.log(`Total orders in DB: ${orders.length}`);
  console.log(`Total payments in DB: ${payments.length}`);

  const DASHBOARD_EXCLUDED_STATUSES = new Set(['CANCELLED', 'REJECTED', 'PRICE_DECLINED']);
  const validOrders = orders.filter(o => !DASHBOARD_EXCLUDED_STATUSES.has(String(o.status || '').toUpperCase()));
  console.log(`Valid orders (non-excluded): ${validOrders.length}`);

  // Reference date: Asia/Colombo today
  const todayKey = toColomboDateKey(new Date());
  const monthPrefix = todayKey.slice(0, 7);
  console.log(`Today Asia/Colombo: ${todayKey}, monthPrefix: ${monthPrefix}`);

  // Breakdown of valid orders by month
  const byMonth = {};
  for (const o of validOrders) {
    const k = toColomboDateKey(o.orderDate || o.createdAt);
    const m = k ? k.slice(0, 7) : 'NO_DATE';
    byMonth[m] = (byMonth[m] || 0) + 1;
  }
  console.log('Valid orders by month:', byMonth);

  // Priced orders (totalAmount > 0 or agreedTotal > 0)
  const pricedOrders = validOrders.filter(o => {
    const val = Number(o.agreedTotal) > 0 ? Number(o.agreedTotal) : Number(o.totalAmount);
    return val > 0;
  });
  console.log(`Priced orders count (lifetime): ${pricedOrders.length}`);

  // Priced orders this month
  const pricedOrdersThisMonth = pricedOrders.filter(o => {
    const k = toColomboDateKey(o.orderDate || o.createdAt);
    return k && k.startsWith(monthPrefix) && k <= todayKey;
  });
  console.log(`Priced orders count (this month ${monthPrefix}): ${pricedOrdersThisMonth.length}`);

  // Check with reference date 2026-10-30 or 2026-11-01 if any:
  for (const testRef of ['2026-10-31', '2026-11-01', '2026-11-05']) {
    const refMonth = testRef.slice(0, 7);
    const mOrders = validOrders.filter(o => {
      const k = toColomboDateKey(o.orderDate || o.createdAt);
      return k && k.startsWith(refMonth) && k <= testRef;
    });
    console.log(`\nRef Date ${testRef} (Month ${refMonth}): Orders = ${mOrders.length}`);
  }

  // Branch breakdown for current month and lifetime
  for (const bId of [1, 2]) {
    const bOrders = validOrders.filter(o => o.branchId === bId);
    const bMonthOrders = bOrders.filter(o => {
      const k = toColomboDateKey(o.orderDate || o.createdAt);
      return k && k.startsWith(monthPrefix) && k <= todayKey;
    });
    const bPricedOrders = bOrders.filter(o => {
      const val = Number(o.agreedTotal) > 0 ? Number(o.agreedTotal) : Number(o.totalAmount);
      return val > 0;
    });
    console.log(`\nBranch ${bId}: Total valid: ${bOrders.length}, Month (${monthPrefix}): ${bMonthOrders.length}, Lifetime priced: ${bPricedOrders.length}`);
  }

  // Let's inspect the orders created in each month
  console.log('\n--- Orders list ---');
  for (const o of validOrders) {
    const k = toColomboDateKey(o.orderDate || o.createdAt);
    const val = Number(o.agreedTotal) > 0 ? Number(o.agreedTotal) : Number(o.totalAmount);
    console.log(`Order ID ${o.id} (${o.orderNumber}): Branch ${o.branchId}, Status ${o.status}, Date ${k}, Val ${val}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
