const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { prisma } = require('../backend/src/prisma');

async function testCustomerVaultLive() {
  console.log('================================================================');
  console.log('JB SYSTEM - CUSTOMER 360 & MEASUREMENT VAULT DATABASE AUDIT');
  console.log('================================================================');

  // 1. Total counts in database
  const customerCount = await prisma.customer.count();
  const orderCount = await prisma.order.count();
  const paymentCount = await prisma.payment.count();
  const measurementCount = await prisma.customerMeasurement.count();

  console.log(`\n1. DATABASE RECORD COUNTS:`);
  console.log(`- Customers: ${customerCount}`);
  console.log(`- Orders: ${orderCount}`);
  console.log(`- Payments: ${paymentCount}`);
  console.log(`- Measurements: ${measurementCount}`);

  // 2. Fetch search list (first 50 customers like GET /api/customers/search)
  const customers = await prisma.customer.findMany({
    take: 50,
    orderBy: { updatedAt: 'desc' },
    include: {
      orders: { orderBy: { createdAt: 'desc' }, take: 10, include: { garmentDetails: true } },
      measurements: { orderBy: { createdAt: 'desc' }, take: 5 }
    }
  });

  console.log(`\n2. SEARCH API SIMULATION (/api/customers/search):`);
  console.log(`- Returned Customers: ${customers.length}`);

  // Check duplicate customer names
  const nameMap = {};
  for (const c of customers) {
    if (!nameMap[c.name]) nameMap[c.name] = [];
    nameMap[c.name].push({ id: c.id, phone: c.primaryPhone, orders: c.orders.length });
  }

  const duplicates = Object.entries(nameMap).filter(([name, list]) => list.length > 1);
  console.log(`- Customer Names with multiple distinct profiles: ${duplicates.length}`);
  duplicates.forEach(([name, list]) => {
    console.log(`  * "${name}": ${list.map(x => `ID #${x.id} (Phone: ${x.phone || 'None'}, Orders: ${x.orders})`).join(' vs ')}`);
  });

  // 3. Test Customer with Alteration measurements (Customer #153 Pratheepa or similar)
  console.log(`\n3. ALTERATION MEASUREMENTS TEST:`);
  const alterationCust = await prisma.customer.findFirst({
    where: {
      measurements: {
        some: {
          OR: [
            { dressType: { contains: 'Alteration', mode: 'insensitive' } },
            { fittingInstructions: { contains: 'Alteration', mode: 'insensitive' } }
          ]
        }
      }
    },
    include: {
      measurements: true,
      orders: { include: { garmentDetails: true, payments: true, assignedTailor: true } }
    }
  });

  if (alterationCust) {
    console.log(`- Customer: ${alterationCust.name} (ID #${alterationCust.id})`);
    console.log(`- Phone: ${alterationCust.primaryPhone || 'Not Available'}`);
    console.log(`- Total Measurements: ${alterationCust.measurements.length}`);
    alterationCust.measurements.forEach((m, idx) => {
      console.log(`  [Record ${idx + 1}] Dress: "${m.dressType}", Unit: "${m.measurementUnit}", Fit: "${m.fitPreference}"`);
      console.log(`    Measurements JSON:`, typeof m.measurements === 'string' ? JSON.parse(m.measurements) : m.measurements);
      console.log(`    Fitting Notes: "${m.fittingInstructions || 'None'}"`);
    });
  }

  // 4. Test Customer with Standard Bespoke measurements
  console.log(`\n4. BESPOKE MEASUREMENTS TEST:`);
  const bespokeCust = await prisma.customer.findFirst({
    where: {
      measurements: {
        some: {
          NOT: { dressType: { contains: 'Alteration', mode: 'insensitive' } }
        }
      }
    },
    include: {
      measurements: true,
      orders: { include: { garmentDetails: true, payments: true, assignedTailor: true } }
    }
  });

  if (bespokeCust) {
    console.log(`- Customer: ${bespokeCust.name} (ID #${bespokeCust.id})`);
    const bm = bespokeCust.measurements[0];
    console.log(`- Dress Type: ${bm.dressType || 'Not Available'}`);
    console.log(`- Unit: ${bm.measurementUnit || 'Not Available'}`);
    console.log(`- Fit: ${bm.fitPreference ? `${bm.fitPreference} Fit` : 'Not Available'}`);
    const rawM = typeof bm.measurements === 'string' ? JSON.parse(bm.measurements) : bm.measurements;
    console.log(`- Sizing Keys:`, Object.keys(rawM || {}));
  }

  // 5. Test Financial Ledger Consistency (Orders, Payments, Balances)
  console.log(`\n5. FINANCIAL LEDGER TEST (Random sample of 5 customers with orders):`);
  const activeCustomers = await prisma.customer.findMany({
    where: { orders: { some: {} } },
    take: 5,
    include: {
      orders: {
        include: {
          payments: true
        }
      }
    }
  });

  for (const c of activeCustomers) {
    const orders = c.orders;
    const totalInvoiced = orders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const balanceDue = orders.reduce((sum, o) => sum + (Number(o.balanceAmount) || 0), 0);
    const verifiedPayments = orders.reduce((sum, o) => {
      const pTotal = (o.payments || [])
        .filter(p => !p.status || p.status === 'VERIFIED')
        .reduce((pSum, p) => pSum + (Number(p.amount) || 0), 0);
      return sum + (pTotal > 0 ? pTotal : Math.max(0, (Number(o.totalAmount) || 0) - (Number(o.balanceAmount) || 0)));
    }, 0);

    console.log(`- Cust #${c.id} ${c.name} (${orders.length} orders):`);
    console.log(`  * Total Invoiced: LKR ${totalInvoiced.toLocaleString()}`);
    console.log(`  * Total Paid: LKR ${verifiedPayments.toLocaleString()}`);
    console.log(`  * Balance Due: LKR ${balanceDue.toLocaleString()}`);
    console.log(`  * Reconciles (Invoiced == Paid + Due)? ${totalInvoiced === verifiedPayments + balanceDue ? 'EXACT' : 'Overpaid / Verified mismatch'}`);
  }

  console.log('\n================================================================');
  console.log('AUDIT COMPLETED SUCCESSFULLY - ALL DATA SOURCED FROM POSTGRESQL');
  console.log('================================================================\n');

  await prisma.$disconnect();
}

testCustomerVaultLive().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
