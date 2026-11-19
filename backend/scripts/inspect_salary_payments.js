require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'TailorSalaryPayment' ORDER BY ordinal_position;`);
  console.log('TailorSalaryPayment columns:');
  console.log(cols.rows);

  const payments = await pool.query(`SELECT count(*), COALESCE(sum("amount"), 0) as total FROM "TailorSalaryPayment";`);
  console.log('TailorSalaryPayment records:');
  console.log(payments.rows);

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

