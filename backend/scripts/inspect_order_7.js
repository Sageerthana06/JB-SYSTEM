require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function inspect() {
  console.log('=== INSPECTING ORDER ORD-2026-0007 IN DATABASE ===');
  const res = await pool.query(`
    SELECT 
      o.id,
      o."orderNumber",
      o.status,
      o."customerId",
      c.name AS customer_name,
      c."primaryPhone",
      c.email,
      g."dressType",
      g.quantity,
      g."designReferenceImage",
      o."totalAmount",
      o."advancePayment",
      o."balanceAmount",
      o."createdAt"
    FROM "Order" o
    LEFT JOIN "Customer" c ON c.id = o."customerId"
    LEFT JOIN "GarmentDetails" g ON g."orderId" = o.id
    WHERE o."orderNumber" = 'ORD-2026-0007';
  `);

  if (res.rows.length === 0) {
    console.log('Order ORD-2026-0007 not found in DB.');
  } else {
    console.log('Found order in PostgreSQL:');
    console.log(JSON.stringify(res.rows[0], null, 2));
  }

  // Check production history for this order
  if (res.rows.length > 0) {
    const hist = await pool.query(`
      SELECT id, stage, notes, "startedAt"
      FROM "ProductionHistory"
      WHERE "orderId" = $1
      ORDER BY "startedAt" ASC;
    `, [res.rows[0].id]);
    console.log('Production History entries:', hist.rows);
  }

  await pool.end();
}

inspect().catch(console.error);
