const { pool } = require('../src/prisma');

async function check() {
  const indexes = await pool.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Customer'");
  console.log('--- CUSTOMER INDEXES ---');
  console.log(indexes.rows);

  const orderNums = await pool.query('SELECT id, "orderNumber" FROM "Order" ORDER BY id ASC LIMIT 25');
  console.log('--- SAMPLE ORDER NUMBERS ---');
  console.log(orderNums.rows);

  const nonStandard = await pool.query('SELECT id, "orderNumber" FROM "Order" WHERE "orderNumber" NOT LIKE \'JB-%\' AND "orderNumber" NOT LIKE \'ORD-%\'');
  console.log('--- NON-STANDARD ORDER NUMBERS ---');
  console.log(nonStandard.rows);
}

check()
  .catch(console.error)
  .finally(() => process.exit(0));
