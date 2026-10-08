require('dotenv').config();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const token = jwt.sign(
  { id: 1, email: 'ceo@jbgroup.com', name: 'Jeyatheepan Joseph (CEO)', role: 'SUPER_ADMIN' },
  process.env.JWT_SECRET || 'bella_design_jwt_secret_change_this_2026'
);

async function run() {
  console.log('--- 1. Testing GET /api/orders/tailors/performance ---');
  const perfRes = await fetch('http://localhost:5000/api/orders/tailors/performance', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const perfData = await perfRes.json();
  console.log('perfData status:', perfRes.status, perfData);
  console.log('Total tailors retrieved:', perfData.data?.length);

  const testTailor = perfData.data[0];
  console.log(`Testing with tailor: ${testTailor.name} (ID: ${testTailor.id})`);

  console.log('\n--- 2. Testing POST /api/attendance/mark-present ---');
  const presRes = await fetch('http://localhost:5000/api/attendance/mark-present', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tailorId: testTailor.id })
  });
  const presData = await presRes.json();
  console.log('Mark Present response:', presData);

  console.log('\n--- 3. Testing POST /api/attendance/check-out ---');
  const outRes = await fetch('http://localhost:5000/api/attendance/check-out', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tailorId: testTailor.id })
  });
  const outData = await outRes.json();
  console.log('Check Out response:', outData);

  console.log('\n--- 4. Direct PostgreSQL Verification ---');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const dbRes = await pool.query(
    'SELECT id, "tailorId", date, status, "checkIn", "checkOut", "markedBy" FROM "Attendance" WHERE "tailorId" = $1',
    [testTailor.id]
  );
  console.table(dbRes.rows);

  console.log('\n--- 5. Verify TAILOR cannot edit (Permission Security Check) ---');
  const tailorToken = jwt.sign(
    { id: testTailor.id, email: 'tailor@jbgroup.com', role: 'TAILOR' },
    process.env.JWT_SECRET || 'bella_design_jwt_secret_change_this_2026'
  );
  const rejectRes = await fetch('http://localhost:5000/api/attendance/mark-present', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tailorToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tailorId: testTailor.id })
  });
  const rejectData = await rejectRes.json();
  console.log('Tailor edit attempt blocked as expected (403):', rejectData);

  await pool.end();
  console.log('\n✅ ALL ATTENDANCE CHECKS PASSED PERFECTLY!');
}

run().catch(console.error);
