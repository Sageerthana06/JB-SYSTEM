require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../src/prisma');

async function main() {
  const branches = await pool.query('SELECT * FROM "Branch" ORDER BY id');
  console.log('=== BRANCHES ===');
  console.log(branches.rows);

  const usersByRole = await pool.query('SELECT role, "branchId", count(*) as count FROM "User" GROUP BY role, "branchId" ORDER BY role, "branchId"');
  console.log('\n=== USERS BY ROLE & BRANCH ===');
  console.log(usersByRole.rows);

  const employees = await pool.query('SELECT count(*) FROM "Employee"');
  console.log('\n=== EMPLOYEES COUNT ===');
  console.log(employees.rows[0].count);

  const orders = await pool.query('SELECT count(*) as total_orders, sum("totalAmount") as total_val, sum("advancePayment") as total_adv, sum("balanceAmount") as total_bal FROM "Order"');
  console.log('\n=== ORDERS TOTALS ===');
  console.log(orders.rows[0]);

  const payments = await pool.query('SELECT status, "paymentMethod", count(*), sum(amount) as sum FROM "Payment" GROUP BY status, "paymentMethod"');
  console.log('\n=== PAYMENTS BY STATUS & METHOD ===');
  console.log(payments.rows);

  const tailorPayments = await pool.query('SELECT count(*), sum("amountPaid") as total_paid FROM "TailorSalaryPayment"');
  console.log('\n=== TAILOR SALARY PAYMENTS ===');
  console.log(tailorPayments.rows[0]);

  const pos = await pool.query('SELECT status, count(*), sum("totalAmount") as total_val FROM "PurchaseOrder" GROUP BY status');
  console.log('\n=== PURCHASE ORDERS ===');
  console.log(pos.rows);

  const items = await pool.query('SELECT count(*) as total_items, sum("currentStock") as total_qty, sum("currentStock" * "unitCost") as stock_val FROM "InventoryItem"');
  console.log('\n=== INVENTORY ITEMS ===');
  console.log(items.rows[0]);

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

