require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    await pool.query('ALTER TABLE "Order" ADD COLUMN "orderSource" text DEFAULT \'SHOP\'');
    console.log('Successfully added orderSource column to Order table');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('Column orderSource already exists');
    } else {
      console.error('Migration error:', err.message);
    }
  } finally {
    await pool.end();
  }
}
migrate();
