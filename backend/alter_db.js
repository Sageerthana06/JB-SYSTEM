require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "advancePayment" DOUBLE PRECISION NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "balanceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;')
  .then(() => console.log('Success'))
  .catch(console.error)
  .finally(() => pool.end());
