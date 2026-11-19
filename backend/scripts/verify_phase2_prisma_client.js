const { prisma } = require('../src/prisma');

async function main() {
  const models = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')).sort();
  console.log('Available models in Prisma Client:');
  console.log(models);

  const requiredModels = [
    'financialAccount',
    'accountingCategory',
    'financialTransaction',
    'employeeSalary',
    'salaryAdvance',
    'bankReconciliation',
    'financialAuditLog'
  ];

  let allFound = true;
  for (const m of requiredModels) {
    if (models.includes(m)) {
      console.log(`  [PASS] Model found: prisma.${m}`);
    } else {
      console.error(`  [FAIL] Missing model: prisma.${m}`);
      allFound = false;
    }
  }

  if (allFound) {
    console.log('\nAll 7 financial models successfully registered in Prisma Client!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
