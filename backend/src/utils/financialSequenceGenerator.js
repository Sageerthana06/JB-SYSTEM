/**
 * Atomic Financial Sequence Number Generator for JB GROUP
 * Uses PostgreSQL transaction-scoped advisory locks to eliminate race conditions.
 * Calculates year in Asia/Colombo timezone (UTC+05:30).
 */

const getColomboDateComponents = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  return { year, month };
};

/**
 * Generate unique transaction number inside active Prisma interactive transaction
 * e.g. "TXN-2026-0001", "EXP-2026-0001", "TRF-2026-0001"
 */
const generateTransactionNumberTx = async (tx, prefix = 'TXN') => {
  if (!tx || typeof tx.$queryRaw !== 'function') {
    throw new Error('generateTransactionNumberTx must be called inside a Prisma interactive transaction.');
  }

  // Acquire transaction-scoped advisory lock for transactions (Key: 51515151)
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(51515151)');

  const { year } = getColomboDateComponents();
  const fullPrefix = `${prefix}-${year}-`;

  const result = await tx.$queryRaw`
    SELECT COALESCE(
      MAX(
        CAST(
          (regexp_match("transactionNumber", '^' || ${prefix} || '-' || ${year} || '-([0-9]{1,9})$'))[1]
          AS INTEGER
        )
      ),
      0
    ) AS "maxSeq"
    FROM "FinancialTransaction"
    WHERE "transactionNumber" LIKE ${fullPrefix + '%'}
  `;

  const maxSeq = result && result[0] ? Number(result[0].maxSeq) : 0;
  const nextSeq = maxSeq + 1;
  const suffix = nextSeq.toString().padStart(4, '0');

  return `${fullPrefix}${suffix}`;
};

/**
 * Generate unique payroll number inside active Prisma interactive transaction
 * e.g. "PAY-202611-0001"
 */
const generatePayrollNumberTx = async (tx, monthStr) => {
  if (!tx || typeof tx.$queryRaw !== 'function') {
    throw new Error('generatePayrollNumberTx must be called inside a Prisma interactive transaction.');
  }

  // Acquire transaction-scoped advisory lock for payroll (Key: 52525252)
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(52525252)');

  const cleanMonth = (monthStr || '').replace('-', '');
  const fullPrefix = `PAY-${cleanMonth}-`;

  const result = await tx.$queryRaw`
    SELECT COALESCE(
      MAX(
        CAST(
          (regexp_match("payrollNumber", '^PAY-' || ${cleanMonth} || '-([0-9]{1,9})$'))[1]
          AS INTEGER
        )
      ),
      0
    ) AS "maxSeq"
    FROM "EmployeeSalary"
    WHERE "payrollNumber" LIKE ${fullPrefix + '%'}
  `;

  const maxSeq = result && result[0] ? Number(result[0].maxSeq) : 0;
  const nextSeq = maxSeq + 1;
  const suffix = nextSeq.toString().padStart(4, '0');

  return `${fullPrefix}${suffix}`;
};

/**
 * Generate unique salary advance number inside active Prisma interactive transaction
 * e.g. "ADV-2026-0001"
 */
const generateAdvanceNumberTx = async (tx) => {
  if (!tx || typeof tx.$queryRaw !== 'function') {
    throw new Error('generateAdvanceNumberTx must be called inside a Prisma interactive transaction.');
  }

  // Acquire transaction-scoped advisory lock for advance (Key: 53535353)
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(53535353)');

  const { year } = getColomboDateComponents();
  const fullPrefix = `ADV-${year}-`;

  const result = await tx.$queryRaw`
    SELECT COALESCE(
      MAX(
        CAST(
          (regexp_match("advanceNumber", '^ADV-' || ${year} || '-([0-9]{1,9})$'))[1]
          AS INTEGER
        )
      ),
      0
    ) AS "maxSeq"
    FROM "SalaryAdvance"
    WHERE "advanceNumber" LIKE ${fullPrefix + '%'}
  `;

  const maxSeq = result && result[0] ? Number(result[0].maxSeq) : 0;
  const nextSeq = maxSeq + 1;
  const suffix = nextSeq.toString().padStart(4, '0');

  return `${fullPrefix}${suffix}`;
};

/**
 * Generate unique monthly bill number inside active Prisma interactive transaction
 * e.g. "BILL-202611-0001"
 */
const generateBillNumberTx = async (tx, prefix = 'BILL') => {
  if (!tx || typeof tx.$queryRaw !== 'function') {
    throw new Error('generateBillNumberTx must be called inside a Prisma interactive transaction.');
  }

  // Acquire transaction-scoped advisory lock for bills (Key: 54545454)
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(54545454)');

  const { year, month } = getColomboDateComponents();
  const fullPrefix = `${prefix}-${year}${month}-`;

  const result = await tx.$queryRaw`
    SELECT COALESCE(
      MAX(
        CAST(
          (regexp_match("billNumber", '^' || ${prefix} || '-' || ${year} || ${month} || '-([0-9]{1,9})$'))[1]
          AS INTEGER
        )
      ),
      0
    ) AS "maxSeq"
    FROM "MonthlyBill"
    WHERE "billNumber" LIKE ${fullPrefix + '%'}
  `;

  const maxSeq = result && result[0] ? Number(result[0].maxSeq) : 0;
  const nextSeq = maxSeq + 1;
  const suffix = nextSeq.toString().padStart(4, '0');

  return `${fullPrefix}${suffix}`;
};

/**
 * Generate unique expense number inside active Prisma interactive transaction
 * e.g. "EXP-202611-0001"
 */
const generateExpenseNumberTx = async (tx, prefix = 'EXP') => {
  if (!tx || typeof tx.$queryRaw !== 'function') {
    throw new Error('generateExpenseNumberTx must be called inside a Prisma interactive transaction.');
  }

  // Acquire transaction-scoped advisory lock for expenses (Key: 54545454)
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(54545454)');

  const { year, month } = getColomboDateComponents();
  const fullPrefix = `${prefix}-${year}${month}-`;

  const result = await tx.$queryRaw`
    SELECT COALESCE(
      MAX(
        CAST(
          (regexp_match("expenseNumber", '^' || ${prefix} || '-' || ${year} || ${month} || '-([0-9]{1,9})$'))[1]
          AS INTEGER
        )
      ),
      0
    ) AS "maxSeq"
    FROM "BusinessExpense"
    WHERE "expenseNumber" LIKE ${fullPrefix + '%'}
  `;

  const maxSeq = result && result[0] ? Number(result[0].maxSeq) : 0;
  const nextSeq = maxSeq + 1;
  const suffix = nextSeq.toString().padStart(4, '0');

  return `${fullPrefix}${suffix}`;
};

/**
 * Generate unique expense payment history number inside active Prisma interactive transaction
 * e.g. "EXPPAY-202611-0001"
 */
const generateExpensePaymentNumberTx = async (tx, prefix = 'EXPPAY') => {
  if (!tx || typeof tx.$queryRaw !== 'function') {
    throw new Error('generateExpensePaymentNumberTx must be called inside a Prisma interactive transaction.');
  }

  // Acquire transaction-scoped advisory lock for expense payments (Key: 55555555)
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(55555555)');

  const { year, month } = getColomboDateComponents();
  const fullPrefix = `${prefix}-${year}${month}-`;

  const result = await tx.$queryRaw`
    SELECT COALESCE(
      MAX(
        CAST(
          (regexp_match("paymentNumber", '^' || ${prefix} || '-' || ${year} || ${month} || '-([0-9]{1,9})$'))[1]
          AS INTEGER
        )
      ),
      0
    ) AS "maxSeq"
    FROM "ExpensePaymentHistory"
    WHERE "paymentNumber" LIKE ${fullPrefix + '%'}
  `;

  const maxSeq = result && result[0] ? Number(result[0].maxSeq) : 0;
  const nextSeq = maxSeq + 1;
  const suffix = nextSeq.toString().padStart(4, '0');

  return `${fullPrefix}${suffix}`;
};

module.exports = {
  generateTransactionNumberTx,
  generatePayrollNumberTx,
  generateAdvanceNumberTx,
  generateBillNumberTx,
  generateExpenseNumberTx,
  generateExpensePaymentNumberTx,
  getColomboDateComponents
};


