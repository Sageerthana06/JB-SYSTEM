require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  try {
    const o = await prisma.order.findFirst({
      include: { customer: true }
    });
    if (!o) {
      console.log('No order found');
      return;
    }
    const custName = o.customer?.name || 'Customer';
    const ordNum = o.orderNumber || (o.id ? `ORD-${o.id}` : 'N/A');
    const msg = `Dear ${custName},\n\nYour order ${ordNum} from JB GROUP is now ready for collection.\n\nThank you for choosing JB GROUP!`;
    console.log('--- GENERATED WHATSAPP MESSAGE ---');
    console.log(msg);
    console.log('----------------------------------');
    console.log('Has "Bella Design":', msg.includes('Bella Design'));
    console.log('Has "JB GROUP":', msg.includes('JB GROUP'));
    console.log('Database Order Columns:');
    console.log('readyNotificationSent:', o.readyNotificationSent);
    console.log('readyNotificationSentAt:', o.readyNotificationSentAt);
    console.log('readyNotificationStatus:', o.readyNotificationStatus);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run();
