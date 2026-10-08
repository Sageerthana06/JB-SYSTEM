require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  const orders = await prisma.order.findMany({
    take: 5,
    orderBy: { id: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      advancePayment: true,
      balanceAmount: true,
      status: true
    }
  });
  console.log(JSON.stringify(orders, null, 2));
}

check().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
