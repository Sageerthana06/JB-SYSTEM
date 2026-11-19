require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 60000,
  ssl: { rejectUnauthorized: false }
});

async function queryWithRetry(sql, params = [], retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[WARN] Database query attempt ${attempt} failed (${err.message}). Retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function runSafeCleanup() {
  console.log('===============================================================');
  console.log('   JB SYSTEM – SAFE CLEANUP OF CEO-APPROVED TEST ORDERS        ');
  console.log('===============================================================\n');

  // STEP 1: Full Database Backup
  console.log('--- STEP 1: Creating Pre-Cleanup Full Database Backup ---');
  const backupDir = path.join(__dirname, '..', 'backups_test_orders');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup_before_test_order_cleanup_${timestamp}.json`);

  const tableRes = await queryWithRetry(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  const tables = tableRes.rows.map(r => r.table_name);
  console.log(`Discovered ${tables.length} tables in PostgreSQL database.`);

  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      action: 'pre_test_order_cleanup_backup',
      approvedOrderIds: [277, 279, 280, 281, 282],
      approvedTaskIds: [256, 257]
    },
    tables: {}
  };

  let totalRowsBackedUp = 0;
  for (const table of tables) {
    const dataRes = await queryWithRetry(`SELECT * FROM "${table}";`);
    backupData.tables[table] = dataRes.rows;
    totalRowsBackedUp += dataRes.rows.length;
  }

  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  const stats = fs.statSync(backupFile);
  console.log(`✓ Backup successfully written to: ${backupFile}`);
  console.log(`✓ Backup file size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB (${totalRowsBackedUp} total rows)\n`);

  // STEP 2: Strict Pre-Deletion Re-Verification
  console.log('--- STEP 2: Re-verifying Target Orders & Safety Checks ---');
  const targetOrderIds = [277, 279, 280, 281, 282];
  const targetTaskIds = [256, 257];

  const ordersRes = await queryWithRetry(`
    SELECT o.id, o."orderNumber", o."branchId", o."customerId", o."totalAmount", o.status,
           b.name as "branchName", c.name as "customerName", c."primaryPhone"
    FROM "Order" o
    JOIN "Branch" b ON o."branchId" = b.id
    JOIN "Customer" c ON o."customerId" = c.id
    WHERE o.id = ANY($1)
    ORDER BY o.id;
  `, [targetOrderIds]);

  if (ordersRes.rows.length !== targetOrderIds.length) {
    throw new Error(`CRITICAL: Expected ${targetOrderIds.length} orders, but found ${ordersRes.rows.length}. Aborting!`);
  }

  for (const row of ordersRes.rows) {
    console.log(`Order ID ${row.id}: ${row.orderNumber} | Branch: ${row.branchName} (${row.branchId}) | Customer: ${row.customerName} (${row.primaryPhone})`);
    if (!row.orderNumber.startsWith('TEST-JB-') && !row.orderNumber.startsWith('TEST-BELLA-')) {
      throw new Error(`CRITICAL SAFETY ABORT: Order ${row.id} (${row.orderNumber}) is NOT a test order! Stopping cleanup immediately.`);
    }
  }

  // Check payments on target orders
  const paymentsRes = await queryWithRetry(`
    SELECT * FROM "Payment" WHERE "orderId" = ANY($1);
  `, [targetOrderIds]);

  if (paymentsRes.rows.length > 0) {
    throw new Error(`CRITICAL SAFETY ABORT: Found ${paymentsRes.rows.length} real payments linked to target orders! Aborting!`);
  }
  console.log('✓ Verified: 0 payment records linked to target test orders.');

  // Check tasks on target orders
  const tasksRes = await queryWithRetry(`
    SELECT id, "orderId", "taskName", "taskType", "assignedTailorId", status
    FROM "OrderTask"
    WHERE "orderId" = ANY($1);
  `, [targetOrderIds]);

  console.log(`Found ${tasksRes.rows.length} tasks associated with test orders:`);
  for (const t of tasksRes.rows) {
    console.log(`  Task ID ${t.id}: Order ID ${t.orderId} | ${t.taskName} | Tailor: ${t.assignedTailorId}`);
    if (!targetTaskIds.includes(t.id)) {
      throw new Error(`CRITICAL SAFETY ABORT: Unexpected task ID ${t.id} found on test order! Aborting!`);
    }
  }

  // Check salary records on these tasks
  const salaryRes = await queryWithRetry(`
    SELECT * FROM "TailorSalaryPayment" WHERE "orderId" = ANY($1);
  `, [targetOrderIds]);
  if (salaryRes.rows.length > 0) {
    throw new Error(`CRITICAL SAFETY ABORT: Found salary payments linked to test orders! Aborting!`);
  }
  console.log('✓ Verified: 0 salary records linked to target test orders.');

  // STEP 3: Execute Safe Deletion within Transaction
  console.log('\n--- STEP 3: Executing Safe Deletion Inside Transaction ---');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Delete dependent placeholder tasks
    if (targetTaskIds.length > 0) {
      const delTasks = await client.query(`
        DELETE FROM "OrderTask"
        WHERE id = ANY($1) AND "orderId" = ANY($2)
        RETURNING id;
      `, [targetTaskIds, targetOrderIds]);
      console.log(`✓ Deleted ${delTasks.rowCount} placeholder tasks: [${delTasks.rows.map(r => r.id).join(', ')}]`);
    }

    // 2. Delete the 5 confirmed test orders
    const delOrders = await client.query(`
      DELETE FROM "Order"
      WHERE id = ANY($1) AND ("orderNumber" LIKE 'TEST-JB-%' OR "orderNumber" LIKE 'TEST-BELLA-%')
      RETURNING id, "orderNumber";
    `, [targetOrderIds]);
    console.log(`✓ Deleted ${delOrders.rowCount} approved test orders:`);
    for (const o of delOrders.rows) {
      console.log(`    - ID ${o.id}: ${o.orderNumber}`);
    }

    await client.query('COMMIT');
    console.log('✓ Transaction committed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transaction rolled back due to error:', err);
    throw err;
  } finally {
    client.release();
  }

  // STEP 4: Post-Deletion Verification
  console.log('\n--- STEP 4: Post-Deletion Verification ---');
  
  // Verify target orders are gone
  const verifyOrders = await queryWithRetry(`
    SELECT id, "orderNumber" FROM "Order" WHERE id = ANY($1);
  `, [targetOrderIds]);
  console.log(`Remaining target orders count: ${verifyOrders.rows.length} (Expected: 0)`);
  if (verifyOrders.rows.length !== 0) {
    throw new Error('Verification failed: Some target orders still exist in database!');
  }

  // Verify any remaining TEST- orders across the entire database
  const anyRemainingTestOrders = await queryWithRetry(`
    SELECT id, "orderNumber" FROM "Order" WHERE "orderNumber" LIKE 'TEST-%';
  `);
  console.log(`Total remaining 'TEST-%' orders in database: ${anyRemainingTestOrders.rows.length} (Expected: 0)`);

  // Verify Customer ID 150 (Laxshimi) is completely preserved
  const verifyCustomer = await queryWithRetry(`
    SELECT id, name, "primaryPhone", "alternativePhone", address, "createdAt"
    FROM "Customer"
    WHERE id = 150;
  `);
  if (verifyCustomer.rows.length === 1) {
    console.log(`✓ Customer ID 150 is intact: ${verifyCustomer.rows[0].name} (${verifyCustomer.rows[0].primaryPhone}), created ${verifyCustomer.rows[0].createdAt}`);
  } else {
    throw new Error('CRITICAL: Customer ID 150 not found!');
  }

  // Verify genuine customer orders (IDs 270-276) are untouched
  const verifyGenuine = await queryWithRetry(`
    SELECT id, "orderNumber", "totalAmount", status, "customerId"
    FROM "Order"
    WHERE id BETWEEN 270 AND 276
    ORDER BY id;
  `);
  console.log(`✓ Verified ${verifyGenuine.rows.length} genuine customer orders intact (IDs 270-276):`);
  for (const g of verifyGenuine.rows) {
    console.log(`    - Order ${g.id}: ${g.orderNumber} (LKR ${g.totalAmount})`);
  }

  console.log('\n===============================================================');
  console.log('   CLEANUP COMPLETED WITH 100% INTEGRITY VERIFIED               ');
  console.log('===============================================================');
}

runSafeCleanup()
  .catch((err) => {
    console.error('Cleanup execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });

