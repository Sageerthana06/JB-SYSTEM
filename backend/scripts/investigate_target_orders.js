require('dotenv').config({ path: 'e:/JB SYSTEM/backend/.env' });
const { prisma } = require('../src/prisma');

async function investigateOrders() {
  const connectionString = process.env.DATABASE_URL;

  try {
    // 1. Confirm database identity safely (masking credentials)
    const dbInfoRes = await prisma.$queryRaw`
      SELECT 
        current_database() as db_name,
        current_user as db_user,
        version() as pg_version
    `;
    
    const urlObj = new URL(connectionString.replace(/^postgresql:\/\//, 'http://'));
    const maskedHost = urlObj.hostname.replace(/^(...).*(...)$/, '$1***$2');
    
    console.log('=== 1. DATABASE IDENTITY (MASKED) ===');
    console.log(JSON.stringify({
      host: maskedHost,
      port: urlObj.port || '5432',
      database: dbInfoRes[0].db_name,
      userMasked: String(dbInfoRes[0].db_user).substring(0, 3) + '***',
      versionSnippet: String(dbInfoRes[0].pg_version).split(',')[0]
    }, null, 2));

    // 2. Find exact database records for the 5 order numbers
    const targetOrderNumbers = [
      'JB-20261024-0002',
      'JB-20261024-0003',
      'JB-20261024-0004',
      'JB-20261024-0005',
      'JB-20261024-0006'
    ];

    console.log('\n=== 2. QUERYING TARGET ORDERS VIA PRISMA ===');
    const orders = await prisma.order.findMany({
      where: {
        orderNumber: { in: targetOrderNumbers }
      },
      include: {
        customer: { select: { id: true, name: true, primaryPhone: true } },
        branch: { select: { id: true, name: true } },
        garmentDetails: true,
        payments: true,
        tasks: {
          include: {
            assignedTailor: { select: { id: true, name: true, role: true } }
          }
        },
        productionHistory: true
      },
      orderBy: { id: 'asc' }
    });

    console.log(`Found ${orders.length} order(s) out of 5 target order numbers.`);

    const orderIds = orders.map(o => o.id);

    for (const ord of orders) {
      console.log('\n--------------------------------------------------');
      console.log(`ORDER ID: ${ord.id} | NUMBER: ${ord.orderNumber}`);
      console.log(`  Created: ${ord.createdAt.toISOString()} | Status: ${ord.status} | Source: ${ord.orderSource}`);
      console.log(`  Customer: ID ${ord.customerId} — ${ord.customer?.name} (${ord.customer?.primaryPhone})`);
      console.log(`  Branch: ID ${ord.branchId} — ${ord.branch?.name}`);
      console.log(`  Financials: Total = Rs. ${ord.totalAmount}, Advance = Rs. ${ord.advancePayment}, Balance = Rs. ${ord.balanceAmount}, Status = ${ord.paymentStatus}`);
      console.log(`  Garment: DressType = ${ord.garmentDetails?.dressType}, Qty = ${ord.garmentDetails?.quantity}, RefImage = ${ord.garmentDetails?.designReferenceImage || 'None'}`);
      console.log(`  Payments Count: ${ord.payments.length}`);
      ord.payments.forEach(p => {
        console.log(`    - Payment #${p.id}: Amount = Rs. ${p.amount}, Method = ${p.paymentMethod}, Status = ${p.status}, Slip = ${p.slipImage || 'None'}`);
      });
      console.log(`  Tasks Count: ${ord.tasks.length}`);
      ord.tasks.forEach(t => {
        console.log(`    - Task #${t.id}: ${t.taskName} (${t.taskType}), Status = ${t.status}, AssignedTo = ${t.assignedTailor?.name || 'None'}`);
      });
      console.log(`  Production History Count: ${ord.productionHistory.length}`);
    }

    if (orderIds.length === 0) {
      console.log('\nNo matching orders found.');
      return;
    }

    // 3. Additional Dependencies Check
    console.log('\n=== 3. CHECKING LINKED MEASUREMENTS ===');
    const linkedMeasurements = await prisma.customerMeasurement.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true, customerId: true, orderId: true, dressType: true, takenBy: true }
    });
    console.log(`Found ${linkedMeasurements.length} linked customer measurement record(s):`, linkedMeasurements);

    console.log('\n=== 4. CHECKING MATERIAL REQUESTS ===');
    const matRequests = await prisma.orderMaterialRequest.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true, orderId: true, status: true, requestedByName: true }
    });
    console.log(`Found ${matRequests.length} material request(s):`, matRequests);

    console.log('\n=== 5. CHECKING STOCK MOVEMENTS ===');
    const stockMovs = await prisma.stockMovement.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true, orderId: true, movementType: true, quantity: true }
    });
    console.log(`Found ${stockMovs.length} stock movement(s):`, stockMovs);

    console.log('\n=== 6. CHECKING DEPENDENT ORDERS (previousOrderId) ===');
    const dependentOrders = await prisma.order.findMany({
      where: { previousOrderId: { in: orderIds } },
      select: { id: true, orderNumber: true, previousOrderId: true }
    });
    console.log(`Found ${dependentOrders.length} dependent order(s) referencing these orders:`, dependentOrders);

    console.log('\n=== 7. CHECKING AUDIT LOGS ===');
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'Order',
        entityId: { in: orderIds }
      },
      select: { id: true, action: true, entityId: true, userName: true, createdAt: true }
    });
    console.log(`Found ${auditLogs.length} audit log record(s):`, auditLogs);

    // 8. Foreign key constraints on "Order"
    console.log('\n=== 8. DATABASE FOREIGN KEY CONSTRAINTS ON "Order" ===');
    const fkInfo = await prisma.$queryRaw`
      SELECT
        tc.table_name,
        kcu.column_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      WHERE rc.unique_constraint_name IN (
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'Order' AND constraint_type = 'PRIMARY KEY'
      )
      ORDER BY tc.table_name ASC
    `;
    console.table(fkInfo);

  } catch (err) {
    console.error('Error during investigation:', err);
  } finally {
    await prisma.$disconnect();
  }
}

investigateOrders().catch(console.error);
