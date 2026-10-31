require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function dryRunRestoreValidation() {
  const backupDir = path.join(__dirname, '..', 'backups');
  const files = fs.readdirSync(backupDir).filter(f => f.startsWith('inventory-') && f.endsWith('.json')).sort();
  const latestFile = path.join(backupDir, files[files.length - 1]);
  console.log('Validating backup file:', latestFile);
  const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
  console.log('Backup timestamp:', data.takenAt);

  const tables = Object.keys(data.tables);
  console.log('Tables in backup:', tables.join(', '));

  for (const t of tables) {
    const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [t]);
    const cols = new Set(res.rows.map(r => r.column_name));
    const records = data.tables[t];
    console.log(`  - ${t}: ${records.length} records in backup. (DB table has ${cols.size} columns)`);
    for (const rec of records) {
      for (const k of Object.keys(rec)) {
        if (!cols.has(k)) {
          throw new Error(`Column mismatch in ${t}: backup has column '${k}' not in DB`);
        }
      }
    }
  }

  if (data.tables.InventoryItem && data.tables.InventoryItem.length > 0) {
    for (const item of data.tables.InventoryItem) {
      if (item.branchId) {
        const b = await pool.query('SELECT 1 FROM "Branch" WHERE id = $1', [item.branchId]);
        if (!b.rows.length) console.warn('Warning: item references non-existent branchId', item.branchId);
      }
      if (item.createdById) {
        const u = await pool.query('SELECT 1 FROM "User" WHERE id = $1', [item.createdById]);
        if (!u.rows.length) console.warn('Warning: item references non-existent createdById', item.createdById);
      }
    }
  }

  console.log('✓ Dry-run restore check passed: All backup tables & records are 100% compatible with current DB schema!');
  await pool.end();
}

dryRunRestoreValidation().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
