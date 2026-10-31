// READ-ONLY inspection of purchase data used for spend analytics. No writes.
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  for (const t of ['GoodsReceipt', 'PurchaseOrder', 'PurchaseOrderItem', 'StockMovement']) {
    const c = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]);
    console.log(`\n== ${t} columns ==\n` + c.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
  }
  console.log('\n== GoodsReceipt ==');
  console.log(JSON.stringify((await pool.query('SELECT * FROM "GoodsReceipt" ORDER BY id')).rows, null, 2));
  console.log('\n== PurchaseOrder ==');
  console.log(JSON.stringify((await pool.query('SELECT id,"poNumber","supplierId","branchId",status,"totalAmount","createdAt" FROM "PurchaseOrder" ORDER BY id')).rows, null, 2));
  console.log('\n== PurchaseOrderItem ==');
  console.log(JSON.stringify((await pool.query('SELECT * FROM "PurchaseOrderItem" ORDER BY id')).rows, null, 2));
  console.log('\n== StockMovement types ==');
  console.log(JSON.stringify((await pool.query('SELECT type, COUNT(*)::int n, SUM(quantity) qty FROM "StockMovement" GROUP BY type')).rows, null, 2));
  console.log('\n== Supplier ==');
  console.log(JSON.stringify((await pool.query('SELECT id,code,name FROM "Supplier"')).rows, null, 2));
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
