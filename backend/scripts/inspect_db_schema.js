require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const tables = ['InventoryItem', 'StockMovement'];
  for (const t of tables) {
    const res = await pool.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]);
    console.log(`=== ${t} (${res.rows.length} columns) ===`);
    res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (${r.is_nullable === 'YES' ? 'nullable' : 'not null'}${r.column_default ? ', default: ' + r.column_default : ''})`));
  }
  
  const fks = await pool.query(`
    SELECT
      tc.table_name, kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('InventoryItem', 'StockMovement', 'OrderMaterialRequest', 'PurchaseOrder', 'PurchaseOrderItem', 'GoodsReceipt')
    ORDER BY tc.table_name, kcu.column_name
  `);
  console.log('\n=== FOREIGN KEYS ===');
  fks.rows.forEach(r => console.log(`  ${r.table_name}.${r.column_name} -> ${r.foreign_table_name}.${r.foreign_column_name} [${r.constraint_name}]`));

  // Check indexes
  const idxRes = await pool.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE tablename IN ('InventoryItem', 'StockMovement', 'OrderMaterialRequest', 'PurchaseOrder', 'PurchaseOrderItem', 'GoodsReceipt')
    ORDER BY tablename, indexname
  `);
  console.log('\n=== INDEXES ===');
  idxRes.rows.forEach(r => console.log(`  ${r.tablename}.${r.indexname}`));

  // Check DB CHECK constraints
  const chkRes = await pool.query(`
    SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE contype = 'c' AND conrelid::regclass::text IN ('"InventoryItem"', '"StockMovement"', '"OrderMaterialRequest"')
  `);
  console.log('\n=== CHECK CONSTRAINTS ===');
  chkRes.rows.forEach(r => console.log(`  ${r.table_name} [${r.conname}]: ${r.def}`));

  // Check live inventory items and movements
  const items = await pool.query('SELECT id, sku, name, "currentStock", "openingStock", "unitCost", "costStatus", "latestPurchaseCost" FROM "InventoryItem"');
  console.log('\n=== CURRENT INVENTORY ITEMS IN DB ===');
  console.log(items.rows);
  const movs = await pool.query('SELECT id, "itemId", type, quantity, "unitCost", "previousStock", "newStock", "referenceNo" FROM "StockMovement" ORDER BY id DESC LIMIT 5');
  console.log('\n=== RECENT STOCK MOVEMENTS IN DB ===');
  console.log(movs.rows);

  await pool.end();
}

run().catch(console.error);
