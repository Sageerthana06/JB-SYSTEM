require("dotenv").config();
const { Client } = require("pg");

(async () => {
  const client = new Client({
    connectionString: process.env.CLEANUP_TEST_DATABASE_URL,
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log("TEST BRANCH TABLES:", result.rows.length);
    result.rows.forEach(r => console.log(r.table_name));
  } catch (e) {
    console.log("ERROR:", e.message);
  } finally {
    await client.end().catch(() => {});
  }
})();
