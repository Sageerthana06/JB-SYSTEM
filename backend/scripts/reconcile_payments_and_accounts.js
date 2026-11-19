require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('=== FINANCIAL RECONCILIATION AUDIT ===\n');

  // 1. Inspect the 7 Payment records
  const paymentsRes = await pool.query(`
    SELECT 
      p.id as payment_id,
      p."orderId",
      o."orderNumber",
      o."branchId" as order_branch_id,
      b.name as branch_name,
      p.amount,
      p."paymentMethod",
      p.status,
      p."recordedBy",
      p."createdAt"
    FROM "Payment" p
    LEFT JOIN "Order" o ON p."orderId" = o.id
    LEFT JOIN "Branch" b ON o."branchId" = b.id
    ORDER BY p.id ASC;
  `);

  console.log('--- 1. Actual Customer Payments in "Payment" Table ---');
  console.table(paymentsRes.rows);

  const totalPayments = paymentsRes.rows.reduce((sum, r) => sum + Number(r.amount), 0);
  console.log(`Total Customer Payments Recorded: LKR ${totalPayments.toLocaleString()}`);

  // 2. Check FinancialAccount table
  const accountsRes = await pool.query(`
    SELECT id, "accountName", "accountType", "openingBalance", "currentBalance", "branchId", status, "isPrimary"
    FROM "FinancialAccount"
    ORDER BY id ASC;
  `);

  console.log('\n--- 2. Accounts in "FinancialAccount" Table ---');
  console.log(accountsRes.rows.length === 0 ? 'No accounts currently exist in FinancialAccount.' : accountsRes.rows);

  // 3. Check FinancialTransaction table
  const txnsRes = await pool.query(`
    SELECT count(*) as count, COALESCE(sum(amount), 0) as total FROM "FinancialTransaction";
  `);
  console.log('\n--- 3. Transactions in "FinancialTransaction" Table ---');
  console.log(txnsRes.rows[0]);

  // 4. Check Order totals vs Payments
  const ordersSummary = await pool.query(`
    SELECT 
      count(*) as total_orders,
      COALESCE(sum("totalAmount"), 0) as total_val,
      COALESCE(sum("agreedTotal"), 0) as agreed_val,
      COALESCE(sum("advancePayment"), 0) as advance_val
    FROM "Order"
    WHERE status NOT IN ('CANCELLED', 'REJECTED');
  `);
  console.log('\n--- 4. Active Orders Value vs Collections ---');
  console.log(ordersSummary.rows[0]);

  await pool.end();
}

main().catch(console.error);

