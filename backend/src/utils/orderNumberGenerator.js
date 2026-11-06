/**
 * Atomic Order Number Generator for JB SYSTEM / Bella Design ERP
 * Uses PostgreSQL transaction-scoped advisory locks to eliminate race conditions.
 * Calculates year in Asia/Colombo timezone.
 */

const getColomboYear = () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric'
  });
  return formatter.format(new Date());
};

/**
 * Generates the next sequential order number inside an active Prisma interactive transaction.
 * Requires caller to pass active transaction client `tx`.
 *
 * @param {import('@prisma/client').PrismaClient} tx - Active interactive transaction
 * @returns {Promise<string>} Next unique order number (e.g. "ORD-2026-0001")
 */
const generateOrderNumberTx = async (tx) => {
  if (!tx || typeof tx.$queryRaw !== 'function') {
    throw new Error('generateOrderNumberTx must be invoked inside a Prisma interactive transaction.');
  }

  // 1. Acquire transaction-scoped PostgreSQL advisory lock (Key: 42424242)
  // This automatically releases when the transaction commits or aborts.
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(42424242)');

  // 2. Determine year strictly in Asia/Colombo (+05:30)
  const currentYear = getColomboYear();
  const prefix = `ORD-${currentYear}-`;

  // 3. Query maximum integer suffix safely
  // Constrained to 1-9 digits to prevent PostgreSQL error 22003 (integer out of range)
  const result = await tx.$queryRaw`
    SELECT COALESCE(
      MAX(
        CAST(
          (regexp_match("orderNumber", '^ORD-' || ${currentYear} || '-([0-9]{1,9})$'))[1]
          AS INTEGER
        )
      ),
      0
    ) AS "maxSeq"
    FROM "Order"
    WHERE "orderNumber" LIKE ${'ORD-' + currentYear + '-%'}
  `;

  const maxSeq = Number(result[0]?.maxSeq || 0);
  const nextSeq = maxSeq + 1;
  const nextSeqStr = String(nextSeq).padStart(4, '0');

  return `${prefix}${nextSeqStr}`;
};

module.exports = {
  generateOrderNumberTx,
  getColomboYear
};

