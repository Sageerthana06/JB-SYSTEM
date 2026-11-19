const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const app = require('../src/app');

function makeRequest(server, path, method = 'GET', token, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, text: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('=== TESTING BUSINESS HEALTH & MONTHLY BILLS APIS ===\n');

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  console.log(`Ephemeral test server running on port ${port}`);

  const ceoToken = jwt.sign(
    { id: 1, username: 'admin', role: 'SUPER_ADMIN', branchId: null },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const managerBranch1Token = jwt.sign(
    { id: 3, username: 'manager', role: 'MANAGER', branchId: 1 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Test 1: CEO consolidated dashboard
  console.log('\n[1] Testing CEO Consolidated Business Health Dashboard...');
  const res1 = await makeRequest(server, '/api/finance/dashboard/business-health?branchId=ALL&period=this_month', 'GET', ceoToken);
  console.log('Status:', res1.status);
  console.log('Success:', res1.body?.success);
  console.log('Summary Cards count:', Object.keys(res1.body?.summaryCards || {}).length);
  console.log('16 Summary Cards:', res1.body?.summaryCards);
  if (res1.status !== 200 || !res1.body?.success) {
    throw new Error('Test 1 failed: CEO dashboard did not return success');
  }

  // Test 2: Manager RBAC strict branch locking
  console.log('\n[2] Testing Manager RBAC: Access own Branch 1...');
  const res2 = await makeRequest(server, '/api/finance/dashboard/business-health?branchId=1', 'GET', managerBranch1Token);
  console.log('Branch 1 Status:', res2.status, '(Expected 200)');
  if (res2.status !== 200) throw new Error('Manager Branch 1 failed');

  console.log('\n[3] Testing Manager RBAC: Unauthorized cross-branch access to Branch 2...');
  const res3 = await makeRequest(server, '/api/finance/dashboard/business-health?branchId=2', 'GET', managerBranch1Token);
  console.log('Cross-branch Status:', res3.status, '(Expected 403)');
  if (res3.status !== 403) throw new Error('Manager cross-branch was not blocked with 403!');

  console.log('\n[4] Testing Manager RBAC: Unauthorized access to consolidated ALL...');
  const res4 = await makeRequest(server, '/api/finance/dashboard/business-health?branchId=ALL', 'GET', managerBranch1Token);
  console.log('Consolidated ALL Status:', res4.status, '(Expected 403)');
  if (res4.status !== 403) throw new Error('Manager consolidated access was not blocked with 403!');

  // Test 5: Monthly Bills List
  console.log('\n[5] Testing GET /api/finance/bills...');
  const res5 = await makeRequest(server, '/api/finance/bills', 'GET', ceoToken);
  console.log('Bills list status:', res5.status, 'Total bills:', res5.body?.pagination?.totalBills);
  if (res5.status !== 200) throw new Error('GET /bills failed');

  // Test 6: Create Monthly Bill
  console.log('\n[6] Testing POST /api/finance/bills...');
  const testBill = {
    branchId: 1,
    billName: 'Test Electricity Bill November 2026',
    category: 'ELECTRICITY',
    providerName: 'Ceylon Electricity Board',
    expectedAmount: 18500,
    actualAmount: 19200,
    billingMonth: '2026-11',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    billReference: 'CEB-TEST-8841',
    notes: 'Unit test bill verification'
  };
  const res6 = await makeRequest(server, '/api/finance/bills', 'POST', ceoToken, testBill);
  console.log('Create bill status:', res6.status);
  console.log('Created bill number:', res6.body?.bill?.billNumber);
  if (res6.status !== 201) throw new Error('Failed to create test bill: ' + JSON.stringify(res6.body));

  const createdBillId = res6.body.bill.id;

  // Test 7: Duplicate bill prevention check
  console.log('\n[7] Testing Duplicate Prevention on same (branch, category, month)...');
  const res7 = await makeRequest(server, '/api/finance/bills', 'POST', ceoToken, testBill);
  console.log('Duplicate create status:', res7.status, '(Expected 409)');
  if (res7.status !== 409) throw new Error('Duplicate bill creation was not rejected with 409!');

  // Test 8: Clean up test bill
  console.log('\n[8] Testing DELETE /api/finance/bills/:id for unpaid bill...');
  const res8 = await makeRequest(server, `/api/finance/bills/${createdBillId}`, 'DELETE', ceoToken);
  console.log('Delete bill status:', res8.status);
  if (res8.status !== 200) throw new Error('Failed to clean up test bill');

  server.close();
  console.log('\n✅ ALL 8 BACKEND HEALTH & BILL TESTS PASSED PERFECTLY!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
