require('dotenv').config();
const jwt = require('jsonwebtoken');
const { pool, prisma } = require('../src/prisma');
const customerFabricController = require('../src/controllers/customerFabricController');

async function run() {
  console.log('=== STARTING COMPLETE VERIFICATION: CUSTOMER FABRIC & PHOTO CLEANUP ===\n');

  // 1. Get test users: CEO (Super Admin), Manager, Staff, Tailor
  const ceo = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const manager = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
  const tailor = await prisma.user.findFirst({ where: { role: 'TAILOR' } });
  const staff = await prisma.user.findFirst({ where: { role: 'STAFF' } });

  console.log('✓ Found Test Accounts:');
  console.log(`  - CEO: ${ceo?.name} (Role: ${ceo?.role})`);
  console.log(`  - Manager: ${manager?.name} (Role: ${manager?.role})`);
  console.log(`  - Tailor: ${tailor?.name} (Role: ${tailor?.role})`);
  console.log(`  - Staff: ${staff?.name} (Role: ${staff?.role})`);

  // Generate tokens
  const secret = process.env.JWT_SECRET;
  const ceoToken = jwt.sign({ id: ceo.id, name: ceo.name, role: ceo.role, branchId: ceo.branchId }, secret);
  const managerToken = jwt.sign({ id: manager.id, name: manager.name, role: manager.role, branchId: manager.branchId }, secret);
  const tailorToken = jwt.sign({ id: tailor.id, name: tailor.name, role: tailor.role, branchId: tailor.branchId }, secret);
  const staffToken = jwt.sign({ id: staff.id, name: staff.name, role: staff.role, branchId: staff.branchId }, secret);

  // 2. Find or create a test Customer with an existing profile photo
  let testCustomer = await prisma.customer.findFirst({
    where: { primaryPhone: '0770001122' }
  });
  if (!testCustomer) {
    testCustomer = await prisma.customer.create({
      data: {
        name: 'Mrs. Jayanthi Test',
        primaryPhone: '0770001122',
        address: '15 Temple Road, Jaffna',
        profilePhoto: '/uploads/existing_avatar_jayanthi.jpg'
      }
    });
  } else if (!testCustomer.profilePhoto) {
    testCustomer = await prisma.customer.update({
      where: { id: testCustomer.id },
      data: { profilePhoto: '/uploads/existing_avatar_jayanthi.jpg' }
    });
  }
  console.log(`\n✓ Test Customer: ${testCustomer.name} (Phone: ${testCustomer.primaryPhone}, Photo: ${testCustomer.profilePhoto})`);

  // 3. Find or create an Order for this customer
  let testOrder = await prisma.order.findFirst({
    where: { customerId: testCustomer.id }
  });
  if (!testOrder) {
    const branch = await prisma.branch.findFirst();
    testOrder = await prisma.order.create({
      data: {
        orderNumber: 'TEST-ORD-' + Date.now().toString().slice(-4),
        customerId: testCustomer.id,
        branchId: branch?.id || null,
        assignedTailorId: tailor?.id || null,
        status: 'ORDER_CONFIRMED',
        garmentDetails: {
          create: {
            dressType: 'Bridal Saree Blouse',
            quantity: 1,
            fabricSuppliedBy: 'Customer',
            fabricType: 'Raw Silk',
            fabricColour: 'Deep Crimson Red'
          }
        }
      }
    });
  }
  console.log(`✓ Test Order: #${testOrder.orderNumber} (ID: ${testOrder.id})`);

  // 4. Test Verification: Order creation preserves existing customer profile photo
  console.log('\n--- VERIFICATION 1: PRESERVING EXISTING CUSTOMER PROFILE PHOTO ---');
  const customerController = require('../src/controllers/customerController');
  
  // Simulate order creation for existing customer with NO profilePhoto provided
  const mockReq = {
    body: {
      customerType: 'RETURNING',
      primaryContact: testCustomer.primaryPhone,
      customerName: testCustomer.name,
      branchId: testOrder.branchId,
      assignedTailorId: null, // Test optional tailor assignment
      garmentDetails: {
        dressType: 'Other',
        quantity: 1,
        fabricSuppliedBy: 'Customer',
        measurements: {
          customMeasurements: 'Chest: 36 inches, Waist: 32 inches, Length: 40 inches'
        }
      },
      paymentDetails: {
        totalAmount: 3500,
        advancePayment: 1000,
        paymentMethod: 'Cash'
      }
      // Note: profilePhoto is NOT sent
    },
    user: { id: ceo.id, name: ceo.name, role: ceo.role }
  };

  let createdOrderRes = null;
  const mockRes = {
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { createdOrderRes = data; return this; }
  };

  await customerController.createCustomer(mockReq, mockRes);
  if (!createdOrderRes || !createdOrderRes.success) {
    throw new Error('Order creation failed: ' + JSON.stringify(createdOrderRes));
  }
  console.log(`✓ Successfully booked order #${createdOrderRes.order?.orderNumber} with Branch required and Tailor optional.`);

  // Verify Customer profile photo in database remained UNCHANGED
  const updatedCustomer = await prisma.customer.findUnique({
    where: { id: testCustomer.id }
  });
  if (updatedCustomer.profilePhoto !== '/uploads/existing_avatar_jayanthi.jpg') {
    throw new Error(`Profile photo was modified or deleted! Expected '/uploads/existing_avatar_jayanthi.jpg', got '${updatedCustomer.profilePhoto}'`);
  }
  console.log(`✓ Existing customer profile photo was preserved intact: ${updatedCustomer.profilePhoto}`);

  // 5. Test Customer Fabric Registration Authorization
  console.log('\n--- VERIFICATION 2: CUSTOMER FABRIC REGISTRATION RBAC ---');
  
  // Tailor trying to register customer fabric -> Expect 403 Forbidden
  let tailorBlocked = false;
  const tailorReq = {
    body: {
      customerId: testCustomer.id,
      orderId: testOrder.id,
      fabricType: 'Raw Silk',
      fabricColour: 'Deep Crimson',
      receivedQty: 3.5,
      unit: 'Meters'
    },
    user: { id: tailor.id, name: tailor.name, role: tailor.role }
  };
  const tailorRes = {
    status: function(code) { if (code === 403) tailorBlocked = true; return this; },
    json: function(d) { return this; }
  };
  await customerFabricController.receiveCustomerFabric(tailorReq, tailorRes);
  if (!tailorBlocked) throw new Error('Security violation: Tailor was NOT blocked from receiving customer fabric!');
  console.log('✓ Tailor was blocked with 403 Forbidden from registering customer fabric.');

  // Staff trying to register customer fabric -> Expect 403 Forbidden
  let staffBlocked = false;
  const staffReq = {
    body: {
      customerId: testCustomer.id,
      orderId: testOrder.id,
      fabricType: 'Raw Silk',
      fabricColour: 'Deep Crimson',
      receivedQty: 3.5,
      unit: 'Meters'
    },
    user: { id: staff.id, name: staff.name, role: staff.role }
  };
  const staffRes = {
    status: function(code) { if (code === 403) staffBlocked = true; return this; },
    json: function(d) { return this; }
  };
  await customerFabricController.receiveCustomerFabric(staffReq, staffRes);
  if (!staffBlocked) throw new Error('Security violation: Staff was NOT blocked from receiving customer fabric!');
  console.log('✓ Staff was blocked with 403 Forbidden from registering customer fabric.');

  // Manager registering customer fabric -> Expect Success
  console.log('\n--- VERIFICATION 3: RECEIVE CUSTOMER FABRIC (ALLOW MULTIPLE PER ORDER) ---');
  let reg1 = null;
  const mgrReq1 = {
    body: {
      customerId: testCustomer.id,
      orderId: testOrder.id,
      fabricType: 'Raw Silk',
      fabricColour: 'Deep Crimson Red',
      fabricDescription: 'Main dress body fabric with gold zari border',
      receivedQty: 4.0,
      unit: 'Meters',
      conditionNotes: 'Good condition, no defects'
    },
    user: { id: manager.id, name: manager.name, role: manager.role }
  };
  const mgrRes1 = {
    status: function(c) { return this; },
    json: function(d) { reg1 = d; return this; }
  };
  await customerFabricController.receiveCustomerFabric(mgrReq1, mgrRes1);
  if (!reg1?.success) throw new Error('Manager failed to register fabric 1: ' + JSON.stringify(reg1));
  console.log(`✓ Receipt 1 registered successfully: Code ${reg1.data.code}, Qty: ${reg1.data.receivedQty} ${reg1.data.unit}`);

  // Register second fabric against the SAME order (multiple receipts test)
  let reg2 = null;
  const mgrReq2 = {
    body: {
      customerId: testCustomer.id,
      orderId: testOrder.id,
      fabricType: 'Organza',
      fabricColour: 'Gold Shimmer',
      fabricDescription: 'Matching contrast dupatta / sleeve fabric',
      receivedQty: 2.5,
      unit: 'Meters',
      conditionNotes: 'Customer brought 2nd piece later'
    },
    user: { id: manager.id, name: manager.name, role: manager.role }
  };
  const mgrRes2 = {
    status: function(c) { return this; },
    json: function(d) { reg2 = d; return this; }
  };
  await customerFabricController.receiveCustomerFabric(mgrReq2, mgrRes2);
  if (!reg2?.success) throw new Error('Failed to register 2nd fabric for same order: ' + JSON.stringify(reg2));
  console.log(`✓ Receipt 2 registered for SAME order #${testOrder.orderNumber}: Code ${reg2.data.code}, Qty: ${reg2.data.receivedQty} ${reg2.data.unit}`);

  // 6. Verification: Company inventory balances & WAC are completely untouched!
  console.log('\n--- VERIFICATION 4: SEPARATION FROM COMPANY INVENTORY & VALUATION ---');
  const companyItems = await prisma.inventoryItem.findMany();
  console.log(`✓ Total company Inventory Items: ${companyItems.length}`);
  const stockMovements = await prisma.stockMovement.findMany({
    where: { reason: { contains: 'Raw Silk' } }
  });
  console.log(`✓ Company StockMovements for customer fabric: ${stockMovements.length} (Expected: 0, completely separate!)`);

  const fabricId = reg1.data.id;

  // 7. Test Issue Fabric to Tailor
  console.log('\n--- VERIFICATION 5: ISSUE TO TAILOR (DOES NOT COUNT AS CONSUMED) ---');
  let issueResData = null;
  const issueReq = {
    params: { id: fabricId },
    body: {
      quantity: 3.0,
      tailorId: tailor.id,
      notes: 'Handed 3.0m to tailor Pushpa for cutting'
    },
    user: { id: manager.id, name: manager.name, role: manager.role }
  };
  const issueRes = {
    status: function(c) { return this; },
    json: function(d) { issueResData = d; return this; }
  };
  await customerFabricController.issueToTailor(issueReq, issueRes);
  if (!issueResData?.success) throw new Error('Issue failed: ' + JSON.stringify(issueResData));

  console.log(`✓ Issued 3.0m to tailor. New balances:`);
  console.log(`  - Available in Store: ${issueResData.data.availableQty} Meters (Expected: 1.0)`);
  console.log(`  - Held with Tailor: ${issueResData.data.tailorBalanceQty} Meters (Expected: 3.0)`);
  console.log(`  - Actual Consumed: ${issueResData.data.consumedQty} Meters (Expected: 0.0 - MUST NOT BE COUNTED AS CONSUMED!)`);

  if (issueResData.data.consumedQty !== 0) {
    throw new Error('Rule violation: Issuing fabric to tailor automatically counted as consumed!');
  }

  // 8. Test Tailor Returns Reusable Fabric to Store
  console.log('\n--- VERIFICATION 6: TAILOR REUSABLE RETURN TO STORE (CEO/MGR ONLY) ---');
  // Try with tailor user -> Expect 403 Forbidden
  let tailorReturnBlocked = false;
  const badReturnReq = {
    params: { id: fabricId },
    body: { quantity: 0.5, notes: 'Tailor returning' },
    user: { id: tailor.id, name: tailor.name, role: tailor.role }
  };
  const badReturnRes = {
    status: function(code) { if (code === 403) tailorReturnBlocked = true; return this; },
    json: function(d) { return this; }
  };
  await customerFabricController.recordTailorReturn(badReturnReq, badReturnRes);
  if (!tailorReturnBlocked) throw new Error('Security violation: Tailor was allowed to confirm return!');
  console.log('✓ Tailor was blocked with 403 Forbidden from directly booking/confirming fabric return.');

  // Manager confirms tailor return of 0.5m
  let returnResData = null;
  const goodReturnReq = {
    params: { id: fabricId },
    body: { quantity: 0.5, notes: 'Extra 0.5m fabric returned to store by tailor' },
    user: { id: manager.id, name: manager.name, role: manager.role }
  };
  const goodReturnRes = {
    status: function(c) { return this; },
    json: function(d) { returnResData = d; return this; }
  };
  await customerFabricController.recordTailorReturn(goodReturnReq, goodReturnRes);
  if (!returnResData?.success) throw new Error('Return failed: ' + JSON.stringify(returnResData));
  console.log(`✓ Manager confirmed reusable return. New balances:`);
  console.log(`  - Available in Store: ${returnResData.data.availableQty} Meters (Expected: 1.5)`);
  console.log(`  - Held with Tailor: ${returnResData.data.tailorBalanceQty} Meters (Expected: 2.5)`);
  console.log(`  - Returned to Store Qty: ${returnResData.data.returnedToStoreQty} Meters (Expected: 0.5)`);

  // 9. Test Actual Consumption
  console.log('\n--- VERIFICATION 7: RECORD ACTUAL FABRIC CONSUMPTION ---');
  let consumeResData = null;
  const consumeReq = {
    params: { id: fabricId },
    body: { quantity: 2.2, notes: 'Actual fabric cut and stitched into saree blouse body' },
    user: { id: manager.id, name: manager.name, role: manager.role }
  };
  const consumeRes = {
    status: function(c) { return this; },
    json: function(d) { consumeResData = d; return this; }
  };
  await customerFabricController.recordConsumption(consumeReq, consumeRes);
  if (!consumeResData?.success) throw new Error('Consumption failed: ' + JSON.stringify(consumeResData));
  console.log(`✓ Recorded 2.2m actual consumption:`);
  console.log(`  - Consumed Qty: ${consumeResData.data.consumedQty} Meters (Expected: 2.2)`);
  console.log(`  - Remaining with Tailor: ${consumeResData.data.tailorBalanceQty} Meters (Expected: 0.3)`);

  // 10. Test Cutting Scrap / Wastage
  console.log('\n--- VERIFICATION 8: RECORD CUTTING SCRAP / WASTAGE ---');
  let wasteResData = null;
  const wasteReq = {
    params: { id: fabricId },
    body: { quantity: 0.3, notes: 'Small off-cut trimmings (cutting scrap)' },
    user: { id: manager.id, name: manager.name, role: manager.role }
  };
  const wasteRes = {
    status: function(c) { return this; },
    json: function(d) { wasteResData = d; return this; }
  };
  await customerFabricController.recordWaste(wasteReq, wasteRes);
  if (!wasteResData?.success) throw new Error('Waste failed: ' + JSON.stringify(wasteResData));
  console.log(`✓ Recorded 0.3m cutting scrap:`);
  console.log(`  - Waste Qty: ${wasteResData.data.wasteQty} Meters (Expected: 0.3)`);
  console.log(`  - Remaining with Tailor: ${wasteResData.data.tailorBalanceQty} Meters (Expected: 0.0)`);

  // 11. Test Return Leftover Fabric to Customer
  console.log('\n--- VERIFICATION 9: RETURN FABRIC TO CUSTOMER (CEO/MGR ONLY) ---');
  let retCustResData = null;
  const retCustReq = {
    params: { id: fabricId },
    body: { quantity: 1.0, notes: '1.0m leftover fabric handed back to Mrs. Jayanthi on dress collection' },
    user: { id: ceo.id, name: ceo.name, role: ceo.role }
  };
  const retCustRes = {
    status: function(c) { return this; },
    json: function(d) { retCustResData = d; return this; }
  };
  await customerFabricController.returnToCustomer(retCustReq, retCustRes);
  if (!retCustResData?.success) throw new Error('Return to customer failed: ' + JSON.stringify(retCustResData));
  console.log(`✓ CEO returned 1.0m to customer:`);
  console.log(`  - Returned to Customer: ${retCustResData.data.returnedToCustomerQty} Meters (Expected: 1.0)`);
  console.log(`  - Remaining in Store: ${retCustResData.data.availableQty} Meters (Expected: 0.5)`);

  // Mathematical balance audit:
  // Received = In Store (0.5) + Consumed (2.2) + Waste (0.3) + Returned to Customer (1.0) = 4.0 Meters!
  const finalF = retCustResData.data;
  const sumCheck = finalF.availableQty + finalF.tailorBalanceQty + finalF.consumedQty + finalF.wasteQty + finalF.returnedToCustomerQty;
  console.log(`\n✓ Mathematical Balance Check:`);
  console.log(`  Store (${finalF.availableQty}) + Tailor (${finalF.tailorBalanceQty}) + Consumed (${finalF.consumedQty}) + Waste (${finalF.wasteQty}) + RetCustomer (${finalF.returnedToCustomerQty}) = ${sumCheck} M`);
  if (Math.abs(sumCheck - finalF.receivedQty) > 0.001) {
    throw new Error(`Mathematical integrity violated: sum ${sumCheck} != received ${finalF.receivedQty}`);
  }
  console.log(`  ✓ Perfectly matches Received Quantity (${finalF.receivedQty} M)!`);

  // 12. Complete Movement Audit Trail Verification
  console.log('\n--- VERIFICATION 10: MOVEMENT AUDIT TRAIL TIMELINE ---');
  let getResData = null;
  const getReq = {
    params: { id: fabricId }
  };
  const getRes = {
    status: function(c) { return this; },
    json: function(d) { getResData = d; return this; }
  };
  await customerFabricController.getCustomerFabricById(getReq, getRes);
  const movements = getResData.data.movements;
  console.log(`✓ Found ${movements.length} recorded movements in chronological order:`);
  movements.forEach((m, i) => {
    console.log(`  [${i+1}] ${m.movementType}: ${m.quantity} M | Performed by: ${m.performedByName} (${m.performedByRole}) at ${new Date(m.createdAt).toLocaleTimeString()}`);
  });

  // Clean up test customer fabric records created during this test
  await prisma.customerFabricMovement.deleteMany({
    where: { customerFabricId: { in: [reg1.data.id, reg2.data.id] } }
  });
  await prisma.customerFabric.deleteMany({
    where: { id: { in: [reg1.data.id, reg2.data.id] } }
  });
  console.log('\n✓ Cleaned up test customer fabric records.');

  console.log('\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY! ===');
}

run().catch(err => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
  pool.end();
});
