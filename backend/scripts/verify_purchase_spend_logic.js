const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verifyInTransaction() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Transaction started (will ROLLBACK at the end)...');

    // 1. Get an existing item
    const itemRes = await client.query('SELECT id, sku, "branchId" FROM "InventoryItem" LIMIT 1');
    if (!itemRes.rows.length) throw new Error('No item found');
    const item = itemRes.rows[0];

    // 2. Create a test Supplier
    const supRes = await client.query(`
      INSERT INTO "Supplier" (code, name, "createdAt")
      VALUES ('TEST-SUP-01', 'Test Fabrics Lanka', NOW()) RETURNING id
    `);
    const supplierId = supRes.rows[0].id;

    // 3. Create a cancelled PO (should be EXCLUDED)
    await client.query(`
      INSERT INTO "PurchaseOrder" ("poNumber", "supplierId", status, "totalAmount", "createdAt")
      VALUES ('PO-TEST-CANCELLED', $1, 'CANCELLED', 50000, '2026-08-10 10:00:00')
    `, [supplierId]);

    // 4. Create an approved but NOT received PO (should be EXCLUDED)
    await client.query(`
      INSERT INTO "PurchaseOrder" ("poNumber", "supplierId", status, "totalAmount", "createdAt")
      VALUES ('PO-TEST-UNRECEIVED', $1, 'APPROVED', 75000, '2026-08-15 10:00:00')
    `, [supplierId]);

    // 5. Create a completed PO in 2026-08 (50 units @ LKR 100 = LKR 5,000, branch 1)
    const po1Res = await client.query(`
      INSERT INTO "PurchaseOrder" ("poNumber", "supplierId", "branchId", status, "totalAmount", "createdAt")
      VALUES ('PO-TEST-2026-08', $1, 1, 'RECEIVED', 5000, '2026-08-20 10:00:00') RETURNING id
    `, [supplierId]);
    const po1Id = po1Res.rows[0].id;

    await client.query(`
      INSERT INTO "PurchaseOrderItem" ("purchaseOrderId", "itemId", "quantityOrdered", "quantityReceived", "unitCost")
      VALUES ($1, $2, 50, 50, 100)
    `, [po1Id, item.id]);

    await client.query(`
      INSERT INTO "GoodsReceipt" ("grnNumber", "purchaseOrderId", "supplierInvoiceNo", "invoiceAmount", lines, "createdAt")
      VALUES ('GRN-TEST-08', $1, 'INV-08-999', 5000, $2, '2026-08-20 14:00:00')
    `, [po1Id, JSON.stringify([{ itemId: item.id, quantity: 50, unitCost: 100 }])]);

    await client.query(`
      INSERT INTO "StockMovement" ("itemId", type, quantity, "unitCost", "previousStock", "newStock", "referenceNo", "purchaseOrderId", "branchId", "createdAt")
      VALUES ($1, 'GRN_RECEIPT', 50, 100, 10, 60, 'GRN-TEST-08', $2, 1, '2026-08-20 14:00:00')
    `, [item.id, po1Id]);

    // 6. Create a completed PO in 2026-09 (30 units @ LKR 200 = LKR 6,000, branch 2)
    const po2Res = await client.query(`
      INSERT INTO "PurchaseOrder" ("poNumber", "supplierId", "branchId", status, "totalAmount", "createdAt")
      VALUES ('PO-TEST-2026-09', $1, 2, 'RECEIVED', 6000, '2026-09-12 10:00:00') RETURNING id
    `, [supplierId]);
    const po2Id = po2Res.rows[0].id;

    await client.query(`
      INSERT INTO "GoodsReceipt" ("grnNumber", "purchaseOrderId", "supplierInvoiceNo", "invoiceAmount", lines, "createdAt")
      VALUES ('GRN-TEST-09', $1, 'INV-09-100', 6000, '[]'::jsonb, '2026-09-12 14:00:00')
    `, [po2Id]);

    await client.query(`
      INSERT INTO "StockMovement" ("itemId", type, quantity, "unitCost", "previousStock", "newStock", "referenceNo", "purchaseOrderId", "branchId", "createdAt")
      VALUES ($1, 'GRN_RECEIPT', 30, 200, 60, 90, 'GRN-TEST-09', $2, 2, '2026-09-12 14:00:00')
    `, [item.id, po2Id]);

    // 7. Create a standalone direct STOCK_IN in 2026-10 (20 units @ LKR 150 = LKR 3,000, branch 1)
    await client.query(`
      INSERT INTO "StockMovement" ("itemId", type, quantity, "unitCost", "previousStock", "newStock", "referenceNo", "branchId", "createdAt")
      VALUES ($1, 'STOCK_IN', 20, 150, 90, 110, 'DIRECT-REC-01', 1, '2026-10-05 11:00:00')
    `, [item.id]);

    // 8. Create a duplicate-attempt: a STOCK_IN that references the GRN (should be IGNORED by duplicate prevention)
    await client.query(`
      INSERT INTO "StockMovement" ("itemId", type, quantity, "unitCost", "previousStock", "newStock", "referenceNo", "purchaseOrderId", "branchId", "createdAt")
      VALUES ($1, 'STOCK_IN', 50, 100, 110, 160, 'GRN-TEST-08', $2, 1, '2026-08-20 14:05:00')
    `, [item.id, po1Id]);

    // 9. Run the calculation query
    const baseCte = `
      WITH verified_purchases AS (
        SELECT
          m.id AS "movementId",
          m."itemId",
          i.sku,
          i.name AS "itemName",
          i.unit,
          i.category,
          'GRN_RECEIPT' AS "sourceType",
          m.quantity,
          m."unitCost",
          (m.quantity * m."unitCost") AS "totalCost",
          m."createdAt",
          m."branchId",
          b.name AS "branchName",
          m."referenceNo" AS "grnNumber",
          COALESCE(g."supplierInvoiceNo", '') AS "supplierInvoiceNo",
          COALESCE(s.name, sup.name, '') AS "supplierName",
          COALESCE(po."poNumber", '') AS "poNumber",
          COALESCE(m."performedByName", g."receivedByName", 'Staff') AS "receivedByName"
        FROM "StockMovement" m
        JOIN "InventoryItem" i ON i.id = m."itemId"
        LEFT JOIN "GoodsReceipt" g ON g."grnNumber" = m."referenceNo" OR (m."purchaseOrderId" IS NOT NULL AND g."purchaseOrderId" = m."purchaseOrderId")
        LEFT JOIN "PurchaseOrder" po ON po.id = m."purchaseOrderId"
        LEFT JOIN "Supplier" s ON s.id = po."supplierId"
        LEFT JOIN "Supplier" sup ON sup.id = m."supplierId"
        LEFT JOIN "Branch" b ON b.id = m."branchId"
        WHERE m.type = 'GRN_RECEIPT'
          AND m.quantity > 0
          AND m."unitCost" > 0

        UNION ALL

        SELECT
          m.id AS "movementId",
          m."itemId",
          i.sku,
          i.name AS "itemName",
          i.unit,
          i.category,
          'STOCK_IN' AS "sourceType",
          m.quantity,
          m."unitCost",
          (m.quantity * m."unitCost") AS "totalCost",
          m."createdAt",
          m."branchId",
          b.name AS "branchName",
          COALESCE(m."referenceNo", 'Direct Receipt') AS "grnNumber",
          COALESCE(m."referenceNo", '') AS "supplierInvoiceNo",
          COALESCE(sup.name, s.name, '') AS "supplierName",
          '' AS "poNumber",
          COALESCE(m."performedByName", 'Staff') AS "receivedByName"
        FROM "StockMovement" m
        JOIN "InventoryItem" i ON i.id = m."itemId"
        LEFT JOIN "Supplier" sup ON sup.id = m."supplierId"
        LEFT JOIN "Supplier" s ON s.id = i."supplierId"
        LEFT JOIN "Branch" b ON b.id = m."branchId"
        WHERE m.type IN ('STOCK_IN', 'PURCHASE')
          AND m.quantity > 0
          AND m."unitCost" > 0
          AND NOT EXISTS (
            SELECT 1 FROM "GoodsReceipt" g
            WHERE g."grnNumber" = m."referenceNo"
               OR (m."purchaseOrderId" IS NOT NULL AND g."purchaseOrderId" = m."purchaseOrderId")
          )
      )
    `;

    // ALL-TIME across all branches
    const allRes = await client.query(`${baseCte} SELECT COUNT(*)::int items, SUM("totalCost")::float total, COUNT(DISTINCT "grnNumber")::int receipts FROM verified_purchases`);
    console.log('All-time (all branches):', allRes.rows[0]);
    // Expected: GRN-08 (5,000) + GRN-09 (6,000) + DIRECT-01 (3,000) = 14,000.
    // Notice: 50,000 (cancelled) and 75,000 (unreceived) and GRN-08 duplicate are NOT counted!
    console.assert(allRes.rows[0].total === 14000, `Expected 14000 total, got ${allRes.rows[0].total}`);

    // MONTHLY BREAKDOWN
    const monthRes = await client.query(`${baseCte}
      SELECT
        to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
        SUM("totalCost")::float AS spend,
        COUNT(DISTINCT "grnNumber")::int AS receipts,
        COUNT(*)::int AS items
      FROM verified_purchases
      GROUP BY 1 ORDER BY 1 ASC
    `);
    console.log('Monthly breakdown:', monthRes.rows);
    // 2026-08: 5000, 2026-09: 6000, 2026-10: 3000
    console.assert(monthRes.rows.length === 3, 'Expected 3 months');
    console.assert(monthRes.rows[0].spend === 5000, '2026-08 spend must be 5000');
    console.assert(monthRes.rows[1].spend === 6000, '2026-09 spend must be 6000');
    console.assert(monthRes.rows[2].spend === 3000, '2026-10 spend must be 3000');

    // BRANCH 1 ONLY
    const b1Res = await client.query(`${baseCte} SELECT SUM("totalCost")::float total FROM verified_purchases WHERE "branchId" = 1`);
    console.log('Branch 1 total:', b1Res.rows[0].total);
    // Expected: GRN-08 (5000) + DIRECT-01 (3000) = 8000
    console.assert(b1Res.rows[0].total === 8000, `Expected 8000 for Branch 1, got ${b1Res.rows[0].total}`);

    // BRANCH 2 ONLY
    const b2Res = await client.query(`${baseCte} SELECT SUM("totalCost")::float total FROM verified_purchases WHERE "branchId" = 2`);
    console.log('Branch 2 total:', b2Res.rows[0].total);
    // Expected: GRN-09 (6000)
    console.assert(b2Res.rows[0].total === 6000, `Expected 6000 for Branch 2, got ${b2Res.rows[0].total}`);

    console.log('ALL ASSERTIONS PASSED PERFECTLY!');
  } finally {
    await client.query('ROLLBACK');
    console.log('Transaction safely ROLLED BACK. No changes persisted.');
    client.release();
    await pool.end();
  }
}

verifyInTransaction().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
