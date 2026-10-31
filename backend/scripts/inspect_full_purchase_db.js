const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Connected to DB...');
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('=== TABLES IN PUBLIC SCHEMA ===');
  for (const r of tables.rows) {
    try {
      const cnt = await pool.query(`SELECT COUNT(*)::int c FROM "${r.table_name}"`);
      console.log(`- ${r.table_name}: ${cnt.rows[0].c} rows`);
    } catch (e) {
      console.log(`- ${r.table_name}: ERROR ${e.message}`);
    }
  }

  console.log('\n=== InventoryItems ===');
  const items = await pool.query('SELECT id, sku, name, category, unit, "openingStock", "currentStock", "unitCost", "supplierId", "branchId", "isActive" FROM "InventoryItem"');
  console.log(JSON.stringify(items.rows, null, 2));

  console.log('\n=== StockMovements ===');
  const movements = await pool.query('SELECT * FROM "StockMovement" ORDER BY id');
  console.log(JSON.stringify(movements.rows, null, 2));

  console.log('\n=== PurchaseOrder ===');
  const pos = await pool.query('SELECT * FROM "PurchaseOrder"');
  console.log(JSON.stringify(pos.rows, null, 2));

  console.log('\n=== PurchaseOrderItem ===');
  const pois = await pool.query('SELECT * FROM "PurchaseOrderItem"');
  console.log(JSON.stringify(pois.rows, null, 2));

  console.log('\n=== GoodsReceipt ===');
  const grns = await pool.query('SELECT * FROM "GoodsReceipt"');
  console.log(JSON.stringify(grns.rows, null, 2));

  console.log('\n=== Supplier ===');
  const sups = await pool.query('SELECT * FROM "Supplier"');
  console.log(JSON.stringify(sups.rows, null, 2));

  console.log('\n=== Branches ===');
  const branches = await pool.query('SELECT * FROM "Branch"');
  console.log(JSON.stringify(branches.rows, null, 2));

  await pool.end();
}

main().catch(console.error);
