const { prisma, pool } = require('../backend/src/prisma');

async function checkRelations() {
  console.log('Checking foreign references to Expense ID 5 and Payment ID 7...');

  // Check ExpensePaymentHistory
  const payments = await prisma.expensePaymentHistory.findMany({
    where: { expenseId: 5 }
  });
  console.log('ExpensePaymentHistory for expense 5:', payments);

  // Check FinancialTransaction
  const tx = await prisma.financialTransaction.findMany({
    where: {
      OR: [
        { referenceNo: { contains: 'EXP-202611-0001' } },
        { referenceNo: { contains: 'EXPPAY-202611-0001' } },
        { description: { contains: 'TEST_Printer_Toner_Cartridges' } }
      ]
    }
  });
  console.log('FinancialTransaction referencing expense:', tx);

  // Check FinancialAuditLog
  const auditLogs = await prisma.financialAuditLog.findMany({
    where: {
      OR: [
        { entityType: { in: ['EXPENSE', 'BusinessExpense', 'ExpensePaymentHistory'] } },
        { description: { contains: 'EXP-202611-0001' } },
        { description: { contains: 'TEST_Printer_Toner_Cartridges' } }
      ]
    }
  });
  console.log('FinancialAuditLog referencing expense count:', auditLogs.length);
  if (auditLogs.length > 0) {
    console.log('Audit logs sample:', auditLogs.slice(0, 3));
  }
}

checkRelations()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
