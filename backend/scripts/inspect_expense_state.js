require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const mb = await pool.query('SELECT count(*) FROM "MonthlyBill"');
  const ft = await pool.query('SELECT count(*) FROM "FinancialTransaction" WHERE type = \'EXPENSE\'');
  const cats = await pool.query('SELECT id, code, name, "categoryType" FROM "AccountingCategory" WHERE "categoryType" = \'EXPENSE\' ORDER BY id');
  const accounts = await pool.query('SELECT id, "accountName", "accountType", "currentBalance", "branchId" FROM "FinancialAccount"');
  
  console.log('MonthlyBill count:', mb.rows[0].count);
  console.log('FinancialTransaction EXPENSE count:', ft.rows[0].count);
  console.log('FinancialAccount count:', accounts.rows.length);
  console.log('Expense categories:', cats.rows.map(c => `${c.code}: ${c.name}`));
  
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

