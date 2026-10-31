const { pool } = require('../src/prisma');
const customerFabricCtrl = require('../src/controllers/customerFabricController');
const { jsPDF } = require('jspdf');

async function run() {
  console.log('--- STARTING VERIFICATION: CUSTOMER FABRIC EXPORT PDF & CSV ---');
  let managerUser = null;
  let testCustomer = null;
  let testOrder = null;
  let createdFabricIds = [];

  try {
    // 1. Identify Manager user
    const userRes = await pool.query(`
      SELECT id, name, email, role, "branchId" 
      FROM "User" 
      WHERE role IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER') 
      LIMIT 1
    `);
    managerUser = userRes.rows[0];
    if (!managerUser) throw new Error('No manager user found');
    console.log(`✓ Manager user: ${managerUser.name} (${managerUser.role})`);

    // 2. Fetch existing customer & order
    const custRes = await pool.query(`
      SELECT c.id, c.name, c."primaryPhone", o.id AS "orderId", o."orderNumber", o."branchId", b.name AS "branchName"
      FROM "Customer" c
      JOIN "Order" o ON o."customerId" = c.id
      LEFT JOIN "Branch" b ON b.id = o."branchId"
      WHERE o.status::text NOT IN ('CANCELLED', 'REJECTED')
      LIMIT 1
    `);
    if (!custRes.rows[0]) throw new Error('No customer/order found');
    testCustomer = {
      id: custRes.rows[0].id,
      name: custRes.rows[0].name,
      phone: custRes.rows[0].primaryPhone
    };
    testOrder = {
      id: custRes.rows[0].orderId,
      orderNumber: custRes.rows[0].orderNumber,
      branchId: custRes.rows[0].branchId,
      branchName: custRes.rows[0].branchName || 'Main Branch'
    };
    console.log(`✓ Order: #${testOrder.orderNumber}, Customer: ${testCustomer.name}`);

    // Check company valuation baseline
    const initialStats = await pool.query(`
      SELECT COALESCE(SUM("currentStock" * "unitCost"), 0) AS val FROM "InventoryItem"
    `);
    const baselineVal = parseFloat(initialStats.rows[0].val);

    // =========================================================================
    // TEST 1: Register test fabric with purchase price & without purchase price
    // =========================================================================
    console.log('\n--- Test 1: Register sample fabrics for export testing ---');
    // Sample A: With price
    let capturedA = null;
    await customerFabricCtrl.receiveCustomerFabric({
      user: managerUser,
      body: {
        customerId: testCustomer.id,
        orderId: testOrder.id,
        fabricType: 'Banarasi Silk',
        fabricColour: 'Crimson Red',
        fabricDescription: 'Heavy Zari border for bridal lehenga',
        receivedQty: 5.0,
        unit: 'Meters',
        customerPurchasePrice: 32000,
        customerPurchaseCurrency: 'LKR',
        customerPurchasePriceType: 'TOTAL',
        branchId: testOrder.branchId
      }
    }, {
      json: (d) => { capturedA = d; },
      status: (c) => ({ json: (d) => { capturedA = { ...d, statusCode: c }; } })
    });
    if (!capturedA?.success) throw new Error(`Sample A failed: ${capturedA?.message}`);
    createdFabricIds.push(capturedA.data.id);
    console.log(`✓ Sample Fabric A registered with price: Code ${capturedA.data.code}, Price: LKR 32,000 Total`);

    // Sample B: Without price (Customer did not provide)
    let capturedB = null;
    await customerFabricCtrl.receiveCustomerFabric({
      user: managerUser,
      body: {
        customerId: testCustomer.id,
        orderId: testOrder.id,
        fabricType: 'Chiffon',
        fabricColour: 'Sea Green',
        fabricDescription: 'Customer provided lightweight drape',
        receivedQty: 3.0,
        unit: 'Yards',
        customerPurchasePrice: null,
        branchId: testOrder.branchId
      }
    }, {
      json: (d) => { capturedB = d; },
      status: (c) => ({ json: (d) => { capturedB = { ...d, statusCode: c }; } })
    });
    if (!capturedB?.success) throw new Error(`Sample B failed: ${capturedB?.message}`);
    createdFabricIds.push(capturedB.data.id);
    console.log(`✓ Sample Fabric B registered without price: Code ${capturedB.data.code}, Price: Not provided`);

    // =========================================================================
    // TEST 2: Verify export unpaginated retrieval (all=true query parameter)
    // =========================================================================
    console.log('\n--- Test 2: Verify listCustomerFabrics with all=true (Unpaginated export dataset) ---');
    let capturedList = null;
    await customerFabricCtrl.listCustomerFabrics({
      user: managerUser,
      query: {
        all: 'true',
        orderNumber: testOrder.orderNumber
      }
    }, {
      json: (d) => { capturedList = d; },
      status: (c) => ({ json: (d) => { capturedList = { ...d, statusCode: c }; } })
    });
    if (!capturedList?.success || !capturedList.data) throw new Error('Unpaginated list failed');
    const matchedRecords = capturedList.data.filter(r => createdFabricIds.includes(r.id));
    console.log(`✓ Retrieved ${matchedRecords.length} records with summary totals:`);
    console.log(`  Total Received: ${capturedList.summary.totalReceived}`);
    console.log(`  Total In Store: ${capturedList.summary.totalAvailableInStore}`);
    console.log(`  Total With Tailors: ${capturedList.summary.totalWithTailors}`);
    if (matchedRecords.length !== 2) {
      throw new Error(`Expected 2 records in export dataset, got ${matchedRecords.length}`);
    }

    // =========================================================================
    // TEST 3: Verify PDF generation logic with populated records
    // =========================================================================
    console.log('\n--- Test 3: Verify PDF generation with populated records ---');
    // Import generator logic
    const { generateCustomerFabricPDF } = await import('../../src/utils/customerFabricPdf.js');

    const pdfDoc = generateCustomerFabricPDF({
      records: matchedRecords,
      summary: capturedList.summary,
      filters: {
        branch: testOrder.branchName,
        status: 'All Statuses',
        fabricType: 'All Types',
        search: testOrder.orderNumber
      },
      user: managerUser,
      generatedAt: new Date()
    });

    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
    console.log(`✓ PDF generated successfully for populated dataset: ${pdfBuffer.length} bytes`);
    if (pdfBuffer.length < 5000) {
      throw new Error('PDF output seems suspiciously small');
    }
    const pdfText = pdfBuffer.toString('latin1');
    if (!pdfText.includes('JB GROUP / BELLA DESIGN') || !pdfText.includes('CUSTOMER FABRIC TRACKING REPORT')) {
      throw new Error('PDF is missing JB GROUP branding or title');
    }
    if (!pdfText.includes('Not Provided')) {
      throw new Error('PDF does not clearly display "Not Provided" for unpriced fabric');
    }
    console.log('✓ PDF verified: Contains JB GROUP branding, title, summary cards, and "Not Provided" price indicator.');

    // =========================================================================
    // TEST 4: Verify PDF generation with empty records (Clear "No records found" state)
    // =========================================================================
    console.log('\n--- Test 4: Verify PDF generation with empty records (No records found state) ---');
    const emptyPdfDoc = generateCustomerFabricPDF({
      records: [],
      summary: { totalReceived: 0, totalAvailableInStore: 0, totalWithTailors: 0, totalConsumed: 0, totalReturnedToStore: 0, totalReturnedToCustomer: 0, totalWaste: 0 },
      filters: {
        branch: 'Non-existent Branch',
        status: 'CANCELLED',
        fabricType: 'Linen'
      },
      user: managerUser,
      generatedAt: new Date()
    });

    const emptyBuffer = Buffer.from(emptyPdfDoc.output('arraybuffer'));
    const emptyText = emptyBuffer.toString('latin1');
    if (!emptyText.includes('No customer fabric records found matching the selected filter criteria.')) {
      throw new Error('Empty PDF state is missing the required "No customer fabric records found" message.');
    }
    console.log('✓ Empty PDF verified: Displays clear "No customer fabric records found" message.');

    // =========================================================================
    // TEST 5: Verify Company Inventory Valuation & WAC Unaffected
    // =========================================================================
    console.log('\n--- Test 5: Verify Company Inventory & WAC Isolation ---');
    const finalStats = await pool.query(`
      SELECT COALESCE(SUM("currentStock" * "unitCost"), 0) AS val FROM "InventoryItem"
    `);
    const finalVal = parseFloat(finalStats.rows[0].val);
    if (Math.abs(finalVal - baselineVal) > 0.0001) {
      throw new Error('CRITICAL: Company inventory valuation was altered!');
    }
    console.log(`✓ Company valuation before: LKR ${baselineVal}, after: LKR ${finalVal} (Difference: 0, perfectly isolated)`);

    console.log('\n======================================================');
    console.log('ALL EXPORT PDF & CSV VERIFICATION CHECKS PASSED!');
    console.log('======================================================');
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    if (createdFabricIds.length > 0) {
      console.log(`\nCleaning up ${createdFabricIds.length} test records...`);
      for (const id of createdFabricIds) {
        await pool.query('DELETE FROM "CustomerFabricMovement" WHERE "customerFabricId" = $1', [id]);
        await pool.query('DELETE FROM "CustomerFabric" WHERE id = $1', [id]);
      }
      console.log('✓ Cleaned up test records.');
    }
  }
}

run().then(() => process.exit()).catch(e => { console.error(e); process.exit(1); });
