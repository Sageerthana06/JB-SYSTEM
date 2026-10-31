const { Client } = require("pg");

(async () => {
  const url = process.env.CLEANUP_TEST_DATABASE_URL;

  if (!url) {
    console.error("CLEANUP_TEST_DATABASE_URL is not set.");
    process.exitCode = 1;
    return;
  }

  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();

    const r = await client.query(`
      SELECT current_database() AS database,
             current_user AS db_user,
             COUNT(*)::int AS public_tables
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      GROUP BY current_database(), current_user
    `);

    console.log("Test branch connection: SUCCESS");
    console.log("Database:", r.rows[0]?.database);
    console.log("Public tables:", r.rows[0]?.public_tables);
  } catch (e) {
    console.error("Test connection failed:", e.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
