const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testSpendQuery() {
  console.log('Testing Purchase Spend Query...');

  const query = `
    WITH verified_purchases AS (
      -- 1. GRN receipts
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

      -- 2. Direct costed stock-in purchases
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
    SELECT
      COUNT(*)::int AS "itemCount",
      COALESCE(SUM("totalCost"), 0)::float AS "totalSpend",
      COUNT(DISTINCT "grnNumber")::int AS "receiptCount"
    FROM verified_purchases;
  `;

  const res = await pool.query(query);
  console.log('Result:', res.rows[0]);

  // Also check monthly grouping query
  const monthlyQuery = `
    WITH verified_purchases AS (
      SELECT
        m.id AS "movementId",
        m.quantity,
        m."unitCost",
        (m.quantity * m."unitCost") AS "totalCost",
        m."createdAt",
        m."branchId",
        m."referenceNo" AS "grnNumber"
      FROM "StockMovement" m
      WHERE m.type = 'GRN_RECEIPT' AND m.quantity > 0 AND m."unitCost" > 0

      UNION ALL

      SELECT
        m.id AS "movementId",
        m.quantity,
        m."unitCost",
        (m.quantity * m."unitCost") AS "totalCost",
        m."createdAt",
        m."branchId",
        COALESCE(m."referenceNo", 'Direct') AS "grnNumber"
      FROM "StockMovement" m
      WHERE m.type IN ('STOCK_IN', 'PURCHASE') AND m.quantity > 0 AND m."unitCost" > 0
        AND NOT EXISTS (
          SELECT 1 FROM "GoodsReceipt" g
          WHERE g."grnNumber" = m."referenceNo"
             OR (m."purchaseOrderId" IS NOT NULL AND g."purchaseOrderId" = m."purchaseOrderId")
        )
    )
    SELECT
      to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS "month",
      COUNT(*)::int AS "itemCount",
      COUNT(DISTINCT "grnNumber")::int AS "receiptCount",
      COALESCE(SUM("totalCost"), 0)::float AS "spend"
    FROM verified_purchases
    GROUP BY 1
    ORDER BY 1 DESC;
  `;
  const mRes = await pool.query(monthlyQuery);
  console.log('Monthly breakdown:', mRes.rows);

  await pool.end();
}

testSpendQuery().catch(console.error);
