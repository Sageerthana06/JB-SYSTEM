require('dotenv').config();
const { prisma } = require('../src/prisma');

async function main() {
  const cols = await prisma.$queryRawUnsafe(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Customer' ORDER BY ordinal_position"
  );
  console.log('Customer columns:');
  console.table(cols);
}

main().catch(console.error).finally(() => process.exit());
