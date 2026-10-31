require('dotenv').config();
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id: 1, email: 'ceo@jbgroup.com', name: 'Jeyatheepan Joseph (CEO)', role: 'SUPER_ADMIN' },
  process.env.JWT_SECRET || 'bella_design_jwt_secret_change_this_2026'
);

async function run() {
  try {
    console.log('Testing advancing order 107 (JB-20261009-0002) without price approval error...');

    // 1. Advance to CUTTING
    console.log('\n--- 1. Advancing to CUTTING ---');
    const cutRes = await fetch('http://localhost:5000/api/orders/107/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'CUTTING' })
    });
    const cutData = await cutRes.json();
    console.log('Advance to CUTTING status:', cutRes.status);
    console.log('Response:', cutData.success ? `SUCCESS: ${cutData.message}` : `FAILED: ${cutData.message}`);

    // 2. Advance to STITCHING
    console.log('\n--- 2. Advancing to STITCHING ---');
    const stitchRes = await fetch('http://localhost:5000/api/orders/107/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'STITCHING' })
    });
    const stitchData = await stitchRes.json();
    console.log('Advance to STITCHING status:', stitchRes.status);
    console.log('Response:', stitchData.success ? `SUCCESS: ${stitchData.message}` : `FAILED: ${stitchData.message}`);

    // 3. Advance to READY (Tailor Finish / Ready)
    console.log('\n--- 3. Advancing to READY (Finished) ---');
    const readyRes = await fetch('http://localhost:5000/api/orders/107/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'READY' })
    });
    const readyData = await readyRes.json();
    console.log('Advance to READY status:', readyRes.status);
    console.log('Response:', readyData.success ? `SUCCESS: ${readyData.message}` : `FAILED: ${readyData.message}`);
    if (readyData.notification) {
      console.log('WhatsApp Notification generated:', readyData.notification);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
