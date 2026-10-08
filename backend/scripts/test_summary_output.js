require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testSummary() {
  const allOrders = (await pool.query('SELECT id, "orderNumber", "orderDate", "totalAmount", "advancePayment", "balanceAmount", status, "createdAt" FROM "Order";')).rows;
  const allPayments = (await pool.query('SELECT amount, "createdAt" FROM "Payment";')).rows;

  const now = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklySales = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
    
    const dayOrders = allOrders.filter(o => {
      const d = new Date(o.orderDate || o.createdAt);
      return d >= dayStart && d < dayEnd;
    });

    const dayPayments = allPayments.filter(p => {
      const d = new Date(p.createdAt);
      return d >= dayStart && d < dayEnd;
    });

    const dayPaymentRev = dayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const dayOrderAdvance = dayOrders.reduce((sum, o) => sum + (Number(o.advancePayment) || 0), 0);
    const dayRevenue = dayPaymentRev > 0 ? dayPaymentRev : dayOrderAdvance;

    weeklySales.push({
      date: dayStart.toISOString().split('T')[0],
      day: dayNames[dayStart.getDay()],
      revenue: dayRevenue,
      orders: dayOrders.length
    });
  }

  console.log('--- Last 7 Days Weekly Sales Result ---');
  console.table(weeklySales);
  await pool.end();
}

testSummary().catch(console.error);
