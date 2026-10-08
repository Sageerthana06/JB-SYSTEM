require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
  const allOrders = await prisma.order.findMany({
    select: {
      id: true,
      orderNumber: true,
      orderDate: true,
      totalAmount: true,
      advancePayment: true,
      balanceAmount: true,
      status: true,
      createdAt: true
    }
  });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayOrders = allOrders.filter(o => {
    const d = new Date(o.orderDate || o.createdAt);
    return d >= startOfToday && d < endOfToday;
  });
  const todaySales = todayOrders.reduce((sum, o) => sum + (Number(o.advancePayment) || 0), 0);

  const monthlyOrders = allOrders.filter(o => {
    const d = new Date(o.orderDate || o.createdAt);
    return d >= startOfMonth;
  });
  const monthlySales = monthlyOrders.reduce((sum, o) => sum + (Number(o.advancePayment) || 0), 0);

  const pricedOrders = allOrders.filter(o => Number(o.totalAmount) > 0);
  const totalPriced = pricedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const aov = pricedOrders.length > 0 ? Math.round(totalPriced / pricedOrders.length) : 0;

  const dueOrders = allOrders.filter(o => Number(o.totalAmount) > 0 && Number(o.balanceAmount) > 0);
  const dueAmount = dueOrders.reduce((sum, o) => sum + Number(o.balanceAmount), 0);

  console.log('SUMMARY TEST:');
  console.log({
    totalOrdersInDB: allOrders.length,
    todayOrders: todayOrders.length,
    todaySales,
    monthlyOrders: monthlyOrders.length,
    monthlySales,
    pricedOrdersCount: pricedOrders.length,
    aov,
    dueOrdersCount: dueOrders.length,
    dueAmount
  });
}

test().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
