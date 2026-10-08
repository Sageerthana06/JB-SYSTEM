const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verifyFlow() {
  console.log('=== 1. VERIFYING CEO & MANAGER ACCESS TO PAYMENT SLIPS ===');

  // Login as CEO
  const ceoLogin = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ceo@jbgroup.com', password: '@Bella202CEO6' })
  });
  const ceoData = await ceoLogin.json();
  const ceoToken = ceoData.data?.token || ceoData.token;
  console.log('✓ CEO login status:', ceoLogin.status, 'User:', ceoData.data?.user?.name || ceoData.user?.name);

  // Login as Manager
  const mgrLogin = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@jbgroup.com', password: 'Manager@Bella2026' })
  });
  const mgrData = await mgrLogin.json();
  const mgrToken = mgrData.data?.token || mgrData.token;
  console.log('✓ Manager login status:', mgrLogin.status, 'User:', mgrData.data?.user?.name || mgrData.user?.name);

  // CEO retrieves orders
  const ceoOrdersRes = await fetch('http://localhost:5000/api/orders', {
    headers: { 'Authorization': `Bearer ${ceoToken}` }
  });
  const ceoOrders = await ceoOrdersRes.json();
  const ceoOrd103 = ceoOrders.orders?.find(o => o.id === 103);
  console.log('✓ CEO retrieved Order 103? ->', !!ceoOrd103);
  console.log('  CEO sees payments on Order 103? ->', !!ceoOrd103?.payments, `Count: ${ceoOrd103?.payments?.length}`);
  console.log('  CEO sees slipImage? ->', ceoOrd103?.payments?.[0]?.slipImage);

  // Manager retrieves orders
  const mgrOrdersRes = await fetch('http://localhost:5000/api/orders', {
    headers: { 'Authorization': `Bearer ${mgrToken}` }
  });
  const mgrOrders = await mgrOrdersRes.json();
  const mgrOrd103 = mgrOrders.orders?.find(o => o.id === 103);
  console.log('✓ Manager retrieved Order 103? ->', !!mgrOrd103);
  console.log('  Manager sees payments on Order 103? ->', !!mgrOrd103?.payments, `Count: ${mgrOrd103?.payments?.length}`);
  console.log('  Manager sees slipImage? ->', mgrOrd103?.payments?.[0]?.slipImage);

  // Test Verification endpoint as Manager
  console.log('\n=== 2. TESTING PAYMENT SLIP VERIFICATION ENDPOINT ===');
  const verifyRes = await fetch('http://localhost:5000/api/orders/103/payments/55/verify', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${mgrToken}`
    }
  });
  const verifyJson = await verifyRes.json();
  console.log('✓ Verification API Response:', verifyRes.status, verifyJson.message);
  console.log('  Updated Order Total:', verifyJson.order?.totalAmount);
  console.log('  Updated Advance Paid:', verifyJson.order?.advancePayment);
  console.log('  Updated Balance Due:', verifyJson.order?.balanceAmount);
  console.log('  Updated Payment Status:', verifyJson.order?.paymentStatus);

  // Check audit log in ProductionHistory
  const auditRes = await pool.query(`SELECT id, "orderId", stage, notes, "createdAt" FROM "ProductionHistory" WHERE "orderId" = 103 ORDER BY id DESC LIMIT 1`);
  console.log('✓ Production History Audit Log:');
  console.table(auditRes.rows);

  // Reset Payment 55 back to PENDING_VERIFICATION so User / CEO / Manager can test directly in the browser UI
  console.log('\n=== 3. RESETTING TO PENDING_VERIFICATION FOR LIVE DEMO ===');
  await pool.query(`UPDATE "Payment" SET status = 'PENDING_VERIFICATION', "verifiedBy" = null, "verifiedAt" = null WHERE id = 55`);
  await pool.query(`UPDATE "Order" SET "advancePayment" = 0, "balanceAmount" = 1395, "paymentStatus" = 'Unpaid' WHERE id = 103`);
  console.log('✓ Payment 55 and Order 103 reset to PENDING_VERIFICATION successfully!');

  await pool.end();
}

verifyFlow().catch(err => {
  console.error('Test error:', err);
  pool.end();
});
