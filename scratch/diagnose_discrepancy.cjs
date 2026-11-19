const { prisma, pool } = require('../backend/src/prisma');

async function diagnose() {
  console.log('=== AUDITING ORDERS & FINANCIAL CALCULATIONS ===\n');

  const orders = await prisma.order.findMany({
    include: {
      payments: true,
      branch: { select: { id: true, name: true } }
    },
    orderBy: { id: 'asc' }
  });

  console.log(`Total orders in DB: ${orders.length}`);

  let sumTotalAmount = 0;
  let sumAgreedTotal = 0;
  let sumEffectiveTotal = 0;
  let sumAdvancePayment = 0;
  let sumBalanceAmount = 0;
  let sumPaymentsTable = 0;
  let sumVerifiedPayments = 0;

  const discrepancies = [];
  const overpaidOrders = [];

  for (const o of orders) {
    const isExcluded = ['CANCELLED', 'REJECTED', 'PRICE_DECLINED'].includes(String(o.status || '').toUpperCase());
    const total = Number(o.totalAmount) || 0;
    const agreed = Number(o.agreedTotal) || 0;
    const effectiveTotal = agreed > 0 ? agreed : total;
    const advance = Number(o.advancePayment) || 0;
    const balance = Number(o.balanceAmount) || 0;

    const allPaymentsSum = (o.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const verifiedPayments = (o.payments || []).filter(p => !p.status || String(p.status).trim().toUpperCase() === 'VERIFIED');
    const verifiedSum = verifiedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    if (!isExcluded) {
      sumTotalAmount += total;
      sumAgreedTotal += agreed;
      sumEffectiveTotal += effectiveTotal;
      sumAdvancePayment += advance;
      sumBalanceAmount += balance;
      sumPaymentsTable += allPaymentsSum;
      sumVerifiedPayments += verifiedSum;
    }

    // Check discrepancy
    // Standard formula: Effective Total = Paid + Balance
    // Paid can be verifiedSum (or advance if no payment rows)
    const legacyAdvance = Math.max(0, advance - verifiedSum);
    const actualPaid = verifiedSum + legacyAdvance;
    const expectedBalance = effectiveTotal > 0 ? Math.max(0, effectiveTotal - actualPaid) : 0;

    if (actualPaid > effectiveTotal && effectiveTotal > 0) {
      overpaidOrders.push({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        effectiveTotal,
        actualPaid,
        verifiedSum,
        advance,
        balance,
        diff: actualPaid - effectiveTotal
      });
    }

    if (Math.abs(balance - expectedBalance) > 0.01) {
      discrepancies.push({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total,
        agreed,
        effectiveTotal,
        advance,
        balanceInDb: balance,
        expectedBalance,
        verifiedSum,
        actualPaid,
        diff: balance - expectedBalance,
        payments: o.payments.map(p => ({ id: p.id, amount: p.amount, status: p.status }))
      });
    }
  }

  console.log('\n--- AGGREGATE TOTALS (Valid Orders) ---');
  console.log(`Sum totalAmount:         LKR ${sumTotalAmount.toFixed(2)}`);
  console.log(`Sum agreedTotal:         LKR ${sumAgreedTotal.toFixed(2)}`);
  console.log(`Sum effectiveTotal:      LKR ${sumEffectiveTotal.toFixed(2)}`);
  console.log(`Sum advancePayment:      LKR ${sumAdvancePayment.toFixed(2)}`);
  console.log(`Sum balanceAmount in DB: LKR ${sumBalanceAmount.toFixed(2)}`);
  console.log(`Sum all Payments in DB:  LKR ${sumPaymentsTable.toFixed(2)}`);
  console.log(`Sum verified Payments:   LKR ${sumVerifiedPayments.toFixed(2)}`);
  console.log(`Effective - Verified:    LKR ${(sumEffectiveTotal - sumVerifiedPayments).toFixed(2)}`);
  console.log(`Effective - (Verified + DB Balance): LKR ${(sumEffectiveTotal - (sumVerifiedPayments + sumBalanceAmount)).toFixed(2)}`);

  console.log('\n--- OVERPAID ORDERS ---');
  console.log(`Found ${overpaidOrders.length} overpaid orders:`);
  console.dir(overpaidOrders, { depth: null });

  console.log('\n--- DISCREPANCIES (balanceInDb !== expectedBalance) ---');
  console.log(`Found ${discrepancies.length} discrepancy orders:`);
  console.dir(discrepancies, { depth: null });
}

diagnose()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

