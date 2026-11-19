const http = require('http');

async function testVps() {
  const payload = JSON.stringify({ email: 'ceo@jbgroup.com', password: 'password123' });

  const req = http.request({
    hostname: '187.77.127.167',
    port: 80,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    },
    timeout: 5000
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('VPS Login Status:', res.statusCode);
      try {
        const json = JSON.parse(body);
        console.log('VPS Login Success:', json.success, 'User:', json.data?.user?.name, 'Role:', json.data?.user?.role);
      } catch (e) {
        console.log('Raw body:', body.slice(0, 200));
      }
    });
  });

  req.on('error', (err) => {
    console.error('VPS Connection error:', err.message);
  });

  req.write(payload);
  req.end();
}

testVps();

