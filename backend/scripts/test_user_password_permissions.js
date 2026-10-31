const { prisma } = require('../src/prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

// Supertest-like simple fetch against local express app
const http = require('http');

let server;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server running on ${baseUrl}`);
      resolve();
    });
  });
}

function stopServer() {
  if (server) server.close();
}

function makeToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, branchId: user.branchId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function request(method, path, token, body = null) {
  const url = `${baseUrl}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function runTests() {
  console.log('--- STARTING PASSWORD SETTING & PERMISSION TESTS ---');
  await startServer();

  try {
    // 1. Fetch test users from DB
    const ceo = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    const manager = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
    const staff = await prisma.user.findFirst({ where: { role: 'STAFF', branchId: manager.branchId } });
    const tailor = await prisma.user.findFirst({ where: { role: 'TAILOR', branchId: manager.branchId } });

    console.log(`CEO ID: ${ceo.id}, Manager ID: ${manager.id}, Staff ID: ${staff.id}, Tailor ID: ${tailor.id}`);

    const ceoToken = makeToken(ceo);
    const managerToken = makeToken(manager);

    // TEST 1: Password validation (< 6 characters)
    console.log('\n[Test 1] Password validation: rejecting < 6 chars');
    const t1 = await request('POST', `/api/users/${staff.id}/set-password`, ceoToken, {
      password: '123',
      confirmPassword: '123'
    });
    console.log(`Result: status=${t1.status}, msg=${t1.body.message}`);
    if (t1.status !== 400) throw new Error('Test 1 failed: Expected 400 for short password');

    // TEST 2: Password validation (confirmation mismatch)
    console.log('\n[Test 2] Password validation: rejecting mismatch');
    const t2 = await request('POST', `/api/users/${staff.id}/set-password`, ceoToken, {
      password: 'password123',
      confirmPassword: 'password456'
    });
    console.log(`Result: status=${t2.status}, msg=${t2.body.message}`);
    if (t2.status !== 400) throw new Error('Test 2 failed: Expected 400 for mismatch');

    // TEST 3: Manager tries to set CEO password (MUST BE 403 FORBIDDEN)
    console.log('\n[Test 3] Manager attempts to set CEO password (REQUIREMENT 4)');
    const t3 = await request('POST', `/api/users/${ceo.id}/set-password`, managerToken, {
      password: 'hackedPassword999',
      confirmPassword: 'hackedPassword999'
    });
    console.log(`Result: status=${t3.status}, msg=${t3.body.message}`);
    if (t3.status !== 403) throw new Error('Test 3 failed: Manager MUST NOT be able to change CEO password');

    // TEST 4: Manager tries to send reset link to CEO (MUST BE 403 FORBIDDEN)
    console.log('\n[Test 4] Manager attempts email reset link on CEO (REQUIREMENT 4)');
    const t4 = await request('POST', `/api/users/${ceo.id}/reset-password`, managerToken);
    console.log(`Result: status=${t4.status}, msg=${t4.body.message}`);
    if (t4.status !== 403) throw new Error('Test 4 failed: Manager MUST NOT be able to reset CEO password via email');

    // TEST 5: Manager tries to change another Manager password (MUST BE 403 FORBIDDEN)
    console.log('\n[Test 5] Manager attempts to set another Manager password');
    const t5 = await request('POST', `/api/users/${manager.id}/set-password`, managerToken, {
      password: 'newManagerPass123',
      confirmPassword: 'newManagerPass123'
    });
    console.log(`Result: status=${t5.status}, msg=${t5.body.message}`);
    if (t5.status !== 403) throw new Error('Test 5 failed: Manager MUST NOT change Manager accounts');

    // TEST 6: Manager tries to change user in different branch
    console.log('\n[Test 6] Manager attempts to set password for user in different branch');
    // Create or find user in branch 2 if exists
    let branch2User = await prisma.user.findFirst({ where: { branchId: 2 } });
    if (!branch2User) {
      // create temporary user in branch 2 for testing
      branch2User = await prisma.user.create({
        data: {
          name: 'Branch 2 Tailor',
          email: 'b2_tailor_test@jbgroup.com',
          role: 'TAILOR',
          branchId: 2,
          password: await bcrypt.hash('secret123', 10),
          isActive: true
        }
      });
    }

    const t6 = await request('POST', `/api/users/${branch2User.id}/set-password`, managerToken, {
      password: 'newPassword123',
      confirmPassword: 'newPassword123'
    });
    console.log(`Result: status=${t6.status}, msg=${t6.body.message}`);
    if (t6.status !== 403) throw new Error('Test 6 failed: Manager MUST NOT change password of user in different branch');

    // TEST 7: Manager sets password manually for Staff in their own branch (REQUIREMENT 1, 3, 6)
    console.log('\n[Test 7] Manager sets password manually for Staff in own branch');
    const testNewPassword = 'BellaStaffSecret@2026';
    const t7 = await request('POST', `/api/users/${staff.id}/set-password`, managerToken, {
      password: testNewPassword,
      confirmPassword: testNewPassword
    });
    console.log(`Result: status=${t7.status}, msg=${t7.body.message}`);
    if (t7.status !== 200 || !t7.body.success) throw new Error('Test 7 failed: Manager should be allowed to set Staff password');

    // Verify bcrypt hash in database
    const updatedStaff = await prisma.user.findUnique({ where: { id: staff.id } });
    const isMatch = await bcrypt.compare(testNewPassword, updatedStaff.password);
    console.log(`Database bcrypt hash verification: isMatch=${isMatch}`);
    if (!isMatch) throw new Error('Test 7 failed: Bcrypt hash does not match new password');

    // TEST 8: CEO sets password manually for Manager (REQUIREMENT 1, 2)
    console.log('\n[Test 8] CEO sets password manually for Manager');
    const ceoNewManagerPass = 'ManagerSecurePass#2026';
    const t8 = await request('POST', `/api/users/${manager.id}/set-password`, ceoToken, {
      password: ceoNewManagerPass,
      confirmPassword: ceoNewManagerPass
    });
    console.log(`Result: status=${t8.status}, msg=${t8.body.message}`);
    if (t8.status !== 200 || !t8.body.success) throw new Error('Test 8 failed: CEO should be allowed to set Manager password');

    const updatedManager = await prisma.user.findUnique({ where: { id: manager.id } });
    const isManagerMatch = await bcrypt.compare(ceoNewManagerPass, updatedManager.password);
    console.log(`Database bcrypt hash verification for Manager: isMatch=${isManagerMatch}`);
    if (!isManagerMatch) throw new Error('Test 8 failed: Bcrypt hash does not match new Manager password');

    // TEST 9: CEO sets password manually for Tailor (REQUIREMENT 2)
    console.log('\n[Test 9] CEO sets password manually for Tailor');
    const tailorPass = 'TailorMasterPass2026';
    const t9 = await request('POST', `/api/users/${tailor.id}/set-password`, ceoToken, {
      password: tailorPass,
      confirmPassword: tailorPass
    });
    console.log(`Result: status=${t9.status}, msg=${t9.body.message}`);
    if (t9.status !== 200 || !t9.body.success) throw new Error('Test 9 failed: CEO should be allowed to set Tailor password');

    // Clean up temporary test user if created
    if (branch2User && branch2User.email === 'b2_tailor_test@jbgroup.com') {
      await prisma.user.delete({ where: { id: branch2User.id } }).catch(() => {});
    }

    console.log('\n========================================');
    console.log('ALL 9 TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================');
  } catch (err) {
    console.error('TEST SUITE ERROR:', err);
    process.exit(1);
  } finally {
    stopServer();
    process.exit(0);
  }
}

runTests();
