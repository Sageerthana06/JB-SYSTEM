require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`);
  console.log('Tables in DB:');
  console.log(tables.rows.map(r => r.table_name));

  const branches = await pool.query(`SELECT id, name, status FROM "Branch" ORDER BY id;`);
  console.log('\nBranches:');
  console.log(branches.rows);

  const orderCounts = await pool.query(`SELECT "branchId", count(*) as count FROM "Order" GROUP BY "branchId";`);
  console.log('\nOrder counts by branch:');
  console.log(orderCounts.rows);

  const paymentCounts = await pool.query(`SELECT status, count(*), sum(amount) as total FROM "Payment" GROUP BY status;`);
  console.log('\nPayments by status:');
  console.log(paymentCounts.rows);

  const inventorySummary = await pool.query(`SELECT "branchId", count(*) as items, sum("currentStock") as stock, sum("currentStock" * "unitCost") as val FROM "InventoryItem" GROUP BY "branchId";`);
  console.log('\nInventory by branch:');
  console.log(inventorySummary.rows);

  const tasksSummary = await pool.query(`SELECT "branchId", status, count(*) as count FROM "OrderTask" GROUP BY "branchId", status;`);
  console.log('\nTasks by branch and status:');
  console.log(tasksSummary.rows);

  const attendanceSummary = await pool.query(`SELECT branch, status, count(*) as count FROM "Attendance" GROUP BY branch, status;`);
  console.log('\nAttendance summary:');
  console.log(attendanceSummary.rows);

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

