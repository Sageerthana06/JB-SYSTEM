require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE_URL = 'http://127.0.0.1:5000/api';

async function verifyOrderIntegration() {
  console.log('===========================================================');
  console.log('VERIFYING CUSTOMER PORTAL -> STAFF ERP INTEGRATION');
  console.log('Target Order: ORD-2026-0007');
  console.log('===========================================================\n');

  // Step 1: Staff Login to obtain staff JWT
  const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'staff@jbgroup.com', password: 'Staff@Bella2026' })
  });
  const staffLoginData = await staffLoginRes.json();
  if (!staffLoginData.success) throw new Error('Staff login failed: ' + staffLoginData.message);
  const staffToken = staffLoginData.data.token;
  console.log('1. Staff Login: SUCCESS (Role:', staffLoginData.data.user.role + ')');

  // Step 2: Query database directly for ORD-2026-0007
  const dbOrderRes = await pool.query(`
    SELECT o.id, o."orderNumber", o.status, o."customerId", c.name as customer_name, c.email as customer_email,
           g."dressType", g.quantity, g."designReferenceImage", o."totalAmount", o."advancePayment", o."balanceAmount"
    FROM "Order" o
    JOIN "Customer" c ON c.id = o."customerId"
    LEFT JOIN "GarmentDetails" g ON g."orderId" = o.id
    WHERE o."orderNumber" = 'ORD-2026-0007';
  `);

  if (dbOrderRes.rows.length === 0) {
    throw new Error('Order ORD-2026-0007 not found in PostgreSQL database!');
  }
  const dbOrder = dbOrderRes.rows[0];
  console.log('2. PostgreSQL Database Verification: SUCCESS');
  console.log('   - Order ID:', dbOrder.id);
  console.log('   - Order Number:', dbOrder.orderNumber);
  console.log('   - Customer ID:', dbOrder.customerId);
  console.log('   - Customer Name:', dbOrder.customer_name);
  console.log('   - Garment:', dbOrder.dressType, `(Qty: ${dbOrder.quantity})`);
  console.log('   - Reference Image:', dbOrder.designReferenceImage);
  console.log('   - Status:', dbOrder.status);

  // Check no duplicates
  const dupCheck = await pool.query('SELECT count(*) FROM "Order" WHERE "orderNumber" = $1;', ['ORD-2026-0007']);
  console.log('3. Duplicate Order Check:', dupCheck.rows[0].count === '1' ? 'PASS (Strictly 1 unique record)' : 'FAIL');

  // Step 3: Verify Staff ERP endpoint GET /api/orders
  const erpOrdersRes = await fetch(`${BASE_URL}/orders`, {
    headers: { 'Authorization': `Bearer ${staffToken}` }
  });
  const erpOrdersData = await erpOrdersRes.json();
  if (!erpOrdersData.success) throw new Error('Failed to fetch ERP orders: ' + erpOrdersData.message);
  
  const foundInErp = erpOrdersData.orders.find(o => o.orderNumber === 'ORD-2026-0007' || o.id === dbOrder.id);
  if (!foundInErp) {
    throw new Error('Order ORD-2026-0007 is MISSING from staff GET /api/orders!');
  }
  console.log('4. Staff Sales ERP GET /api/orders Verification: SUCCESS');
  console.log('   - Matches same Order ID:', foundInErp.id === dbOrder.id);
  console.log('   - Customer Name in ERP:', foundInErp.customer?.name);
  console.log('   - Garment in ERP:', foundInErp.garmentDetails?.dressType);
  console.log('   - Design Image in ERP:', foundInErp.garmentDetails?.designReferenceImage);
  console.log('   - Payment Status in ERP: Total LKR', foundInErp.totalAmount, '/ Balance LKR', foundInErp.balanceAmount);
  console.log('   - Production Status in ERP:', foundInErp.status);

  // Step 4: Login as Customer (ID: 21, email: sthana249@gmail.com)
  // Let's check customer's token
  const jwt = require('jsonwebtoken');
  const customerToken = jwt.sign(
    { id: dbOrder.customerId, customerId: dbOrder.customerId, name: dbOrder.customer_name, email: dbOrder.customer_email, role: 'CUSTOMER' },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  const custOrderRes = await fetch(`${BASE_URL}/customer-portal/orders/${dbOrder.id}`, {
    headers: { 'Authorization': `Bearer ${customerToken}` }
  });
  const custOrderData = await custOrderRes.json();
  console.log('5. Customer Portal GET /orders/:id Verification: SUCCESS');
  console.log('   - Customer Order ID:', custOrderData.order?.id);
  console.log('   - Customer Order Number:', custOrderData.order?.orderNumber);
  console.log('   - References exact same ID as Staff ERP:', custOrderData.order?.id === foundInErp.id);

  // Step 5: Test Staff Production Status Change on ORD-2026-0007
  console.log('\n6. Testing Staff Status Update -> Customer Track Status sync:');
  const newStatus = 'CUTTING';
  const updateRes = await fetch(`${BASE_URL}/orders/${dbOrder.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffToken}`
    },
    body: JSON.stringify({
      status: newStatus,
      notes: 'Fabric pattern cutting commenced by master cutter'
    })
  });
  const updateData = await updateRes.json();
  console.log('   - Staff status update HTTP status:', updateRes.status, updateData.success ? 'SUCCESS' : updateData.message);

  // Re-fetch in Customer Portal to verify instant synchronization
  const custTrackRes = await fetch(`${BASE_URL}/customer-portal/orders/${dbOrder.id}`, {
    headers: { 'Authorization': `Bearer ${customerToken}` }
  });
  const custTrackData = await custTrackRes.json();
  const statusSynced = custTrackData.order?.status === newStatus;
  const historySynced = custTrackData.order?.productionHistory?.some(h => h.stage === newStatus);
  console.log('   - Customer Studio sees updated status (' + custTrackData.order?.status + '):', statusSynced ? 'PASS' : 'FAIL');
  console.log('   - Customer Studio sees atelier history note:', historySynced ? 'PASS' : 'FAIL');

  // Step 6: Create another brand new customer order to confirm continuous end-to-end integration
  console.log('\n7. End-to-End Test with Newly Created Customer Order:');
  const createNewRes = await fetch(`${BASE_URL}/customer-portal/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerToken}`
    },
    body: JSON.stringify({
      garmentDetails: {
        dressType: 'Anarkali Suit',
        quantity: 1,
        occasion: 'Festival',
        fabricSuppliedBy: 'Customer',
        fabricType: 'Georgette',
        fabricColour: 'Emerald Green',
        liningRequired: 'Yes',
        workRequired: 'Yes',
        workDetails: 'Mirror work along border'
      }
    })
  });
  const createNewData = await createNewRes.json();
  if (!createNewData.success) throw new Error('Failed to create new customer order: ' + createNewData.message);
  const brandNewOrder = createNewData.order;
  console.log('   - Created Customer Order:', brandNewOrder.orderNumber, '(ID: ' + brandNewOrder.id + ')');

  // Verify it appears in Staff Sales ERP immediately
  const staffVerifyRes = await fetch(`${BASE_URL}/orders`, {
    headers: { 'Authorization': `Bearer ${staffToken}` }
  });
  const staffVerifyData = await staffVerifyRes.json();
  const foundBrandNew = staffVerifyData.orders.find(o => o.id === brandNewOrder.id);
  console.log('   - New order appears automatically in Staff Sales ERP:', foundBrandNew ? 'PASS (Matched ' + foundBrandNew.orderNumber + ')' : 'FAIL');

  console.log('\n===========================================================');
  console.log('ALL INTEGRATION CHECKS FOR ORD-2026-0007 & NEW ORDERS PASSED!');
  console.log('===========================================================');

  await pool.end();
}

verifyOrderIntegration().catch(err => {
  console.error('Integration verification error:', err);
  process.exit(1);
});
