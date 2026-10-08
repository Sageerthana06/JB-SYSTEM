require('dotenv').config();
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'jb-super-secret-jwt-key-production-2026';

async function testRBAC() {
  console.log('--- Testing Customer RBAC by Role ---');

  // Generate tokens for testing
  const ceoToken = jwt.sign({ id: 1, role: 'SUPER_ADMIN', email: 'ceo@jbgroup.com' }, JWT_SECRET, { expiresIn: '1h' });
  const managerToken = jwt.sign({ id: 3, role: 'MANAGER', email: 'manager@jbgroup.com' }, JWT_SECRET, { expiresIn: '1h' });
  const staffToken = jwt.sign({ id: 4, role: 'STAFF', email: 'staff@jbgroup.com' }, JWT_SECRET, { expiresIn: '1h' });
  const tailorToken = jwt.sign({ id: 5, role: 'TAILOR', email: 'subangini@gmail.com' }, JWT_SECRET, { expiresIn: '1h' });

  // 1. First get a valid customer ID and order ID using CEO token
  const ordersRes = await fetch('http://localhost:5000/api/orders', {
    headers: { 'Authorization': `Bearer ${ceoToken}` }
  });
  const ordersData = await ordersRes.json();
  if (!ordersData.success || !ordersData.orders.length) {
    console.error('No orders found to test with!');
    return;
  }
  const testOrder = ordersData.orders[0];
  const customerId = testOrder.customerId || (testOrder.customer && testOrder.customer.id);
  console.log(`Using Order #${testOrder.orderNumber || testOrder.id} and Customer ID #${customerId}`);

  // Test 1: CEO & Manager access Customer Profile
  console.log('\n[1] CEO & Manager Access Customer Profile:');
  const ceoCustRes = await fetch(`http://localhost:5000/api/customers/${customerId}`, {
    headers: { 'Authorization': `Bearer ${ceoToken}` }
  });
  console.log(`CEO GET /api/customers/${customerId}: Status ${ceoCustRes.status}`);
  const ceoCustData = await ceoCustRes.json();
  console.log(`  Customer Name: ${ceoCustData.customer?.name}`);
  console.log(`  Primary Phone: ${ceoCustData.customer?.primaryPhone ? 'Visible (LKR/Phone present)' : 'Hidden'}`);

  const mgrCustRes = await fetch(`http://localhost:5000/api/customers/${customerId}`, {
    headers: { 'Authorization': `Bearer ${managerToken}` }
  });
  console.log(`Manager GET /api/customers/${customerId}: Status ${mgrCustRes.status}`);

  // Test 2: Staff & Tailor access Customer Profile (MUST be 403 Forbidden)
  console.log('\n[2] Staff & Tailor Access Customer Profile:');
  const staffCustRes = await fetch(`http://localhost:5000/api/customers/${customerId}`, {
    headers: { 'Authorization': `Bearer ${staffToken}` }
  });
  console.log(`Staff GET /api/customers/${customerId}: Status ${staffCustRes.status} (Expected: 403 Forbidden)`);
  const staffCustData = await staffCustRes.json();
  console.log(`  Staff message: "${staffCustData.message}"`);

  const tailorCustRes = await fetch(`http://localhost:5000/api/customers/${customerId}`, {
    headers: { 'Authorization': `Bearer ${tailorToken}` }
  });
  console.log(`Tailor GET /api/customers/${customerId}: Status ${tailorCustRes.status} (Expected: 403 Forbidden)`);

  // Test 3: Staff & Tailor access Customer Measurements (MUST be 403 Forbidden)
  console.log('\n[3] Staff & Tailor Access Customer Measurements API:');
  const staffMeasRes = await fetch(`http://localhost:5000/api/customers/${customerId}/measurements`, {
    headers: { 'Authorization': `Bearer ${staffToken}` }
  });
  console.log(`Staff GET /api/customers/${customerId}/measurements: Status ${staffMeasRes.status} (Expected: 403 Forbidden)`);

  // Test 4: Staff & Tailor GET /api/orders & GET /api/orders/:id Sanitization
  console.log('\n[4] Staff & Tailor Order Details Access Sanitization:');
  const staffOrdersRes = await fetch(`http://localhost:5000/api/orders/${testOrder.id}`, {
    headers: { 'Authorization': `Bearer ${staffToken}` }
  });
  const staffOrderData = await staffOrdersRes.json();
  const staffOrder = staffOrderData.order || staffOrderData;
  console.log('Staff Order view:');
  console.log('  Customer Keys:', Object.keys(staffOrder.customer || {}));
  console.log('  Customer Name:', staffOrder.customer?.name);
  console.log('  Customer Phone:', staffOrder.customer?.primaryPhone ?? 'EXCLUDED (Safe)');
  console.log('  Customer Address:', staffOrder.customer?.address ?? 'EXCLUDED (Safe)');
  console.log('  Total Amount:', staffOrder.totalAmount ?? 'EXCLUDED (Safe)');
  console.log('  Payments array:', staffOrder.payments ?? 'EXCLUDED (Safe)');
  console.log('  Garment Measurements (Stitching):', staffOrder.garmentDetails?.measurements ? 'PRESENT (Allowed for stitching)' : 'None');
  console.log('  Fabric Details:', staffOrder.garmentDetails?.fabricType ? 'PRESENT' : 'None');
  console.log('  Special Instructions:', staffOrder.garmentDetails?.specialDesignInstructions ? 'PRESENT' : 'None');

  const ceoOrderRes = await fetch(`http://localhost:5000/api/orders/${testOrder.id}`, {
    headers: { 'Authorization': `Bearer ${ceoToken}` }
  });
  const ceoOrderData = await ceoOrderRes.json();
  const ceoOrder = ceoOrderData.order || ceoOrderData;
  console.log('\nCEO Order view:');
  console.log('  Customer Phone:', ceoOrder.customer?.primaryPhone ? 'PRESENT' : 'Not added');
  console.log('  Total Amount:', ceoOrder.totalAmount !== undefined ? `LKR ${ceoOrder.totalAmount}` : 'None');
  console.log('  Garment Measurements:', ceoOrder.garmentDetails?.measurements ? 'PRESENT' : 'None');

  console.log('\n--- RBAC Verification Complete ---');
}

testRBAC().catch(console.error);
