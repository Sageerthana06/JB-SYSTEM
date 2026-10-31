import { prisma } from '../src/prisma.js';
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:5000/api';

async function testStaffCreation() {
  console.log('Testing Staff "Add New Customer Profile" endpoint...');

  // Generate a valid Manager token for testing staff creation
  const managerToken = jwt.sign(
    { id: 1, email: 'manager@jbgroup.com', role: 'MANAGER', name: 'Manager' },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '1h' }
  );

  const phone = '0778844112';

  // Cleanup if exists
  await prisma.customer.deleteMany({
    where: { primaryPhone: { in: [phone, '+94778844112'] } }
  });

  // 1. Create customer without email via staff endpoint
  const res1 = await fetch(`${BASE_URL}/customers/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${managerToken}`
    },
    body: JSON.stringify({
      name: 'Walk-in Customer Test',
      primaryPhone: phone,
      password: 'TemporaryPass123',
      address: '77 Galle Road'
    })
  });

  const data1 = await res1.json();
  console.log('Staff create without email status:', res1.status, 'Success:', data1.success);
  if (!data1.success || data1.data?.customer?.password) {
    throw new Error('Customer creation failed or exposed password hash');
  }

  // 2. Customer should now be able to log in with this phone and password in the customer portal!
  const loginRes = await fetch(`${BASE_URL}/customer-portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: '+94778844112', // Login using +94 even though created as 077
      password: 'TemporaryPass123'
    })
  });

  const loginData = await loginRes.json();
  console.log('Customer portal login with created account status:', loginRes.status, 'Success:', loginData.success);
  if (!loginData.success) {
    throw new Error('Customer portal login failed for newly created customer profile');
  }

  // Cleanup
  await prisma.customer.deleteMany({
    where: { primaryPhone: { in: [phone, '+94778844112'] } }
  });

  console.log('✅ Staff Customer Creation & Portal Linking Verified Successfully!');
}

testStaffCreation().catch(err => {
  console.error('❌ Staff creation test failed:', err);
  process.exit(1);
});
