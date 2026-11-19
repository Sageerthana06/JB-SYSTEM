const { prisma, pool } = require('../backend/src/prisma');
const customerController = require('../backend/src/controllers/customerController');

async function testApi() {
  console.log('Testing getMonthlyCustomerWinners controller function...');

  const req = {
    user: { role: 'CEO', branchId: null },
    query: { year: '2026', month: '11' }
  };

  let statusCode = null;
  let responseBody = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };


  await customerController.getMonthlyCustomerWinners(req, res);

  console.log('Response Status:', statusCode);
  console.log('Success:', responseBody?.success);
  console.log('Month Name:', responseBody?.monthName);
  console.log('Top Three Count:', responseBody?.topThree?.length);
  console.log('Leaderboard Count:', responseBody?.leaderboard?.length);
  console.log('Top 3:');
  responseBody?.topThree?.forEach(w => {
    console.log(`  [${w.medal}] #${w.rank} ${w.customerName} - Orders: ${w.orderCount}, Value: LKR ${w.totalOrderValue}, Paid: LKR ${w.totalPaid}, Due: LKR ${w.outstandingBalance}`);
    console.log(`    First Order sample:`, w.orders[0]);
  });
  console.log('Summary:', responseBody?.summary);
  console.log('Available Months:', responseBody?.availableMonths);
}

testApi()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

