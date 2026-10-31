const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'OrderMaterialRequest' ORDER BY ordinal_position`);
  console.log('=== OrderMaterialRequest columns ===');
  cols.rows.forEach(c => console.log(c.column_name + ' (' + c.data_type + ')'));

  const allReqs = await pool.query('SELECT * FROM "OrderMaterialRequest" LIMIT 5');
  console.log('=== All OrderMaterialRequest rows ===');
  console.log(JSON.stringify(allReqs.rows, null, 2));
  await pool.end();
}

check().catch(console.error);
