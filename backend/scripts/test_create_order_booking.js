const fetch = global.fetch || require('node-fetch');

async function testOrderBooking() {
  console.log('--- Testing Order Booking for sageerthana g (0775217187) ---');

  // 1. Login as CEO / Manager
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ceo@jbgroup.com', password: '@Bella202CEO6' })
  });
  const loginData = await loginRes.json();
  console.log('Full login response:', JSON.stringify(loginData));
  const token = loginData.data?.token || loginData.token;
  console.log('Login status:', loginData.success, '| User:', loginData.data?.user?.name, '| Token length:', token ? token.length : 0);

  // 2. Submit order creation payload matching user screenshot
  const payload = {
    customerName: 'sageerthana g',
    primaryContact: '0775217187',
    alternativeContact: '',
    address: 'jaffna',
    customerType: 'NEW', // Specifically testing 'NEW' when phone already exists!
    branchId: 1,
    assignedTailorId: null,
    garmentDetails: {
      dressType: 'Lehenga',
      quantity: 1,
      occasion: 'Party',
      fabricSuppliedBy: 'Customer',
      fabricType: 'Silk',
      fabricColour: 'Red',
      liningRequired: true,
      paddingCupRequired: false,
      workRequired: false,
      workDetails: '',
      accessoriesSupplied: '',
      specialDesignInstructions: '',
      measurements: {
        bust: 22,
        waist: 9.25,
        hip: 1,
        blouseLength: 1,
        lehengaWaist: 2.75,
        lehengaLength: 1,
        notes: 'z'
      },
      measurementUnit: 'inch',
      fitPreference: 'Regular'
    },
    paymentDetails: {
      totalAmount: 0,
      advancePayment: 0,
      paymentMethod: 'Cash',
      transactionRef: null,
      slipImage: null
    },
    orderSource: 'SHOP'
  };

  const createRes = await fetch('http://localhost:5000/api/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const createData = await createRes.json();
  console.log('Create order response status:', createRes.status);
  console.log('Create order success:', createData.success);
  console.log('Message:', createData.message);
  if (createData.order) {
    console.log('✓ Order booked successfully! Order Number:', createData.order.orderNumber);
    console.log('  Customer Name:', createData.customer?.name);
    console.log('  Dress Type:', createData.order.garmentDetails?.dressType);
    console.log('  Status:', createData.order.status);
  }
}

testOrderBooking().catch(console.error);
