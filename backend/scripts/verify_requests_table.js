const jwt = require('jsonwebtoken');
const fetch = global.fetch || require('node-fetch');

const JWT_SECRET = process.env.JWT_SECRET || 'jb_secret_key_2026';
const BASE_URL = 'http://localhost:5000/api/inventory';

async function testRequests() {
  const ceo = { id: 1, name: 'Jeyatheepan Joseph (CEO)', email: 'ceo@jbgroup.com', role: 'SUPER_ADMIN' };
  const token = jwt.sign(ceo, JWT_SECRET, { expiresIn: '1h' });

  const res = await fetch(`${BASE_URL}/requests`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  const body = await res.json();
  console.log('=== GET /api/inventory/requests response ===');
  console.log('Success:', body.success);
  console.log('Total returned:', body.data?.length);

  const mr1 = body.data?.find(r => r.requestNo === 'MR-2026-0001');
  if (!mr1) {
    console.error('MR-2026-0001 NOT FOUND in response!');
    return;
  }

  console.log('\n--- VERIFYING COLUMNS FOR MR-2026-0001 ---');
  console.log('1. REQ NO:', mr1.requestNo);
  console.log('2. ORDER & CUSTOMER: Order =', mr1.orderNumber, '| Customer =', mr1.customerName);
  console.log('3. ASSIGNED TAILOR:', mr1.tailorName);
  console.log('4. MATERIAL NAME + SKU: Name =', mr1.itemName, '| SKU =', mr1.sku, '| Current Stock =', mr1.currentStock, mr1.unit);
  console.log('5. REQUESTED / ISSUED: Requested =', mr1.requestedQty, mr1.unit, '| Issued =', mr1.issuedQty, mr1.unit);
  console.log('6. REMAINING TO ISSUE:', mr1.remainingToIssue, mr1.unit);
  console.log('7. WITH TAILOR:', mr1.outstandingWithTailor, mr1.unit);
  console.log('8. REUSABLE RETURNED:', mr1.returnedQty, mr1.unit);
  console.log('9. DAMAGED:', mr1.damagedQty, mr1.unit);
  console.log('10. WASTAGE / SCRAP:', mr1.wastageQty, mr1.unit);
  console.log('11. STATUS:', mr1.status);

  // Assertions
  const asserts = [
    [mr1.requestNo === 'MR-2026-0001', 'REQ NO is MR-2026-0001'],
    [mr1.orderNumber === 'JB-20261009-0005', 'Order number is JB-20261009-0005'],
    [mr1.customerName === 'sageerthana g', 'Customer name is sageerthana g'],
    [mr1.tailorName === 'Pushpamalar', 'Tailor name is Pushpamalar'],
    [mr1.itemName === 'qq', 'Item name is qq'],
    [mr1.sku === 'FAB-700', 'SKU is FAB-700'],
    [mr1.requestedQty === 20, 'Requested Qty is 20'],
    [mr1.issuedQty === 20, 'Issued Qty is 20'],
    [mr1.remainingToIssue === 0, 'Remaining to issue is 0'],
    [mr1.outstandingWithTailor === 18, 'With Tailor is 18 (20 issued - 2 wastage)'],
    [mr1.returnedQty === 0, 'Reusable returned is 0'],
    [mr1.damagedQty === 0, 'Damaged is 0'],
    [mr1.wastageQty === 2, 'Wastage is 2'],
    [mr1.status === 'ISSUED', 'Status is ISSUED']
  ];

  let passed = 0;
  for (const [ok, label] of asserts) {
    if (ok) {
      console.log(`✓ PASS: ${label}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${label}`);
    }
  }

  console.log(`\nResult: ${passed}/${asserts.length} assertions passed.`);
}

testRequests().catch(console.error);
