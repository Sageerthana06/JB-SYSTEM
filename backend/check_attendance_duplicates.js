const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkDuplicates() {
  try {
    const results = await prisma.$queryRaw`
      SELECT "userId", "date", COUNT(*) as count 
      FROM "Attendance" 
      WHERE "userId" IS NOT NULL
      GROUP BY "userId", "date" 
      HAVING COUNT(*) > 1
    `;
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();
