const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS "CustomerOtp" (
        "id" SERIAL NOT NULL,
        "identifier" TEXT NOT NULL,
        "otpHash" TEXT NOT NULL,
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "CustomerOtp_pkey" PRIMARY KEY ("id")
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOtp_identifier_key" ON "CustomerOtp"("identifier");
  `;
  
  try {
    console.log("Executing SQL...");
    await pool.query(sql);
    console.log("Table CustomerOtp and unique index created successfully.");
  } catch (error) {
    console.error("Error creating table:", error);
  } finally {
    await pool.end();
  }
}

createTable();
