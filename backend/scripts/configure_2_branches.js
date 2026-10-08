require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function configureBranches() {
  console.log('--- Configuring Branches in DB ---');

  // Update Branch 1 to 'JB Group (Main)'
  await pool.query(`
    UPDATE "Branch"
    SET name = 'JB Group (Main)',
        address = 'No. 128 Galle Road, Colombo 03, Sri Lanka',
        phone = '+94 11 234 5678',
        status = 'ACTIVE',
        "updatedAt" = NOW()
    WHERE id = 1;
  `);

  // Ensure Branch 2 is 'Bella Design'
  await pool.query(`
    UPDATE "Branch"
    SET name = 'Bella Design',
        address = 'Boutique & Studio, Colombo 04, Sri Lanka',
        phone = '+94 11 987 6543',
        status = 'ACTIVE',
        "updatedAt" = NOW()
    WHERE id = 2;
  `);

  // Distribute orders
  await pool.query('UPDATE "Order" SET "branchId" = 1 WHERE id % 2 = 1;');
  await pool.query('UPDATE "Order" SET "branchId" = 2 WHERE id % 2 = 0;');

  const finalBranches = await pool.query('SELECT * FROM "Branch" ORDER BY id ASC;');
  console.log('--- Final Branches in DB ---');
  console.table(finalBranches.rows);

  await pool.end();
}

configureBranches().catch(console.error);
