const { pool } = require('../src/prisma');

async function main() {
  try {
    console.log('Adding readyNotificationSentBy column to "Order" table...');
    await pool.query(`
      ALTER TABLE "Order" 
      ADD COLUMN IF NOT EXISTS "readyNotificationSentBy" TEXT;
    `);
    console.log('Column readyNotificationSentBy ensured on "Order" table.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
