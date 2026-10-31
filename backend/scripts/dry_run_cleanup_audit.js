/**
 * JB SYSTEM — SAFE DATABASE CLEANUP AUDIT & DRY-RUN SCRIPT
 *
 * STRICT SAFETY RULES:
 * - 100% READ-ONLY: Executes only SELECT / COUNT queries.
 * - NEVER executes DELETE, TRUNCATE, DROP, ALTER, UPDATE, or INSERT.
 * - NEVER prints or exposes database URLs, passwords, or credentials.
 * - Works on whichever database is targeted by the DATABASE_URL environment variable.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

// Safe connection initialization
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[FATAL] DATABASE_URL environment variable is not defined.');
  process.exit(1);
}

// Mask connection info for secure reporting
function getMaskedHost(urlStr) {
  try {
    const url = new URL(urlStr);
    const host = url.host;
    const db = url.pathname.replace(/^\//, '');
    return { host, database: db };
  } catch (e) {
    return { host: 'unknown-host', database: 'unknown-db' };
  }
}

const targetInfo = getMaskedHost(connectionString);

const pool = new Pool({
  connectionString,
  max: 2,
  connectionTimeoutMillis: 10000
});

// All known tables in JB SYSTEM
const ALL_TABLES = [
  'Branch',
  'User',
  'Employee',
  'Customer',
  'CustomerMeasurement',
  'CustomerOtp',
  'Order',
  'GarmentDetails',
  'Payment',
  'ProductionHistory',
  'OrderTask',
  'TailorSalaryPayment',
  'CustomerFabric',
  'CustomerFabricMovement',
  'Supplier',
  'InventoryItem',
  'OrderMaterialRequest',
  'PurchaseOrder',
  'PurchaseOrderItem',
  'GoodsReceipt',
  'StockMovement',
  'InventoryAuditLog',
  'AuditLog',
  'Attendance',
  'PasswordResetToken'
];

async function runDryRunAudit() {
  console.log('================================================================');
  console.log(' JB SYSTEM — READ-ONLY SAFE CLEANUP DRY-RUN AUDIT');
  console.log(` Target Host:     ${targetInfo.host}`);
  console.log(` Target Database: ${targetInfo.database}`);
  console.log(' Mode:            STRICTLY READ-ONLY (No writes permitted)');
  console.log('================================================================\n');

  const client = await pool.connect();

  try {
    // 1. Verify existence of tables and fetch record counts
    console.log('--- 1. TABLE INVENTORY & CURRENT RECORD COUNTS ---');
    const tableCounts = {};

    for (const tableName of ALL_TABLES) {
      try {
        const checkRes = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [tableName]);

        const exists = checkRes.rows[0].exists;
        if (exists) {
          const countRes = await client.query(`SELECT COUNT(*) AS total FROM "${tableName}";`);
          const count = parseInt(countRes.rows[0].total, 10);
          tableCounts[tableName] = { exists: true, count };
          console.log(`  • ${tableName.padEnd(25)}: ${String(count).padStart(6)} records`);
        } else {
          tableCounts[tableName] = { exists: false, count: 0 };
          console.log(`  • ${tableName.padEnd(25)}: [TABLE NOT PRESENT IN THIS DB]`);
        }
      } catch (err) {
        tableCounts[tableName] = { exists: false, error: err.message };
        console.log(`  • ${tableName.padEnd(25)}: Error checking (${err.message})`);
      }
    }

    // 2. Identify TAILOR user accounts
    console.log('\n--- 2. TAILOR USER ACCOUNTS (PRESERVE TARGETS) ---');
    let tailorUsers = [];
    try {
      const tailorRes = await client.query(`
        SELECT u.id, u.name, u.email, u.role, u."branchId", b.name AS "branchName", u."isActive", u."createdAt"
        FROM "User" u
        LEFT JOIN "Branch" b ON u."branchId" = b.id
        WHERE u.role = 'TAILOR'
        ORDER BY u.id ASC;
      `);
      tailorUsers = tailorRes.rows;
      console.log(` Found ${tailorUsers.length} TAILOR user(s):`);
      tailorUsers.forEach(t => {
        console.log(`   - [ID: ${String(t.id).padStart(3)}] ${t.name.padEnd(20)} | ${t.email.padEnd(28)} | Branch: ${t.branchName || 'Unassigned'} | Active: ${t.isActive}`);
      });
    } catch (e) {
      console.error(' Error querying tailors:', e.message);
    }

    // 3. Identify Management / Other User Accounts
    console.log('\n--- 3. NON-TAILOR USER ACCOUNTS (FOR OWNER REVIEW) ---');
    try {
      const nonTailorRes = await client.query(`
        SELECT u.id, u.name, u.email, u.role, u."branchId", b.name AS "branchName", u."isActive"
        FROM "User" u
        LEFT JOIN "Branch" b ON u."branchId" = b.id
        WHERE u.role != 'TAILOR'
        ORDER BY u.id ASC;
      `);
      console.log(` Found ${nonTailorRes.rows.length} Non-Tailor user(s):`);
      nonTailorRes.rows.forEach(u => {
        console.log(`   - [ID: ${String(u.id).padStart(3)}] [${u.role.padEnd(11)}] ${u.name.padEnd(22)} | ${u.email}`);
      });
    } catch (e) {
      console.error(' Error querying non-tailors:', e.message);
    }

    // 4. Check Dependent Records Linked to Tailors
    console.log('\n--- 4. DEPENDENT RECORDS LINKED TO TAILORS ---');
    if (tailorUsers.length > 0) {
      const tailorIds = tailorUsers.map(t => t.id);

      // Orders assigned to tailors
      const ordRes = await client.query(`
        SELECT COUNT(*) AS c FROM "Order" WHERE "assignedTailorId" = ANY($1::int[]);
      `, [tailorIds]);
      console.log(`  • Orders currently assigned to Tailors:               ${ordRes.rows[0].c}`);

      // Order Tasks assigned to tailors
      if (tableCounts.OrderTask?.exists) {
        const taskRes = await client.query(`
          SELECT COUNT(*) AS c FROM "OrderTask" WHERE "assignedTailorId" = ANY($1::int[]);
        `, [tailorIds]);
        console.log(`  • Tasks currently assigned to Tailors:                ${taskRes.rows[0].c}`);
      }

      // Material requests by tailors
      if (tableCounts.OrderMaterialRequest?.exists) {
        const mrRes = await client.query(`
          SELECT COUNT(*) AS c FROM "OrderMaterialRequest" WHERE "tailorId" = ANY($1::int[]);
        `, [tailorIds]);
        console.log(`  • Material Requests linked to Tailors:                ${mrRes.rows[0].c}`);
      }

      // Tailor salary payments
      if (tableCounts.TailorSalaryPayment?.exists) {
        const salRes = await client.query(`
          SELECT COUNT(*) AS c FROM "TailorSalaryPayment" WHERE "tailorId" = ANY($1::int[]);
        `, [tailorIds]);
        console.log(`  • Salary Payment records linked to Tailors:           ${salRes.rows[0].c}`);
      }

      // Attendance records for tailors
      if (tableCounts.Attendance?.exists) {
        const attRes = await client.query(`
          SELECT COUNT(*) AS c FROM "Attendance" WHERE "userId" = ANY($1::int[]);
        `, [tailorIds]);
        console.log(`  • Attendance records for Tailors:                     ${attRes.rows[0].c}`);
      }
    }

    // 5. Projected Impact Summary
    console.log('\n================================================================');
    console.log(' PROJECTED CLEANUP SUMMARY (SIMULATION)');
    console.log('================================================================');

    let totalRecordsToDelete = 0;
    const transactionalTables = [
      'TailorSalaryPayment',
      'CustomerFabricMovement',
      'CustomerFabric',
      'OrderMaterialRequest',
      'StockMovement',
      'GoodsReceipt',
      'PurchaseOrderItem',
      'PurchaseOrder',
      'InventoryItem',
      'Supplier',
      'OrderTask',
      'ProductionHistory',
      'Payment',
      'GarmentDetails',
      'Order',
      'CustomerMeasurement',
      'Customer',
      'CustomerOtp',
      'Attendance',
      'PasswordResetToken'
    ];

    transactionalTables.forEach(t => {
      const c = tableCounts[t]?.count || 0;
      totalRecordsToDelete += c;
    });

    console.log(`  • Core Infrastructure to PRESERVE: Branch (${tableCounts.Branch?.count || 0} branches)`);
    console.log(`  • Tailor Login Accounts to PRESERVE: ${tailorUsers.length} accounts`);
    console.log(`  • Estimated Transactional Business Records to PURGE: ${totalRecordsToDelete}`);
    console.log('================================================================');
    console.log(' DRY RUN COMPLETED — ZERO DATABASE WRITES OCCURRED.');
    console.log('================================================================\n');

  } finally {
    client.release();
    await pool.end();
  }
}

runDryRunAudit().catch(err => {
  console.error('[AUDIT ERROR]', err.message);
  process.exit(1);
});

