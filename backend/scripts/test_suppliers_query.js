const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`SELECT s.*,
       (SELECT COUNT(*)::int FROM "InventoryItem" i WHERE i."supplierId" = s.id) AS "itemCount",
       (SELECT COUNT(*)::int FROM "PurchaseOrder" p WHERE p."supplierId" = s.id) AS "poCount",
       (SELECT COALESCE(SUM(pi."quantityReceived" * pi."unitCost"),0) FROM "PurchaseOrderItem" pi
          JOIN "PurchaseOrder" p ON p.id = pi."purchaseOrderId" WHERE p."supplierId" = s.id) AS "totalPurchased",
       (SELECT MAX(p."createdAt") FROM "PurchaseOrder" p WHERE p."supplierId" = s.id) AS "lastOrderAt"
     FROM "Supplier" s ORDER BY s."isActive" DESC, s.name ASC`);
    console.log('Suppliers row count:', res.rows.length);
    console.log('Suppliers:', res.rows);
  } catch (e) {
    console.error('Error:', e);
  }
  await pool.end();
}

run();
