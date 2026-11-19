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
  console.log('   PRE-EXPENSE-RESET FULL POSTGRESQL DATABASE BACKUP           ');
  console.log('===============================================================\n');

  const backupDir = path.join(__dirname, '..', 'backups_expense_reset');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup_before_expense_reset_${timestamp}.json`);

  const tableRes = await queryWithRetry(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  const tables = tableRes.rows.map(r => r.table_name);
  console.log(`Discovered ${tables.length} tables in PostgreSQL database.`);

  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      databaseUrlHost: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL.replace('postgresql://', 'http://')).host : 'unknown',
      totalTables: tables.length
    },
    tables: {}
  };

  let totalRowsBackedUp = 0;

  for (const table of tables) {
    const dataRes = await queryWithRetry(`SELECT * FROM "${table}";`);
    backupData.tables[table] = dataRes.rows;
    totalRowsBackedUp += dataRes.rows.length;
    console.log(`  ✓ Table "${table}": ${dataRes.rows.length} rows`);
  }

  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');

  const stats = fs.statSync(backupFile);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('\n===============================================================');
  console.log('   FULL DATABASE BACKUP COMPLETED SUCCESSFULLY                 ');
  console.log('===============================================================');
  console.log(`Backup Location: ${backupFile}`);
  console.log(`File Size:       ${sizeMb} MB`);
  console.log(`Total Tables:    ${tables.length}`);
  console.log(`Total Records:   ${totalRowsBackedUp}`);
  console.log('===============================================================\n');

  return { backupFile, totalRowsBackedUp };
}

runBackup()
  .catch(err => {
    console.error('Backup failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });

