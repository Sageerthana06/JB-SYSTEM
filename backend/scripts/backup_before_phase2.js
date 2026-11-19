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

  const backupDir = path.join(__dirname, '..', 'backups_financial_phase2');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup_before_phase2_${timestamp}.json`);

  // 1. Get all public tables
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
    createdAt: new Date().toISOString(),
    databaseUrlMasked: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@') : '',
    tables: {},
    tableCounts: {}
  };

  for (const table of tables) {
    const countRes = await queryWithRetry(`SELECT COUNT(*)::int AS count FROM "${table}"`);
    const count = countRes.rows[0].count;
    backupData.tableCounts[table] = count;

    // Fetch data safely
    const dataRes = await queryWithRetry(`SELECT * FROM "${table}"`);
    backupData.tables[table] = dataRes.rows;
    console.log(`  [BACKUP] Table "${table}": ${count} records exported`);
  }

  // Write to disk
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  const fileSizeMb = (fs.statSync(backupFile).size / (1024 * 1024)).toFixed(3);
  console.log(`\nBackup written to: ${backupFile} (${fileSizeMb} MB)`);

  // Verify backup integrity by reading back and matching counts
  console.log('\n--- VERIFYING BACKUP INTEGRITY ---');
  const readBack = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  let verified = true;
  for (const [table, expectedCount] of Object.entries(backupData.tableCounts)) {
    const actualCount = readBack.tables[table] ? readBack.tables[table].length : -1;
    if (actualCount !== expectedCount) {
      console.error(`  [FAIL] Integrity mismatch for table "${table}": expected ${expectedCount}, got ${actualCount}`);
      verified = false;
    }
  }

  if (verified) {
    console.log('  [PASS] All table records match backup file exactly.');
    console.log('  [PASS] Backup verified successfully.');
    // Also save a baseline table counts file for comparison after migration
    fs.writeFileSync(path.join(backupDir, 'baseline_table_counts.json'), JSON.stringify(backupData.tableCounts, null, 2), 'utf8');
    await pool.end();
    process.exit(0);
  } else {
    console.error('  [FAIL] Backup integrity check failed.');
    await pool.end();
    process.exit(1);
  }
}

runBackup().catch(err => {
  console.error('Backup error:', err);
  process.exit(1);
});
