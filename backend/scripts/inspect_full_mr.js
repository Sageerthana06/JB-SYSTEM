const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  for (const reqNo of ['MR-2026-0001', 'MR-2026-0002']) {
    console.log(`\n================== ${reqNo} ==================`);
    const reqs = await pool.query('SELECT * FROM "OrderMaterialRequest" WHERE "requestNo" = $1', [reqNo]);
    const r = reqs.rows[0];
    console.log('OrderMaterialRequest:', JSON.stringify(r, null, 2));

    if (!r) continue;

    const order = await pool.query('SELECT * FROM "Order" WHERE id = $1', [r.orderId]);
    console.log('\nOrder:', JSON.stringify(order.rows[0], null, 2));

    if (order.rows[0]?.customerId) {
      const cust = await pool.query('SELECT * FROM "Customer" WHERE id = $1', [order.rows[0].customerId]);
      console.log('\nCustomer from Order.customerId:', JSON.stringify(cust.rows[0], null, 2));
    }

    if (r.tailorId) {
      const t1 = await pool.query('SELECT id, name, role FROM "User" WHERE id = $1', [r.tailorId]);
      console.log('\nTailor from OrderMaterialRequest.tailorId:', JSON.stringify(t1.rows[0], null, 2));
    }
    if (order.rows[0]?.assignedTailorId) {
      const t2 = await pool.query('SELECT id, name, role FROM "User" WHERE id = $1', [order.rows[0].assignedTailorId]);
      console.log('\nTailor from Order.assignedTailorId:', JSON.stringify(t2.rows[0], null, 2));
    }

    const item = await pool.query('SELECT * FROM "InventoryItem" WHERE id = $1', [r.itemId]);
    console.log('\nInventoryItem:', JSON.stringify(item.rows[0], null, 2));

    const movements = await pool.query('SELECT * FROM "StockMovement" WHERE "materialRequestId" = $1 OR "referenceNo" = $2', [r.id, r.requestNo]);
    console.log('\nStock Movements:', JSON.stringify(movements.rows, null, 2));
  }

  console.log('\n================== TAILOR USERS IN DB ==================');
  const tailors = await pool.query('SELECT id, name, email, role, "isActive" FROM "User" WHERE role = \'TAILOR\'');
  console.log(JSON.stringify(tailors.rows, null, 2));

  console.log('\n================== ALL USERS WITH ID IN (1, 2, 3, 9) ==================');
  const someUsers = await pool.query('SELECT id, name, email, role FROM "User" WHERE id IN (1, 2, 3, 9)');
  console.log(JSON.stringify(someUsers.rows, null, 2));

  await pool.end();
}

check().catch(console.error);
