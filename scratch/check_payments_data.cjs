require('dotenv').config({ path: './backend/.env' });
const { prisma } = require('./backend/src/prisma');

async function main() {
  const paymentCount = await prisma.payment.count();
  const verifiedCount = await prisma.payment.count({ where: { status: 'VERIFIED' } });
  const pendingCount = await prisma.payment.count({ where: { status: 'PENDING_VERIFICATION' } });
  const rejectedCount = await prisma.payment.count({ where: { status: 'REJECTED' } });
  console.log({ paymentCount, verifiedCount, pendingCount, rejectedCount });

  const samplePayments = await prisma.payment.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          customerId: true,
          branchId: true,
          customer: { select: { id: true, name: true } }
        }
      }
    }
  });
  console.log('Sample payments:', JSON.stringify(samplePayments, null, 2));

  // Check payments by month
  const allVerified = await prisma.payment.findMany({
    where: { status: 'VERIFIED' },
    select: { createdAt: true, amount: true }
  });

  const monthMap = {};
  for (const p of allVerified) {
    const colomboDate = new Date(p.createdAt.getTime() + 5.5 * 3600 * 1000);
    const key = `${colomboDate.getUTCFullYear()}-${String(colomboDate.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!monthMap[key]) monthMap[key] = { count: 0, total: 0 };
    monthMap[key].count += 1;
    monthMap[key].total += Number(p.amount) || 0;
  }
  console.log('Verified payments by month (Asia/Colombo):', monthMap);
}

main().catch(console.error).finally(() => prisma.$disconnect());
