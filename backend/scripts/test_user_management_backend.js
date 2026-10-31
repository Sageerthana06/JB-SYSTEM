require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:5000/api';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const results = [];
function record(name, pass, details = '') {
  results.push({ name, pass, details });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} ${details ? '— ' + details : ''}`);
}

async function run() {
  console.log('===========================================================');
  console.log('TESTING JB GROUP USER & LOGIN MANAGEMENT BACKEND');
  console.log('===========================================================\n');

  try {
    // Generate valid tokens for each role
    const ceoUser = (await pool.query("SELECT * FROM \"User\" WHERE role = 'SUPER_ADMIN' LIMIT 1;")).rows[0];
    const mgrUser = (await pool.query("SELECT * FROM \"User\" WHERE role = 'MANAGER' LIMIT 1;")).rows[0];
    const staffUser = (await pool.query("SELECT * FROM \"User\" WHERE role = 'STAFF' LIMIT 1;")).rows[0];
    const tailorUser = (await pool.query("SELECT * FROM \"User\" WHERE role = 'TAILOR' LIMIT 1;")).rows[0];
    const cashierUser = (await pool.query("SELECT * FROM \"User\" WHERE role = 'CASHIER' LIMIT 1;")).rows[0];

    const makeToken = (u) => jwt.sign(
      { id: u.id, name: u.name, email: u.email, role: u.role, branchId: u.branchId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const ceoToken = makeToken(ceoUser);
    const mgrToken = makeToken(mgrUser);
    const staffToken = makeToken(staffUser);
    const tailorToken = makeToken(tailorUser);
    const cashierToken = makeToken(cashierUser);

    // TEST 1: CEO Dashboard / Users List Access
    console.log('--- 1. CEO ACCESS & CROSS-BRANCH VISIBILITY ---');
    const ceoListRes = await fetch(`${BASE_URL}/users`, {
      headers: { 'Authorization': `Bearer ${ceoToken}` }
    });
    const ceoListData = await ceoListRes.json();
    record('CEO Users List Access', ceoListRes.status === 200 && ceoListData.success, `Found ${ceoListData.users?.length} users/employees`);

    // Verify CEO can see users with Employee IDs and login status
    const hasEmpIds = ceoListData.users?.every(u => Boolean(u.employeeId));
    record('All accounts have Employee IDs', hasEmpIds, `Sample: ${ceoListData.users?.[0]?.employeeId}`);

    // TEST 2: MANAGER BRANCH RESTRICTION & ACCESS
    console.log('\n--- 2. MANAGER BRANCH RESTRICTIONS ---');
    const mgrListRes = await fetch(`${BASE_URL}/users`, {
      headers: { 'Authorization': `Bearer ${mgrToken}` }
    });
    const mgrListData = await mgrListRes.json();
    record('Manager Users List Access', mgrListRes.status === 200 && mgrListData.success, `Found ${mgrListData.users?.length} users in branch ${mgrUser.branchId}`);

    // Verify all returned users belong to Manager's branch
    const allInMgrBranch = mgrListData.users?.every(u => !u.branchId || u.branchId === mgrUser.branchId);
    record('Manager only sees accounts in authorized branch', allInMgrBranch, `Manager branch: ${mgrUser.branchId}`);

    // TEST 3: MANAGER PRIVILEGE ESCALATION PREVENTION
    console.log('\n--- 3. MANAGER PRIVILEGE ESCALATION PREVENTION ---');
    // Attempt A: Manager trying to create a SUPER_ADMIN account
    const mgrCreateCeoRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mgrToken}` },
      body: JSON.stringify({
        name: 'Hacker CEO',
        email: 'fake_ceo_attempt@jbgroup.com',
        role: 'SUPER_ADMIN',
        branchId: mgrUser.branchId,
        password: 'Password123!'
      })
    });
    record('Manager denied creating SUPER_ADMIN account', mgrCreateCeoRes.status === 403, `Status: ${mgrCreateCeoRes.status}`);

    // Attempt B: Manager trying to create an account in another branch (Branch 2)
    const mgrCreateOtherBranchRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mgrToken}` },
      body: JSON.stringify({
        name: 'Branch 2 Tailor',
        email: 'b2_tailor_test@jbgroup.com',
        role: 'TAILOR',
        branchId: 999, // Unauthorized branch
        password: 'Password123!'
      })
    });
    record('Manager denied creating user in unauthorized branch', mgrCreateOtherBranchRes.status === 403, `Status: ${mgrCreateOtherBranchRes.status}`);

    // Attempt C: Manager trying to reset CEO's password
    const mgrResetCeoRes = await fetch(`${BASE_URL}/users/${ceoUser.id}/reset-password`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mgrToken}` }
    });
    record('Manager denied resetting CEO password', mgrResetCeoRes.status === 403, `Status: ${mgrResetCeoRes.status}`);

    // TEST 4: ACCESS DENIAL FOR STAFF, TAILOR, AND CASHIER
    console.log('\n--- 4. STRICT ACCESS DENIAL FOR STAFF, TAILOR, CASHIER ---');
    const staffAccessRes = await fetch(`${BASE_URL}/users`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    record('Staff denied access to User Management APIs (403)', staffAccessRes.status === 403, `Status: ${staffAccessRes.status}`);

    const tailorAccessRes = await fetch(`${BASE_URL}/users`, {
      headers: { 'Authorization': `Bearer ${tailorToken}` }
    });
    record('Tailor denied access to User Management APIs (403)', tailorAccessRes.status === 403, `Status: ${tailorAccessRes.status}`);

    const cashierAccessRes = await fetch(`${BASE_URL}/users`, {
      headers: { 'Authorization': `Bearer ${cashierToken}` }
    });
    record('Cashier denied access to User Management APIs (403)', cashierAccessRes.status === 403, `Status: ${cashierAccessRes.status}`);

    // TEST 5: ACCOUNT CREATION FOR PERMITTED ROLE
    console.log('\n--- 5. ACCOUNT CREATION FOR PERMITTED ROLES ---');
    const testEmail = `test_staff_${Date.now()}@jbgroup.com`;
    const createStaffRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mgrToken}` },
      body: JSON.stringify({
        name: 'Automated Test Staff',
        email: testEmail,
        role: 'STAFF',
        branchId: mgrUser.branchId,
        password: 'StaffPassword2026!',
        isActive: true
      })
    });
    const createStaffData = await createStaffRes.json();
    const createdUserId = createStaffData.user?.id;
    record('Manager can create eligible STAFF account in branch', createStaffRes.status === 201 && Boolean(createdUserId), `Created User #${createdUserId} (${createStaffData.user?.employeeId})`);

    // Verify employee record exists and is linked
    const empInDb = (await pool.query('SELECT * FROM "Employee" WHERE "userId" = $1;', [createdUserId])).rows[0];
    record('Employee record created and linked with unique Employee ID', Boolean(empInDb && empInDb.employeeId.startsWith('EMP-')), `Employee ID: ${empInDb?.employeeId}`);

    // TEST 6: PASSWORD RESET FLOW
    console.log('\n--- 6. PASSWORD RESET FLOW & TOKEN SECURITY ---');
    const resetTriggerRes = await fetch(`${BASE_URL}/users/${createdUserId}/reset-password`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mgrToken}` }
    });
    const resetTriggerData = await resetTriggerRes.json();
    record('Manager can initiate password reset for eligible account', resetTriggerRes.status === 200 && resetTriggerData.success, `Message: ${resetTriggerData.message}`);

    // Verify token is hashed in DB and not plain text
    const tokenDbRow = (await pool.query('SELECT * FROM "PasswordResetToken" WHERE "userId" = $1 ORDER BY id DESC LIMIT 1;', [createdUserId])).rows[0];
    record('Reset token stored ONLY as cryptographic hash (SHA-256)', Boolean(tokenDbRow && tokenDbRow.tokenHash.length === 64), `Hash length: ${tokenDbRow?.tokenHash.length}`);

    // Extract token from resetUrl
    const urlObj = new URL(resetTriggerData.resetUrl);
    const rawToken = urlObj.searchParams.get('resetToken');

    // Verify token validity endpoint
    const verifyTokenRes = await fetch(`${BASE_URL}/auth/verify-reset-token?token=${rawToken}`);
    const verifyTokenData = await verifyTokenRes.json();
    record('Reset token verification passes for unexpired token', verifyTokenRes.status === 200 && verifyTokenData.valid, `User: ${verifyTokenData.user?.email}`);

    // Complete password reset
    const newPass = 'BrandNewSecurePass2026!';
    const completeResetRes = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken, newPassword: newPass })
    });
    const completeResetData = await completeResetRes.json();
    record('Password reset successfully completed', completeResetRes.status === 200 && completeResetData.success, `Response: ${completeResetData.message}`);

    // Test token reuse prevention
    const reuseTokenRes = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken, newPassword: 'AnotherPassword!' })
    });
    record('Token reuse strictly rejected (single-use constraint)', reuseTokenRes.status === 400, `Status: ${reuseTokenRes.status}`);

    // Test login with new password
    const testNewLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: newPass })
    });
    const testNewLoginData = await testNewLoginRes.json();
    record('Login succeeds with newly reset password', testNewLoginRes.status === 200 && Boolean(testNewLoginData.data?.token), `User: ${testNewLoginData.data?.user?.name}`);

    // TEST 7: ACTIVATION & DEACTIVATION
    console.log('\n--- 7. ACTIVATION & DEACTIVATION ---');
    // Deactivate account
    const deactRes = await fetch(`${BASE_URL}/users/${createdUserId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mgrToken}` },
      body: JSON.stringify({ isActive: false })
    });
    const deactData = await deactRes.json();
    record('Account deactivation succeeds (soft-deactivation)', deactRes.status === 200 && deactData.isActive === false, `Active: ${deactData.isActive}`);

    // Verify login is blocked when deactivated
    const deactLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: newPass })
    });
    record('Deactivated account login blocked (403)', deactLoginRes.status === 403, `Status: ${deactLoginRes.status}`);

    // Re-activate account
    const reactRes = await fetch(`${BASE_URL}/users/${createdUserId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mgrToken}` },
      body: JSON.stringify({ isActive: true })
    });
    const reactData = await reactRes.json();
    record('Account reactivation succeeds', reactRes.status === 200 && reactData.isActive === true, `Active: ${reactData.isActive}`);

    // Prevent self-deactivation
    const selfDeactRes = await fetch(`${BASE_URL}/users/${ceoUser.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ceoToken}` },
      body: JSON.stringify({ isActive: false })
    });
    record('Self-deactivation strictly prevented', selfDeactRes.status === 400, `Status: ${selfDeactRes.status}`);

    // TEST 8: AUDIT LOG VERIFICATION
    console.log('\n--- 8. AUDIT LOG INTEGRITY ---');
    const auditLogs = await pool.query('SELECT action, "entityType", "entityId", "userName", details FROM "AuditLog" ORDER BY id DESC LIMIT 5;');
    record('Audit events properly recorded in database', auditLogs.rows.length > 0, `Recent actions: ${auditLogs.rows.map(r => r.action).join(', ')}`);

    // Clean up test account created during test
    await pool.query('DELETE FROM "PasswordResetToken" WHERE "userId" = $1;', [createdUserId]);
    await pool.query('DELETE FROM "Employee" WHERE "userId" = $1;', [createdUserId]);
    await pool.query('DELETE FROM "User" WHERE id = $1;', [createdUserId]);
    console.log(`\n(Cleaned up temporary test user #${createdUserId})`);

    // SUMMARY
    console.log('\n===========================================================');
    console.log('BACKEND VERIFICATION SUMMARY');
    console.log('===========================================================');
    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    console.log('===========================================================\n');

    if (failed > 0) process.exit(1);
    process.exit(0);

  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
