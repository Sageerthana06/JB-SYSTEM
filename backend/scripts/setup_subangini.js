require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function setupSubangini() {
  console.log('==============================================');
  console.log('UPDATING TAILOR ACCOUNT: SUBANGINI RAJAN');
  console.log('==============================================\n');

  try {
    // 1. Check existing user record
    const existing = await pool.query(
      'SELECT id, name, email, role, "isActive" FROM "User" WHERE role = \'TAILOR\' OR email = \'subangini@gmail.com\' OR email = \'tailor@jbgroup.com\' ORDER BY id ASC;'
    );

    console.log('Found existing tailor records:', existing.rows);

    const hashedPassword = await bcrypt.hash('123456', 10);

    let tailorId;

    if (existing.rows.length > 0) {
      // Reuse existing account (ID 5)
      tailorId = existing.rows[0].id;
      console.log(`Reusing existing account ID ${tailorId} (${existing.rows[0].name})...`);

      const updateResult = await pool.query(
        `UPDATE "User" 
         SET name = 'Subangini Rajan',
             email = 'subangini@gmail.com',
             password = $1,
             role = 'TAILOR',
             "isActive" = true
         WHERE id = $2
         RETURNING id, name, email, role, "isActive";`,
        [hashedPassword, tailorId]
      );

      console.log('Updated user record in PostgreSQL:', updateResult.rows[0]);
    } else {
      // Create new account if none existed
      console.log('Creating new tailor account...');
      const insertResult = await pool.query(
        `INSERT INTO "User" (name, email, password, role, "isActive", "branchId", "createdAt", "updatedAt")
         VALUES ('Subangini Rajan', 'subangini@gmail.com', $1, 'TAILOR', true, 1, NOW(), NOW())
         RETURNING id, name, email, role, "isActive";`,
        [hashedPassword]
      );
      tailorId = insertResult.rows[0].id;
      console.log('Created user record in PostgreSQL:', insertResult.rows[0]);
    }

    // 2. Ensure ORD-2026-0009 is assigned to Subangini Rajan and in 'Waiting Acceptance' state
    const orderCheck = await pool.query(
      `SELECT id, "orderNumber", status, "assignedTailorId", "tailorAccepted"
       FROM "Order"
       WHERE "orderNumber" = 'ORD-2026-0009';`
    );

    if (orderCheck.rows.length > 0) {
      const order = orderCheck.rows[0];
      console.log('Current ORD-2026-0009 state:', order);

      // Make sure assignedTailorId is tailorId, status is ORDER_CONFIRMED, tailorAccepted is false
      const updatedOrder = await pool.query(
        `UPDATE "Order"
         SET "assignedTailorId" = $1,
             status = 'ORDER_CONFIRMED',
             "tailorAccepted" = false
         WHERE "orderNumber" = 'ORD-2026-0009'
         RETURNING id, "orderNumber", status, "assignedTailorId", "tailorAccepted";`,
        [tailorId]
      );
      console.log('Confirmed ORD-2026-0009 assigned state:', updatedOrder.rows[0]);
    } else {
      console.warn('Warning: ORD-2026-0009 not found in database.');
    }

    console.log('\nSubangini Rajan tailor account setup completed successfully.');
  } catch (err) {
    console.error('Error setting up Subangini account:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupSubangini();
