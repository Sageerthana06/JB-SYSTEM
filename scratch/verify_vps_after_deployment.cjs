const http = require('http');

function post(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request({
      hostname: '187.77.127.167',
      port: 80,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 8000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({
      hostname: '187.77.127.167',
      port: 80,
      path,
      method: 'GET',
      headers,
      timeout: 8000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function verifyLiveVPS() {
  console.log('=== VERIFYING LIVE VPS DEPLOYMENT AT http://187.77.127.167 ===\n');

  // 1. Health Check
  console.log('1. Checking /api/health ...');
  const healthRes = await get('/api/health');
  console.log('   Health Status:', healthRes.status, 'Payload:', healthRes.data);

  // 2. CEO Login
  console.log('\n2. Testing CEO Login (ceo@jbgroup.com) ...');
  const ceoLogin = await post('/api/auth/login', {
    email: 'ceo@jbgroup.com',
    password: '@Bella202CEO6'
  });
  console.log('   CEO Login Status:', ceoLogin.status, 'Success:', ceoLogin.data?.success);
  const ceoToken = ceoLogin.data?.data?.token;

  // 3. Manager Login
  console.log('\n3. Testing Manager Login (manager@jbgroup.com) ...');
  const mgrLogin = await post('/api/auth/login', {
    email: 'manager@jbgroup.com',
    password: 'Manager@Bella2026'
  });
  console.log('   Manager Login Status:', mgrLogin.status, 'Success:', mgrLogin.data?.success);
  const mgrToken = mgrLogin.data?.data?.token;

  // 4. CEO Weekly Salary Report
  if (ceoToken) {
    console.log('\n4. Querying Weekly Salary Report as CEO ...');
    const salaryReport = await get('/api/salary/weekly-report?week=2026-W45', ceoToken);
    console.log('   Salary API Status:', salaryReport.status);
    if (salaryReport.data?.summary) {
      console.log('   Summary:');
      console.log('     Total Earned: LKR', salaryReport.data.summary.totalEarnedInWeek);
      console.log('     Salary Payable: LKR', salaryReport.data.summary.totalPayable);
      console.log('     Held (Customer Payment): LKR', salaryReport.data.summary.totalHeldOnCustomerPayment);
      console.log('     Work Pending: LKR', salaryReport.data.summary.totalWorkPending);
      console.log('     Orders Count:', salaryReport.data.orderTotals?.uniqueOrdersCount);
      console.log('     Allocations Count:', salaryReport.data.allAllocationsCount);
    }
  }

  // 5. Manager Branch Restriction Check
  if (mgrToken) {
    console.log('\n5. Testing Manager Branch Permissions & Isolation ...');
    const branch1Res = await get('/api/salary/weekly-report?week=2026-W45&branchId=1', mgrToken);
    console.log('   Manager Branch 1 (Assigned) Status:', branch1Res.status, '(Expected: 200)');

    const branch2Res = await get('/api/salary/weekly-report?week=2026-W45&branchId=2', mgrToken);
    console.log('   Manager Branch 2 (Cross-Branch) Status:', branch2Res.status, '(Expected: 403 Forbidden)');
  }
}

verifyLiveVPS().catch(console.error);

