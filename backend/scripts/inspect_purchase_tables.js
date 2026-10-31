const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const tables = ['InventoryItem', 'Supplier', 'PurchaseOrder', 'PurchaseOrderItem', 'GoodsReceipt', 'StockMovement'];
  for (const t of tables) {
    const res = await pool.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]);
    console.log('=== ' + t + ' (' + res.rows.length + ' cols) ===');
    res.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ') ' + (r.is_nullable === 'YES' ? 'NULL' : 'NOT NULL')));
  }
  await pool.end();
}

check().catch(console.error);
