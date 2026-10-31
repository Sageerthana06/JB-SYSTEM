require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    console.log('Cleaning up dummy users and attendance...');

    // Deactivate all dummy accounts, keeping ONLY CEO, Manager, Pratheep (staff), and 3 Tailors (Pushpamalar, Uruththiradevi, Susitha)
    const allowedEmails = [
      'ceo@jbgroup.com',
      'manager@jbgroup.com',
      'staff@jbgroup.com',
      'pushpamalar@jbgroup.com',
      'uruththiradevi@jbgroup.com',
      'susitha@jbgroup.com'
    ];

    const deactRes = await pool.query(`
      UPDATE "User" 
      SET "isActive" = false 
      WHERE email NOT IN ($1, $2, $3, $4, $5, $6);
    `, allowedEmails);
    console.log(`Deactivated ${deactRes.rowCount} dummy/test accounts.`);

    // Delete attendance rows for any dummy users (e.g. tailorId 8, 5, etc.)
    const delAtt = await pool.query(`
      DELETE FROM "Attendance" 
      WHERE "userId" NOT IN (
        SELECT id FROM "User" WHERE email IN ($1, $2, $3, $4, $5)
      ) OR "userId" IS NULL;
    `, [
      'manager@jbgroup.com',
      'staff@jbgroup.com',
      'pushpamalar@jbgroup.com',
      'uruththiradevi@jbgroup.com',
      'susitha@jbgroup.com'
    ]);
    console.log(`Deleted ${delAtt.rowCount} dummy attendance records.`);

    // List remaining active users
    const users = await pool.query(`
      SELECT id, name, role, email, "isActive" 
      FROM "User" 
      WHERE "isActive" = true 
      ORDER BY id ASC;
    `);
    console.log('\n--- ACTIVE SYSTEM LOGINS ---');
    console.table(users.rows);

    // List remaining attendance records
    const atts = await pool.query(`
      SELECT a.id, a."userId", u.name, u.role, a.date, a.status, a."checkIn", a."checkOut" 
      FROM "Attendance" a 
      JOIN "User" u ON a."userId" = u.id 
      ORDER BY a.id ASC;
    `);
    console.log('\n--- CURRENT ATTENDANCE RECORDS ---');
    console.table(atts.rows);

    console.log('\nCleanup completed successfully.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await pool.end();
  }
}

run();
