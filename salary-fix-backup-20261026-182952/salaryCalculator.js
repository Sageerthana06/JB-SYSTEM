/**
 * Weekly Tailor Salary Calculation Engine — JB GROUP (PVT) LTD
 * 
 * Business Payment Rules:
 * - Office allocation: 50%
 * - Cutting tailor allocation: 25%
 * - Stitching tailor allocation: 25%
 * Total = 100% of agreed price
 * 
 * Eligibility Conditions:
 * 1. Work completed:
 *    - Cutting allocation earned only when Cutting work is completed.
 *    - Stitching allocation earned only when Stitching work is completed.
 * 2. Customer payment condition:
 *    - Salary becomes PAYABLE only when work is completed AND customer has fully paid.
 * 
 * State Machine:
 * - Work incomplete -> WORK_PENDING
 * - Work complete, customer not fully paid -> ON_HOLD_CUSTOMER_PAYMENT
 * - Work complete, customer fully paid -> PAYABLE
 * - Actual salary payment recorded -> PAID
 */

// Timezone offset for Asia/Colombo (UTC + 05:30 in minutes)
const COLOMBO_OFFSET_MINUTES = 330;

/**
 * Convert any Date or ISO string to Asia/Colombo local components
 */
function toColomboDateComponents(inputDate) {
  const d = inputDate ? new Date(inputDate) : new Date();
  if (isNaN(d.getTime())) return null;

  // Add offset to get local time in Colombo
  const colomboTimeMs = d.getTime() + (COLOMBO_OFFSET_MINUTES * 60 * 1000);
  const colomboDate = new Date(colomboTimeMs);

  return {
    year: colomboDate.getUTCFullYear(),
    month: colomboDate.getUTCMonth(), // 0-indexed
    day: colomboDate.getUTCDate(),
    dayOfWeek: colomboDate.getUTCDay(), // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    hours: colomboDate.getUTCHours(),
    minutes: colomboDate.getUTCMinutes(),
    seconds: colomboDate.getUTCSeconds()
  };
}

/**
 * Get Colombo week range (Monday 00:00:00 to Sunday 23:59:59.999)
 * for any given reference date (or null for current time).
 */
function getColomboWeekRange(referenceDate) {
  const comp = toColomboDateComponents(referenceDate) || toColomboDateComponents(new Date());

  // In JavaScript: 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  // We want Monday as day 0 of the business week
  const colomboDay = comp.dayOfWeek;
  const daysSinceMonday = colomboDay === 0 ? 6 : (colomboDay - 1);

  // Compute Monday in Colombo
  const mondayMs = Date.UTC(comp.year, comp.month, comp.day - daysSinceMonday, 0, 0, 0, 0) - (COLOMBO_OFFSET_MINUTES * 60 * 1000);
  const sundayMs = Date.UTC(comp.year, comp.month, comp.day - daysSinceMonday + 6, 23, 59, 59, 999) - (COLOMBO_OFFSET_MINUTES * 60 * 1000);

  const startOfWeek = new Date(mondayMs);
  const endOfWeek = new Date(sundayMs);

  const monComp = toColomboDateComponents(startOfWeek);
  const sunComp = toColomboDateComponents(endOfWeek);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedMonday = `${String(monComp.day).padStart(2, '0')} ${monthNames[monComp.month]} ${monComp.year}`;
  const formattedSunday = `${String(sunComp.day).padStart(2, '0')} ${monthNames[sunComp.month]} ${sunComp.year}`;

  const weekNumber = getColomboWeekNumber(startOfWeek);
  const weekLabel = `Week ${weekNumber} (${formattedMonday} – ${formattedSunday})`;

  return {
    startOfWeek,
    endOfWeek,
    startIso: startOfWeek.toISOString(),
    endIso: endOfWeek.toISOString(),
    startDateStr: `${monComp.year}-${String(monComp.month + 1).padStart(2, '0')}-${String(monComp.day).padStart(2, '0')}`,
    endDateStr: `${sunComp.year}-${String(sunComp.month + 1).padStart(2, '0')}-${String(sunComp.day).padStart(2, '0')}`,
    formattedMonday,
    formattedSunday,
    formattedRange: `${formattedMonday} – ${formattedSunday}`,
    weekNumber,
    weekLabel
  };
}

/**
 * ISO-8601 week number calculation in Asia/Colombo
 */
function getColomboWeekNumber(date) {
  const comp = toColomboDateComponents(date);
  const target = new Date(Date.UTC(comp.year, comp.month, comp.day));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

/**
 * Currency rounding helper (safe 2 decimal places for LKR)
 */
function roundLKR(num) {
  if (num === null || num === undefined || isNaN(num)) return 0;
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

/**
 * Check if order price is valid and agreed/approved.
 * Safely handles price-pending, declined, and zero-price orders.
 */
function isOrderPriceApproved(order) {
  if (!order) return false;

  const total = Number(order.agreedTotal || order.totalAmount || 0);
  if (total <= 0) return false;

  // If order is still pending approval or rejected
  if (['PENDING_APPROVAL', 'REJECTED'].includes(order.status)) {
    return false;
  }

  // If price is pending or declined
  if (order.priceStatus === 'PENDING' || order.priceStatus === 'DECLINED' || order.priceStatus === 'PRICE_REVISION_REQUIRED') {
    return false;
  }

  return true;
}

/**
 * Calculate verified customer payment from authoritative records
 */
function calculateCustomerPayments(order) {
  if (!order) return { totalPaid: 0, isFullyPaid: false, balanceDue: 0, agreedPrice: 0 };

  const agreedPrice = roundLKR(Number(order.agreedTotal || order.totalAmount || 0));

  let verifiedPaid = 0;
  if (Array.isArray(order.payments) && order.payments.length > 0) {
    verifiedPaid = order.payments
      .filter(p => !p.status || p.status === 'VERIFIED')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  } else if (Number(order.advancePayment) > 0) {
    verifiedPaid = Number(order.advancePayment);
  }

  verifiedPaid = roundLKR(verifiedPaid);
  const balanceDue = roundLKR(Math.max(0, agreedPrice - verifiedPaid));
  const isFullyPaid = agreedPrice > 0 && verifiedPaid >= (agreedPrice - 0.01);

  return {
    agreedPrice,
    totalPaid: verifiedPaid,
    balanceDue,
    isFullyPaid
  };
}

/**
 * Extract work completion details for Cutting and Stitching for an order.
 * Primary source of truth: OrderTask records.
 * Fallback: Order.assignedTailorId + ProductionHistory / order status.
 */
function extractWorkCompletion(order, workType) {
  const isCutting = workType === 'CUTTING';
  const targetTaskType = isCutting ? 'CUTTING' : 'STITCHING';

  // 1. Check granular OrderTask records
  if (Array.isArray(order.tasks) && order.tasks.length > 0) {
    const task = order.tasks.find(t => t.taskType === targetTaskType);
    if (task) {
      const isCompleted = task.status === 'COMPLETED';
      return {
        assignedTailorId: task.assignedTailorId || null,
        tailorName: task.assignedTailor?.name || null,
        tailorEmail: task.assignedTailor?.email || null,
        isCompleted,
        completedAt: isCompleted ? (task.completedAt || task.updatedAt || order.updatedAt) : null,
        taskStatus: task.status,
        hasTaskRecord: true,
        taskId: task.id
      };
    }
  }

  // 2. Fallback: Order.assignedTailorId with workflow stages
  const primaryTailorId = order.assignedTailorId || null;
  const tailorName = order.assignedTailor?.name || null;
  const tailorEmail = order.assignedTailor?.email || null;

  // Stages that indicate cutting completion
  const cuttingCompletedStages = [
    'STITCHING', 'AARI_EMBROIDERY', 'QUALITY_CHECK',
    'ALTERATION', 'FITTING_ALTERATION', 'FINISHING',
    'READY', 'DELIVERED', 'COMPLETED'
  ];

  // Stages that indicate stitching completion
  const stitchingCompletedStages = [
    'QUALITY_CHECK', 'ALTERATION', 'FITTING_ALTERATION',
    'FINISHING', 'READY', 'DELIVERED', 'COMPLETED'
  ];

  const completedStages = isCutting ? cuttingCompletedStages : stitchingCompletedStages;
  const isOrderCancelled = ['CANCELLED', 'REJECTED'].includes(order.status);
  const isCompleted = !isOrderCancelled && completedStages.includes(order.status);

  // Find completion date from ProductionHistory if available
  let completedDate = null;
  if (isCompleted) {
    if (Array.isArray(order.productionHistory) && order.productionHistory.length > 0) {
      const hist = order.productionHistory.find(h => h.stage === targetTaskType && h.completedAt);
      if (hist && hist.completedAt) {
        completedDate = new Date(hist.completedAt);
      }
    }
    if (!completedDate) {
      completedDate = order.completedAt ? new Date(order.completedAt) : new Date(order.updatedAt || order.createdAt);
    }
  }

  return {
    assignedTailorId: primaryTailorId,
    tailorName,
    tailorEmail,
    isCompleted,
    completedAt: completedDate,
    taskStatus: isCompleted ? 'COMPLETED' : (order.status === targetTaskType ? 'IN_PROGRESS' : 'ASSIGNED'),
    hasTaskRecord: false,
    taskId: null
  };
}

/**
 * Generate all salary allocations for an order:
 * - Office allocation: 50%
 * - Cutting tailor allocation: 25%
 * - Stitching tailor allocation: 25%
 * 
 * @param {Object} order - Order with garmentDetails, customer, tasks, payments, assignedTailor, productionHistory
 * @param {Array} paidSalaryRecords - Array of existing TailorSalaryPayment records
 */
function calculateOrderSalaryAllocations(order, paidSalaryRecords = []) {
  if (!order) return [];

  // Check price validity
  if (!isOrderPriceApproved(order)) {
    return []; // No salary calculated for unpriced, pending, or declined orders
  }

  const { agreedPrice, totalPaid, balanceDue, isFullyPaid } = calculateCustomerPayments(order);
  if (agreedPrice <= 0) return [];

  // 100% total allocation split
  const cuttingAllocation = roundLKR(agreedPrice * 0.25);
  const stitchingAllocation = roundLKR(agreedPrice * 0.25);
  const officeAllocation = roundLKR(agreedPrice - cuttingAllocation - stitchingAllocation); // Exactly 50%

  const allocations = [];

  // --- Work Types to Evaluate: CUTTING and STITCHING ---
  const workTypes = [
    { type: 'CUTTING', name: 'Cutting', percent: 25.0, amount: cuttingAllocation },
    { type: 'STITCHING', name: 'Stitching', percent: 25.0, amount: stitchingAllocation }
  ];

  for (const wt of workTypes) {
    const workInfo = extractWorkCompletion(order, wt.type);
    const tailorId = workInfo.assignedTailorId;

    // Check if an actual payment disbursement has already been recorded
    const existingPayment = paidSalaryRecords.find(p =>
      Number(p.orderId) === Number(order.id) &&
      p.workType === wt.type &&
      (!tailorId || Number(p.tailorId) === Number(tailorId))
    );

    let status = 'WORK_PENDING';
    if (existingPayment) {
      status = 'PAID';
    } else if (workInfo.isCompleted && isFullyPaid) {
      status = 'PAYABLE';
    } else if (workInfo.isCompleted && !isFullyPaid) {
      status = 'ON_HOLD_CUSTOMER_PAYMENT';
    } else {
      status = 'WORK_PENDING';
    }

    allocations.push({
      allocationKey: `${order.id}-${wt.type}-${tailorId || 'unassigned'}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate || order.createdAt,
      customerId: order.customerId,
      customerName: order.customer?.name || 'Customer',
      dressType: order.garmentDetails?.dressType || 'Garment',
      branchId: order.branchId,
      branchName: order.branch?.name || 'Main Branch',
      agreedPrice,
      workType: wt.type,
      workTypeName: wt.name,
      allocationPercent: wt.percent,
      allocatedAmount: wt.amount,
      tailorId,
      tailorName: workInfo.tailorName || 'Unassigned',
      tailorEmail: workInfo.tailorEmail || null,
      isWorkCompleted: workInfo.isCompleted,
      workCompletedAt: workInfo.completedAt,
      customerTotalPaid: totalPaid,
      customerBalanceDue: balanceDue,
      isCustomerFullyPaid: isFullyPaid,
      customerPaymentStatus: isFullyPaid ? 'Paid in Full' : (totalPaid > 0 ? 'Partially Paid' : 'Unpaid'),
      status, // 'WORK_PENDING', 'ON_HOLD_CUSTOMER_PAYMENT', 'PAYABLE', 'PAID'
      paymentRecord: existingPayment ? {
        id: existingPayment.id,
        amountPaid: roundLKR(existingPayment.amountPaid),
        paymentDate: existingPayment.paymentDate,
        paymentMethod: existingPayment.paymentMethod,
        referenceNo: existingPayment.referenceNo,
        notes: existingPayment.notes,
        recordedByName: existingPayment.recordedByName
      } : null
    });
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    agreedPrice,
    officeAllocation,
    allocations
  };
}

/**
 * Filter and compute weekly metrics across all order allocations
 */
function computeWeeklySalaryMetrics(allAllocations, paidRecordsInPeriod, weekRange) {
  const startMs = weekRange.startOfWeek.getTime();
  const endMs = weekRange.endOfWeek.getTime();

  let totalEarnedInWeek = 0;
  let totalPayableInWeek = 0;
  let totalHeldInWeek = 0;
  let totalWorkPending = 0;
  let totalPaidInWeek = 0;
  let totalCarriedForward = 0;

  const participatingTailorIds = new Set();
  const weeklyAllocationsList = [];
  const carriedForwardList = [];

  for (const alloc of allAllocations) {
    if (alloc.tailorId) {
      participatingTailorIds.add(alloc.tailorId);
    }

    const workCompletedMs = alloc.workCompletedAt ? new Date(alloc.workCompletedAt).getTime() : null;

    // 1. Earned during the selected week:
    // Work completed within [startOfWeek, endOfWeek]
    const isCompletedInWeek = workCompletedMs !== null && workCompletedMs >= startMs && workCompletedMs <= endMs;
    if (isCompletedInWeek) {
      totalEarnedInWeek += alloc.allocatedAmount;
      weeklyAllocationsList.push({
        ...alloc,
        isEarnedInSelectedWeek: true
      });
    }

    // 2. Carried Forward from earlier weeks:
    // Work completed BEFORE startOfWeek, customer fully paid, but NOT paid prior to startOfWeek
    const isCompletedBeforeWeek = workCompletedMs !== null && workCompletedMs < startMs;
    const isPaidBeforeWeek = alloc.paymentRecord && new Date(alloc.paymentRecord.paymentDate).getTime() < startMs;

    if (isCompletedBeforeWeek && alloc.isCustomerFullyPaid && !isPaidBeforeWeek) {
      totalCarriedForward += alloc.allocatedAmount;
      carriedForwardList.push({
        ...alloc,
        isCarriedForward: true
      });
    }

    // 3. Current global / filter status buckets:
    if (alloc.status === 'PAYABLE') {
      totalPayableInWeek += alloc.allocatedAmount;
    } else if (alloc.status === 'ON_HOLD_CUSTOMER_PAYMENT') {
      totalHeldInWeek += alloc.allocatedAmount;
    } else if (alloc.status === 'WORK_PENDING') {
      totalWorkPending += alloc.allocatedAmount;
    }
  }

  // 4. Actual salary paid during the selected week
  for (const pr of paidRecordsInPeriod) {
    const pDateMs = new Date(pr.paymentDate).getTime();
    if (pDateMs >= startMs && pDateMs <= endMs) {
      totalPaidInWeek += Number(pr.amountPaid || 0);
      if (pr.tailorId) participatingTailorIds.add(pr.tailorId);
    }
  }

  return {
    weekRange,
    summary: {
      totalEarnedInWeek: roundLKR(totalEarnedInWeek),
      totalPayable: roundLKR(totalPayableInWeek),
      totalHeldOnCustomerPayment: roundLKR(totalHeldInWeek),
      totalWorkPending: roundLKR(totalWorkPending),
      totalPaidInWeek: roundLKR(totalPaidInWeek),
      totalCarriedForward: roundLKR(totalCarriedForward),
      participatingTailorsCount: participatingTailorIds.size
    },
    weeklyAllocationsList,
    carriedForwardList
  };
}

module.exports = {
  COLOMBO_OFFSET_MINUTES,
  getColomboWeekRange,
  getColomboWeekNumber,
  toColomboDateComponents,
  roundLKR,
  isOrderPriceApproved,
  calculateCustomerPayments,
  extractWorkCompletion,
  calculateOrderSalaryAllocations,
  computeWeeklySalaryMetrics
};
