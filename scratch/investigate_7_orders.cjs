const { prisma } = require('../backend/src/prisma');

async function investigate() {
  console.log('===============================================================');
  console.log('   JB GROUP - INVESTIGATION OF 7 EXCLUDED ORDERS (#202, #215, #239, #240, #245, #246, #247)');
  console.log('===============================================================\n');

  const targetIds = [202, 215, 239, 240, 245, 246, 247];

  const orders = await prisma.order.findMany({
    where: { id: { in: targetIds } },
    include: {
      customer: true,
      garmentDetails: true,
      branch: true,
      assignedTailor: true,
      tasks: {
        include: { assignedTailor: true },
        orderBy: { sequence: 'asc' }
      },
      payments: {
        orderBy: { createdAt: 'asc' }
      },
      productionHistory: {
        orderBy: { startedAt: 'asc' }
      }
    },
    orderBy: { id: 'asc' }
  });

  for (const o of orders) {
    console.log(`---------------------------------------------------------------`);
    console.log(`ORDER ID: #${o.id} | ORDER NUMBER: ${o.orderNumber}`);
    console.log(`---------------------------------------------------------------`);
    console.log(`Customer:              ${o.customer?.name} (${o.customer?.primaryPhone})`);
    console.log(`Branch:                ${o.branch?.name} (ID: ${o.branchId})`);
    console.log(`Garment Spec:          ${o.garmentDetails?.dressType} (Qty: ${o.garmentDetails?.quantity || 1})`);
    console.log(`Overall Order Status:  ${o.status}`);
    console.log(`Order Dates:           Created: ${o.createdAt?.toISOString()} | OrderDate: ${o.orderDate?.toISOString()} | CompletedAt: ${o.completedAt?.toISOString() || 'None'}`);
    
    console.log(`\n-- PRICE & APPROVAL FIELDS --`);
    console.log(`totalAmount:           LKR ${o.totalAmount}`);
    console.log(`agreedTotal:           ${o.agreedTotal !== null ? 'LKR ' + o.agreedTotal : 'NULL'}`);
    console.log(`advancePayment:        LKR ${o.advancePayment}`);
    console.log(`balanceAmount:         LKR ${o.balanceAmount}`);
    console.log(`priceStatus:           ${o.priceStatus}`);
    console.log(`priceAcceptedByCustomer: ${o.priceAcceptedByCustomer}`);
    console.log(`priceSentAt:           ${o.priceSentAt?.toISOString() || 'None'}`);
    console.log(`priceAcceptedAt:       ${o.priceAcceptedAt?.toISOString() || 'None'}`);
    console.log(`priceDeclinedAt:       ${o.priceDeclinedAt?.toISOString() || 'None'}`);
    console.log(`Primary AssignedTailor:${o.assignedTailor?.name || 'None'} (ID: ${o.assignedTailorId || 'None'})`);

    console.log(`\n-- PAYMENTS IN PAYMENT TABLE (${o.payments.length}) --`);
    if (o.payments.length === 0) {
      console.log(`  No rows in Payment table. Advance in Order: LKR ${o.advancePayment}`);
    } else {
      o.payments.forEach(p => {
        console.log(`  Payment #${p.id}: LKR ${p.amount} | Method: ${p.paymentMethod} | Status: ${p.status} | Ref: ${p.referenceNumber || 'None'} | Date: ${p.createdAt?.toISOString()}`);
      });
    }

    console.log(`\n-- TASKS IN ORDERTASK TABLE (${o.tasks.length}) --`);
    if (o.tasks.length === 0) {
      console.log(`  No granular OrderTask rows found.`);
    } else {
      o.tasks.forEach(t => {
        console.log(`  Task #${t.id}: Type=${t.taskType} | Seq=${t.sequence} | Status=${t.status} | Tailor=${t.assignedTailor?.name || 'Unassigned'} (ID: ${t.assignedTailorId}) | CompletedAt=${t.completedAt?.toISOString() || t.updatedAt?.toISOString()}`);
      });
    }

    console.log(`\n-- PRODUCTION HISTORY (${o.productionHistory.length}) --`);
    o.productionHistory.forEach(h => {
      console.log(`  Stage: ${h.stage} | Started: ${h.startedAt?.toISOString()} | Completed: ${h.completedAt?.toISOString()} | By: ${h.completedBy || 'System'}`);
    });

    console.log('\n');
  }

  await prisma.$disconnect();
}

investigate().catch(e => {
  console.error(e);
  process.exit(1);
});

