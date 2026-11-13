/**
 * JB SYSTEM - Backend Order Payment Service
 * 
 * Centralized business logic for computing order payments, verified totals,
 * outstanding balances, and payment status for API routes and controllers.
 * 
 * BUSINESS RULES:
 * 1. Verified Payments Only:
 *    Only payments with status === 'VERIFIED' count toward the settled amount.
 *    Payments with status 'PENDING', 'UNVERIFIED', or 'REJECTED' do NOT reduce balance due.
 * 
 * 2. Legacy Advance Fallback:
 *    If an order has no payment records array (legacy orders), the legacy
 *    order.advancePayment field is used as the amount paid.
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
 * Calculates payment figures for an order from its database record.
 * 
 * @param {Object} order - Order object with payments included
 * @returns {Object} Payment figures { totalAmount, grossSubtotal, discountAmount, verifiedPayments, amountPaid, balanceDue, isPricePending, statusKey }
 */
function calculateOrderPayments(order) {
  if (!order) {
    return {
      totalAmount: 0,
      grossSubtotal: 0,
      discountAmount: 0,
      verifiedPayments: [],
      amountPaid: 0,
      balanceDue: 0,
      isPricePending: true,
      statusKey: 'PRICE_PENDING'
    };
  }

  // 1. Resolve Total
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
    amountPaid = Number(order.advancePayment) || 0;
  }

  // 4. Calculate Balance Due
  const balanceDue = isPricePending ? 0 : Math.max(0, totalAmount - amountPaid);

  // 5. Payment Status Key
  let statusKey = 'UNPAID';
  if (isPricePending) {
    statusKey = 'PRICE_PENDING';
  } else if (amountPaid >= totalAmount && totalAmount > 0) {
    statusKey = 'PAID';
  } else if (amountPaid > 0 && balanceDue > 0) {
    statusKey = 'PARTIALLY_PAID';
  }

  return {
    totalAmount,
    grossSubtotal,
    discountAmount,
    verifiedPayments,
    amountPaid,
    balanceDue,
    isPricePending,
    statusKey
  };
}

module.exports = {
  calculateOrderPayments
};

