const { prisma, pool } = require('../src/prisma');

async function testControllerLogic({ year = 2026, month = 11, branchId = null, role = 'SUPER_ADMIN' }) {
  console.log(`\n=== Testing for ${year}-${month}, branch: ${branchId || 'ALL'}, role: ${role} ===`);
  const colomboOffsetMs = 5.5 * 60 * 60 * 1000;

  const monthPadded = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayPadded = String(lastDay).padStart(2, '0');

  const startIso = `${year}-${monthPadded}-01T00:00:00.000+05:30`;
  const endIso = `${year}-${monthPadded}-${lastDayPadded}T23:59:59.999+05:30`;

  const startDateUtc = new Date(startIso);
  const endDateUtc = new Date(endIso);

  const invalidStatuses = ['REJECTED', 'CANCELLED', 'PRICE_DECLINED'];

  let targetBranchId = null;
  if (role === 'MANAGER' && branchId) {
    targetBranchId = branchId;
  } else if (branchId && branchId !== 'ALL') {
    targetBranchId = parseInt(branchId, 10);
  }

  // 1. ORDERS RANKING
  const orderWhere = {
    createdAt: { gte: startDateUtc, lte: endDateUtc },
    status: { notIn: invalidStatuses }
  };
  if (targetBranchId) orderWhere.branchId = targetBranchId;

  const orders = await prisma.order.findMany({
    where: orderWhere,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: true,
      garmentDetails: true,
      assignedTailor: { select: { id: true, name: true } },
      payments: { select: { amount: true, status: true } }
    }
  });

  const ordersCustomerMap = new Map();
  for (const o of orders) {
    const custId = o.customerId;
    if (!ordersCustomerMap.has(custId)) {
      ordersCustomerMap.set(custId, {
        customerId: custId,
        customerName: o.customer?.name || 'Unknown Client',
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

    const cData = ordersCustomerMap.get(custId);
    cData.orderCount += 1;
    const total = Number(o.totalAmount) || 0;
    const balance = Number(o.balanceAmount) || 0;
    const paid = Math.max(0, total - balance);

    cData.totalOrderValue += total;
    cData.totalPaid += paid;
    cData.outstandingBalance += balance;

    cData.orders.push({
      id: o.id,
      orderNumber: o.orderNumber || `ORD-${o.id}`,
      date: o.createdAt || o.orderDate,
      design: o.garmentDetails?.dressType || o.garmentDetails?.specialDesignInstructions || 'Custom Design',
      dressType: o.garmentDetails?.dressType || 'Custom Dress',
      status: o.status,
      assignedTailor: o.assignedTailor,
      totalAmount: total,
      paidAmount: paid,
      balanceAmount: balance
    });
  }

  const ordersRanked = Array.from(ordersCustomerMap.values()).sort((a, b) => {
    if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
    return b.totalOrderValue - a.totalOrderValue;
  });

  const medals = ['GOLD', 'SILVER', 'BRONZE'];
  const ordersLeaderboard = ordersRanked.map((c, idx) => ({
    rank: idx + 1,
    medal: idx < 3 ? medals[idx] : null,
    ...c
  }));
  const ordersTopThree = ordersLeaderboard.slice(0, 3);

  const ordersSummary = {
    totalValidOrders: orders.length,
    totalCustomers: ordersLeaderboard.length,
    totalOrderValue: ordersLeaderboard.reduce((acc, c) => acc + c.totalOrderValue, 0),
    totalPaid: ordersLeaderboard.reduce((acc, c) => acc + c.totalPaid, 0),
    totalOutstanding: ordersLeaderboard.reduce((acc, c) => acc + c.outstandingBalance, 0)
  };

  // 2. PAYMENTS RANKING
  const paymentWhere = {
    createdAt: { gte: startDateUtc, lte: endDateUtc },
    status: 'VERIFIED',
    order: {
      status: { notIn: invalidStatuses },
      ...(targetBranchId ? { branchId: targetBranchId } : {})
    }
  };

  const payments = await prisma.payment.findMany({
    where: paymentWhere,
    orderBy: { createdAt: 'desc' },
    include: {
      order: {
        include: {
          customer: true,
          garmentDetails: true,
          assignedTailor: { select: { id: true, name: true } }
        }
      }
    }
  });

  const paymentsCustomerMap = new Map();
  for (const p of payments) {
    const o = p.order;
    const c = o.customer;
    const custId = c.id;

    if (!paymentsCustomerMap.has(custId)) {
      paymentsCustomerMap.set(custId, {
        customerId: custId,
        customerName: c.name || 'Unknown Client',
        primaryPhone: c.primaryPhone || '',
        alternativePhone: c.alternativePhone || '',
        address: c.address || '',
        profilePhoto: c.profilePhoto || null,
        totalVerifiedPayments: 0,
        paymentCount: 0,
        uniqueOrderIds: new Set(),
        ordersMap: new Map(),
        payments: []
      });
    }

    const cData = paymentsCustomerMap.get(custId);
    const amount = Number(p.amount) || 0;
    cData.totalVerifiedPayments += amount;
    cData.paymentCount += 1;
    cData.uniqueOrderIds.add(o.id);

    if (!cData.ordersMap.has(o.id)) {
      const total = Number(o.totalAmount) || 0;
      const balance = Number(o.balanceAmount) || 0;
      const paid = Math.max(0, total - balance);
      cData.ordersMap.set(o.id, {
        id: o.id,
        orderNumber: o.orderNumber || `ORD-${o.id}`,
        date: o.createdAt || o.orderDate,
        design: o.garmentDetails?.dressType || o.garmentDetails?.specialDesignInstructions || 'Custom Design',
        dressType: o.garmentDetails?.dressType || 'Custom Dress',
        status: o.status,
        assignedTailor: o.assignedTailor,
        totalAmount: total,
        paidAmount: paid,
        balanceAmount: balance,
        monthlyVerifiedPayments: 0
      });
    }
    cData.ordersMap.get(o.id).monthlyVerifiedPayments += amount;

    cData.payments.push({
      id: p.id,
      amount,
      paymentMethod: p.paymentMethod || 'Cash',
      createdAt: p.createdAt,
      orderId: o.id,
      orderNumber: o.orderNumber || `ORD-${o.id}`,
      notes: p.notes,
      transactionRef: p.transactionRef
    });
  }

  const paymentsRanked = Array.from(paymentsCustomerMap.values()).map(c => {
    const ordersList = Array.from(c.ordersMap.values());
    const totalOrderValue = ordersList.reduce((sum, ord) => sum + ord.totalAmount, 0);
    const outstandingBalance = ordersList.reduce((sum, ord) => sum + ord.balanceAmount, 0);
    return {
      customerId: c.customerId,
      customerName: c.customerName,
      primaryPhone: c.primaryPhone,
      alternativePhone: c.alternativePhone,
      address: c.address,
      profilePhoto: c.profilePhoto,
      totalVerifiedPayments: c.totalVerifiedPayments,
      paymentCount: c.paymentCount,
      uniqueOrderCount: c.uniqueOrderIds.size,
      orderCount: c.uniqueOrderIds.size, // for compatibility with modal stats
      totalPaid: c.totalVerifiedPayments, // for modal stats display
      totalOrderValue,
      outstandingBalance,
      orders: ordersList,
      payments: c.payments
    };
  }).sort((a, b) => {
    if (b.totalVerifiedPayments !== a.totalVerifiedPayments) {
      return b.totalVerifiedPayments - a.totalVerifiedPayments;
    }
    return b.uniqueOrderCount - a.uniqueOrderCount;
  });

  const paymentsLeaderboard = paymentsRanked.map((c, idx) => ({
    rank: idx + 1,
    medal: idx < 3 ? medals[idx] : null,
    ...c
  }));
  const paymentsTopThree = paymentsLeaderboard.slice(0, 3);

  const paymentsSummary = {
    totalVerifiedPayments: paymentsLeaderboard.reduce((acc, c) => acc + c.totalVerifiedPayments, 0),
    totalPaymentTransactions: payments.length,
    totalCustomers: paymentsLeaderboard.length,
    uniqueOrdersPaid: new Set(payments.map(p => p.orderId)).size,
    totalOrderValue: paymentsLeaderboard.reduce((acc, c) => acc + c.totalOrderValue, 0),
    totalOutstanding: paymentsLeaderboard.reduce((acc, c) => acc + c.outstandingBalance, 0)
  };

  console.log('Orders Summary:', ordersSummary);
  console.log('Orders Top 3:', ordersTopThree.map(w => `${w.rank}. ${w.customerName} (${w.orderCount} orders, LKR ${w.totalOrderValue})`));
  console.log('Payments Summary:', paymentsSummary);
  console.log('Payments Top 3:', paymentsTopThree.map(w => `${w.rank}. ${w.customerName} (LKR ${w.totalVerifiedPayments}, ${w.uniqueOrderCount} orders, ${w.paymentCount} payments)`));
}

async function main() {
  await testControllerLogic({ year: 2026, month: 11, branchId: 'ALL' });
  await testControllerLogic({ year: 2026, month: 11, branchId: 1 });
  await testControllerLogic({ year: 2026, month: 11, branchId: 2 });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    if (pool) await pool.end();
    process.exit(0);
  });
