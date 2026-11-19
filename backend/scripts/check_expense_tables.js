require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const res = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('BusinessExpense', 'ExpensePaymentHistory', 'Expense');
  `);
  console.log('Existing expense-related tables:', res.rows.map(r => r.table_name));
  await pool.end();
}

check().catch(console.error);

