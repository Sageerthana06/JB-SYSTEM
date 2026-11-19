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
    const req = http.request({
      hostname: '187.77.127.167',
      port: 80,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
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
    req.end();
  });
}

async function run() {
  console.log('Testing VPS login...');
  const loginRes = await post('/api/auth/login', {
    email: 'ceo@jbgroup.com',
    password: '@Bella202CEO6'
  });

  console.log('Login Status:', loginRes.status, 'Success:', loginRes.data?.success);
  const token = loginRes.data.data?.token || loginRes.data.token;
  console.log('User logged in:', loginRes.data.data?.user?.name || loginRes.data.user?.name);

  console.log('\nQuerying VPS /api/salary/weekly-report?week=2026-W45 ...');
  const salaryRes = await get('/api/salary/weekly-report?week=2026-W45', token);
  console.log('Salary Status:', salaryRes.status);
  if (salaryRes.data?.summary) {
    console.log('VPS Current Salary Summary:', salaryRes.data.summary);
    console.log('VPS Current Orders Count:', salaryRes.data.orderTotals?.uniqueOrdersCount);
    console.log('VPS Total Allocations Count:', salaryRes.data.allAllocationsCount);
  } else {
    console.log('Salary data:', salaryRes.data);
  }
}

run().catch(console.error);
