const { pool } = require('../backend/src/prisma');
const fs = require('fs');
const path = require('path');

async function createProductionBackup() {
  console.log('=== CREATING FRESH PRODUCTION DATABASE BACKUP ===\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '../backend/backups_salary_deployment', timestamp);
  fs.mkdirSync(backupDir, { recursive: true });

  // Get list of all public tables
  const tablesRes = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const tables = tablesRes.rows.map(r => r.table_name);
  console.log(`Found ${tables.length} tables in PostgreSQL production database.`);

  const manifest = {
    timestamp: new Date().toISOString(),
    sourceDatabase: 'ep-soft-sea-a5lus30l-pooler.us-east-2.aws.neon.tech/neondb',
    totalTables: tables.length,
    tables: {}
  };

  for (const table of tables) {
    const res = await pool.query(`SELECT * FROM "${table}"`);
    const filePath = path.join(backupDir, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(res.rows, null, 2));
    manifest.tables[table] = res.rows.length;
    console.log(`  Backed up ${table.padEnd(30)}: ${res.rows.length} rows`);
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\n✓ Production backup completed successfully at: ${backupDir}`);
  await pool.end();
}

createProductionBackup().catch(e => {
  console.error('Backup failed:', e);
  process.exit(1);
});

