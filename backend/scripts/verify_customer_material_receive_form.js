require('dotenv').config();
const { pool, prisma } = require('../src/prisma');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 VERIFY CUSTOMER FABRIC RECEIVE FORM & PHOTO WORKFLOW');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Fetch existing test customer and order
  const order = await prisma.order.findFirst({
    where: {
      status: { notIn: ['CANCELLED', 'REJECTED'] }
    },
    include: {
      customer: true,
      branch: true
    }
  });

  if (!order || !order.customer) {
    throw new Error('No valid order or customer found in database to test.');
  }

  console.log(`\n📌 Testing with Order #${order.orderNumber} (ID: ${order.id}) and Customer ${order.customer.name} (ID: ${order.customer.id})`);

  // Find a different customer to test mismatch validation
  const otherCustomer = await prisma.customer.findFirst({
    where: {
      id: { not: order.customerId }
    }
  });

  // Users for RBAC testing
  const managerUser = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] } }
  });

  const tailorUser = await prisma.user.findFirst({
    where: { role: 'TAILOR' }
  });

  assert(!!managerUser, `Found management user for auth testing: ${managerUser?.name} (${managerUser?.role})`);

  // ===================================================================
  // TEST 1: Inventory Separation & WAC Untouched
  // ===================================================================
  console.log('\n--- 1. Testing Inventory & WAC Separation ---');
  const inventoryBefore = await pool.query(`
    SELECT 
      COUNT(*)::int AS count,
      COALESCE(SUM("currentStock"), 0) AS total_stock,
      COALESCE(SUM("currentStock" * "unitCost"), 0) AS total_valuation
    FROM "InventoryItem"
  `);
  const initialStock = parseFloat(inventoryBefore.rows[0].total_stock);
  const initialValuation = parseFloat(inventoryBefore.rows[0].total_valuation);
  console.log(`  Initial company stock: ${initialStock}, Total valuation: ${initialValuation}`);

  // ===================================================================
  // TEST 2: Validation of Customer/Order Relationship
  // ===================================================================
  console.log('\n--- 2. Testing Customer & Order Relationship Validation ---');
  const customerFabricController = require('../src/controllers/customerFabricController');

  // Helper mock req/res
  function mockReqRes(body, user) {
    return {
      req: {
        body,
        user: user || managerUser,
        headers: {},
        query: {}
      },
      res: {
        statusCode: 200,
        jsonData: null,
        status(c) { this.statusCode = c; return this; },
        json(d) { this.jsonData = d; return this; }
      }
    };
  }

  if (otherCustomer) {
    const { req: mismatchReq, res: mismatchRes } = mockReqRes({
      customerId: otherCustomer.id, // Mismatched customer!
      orderId: order.id,
      materialCategory: 'Fabric',
      materialName: 'Test Mismatch Silk',
      fabricColour: 'Red',
      receivedQty: 5,
      unit: 'Meter'
    });

    await customerFabricController.receiveCustomerFabric(mismatchReq, mismatchRes);
    assert(mismatchRes.statusCode === 400 && mismatchRes.jsonData?.message?.includes('not belong to the selected customer'),
      `Properly rejected mismatched customer/order with 400: "${mismatchRes.jsonData?.message}"`);
  }

  // ===================================================================
  // TEST 3: Validation of Required Fields & Positive Quantity
  // ===================================================================
  console.log('\n--- 3. Testing Field Validations ---');
  // Missing Material Name
  {
    const { req, res } = mockReqRes({
      customerId: order.customerId,
      orderId: order.id,
      materialCategory: 'Fabric',
      materialName: '', // Empty
      fabricColour: 'Blue',
      receivedQty: 5,
      unit: 'Meter'
    });
    await customerFabricController.receiveCustomerFabric(req, res);
    assert(res.statusCode === 400 && res.jsonData?.message?.includes('name is required'),
      `Properly rejected empty material name with 400: "${res.jsonData?.message}"`);
  }

  // Missing Colour
  {
    const { req, res } = mockReqRes({
      customerId: order.customerId,
      orderId: order.id,
      materialCategory: 'Fabric',
      materialName: 'Silk Cloth',
      fabricColour: '', // Empty
      receivedQty: 5,
      unit: 'Meter'
    });
    await customerFabricController.receiveCustomerFabric(req, res);
    assert(res.statusCode === 400 && res.jsonData?.message?.includes('Colour is required'),
      `Properly rejected empty colour with 400: "${res.jsonData?.message}"`);
  }

  // Negative / Zero Quantity
  {
    const { req, res } = mockReqRes({
      customerId: order.customerId,
      orderId: order.id,
      materialCategory: 'Fabric',
      materialName: 'Silk Cloth',
      fabricColour: 'Gold',
      receivedQty: -2.5, // Negative
      unit: 'Meter'
    });
    await customerFabricController.receiveCustomerFabric(req, res);
    assert(res.statusCode === 400 && res.jsonData?.message?.includes('positive number'),
      `Properly rejected negative quantity with 400: "${res.jsonData?.message}"`);
  }

  // ===================================================================
  // TEST 4: Register Material with Take Photo 📷
  // ===================================================================
  console.log('\n--- 4. Testing Register Material with Take Photo ---');
  const testPhotoCameraUrl = `/uploads/customer_fabric_camera_${Date.now()}.jpg`;
  const { req: cameraReq, res: cameraRes } = mockReqRes({
    branchId: order.branchId,
    customerId: order.customerId,
    orderId: order.id,
    materialCategory: 'Fabric',
    materialName: 'Pure Raw Silk Dupioni',
    fabricColour: 'Emerald Green',
    fabricDescription: 'Handloom textured weave with temple border',
    receivedQty: 4.5,
    unit: 'Meter',
    dateReceived: new Date().toISOString().split('T')[0],
    conditionOnReceipt: 'Good',
    notes: 'Customer provided matching border piece in camera shot',
    photoUrl: testPhotoCameraUrl
  });

  await customerFabricController.receiveCustomerFabric(cameraReq, cameraRes);
  const cameraFabric = cameraRes.jsonData?.data;
  assert(cameraRes.jsonData?.success === true, 'Successfully registered customer material with Take Photo');
  assert(cameraFabric?.photoUrl === testPhotoCameraUrl, `Photo URL persisted correctly: ${cameraFabric?.photoUrl}`);
  assert(cameraFabric?.materialCategory === 'Fabric', `Material Category persisted: ${cameraFabric?.materialCategory}`);
  assert(cameraFabric?.materialName === 'Pure Raw Silk Dupioni', `Material Name persisted: ${cameraFabric?.materialName}`);
  assert(cameraFabric?.conditionOnReceipt === 'Good', `Condition on Receipt persisted: ${cameraFabric?.conditionOnReceipt}`);

  // ===================================================================
  // TEST 5: Register Material with Choose from Gallery 🖼️
  // ===================================================================
  console.log('\n--- 5. Testing Register Material with Choose from Gallery ---');
  const testPhotoGalleryUrl = `/uploads/customer_buttons_gallery_${Date.now()}.png`;
  const { req: galleryReq, res: galleryRes } = mockReqRes({
    branchId: order.branchId,
    customerId: order.customerId,
    orderId: order.id,
    materialCategory: 'Buttons',
    materialName: 'Antique Brass Shank Buttons',
    fabricColour: 'Antique Brass',
    fabricDescription: 'Pack of 12 designer coat buttons',
    receivedQty: 12,
    unit: 'Piece',
    dateReceived: new Date().toISOString().split('T')[0],
    conditionOnReceipt: 'New',
    notes: 'Unopened packet brought by customer',
    photoUrl: testPhotoGalleryUrl
  });

  await customerFabricController.receiveCustomerFabric(galleryReq, galleryRes);
  const galleryMaterial = galleryRes.jsonData?.data;
  assert(galleryRes.jsonData?.success === true, 'Successfully registered customer material from Gallery');
  assert(galleryMaterial?.photoUrl === testPhotoGalleryUrl, `Photo URL persisted correctly: ${galleryMaterial?.photoUrl}`);
  assert(galleryMaterial?.materialCategory === 'Buttons', `Category persisted: ${galleryMaterial?.materialCategory}`);
  assert(galleryMaterial?.unit === 'Piece', `Unit persisted: ${galleryMaterial?.unit}`);
  assert(galleryMaterial?.conditionOnReceipt === 'New', `Condition persisted: ${galleryMaterial?.conditionOnReceipt}`);

  // ===================================================================
  // TEST 6: Verify Persistence on Re-Fetch (GET /:id and List)
  // ===================================================================
  console.log('\n--- 6. Testing Record Persistence & Re-fetching ---');
  const { req: getReq, res: getRes } = mockReqRes({}, managerUser);
  getReq.params = { id: cameraFabric.id };
  await customerFabricController.getCustomerFabricById(getReq, getRes);

  const fetchedRecord = getRes.jsonData?.data;
  assert(fetchedRecord?.id === cameraFabric.id, 'Fetched single customer fabric record by ID');
  assert(fetchedRecord?.photoUrl === testPhotoCameraUrl, `Photo remains available on re-fetch: ${fetchedRecord?.photoUrl}`);
  assert(fetchedRecord?.materialName === 'Pure Raw Silk Dupioni', `Material Name intact: ${fetchedRecord?.materialName}`);
  assert(fetchedRecord?.materialCategory === 'Fabric', `Material Category intact: ${fetchedRecord?.materialCategory}`);
  assert(fetchedRecord?.conditionOnReceipt === 'Good', `Condition on Receipt intact: ${fetchedRecord?.conditionOnReceipt}`);

  // ===================================================================
  // TEST 7: Role Restrictions on Registration
  // ===================================================================
  console.log('\n--- 7. Testing RBAC Restrictions ---');
  if (tailorUser) {
    const { req: tailorReq, res: tailorRes } = mockReqRes({
      customerId: order.customerId,
      orderId: order.id,
      materialCategory: 'Fabric',
      materialName: 'Tailor Unauthorized Fabric',
      fabricColour: 'Black',
      receivedQty: 3,
      unit: 'Meter'
    }, tailorUser);
    await customerFabricController.receiveCustomerFabric(tailorReq, tailorRes);
    assert(tailorRes.statusCode === 403 && tailorRes.jsonData?.message?.includes('Access denied'),
      `Correctly rejected TAILOR role with 403: "${tailorRes.jsonData?.message}"`);
  }

  // ===================================================================
  // TEST 8: Verify Company Inventory and WAC Unchanged (Delta = 0)
  // ===================================================================
  console.log('\n--- 8. Verifying Zero Impact on Company Inventory & WAC ---');
  const inventoryAfter = await pool.query(`
    SELECT 
      COUNT(*)::int AS count,
      COALESCE(SUM("currentStock"), 0) AS total_stock,
      COALESCE(SUM("currentStock" * "unitCost"), 0) AS total_valuation
    FROM "InventoryItem"
  `);
  const finalStock = parseFloat(inventoryAfter.rows[0].total_stock);
  const finalValuation = parseFloat(inventoryAfter.rows[0].total_valuation);

  assert(finalStock === initialStock, `Company stock delta is 0 (Before: ${initialStock}, After: ${finalStock})`);
  assert(finalValuation === initialValuation, `Company valuation delta is 0 (Before: ${initialValuation}, After: ${finalValuation})`);

  // Clean up test records
  console.log('\n--- Cleaning up test records ---');
  await pool.query('DELETE FROM "CustomerFabricMovement" WHERE "customerFabricId" IN ($1, $2)', [cameraFabric.id, galleryMaterial.id]);
  await pool.query('DELETE FROM "CustomerFabric" WHERE id IN ($1, $2)', [cameraFabric.id, galleryMaterial.id]);
  console.log('  Cleaned up test customer fabric rows.');

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
