/**
 * JB GROUP — Inventory module backup & rollback utility.
 *
 *   node scripts/inventory_backup_restore.js backup
 *       Dumps ALL inventory tables to backend/backups/inventory-<timestamp>.json (read-only).
 *
 *   node scripts/inventory_backup_restore.js core-snapshot
 *       Read-only row counts of every EXISTING core table (Order, Customer, Payment, ...)
 *       Run before and after the migration to prove no existing data changed.
 *
 *   node scripts/inventory_backup_restore.js rollback --i-understand-this-drops-inventory-data
 *       Removes ONLY the inventory tables created by apply_inventory_schema.js.
 *       Existing tables (Order, Customer, Payment, User, Attendance, ...) are never touched.
 *       Always takes a JSON backup first.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const INVENTORY_TABLES = [
  'InventoryAuditLog', 'StockMovement', 'GoodsReceipt', 'PurchaseOrderItem',
  'PurchaseOrder', 'OrderMaterialRequest', 'InventoryItem', 'Supplier'
];
const CORE_TABLES = [
  'User', 'Branch', 'Customer', 'Order', 'GarmentDetails', 'CustomerMeasurement',
  'ProductionHistory', 'Payment', 'Attendance', 'CustomerOtp'
];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function existing(client) {
  const r = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
  return new Set(r.rows.map(x => x.tablename));
}

async function backup(client) {
  const have = await existing(client);
  const dump = { takenAt: new Date().toISOString(), tables: {} };
  for (const t of INVENTORY_TABLES) {
    if (!have.has(t)) continue;
    dump.tables[t] = (await client.query(`SELECT * FROM "${t}" ORDER BY id`)).rows;
  }
  const dir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `inventory-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(dump, null, 2));
  console.log('[OK] Inventory backup written:', file);
  Object.entries(dump.tables).forEach(([t, rows]) => console.log(`   ${t}: ${rows.length} rows`));
  return file;
}

async function coreSnapshot(client) {
  const have = await existing(client);
  const out = {};
  for (const t of CORE_TABLES) {
    if (have.has(t)) out[t] = Number((await client.query(`SELECT COUNT(*)::int AS c FROM "${t}"`)).rows[0].c);
  }
  console.table(out);
  return out;
}

async function rollback(client) {
  if (!process.argv.includes('--i-understand-this-drops-inventory-data')) {
    console.error('Refusing to rollback without --i-understand-this-drops-inventory-data');
    process.exitCode = 1;
    return;
  }
  await backup(client);
  await client.query('BEGIN');
  for (const t of INVENTORY_TABLES) await client.query(`DROP TABLE IF EXISTS "${t}"`);
  await client.query('COMMIT');
  console.log('[OK] Inventory tables removed. Core tables untouched.');
}

(async () => {
  const cmd = process.argv[2];
  const client = await pool.connect();
  try {
    if (cmd === 'backup') await backup(client);
    else if (cmd === 'core-snapshot') await coreSnapshot(client);
    else if (cmd === 'rollback') await rollback(client);
    else console.log('Usage: backup | core-snapshot | rollback --i-understand-this-drops-inventory-data');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[FAILED]', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
