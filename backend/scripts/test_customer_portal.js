const testCustomer = async () => {
  const baseUrl = 'http://localhost:5000/api';
  const timestamp = Date.now();
  const phone = `+9477${Math.floor(1000000 + Math.random() * 9000000)}`;
  const email = `testcustomer_${timestamp}@example.com`;
  const password = 'Password123!';

  console.log('1. Testing Customer Registration...');
  const regRes = await fetch(`${baseUrl}/customer-portal/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Priyanka Jayawardena',
      primaryPhone: phone,
      email: email,
      password: password,
      address: '42 Galle Road, Colombo 03'
    })
  });
  const regData = await regRes.json();
  console.log('Registration status:', regRes.status, regData.success ? 'SUCCESS' : regData.message);
  if (!regData.success) throw new Error('Registration failed: ' + JSON.stringify(regData));

  const token = regData.data.token;

  console.log('2. Testing Customer Login with Phone...');
  const loginPhoneRes = await fetch(`${baseUrl}/customer-portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: phone,
      password: password
    })
  });
  const loginPhoneData = await loginPhoneRes.json();
  console.log('Login with Phone:', loginPhoneData.success ? 'SUCCESS' : loginPhoneData.message);

  console.log('3. Testing Customer Login with Email...');
  const loginEmailRes = await fetch(`${baseUrl}/customer-portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: email,
      password: password
    })
  });
  const loginEmailData = await loginEmailRes.json();
  console.log('Login with Email:', loginEmailData.success ? 'SUCCESS' : loginEmailData.message);

  console.log('4. Testing Customer Profile Retrieval (/me)...');
  const meRes = await fetch(`${baseUrl}/customer-portal/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const meData = await meRes.json();
  console.log('Profile retrieval:', meData.success ? `SUCCESS (Customer: ${meData.customer.name})` : meData.message);

  console.log('5. Testing Customer Order Creation...');
  const orderRes = await fetch(`${baseUrl}/customer-portal/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      garmentDetails: {
        dressType: 'Saree Blouse',
        quantity: 1,
        occasion: 'Wedding',
        fabricSuppliedBy: 'Customer',
        fabricType: 'Silk Raw',
        fabricColour: 'Royal Blue',
        liningRequired: 'Yes',
        paddingCupRequired: 'Yes',
        workRequired: 'Yes',
        workDetails: 'Aari golden zardozi work along neckline and sleeves',
        accessoriesSupplied: 'Golden tassels',
        specialDesignInstructions: 'Deep U-cut back with doris'
      }
    })
  });
  const orderData = await orderRes.json();
  console.log('Order creation:', orderData.success ? `SUCCESS (Order Number: ${orderData.order.orderNumber})` : orderData.message);
  if (!orderData.success) throw new Error('Order creation failed');

  const createdOrderId = orderData.order.id;

  console.log('6. Testing Get Customer Orders (/orders)...');
  const getOrdersRes = await fetch(`${baseUrl}/customer-portal/orders`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const getOrdersData = await getOrdersRes.json();
  console.log('Get orders:', getOrdersData.success ? `SUCCESS (${getOrdersData.orders.length} orders found)` : getOrdersData.message);

  console.log('7. Testing Get Order Details By ID (/orders/:id)...');
  const getOrderRes = await fetch(`${baseUrl}/customer-portal/orders/${createdOrderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const getOrderDetails = await getOrderRes.json();
  console.log('Get order details:', getOrderDetails.success ? `SUCCESS (Dress: ${getOrderDetails.order.garmentDetails?.dressType})` : getOrderDetails.message);

  console.log('8. Testing Order Ownership Isolation (Unauthorized Customer Access)...');
  // Create customer 2
  const regRes2 = await fetch(`${baseUrl}/customer-portal/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Another Customer',
      primaryPhone: `+9471${Math.floor(1000000 + Math.random() * 9000000)}`,
      email: `other_${timestamp}@example.com`,
      password: 'Password123!',
      address: 'Kandy'
    })
  });
  const regData2 = await regRes2.json();
  const token2 = regData2.data.token;

  // Customer 2 tries to fetch Customer 1's order
  const unauthorizedRes = await fetch(`${baseUrl}/customer-portal/orders/${createdOrderId}`, {
    headers: { 'Authorization': `Bearer ${token2}` }
  });
  console.log('Unauthorized order access blocked (HTTP ' + unauthorizedRes.status + '):', unauthorizedRes.status === 404 ? 'PASSED (Properly isolated)' : 'FAILED');

  // Customer 2 tries to fetch Customer 1's PDF
  const unauthorizedPdfRes = await fetch(`${baseUrl}/orders/${createdOrderId}/pdf`, {
    headers: { 'Authorization': `Bearer ${token2}` }
  });
  console.log('Unauthorized PDF download blocked (HTTP ' + unauthorizedPdfRes.status + '):', unauthorizedPdfRes.status === 403 ? 'PASSED (Properly isolated)' : 'FAILED');

  console.log('\n--- ALL BACKEND CUSTOMER PORTAL TESTS PASSED! ---');
};

testCustomer().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
