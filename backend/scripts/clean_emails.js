require('dotenv').config();
const { prisma } = require('../src/prisma');

async function cleanRecords() {
  console.log('Finding records to clean in database...');

  // 1. Clean Orders
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { approvedBy: { contains: '@' } },
        { priceSetBy: { contains: '@' } },
        { rejectedBy: { contains: '@' } }
      ]
    }
  });

  console.log(`Found ${orders.length} orders to clean.`);
  for (const o of orders) {
    let approvedBy = o.approvedBy;
    if (approvedBy && approvedBy.includes('@')) {
      approvedBy = approvedBy.toLowerCase().includes('ceo') ? 'CEO' : 'Manager';
    }
    let priceSetBy = o.priceSetBy;
    if (priceSetBy && priceSetBy.includes('@')) {
      priceSetBy = priceSetBy.toLowerCase().includes('ceo') ? 'CEO' : 'Manager';
    }
    let rejectedBy = o.rejectedBy;
    if (rejectedBy && rejectedBy.includes('@')) {
      rejectedBy = rejectedBy.toLowerCase().includes('ceo') ? 'CEO' : 'Manager';
    }

    await prisma.order.update({
      where: { id: o.id },
      data: { approvedBy, priceSetBy, rejectedBy }
    });
  }

  // 2. Clean ProductionHistory
  const histories = await prisma.productionHistory.findMany({
    where: {
      notes: { contains: '@' }
    }
  });

  console.log(`Found ${histories.length} production history records to clean.`);
  for (const h of histories) {
    if (!h.notes) continue;
    let newNotes = h.notes
      .replace(/manager@jbgroup\.com/gi, 'Manager')
      .replace(/ceo@jbgroup\.com/gi, 'CEO')
      .replace(/admin@jbgroup\.com/gi, 'Manager')
      .replace(/\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi, (match, username) => {
        const lower = username.toLowerCase();
        if (lower.includes('ceo')) return 'CEO';
        if (lower.includes('manager') || lower.includes('admin')) return 'Manager';
        return username.charAt(0).toUpperCase() + username.slice(1);
      });

    await prisma.productionHistory.update({
      where: { id: h.id },
      data: { notes: newNotes }
    });
  }

  console.log('All database records successfully cleaned!');
}

cleanRecords()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error cleaning database records:', e);
    process.exit(1);
  });
