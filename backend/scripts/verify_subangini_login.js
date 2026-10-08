require('dotenv').config();
const { Pool } = require('pg');

const BASE_URL = 'http://127.0.0.1:5000/api';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const results = [];

function recordResult(testName, passed, details = '') {
  results.push({ testName, passed, details });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName}${details ? ' - ' + details : ''}`);
}

async function verifySubangini() {
  console.log('====================================================');
  console.log('VERIFYING SUBANGINI RAJAN TAILOR LOGIN & ORD-2026-0009');
  console.log('====================================================\n');

  try {
    // 1. Test Login with valid credentials
    console.log('--- 1. AUTHENTICATION VERIFICATION ---');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'subangini@gmail.com',
        password: '123456'
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.data?.token || loginData.token;
    const user = loginData.data?.user || loginData.user;

    const loginSuccess = loginRes.status === 200 && Boolean(token) && user?.role === 'TAILOR' && user?.name === 'Subangini Rajan';
    recordResult('Tailor Login Authentication', loginSuccess, `Logged in: ${user?.name}, Role: ${user?.role}, Email: ${user?.email}`);

    // 2. Test Login with invalid password (security check)
    const badLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'subangini@gmail.com',
        password: 'wrong_password_123'
      })
    });
    recordResult('Invalid Credentials Rejection', badLoginRes.status === 401, `Status: ${badLoginRes.status}`);

    // 3. Verify Database User Record & Bcrypt Hash
    console.log('\n--- 2. DATABASE INTEGRITY & PASSWORD ENCRYPTION ---');
    const dbUserRes = await pool.query(
      'SELECT id, name, email, role, password, "isActive" FROM "User" WHERE email = \'subangini@gmail.com\';'
    );
    const dbUser = dbUserRes.rows[0];
    const passwordHashed = dbUser && dbUser.password.startsWith('$2') && dbUser.password !== '123456';
    recordResult('Password Securely Hashed with Bcrypt', passwordHashed, `Hash Prefix: ${dbUser?.password?.substring(0, 10)}... (No Plaintext)`);
    recordResult('Role Strictly TAILOR', dbUser?.role === 'TAILOR', `Role: ${dbUser?.role}`);
    recordResult('No Duplicate Staff Records', dbUserRes.rows.length === 1, `Total matching accounts: ${dbUserRes.rows.length} (ID: ${dbUser?.id})`);

    // 4. Verify Tailor Orders Queue & ORD-2026-0009 Visibility
    console.log('\n--- 3. TAILOR WORKSPACE & ORD-2026-0009 ASSIGNMENT ---');
    const ordersRes = await fetch(`${BASE_URL}/orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const ordersData = await ordersRes.json();
    const tailorOrders = ordersData.orders || [];

    // Find ORD-2026-0009
    const order0009 = tailorOrders.find(o => o.orderNumber === 'ORD-2026-0009');
    recordResult('ORD-2026-0009 Present in Tailor Orders', Boolean(order0009), `Order Found: ${order0009?.orderNumber}`);

    // Verify state: Waiting Acceptance
    const isWaitingAcceptance = order0009 && order0009.status === 'ORDER_CONFIRMED' && order0009.tailorAccepted === false;
    recordResult('ORD-2026-0009 State: Waiting Acceptance', isWaitingAcceptance, `Status: ${order0009?.status}, tailorAccepted: ${order0009?.tailorAccepted}`);

    // Verify strict isolation: All orders in tailor's list must be assigned to Subangini
    const allAssignedToSubangini = tailorOrders.every(o => o.assignedTailorId === dbUser.id);
    recordResult('Strict Isolation: Tailor Sees Only Orders Assigned to Her', allAssignedToSubangini, `${tailorOrders.length} order(s) retrieved, all assigned to Tailor ID ${dbUser.id}`);

    // Verify Tailor cannot see PENDING_APPROVAL or REJECTED orders
    const noPendingOrRejected = tailorOrders.every(o => !['PENDING_APPROVAL', 'REJECTED'].includes(o.status));
    recordResult('Tailor Does Not See PENDING_APPROVAL or REJECTED Orders', noPendingOrRejected, 'Zero pending/rejected orders in queue');

    // 5. Direct Order Fetch
    if (order0009) {
      const directOrderRes = await fetch(`${BASE_URL}/orders/${order0009.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const directOrderData = await directOrderRes.json();
      recordResult('Direct Order Fetch by Assigned Tailor', directOrderRes.status === 200 && directOrderData.success, `Retrieved: ${directOrderData.order?.orderNumber}`);
    }

    // 6. Summary
    console.log('\n====================================================');
    console.log('VERIFICATION SUMMARY');
    console.log('====================================================');
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    console.log('====================================================\n');

    if (failed > 0) process.exit(1);
    process.exit(0);

  } catch (err) {
    console.error('Verification error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifySubangini();
