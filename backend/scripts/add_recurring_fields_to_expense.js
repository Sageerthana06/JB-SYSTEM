require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Adding recurring bill support columns to BusinessExpense...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
      ALTER TABLE "BusinessExpense" 
      ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "billingMonth" VARCHAR(10),
      ADD COLUMN IF NOT EXISTS "previousBalance" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS "expectedAmount" NUMERIC(12, 2);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "BusinessExpense_recurring_idx" 
      ON "BusinessExpense"("branchId", "category", "billingMonth");
    `);

    await client.query('COMMIT');
    console.log('Successfully added recurring bill fields to BusinessExpense.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

