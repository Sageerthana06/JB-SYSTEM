require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  await p.query(`
    ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
    UPDATE "Attendance" SET "userId" = "tailorId" WHERE "userId" IS NULL;
    ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "role" TEXT;
    ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "branch" TEXT;
  `);
  console.log('Columns added successfully');
  await p.end();
}
run().catch(console.error);
