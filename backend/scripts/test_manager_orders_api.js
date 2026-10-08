const http = require('http');

async function test() {
  const loginData = JSON.stringify({ email: 'manager@jbgroup.com', password: 'Manager@Bella2026' });
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: loginData
  });
  const loginJson = await loginRes.json();
  console.log('Login response:', loginJson);
  const token = loginJson.data?.token || loginJson.token;
  const user = loginJson.data?.user || loginJson.user;
  console.log('Logged in as:', user.name, user.role);

  const ordersRes = await fetch('http://localhost:5000/api/orders', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { success, orders } = await ordersRes.json();
  console.log('Total orders returned:', orders.length);

  const ord103 = orders.find(o => o.id === 103);
  console.log('Order 103 found?', !!ord103);
  if (ord103) {
    console.log('Order 103 orderNumber:', ord103.orderNumber);
    console.log('Order 103 payments:', JSON.stringify(ord103.payments, null, 2));
  }

  const pendingSlipOrders = orders.filter(o => o.payments && o.payments.some(p => p.status === 'PENDING_VERIFICATION'));
  console.log('Pending slip orders count:', pendingSlipOrders.length);
  if (pendingSlipOrders.length > 0) {
    console.log('Pending slip orders IDs:', pendingSlipOrders.map(o => o.id));
  }
}

test().catch(console.error);
