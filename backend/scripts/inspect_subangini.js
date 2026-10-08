require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const users = await pool.query('SELECT id, name, email, role, "isActive", "branchId" FROM "User";');
  console.log('USERS:', users.rows);
  const order = await pool.query('SELECT id, "orderNumber", status, "assignedTailorId", "tailorAccepted", "tailorAcceptedAt", "tailorRejectedAt", "tailorRejectionReason" FROM "Order" WHERE "orderNumber" = \'ORD-2026-0020\';');
  console.log('ORDER ORD-2026-0020:', order.rows);
  const allTailorOrders = await pool.query('SELECT id, "orderNumber", status, "assignedTailorId", "tailorAccepted" FROM "Order" WHERE "assignedTailorId" IS NOT NULL;');
  console.log('ALL ASSIGNED ORDERS:', allTailorOrders.rows);
  await pool.end();
}
check();
