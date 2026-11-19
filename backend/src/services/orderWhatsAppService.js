/**
 * JB SYSTEM - Backend WhatsApp Notification Service
 * 
 * Centralized service for generating WhatsApp messages with 100% verified UTF-8
 * emojis and dynamic dual-branch branding (JB GROUP vs BELLA DESIGN).
 */

const { calculateOrderPayments } = require('./orderPaymentService');

// Canonical Unicode/UTF-8 Safe Emoji Constants
// ASCII-safe escape sequences ensure 100% immunity to environment locales, Windows-1252, or encoding corruption
const EMOJIS = {
  SPARKLES: '\u2728',          // ✨
  CHERRY_BLOSSOM: '\u{1F338}', // 🌸
  BOUQUET: '\u{1F490}',        // 💐
  CLIPBOARD: '\u{1F4CB}',      // 📋
  BOOKMARK: '\u{1F516}',       // 🔖
  DRESS: '\u{1F457}',          // 👗
  MONEY_BAG: '\u{1F4B0}',      // 💰
  DOLLAR_BILL: '\u{1F4B5}',    // 💵
  CREDIT_CARD: '\u{1F4B3}',    // 💳
  CHECK: '\u2705',             // ✅
  HEART: '\u{1F496}',          // 💖
  OFFICE: '\u{1F3E2}',         // 🏢
  ROBOT: '\u{1F916}',          // 🤖
  PARTY: '\u{1F389}',          // 🎉
  BULLET: '\u2022',            // •
  TIMES: '\u00D7'              // ×
};

const formatLKR = (num, decimals = false) => {
  const n = Number(num || 0);
  if (isNaN(n)) return decimals ? '0.00' : '0';
  return decimals || n % 1 !== 0
    ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toLocaleString('en-US');
};

/**
 * Generate Approved Order Completion WhatsApp Message
 * Strictly matching JB GROUP requirements
 */
const generateOrderDeliveredWhatsAppMessage = (order) => {
  const customerName = order.customer?.name || 'Customer';
  const orderNumber = order.orderNumber || (order.id ? `ORD-${order.id}` : 'N/A');
  const itemName = order.garmentDetails?.dressType || 'Bespoke Garment';
  const quantity = Number(order.garmentDetails?.quantity || 1);

  const { totalAmount, amountPaid, balanceDue } = calculateOrderPayments(order);

  return `${EMOJIS.SPARKLES} JB GROUP (PVT) LTD ${EMOJIS.SPARKLES}

Dear ${customerName}, ${EMOJIS.CHERRY_BLOSSOM}

Thank you for choosing JB GROUP! ${EMOJIS.BOUQUET} We truly appreciate your trust in us.

${EMOJIS.PARTY} YOUR ORDER IS COMPLETED!

${EMOJIS.BOOKMARK} Order No: ${orderNumber}
${EMOJIS.DRESS} Item: ${itemName} ${EMOJIS.TIMES} ${quantity}
${EMOJIS.MONEY_BAG} Total Amount: LKR ${formatLKR(totalAmount, true)}
${EMOJIS.DOLLAR_BILL} Amount Paid: LKR ${formatLKR(amountPaid, true)}
${EMOJIS.CREDIT_CARD} Balance Due: LKR ${formatLKR(balanceDue, true)}

${EMOJIS.HEART} We hope you love your outfit! Your satisfaction is our priority.

Thank you for trusting JB GROUP. We look forward to serving you again! ${EMOJIS.CHERRY_BLOSSOM}

${EMOJIS.OFFICE} JB GROUP (PVT) LTD
${EMOJIS.SPARKLES} Build ${EMOJIS.BULLET} Lead ${EMOJIS.BULLET} Inspire.

${EMOJIS.ROBOT} Automated message from JB GROUP Management System.`;
};

/**
 * Generate Approved Order Booking Quotation WhatsApp Message
 * Dynamically branded for JB GROUP and BELLA DESIGN
 */
const generateOrderBookingWhatsAppMessage = (order) => {
  if (!order) return '';
  const customerName = (order.customer?.name || order.customerName || 'Customer').trim();

  const isBella =
    order.branchId === 2 ||
    order.branch?.id === 2 ||
    (typeof order.branch?.name === 'string' && /bella/i.test(order.branch.name)) ||
    (typeof order.branchName === 'string' && /bella/i.test(order.branchName)) ||
    (typeof order.orderNumber === 'string' && /bella/i.test(order.orderNumber)) ||
    (typeof order.quotationNumber === 'string' && /bella/i.test(order.quotationNumber));

  const quotationNo = order.quotationNumber ||
    (order.orderNumber
      ? (order.orderNumber.startsWith('QT-') ? order.orderNumber : order.orderNumber.replace(/^(JB|ORD|BELLA)-/i, 'QT-'))
      : (order.id ? `QT-${order.id}` : 'QT-0001'));

  let itemsBlock = '';
  if (Array.isArray(order.items) && order.items.length > 0) {
    itemsBlock = order.items
      .map((it) => {
        const name = it.itemName || it.dressType || it.name || 'Bespoke Garment';
        const qty = Number(it.quantity || 1);
        return `${EMOJIS.DRESS} Item: ${name} ${EMOJIS.TIMES} ${qty}`;
      })
      .join('\n');
  } else {
    const itemName = order.garmentDetails?.dressType || order.dressType || order.itemName || 'Bespoke Garment';
    const quantity = Number(order.garmentDetails?.quantity || order.quantity || 1);
    itemsBlock = `${EMOJIS.DRESS} Item: ${itemName} ${EMOJIS.TIMES} ${quantity}`;
  }

  const { totalAmount, amountPaid, balanceDue } = calculateOrderPayments(order);

  if (isBella) {
    return `${EMOJIS.SPARKLES} BELLA DESIGN STUDIO ${EMOJIS.SPARKLES}

Dear ${customerName}, ${EMOJIS.CHERRY_BLOSSOM}

Thank you for choosing BELLA DESIGN STUDIO! ${EMOJIS.BOUQUET}

${EMOJIS.CLIPBOARD} ORDER QUOTATION

${EMOJIS.BOOKMARK} Quotation No: ${quotationNo}
${itemsBlock}
${EMOJIS.MONEY_BAG} Total Amount: LKR ${formatLKR(totalAmount)}
${EMOJIS.DOLLAR_BILL} Advance Payment: LKR ${formatLKR(amountPaid)}
${EMOJIS.CREDIT_CARD} Balance Payable: LKR ${formatLKR(balanceDue)}

${EMOJIS.CHECK} Your order has been confirmed and scheduled for production.

${EMOJIS.OFFICE} BELLA DESIGN STUDIO
Exclusive Boutique & Fashion Studio
${EMOJIS.SPARKLES} Build ${EMOJIS.BULLET} Lead ${EMOJIS.BULLET} Inspire.

${EMOJIS.ROBOT} Automated message from BELLA DESIGN Management System.`;
  }

  return `${EMOJIS.SPARKLES} JB GROUP (PVT) LTD ${EMOJIS.SPARKLES}

Dear ${customerName}, ${EMOJIS.CHERRY_BLOSSOM}

Thank you for choosing JB GROUP! ${EMOJIS.BOUQUET}

${EMOJIS.CLIPBOARD} ORDER QUOTATION

${EMOJIS.BOOKMARK} Quotation No: ${quotationNo}
${itemsBlock}
${EMOJIS.MONEY_BAG} Total Amount: LKR ${formatLKR(totalAmount)}
${EMOJIS.DOLLAR_BILL} Advance Payment: LKR ${formatLKR(amountPaid)}
${EMOJIS.CREDIT_CARD} Balance Payable: LKR ${formatLKR(balanceDue)}

${EMOJIS.CHECK} Your order has been confirmed and scheduled for tailoring.

${EMOJIS.OFFICE} JB GROUP (PVT) LTD
Headquarters: First floor, No 71, Thirugnanasampanthar Street, Trincomalee. Sri Lanka.
${EMOJIS.SPARKLES} Build ${EMOJIS.BULLET} Lead ${EMOJIS.BULLET} Inspire.

${EMOJIS.ROBOT} Automated message from JB GROUP Management System.`;
};

module.exports = {
  EMOJIS,
  formatLKR,
  generateOrderDeliveredWhatsAppMessage,
  generateOrderBookingWhatsAppMessage
};
