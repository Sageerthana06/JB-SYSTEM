require('dotenv').config();
const { prisma } = require('../src/prisma');

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, branchId: true }
  });
  console.log('Users in DB:');
  console.table(users);
  await prisma.$disconnect();
}

checkUsers().catch(console.error);
