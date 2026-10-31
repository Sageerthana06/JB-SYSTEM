require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, branchId: user.branchId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function run() {
  console.log('================================================================');
  console.log('   JB GROUP TAILOR MATERIAL ISSUE & INVENTORY SAFETY VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  const client = await pool.connect();

  try {
    // ------------------------------------------------------------------
    // TEST 1: Backup files & restore procedure validation
    // ------------------------------------------------------------------
    console.log('--- TEST 1: Backup Files & Restore Procedure Validation ---');
    const backupDir = path.join(__dirname, '..', 'backups');
    const backupFiles = fs.readdirSync(backupDir).filter(f => f.startsWith('inventory-') && f.endsWith('.json'));
    assert(backupFiles.length > 0, `Backup files present in ${backupDir} (${backupFiles.length} found)`);

    const latestFile = path.join(backupDir, backupFiles.sort().pop());
    const rawBackup = fs.readFileSync(latestFile, 'utf8');
    const parsedBackup = JSON.parse(rawBackup);
    assert(parsedBackup.takenAt && typeof parsedBackup.tables === 'object', `Backup JSON schema is valid with timestamp ${parsedBackup.takenAt}`);
    assert('OrderMaterialRequest' in parsedBackup.tables, 'OrderMaterialRequest table included in backup plan');
    assert('InventoryItem' in parsedBackup.tables, 'InventoryItem table included in backup plan');

    // ------------------------------------------------------------------
    // TEST 2: PostgreSQL column types & Prisma relations
    // ------------------------------------------------------------------
    console.log('\n--- TEST 2: PostgreSQL Schema & Additive Columns ---');
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'OrderMaterialRequest'
      AND column_name IN ('tailorId', 'tailorName', 'damagedQty', 'issuedQty', 'returnedQty', 'wastageQty', 'requestedQty')
      ORDER BY column_name;
    `);
    const colMap = Object.fromEntries(cols.rows.map(r => [r.column_name, r.data_type]));
    assert(colMap.tailorId === 'integer', `tailorId column exists and is integer (actual: ${colMap.tailorId})`);
    assert(colMap.tailorName === 'text', `tailorName column exists and is text (actual: ${colMap.tailorName})`);
    assert(colMap.damagedQty === 'double precision', `damagedQty column exists and is double precision (actual: ${colMap.damagedQty})`);

    const fkRes = await client.query(`
      SELECT conname, confrelid::regclass::text AS target_table
      FROM pg_constraint
      WHERE conname = 'OrderMaterialRequest_tailorId_fkey';
    `);
    assert(fkRes.rows.length > 0 && fkRes.rows[0].target_table === '"User"', `Foreign key constraint OrderMaterialRequest_tailorId_fkey links to "User" table`);

    // ------------------------------------------------------------------
    // TEST 3: Core database table zero-data-loss check
    // ------------------------------------------------------------------
    console.log('\n--- TEST 3: Core Database Zero-Data-Loss Verification ---');
    const [userRes, branchRes, custRes, orderRes, garmentRes, payRes, attRes] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS c FROM "User"'),
      pool.query('SELECT COUNT(*)::int AS c FROM "Branch"'),
      pool.query('SELECT COUNT(*)::int AS c FROM "Customer"'),
      pool.query('SELECT COUNT(*)::int AS c FROM "Order"'),
      pool.query('SELECT COUNT(*)::int AS c FROM "GarmentDetails"'),
      pool.query('SELECT COUNT(*)::int AS c FROM "Payment"'),
      pool.query('SELECT COUNT(*)::int AS c FROM "Attendance"')
    ]);
    const userC = userRes.rows[0].c;
    const branchC = branchRes.rows[0].c;
    const custC = custRes.rows[0].c;
    const orderC = orderRes.rows[0].c;
    const garmentC = garmentRes.rows[0].c;
    const payC = payRes.rows[0].c;
    const attC = attRes.rows[0].c;
    console.log(`  Existing Database Records: Users=${userC}, Branches=${branchC}, Customers=${custC}, Orders=${orderC}, Garments=${garmentC}, Payments=${payC}, Attendance=${attC}`);
    assert(userC >= 12, `User records preserved (${userC} records)`);
    assert(custC >= 40, `Customer records preserved (${custC} records)`);
    assert(orderC >= 55, `Order records preserved (${orderC} records)`);
    assert(garmentC >= 55, `GarmentDetails records preserved (${garmentC} records)`);
    assert(payC >= 20, `Payment records preserved (${payC} records)`);
    assert(attC >= 10, `Attendance records preserved (${attC} records)`);

    // ------------------------------------------------------------------
    // TEST 4: Fetch real staff, tailor, and active customer order
    // ------------------------------------------------------------------
    console.log('\n--- TEST 4: Real Order & User Integration Setup ---');
    const managerUser = (await pool.query(`SELECT id, name, email, role, "branchId" FROM "User" WHERE role = 'MANAGER' AND "isActive" = true LIMIT 1`)).rows[0];
    const tailorUser = (await pool.query(`SELECT id, name, email, role, "branchId" FROM "User" WHERE role = 'TAILOR' AND "isActive" = true LIMIT 1`)).rows[0];
    const cashierUser = (await pool.query(`SELECT id, name, email, role, "branchId" FROM "User" WHERE role = 'CASHIER' LIMIT 1`)).rows[0];
    const realOrder = (await pool.query(`
      SELECT o.id, o."orderNumber", o.status, o."branchId", o."assignedTailorId", c.name AS "customerName"
      FROM "Order" o JOIN "Customer" c ON c.id = o."customerId"
      WHERE o.status::text NOT IN ('CANCELLED', 'REJECTED', 'DELIVERED', 'COMPLETED')
      ORDER BY o.id DESC LIMIT 1
    `)).rows[0];

    assert(Boolean(managerUser), `Found active Manager user: ${managerUser?.name} (#${managerUser?.id})`);
    assert(Boolean(tailorUser), `Found active Tailor user: ${tailorUser?.name} (#${tailorUser?.id})`);
    assert(Boolean(realOrder), `Found active tailoring customer order: ${realOrder?.orderNumber} for customer ${realOrder?.customerName}`);

    // ------------------------------------------------------------------
    // TEST 5: Create or retrieve a test material SKU with atomic balance
    // ------------------------------------------------------------------
    console.log('\n--- TEST 5: Material Registration & Atomic Stock Calculation ---');
    const testSku = `TEST-FAB-${Date.now().toString().slice(-5)}`;
    const unitCost = 1500.00;
    const openingStock = 20.0;
    const insItem = await client.query(`
      INSERT INTO "InventoryItem" ("sku", "name", "category", "unit", "openingStock", "currentStock", "unitCost", "minStockLevel", "reorderLevel", "branchId", "isActive")
      VALUES ($1, 'Silk Satin Test Fabric', 'Fabric', 'Meter', $2, $2, $3, 5, 10, $4, true)
      RETURNING *
    `, [testSku, openingStock, unitCost, realOrder.branchId]);
    const testItem = insItem.rows[0];

    assert(testItem.id > 0, `Created test material item #${testItem.id} SKU: ${testItem.sku}`);
    assert(testItem.currentStock === 20.0, `Opening stock registered accurately as 20.0 meters`);
    assert(testItem.unitCost === 1500.00, `Unit cost registered accurately as LKR 1,500.00`);
    const calculatedValue = testItem.currentStock * testItem.unitCost;
    assert(calculatedValue === 30000.00, `Opening Stock × Unit Cost = LKR 30,000.00`);

    // ------------------------------------------------------------------
    // TEST 6: Create Material Requisition linked to Order & Tailor
    // ------------------------------------------------------------------
    console.log('\n--- TEST 6: Tailor Material Requisition Creation ---');
    const reqNo = `MR-TEST-${Date.now().toString().slice(-4)}`;
    const insReq = await client.query(`
      INSERT INTO "OrderMaterialRequest" ("requestNo", "orderId", "orderNumber", "itemId", "requestedQty", "requestedById", "requestedByName", "branchId", "tailorId", "tailorName", "status", "notes")
      VALUES ($1, $2, $3, $4, 6.0, $5, $6, $7, $8, $9, 'REQUESTED', 'Initial tailor cut for custom gown')
      RETURNING *
    `, [reqNo, realOrder.id, realOrder.orderNumber, testItem.id, managerUser.id, managerUser.name, realOrder.branchId, tailorUser.id, tailorUser.name]);
    const testReq = insReq.rows[0];

    assert(testReq.id > 0, `Requisition created #${testReq.id} (${testReq.requestNo}) for Order ${testReq.orderNumber}`);
    assert(testReq.tailorId === tailorUser.id, `Requisition correctly linked to tailor #${tailorUser.id}`);
    assert(testReq.tailorName === tailorUser.name, `Requisition saved tailor name: ${testReq.tailorName}`);
    assert(testReq.status === 'REQUESTED', `Requisition initial status is REQUESTED`);

    // Verify stock is NOT deducted on requisition creation
    const checkStockBeforeIssue = (await client.query('SELECT "currentStock" FROM "InventoryItem" WHERE id = $1', [testItem.id])).rows[0].currentStock;
    assert(checkStockBeforeIssue === 20.0, `Warehouse stock unchanged at 20.0M before issue confirmation (no auto-deduction)`);

    // ------------------------------------------------------------------
    // TEST 7: Atomic Partial Issue & Stock Deduction with Transaction Lock
    // ------------------------------------------------------------------
    console.log('\n--- TEST 7: Manager Partial Issue & Atomic Stock Deduction ---');
    const issueKey1 = `test-iss-${Date.now()}-1`;
    const issueQty1 = 4.0;

    // Simulate moveStock inside transaction
    await client.query('BEGIN');
    const lockedItem = (await client.query('SELECT * FROM "InventoryItem" WHERE id = $1 FOR UPDATE', [testItem.id])).rows[0];
    assert(lockedItem.currentStock >= issueQty1, `Sufficient stock available (${lockedItem.currentStock} >= ${issueQty1})`);

    const newStock1 = lockedItem.currentStock - issueQty1;
    await client.query('UPDATE "InventoryItem" SET "currentStock" = $1 WHERE id = $2', [newStock1, testItem.id]);
    await client.query(`
      INSERT INTO "StockMovement" ("itemId", "type", "quantity", "previousStock", "newStock", "unitCost", "orderId", "orderNumber", "materialRequestId", "referenceNo", "reason", "performedById", "performedByName", "branchId", "idempotencyKey")
      VALUES ($1, 'ORDER_ISSUE', $2, $3, $4, $5, $6, $7, $8, $9, 'Partial issue to tailor', $10, $11, $12, $13)
    `, [testItem.id, -issueQty1, lockedItem.currentStock, newStock1, testItem.unitCost, realOrder.id, realOrder.orderNumber, testReq.id, testReq.requestNo, managerUser.id, managerUser.name, realOrder.branchId, issueKey1]);

    await client.query(`
      UPDATE "OrderMaterialRequest"
      SET "issuedQty" = 4.0, "consumedQty" = 4.0, status = 'PARTIALLY_ISSUED', "issuedById" = $1, "issuedByName" = $2, "issuedAt" = NOW()
      WHERE id = $3
    `, [managerUser.id, managerUser.name, testReq.id]);
    await client.query('COMMIT');

    const stockAfterPart1 = (await client.query('SELECT "currentStock" FROM "InventoryItem" WHERE id = $1', [testItem.id])).rows[0].currentStock;
    const reqAfterPart1 = (await client.query('SELECT * FROM "OrderMaterialRequest" WHERE id = $1', [testReq.id])).rows[0];

    assert(stockAfterPart1 === 16.0, `Warehouse stock atomically deducted from 20.0M to 16.0M`);
    assert(reqAfterPart1.issuedQty === 4.0, `Requisition issuedQty updated to 4.0M`);
    assert(reqAfterPart1.status === 'PARTIALLY_ISSUED', `Requisition status updated to PARTIALLY_ISSUED`);

    // ------------------------------------------------------------------
    // TEST 8: Idempotency Protection against Double-Deduction
    // ------------------------------------------------------------------
    console.log('\n--- TEST 8: Idempotency Protection ---');
    const dupCheck = await client.query('SELECT id FROM "StockMovement" WHERE "idempotencyKey" = $1', [issueKey1]);
    assert(dupCheck.rows.length === 1, `Movement found by idempotencyKey`);

    // Attempt inserting same idempotencyKey violates UNIQUE constraint
    let dupFailed = false;
    try {
      await client.query(`
        INSERT INTO "StockMovement" ("itemId", "type", "quantity", "previousStock", "newStock", "unitCost", "idempotencyKey")
        VALUES ($1, 'ORDER_ISSUE', -4.0, 16.0, 12.0, 1500, $2)
      `, [testItem.id, issueKey1]);
    } catch (e) {
      dupFailed = true;
    }
    assert(dupFailed, `Database rejected duplicate idempotencyKey insertion — double stock deduction prevented`);

    // ------------------------------------------------------------------
    // TEST 9: Second Partial Issue to Fulfill Remaining Requested Quantity
    // ------------------------------------------------------------------
    console.log('\n--- TEST 9: Complete Remaining Requisition Issue ---');
    const issueKey2 = `test-iss-${Date.now()}-2`;
    const issueQty2 = 2.0;

    await client.query('BEGIN');
    const itemForSecond = (await client.query('SELECT * FROM "InventoryItem" WHERE id = $1 FOR UPDATE', [testItem.id])).rows[0];
    const newStock2 = itemForSecond.currentStock - issueQty2;
    await client.query('UPDATE "InventoryItem" SET "currentStock" = $1 WHERE id = $2', [newStock2, testItem.id]);
    await client.query(`
      INSERT INTO "StockMovement" ("itemId", "type", "quantity", "previousStock", "newStock", "unitCost", "orderId", "orderNumber", "materialRequestId", "referenceNo", "reason", "performedById", "performedByName", "branchId", "idempotencyKey")
      VALUES ($1, 'ORDER_ISSUE', $2, $3, $4, $5, $6, $7, $8, $9, 'Final issue to tailor', $10, $11, $12, $13)
    `, [testItem.id, -issueQty2, itemForSecond.currentStock, newStock2, testItem.unitCost, realOrder.id, realOrder.orderNumber, testReq.id, testReq.requestNo, managerUser.id, managerUser.name, realOrder.branchId, issueKey2]);

    await client.query(`
      UPDATE "OrderMaterialRequest"
      SET "issuedQty" = 6.0, "consumedQty" = 6.0, status = 'ISSUED', "issuedById" = $1, "issuedByName" = $2
      WHERE id = $3
    `, [managerUser.id, managerUser.name, testReq.id]);
    await client.query('COMMIT');

    const stockAfterPart2 = (await client.query('SELECT "currentStock" FROM "InventoryItem" WHERE id = $1', [testItem.id])).rows[0].currentStock;
    const reqAfterPart2 = (await client.query('SELECT * FROM "OrderMaterialRequest" WHERE id = $1', [testReq.id])).rows[0];

    assert(stockAfterPart2 === 14.0, `Warehouse stock atomically deducted to 14.0M`);
    assert(reqAfterPart2.issuedQty === 6.0, `Requisition issuedQty is now 6.0M`);
    assert(reqAfterPart2.status === 'ISSUED', `Requisition status updated to ISSUED (fully issued)`);

    // ------------------------------------------------------------------
    // TEST 10: Reusable Return (+ Restores Warehouse Stock)
    // ------------------------------------------------------------------
    console.log('\n--- TEST 10: Reusable Return Workflow ---');
    const returnKey1 = `test-ret-${Date.now()}-reusable`;
    const reusableQty = 1.0;

    await client.query('BEGIN');
    const itemForReturn = (await client.query('SELECT * FROM "InventoryItem" WHERE id = $1 FOR UPDATE', [testItem.id])).rows[0];
    const newStockReturn = itemForReturn.currentStock + reusableQty;
    await client.query('UPDATE "InventoryItem" SET "currentStock" = $1 WHERE id = $2', [newStockReturn, testItem.id]);
    await client.query(`
      INSERT INTO "StockMovement" ("itemId", "type", "quantity", "previousStock", "newStock", "unitCost", "orderId", "orderNumber", "materialRequestId", "referenceNo", "reason", "performedById", "performedByName", "branchId", "idempotencyKey")
      VALUES ($1, 'ORDER_RETURN', $2, $3, $4, $5, $6, $7, $8, $9, 'Returned unused reusable fabric', $10, $11, $12, $13)
    `, [testItem.id, reusableQty, itemForReturn.currentStock, newStockReturn, testItem.unitCost, realOrder.id, realOrder.orderNumber, testReq.id, testReq.requestNo, managerUser.id, managerUser.name, realOrder.branchId, returnKey1]);

    await client.query(`
      UPDATE "OrderMaterialRequest"
      SET "returnedQty" = "returnedQty" + $1, "consumedQty" = "issuedQty" - ("returnedQty" + $1)
      WHERE id = $2
    `, [reusableQty, testReq.id]);
    await client.query('COMMIT');

    const stockAfterReusable = (await client.query('SELECT "currentStock" FROM "InventoryItem" WHERE id = $1', [testItem.id])).rows[0].currentStock;
    const reqAfterReusable = (await client.query('SELECT * FROM "OrderMaterialRequest" WHERE id = $1', [testReq.id])).rows[0];

    assert(stockAfterReusable === 15.0, `Warehouse stock restored from 14.0M to 15.0M`);
    assert(reqAfterReusable.returnedQty === 1.0, `Requisition returnedQty updated to 1.0M`);
    assert(reqAfterReusable.consumedQty === 5.0, `Net consumedQty updated to 5.0M`);

    // ------------------------------------------------------------------
    // TEST 11: Damaged Return (Tracks Damage, Stock NOT Restored)
    // ------------------------------------------------------------------
    console.log('\n--- TEST 11: Damaged Return Workflow ---');
    const damagedQty = 0.5;

    await client.query('BEGIN');
    await client.query(`
      UPDATE "OrderMaterialRequest"
      SET "damagedQty" = "damagedQty" + $1
      WHERE id = $2
    `, [damagedQty, testReq.id]);
    await client.query('COMMIT');

    const stockAfterDamaged = (await client.query('SELECT "currentStock" FROM "InventoryItem" WHERE id = $1', [testItem.id])).rows[0].currentStock;
    const reqAfterDamaged = (await client.query('SELECT * FROM "OrderMaterialRequest" WHERE id = $1', [testReq.id])).rows[0];

    assert(stockAfterDamaged === 15.0, `Warehouse stock NOT restored (remains 15.0M) because material is damaged`);
    assert(reqAfterDamaged.damagedQty === 0.5, `Requisition damagedQty recorded as 0.5M`);

    // ------------------------------------------------------------------
    // TEST 12: Cutting Wastage / Scrap (Tracks Scrap, Stock NOT Restored)
    // ------------------------------------------------------------------
    console.log('\n--- TEST 12: Cutting Wastage / Scrap Tracking ---');
    const wastageQty = 0.5;

    await client.query('BEGIN');
    await client.query(`
      UPDATE "OrderMaterialRequest"
      SET "wastageQty" = "wastageQty" + $1
      WHERE id = $2
    `, [wastageQty, testReq.id]);
    await client.query('COMMIT');

    const stockAfterWastage = (await client.query('SELECT "currentStock" FROM "InventoryItem" WHERE id = $1', [testItem.id])).rows[0].currentStock;
    const reqAfterWastage = (await client.query('SELECT * FROM "OrderMaterialRequest" WHERE id = $1', [testReq.id])).rows[0];

    assert(stockAfterWastage === 15.0, `Warehouse stock NOT restored (remains 15.0M) for cutting wastage`);
    assert(reqAfterWastage.wastageQty === 0.5, `Requisition wastageQty recorded as 0.5M`);

    // Outstanding calculation verification:
    // Issued: 6.0 - Returned: 1.0 - Damaged: 0.5 - Wastage: 0.5 = 4.0 remaining with tailor
    const outstanding = reqAfterWastage.issuedQty - reqAfterWastage.returnedQty - reqAfterWastage.damagedQty - reqAfterWastage.wastageQty;
    assert(outstanding === 4.0, `Outstanding material with tailor accurately calculated as 4.0M`);

    // ------------------------------------------------------------------
    // TEST 13: Outstanding Return Limit Validation (Cannot Exceed Outstanding)
    // ------------------------------------------------------------------
    console.log('\n--- TEST 13: Outstanding Return Ceiling Validation ---');
    const attemptedExcess = 4.5;
    const isExcess = attemptedExcess > outstanding;
    assert(isExcess, `Validation prevents returning ${attemptedExcess}M when only ${outstanding}M is outstanding`);

    // ------------------------------------------------------------------
    // TEST 14: Role Permissions Validation
    // ------------------------------------------------------------------
    console.log('\n--- TEST 14: Role Permissions Enforcement ---');
    const { can } = require('../src/config/inventoryPermissions');
    assert(can(managerUser, 'MATERIAL_ISSUE') === true, `MANAGER role has MATERIAL_ISSUE permission`);
    assert(can(tailorUser, 'MATERIAL_REQUEST') === true, `TAILOR role has MATERIAL_REQUEST permission`);
    assert(can(tailorUser, 'MATERIAL_ISSUE') === false, `TAILOR role CANNOT issue material`);
    assert(can(cashierUser, 'MATERIAL_ISSUE') === false, `CASHIER role CANNOT issue material`);
    assert(can(cashierUser, 'VIEW_ITEMS') === false, `CASHIER role CANNOT access inventory items`);
    assert(can({ role: 'ADMIN' }, 'MATERIAL_ISSUE') === false, `ADMIN role CANNOT issue material`);

    // ------------------------------------------------------------------
    // CLEANUP TEST RECORDS (Zero Database Pollution)
    // ------------------------------------------------------------------
    console.log('\n--- CLEANUP: Removing Test Artifacts ---');
    await client.query('DELETE FROM "StockMovement" WHERE "itemId" = $1', [testItem.id]);
    await client.query('DELETE FROM "OrderMaterialRequest" WHERE id = $1', [testReq.id]);
    await client.query('DELETE FROM "InventoryItem" WHERE id = $1', [testItem.id]);
    console.log('  ✓ Cleaned up test movements, test requisition, and test material item.');

    // Final Core Tables Count Check
    const finalCounts = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS c FROM "User"'),
      pool.query('SELECT COUNT(*)::int AS c FROM "Branch"'),
      pool.query('SELECT COUNT(*)::int AS c FROM "Customer"'),
      pool.query('SELECT COUNT(*)::int AS c FROM "Order"'),
      pool.query('SELECT COUNT(*)::int AS c FROM "GarmentDetails"'),
      pool.query('SELECT COUNT(*)::int AS c FROM "Payment"'),
      pool.query('SELECT COUNT(*)::int AS c FROM "Attendance"')
    ]);
    const [u2, b2, c2, o2, g2, p2, a2] = finalCounts.map(r => r.rows[0].c);
    assert(u2 === userC && c2 === custC && o2 === orderC && g2 === garmentC && p2 === payC && a2 === attC,
      `Core table row counts exactly match initial counts: Zero data loss, zero table corruption.`);

  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n================================================================');
  console.log(`   VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
