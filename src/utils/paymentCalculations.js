/**
 * JB SYSTEM - Order Payment Calculations & Status Determination
 *
 * Centralized business logic for computing order payments, verified totals,
 * outstanding balances, and invoice/payment status badges.
 *
 * BUSINESS RULES:
 * 1. Verified Payments Only:
 *    Only payments with `status === 'VERIFIED'` count toward the settled amount.
 *    Payments with status 'PENDING', 'UNVERIFIED', or 'REJECTED' do NOT reduce balance due.
 *
 * 2. Legacy Advance Fallback:
 *    If an order has no payment records array (legacy orders), the legacy
 *    `order.advancePayment` field is used as the amount paid.
 *
 * 3. Price Pending Safeguard:
 *    If totalAmount <= 0 or priceStatus is 'PENDING', 'PRICE_PENDING', 'DECLINED',
 *    or order.priceApproved is false, the order is 'PRICE PENDING'.
 *    It must NEVER be marked as 'PAID' or show 0 balance as settled.
 *
 * 4. Four Payment Statuses:
 *    - PAID: amountPaid >= totalAmount && totalAmount > 0 (Balance Due = 0)
 *    - PARTIALLY PAID: amountPaid > 0 && balanceDue > 0
 *    - UNPAID: amountPaid === 0 && balanceDue > 0
 *    - PRICE PENDING: totalAmount <= 0 or price awaiting approval
 */

/**
 * Calculates payment totals, verified receipts, and outstanding balance for any order.
 *
 * @param {Object} order - Order object from database or API
 * @returns {Object} Payment figures { totalAmount, grossSubtotal, discountAmount, verifiedPayments, amountPaid, balanceDue, isPricePending }
 */
export function calculateOrderPayments(order) {
  if (!order) {
    return {
      totalAmount: 0,
      grossSubtotal: 0,
      discountAmount: 0,
      verifiedPayments: [],
      amountPaid: 0,
      balanceDue: 0,
      isPricePending: true
    };
  }

  // 1. Resolve Agreed / Approved Total
  const rawTotal = Number(
    order.totalAmount !== undefined && order.totalAmount !== null
      ? order.totalAmount
      : (order.agreedTotal !== undefined && order.agreedTotal !== null ? order.agreedTotal : 0)
  );
  const totalAmount = isNaN(rawTotal) ? 0 : Math.max(0, rawTotal);
  const discountAmount = Math.max(0, Number(order.discountAmount || 0));
  const grossSubtotal = totalAmount + discountAmount;

  // 2. Check Price Approval Status
  const isPricePending =
    totalAmount <= 0 ||
    order.priceStatus === 'PENDING' ||
    order.priceStatus === 'PRICE_PENDING' ||
    order.priceStatus === 'DECLINED' ||
    order.priceApproved === false ||
    order.status === 'PENDING_APPROVAL';

  // 3. Sum Verified Payments
  const verifiedPayments = Array.isArray(order.payments)
    ? order.payments.filter((p) => p && p.status === 'VERIFIED')
    : [];

  let amountPaid = 0;
  if (verifiedPayments.length > 0) {
    amountPaid = verifiedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  } else if (
    (!Array.isArray(order.payments) || order.payments.length === 0) &&
    order.advancePayment !== undefined &&
    order.advancePayment !== null
  ) {
    // Legacy fallback for orders created prior to the multi-payment ledger
    amountPaid = Number(order.advancePayment) || 0;
  }

  // 4. Calculate Balance Due (Outstanding Amount)
  const balanceDue = isPricePending ? 0 : Math.max(0, totalAmount - amountPaid);

  return {
    totalAmount,
    grossSubtotal,
    discountAmount,
    verifiedPayments,
    amountPaid,
    balanceDue,
    isPricePending
  };
}

/**
 * Determines the customer invoice payment status, colors, and bill stamp.
 *
 * @param {Object} order - Order object
 * @returns {Object} Status visual tokens and figures
 */
export function computeInvoicePaymentStatus(order) {
  const { totalAmount, amountPaid, balanceDue, isPricePending } = calculateOrderPayments(order);

  // Status 1: Price Pending
  if (isPricePending) {
    return {
      statusKey: 'PRICE_PENDING',
      label: 'PRICE PENDING',
      stampText: 'PRICE PENDING',
      balanceLabel: 'Balance Due',
      color: '#d97706',
      bgColor: '#fffbeb',
      borderColor: '#fde68a',
      stampBorderColor: '#d97706',
      stampTextColor: '#d97706',
      totalAmount: 0,
      amountPaid: 0,
      balanceDue: 0
    };
  }

  // Status 2: Fully Paid
  if (amountPaid >= totalAmount && totalAmount > 0) {
    return {
      statusKey: 'PAID',
      label: 'PAID',
      stampText: 'PAID',
      balanceLabel: 'Balance Due',
      color: '#16a34a',
      bgColor: '#f0fdf4',
      borderColor: '#bbf7d0',
      stampBorderColor: '#16a34a',
      stampTextColor: '#16a34a',
      totalAmount,
      amountPaid,
      balanceDue: 0
    };
  }

  // Status 3: Partially Paid (Advance received, remaining balance due)
  if (amountPaid > 0 && balanceDue > 0) {
    return {
      statusKey: 'PARTIALLY_PAID',
      label: 'PARTIALLY PAID',
      stampText: 'PARTIALLY PAID',
      balanceLabel: 'Balance Due',
      color: '#ea580c',
      bgColor: '#fff7ed',
      borderColor: '#fed7aa',
      stampBorderColor: '#ea580c',
      stampTextColor: '#ea580c',
      totalAmount,
      amountPaid,
      balanceDue
    };
  }

  // Status 4: Unpaid (Zero verified payments received)
  return {
    statusKey: 'UNPAID',
    label: 'UNPAID',
    stampText: 'UNPAID',
    balanceLabel: 'Balance Due',
    color: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    stampBorderColor: '#dc2626',
    stampTextColor: '#dc2626',
    totalAmount,
    amountPaid: 0,
    balanceDue: totalAmount
  };
}

/**
 * Currency formatter helper for LKR/Rs.
 * @param {number|string} val
 * @returns {string} e.g. "1,600.00"
 */
export function formatCurrencyLKR(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
