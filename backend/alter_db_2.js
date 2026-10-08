require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "profilePhoto" TEXT;')
  .then(() => console.log('Success adding profilePhoto'))
  .catch(console.error)
  .finally(() => pool.end());
