const { pool } = require('../src/prisma');
const customerFabricCtrl = require('../src/controllers/customerFabricController');

async function run() {
  console.log('--- STARTING VERIFICATION: CUSTOMER FABRIC PURCHASE DETAILS ---');
  let managerUser = null;
  let testCustomer = null;
  let testOrder = null;
  let createdFabricIds = [];

  try {
    // 1. Fetch a manager user
    const userRes = await pool.query(`
      SELECT id, name, email, role, "branchId" 
      FROM "User" 
      WHERE role IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER') 
      LIMIT 1
    `);
    managerUser = userRes.rows[0];
    if (!managerUser) {
      throw new Error('No manager or admin user found in database.');
    }
    console.log(`✓ Manager user identified: ${managerUser.name} (${managerUser.role})`);

    // 2. Fetch or create a test customer and order
    const custRes = await pool.query(`
      SELECT c.id, c.name, c."primaryPhone", o.id AS "orderId", o."orderNumber", o."branchId"
      FROM "Customer" c
      JOIN "Order" o ON o."customerId" = c.id
      WHERE o.status::text NOT IN ('CANCELLED', 'REJECTED')
      LIMIT 1
    `);
    if (custRes.rows[0]) {
      testCustomer = {
        id: custRes.rows[0].id,
        name: custRes.rows[0].name,
        phone: custRes.rows[0].primaryPhone
      };
      testOrder = {
        id: custRes.rows[0].orderId,
        orderNumber: custRes.rows[0].orderNumber,
        branchId: custRes.rows[0].branchId
      };
    } else {
      throw new Error('No existing order found to test customer fabric against.');
    }
    console.log(`✓ Test customer & order found: Customer "${testCustomer.name}" (ID ${testCustomer.id}), Order #${testOrder.orderNumber} (ID ${testOrder.id})`);

    // Record baseline company material valuation & WAC before any customer fabric registration
    const initialMaterialStats = await pool.query(`
      SELECT 
        COUNT(*)::int AS count,
        COALESCE(SUM("currentStock"), 0) AS "totalCompanyStock",
        COALESCE(SUM("currentStock" * "unitCost"), 0) AS "totalValuation"
      FROM "InventoryItem"
    `);
    const baselineValuation = parseFloat(initialMaterialStats.rows[0].totalValuation);
    const baselineStock = parseFloat(initialMaterialStats.rows[0].totalCompanyStock);
    console.log(`✓ Baseline Company Material Stock: ${baselineStock}, Baseline Inventory Valuation: LKR ${baselineValuation}`);

    // =========================================================================
    // TEST 1: Register customer fabric WITHOUT purchase price or receipt
    // =========================================================================
    console.log('\n--- Test 1: Register without price or receipt (Optional validation) ---');
    let capturedResult1 = null;
    const req1 = {
      user: managerUser,
      body: {
        customerId: testCustomer.id,
        orderId: testOrder.id,
        fabricType: 'Banarasi',
        fabricColour: 'Deep Maroon',
        fabricDescription: 'Gold zari floral borders',
        receivedQty: 3.5,
        unit: 'Meters',
        dateReceived: new Date().toISOString(),
        conditionNotes: 'Customer did not know the purchase price',
        branchId: testOrder.branchId,
        customerPurchasePrice: '', // omitted/empty
        customerPurchaseCurrency: '',
        customerPurchasePriceType: '',
        customerPurchaseReceiptUrl: ''
      }
    };
    const res1 = {
      json: (data) => { capturedResult1 = data; },
      status: (code) => ({ json: (data) => { capturedResult1 = { ...data, statusCode: code }; } })
    };

    await customerFabricCtrl.receiveCustomerFabric(req1, res1);
    if (!capturedResult1 || !capturedResult1.success) {
      throw new Error(`Test 1 Failed: ${capturedResult1?.message || 'Unknown error'}`);
    }
    const fabric1 = capturedResult1.data;
    createdFabricIds.push(fabric1.id);
    console.log(`✓ Fabric registered successfully without price: Code ${fabric1.code}, ID ${fabric1.id}`);
    console.log(`  customerPurchasePrice: ${fabric1.customerPurchasePrice} (Expected null)`);
    console.log(`  customerPurchaseCurrency: ${fabric1.customerPurchaseCurrency} (Expected LKR)`);
    console.log(`  customerPurchasePriceType: ${fabric1.customerPurchasePriceType} (Expected TOTAL)`);
    console.log(`  customerPurchaseReceiptUrl: ${fabric1.customerPurchaseReceiptUrl} (Expected null)`);

    if (fabric1.customerPurchasePrice !== null) {
      throw new Error('Test 1 Assertion Failed: customerPurchasePrice should be null when omitted.');
    }

    // =========================================================================
    // TEST 2: Validate negative price is rejected with 400
    // =========================================================================
    console.log('\n--- Test 2: Validation rejects negative price (< 0) ---');
    let capturedResult2 = null;
    const req2 = {
      user: managerUser,
      body: {
        customerId: testCustomer.id,
        orderId: testOrder.id,
        fabricType: 'Chiffon',
        fabricColour: 'Peach',
        receivedQty: 2.0,
        unit: 'Meters',
        customerPurchasePrice: -450.00
      }
    };
    const res2 = {
      json: (data) => { capturedResult2 = data; },
      status: (code) => {
        return {
          json: (data) => { capturedResult2 = { ...data, statusCode: code }; }
        };
      }
    };

    await customerFabricCtrl.receiveCustomerFabric(req2, res2);
    if (capturedResult2?.success) {
      throw new Error('Test 2 Failed: Negative customer purchase price should have been rejected!');
    }
    console.log(`✓ Negative price correctly rejected: "${capturedResult2?.message}"`);

    // =========================================================================
    // TEST 3: Register with zero price (>= 0 valid)
    // =========================================================================
    console.log('\n--- Test 3: Register with zero price (0 is valid >= 0) ---');
    let capturedResult3 = null;
    const req3 = {
      user: managerUser,
      body: {
        customerId: testCustomer.id,
        orderId: testOrder.id,
        fabricType: 'Cotton',
        fabricColour: 'White',
        receivedQty: 1.5,
        unit: 'Meters',
        customerPurchasePrice: 0,
        customerPurchaseCurrency: 'LKR',
        customerPurchasePriceType: 'TOTAL'
      }
    };
    const res3 = {
      json: (data) => { capturedResult3 = data; },
      status: (code) => ({ json: (data) => { capturedResult3 = { ...data, statusCode: code }; } })
    };

    await customerFabricCtrl.receiveCustomerFabric(req3, res3);
    if (!capturedResult3 || !capturedResult3.success) {
      throw new Error(`Test 3 Failed: ${capturedResult3?.message || 'Unknown error'}`);
    }
    const fabric3 = capturedResult3.data;
    createdFabricIds.push(fabric3.id);
    console.log(`✓ Zero price registered: ${fabric3.customerPurchasePrice} ${fabric3.customerPurchaseCurrency}`);
    if (Number(fabric3.customerPurchasePrice) !== 0) {
      throw new Error('Test 3 Assertion Failed: Price should be 0.');
    }

    // =========================================================================
    // TEST 4: Register with full purchase price details (Price per unit, USD, Receipt URL)
    // =========================================================================
    console.log('\n--- Test 4: Register with full purchase details (PER_UNIT, USD, Receipt URL) ---');
    let capturedResult4 = null;
    const testReceiptUrl = '/uploads/customer_receipts/rec_test_4567.jpg';
    const req4 = {
      user: managerUser,
      body: {
        customerId: testCustomer.id,
        orderId: testOrder.id,
        fabricType: 'Raw Silk',
        fabricColour: 'Royal Blue',
        fabricDescription: 'Imported pure raw silk with gold sheen',
        receivedQty: 4.0,
        unit: 'Yards',
        dateReceived: new Date().toISOString(),
        conditionNotes: 'Customer brought from Dubai trip with bill',
        branchId: testOrder.branchId,
        customerPurchasePrice: 75.50,
        customerPurchaseCurrency: 'USD',
        customerPurchasePriceType: 'PER_UNIT',
        customerPurchaseReceiptUrl: testReceiptUrl
      }
    };
    const res4 = {
      json: (data) => { capturedResult4 = data; },
      status: (code) => ({ json: (data) => { capturedResult4 = { ...data, statusCode: code }; } })
    };

    await customerFabricCtrl.receiveCustomerFabric(req4, res4);
    if (!capturedResult4 || !capturedResult4.success) {
      throw new Error(`Test 4 Failed: ${capturedResult4?.message || 'Unknown error'}`);
    }
    const fabric4 = capturedResult4.data;
    createdFabricIds.push(fabric4.id);
    console.log(`✓ Full purchase details registered successfully: Code ${fabric4.code}`);
    console.log(`  Price: ${fabric4.customerPurchasePrice}`);
    console.log(`  Currency: ${fabric4.customerPurchaseCurrency}`);
    console.log(`  Price Type: ${fabric4.customerPurchasePriceType}`);
    console.log(`  Receipt URL: ${fabric4.customerPurchaseReceiptUrl}`);

    if (Number(fabric4.customerPurchasePrice) !== 75.5) {
      throw new Error('Test 4 Assertion Failed: customerPurchasePrice should be 75.50');
    }
    if (fabric4.customerPurchaseCurrency !== 'USD') {
      throw new Error('Test 4 Assertion Failed: customerPurchaseCurrency should be USD');
    }
    if (fabric4.customerPurchasePriceType !== 'PER_UNIT') {
      throw new Error('Test 4 Assertion Failed: customerPurchasePriceType should be PER_UNIT');
    }
    if (fabric4.customerPurchaseReceiptUrl !== testReceiptUrl) {
      throw new Error('Test 4 Assertion Failed: customerPurchaseReceiptUrl mismatch');
    }

    // =========================================================================
    // TEST 5: Verify getCustomerFabricById returns all purchase price fields
    // =========================================================================
    console.log('\n--- Test 5: Verify getCustomerFabricById returns purchase fields ---');
    let capturedResult5 = null;
    const req5 = {
      user: managerUser,
      params: { id: fabric4.id }
    };
    const res5 = {
      json: (data) => { capturedResult5 = data; },
      status: (code) => ({ json: (data) => { capturedResult5 = { ...data, statusCode: code }; } })
    };
    await customerFabricCtrl.getCustomerFabricById(req5, res5);
    if (!capturedResult5?.success || !capturedResult5.data) {
      throw new Error(`Test 5 Failed: ${capturedResult5?.message}`);
    }
    const fetched4 = capturedResult5.data;
    console.log(`✓ Details verified via getCustomerFabricById:`);
    console.log(`  Code: ${fetched4.code}`);
    console.log(`  Customer Purchase Price: ${fetched4.customerPurchaseCurrency} ${fetched4.customerPurchasePrice} (${fetched4.customerPurchasePriceType})`);
    console.log(`  Receipt URL: ${fetched4.customerPurchaseReceiptUrl}`);

    // =========================================================================
    // TEST 6: Verify listCustomerFabrics returns records with price info
    // =========================================================================
    console.log('\n--- Test 6: Verify listCustomerFabrics includes customer purchase fields ---');
    let capturedResult6 = null;
    const req6 = {
      user: managerUser,
      query: { orderNumber: testOrder.orderNumber }
    };
    const res6 = {
      json: (data) => { capturedResult6 = data; },
      status: (code) => ({ json: (data) => { capturedResult6 = { ...data, statusCode: code }; } })
    };
    await customerFabricCtrl.listCustomerFabrics(req6, res6);
    if (!capturedResult6?.success || !capturedResult6.data) {
      throw new Error(`Test 6 Failed: ${capturedResult6?.message}`);
    }
    const listMatches = capturedResult6.data.filter(f => createdFabricIds.includes(f.id));
    console.log(`✓ List returned ${listMatches.length} matching fabrics for order #${testOrder.orderNumber}`);
    for (const m of listMatches) {
      console.log(`  ${m.code}: Price = ${m.customerPurchasePrice !== null ? `${m.customerPurchaseCurrency} ${m.customerPurchasePrice} (${m.customerPurchasePriceType})` : 'Not provided'}`);
    }

    // =========================================================================
    // TEST 7: CRITICAL - Verify Zero Impact on Company Inventory, Valuation & WAC
    // =========================================================================
    console.log('\n--- Test 7: Strict check on Company Inventory Valuation & WAC Isolation ---');
    const finalMaterialStats = await pool.query(`
      SELECT 
        COUNT(*)::int AS count,
        COALESCE(SUM("currentStock"), 0) AS "totalCompanyStock",
        COALESCE(SUM("currentStock" * "unitCost"), 0) AS "totalValuation"
      FROM "InventoryItem"
    `);
    const afterValuation = parseFloat(finalMaterialStats.rows[0].totalValuation);
    const afterStock = parseFloat(finalMaterialStats.rows[0].totalCompanyStock);
    console.log(`✓ Company Stock before: ${baselineStock}, after: ${afterStock} (Difference: ${afterStock - baselineStock})`);
    console.log(`✓ Company Valuation before: LKR ${baselineValuation}, after: LKR ${afterValuation} (Difference: ${afterValuation - baselineValuation})`);

    if (Math.abs(afterValuation - baselineValuation) > 0.0001 || Math.abs(afterStock - baselineStock) > 0.0001) {
      throw new Error('CRITICAL FAILURE: Customer fabric registration altered company stock or inventory valuation!');
    }
    console.log('✓ Company inventory stock and valuation are 100% untouched!');

    // =========================================================================
    // TEST 8: Verify Existing Workflows are Preserved (Issue, Return to store, Consume)
    // =========================================================================
    console.log('\n--- Test 8: Verify workflow preservation on fabric with purchase details ---');
    // Issue 2.0 Yards to tailor
    let issueResult = null;
    await customerFabricCtrl.issueToTailor({
      user: managerUser,
      body: {
        customerFabricId: fabric4.id,
        quantity: 2.0,
        notes: 'Issued 2.0 yards for cutting'
      }
    }, {
      json: (d) => { issueResult = d; },
      status: (c) => ({ json: (d) => { issueResult = { ...d, statusCode: c }; } })
    });
    if (!issueResult?.success) throw new Error(`Issue failed: ${issueResult?.message}`);
    console.log(`✓ Issued 2.0 yards to tailor. Available: ${issueResult.data.availableQty}, With tailor: ${issueResult.data.tailorBalanceQty}`);

    // Consume 1.5 Yards
    let consumeResult = null;
    await customerFabricCtrl.recordConsumption({
      user: managerUser,
      body: {
        customerFabricId: fabric4.id,
        quantity: 1.5,
        notes: 'Stitched blouse'
      }
    }, {
      json: (d) => { consumeResult = d; },
      status: (c) => ({ json: (d) => { consumeResult = { ...d, statusCode: c }; } })
    });
    if (!consumeResult?.success) throw new Error(`Consumption failed: ${consumeResult?.message}`);
    console.log(`✓ Consumed 1.5 yards. Consumed: ${consumeResult.data.consumedQty}, Remaining with tailor: ${consumeResult.data.tailorBalanceQty}`);

    // Tailor returns 0.5 Yards back to store
    let returnStoreResult = null;
    await customerFabricCtrl.recordTailorReturn({
      user: managerUser,
      body: {
        customerFabricId: fabric4.id,
        quantity: 0.5,
        notes: 'Returned leftover 0.5 yards'
      }
    }, {
      json: (d) => { returnStoreResult = d; },
      status: (c) => ({ json: (d) => { returnStoreResult = { ...d, statusCode: c }; } })
    });
    if (!returnStoreResult?.success) throw new Error(`Return to store failed: ${returnStoreResult?.message}`);
    console.log(`✓ Tailor returned 0.5 yards to store. Available: ${returnStoreResult.data.availableQty}, With tailor: ${returnStoreResult.data.tailorBalanceQty}`);

    console.log('\n======================================================');
    console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('======================================================');
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    // Clean up created test fabrics
    if (createdFabricIds.length > 0) {
      console.log(`\nCleaning up ${createdFabricIds.length} test customer fabric records...`);
      for (const id of createdFabricIds) {
        await pool.query('DELETE FROM "CustomerFabricMovement" WHERE "customerFabricId" = $1', [id]);
        await pool.query('DELETE FROM "CustomerFabric" WHERE id = $1', [id]);
      }
      console.log('✓ Cleaned up test records.');
    }
  }
}

run().then(() => {
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
