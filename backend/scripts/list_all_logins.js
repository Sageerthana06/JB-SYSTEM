require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const KNOWN_PASSWORDS = [
  '@Bella202CEO6',
  'Admin@Bella2026',
  'Manager@Bella2026',
  'Staff@Bella2026',
  'Tailor@Bella2026',
  '123456',
  'Cutting@Bella2026',
  'Embroidery@Bella2026',
  'Pushpa@Tailor2026',
  'Uruthi@Tailor2026',
  'Susitha@Tailor2026',
  'Sasi@Tailor2026'
];

async function verifyAllUsers() {
  const usersRes = await pool.query(`
    SELECT u.id, u.name, u.email, u.password, u.role, b.name as branch_name, u."isActive" 
    FROM "User" u 
    LEFT JOIN "Branch" b ON u."branchId" = b.id 
    ORDER BY u.id ASC;
  `);

  const results = [];

  for (const u of usersRes.rows) {
    let matchedPass = 'UNKNOWN';
    for (const p of KNOWN_PASSWORDS) {
      if (await bcrypt.compare(p, u.password)) {
        matchedPass = p;
        break;
      }
    }
    results.push({
      ID: u.id,
      Name: u.name,
      Role: u.role,
      Email: u.email,
      Password: matchedPass,
      Branch: u.branch_name || 'N/A',
      Status: u.isActive ? 'Active' : 'Inactive'
    });
  }

  console.table(results);
  await pool.end();
}

verifyAllUsers().catch(console.error);
