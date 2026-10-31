const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function inspect() {
  console.log('=== INSPECTING MATERIAL REQUISITIONS ===');
  const reqs = await pool.query(`
    SELECT r.* 
    FROM "OrderMaterialRequest" r 
    WHERE r."requestNo" IN ('MR-2026-0001', 'MR-2026-0002')
    ORDER BY r."requestNo"
  `);
  console.log('OrderMaterialRequests found:', reqs.rows.length);
  for (const r of reqs.rows) {
    console.log('\n--- Requisition:', r.requestNo, '---');
    console.log(JSON.stringify(r, null, 2));

    const item = await pool.query('SELECT * FROM "InventoryItem" WHERE id = $1', [r.itemId]);
    console.log('Linked Item:', item.rows[0]);

    const order = await pool.query(`
      SELECT o.id, o."orderNumber", o.status, o."customerId", o."assignedTailorId", o."branchId",
             c.id as customer_id, c.name as customer_name, c."primaryPhone" as customer_phone
      FROM "Order" o
      LEFT JOIN "Customer" c ON c.id = o."customerId"
      WHERE o.id = $1 OR o."orderNumber" = $2
    `, [r.orderId, r.orderNumber]);
    console.log('Linked Order & Customer:', order.rows[0]);

    const tailorId = r.tailorId || order.rows[0]?.assignedTailorId;
    if (tailorId) {
      const tailor = await pool.query('SELECT id, name, email, role FROM "User" WHERE id = $1', [tailorId]);
      console.log('Assigned Tailor User:', tailor.rows[0]);
    }
  }

  console.log('\n=== ALL INVENTORY ITEMS ===');
  const items = await pool.query('SELECT id, sku, name, category, unit, "currentStock", "unitCost", "costStatus", "isActive", "createdAt" FROM "InventoryItem" ORDER BY id');
  console.log(JSON.stringify(items.rows, null, 2));

  console.log('\n=== STOCK MOVEMENTS FOR ITEMS ===');
  const movements = await pool.query(`
    SELECT m.id, m."itemId", i.sku, i.name, m.type, m.quantity, m."previousStock", m."newStock", m."referenceNo", m."orderNumber", m."materialRequestId", m."createdAt"
    FROM "StockMovement" m
    LEFT JOIN "InventoryItem" i ON i.id = m."itemId"
    ORDER BY m.id ASC
  `);
  console.log(JSON.stringify(movements.rows, null, 2));

  console.log('\n=== ORDERS JB-20261009-0004 & JB-20261009-0005 ===');
  const targetOrders = await pool.query(`
    SELECT o.id, o."orderNumber", o.status, o."customerId", o."assignedTailorId", c.name as customer_name, u.name as tailor_name
    FROM "Order" o
    LEFT JOIN "Customer" c ON c.id = o."customerId"
    LEFT JOIN "User" u ON u.id = o."assignedTailorId"
    WHERE o."orderNumber" IN ('JB-20261009-0004', 'JB-20261009-0005')
  `);
  console.log(JSON.stringify(targetOrders.rows, null, 2));

  console.log('\n=== DASHBOARD STATS CALCULATION ===');
  const stats1 = await pool.query(`
    SELECT
      COUNT(*)::int AS "totalItems",
      COUNT(*) FILTER (WHERE "isActive" = true)::int AS "activeItems",
      COUNT(*) FILTER (WHERE "currentStock" <= 0)::int AS "outOfStockItems",
      COUNT(*) FILTER (WHERE "currentStock" > 0 AND "currentStock" <= "reorderLevel")::int AS "lowStockItems",
      COALESCE(SUM("currentStock" * "unitCost") FILTER (WHERE "costStatus" = 'KNOWN'), 0) AS "stockValue",
      COUNT(*) FILTER (WHERE "costStatus" = 'UNKNOWN')::int AS "unknownCostItems"
    FROM "InventoryItem"
  `);
  console.log('InventoryItem stats:', stats1.rows[0]);

  await pool.end();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
