const { prisma, pool } = require('../backend/src/prisma');

async function testMonthlyWinnersLogic(reqYear, reqMonth, branchIdFilter) {
  // Asia/Colombo timezone offset is UTC+5.5 (330 minutes)
  const now = new Date();
  const colomboOffsetMs = 5.5 * 60 * 60 * 1000;
  const colomboNow = new Date(now.getTime() + colomboOffsetMs);

  const year = reqYear ? parseInt(reqYear) : colomboNow.getUTCFullYear();
  const month = reqMonth ? parseInt(reqMonth) : colomboNow.getUTCMonth() + 1;

  // Build ISO strings with +05:30
  const monthPadded = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayPadded = String(lastDay).padStart(2, '0');

  const startIso = `${year}-${monthPadded}-01T00:00:00.000+05:30`;
  const endIso = `${year}-${monthPadded}-${lastDayPadded}T23:59:59.999+05:30`;

  const startDateUtc = new Date(startIso);
  const endDateUtc = new Date(endIso);

  const invalidStatuses = ['REJECTED', 'CANCELLED', 'PRICE_DECLINED'];

  const orderWhere = {
    createdAt: { gte: startDateUtc, lte: endDateUtc },
    status: { notIn: invalidStatuses }
  };

  if (branchIdFilter && branchIdFilter !== 'ALL') {
    orderWhere.branchId = parseInt(branchIdFilter);
  }

  // Fetch orders for this month
  const orders = await prisma.order.findMany({
    where: orderWhere,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          primaryPhone: true,
          alternativePhone: true,
          address: true,
          profilePhoto: true
        }
      },
      garmentDetails: {
        select: {
          dressType: true,
          specialDesignInstructions: true
        }
      },
      payments: {
        select: {
          amount: true,
          status: true
        }
      }
    }
  });

  // Aggregate by customer
  const customerMap = new Map();

  for (const o of orders) {
    const custId = o.customerId;
    if (!customerMap.has(custId)) {
      customerMap.set(custId, {
        customerId: custId,
        customerName: o.customer?.name || 'Unknown',
        primaryPhone: o.customer?.primaryPhone || '',
        alternativePhone: o.customer?.alternativePhone || '',
        address: o.customer?.address || '',
        profilePhoto: o.customer?.profilePhoto || null,
        orderCount: 0,
        totalOrderValue: 0,
        totalPaid: 0,
        outstandingBalance: 0,
        orders: []
      });
    }

    const cData = customerMap.get(custId);
    cData.orderCount += 1;

    const total = Number(o.totalAmount) || 0;
    const balance = Number(o.balanceAmount) || 0;
    const paid = Math.max(0, total - balance);

    cData.totalOrderValue += total;
    cData.totalPaid += paid;
    cData.outstandingBalance += balance;

    cData.orders.push({
      id: o.id,
      orderNumber: o.orderNumber,
      date: o.createdAt,
      dressType: o.garmentDetails?.dressType || 'Custom Dress',
      design: o.garmentDetails?.dressType || o.garmentDetails?.specialDesignInstructions || 'Custom Design',
      status: o.status,
      totalAmount: total,
      paidAmount: paid,
      balanceAmount: balance
    });
  }

  // Sort by orderCount DESC, tie-breaker totalOrderValue DESC
  const ranked = Array.from(customerMap.values()).sort((a, b) => {
    if (b.orderCount !== a.orderCount) {
      return b.orderCount - a.orderCount;
    }
    return b.totalOrderValue - a.totalOrderValue;
  });

  const medals = ['GOLD', 'SILVER', 'BRONZE'];
  const leaderboard = ranked.map((c, idx) => ({
    rank: idx + 1,
    medal: idx < 3 ? medals[idx] : null,
    ...c
  }));

  const topThree = leaderboard.slice(0, 3);

  // Get available months across history
  const allValidOrders = await prisma.order.findMany({
    where: {
      status: { notIn: invalidStatuses }
    },
    select: { createdAt: true }
  });

  const monthsMap = new Map();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  for (const o of allValidOrders) {
    const d = new Date(o.createdAt.getTime() + colomboOffsetMs);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (!monthsMap.has(key)) {
      monthsMap.set(key, {
        year: y,
        month: m,
        label: `${monthNames[m - 1]} ${y}`,
        orderCount: 0
      });
    }
    monthsMap.get(key).orderCount += 1;
  }

  const availableMonths = Array.from(monthsMap.values()).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return b.month - a.month;
  });

  console.log(`\n========================================`);
  console.log(`Month: ${monthNames[month - 1]} ${year}`);
  console.log(`Total valid orders: ${orders.length}`);
  console.log(`Total customers with orders: ${leaderboard.length}`);
  console.log(`----------------------------------------`);
  console.log(`TOP 3 WINNERS:`);
  topThree.forEach(w => {
    console.log(`  [${w.medal}] #${w.rank} ${w.customerName} (${w.primaryPhone})`);
    console.log(`    Orders: ${w.orderCount} | Value: LKR ${w.totalOrderValue.toLocaleString()} | Paid: LKR ${w.totalPaid.toLocaleString()} | Due: LKR ${w.outstandingBalance.toLocaleString()}`);
  });
  console.log(`----------------------------------------`);
  console.log(`Available historical months:`, availableMonths);

  return {
    success: true,
    year,
    month,
    monthName: `${monthNames[month - 1]} ${year}`,
    availableMonths,
    topThree,
    leaderboard
  };
}

async function run() {
  await testMonthlyWinnersLogic(2026, 11);
  await testMonthlyWinnersLogic(2026, 10);
}

run()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

