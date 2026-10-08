require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const BASE_URL = 'http://127.0.0.1:5000/api';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const results = [];

function recordResult(testName, passed, details = '') {
  results.push({ testName, passed, details });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName}${details ? ' - ' + details : ''}`);
}

async function runVerification() {
  console.log('====================================================');
  console.log('STARTING COMPLETE CUSTOMER PORTAL VERIFICATION');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // 1. DATABASE VERIFICATION
  // ----------------------------------------------------
  console.log('--- 1. DATABASE SCHEMA & INTEGRITY ---');
  try {
    const custCols = await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'Customer';
    `);
    const custColNames = custCols.rows.map(r => r.column_name);
    const hasAuthFields = custColNames.includes('email') && custColNames.includes('password') && custColNames.includes('primaryPhone');

    const fkQuery = await pool.query(`
      SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('Order', 'GarmentDetails');
    `);
    const fks = fkQuery.rows;
    const hasOrderCustRel = fks.some(f => f.table_name === 'Order' && f.column_name === 'customerId' && f.foreign_table_name === 'Customer');
    const hasGarmentOrderRel = fks.some(f => f.table_name === 'GarmentDetails' && f.column_name === 'orderId' && f.foreign_table_name === 'Order');

    if (hasAuthFields && hasOrderCustRel && hasGarmentOrderRel) {
      recordResult('Database Schema & Relations', true, 'Customer auth fields, Order.customerId->Customer, and GarmentDetails.orderId->Order are active.');
    } else {
      recordResult('Database Schema & Relations', false, `AuthFields: ${hasAuthFields}, OrderCustRel: ${hasOrderCustRel}, GarmentOrderRel: ${hasGarmentOrderRel}`);
    }
  } catch (err) {
    recordResult('Database Schema & Relations', false, err.message);
  }

  // ----------------------------------------------------
  // 2. CUSTOMER REGISTRATION
  // ----------------------------------------------------
  console.log('\n--- 2. CUSTOMER REGISTRATION ---');
  const ts = Date.now();
  const customerA_data = {
    name: 'Dilani Perera',
    primaryPhone: `+9477${Math.floor(1000000 + Math.random() * 8999999)}`,
    email: `dilani_${ts}@example.com`,
    password: 'SecurePassword123!',
    address: '15 Flower Road, Colombo 07'
  };

  let tokenA = null;
  let customerA_id = null;

  try {
    // 2.1 POST registration
    const regRes = await fetch(`${BASE_URL}/customer-portal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerA_data)
    });
    const regJson = await regRes.json();

    if (regRes.status === 201 && regJson.success && regJson.data?.token) {
      tokenA = regJson.data.token;
      customerA_id = regJson.data.customer.id;
      recordResult('Customer Registration (Success)', true, `Registered ID: ${customerA_id}`);
    } else {
      recordResult('Customer Registration (Success)', false, `Status ${regRes.status}: ${JSON.stringify(regJson)}`);
    }

    // 2.2 Verify customer in PostgreSQL & password hashed
    const dbCust = await pool.query('SELECT id, name, email, password FROM "Customer" WHERE id = $1;', [customerA_id]);
    if (dbCust.rows.length === 1) {
      const storedPw = dbCust.rows[0].password;
      const isBcrypt = storedPw && storedPw.startsWith('$2') && storedPw !== customerA_data.password;
      const bcryptMatches = await bcrypt.compare(customerA_data.password, storedPw);
      if (isBcrypt && bcryptMatches) {
        recordResult('Customer Password Hashed (No Plaintext)', true, 'Bcrypt hash verified in DB.');
      } else {
        recordResult('Customer Password Hashed (No Plaintext)', false, 'Password hash invalid or plaintext stored.');
      }
    } else {
      recordResult('Customer Password Hashed (No Plaintext)', false, 'Customer row not found in PostgreSQL.');
    }

    // 2.3 Verify duplicate email rejected
    const dupEmailRes = await fetch(`${BASE_URL}/customer-portal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Email Test',
        primaryPhone: `+9477${Math.floor(1000000 + Math.random() * 8999999)}`,
        email: customerA_data.email, // duplicate email
        password: 'AnotherPassword123!'
      })
    });
    recordResult('Duplicate Email Rejected', dupEmailRes.status === 409, `HTTP Status ${dupEmailRes.status}`);

    // 2.4 Verify duplicate phone rejected
    const dupPhoneRes = await fetch(`${BASE_URL}/customer-portal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Phone Test',
        primaryPhone: customerA_data.primaryPhone, // duplicate phone
        email: `unique_${ts}@example.com`,
        password: 'AnotherPassword123!'
      })
    });
    recordResult('Duplicate Phone Rejected', dupPhoneRes.status === 409, `HTTP Status ${dupPhoneRes.status}`);

  } catch (err) {
    console.error('Registration Catch Error:', err, err?.cause);
    recordResult('Customer Registration Suite', false, err.message);
  }

  // ----------------------------------------------------
  // 3. CUSTOMER LOGIN
  // ----------------------------------------------------
  console.log('\n--- 3. CUSTOMER LOGIN ---');
  try {
    // 3.1 Valid login with email
    const loginEmailRes = await fetch(`${BASE_URL}/customer-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: customerA_data.email,
        password: customerA_data.password
      })
    });
    const loginEmailJson = await loginEmailRes.json();
    const emailLoginOk = loginEmailRes.status === 200 && loginEmailJson.success && loginEmailJson.data?.token;
    recordResult('Login With Valid Email', emailLoginOk, emailLoginOk ? 'Token received' : loginEmailJson.message);

    // 3.2 Valid login with phone
    const loginPhoneRes = await fetch(`${BASE_URL}/customer-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: customerA_data.primaryPhone,
        password: customerA_data.password
      })
    });
    const loginPhoneJson = await loginPhoneRes.json();
    const phoneLoginOk = loginPhoneRes.status === 200 && loginPhoneJson.success && loginPhoneJson.data?.token;
    recordResult('Login With Valid Mobile', phoneLoginOk, phoneLoginOk ? 'Token received' : loginPhoneJson.message);

    // 3.3 Invalid credentials rejected
    const badLoginRes = await fetch(`${BASE_URL}/customer-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: customerA_data.email,
        password: 'WrongPassword999!'
      })
    });
    recordResult('Invalid Credentials Rejected', badLoginRes.status === 401, `HTTP Status ${badLoginRes.status}`);

    // 3.4 Protected customer profile /me returns identity
    const meRes = await fetch(`${BASE_URL}/customer-portal/me`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const meJson = await meRes.json();
    const meOk = meRes.status === 200 && meJson.success && meJson.customer?.id === customerA_id;
    recordResult('Customer Identity in Protected API (/me)', meOk, meOk ? `Name: ${meJson.customer.name}` : meJson.message);

  } catch (err) {
    recordResult('Customer Login Suite', false, err.message);
  }

  // ----------------------------------------------------
  // 7. REAL IMAGE UPLOAD (Run before order creation so image can be attached to order)
  // ----------------------------------------------------
  console.log('\n--- 7. IMAGE UPLOAD ---');
  let uploadedDesignUrl = null;
  try {
    // Create a valid 1x1 PNG pixel buffer
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    let bodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="designImage"; filename="test_design.png"\r\nContent-Type: image/png\r\n\r\n`),
      pngBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const uploadRes = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenA}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer
    });

    const uploadJson = await uploadRes.json();
    if (uploadRes.status === 200 && uploadJson.success && uploadJson.imageUrl) {
      uploadedDesignUrl = uploadJson.imageUrl;
      // Verify file exists on local disk
      const filePath = path.join(__dirname, '..', uploadedDesignUrl);
      const fileExists = fs.existsSync(filePath);
      recordResult('Image Upload (File Stored)', fileExists, `Stored at ${uploadedDesignUrl}`);

      // Test static retrieval via HTTP
      const imgFetchRes = await fetch(`http://127.0.0.1:5000${uploadedDesignUrl}`);
      recordResult('Image URL Accessible via HTTP', imgFetchRes.status === 200, `HTTP Status ${imgFetchRes.status}`);
    } else {
      recordResult('Image Upload (File Stored)', false, `Status ${uploadRes.status}: ${JSON.stringify(uploadJson)}`);
    }
  } catch (err) {
    recordResult('Image Upload Suite', false, err.message);
  }

  // ----------------------------------------------------
  // 4. CUSTOMER ORDER CREATION & VERIFICATION
  // ----------------------------------------------------
  console.log('\n--- 4. CUSTOMER ORDER ---');
  let createdOrderId = null;
  let createdOrderNumber = null;

  try {
    const orderPayload = {
      garmentDetails: {
        dressType: 'Bridal Lehenga',
        quantity: 1,
        occasion: 'Wedding Reception',
        fabricSuppliedBy: 'Customer',
        fabricType: 'Raw Silk',
        fabricColour: 'Ruby Crimson & Gold',
        liningRequired: 'Yes',
        paddingCupRequired: 'Yes',
        workRequired: 'Yes',
        workDetails: 'Intricate zardozi embroidery with seed pearls',
        accessoriesSupplied: 'Matching dupatta borders and golden latkans',
        specialDesignInstructions: 'High back neckline with side zip closure',
        designReferenceImage: uploadedDesignUrl
      }
    };

    const orderRes = await fetch(`${BASE_URL}/customer-portal/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify(orderPayload)
    });

    const orderJson = await orderRes.json();
    if (orderRes.status === 201 && orderJson.success && orderJson.order) {
      createdOrderId = orderJson.order.id;
      createdOrderNumber = orderJson.order.orderNumber;

      const orderOk = orderJson.order.customerId === customerA_id &&
        (orderJson.order.status === 'PENDING_APPROVAL' || orderJson.order.status === 'ORDER_CONFIRMED') &&
        orderJson.order.orderNumber.startsWith('ORD-') &&
        orderJson.order.garmentDetails?.dressType === 'Bridal Lehenga' &&
        orderJson.order.garmentDetails?.designReferenceImage === uploadedDesignUrl;

      recordResult('Customer Order Created with Garment Details & Image', orderOk, `Order: ${createdOrderNumber}, Status: ${orderJson.order.status}`);
    } else {
      recordResult('Customer Order Created with Garment Details & Image', false, `Status ${orderRes.status}: ${JSON.stringify(orderJson)}`);
    }

    // Verify order in PostgreSQL directly
    const dbOrder = await pool.query(`
      SELECT o.id, o."orderNumber", o.status, o."customerId", g."dressType", g."designReferenceImage"
      FROM "Order" o
      JOIN "GarmentDetails" g ON g."orderId" = o.id
      WHERE o.id = $1;
    `, [createdOrderId]);

    if (dbOrder.rows.length === 1) {
      const row = dbOrder.rows[0];
      const dbVerified = row.customerId === customerA_id && row.dressType === 'Bridal Lehenga' && row.designReferenceImage === uploadedDesignUrl;
      recordResult('Order & Garment Details in PostgreSQL', dbVerified, `DB row linked to customer ${row.customerId}`);
    } else {
      recordResult('Order & Garment Details in PostgreSQL', false, 'Order row not found in DB join.');
    }

  } catch (err) {
    recordResult('Customer Order Suite', false, err.message);
  }

  // ----------------------------------------------------
  // 5. SECURITY & ISOLATION TEST (Customer A vs Customer B)
  // ----------------------------------------------------
  console.log('\n--- 5. SECURITY & ISOLATION TEST ---');
  let tokenB = null;
  let customerB_id = null;

  try {
    // 5.1 Register Customer B
    const customerB_data = {
      name: 'Rohan Wickramasinghe',
      primaryPhone: `+9471${Math.floor(1000000 + Math.random() * 8999999)}`,
      email: `rohan_${ts}@example.com`,
      password: 'SecurePassword123!',
      address: '88 Kandy Road, Kadawatha'
    };

    const regBRes = await fetch(`${BASE_URL}/customer-portal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerB_data)
    });
    const regBJson = await regBRes.json();
    tokenB = regBJson.data?.token;
    customerB_id = regBJson.data?.customer?.id;

    // Security Test 1: Customer B cannot view Customer A's order via Customer Portal (/orders/:id)
    const viewOrderPortalRes = await fetch(`${BASE_URL}/customer-portal/orders/${createdOrderId}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    recordResult('Customer B Blocked from Viewing Customer A Order (Portal)', viewOrderPortalRes.status === 404, `HTTP Status ${viewOrderPortalRes.status}`);

    // Security Test 2: Customer B cannot view Customer A's order via ERP endpoint (/orders/:id)
    const viewOrderErpRes = await fetch(`${BASE_URL}/orders/${createdOrderId}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    recordResult('Customer B Blocked from Viewing Customer A Order (ERP Route)', viewOrderErpRes.status === 403, `HTTP Status ${viewOrderErpRes.status}`);

    // Security Test 3: Customer B cannot view Customer A's customer orders (/orders/customer/:customerId)
    const viewCustOrdersRes = await fetch(`${BASE_URL}/orders/customer/${customerA_id}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    recordResult('Customer B Blocked from Customer A Orders List', viewCustOrdersRes.status === 403, `HTTP Status ${viewCustOrdersRes.status}`);

    // Security Test 4: Customer B cannot view Customer A's profile (/customers/:id)
    const viewCustProfileRes = await fetch(`${BASE_URL}/customers/${customerA_id}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    recordResult('Customer B Blocked from Viewing Customer A Profile', viewCustProfileRes.status === 403, `HTTP Status ${viewCustProfileRes.status}`);

    // Security Test 5: Customer B cannot search all customers (/customers/search)
    const searchCustRes = await fetch(`${BASE_URL}/customers/search?query=Dilani`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    recordResult('Customer B Blocked from Customer Search', searchCustRes.status === 403, `HTTP Status ${searchCustRes.status}`);

    // Security Test 6: Customer B cannot change order status (PATCH /orders/:id/status)
    const changeStatusRes = await fetch(`${BASE_URL}/orders/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenB}`
      },
      body: JSON.stringify({ status: 'DELIVERED' })
    });
    recordResult('Customer Blocked from Changing Order Status', changeStatusRes.status === 403, `HTTP Status ${changeStatusRes.status}`);

    // Security Test 7: Customer B cannot change payment information (POST /orders/:id/payment)
    const changePaymentRes = await fetch(`${BASE_URL}/orders/${createdOrderId}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenB}`
      },
      body: JSON.stringify({ amount: 50000, paymentMethod: 'CASH' })
    });
    recordResult('Customer Blocked from Recording Payment', changePaymentRes.status === 403, `HTTP Status ${changePaymentRes.status}`);

    // Security Test 8: Customer B cannot download Customer A's PDF
    const downloadPdfRes = await fetch(`${BASE_URL}/orders/${createdOrderId}/pdf`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    recordResult('Customer B Blocked from Customer A PDF', downloadPdfRes.status === 403, `HTTP Status ${downloadPdfRes.status}`);

  } catch (err) {
    recordResult('Security & Isolation Suite', false, err.message);
  }

  // ----------------------------------------------------
  // 6. EXISTING ERP FEATURES TEST
  // ----------------------------------------------------
  console.log('\n--- 6. EXISTING ERP FEATURES TEST ---');
  let staffToken = null;
  let tailorToken = null;
  let adminToken = null;

  try {
    // 6.1 Admin Login
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ceo@jbgroup.com', password: '@Bella202CEO6' })
    });
    const adminJson = await adminLoginRes.json();
    adminToken = adminJson.data?.token;
    recordResult('Admin / CEO Login', adminLoginRes.status === 200 && adminJson.success, `Role: ${adminJson.data?.user?.role}`);

    // 6.2 Staff Login
    const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'staff@jbgroup.com', password: 'Staff@Bella2026' })
    });
    const staffJson = await staffLoginRes.json();
    staffToken = staffJson.data?.token;
    recordResult('Staff Login', staffLoginRes.status === 200 && staffJson.success, `Role: ${staffJson.data?.user?.role}`);

    // 6.3 Tailor Login
    const tailorLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pushpamalar@jbgroup.com', password: 'Pushpa@Tailor2026' })
    });
    const tailorJson = await tailorLoginRes.json();
    tailorToken = tailorJson.data?.token;
    recordResult('Tailor Login', tailorLoginRes.status === 200 && tailorJson.success, `Role: ${tailorJson.data?.user?.role}`);

    // 6.4 Manager Login
    const ManagerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@jbgroup.com', password: 'Manager@Bella2026' })
    });
    const ManagerJson = await ManagerLoginRes.json();
    recordResult('Manager Login', ManagerLoginRes.status === 200 && ManagerJson.success, `Role: ${ManagerJson.data?.user?.role}`);

    // 6.5 Existing ERP can retrieve customer order (Sales ERP)
    const erpOrdersRes = await fetch(`${BASE_URL}/orders`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    const erpOrdersJson = await erpOrdersRes.json();
    const customerOrderInErp = erpOrdersJson.orders?.some(o => o.id === createdOrderId);
    recordResult('Sales ERP Retrieves Customer Order', erpOrdersRes.status === 200 && customerOrderInErp, `Customer order ${createdOrderNumber} visible in ERP`);

    // 6.6 Existing Order Creation (Staff ERP Order Entry)
    const erpNewOrderRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`
      },
      body: JSON.stringify({
        customerId: customerA_id,
        garmentDetails: {
          dressType: 'Traditional Kurti',
          quantity: 2,
          occasion: 'Casual'
        }
      })
    });
    const erpNewOrderJson = await erpNewOrderRes.json();
    const erpOrderCreated = erpNewOrderRes.status === 201 && erpNewOrderJson.success;
    const staffCreatedOrderId = erpNewOrderJson.order?.id;
    recordResult('Existing Staff Order Creation', erpOrderCreated, erpOrderCreated ? `Created order ${erpNewOrderJson.order?.orderNumber}` : erpNewOrderJson.message);

    // 6.7 Production Workflow Status Update by Tailor
    if (staffCreatedOrderId) {
      const prodUpdateRes = await fetch(`${BASE_URL}/orders/${staffCreatedOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tailorToken}`
        },
        body: JSON.stringify({
          status: 'CUTTING',
          notes: 'Commenced cutting pattern pieces'
        })
      });
      const prodJson = await prodUpdateRes.json();
      recordResult('Production Workflow (Status Update by Tailor)', prodUpdateRes.status === 200 && prodJson.success, `Status updated to ${prodJson.order?.status}`);
    }

    // 6.8 Admin ERP sees uploaded design image
    const adminViewOrder = await fetch(`${BASE_URL}/orders/${createdOrderId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminViewJson = await adminViewOrder.json();
    const adminSeesImage = adminViewJson.order?.garmentDetails?.designReferenceImage === uploadedDesignUrl;
    recordResult('Admin ERP Sees Uploaded Design Image', adminSeesImage, `Image reference matched: ${uploadedDesignUrl}`);

  } catch (err) {
    recordResult('Existing ERP Suite', false, err.message);
  }

  // ----------------------------------------------------
  // 8. API HEALTH & ALL CUSTOMER PORTAL ENDPOINTS
  // ----------------------------------------------------
  console.log('\n--- 8. API HEALTH & CUSTOMER PORTAL ROUTES ---');
  try {
    // 8.1 Health check
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthJson = await healthRes.json();
    recordResult('API Health Check (/api/health)', healthRes.status === 200 && healthJson.success, healthJson.message);

    // 8.2 Customer Portal: PUT /profile
    const updateProfileRes = await fetch(`${BASE_URL}/customer-portal/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        address: 'Updated 22 Queen Street, Colombo 03',
        alternativePhone: '0779998888'
      })
    });
    const updateProfileJson = await updateProfileRes.json();
    recordResult('Customer Portal PUT /profile', updateProfileRes.status === 200 && updateProfileJson.customer?.address?.includes('Queen Street'), 'Address updated');

    // 8.3 Customer Portal: GET /orders
    const myOrdersRes = await fetch(`${BASE_URL}/customer-portal/orders`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const myOrdersJson = await myOrdersRes.json();
    recordResult('Customer Portal GET /orders', myOrdersRes.status === 200 && myOrdersJson.orders?.length >= 1, `Found ${myOrdersJson.orders?.length} orders for Customer A`);

    // 8.4 Customer Portal: GET /orders/:id
    const myOrderDetailRes = await fetch(`${BASE_URL}/customer-portal/orders/${createdOrderId}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const myOrderDetailJson = await myOrderDetailRes.json();
    recordResult('Customer Portal GET /orders/:id', myOrderDetailRes.status === 200 && myOrderDetailJson.order?.id === createdOrderId, 'Retrieved order details');

    // 8.5 Customer Portal: POST /forgot-password
    const forgotPwRes = await fetch(`${BASE_URL}/customer-portal/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: customerA_data.email,
        newPassword: 'BrandNewPassword123!'
      })
    });
    const forgotPwJson = await forgotPwRes.json();
    recordResult('Customer Portal POST /forgot-password', forgotPwRes.status === 200 && forgotPwJson.success, forgotPwJson.message);

    // Verify login with new password
    const loginNewPwRes = await fetch(`${BASE_URL}/customer-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: customerA_data.email,
        password: 'BrandNewPassword123!'
      })
    });
    const loginNewPwJson = await loginNewPwRes.json();
    recordResult('Customer Login with Reset Password', loginNewPwRes.status === 200 && loginNewPwJson.success, 'New password works');

  } catch (err) {
    recordResult('API Routes Suite', false, err.message);
  }

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log('VERIFICATION TEST SUMMARY');
  console.log('====================================================');
  const total = results.length;
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = total - passedCount;
  console.log(`Total Tests: ${total} | Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.log('\nFAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => console.log(` - ${r.testName}: ${r.details}`));
  } else {
    console.log('\nALL 27 AUTOMATED BACKEND VERIFICATION CHECKS PASSED!');
  }

  await pool.end();
}

runVerification().catch(console.error);
