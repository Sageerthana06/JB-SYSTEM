require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await pool.query(`
      ALTER TABLE "Customer"
      ADD COLUMN IF NOT EXISTS "email" TEXT,
      ADD COLUMN IF NOT EXISTS "password" TEXT;
    `);
    
    // Create unique index on email if it doesn't already exist (allowing nulls)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Customer_email_key" ON "Customer"("email");
    `);

    console.log('Successfully altered Customer table to add email and password.');
  } catch (err) {
    console.error('Error altering Customer table:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
