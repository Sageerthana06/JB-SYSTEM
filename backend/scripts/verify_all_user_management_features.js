require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const BASE_URL = 'http://localhost:5000/api';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const testResults = [];
function assert(description, condition, details = '') {
  testResults.push({ description, condition, details });
  console.log(`[${condition ? 'PASS' : 'FAIL'}] ${description} ${details ? '— ' + details : ''}`);
}

async function runVerification() {
  console.log('========================================================================');
  console.log('COMPREHENSIVE ALL-ROLE USER & LOGIN MANAGEMENT VERIFICATION');
  console.log('========================================================================\n');

  try {
    // 1. Database Accounts Inspection
    console.log('--- 1. DATABASE USERS & EMPLOYEES PREPARATION ---');
    const ceo = (await pool.query("SELECT * FROM \"User\" WHERE role = 'SUPER_ADMIN' LIMIT 1;")).rows[0];
    const manager = (await pool.query("SELECT * FROM \"User\" WHERE role = 'MANAGER' LIMIT 1;")).rows[0];
    const staff = (await pool.query("SELECT * FROM \"User\" WHERE role = 'STAFF' LIMIT 1;")).rows[0];
    const tailor = (await pool.query("SELECT * FROM \"User\" WHERE email = 'pushpamalar@jbgroup.com';")).rows[0];
    const cashier = (await pool.query("SELECT * FROM \"User\" WHERE role = 'CASHIER' LIMIT 1;")).rows[0];

    assert('CEO user exists in database', Boolean(ceo), `ID: ${ceo?.id}, Email: ${ceo?.email}`);
    assert('Manager user exists in database', Boolean(manager), `ID: ${manager?.id}, Email: ${manager?.email}`);
    assert('Staff user exists in database', Boolean(staff), `ID: ${staff?.id}, Email: ${staff?.email}`);
    assert('Tailor user exists in database', Boolean(tailor), `ID: ${tailor?.id}, Email: ${tailor?.email}`);
    assert('Cashier user exists in database', Boolean(cashier), `ID: ${cashier?.id}, Email: ${cashier?.email}`);

    const makeToken = (u) => jwt.sign(
      { id: u.id, name: u.name, email: u.email, role: u.role, branchId: u.branchId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const ceoToken = makeToken(ceo);
    const mgrToken = makeToken(manager);
    const staffToken = makeToken(staff);
    const tailorToken = makeToken(tailor);
    const cashierToken = makeToken(cashier);

    // 2. CEO User Management Access
    console.log('\n--- 2. CEO FULL MULTI-BRANCH MANAGEMENT ACCESS ---');
    const ceoUsersRes = await fetch(`${BASE_URL}/users`, {
      headers: { 'Authorization': `Bearer ${ceoToken}` }
    });
    const ceoUsersData = await ceoUsersRes.json();
    assert('CEO can access User Management list', ceoUsersRes.status === 200 && ceoUsersData.success, `Found ${ceoUsersData.users?.length} roster records`);

    // Verify all records have Employee ID, Role, Branch, Login Status, Account Status, Last Login field
    const sample = ceoUsersData.users?.[0];
    assert('Records contain Employee ID', Boolean(sample?.employeeId && sample.employeeId.startsWith('EMP-')), `Sample ID: ${sample?.employeeId}`);
    assert('Records contain Email Address', sample?.email !== undefined, `Sample Email: ${sample?.email}`);
    assert('Records contain Role', Boolean(sample?.role), `Sample Role: ${sample?.role}`);
    assert('Records contain Branch Name', Boolean(sample?.branchName), `Sample Branch: ${sample?.branchName}`);
    assert('Records contain Login Status', Boolean(sample?.loginStatus), `Sample Login Status: ${sample?.loginStatus}`);
    assert('Records contain Account Status', Boolean(sample?.accountStatus), `Sample Account Status: ${sample?.accountStatus}`);
    assert('Records contain Last Login', sample?.lastLoginAt !== undefined, `Sample Last Login: ${sample?.lastLoginAt || 'Never'}`);

    // 3. Manager Branch & Role Security
    console.log('\n--- 3. MANAGER BRANCH RESTRICTIONS & SECURITY ---');
    const mgrUsersRes = await fetch(`${BASE_URL}/users`, {
      headers: { 'Authorization': `Bearer ${mgrToken}` }
    });
    const mgrUsersData = await mgrUsersRes.json();
    assert('Manager can access User Management list for their branch', mgrUsersRes.status === 200 && mgrUsersData.success, `Found ${mgrUsersData.users?.length} records`);

    const allInBranch = mgrUsersData.users?.every(u => !u.branchId || u.branchId === manager.branchId);
    assert('Manager view strictly confined to authorized branch', allInBranch, `Authorized branchId: ${manager.branchId}`);

    // Manager cannot create CEO
    const hackCeoRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mgrToken}` },
      body: JSON.stringify({
        name: 'Exploit CEO',
        email: 'exploit_ceo@jbgroup.com',
        role: 'SUPER_ADMIN',
        branchId: manager.branchId,
        password: 'Password123!'
      })
    });
    assert('Manager denied creating SUPER_ADMIN account', hackCeoRes.status === 403, `Status: ${hackCeoRes.status}`);

    // Manager cannot modify CEO account
    const modCeoRes = await fetch(`${BASE_URL}/users/${ceo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mgrToken}` },
      body: JSON.stringify({ name: 'Changed CEO Name' })
    });
    assert('Manager denied modifying CEO account', modCeoRes.status === 403, `Status: ${modCeoRes.status}`);

    // Manager cannot deactivate CEO account
    const deactCeoRes = await fetch(`${BASE_URL}/users/${ceo.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mgrToken}` },
      body: JSON.stringify({ isActive: false })
    });
    assert('Manager denied deactivating CEO account', deactCeoRes.status === 403, `Status: ${deactCeoRes.status}`);

    // 4. Access Denial for Staff, Tailor, and Cashier
    console.log('\n--- 4. STRICT ACCESS DENIAL FOR RESTRICTED ROLES ---');
    const staffDenied = (await fetch(`${BASE_URL}/users`, { headers: { 'Authorization': `Bearer ${staffToken}` } })).status === 403;
    assert('Staff strictly denied from User Management APIs (403)', staffDenied);

    const tailorDenied = (await fetch(`${BASE_URL}/users`, { headers: { 'Authorization': `Bearer ${tailorToken}` } })).status === 403;
    assert('Tailor strictly denied from User Management APIs (403)', tailorDenied);

    const cashierDenied = (await fetch(`${BASE_URL}/users`, { headers: { 'Authorization': `Bearer ${cashierToken}` } })).status === 403;
    assert('Cashier strictly denied from User Management APIs (403)', cashierDenied);

    // 5. Create Login Account for Each Permitted Role
    console.log('\n--- 5. CREATING LOGIN ACCOUNTS FOR ALL PERMITTED ROLES ---');
    const rolesToTest = ['STAFF', 'TAILOR', 'CASHIER'];
    const createdUsers = [];

    for (const r of rolesToTest) {
      const email = `test_account_${r.toLowerCase()}_${Date.now()}@jbgroup.com`;
      const res = await fetch(`${BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mgrToken}` },
        body: JSON.stringify({
          name: `Test ${r} Member`,
          email,
          role: r,
          branchId: manager.branchId,
          password: 'InitialPassword2026!',
          isActive: true
        })
      });
      const data = await res.json();
      const success = res.status === 201 && Boolean(data.user?.id);
      assert(`Created account for role ${r}`, success, `ID: ${data.user?.id}, Employee: ${data.user?.employeeId}`);
      if (data.user?.id) createdUsers.push(data.user.id);
    }

    // 6. Linking Existing Login Account
    console.log('\n--- 6. LINKING EXISTING ACCOUNTS ---');
    await pool.query("DELETE FROM \"Employee\" WHERE \"employeeId\" = 'EMP-999' OR email = 'unlinked@jbgroup.com';");
    await pool.query("DELETE FROM \"User\" WHERE email = 'unlinked@jbgroup.com';");

    // Create an unlinked employee
    const newEmpRes = await pool.query(`
      INSERT INTO "Employee" ("employeeId", "name", "email", "role", "branchId", "status", "createdAt", "updatedAt")
      VALUES ('EMP-999', 'Unlinked Worker', 'unlinked@jbgroup.com', 'STAFF', $1, 'ACTIVE', NOW(), NOW())
      RETURNING *;
    `, [manager.branchId]);
    const unlinkedEmp = newEmpRes.rows[0];

    // Create an unlinked user (simulate direct creation)
    const newHashedPass = await bcrypt.hash('UnlinkedPass123!', 10);
    const unlinkedUserRes = await pool.query(`
      INSERT INTO "User" ("name", "email", "password", "role", "branchId", "isActive", "createdAt", "updatedAt")
      VALUES ('Unlinked Worker', 'unlinked@jbgroup.com', $1, 'STAFF', $2, true, NOW(), NOW())
      RETURNING *;
    `, [newHashedPass, manager.branchId]);
    const unlinkedUser = unlinkedUserRes.rows[0];
    createdUsers.push(unlinkedUser.id);

    // Link them via API
    const linkRes = await fetch(`${BASE_URL}/users/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mgrToken}` },
      body: JSON.stringify({
        userId: unlinkedUser.id,
        employeeRecordId: unlinkedEmp.id
      })
    });
    const linkData = await linkRes.json();
    assert('Authorized Manager can link existing login to employee record', linkRes.status === 200 && linkData.success, linkData.message);

    // Verify in DB
    const checkLinked = (await pool.query('SELECT "userId" FROM "Employee" WHERE id = $1;', [unlinkedEmp.id])).rows[0];
    assert('Database confirms employee linked to user account', checkLinked?.userId === unlinkedUser.id, `Linked userId: ${checkLinked?.userId}`);

    // Prevent duplicate link
    const dupLinkRes = await fetch(`${BASE_URL}/users/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mgrToken}` },
      body: JSON.stringify({
        userId: unlinkedUser.id,
        employeeRecordId: unlinkedEmp.id
      })
    });
    assert('Duplicate account linking strictly rejected (409)', dupLinkRes.status === 409);

    // 7. Password Reset by Email, Expiry & Reuse Prevention
    console.log('\n--- 7. PASSWORD RESET LIFECYCLE & SECURITY ---');
    const resetUser = createdUsers[0];
    const triggerResetRes = await fetch(`${BASE_URL}/users/${resetUser}/reset-password`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mgrToken}` }
    });
    const triggerResetData = await triggerResetRes.json();
    assert('Reset password initiated by Manager', triggerResetRes.status === 200 && triggerResetData.success);

    // Verify token exists in DB and is hashed
    const dbTokenRow = (await pool.query('SELECT * FROM "PasswordResetToken" WHERE "userId" = $1 ORDER BY id DESC LIMIT 1;', [resetUser])).rows[0];
    assert('Reset token stored ONLY as cryptographic hash (SHA-256)', Boolean(dbTokenRow && dbTokenRow.tokenHash.length === 64), `Hash: ${dbTokenRow?.tokenHash.slice(0, 16)}...`);

    // Verify resetUrl is valid
    const resetUrl = new URL(triggerResetData.resetUrl);
    const tokenParam = resetUrl.searchParams.get('resetToken');

    const verifyRes = await fetch(`${BASE_URL}/auth/verify-reset-token?token=${tokenParam}`);
    const verifyData = await verifyRes.json();
    assert('Verification endpoint confirms valid single-use token', verifyRes.status === 200 && verifyData.valid);

    // Execute reset
    const newPass = 'UpdatedSecurePass2026!';
    const execResetRes = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenParam, newPassword: newPass })
    });
    const execResetData = await execResetRes.json();
    assert('Password reset completes successfully', execResetRes.status === 200 && execResetData.success);

    // Verify token is invalidated and cannot be reused
    const reuseRes = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenParam, newPassword: 'AnotherPassword123!' })
    });
    assert('Token reuse strictly rejected (400)', reuseRes.status === 400);

    // Verify expired token rejection
    // Create an artificially expired token in DB
    const expiredRawToken = 'expired_token_test_1234567890';
    const expiredHash = require('crypto').createHash('sha256').update(expiredRawToken).digest('hex');
    await pool.query(`
      INSERT INTO "PasswordResetToken" ("userId", "tokenHash", "expiresAt", "isUsed", "requestedBy")
      VALUES ($1, $2, NOW() - INTERVAL '10 minutes', false, 'TEST');
    `, [resetUser, expiredHash]);

    const expiredVerifyRes = await fetch(`${BASE_URL}/auth/verify-reset-token?token=${expiredRawToken}`);
    assert('Expired reset token strictly rejected (400)', expiredVerifyRes.status === 400);

    // 8. Public Forgot Password Flow
    console.log('\n--- 8. PUBLIC FORGOT PASSWORD GENERIC RESPONSE ---');
    const publicForgotRes = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ceo@jbgroup.com' })
    });
    const publicForgotData = await publicForgotRes.json();
    assert('Public forgot password returns generic non-enumerating message', publicForgotRes.status === 200 && publicForgotData.message.includes('If an active account exists'));

    // Non-existent email test
    const fakeForgotRes = await fetch(`${BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent_account_xyz@nowhere.com' })
    });
    const fakeForgotData = await fakeForgotRes.json();
    assert('Non-existent email returns exact same generic message (prevents account enumeration)', fakeForgotData.message === publicForgotData.message);

    // 9. Preserving Existing Functionality (Orders, Attendance, Login)
    console.log('\n--- 9. PRESERVING EXISTING SYSTEM WORKFLOWS ---');
    // Test Orders API
    const ordersRes = await fetch(`${BASE_URL}/orders`, {
      headers: { 'Authorization': `Bearer ${ceoToken}` }
    });
    const ordersData = await ordersRes.json();
    assert('Orders API functions with zero regression', ordersRes.status === 200 && ordersData.success, `Total orders: ${ordersData.orders?.length}`);

    // Test Tailor Login & Workspace
    const tailorLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tailor.email, password: 'Pushpa@Tailor2026' })
    });
    const tailorLoginData = await tailorLoginRes.json();
    const tailorAuthOk = tailorLoginRes.status === 200 && tailorLoginData.data?.user?.role === 'TAILOR';
    assert('Existing Tailor login and credentials preserved', tailorAuthOk, `Tailor: ${tailorLoginData.data?.user?.name}`);

    // Test Attendance API
    const attendanceRes = await fetch(`${BASE_URL}/attendance/ceo-center`, {
      headers: { 'Authorization': `Bearer ${ceoToken}` }
    });
    const attendanceData = await attendanceRes.json();
    assert('Staff & CEO Attendance Center functions normally', attendanceRes.status === 200 && attendanceData.success, `Total roster: ${attendanceData.summary?.total}`);

    // Clean up temporary test accounts
    console.log('\n--- 10. CLEANING UP TEST ARTIFACTS ---');
    for (const uid of createdUsers) {
      await pool.query('DELETE FROM "PasswordResetToken" WHERE "userId" = $1;', [uid]);
      await pool.query('DELETE FROM "Employee" WHERE "userId" = $1;', [uid]);
      await pool.query('DELETE FROM "User" WHERE id = $1;', [uid]);
    }
    await pool.query('DELETE FROM "Employee" WHERE "employeeId" = \'EMP-999\';');
    console.log(`Cleaned up ${createdUsers.length} test user(s) and test employee.`);

    // FINAL SUMMARY
    console.log('\n========================================================================');
    console.log('FINAL VERIFICATION REPORT');
    console.log('========================================================================');
    const total = testResults.length;
    const passed = testResults.filter(t => t.condition).length;
    const failed = testResults.filter(t => !t.condition).length;
    console.log(`TOTAL TESTS EXECUTED : ${total}`);
    console.log(`PASSED               : ${passed}`);
    console.log(`FAILED               : ${failed}`);
    console.log('========================================================================\n');

    if (failed > 0) process.exit(1);
    process.exit(0);

  } catch (error) {
    console.error('Verification error encountered:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runVerification();
