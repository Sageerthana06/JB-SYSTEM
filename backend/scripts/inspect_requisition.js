const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const reqs = await pool.query('SELECT * FROM "OrderMaterialRequest" WHERE "requestNo" = $1', ['MR-2026-0001']);
  console.log('=== OrderMaterialRequest MR-2026-0001 ===');
  console.log(JSON.stringify(reqs.rows[0], null, 2));

  if (reqs.rows[0]) {
    const r = reqs.rows[0];
    const item = await pool.query('SELECT * FROM "InventoryItem" WHERE id = $1', [r.itemId]);
    console.log('=== Linked InventoryItem ===');
    console.log(JSON.stringify(item.rows[0], null, 2));

    const order = await pool.query('SELECT o.*, c.name as customer_name, c.phone as customer_phone FROM "Order" o LEFT JOIN "Customer" c ON o."customerId" = c.id WHERE o.id = $1', [r.orderId]);
    console.log('=== Linked Order & Customer ===');
    console.log(JSON.stringify(order.rows[0], null, 2));

    const tailor = await pool.query('SELECT id, name, role FROM "User" WHERE id = $1', [r.tailorId]);
    console.log('=== Linked Tailor User ===');
    console.log(JSON.stringify(tailor.rows[0], null, 2));

    const movements = await pool.query('SELECT * FROM "StockMovement" WHERE "materialRequestId" = $1 OR "referenceNo" = $2', [r.id, r.requestNumber]);
    console.log('=== Stock Movements for this request ===');
    console.log(JSON.stringify(movements.rows, null, 2));
  }
  await pool.end();
}

check().catch(console.error);
