const { pool } = require('../backend/src/prisma');

async function check() {
  const res = await pool.query(`
    SELECT id, "orderNumber", "bookingNotificationPhone", "bookingNotificationMessage"
    FROM "Order"
    WHERE "bookingNotificationMessage" IS NOT NULL
    ORDER BY id DESC
    LIMIT 3;
  `);

  console.log('Found records:', res.rows.length);
  for (const row of res.rows) {
    console.log('--- Order ID:', row.id, row.orderNumber, '---');
    console.log(row.bookingNotificationMessage);
    if (row.bookingNotificationMessage) {
      console.log('Has replacement char (\\uFFFD):', row.bookingNotificationMessage.includes('\uFFFD'));
    }
  }
  await pool.end();
}

check().catch(console.error);

