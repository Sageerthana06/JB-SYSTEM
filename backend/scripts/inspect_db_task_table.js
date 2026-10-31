const { prisma, pool } = require('../src/prisma');

async function check() {
  try {
    const dbInfo = await pool.query('SELECT current_database(), current_user, inet_server_addr()');
    console.log('DB Info:', dbInfo.rows[0]);

    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('Tables in public schema:', tables.rows.map(r => r.table_name));

    const taskCols = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'OrderTask' ORDER BY ordinal_position");
    console.log('OrderTask columns count:', taskCols.rows.length);
    console.log('OrderTask columns:', taskCols.rows);

    const taskCount = await pool.query('SELECT count(*) FROM "OrderTask"').catch(e => ({ rows: [{ count: 'ERROR: ' + e.message }] }));
    console.log('OrderTask row count:', taskCount.rows[0].count);

    if (taskCols.rows.length > 0) {
      const sampleTasks = await pool.query('SELECT * FROM "OrderTask" LIMIT 5');
      console.log('Sample OrderTasks:', sampleTasks.rows);
    }
  } catch (err) {
    console.error('Check error:', err);
  } finally {
    process.exit(0);
  }
}

check();
