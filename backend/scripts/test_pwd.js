require('dotenv').config();
const { prisma } = require('../src/prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function testPassword() {
  const user = await prisma.user.findFirst({
    where: { email: 'ceo@jbgroup.com' }
  });
  console.log('User found:', user.email, user.role);
  const match = await bcrypt.compare('@Bella202CEO6', user.password);
  console.log('Password match @Bella202CEO6:', match);

  // Also check manager
  const manager = await prisma.user.findFirst({
    where: { email: 'manager@jbgroup.com' }
  });
  console.log('Manager found:', manager?.email, manager?.role);
  if (manager) {
    const matchMgr = await bcrypt.compare('Manager@Bella2026', manager.password);
    console.log('Password match Manager@Bella2026:', matchMgr);
  }

  // Create JWT directly for testing order creation
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, branchId: user.branchId },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
  console.log('Generated token length:', token.length);

  await prisma.$disconnect();
}

testPassword().catch(console.error);
