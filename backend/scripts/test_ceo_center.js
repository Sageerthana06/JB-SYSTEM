require('dotenv').config();
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id: 1, email: 'ceo@jbgroup.com', name: 'Jeyatheepan Joseph (CEO)', role: 'SUPER_ADMIN' },
  process.env.JWT_SECRET || 'bella_design_jwt_secret_change_this_2026'
);

async function run() {
  try {
    const res = await fetch('http://localhost:5000/api/attendance/ceo-center', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log('--- CEO ATTENDANCE CENTER RESPONSE ---');
    console.log('Success:', data.success);
    console.log('Summary:', data.summary);
    console.log('Total Records:', data.records?.length);
    console.table(data.records?.map(r => ({
      ID: r.id,
      Name: r.name,
      Role: r.roleLabel,
      Email: r.email,
      Status: r.status,
      CheckIn: r.checkIn,
      CheckOut: r.checkOut
    })));
  } catch (err) {
    console.error(err);
  }
}

run();
