require('dotenv').config();
const { createCustomer } = require('../src/controllers/customerController');
const { prisma } = require('../src/prisma');

async function debugCreateCustomer() {
  console.log('--- Direct Debugging of createCustomer ---');

  const req = {
    user: {
      id: 1,
      name: 'Jeyatheepan Joseph (CEO)',
      email: 'ceo@jbgroup.com',
      role: 'SUPER_ADMIN',
      branchId: 1
    },
    body: {
      customerName: 'sageerthana g',
      primaryContact: '0775217187',
      alternativeContact: '',
      address: 'jaffna',
      customerType: 'NEW',
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
    }
  };

  const res = {
    status(code) {
      console.log('Response Status:', code);
      return this;
    },
    json(data) {
      console.log('Response JSON:', JSON.stringify(data, null, 2));
      return this;
    }
  };

  const next = (err) => {
    console.error('Next called with error:', err);
  };

  try {
    await createCustomer(req, res, next);
  } catch (err) {
    console.error('Fatal crash inside createCustomer:', err);
  } finally {
    await prisma.$disconnect();
  }
}

debugCreateCustomer().catch(console.error);
