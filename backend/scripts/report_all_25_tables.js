require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../src/prisma');

const ALL_25_TABLES = [
  'Attendance',
  'AuditLog',
  'Branch',
  'Customer',
  'CustomerFabric',
  'CustomerFabricMovement',
  'CustomerMeasurement',
  'CustomerOtp',
  'Employee',
  'GarmentDetails',
  'GoodsReceipt',
  'InventoryAuditLog',
  'InventoryItem',
  'Order',
  'OrderMaterialRequest',
  'OrderTask',
  'PasswordResetToken',
  'Payment',
  'ProductionHistory',
  'PurchaseOrder',
  'PurchaseOrderItem',
  'StockMovement',
  'Supplier',
  'TailorSalaryPayment',
  'User'
];

async function main() {
  console.log('===============================================================');
  console.log('   FULL COUNT REPORT FOR ALL 25 PRE-EXISTING TABLES           ');
  console.log('===============================================================\n');

  let totalRecords = 0;
  for (const t of ALL_25_TABLES) {
    const res = await pool.query(`SELECT COUNT(*)::int AS count FROM "${t}"`);
    const count = res.rows[0].count;
    totalRecords += count;
    console.log(`  Table "${t.padEnd(25, ' ')}": ${count} rows`);
  }

  console.log(`\nTotal verified records across all 25 tables: ${totalRecords}`);

  // Also check the 2 branches
  const branches = await pool.query('SELECT id, name, status FROM "Branch" ORDER BY id');
  console.log('\nActive Branches:');
  console.log(branches.rows);

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

