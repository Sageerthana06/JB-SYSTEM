const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const customerCount = await prisma.customer.count();
  const orderCount = await prisma.order.count();
  console.log('Customers in DB:', customerCount);
  console.log('Orders in DB:', orderCount);

  const orders = await prisma.order.findMany({
    select: {
      id: true,
      orderNumber: true,
      orderDate: true,
      createdAt: true,
      status: true,
      totalAmount: true,
      balanceAmount: true,
      advancePayment: true,
      customerId: true,
      customer: { select: { id: true, name: true, primaryPhone: true } },
      payments: { select: { amount: true, status: true } }
    }
  });

  const months = {};
  for (const o of orders) {
    const d = new Date(o.createdAt || o.orderDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months[key] = (months[key] || 0) + 1;
  }
  console.log('Orders by month:', months);

  // Status distribution
  const statuses = {};
  for (const o of orders) {
    statuses[o.status] = (statuses[o.status] || 0) + 1;
  }
  console.log('Order statuses:', statuses);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

