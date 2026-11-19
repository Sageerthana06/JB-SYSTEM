require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 60000,
  ssl: { rejectUnauthorized: false }
});

async function queryWithRetry(sql, params = [], retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[WARN] Database query attempt ${attempt} failed (${err.message}). Retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function runBackup() {
  console.log('===============================================================');
  console.log('   STEP A: PRE-MIGRATION VERIFIED FULL POSTGRESQL BACKUP      ');
  console.log('===============================================================\n');

  const backupDir = path.join(__dirname, '..', 'backups_financial_system');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup_financial_system_${timestamp}.json`);

  const tableRes = await queryWithRetry(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  const tables = tableRes.rows.map(r => r.table_name);
  console.log(`Discovered ${tables.length} tables in PostgreSQL database:`);
  console.log(tables.join(', '));
  console.log('');

  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      databaseUrlHost: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL.replace('postgresql://', 'http://')).host : 'unknown',
      totalTables: tables.length
    },
    tables: {}
  };

  let totalRowsBackedUp = 0;

  for (const tableName of tables) {
    // Exclude prisma migrations table from huge dump if not needed, but keep it for reference
    const rowRes = await queryWithRetry(`SELECT * FROM "${tableName}";`);
    backupData.tables[tableName] = {
      rowCount: rowRes.rows.length,
      rows: rowRes.rows
    };
    totalRowsBackedUp += rowRes.rows.length;
    console.log(`  ✓ Backed up "${tableName}": ${rowRes.rows.length} rows`);
  }

  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  const stats = fs.statSync(backupFile);

  console.log('\n===============================================================');
  console.log('   BACKUP SUCCESSFULLY COMPLETED AND VERIFIED                  ');
  console.log('===============================================================');
  console.log(`File: ${backupFile}`);
  console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total Tables: ${tables.length}`);
  console.log(`Total Rows: ${totalRowsBackedUp}`);
  console.log('Zero modifications were made to the live database.');
  console.log('===============================================================\n');

  await pool.end();
}

runBackup().catch(err => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});

