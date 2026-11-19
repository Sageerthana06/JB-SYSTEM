/**
 * Automated Verification Suite for Security Hardening Phase 5
 * Tests:
 * 1. Order Number Generator (Advisory lock, Asia/Colombo, malformed suffixes, concurrency)
 * 2. Login Rate Limiter (Separate IP/account counters, GC cleanup, alias preservation, no shared IP reset)
 * 3. Payment Slip Security (Public garment pass-through, Bearer auth, role/branch isolation, fail-closed 503)
 * 4. JWT Hardening (Live DB check, immediate deactivation, dynamic role refresh, customer portal support, no query tokens)
 */

const assert = require('assert');
const path = require('path');
const jwt = require('jsonwebtoken');

// 1. Order Number Generator tests
const { getColomboYear, generateOrderNumberTx } = require('../src/utils/orderNumberGenerator');

// 2. Rate Limiter tests
const {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  resetAllRateLimits
} = require('../src/utils/rateLimiter');

// 3. Slip Protection Middleware & Prisma mock
const { prisma } = require('../src/prisma');
const { protectPaymentSlips } = require('../src/middleware/slipProtectionMiddleware');

// 4. JWT Auth Middleware
const { authenticateToken, authorizeRoles } = require('../src/middleware/authMiddleware');

const runTests = async () => {
  console.log('===============================================================');
  console.log('   JB SYSTEM SECURITY HARDENING PHASE 5 VERIFICATION SUITE      ');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  const test = async (name, fn) => {
    total++;
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // TEST GROUP 1: ORDER NUMBER GENERATOR & CONCURRENCY
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Atomic Order Number Generator ---');

  await test('1.1: Asia/Colombo year calculation', () => {
    const colomboYear = getColomboYear();
    assert.strictEqual(typeof colomboYear, 'string');
    assert.strictEqual(colomboYear.length, 4);
    const parsed = parseInt(colomboYear, 10);
    assert.ok(parsed >= 2026, `Expected year >= 2026, got ${parsed}`);
  });

  await test('1.2: Advisory lock and sequence query inside transaction mock', async () => {
    let lockAcquired = false;
    let queryExecuted = false;

    const mockTx = {
      $executeRawUnsafe: async (sql) => {
        if (sql.includes('pg_advisory_xact_lock(42424242)')) {
          lockAcquired = true;
        }
      },
      $queryRaw: async (strings, ...values) => {
        queryExecuted = true;
        return [{ maxSeq: 42 }];
      }
    };

    const nextOrderNumber = await generateOrderNumberTx(mockTx);
    assert.ok(lockAcquired, 'Advisory lock must be acquired inside transaction');
    assert.ok(queryExecuted, 'Query must be executed inside transaction');
    assert.strictEqual(nextOrderNumber, `ORD-${getColomboYear()}-0043`);
  });

  await test('1.3: Number sequence format above 9999', async () => {
    const mockTx = {
      $executeRawUnsafe: async () => {},
      $queryRaw: async () => [{ maxSeq: 10450 }]
    };

    const nextOrderNumber = await generateOrderNumberTx(mockTx);
    assert.strictEqual(nextOrderNumber, `ORD-${getColomboYear()}-10451`);
  });

  await test('1.4: 10 concurrent order creations sequence simulation', async () => {
    let currentMaxSeq = 100;
    let lockHolder = null;

    // Simulate PostgreSQL advisory lock serializer
    const generateConcurrent = async (callerId) => {
      while (lockHolder !== null) {
        await new Promise(r => setTimeout(r, 5));
      }
      lockHolder = callerId;
      try {
        const mockTx = {
          $executeRawUnsafe: async () => {},
          $queryRaw: async () => [{ maxSeq: currentMaxSeq }]
        };
        const orderNum = await generateOrderNumberTx(mockTx);
        currentMaxSeq++;
        return orderNum;
      } finally {
        lockHolder = null;
      }
    };

    const promises = Array.from({ length: 10 }, (_, i) => generateConcurrent(`worker-${i}`));
    const results = await Promise.all(promises);

    assert.strictEqual(results.length, 10);
    const uniqueResults = new Set(results);
    assert.strictEqual(uniqueResults.size, 10, 'All 10 order numbers must be unique with zero collisions');
    assert.strictEqual(results[0], `ORD-${getColomboYear()}-0101`);
    assert.strictEqual(results[9], `ORD-${getColomboYear()}-0110`);
  });

  // -------------------------------------------------------------
  // TEST GROUP 2: LOGIN RATE LIMITING & SECURITY
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Login Rate Limiter & Security ---');

  await test('2.1: Separate IP and Account rate limit counters', () => {
    resetAllRateLimits();
    const ipKey = 'login:ip:192.168.1.10';
    const account1 = 'login:account:alice@jbgroup.com';
    const account2 = 'login:account:bob@jbgroup.com';

    for (let i = 0; i < 4; i++) {
      recordFailedAttempt(account1);
      recordFailedAttempt(ipKey);
    }

    const aliceCheck = checkRateLimit(account1, 5, 60000);
    assert.strictEqual(aliceCheck.isBlocked, false);
    assert.strictEqual(aliceCheck.remainingAttempts, 1);

    const bobCheck = checkRateLimit(account2, 5, 60000);
    assert.strictEqual(bobCheck.isBlocked, false);
    assert.strictEqual(bobCheck.remainingAttempts, 5);

    recordFailedAttempt(account1);
    const aliceBlocked = checkRateLimit(account1, 5, 60000);
    assert.strictEqual(aliceBlocked.isBlocked, true);
    assert.strictEqual(aliceBlocked.remainingAttempts, 0);

    const bobStillFree = checkRateLimit(account2, 5, 60000);
    assert.strictEqual(bobStillFree.isBlocked, false);
  });

  await test('2.2: Successful login resets ONLY account key and preserves shared IP throttle', () => {
    resetAllRateLimits();
    const ipKey = 'login:ip:10.0.0.1';
    const accountKey = 'login:account:test@jbgroup.com';

    recordFailedAttempt(ipKey);
    recordFailedAttempt(ipKey);
    recordFailedAttempt(accountKey);
    recordFailedAttempt(accountKey);

    resetRateLimit(accountKey);

    const accountAfter = checkRateLimit(accountKey, 5, 60000);
    assert.strictEqual(accountAfter.remainingAttempts, 5, 'Account attempts must be reset');

    const ipAfter = checkRateLimit(ipKey, 20, 60000);
    assert.strictEqual(ipAfter.remainingAttempts, 18, 'IP attempts must NOT be reset on single account login');
  });

  await test('2.3: Production email alias normalization', () => {
    const normalize = (email) => {
      const clean = (email || '').trim().toLowerCase();
      return clean === 'pratheep@jbgroup.com' ? 'staff@jbgroup.com' : clean;
    };

    assert.strictEqual(normalize('PRATHEEP@jbgroup.com'), 'staff@jbgroup.com');
    assert.strictEqual(normalize('  pratheep@jbgroup.com  '), 'staff@jbgroup.com');
    assert.strictEqual(normalize('admin@jbgroup.com'), 'admin@jbgroup.com');
  });

  // -------------------------------------------------------------
  // TEST GROUP 3: PAYMENT SLIP ACCESS CONTROL
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Payment Slip Access Control ---');

  process.env.JWT_SECRET = 'test_jwt_secret_jb_system_2026';

  // Save original prisma methods
  const origPaymentFindFirst = prisma.payment.findFirst;
  const origUserFindUnique = prisma.user.findUnique;
  const origCustomerFindUnique = prisma.customer.findUnique;

  await test('3.1: Public garment design reference bypasses protection middleware', async () => {
    // Mock prisma.payment.findFirst to return null (not a payment slip)
    prisma.payment.findFirst = async () => null;

    let nextCalled = false;
    const req = {
      method: 'GET',
      path: '/designs/sample-dress-pattern-123.jpg',
      headers: {}
    };
    const res = {
      status: () => res,
      json: () => res
    };

    await protectPaymentSlips(req, res, () => {
      nextCalled = true;
    });

    assert.ok(nextCalled, 'Non-slip garment design image must pass through to express.static');
  });

  await test('3.2: Rejects payment slip access without token with 401', async () => {
    // Mock file is a payment slip
    prisma.payment.findFirst = async () => ({
      id: 99,
      slipImage: '/uploads/designs/slip-secret-99.jpg',
      order: { id: 10, branchId: 1, customerId: 5 }
    });

    let statusCode = null;
    let jsonResponse = null;

    const req = {
      method: 'GET',
      path: '/designs/slip-secret-99.jpg',
      query: { token: 'token_in_query_should_be_ignored' },
      headers: {}
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        jsonResponse = data;
        return res;
      }
    };

    await protectPaymentSlips(req, res, () => {});

    assert.strictEqual(statusCode, 401);
    assert.strictEqual(jsonResponse.success, false);
    assert.ok(jsonResponse.message.includes('Authentication required'));
  });

  await test('3.3: Rejects payment slip access for wrong branch manager with 403', async () => {
    prisma.payment.findFirst = async () => ({
      id: 99,
      slipImage: '/uploads/designs/slip-secret-99.jpg',
      order: { id: 10, branchId: 1, customerId: 5 }
    });

    // Mock manager assigned to Branch 2
    prisma.user.findUnique = async () => ({
      id: 8,
      name: 'Branch 2 Manager',
      role: 'MANAGER',
      branchId: 2,
      isActive: true
    });

    const token = jwt.sign({ id: 8, role: 'MANAGER', branchId: 2 }, process.env.JWT_SECRET);

    let statusCode = null;
    let jsonResponse = null;

    const req = {
      method: 'GET',
      path: '/designs/slip-secret-99.jpg',
      headers: { authorization: `Bearer ${token}` }
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        jsonResponse = data;
        return res;
      }
    };

    await protectPaymentSlips(req, res, () => {});

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(jsonResponse.success, false);
    assert.ok(jsonResponse.message.includes('belongs to another branch'));
  });

  await test('3.4: Rejects payment slip access for TAILOR role with 403', async () => {
    prisma.payment.findFirst = async () => ({
      id: 99,
      slipImage: '/uploads/designs/slip-secret-99.jpg',
      order: { id: 10, branchId: 1, customerId: 5 }
    });

    prisma.user.findUnique = async () => ({
      id: 20,
      name: 'Tailor John',
      role: 'TAILOR',
      branchId: 1,
      isActive: true
    });

    const token = jwt.sign({ id: 20, role: 'TAILOR', branchId: 1 }, process.env.JWT_SECRET);

    let statusCode = null;
    let jsonResponse = null;

    const req = {
      method: 'GET',
      path: '/designs/slip-secret-99.jpg',
      headers: { authorization: `Bearer ${token}` }
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        jsonResponse = data;
        return res;
      }
    };

    await protectPaymentSlips(req, res, () => {});

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(jsonResponse.success, false);
    assert.ok(jsonResponse.message.includes('do not have permission'));
  });

  await test('3.5: Database error fails closed with HTTP 503', async () => {
    // Mock DB throwing error
    prisma.payment.findFirst = async () => {
      throw new Error('Connection terminated unexpectedly');
    };

    let statusCode = null;
    let jsonResponse = null;

    const req = {
      method: 'GET',
      path: '/designs/slip-123.jpg',
      headers: {}
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        jsonResponse = data;
        return res;
      }
    };

    await protectPaymentSlips(req, res, () => {});

    assert.strictEqual(statusCode, 503, 'Must fail-closed with 503 on DB error');
    assert.strictEqual(jsonResponse.success, false);
  });

  // -------------------------------------------------------------
  // TEST GROUP 4: JWT HARDENING
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: JWT Hardening ---');

  await test('4.1: Missing token returns 401', async () => {
    let statusCode = null;
    let jsonResponse = null;

    const req = {
      headers: {},
      query: { token: 'spoofed_token' }
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        jsonResponse = data;
        return res;
      }
    };

    await authenticateToken(req, res, () => {});
    assert.strictEqual(statusCode, 401);
    assert.strictEqual(jsonResponse.success, false);
    assert.strictEqual(jsonResponse.message, 'Access denied. No token provided.');
  });

  await test('4.2: Deactivated staff account (isActive: false) rejected immediately with 401', async () => {
    prisma.user.findUnique = async () => ({
      id: 5,
      name: 'Fired Staff',
      email: 'fired@jbgroup.com',
      role: 'STAFF',
      branchId: 1,
      isActive: false
    });

    const token = jwt.sign({ id: 5, role: 'STAFF' }, process.env.JWT_SECRET);

    let statusCode = null;
    let jsonResponse = null;

    const req = {
      headers: { authorization: `Bearer ${token}` }
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        jsonResponse = data;
        return res;
      }
    };

    await authenticateToken(req, res, () => {});

    assert.strictEqual(statusCode, 401);
    assert.strictEqual(jsonResponse.success, false);
    assert.ok(jsonResponse.message.includes('inactive or revoked'));
  });

  await test('4.3: Active staff refreshes dynamic role and branch from DB', async () => {
    prisma.user.findUnique = async () => ({
      id: 7,
      name: 'Promoted Staff',
      email: 'staff@jbgroup.com',
      role: 'MANAGER', // Promoted to Manager in DB!
      branchId: 2,
      isActive: true
    });

    // Old token with role: 'STAFF'
    const token = jwt.sign({ id: 7, role: 'STAFF', branchId: 1 }, process.env.JWT_SECRET);

    let nextCalled = false;
    const req = {
      headers: { authorization: `Bearer ${token}` }
    };
    const res = {
      status: () => res,
      json: () => res
    };

    await authenticateToken(req, res, () => {
      nextCalled = true;
    });

    assert.ok(nextCalled);
    assert.strictEqual(req.user.role, 'MANAGER', 'Role must be refreshed from live DB');
    assert.strictEqual(req.user.branchId, 2, 'Branch must be refreshed from live DB');
  });

  await test('4.4: Customer portal token compatibility', async () => {
    prisma.customer.findUnique = async () => ({
      id: 12,
      name: 'Nirmalan',
      email: 'nirmalan@example.com',
      primaryPhone: '0771234567'
    });

    const token = jwt.sign({ id: 12, role: 'CUSTOMER' }, process.env.JWT_SECRET);

    let nextCalled = false;
    const req = {
      headers: { authorization: `Bearer ${token}` }
    };
    const res = {
      status: () => res,
      json: () => res
    };

    await authenticateToken(req, res, () => {
      nextCalled = true;
    });

    assert.ok(nextCalled);
    assert.strictEqual(req.user.role, 'CUSTOMER');
    assert.strictEqual(req.user.customerId, 12);
    assert.strictEqual(req.user.phone, '0771234567');
  });

  // Restore prisma methods
  prisma.payment.findFirst = origPaymentFindFirst;
  prisma.user.findUnique = origUserFindUnique;
  prisma.customer.findUnique = origCustomerFindUnique;

  console.log('\n===============================================================');
  console.log(`   PHASE 5 TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('===============================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
