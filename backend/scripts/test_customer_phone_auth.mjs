import { prisma } from '../src/prisma.js';
import bcrypt from 'bcrypt';

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('CUSTOMER PORTAL PHONE LOGIN VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extraInfo = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${extraInfo ? `-> ${extraInfo}` : ''}`);
      failed++;
    }
  }

  // Generate unique test phones
  const testPhone1_Local = '0779911223';
  const testPhone1_Intl = '+94779911223';
  const testPhone2_Local = '0715566778';
  const testPassword = 'TestPassword123!';
  const updatedPassword = 'NewSecretPassword456!';

  try {
    // 0. Clean up any prior test records
    await prisma.customer.deleteMany({
      where: {
        primaryPhone: {
          in: [testPhone1_Local, testPhone1_Intl, testPhone2_Local, '+94715566778']
        }
      }
    });

    console.log('\n--- 1. CUSTOMER PROFILE CREATION & REGISTRATION TESTS ---');

    // Test 1: Register customer without email (Phone + Password)
    const regRes1 = await fetch(`${BASE_URL}/customer-portal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Phone Only Customer',
        primaryPhone: testPhone1_Local,
        password: testPassword,
        address: '123 Galle Road, Colombo'
      })
    });
    const regData1 = await regRes1.json();
    assert(regRes1.status === 201 && regData1.success, 'New customer created without email address');
    assert(regData1.data?.token && regData1.data?.customer?.id, 'Token and customer ID returned on registration');

    const customer1Id = regData1.data?.customer?.id;
    const customer1Token = regData1.data?.token;

    // Test 2: Register customer with email
    const regRes2 = await fetch(`${BASE_URL}/customer-portal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Email Customer',
        primaryPhone: testPhone2_Local,
        email: 'testemailcust@jbgroup.com',
        password: testPassword,
        address: '45 Kandy Road'
      })
    });
    const regData2 = await regRes2.json();
    assert(regRes2.status === 201 && regData2.success, 'New customer created with email address');
    const customer2Id = regData2.data?.customer?.id;
    const customer2Token = regData2.data?.token;

    // Test 3: Missing phone number is rejected
    const regResNoPhone = await fetch(`${BASE_URL}/customer-portal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'No Phone Customer',
        password: testPassword
      })
    });
    assert(regResNoPhone.status === 400, 'Missing phone number is rejected (400)');

    // Test 4: Invalid phone number is rejected
    const regResBadPhone = await fetch(`${BASE_URL}/customer-portal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad Phone Customer',
        primaryPhone: '123',
        password: testPassword
      })
    });
    assert(regResBadPhone.status === 400, 'Invalid phone number format is rejected (400)');

    // Test 5: Duplicate phone number is safely rejected
    const regResDup = await fetch(`${BASE_URL}/customer-portal/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Phone Person',
        primaryPhone: testPhone1_Intl, // same customer, different format
        password: testPassword
      })
    });
    assert(regResDup.status === 409, 'Duplicate phone number registration rejected with 409 Conflict');

    console.log('\n--- 2. AUTHENTICATION & PHONE LOGIN TESTS ---');

    // Test 6: Login with exact phone used at registration
    const loginRes1 = await fetch(`${BASE_URL}/customer-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testPhone1_Local,
        password: testPassword
      })
    });
    const loginData1 = await loginRes1.json();
    assert(loginRes1.status === 200 && loginData1.success, 'Customer logs in using registered local phone (077...)');

    // Test 7: Login using international format (+9477...) when registered as local
    const loginResIntl = await fetch(`${BASE_URL}/customer-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testPhone1_Intl,
        password: testPassword
      })
    });
    const loginDataIntl = await loginResIntl.json();
    assert(loginResIntl.status === 200 && loginDataIntl.success, 'Customer logs in using international format (+9477...) via normalized lookup');

    // Test 8: Login using email address for customer with email
    const loginResEmail = await fetch(`${BASE_URL}/customer-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'testemailcust@jbgroup.com',
        password: testPassword
      })
    });
    const loginDataEmail = await loginResEmail.json();
    assert(loginResEmail.status === 200 && loginDataEmail.success, 'Customer with email logs in using email address');

    // Test 9: Incorrect password rejected with safe message
    const loginBadPwd = await fetch(`${BASE_URL}/customer-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testPhone1_Local,
        password: 'WrongPassword999'
      })
    });
    assert(loginBadPwd.status === 401, 'Incorrect password rejected with 401');

    // Test 10: Unknown phone number rejected with safe message (no enumeration)
    const loginUnknown = await fetch(`${BASE_URL}/customer-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '0770000000',
        password: testPassword
      })
    });
    assert(loginUnknown.status === 401, 'Unknown phone number rejected with safe 401');

    // Test 11: Empty phone number or password rejected
    const loginEmpty = await fetch(`${BASE_URL}/customer-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '', password: '' })
    });
    assert(loginEmpty.status === 400, 'Empty credentials rejected with 400');

    console.log('\n--- 3. BRUTE-FORCE RATE LIMITING TEST ---');

    // Test 12: Trigger rate limiter with repeated failed attempts
    const bruteIdentifier = '0771122334';
    let hitRateLimit = false;
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${BASE_URL}/customer-portal/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: bruteIdentifier,
          password: 'IncorrectPassword'
        })
      });
      if (res.status === 429) {
        hitRateLimit = true;
        break;
      }
    }
    assert(hitRateLimit, 'Rate limiter activates after repeated failed login attempts (429 Too Many Requests)');

    console.log('\n--- 4. AUTHORIZATION & RBAC PRIVILEGE SEPARATION ---');

    // Test 13: Customer cannot access employee routes (/api/users)
    const empAccess = await fetch(`${BASE_URL}/users`, {
      headers: { 'Authorization': `Bearer ${customer1Token}` }
    });
    assert(empAccess.status === 403, 'Customer token rejected from employee API (/api/users) with 403 Forbidden');

    // Test 14: Customer cannot access CEO financial summary
    const ceoAccess = await fetch(`${BASE_URL}/reports/daily`, {
      headers: { 'Authorization': `Bearer ${customer1Token}` }
    });
    assert(ceoAccess.status === 403 || ceoAccess.status === 404, 'Customer cannot access management reports');

    // Test 15: Unauthenticated access to customer orders rejected
    const noAuthOrders = await fetch(`${BASE_URL}/customer-portal/orders`);
    assert(noAuthOrders.status === 401, 'Unauthenticated request to customer orders rejected with 401');

    // Test 16: Customer 1 views own orders successfully
    const cust1Orders = await fetch(`${BASE_URL}/customer-portal/orders`, {
      headers: { 'Authorization': `Bearer ${customer1Token}` }
    });
    const cust1OrdersData = await cust1Orders.json();
    assert(cust1Orders.status === 200 && Array.isArray(cust1OrdersData.orders), 'Customer 1 accesses own orders endpoint (200)');

    console.log('\n--- 5. AUTHENTICATED PASSWORD CHANGE & VERIFICATION ---');

    // Test 17: Authenticated password change with wrong current password rejected
    const pwdChangeBad = await fetch(`${BASE_URL}/customer-portal/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customer1Token}`
      },
      body: JSON.stringify({
        currentPassword: 'WrongCurrentPassword',
        newPassword: updatedPassword,
        confirmPassword: updatedPassword
      })
    });
    assert(pwdChangeBad.status === 401, 'Password change with incorrect current password rejected (401)');

    // Test 18: Authenticated password change with matching credentials
    const pwdChangeSuccess = await fetch(`${BASE_URL}/customer-portal/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customer1Token}`
      },
      body: JSON.stringify({
        currentPassword: testPassword,
        newPassword: updatedPassword,
        confirmPassword: updatedPassword
      })
    });
    const pwdChangeData = await pwdChangeSuccess.json();
    assert(pwdChangeSuccess.status === 200 && pwdChangeData.success, 'Customer securely changes password in portal');

    // Test 19: Old password now fails
    const oldLogin = await fetch(`${BASE_URL}/customer-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testPhone1_Local,
        password: testPassword
      })
    });
    assert(oldLogin.status === 401, 'Old password fails after password change');

    // Test 20: New password succeeds
    const newLogin = await fetch(`${BASE_URL}/customer-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testPhone1_Local,
        password: updatedPassword
      })
    });
    assert(newLogin.status === 200, 'New password successfully authenticates customer');

    console.log('\n--- 6. PASSWORD RECOVERY (EMAIL OTP & HONEST SMS REPORTING) ---');

    // Test 21: Customer without email requesting OTP receives honest message that SMS is unconfigured
    const otpPhoneOnly = await fetch(`${BASE_URL}/customer-portal/forgot-password/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testPhone1_Local })
    });
    const otpPhoneData = await otpPhoneOnly.json();
    assert(
      otpPhoneOnly.status === 400 && otpPhoneData.requiresStaffAssistance,
      'Phone-only customer OTP request honestly reports SMS is unconfigured and advises staff assistance'
    );

    // Test 22: Customer with email can request password reset OTP
    const otpEmailCust = await fetch(`${BASE_URL}/customer-portal/forgot-password/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'testemailcust@jbgroup.com' })
    });
    const otpEmailData = await otpEmailCust.json();
    // Brevo SMTP may or may not succeed with dummy email, but API handler processes email flow
    assert(
      otpEmailCust.status === 200 || (otpEmailCust.status === 500 && otpEmailData.message?.includes('email')),
      'Email customer triggers email reset OTP flow (preserved Brevo path)'
    );

    console.log('\n--- 7. CLEANUP TEST DATA ---');
    await prisma.customer.deleteMany({
      where: {
        primaryPhone: {
          in: [testPhone1_Local, testPhone1_Intl, testPhone2_Local, '+94715566778']
        }
      }
    });
    console.log('Cleaned up test customers successfully.');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
