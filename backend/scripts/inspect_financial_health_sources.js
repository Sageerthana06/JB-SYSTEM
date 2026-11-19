const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('=== INSPECTING FINANCIAL HEALTH DATA SOURCES ===\n');

  // 1. All tables
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Tables in DB (' + tablesRes.rows.length + '):');
  console.log(tablesRes.rows.map(r => r.table_name).join(', '));

  // 2. Financial Accounts
  const accounts = await pool.query(`
    SELECT id, "accountName", "accountType", "currentBalance", "branchId", status 
    FROM "FinancialAccount" 
    ORDER BY id;
  `);
  console.log('\n--- Financial Accounts ---');
  console.log(accounts.rows);

  // 3. Financial Transactions
  const txns = await pool.query(`
    SELECT type, "approvalStatus", count(*), COALESCE(sum(amount), 0) as total 
    FROM "FinancialTransaction" 
    GROUP BY type, "approvalStatus";
  `);
  console.log('\n--- Financial Transactions by Type & Status ---');
  console.log(txns.rows);

  // 4. Accounting Categories
  const categories = await pool.query(`
    SELECT id, code, name, "categoryType" 
    FROM "AccountingCategory" 
    ORDER BY "categoryType", id;
  `);
  console.log('\n--- Accounting Categories (' + categories.rows.length + ') ---');
  console.log(categories.rows);

  // 5. Customer Payments
  const payments = await pool.query(`
    SELECT status, count(*), COALESCE(sum(amount), 0) as total 
    FROM "Payment" 
    GROUP BY status;
  `);
  console.log('\n--- Customer Payments ("Payment" table) ---');
  console.log(payments.rows);

  // 6. Orders & Customer Outstanding
  const orders = await pool.query(`
    SELECT count(*) as total_orders, 
           COALESCE(sum("totalAmount"), 0) as total_val, 
           COALESCE(sum("agreedTotal"), 0) as agreed_val,
           COALESCE(sum("advancePayment"), 0) as advance_val
    FROM "Order" 
    WHERE status NOT IN ('CANCELLED', 'REJECTED');
  `);
  console.log('\n--- Orders Summary ---');
  console.log(orders.rows);

  // 7. Purchase Orders & Supplier Outstanding
  const poSummary = await pool.query(`
    SELECT status, count(*), COALESCE(sum("totalAmount"), 0) as total 
    FROM "PurchaseOrder" 
    GROUP BY status;
  `);
  console.log('\n--- Purchase Orders by Status ---');
  console.log(poSummary.rows);

  // Check if there are supplier payments or invoices
  const supplierCols = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Supplier';
  `);
  console.log('\n--- Supplier Columns ---');
  console.log(supplierCols.rows.map(c => c.column_name).join(', '));

  // 8. Staff Salaries & Tailor Salaries
  const staffSalaries = await pool.query(`
    SELECT status, count(*), COALESCE(sum("netSalary"), 0) as net_total 
    FROM "EmployeeSalary" 
    GROUP BY status;
  `);
  console.log('\n--- Employee Salaries (Monthly Staff) ---');
  console.log(staffSalaries.rows);

  // Check Tailor salary tables
  const tailorSalCols = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND (table_name ILIKE '%tailor%' OR table_name ILIKE '%salary%');
  `);
  console.log('\n--- Tailor & Salary Tables ---');
  console.log(tailorSalCols.rows.map(r => r.table_name).join(', '));

  const tailorPayments = await pool.query(`
    SELECT count(*) as count, COALESCE(sum("amountPaid"), 0) as total_paid
    FROM "TailorSalaryPayment";
  `);
  console.log('\n--- TailorSalaryPayment count & total ---');
  console.log(tailorPayments.rows);

  // Salary Advances
  const advances = await pool.query(`
    SELECT status, count(*), COALESCE(sum(amount), 0) as total 
    FROM "SalaryAdvance" 
    GROUP BY status;
  `);
  console.log('\n--- Salary Advances ---');
  console.log(advances.rows);

  await pool.end();
}

main().catch(console.error);
