const jwt = require('jsonwebtoken');
const fetch = global.fetch || require('node-fetch');

const JWT_SECRET = process.env.JWT_SECRET || 'jb_secret_key_2026';
const BASE_URL = 'http://localhost:5000/api/inventory';

async function testBothRequests() {
  const ceo = { id: 1, name: 'Jeyatheepan Joseph (CEO)', email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN' };
  const token = jwt.sign(ceo, JWT_SECRET, { expiresIn: '1h' });

  const res = await fetch(`${BASE_URL}/requests`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  const body = await res.json();
  console.log('=== API RESPONSE FOR /api/inventory/requests ===');
  console.log('Success:', body.success);
  console.log('Count:', body.data?.length);

  for (const r of body.data || []) {
    console.log('\n--- Item in API response:', r.requestNo, '---');
    console.log(JSON.stringify(r, null, 2));
  }
}

testBothRequests().catch(console.error);
