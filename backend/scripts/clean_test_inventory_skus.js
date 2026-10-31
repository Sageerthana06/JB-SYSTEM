const { pool } = require('../src/prisma');

async function clean() {
  const auditRes = await pool.query(`DELETE FROM "InventoryAuditLog" WHERE details::text LIKE '%TEST-%'`);
  const movRes = await pool.query(`DELETE FROM "StockMovement" WHERE "referenceNo" LIKE 'OPEN-TEST-%'`);
  const itemRes = await pool.query(`DELETE FROM "InventoryItem" WHERE sku LIKE 'TEST-%'`);
  console.log(`Cleaned: ${itemRes.rowCount} test inventory items, ${movRes.rowCount} test movements, ${auditRes.rowCount} test audit logs.`);
  await pool.end();
}

clean().catch(err => {
  console.error(err);
  process.exit(1);
});
