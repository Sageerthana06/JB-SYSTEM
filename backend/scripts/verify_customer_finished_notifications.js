const { prisma, pool } = require('../src/prisma');
const orderController = require('../src/controllers/orderController');

// Helper to create mock Express req & res
function createMockReqRes({ user, params = {}, body = {} }) {
  const req = {
    user,
    params,
    body,
    headers: {},
    socket: { remoteAddress: '127.0.0.1' }
  };

  let statusCode = 200;
  let jsonData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonData = data;
      return this;
    },
    get statusCode() {
      return statusCode;
    },
    get jsonData() {
      return jsonData;
    }
  };

  const next = (err) => {
    if (err) {
      statusCode = 500;
      jsonData = { success: false, error: err.message };
    }
  };

  return { req, res, next };
}

async function runTests() {
  console.log('====================================================');
  console.log('VERIFYING MANAGER CONTROLS CUSTOMER FINISHED NOTIFICATION');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`✗ FAIL: ${message}`);
    }
  }

  try {
    // Setup test customer
    let testCustomer = await prisma.customer.findFirst({
      where: { primaryPhone: '0771234567' }
    });

    if (!testCustomer) {
      testCustomer = await prisma.customer.create({
        data: {
          name: 'Kasun Perera',
          primaryPhone: '0771234567',
          email: 'kasun.test@jbgroup.lk',
          address: 'Colombo 03'
        }
      });
    }

    // Setup tailor user and manager user
    let tailorUser = await prisma.user.findFirst({
      where: { role: 'TAILOR' }
    });
    if (!tailorUser) {
      tailorUser = await prisma.user.create({
        data: {
          name: 'Master Tailor Nimal',
          email: 'tailor.nimal@jbgroup.lk',
          password: 'hashedpassword',
          role: 'TAILOR'
        }
      });
    }

    let managerUser = await prisma.user.findFirst({
      where: { role: 'MANAGER' }
    });
    if (!managerUser) {
      managerUser = await prisma.user.create({
        data: {
          name: 'Manager Kamal',
          email: 'manager.kamal@jbgroup.lk',
          password: 'hashedpassword',
          role: 'MANAGER'
        }
      });
    }

    let staffUser = await prisma.user.findFirst({
      where: { role: 'STAFF' }
    });
    if (!staffUser) {
      staffUser = await prisma.user.create({
        data: {
          name: 'Floor Staff Sunita',
          email: 'staff.sunita@jbgroup.lk',
          password: 'hashedpassword',
          role: 'STAFF'
        }
      });
    }

    // Test 1: Tailor marks an order Ready -> NO customer Finished/Ready message is automatically sent!
    console.log('\n--- Test 1: Tailor marks order READY (No automatic customer notification) ---');
    const order1 = await prisma.order.create({
      data: {
        orderNumber: `TEST-ORD-${Date.now()}-1`,
        customerId: testCustomer.id,
        status: 'QUALITY_CHECK',
        totalAmount: 15000,
        advancePayment: 5000,
        balanceAmount: 10000,
        assignedTailorId: tailorUser.id,
        readyNotificationSent: false
      }
    });

    const { req: tReq, res: tRes, next: tNext } = createMockReqRes({
      user: tailorUser,
      params: { id: String(order1.id) },
      body: { status: 'READY', notes: 'Tailoring finished, passed quality check.' }
    });

    await orderController.updateOrderStatus(tReq, tRes, tNext);

    assert(tRes.statusCode === 200, 'updateOrderStatus returns HTTP 200 for Tailor');
    assert(tRes.jsonData?.order?.status === 'READY', 'Order status updated to READY');
    
    // Check DB record
    const updatedOrder1InDb = await prisma.order.findUnique({ where: { id: order1.id } });
    assert(
      updatedOrder1InDb.status === 'READY',
      'Database status is READY'
    );
    assert(
      updatedOrder1InDb.readyNotificationSent === false || updatedOrder1InDb.readyNotificationSent === null,
      'readyNotificationSent remains false/null when tailor updates to READY (No automatic customer message!)'
    );
    assert(
      !updatedOrder1InDb.readyNotificationSentAt,
      'readyNotificationSentAt is not set'
    );
    assert(
      !tRes.jsonData?.notification?.sent,
      'Response does NOT trigger automatic notification delivery'
    );

    // Test 2: Unauthorized roles cannot invoke send-message API directly
    console.log('\n--- Test 2: Unauthorized roles cannot invoke notifyOrderReady API ---');
    const { req: unauthReq, res: unauthRes, next: unauthNext } = createMockReqRes({
      user: tailorUser, // Tailor role
      params: { id: String(order1.id) },
      body: {}
    });

    await orderController.notifyOrderReady(unauthReq, unauthRes, unauthNext);
    assert(
      unauthRes.statusCode === 403,
      `Tailor calling notifyOrderReady receives HTTP 403 Forbidden (Got: ${unauthRes.statusCode})`
    );
    assert(
      unauthRes.jsonData?.success === false,
      'Tailor calling notifyOrderReady returns success: false'
    );

    const { req: staffReq, res: staffRes, next: staffNext } = createMockReqRes({
      user: staffUser, // Staff role
      params: { id: String(order1.id) },
      body: {}
    });
    await orderController.notifyOrderReady(staffReq, staffRes, staffNext);
    assert(
      staffRes.statusCode === 403,
      `Staff calling notifyOrderReady receives HTTP 403 Forbidden (Got: ${staffRes.statusCode})`
    );

    // Test 3: Cannot send finished notification before final completion & quality-check (Status !== READY)
    console.log('\n--- Test 3: Order not ready for collection (Status !== READY) ---');
    const orderNotReady = await prisma.order.create({
      data: {
        orderNumber: `TEST-ORD-${Date.now()}-2`,
        customerId: testCustomer.id,
        status: 'STITCHING',
        totalAmount: 12000,
        advancePayment: 4000,
        balanceAmount: 8000
      }
    });

    const { req: notReadyReq, res: notReadyRes, next: notReadyNext } = createMockReqRes({
      user: managerUser,
      params: { id: String(orderNotReady.id) },
      body: {}
    });

    await orderController.notifyOrderReady(notReadyReq, notReadyRes, notReadyNext);
    assert(
      notReadyRes.statusCode === 400,
      `Cannot send notification for STITCHING stage order (Got HTTP 400: "${notReadyRes.jsonData?.message}")`
    );

    // Test 4: Cannot send notification if customer phone is missing or invalid
    console.log('\n--- Test 4: Customer phone validation ---');
    const customerNoPhone = await prisma.customer.create({
      data: {
        name: 'No Phone Customer',
        primaryPhone: 'invalid', // invalid phone
        email: `nophone.${Date.now()}@test.lk`
      }
    });

    const orderNoPhone = await prisma.order.create({
      data: {
        orderNumber: `TEST-ORD-${Date.now()}-3`,
        customerId: customerNoPhone.id,
        status: 'READY',
        totalAmount: 10000
      }
    });

    const { req: invPhoneReq, res: invPhoneRes, next: invPhoneNext } = createMockReqRes({
      user: managerUser,
      params: { id: String(orderNoPhone.id) },
      body: {}
    });

    await orderController.notifyOrderReady(invPhoneReq, invPhoneRes, invPhoneNext);
    assert(
      invPhoneRes.statusCode === 400,
      `Invalid customer phone rejected with HTTP 400 (Got: "${invPhoneRes.jsonData?.message}")`
    );

    // Test 5: Manager explicitly confirms -> Customer Finished Message sent successfully
    console.log('\n--- Test 5: Manager confirms and sends Customer Finished Notification ---');
    const { req: mgrReq, res: mgrRes, next: mgrNext } = createMockReqRes({
      user: managerUser,
      params: { id: String(order1.id) },
      body: {}
    });

    await orderController.notifyOrderReady(mgrReq, mgrRes, mgrNext);
    assert(
      mgrRes.statusCode === 200,
      `Manager confirmation returns HTTP 200 (Got: ${mgrRes.statusCode})`
    );
    assert(
      mgrRes.jsonData?.success === true,
      'Response has success: true'
    );
    assert(
      mgrRes.jsonData?.customerName === 'Kasun Perera',
      `Customer name in preview: "${mgrRes.jsonData?.customerName}"`
    );
    assert(
      mgrRes.jsonData?.phone === '0771234567',
      `Customer phone in preview: "${mgrRes.jsonData?.phone}"`
    );
    assert(
      mgrRes.jsonData?.orderNumber === order1.orderNumber,
      `Order number in preview: "${mgrRes.jsonData?.orderNumber}"`
    );
    assert(
      mgrRes.jsonData?.whatsAppMessage.includes('ready for collection'),
      'Approved message text formatted correctly'
    );
    assert(
      Boolean(mgrRes.jsonData?.sentBy),
      `Sent by recorded as: "${mgrRes.jsonData?.sentBy}"`
    );

    // Verify DB update
    const orderAfterMgr = await prisma.order.findUnique({ where: { id: order1.id } });
    assert(
      orderAfterMgr.readyNotificationSent === true,
      'Order in DB updated with readyNotificationSent = true'
    );
    assert(
      Boolean(orderAfterMgr.readyNotificationSentAt),
      `Order in DB has readyNotificationSentAt timestamp: ${orderAfterMgr.readyNotificationSentAt}`
    );
    assert(
      Boolean(orderAfterMgr.readyNotificationSentBy),
      `Order in DB has readyNotificationSentBy: "${orderAfterMgr.readyNotificationSentBy}"`
    );

    // Verify AuditLog
    const auditResult = await pool.query(`
      SELECT * FROM "AuditLog" 
      WHERE "action" = 'CUSTOMER_FINISHED_NOTIFICATION_SENT' AND "entityId" = $1
      ORDER BY "createdAt" DESC LIMIT 1
    `, [order1.id]);

    assert(
      auditResult.rows.length > 0,
      'Audit log entry created in "AuditLog" table'
    );
    if (auditResult.rows.length > 0) {
      const row = auditResult.rows[0];
      assert(row.action === 'CUSTOMER_FINISHED_NOTIFICATION_SENT', 'Audit log action is CUSTOMER_FINISHED_NOTIFICATION_SENT');
      assert(row.userName === managerUser.name || row.userName === managerUser.email, `Audit log userName recorded: "${row.userName}"`);
    }

    // Test 6: Repeated clicks prevent duplicate messages
    console.log('\n--- Test 6: Repeated clicks prevent duplicate notifications ---');
    const { req: dupReq, res: dupRes, next: dupNext } = createMockReqRes({
      user: managerUser,
      params: { id: String(order1.id) },
      body: { force: false }
    });

    await orderController.notifyOrderReady(dupReq, dupRes, dupNext);
    assert(
      dupRes.statusCode === 409,
      `Repeated click returns HTTP 409 Conflict (Duplicate prevented)`
    );
    assert(
      dupRes.jsonData?.duplicatePrevented === true,
      'Response indicates duplicatePrevented: true'
    );

    // Test 7: Resend with explicit force=true allows resend
    console.log('\n--- Test 7: Manager explicit resend (force: true) ---');
    const { req: resendReq, res: resendRes, next: resendNext } = createMockReqRes({
      user: managerUser,
      params: { id: String(order1.id) },
      body: { force: true }
    });

    await orderController.notifyOrderReady(resendReq, resendRes, resendNext);
    assert(
      resendRes.statusCode === 200,
      `Explicit resend with force: true returns HTTP 200`
    );

    // Clean up test orders created for this test run
    await prisma.productionHistory.deleteMany({
      where: { orderId: { in: [order1.id, orderNotReady.id, orderNoPhone.id] } }
    });
    await prisma.order.deleteMany({
      where: { id: { in: [order1.id, orderNotReady.id, orderNoPhone.id] } }
    });
    await prisma.customer.delete({
      where: { id: customerNoPhone.id }
    });

    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
    console.log('====================================================');

    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (err) {
    console.error('Test execution failed with exception:', err);
    process.exit(1);
  }
}

runTests();
