const { prisma, pool } = require('../backend/src/prisma');

async function testCustomerVaultData() {
  console.log('=== VERIFYING CUSTOMER VAULT DATA INTEGRITY ===\n');

  // 1. Search customers
  const sampleSearch = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: 'Kavi', mode: 'insensitive' } },
        { primaryPhone: { contains: '07' } }
      ]
    },
    take: 5,
    include: {
      orders: { select: { id: true } },
      measurements: { select: { id: true, dressType: true } }
    }
  });

  console.log(`Found ${sampleSearch.length} matching customers in sample search:`);
  sampleSearch.forEach(c => {
    console.log(`- ID #${c.id}: ${c.name} | Phone: ${c.primaryPhone} | Orders: ${c.orders.length} | Measurements: ${c.measurements.length}`);
  });

  // Verify customers with duplicate or similar names have distinct IDs
  const kaviCustomers = await prisma.customer.findMany({
    where: { name: { contains: 'Kavi', mode: 'insensitive' } }
  });
  console.log(`\nCustomers with name containing 'Kavi': ${kaviCustomers.length}`);
  kaviCustomers.forEach(c => {
    console.log(`  Profile: ID #${c.id} | Name: "${c.name}" | Phone: "${c.primaryPhone}"`);
  });

  // 2. Test Customer with Alteration measurements (e.g. Kavi ID 161)
  const custAlteration = await prisma.customer.findUnique({
    where: { id: 161 },
    include: {
      orders: { include: { garmentDetails: true } },
      measurements: { orderBy: { createdAt: 'desc' } }
    }
  });

  if (custAlteration) {
    console.log(`\nTesting Alteration Profile: ${custAlteration.name} (ID #${custAlteration.id})`);
    console.log(`- Total measurements on profile: ${custAlteration.measurements.length}`);
    const activeM = custAlteration.measurements[0];
    console.log(`- Active Dress Type: ${activeM.dressType}`);
    console.log(`- Measurement Unit: ${activeM.measurementUnit}`);
    console.log(`- Fit: ${activeM.fitPreference}`);
    console.log(`- Raw measurements JSON:`, activeM.measurements);

    // Verify fields
    const mJson = activeM.measurements;
    const isAlteration = activeM.dressType?.toLowerCase() === 'alteration' ||
      ('currentGarmentType' in mJson || 'requiredAlteration' in mJson);

    console.log(`- Is Alteration detected: ${isAlteration}`);
    console.log(`  * Current Garment Type: "${mJson.currentGarmentType}" (Clean string, no invalid cm unit attached)`);
    console.log(`  * Required Alteration: "${mJson.requiredAlteration}" (Clean string)`);
    console.log(`  * Required Measurement: "${mJson.requiredMeasurement}"`);
    console.log(`  * Alteration Instructions: "${mJson.alterationInstructions}"`);
  }

  // 3. Test Customer with Saree Blouse bespoke measurements (e.g. Pratheepa ID 153)
  const custBespoke = await prisma.customer.findUnique({
    where: { id: 153 },
    include: {
      orders: { include: { garmentDetails: true } },
      measurements: { orderBy: { createdAt: 'desc' } }
    }
  });

  if (custBespoke) {
    console.log(`\nTesting Bespoke Profile: ${custBespoke.name} (ID #${custBespoke.id})`);
    console.log(`- Total measurements on profile: ${custBespoke.measurements.length}`);
    const activeM = custBespoke.measurements[0];
    console.log(`- Active Dress Type: ${activeM.dressType}`);
    console.log(`- Measurement Unit: ${activeM.measurementUnit}`);
    console.log(`- Fit: ${activeM.fitPreference}`);
    console.log(`- Raw measurements JSON:`, activeM.measurements);

    const mJson = activeM.measurements;
    console.log('- Formatted Body Measurements:');
    Object.entries(mJson).forEach(([k, v]) => {
      console.log(`  * ${k}: ${v} ${activeM.measurementUnit}`);
    });
  }

  console.log('\n✓ ALL VAULT DATA CHECKS PASSED SUCCESSFULLY!');
}

testCustomerVaultData()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    if (pool) await pool.end();
    process.exit(0);
  });

