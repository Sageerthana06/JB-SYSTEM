const jwt = require('jsonwebtoken');
const fetch = global.fetch || require('node-fetch');

const JWT_SECRET = process.env.JWT_SECRET || 'jb_secret_key_2026';
const BASE_URL = 'http://localhost:5000/api/inventory';

async function testEndpoint(role, userObj, endpoint, method = 'GET', body = null) {
  const token = jwt.sign(userObj, JWT_SECRET, { expiresIn: '1h' });
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${endpoint}`, opts);
  const data = await res.json().catch(() => ({ status: res.status }));
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  const ceo = { id: 1, name: 'Jeyatheepan Joseph (CEO)', email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN' };
  const manager = { id: 3, name: 'Manager', email: 'manager@jbgroup.com', role: 'MANAGER' };

  console.log('====================================================');
  console.log('TESTING API ACCESS FOR CEO (SUPER_ADMIN) & MANAGER');
  console.log('====================================================');

  const endpoints = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Meta', path: '/meta' },
    { name: 'Items Catalogue', path: '/items' },
    { name: 'Material Requests', path: '/requests' },
    { name: 'Stock Movements', path: '/movements' },
    { name: 'Suppliers', path: '/suppliers' },
    { name: 'Purchase Orders', path: '/purchase-orders' }
  ];

  for (const ep of endpoints) {
    const ceoRes = await testEndpoint('CEO', ceo, ep.path);
    const mgrRes = await testEndpoint('MANAGER', manager, ep.path);

    console.log(`Endpoint [${ep.name}] (${ep.path}):`);
    console.log(`  - CEO (SUPER_ADMIN): status ${ceoRes.status} | success: ${ceoRes.data?.success}`);
    console.log(`  - Manager (MANAGER): status ${mgrRes.status} | success: ${mgrRes.data?.success}`);
    if (!ceoRes.ok || !mgrRes.ok) {
      console.error(`  FAIL on ${ep.path}: CEO:`, ceoRes.data, `MGR:`, mgrRes.data);
    }
  }

  console.log('\n--- Assessing Frontend Sidebar & Permissions ---');
  const { hasPermission } = require('../../src/utils/permissions.js');
  console.log('Frontend CEO has "inventory.view":', hasPermission('SUPER_ADMIN', 'inventory.view'));
  console.log('Frontend CEO has "inventory.manage":', hasPermission('SUPER_ADMIN', 'inventory.manage'));
  console.log('Frontend MANAGER has "inventory.view":', hasPermission('MANAGER', 'inventory.view'));
  console.log('Frontend MANAGER has "inventory.manage":', hasPermission('MANAGER', 'inventory.manage'));
  console.log('Frontend Manager (title case) has "inventory.view":', hasPermission('Manager', 'inventory.view'));
  console.log('Frontend Manager (title case) has "inventory.manage":', hasPermission('Manager', 'inventory.manage'));
}

run().catch(console.error);
