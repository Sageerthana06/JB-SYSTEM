require('dotenv').config();
const jwt = require('jsonwebtoken');

async function testApi() {
  const token = jwt.sign({ id: 1, role: 'ADMIN', name: 'Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const payload = {
    customerType: "RETURNING",
    primaryContact: "0775217187",
    branchId: "1",
    assignedTailorId: "2",
    garmentDetails: {
      dressType: "Frock",
      quantity: 1,
      liningRequired: "No",
      paddingCupRequired: "No",
      workRequired: "No",
      measurements: {
        bust: "34",
        waist: "28",
        hip: "36",
        armhole: "16",
        frockLength: "40"
      },
      measurementUnit: "cm",
      fitPreference: "Regular"
    },
    paymentDetails: {
      totalAmount: 0,
      advancePayment: 0,
      paymentMethod: "Cash"
    },
    orderSource: "SHOP"
  };

  try {
    const res = await fetch('http://localhost:5000/api/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}

testApi();
