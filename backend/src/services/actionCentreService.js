/**
 * JB SYSTEM - Daily Action Centre Service
 * 
 * Manages the operational daily action queues and management checklist for JB GROUP and BELLA DESIGN:
 * 1. Overdue Orders (Feature A)
 * 2. Production Delays (Feature B)
 * 3. Unassigned Tasks (Feature C)
 * 4. Price Pending Follow-up (Feature D)
 * 5. Today's Manager Checklist & End-of-Day Summary (Feature E)
 * 6. Quotation Follow-up Queue (Preserved)
 * 7. Collection Follow-up Queue (Preserved)
 * 8. Delivery Follow-up Queue (Preserved)
 * 
 * Strict Business Rules:
 * - Asia/Colombo (UTC+05:30) business date timezone
 * - Verified payments only (Payment.status === 'VERIFIED')
 * - Legacy advancePayment fallback for older records
 * - Super Admin / CEO full multi-branch access; branch staff strictly branch-scoped
 * - Real PostgreSQL records only - zero fake records or double counting
 * - Unique orders count vs total queue items count
 */

const { prisma, pool } = require('../prisma');
const { calculateOrderPayments } = require('./orderPaymentService');

/**
 * Returns YYYY-MM-DD formatted date in Asia/Colombo timezone (UTC+05:30).
 */
function getColomboDateString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Formats timestamp to "DD MMM YYYY • hh:mm A" in Asia/Colombo (e.g. "12 Nov 2026 • 10:30 AM")
 */
function formatColomboDateTime(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;

  const datePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(d);

  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Colombo',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d);

  return `${datePart} • ${timePart}`;
}

/**
 * Calculates calendar day difference (targetDate - baseDate) in days.
 */
function getColomboDayDiff(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return 0;
  const d1 = new Date(dateStr1 + 'T00:00:00Z');
  const d2 = new Date(dateStr2 + 'T00:00:00Z');
  const diffMs = d1.getTime() - d2.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Resolves target delivery date for an order:
 * Explicit deliveryDate/dueDate or standard 7 calendar days from orderDate.
 */
function resolveOrderDeliveryDate(order, followUp) {
  const explicit =
    followUp?.followUpDate ||
    order.deliveryDate ||
    order.dueDate ||
    order.garmentDetails?.deliveryDate;

  if (explicit) {
    return getColomboDateString(explicit);
  }

  if (order.orderDate) {
    const std = new Date(new Date(order.orderDate).getTime() + 7 * 24 * 60 * 60 * 1000);
    return getColomboDateString(std);
  }

  return null;
}

/**
 * Resolves the primary responsible person for an order.
 * Follow-up assignee > Order assigned tailor > First task assigned tailor > "Unassigned".
 */
function resolveResponsiblePerson(order, activeFollowUp) {
  if (activeFollowUp && activeFollowUp.responsiblePersonName) {
    return {
      id: activeFollowUp.responsiblePersonId || null,
      name: activeFollowUp.responsiblePersonName,
      source: 'FOLLOW_UP'
    };
  }

  if (activeFollowUp && activeFollowUp.responsiblePerson?.name) {
    return {
      id: activeFollowUp.responsiblePerson.id,
      name: activeFollowUp.responsiblePerson.name,
      source: 'FOLLOW_UP'
    };
  }

  if (order.assignedTailor?.name) {
    return {
      id: order.assignedTailor.id,
      name: order.assignedTailor.name,
      source: 'ORDER_TAILOR'
    };
  }

  if (Array.isArray(order.tasks) && order.tasks.length > 0) {
    const taskWithTailor = order.tasks.find(t => t.assignedTailor?.name && t.status !== 'COMPLETED');
    if (taskWithTailor) {
      return {
        id: taskWithTailor.assignedTailor.id,
        name: taskWithTailor.assignedTailor.name,
        source: 'TASK_TAILOR'
      };
    }
  }

  return {
    id: null,
    name: 'Unassigned',
    source: 'NONE'
  };
}

/**
 * Fetches and organizes the Daily Action Centre queues.
 */
async function getDailyActionCentreData({ user, branchId, search = '', responsiblePersonId = '', queue = 'all' }) {
  const colomboToday = getColomboDateString();
  const userRole = String(user?.role || '').toUpperCase();
  const isCeo = ['SUPER_ADMIN', 'CEO'].includes(userRole);

  // 1. Branch Scoping Security
  const where = {};
  if (isCeo) {
    if (branchId && String(branchId).trim().toUpperCase() !== 'ALL') {
      const bInt = parseInt(branchId, 10);
      if (bInt > 0) where.branchId = bInt;
    }
  } else {
    const assignedBranch = user?.branchId ? Number(user.branchId) : null;
    if (!assignedBranch) {
      const err = new Error(`Access denied: ${userRole} is not assigned to any branch.`);
      err.statusCode = 403;
      throw err;
    }
    if (branchId) {
      const qBranch = String(branchId).trim().toUpperCase();
      if (qBranch === 'ALL' || parseInt(qBranch, 10) !== assignedBranch) {
        const err = new Error(`Access denied: ${userRole} is restricted to assigned branch (${assignedBranch}).`);
        err.statusCode = 403;
        throw err;
      }
    }
    where.branchId = assignedBranch;
  }

  // 2. Fetch Orders with all necessary relations
  let orders = [];
  try {
    orders = await prisma.order.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      include: {
        customer: true,
        garmentDetails: true,
        branch: true,
        assignedTailor: {
          select: { id: true, name: true, email: true, role: true }
        },
        tasks: {
          include: {
            assignedTailor: {
              select: { id: true, name: true, email: true, role: true }
            }
          },
          orderBy: { sequence: 'asc' }
        },
        payments: {
          orderBy: { createdAt: 'desc' }
        },
        actionFollowUps: {
          include: {
            responsiblePerson: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  } catch (dbErr) {
    console.warn('ActionCentre: Prisma query with relations failed, retrying without actionFollowUps:', dbErr.message);
    orders = await prisma.order.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      include: {
        customer: true,
        garmentDetails: true,
        branch: true,
        assignedTailor: {
          select: { id: true, name: true, email: true, role: true }
        },
        tasks: {
          include: {
            assignedTailor: {
              select: { id: true, name: true, email: true, role: true }
            }
          }
        },
        payments: true
      }
    });
  }

  // 3. Fetch active available tailors in this branch scope for quick assignment
  const tailorWhere = {
    role: { in: ['TAILOR', 'CUTTING', 'EMBROIDERY'] },
    isActive: true
  };
  if (where.branchId) {
    tailorWhere.branchId = where.branchId;
  }
  const availableTailors = await prisma.user.findMany({
    where: tailorWhere,
    select: { id: true, name: true, role: true, branchId: true },
    orderBy: { name: 'asc' }
  });

  // 4. Fetch today's attendance summary (for Manager Checklist & EOD Summary)
  let attendanceSummary = { present: 0, absent: 0, total: 0 };
  try {
    const todayAttendances = await prisma.attendance.findMany({
      where: { date: colomboToday }
    });
    const presentCount = todayAttendances.filter(a => a.status === 'Present').length;
    const absentCount = todayAttendances.filter(a => a.status === 'Absent').length;
    attendanceSummary = {
      present: presentCount,
      absent: absentCount,
      total: todayAttendances.length
    };
  } catch (attErr) {
    console.warn('ActionCentre: attendance query failed:', attErr.message);
  }

  // 5. Queues
  const quotationQueue = [];
  const collectionQueue = [];
  const deliveryQueue = [];
  const overdueQueue = [];
  const productionDelayQueue = [];
  const unassignedQueue = [];
  const pricePendingQueue = [];

  const uniqueOrderIds = new Set();
  let totalOutstandingBalance = 0;
  let overdueDeliveriesCount = 0;
  let dueTodayDeliveriesCount = 0;
  let readyForDeliveryCount = 0;

  for (const order of orders) {
    const rawStatus = order.status || '';
    if (['CANCELLED', 'REJECTED'].includes(rawStatus)) {
      continue;
    }

    const followUps = Array.isArray(order.actionFollowUps) ? order.actionFollowUps : [];
    const quoFollowUp = followUps.find(f => f.queueType === 'QUOTATION' && f.status !== 'COMPLETED');
    const colFollowUp = followUps.find(f => f.queueType === 'COLLECTION' && f.status !== 'COMPLETED');
    const delFollowUp = followUps.find(f => f.queueType === 'DELIVERY' && f.status !== 'COMPLETED');

    const paymentsCalc = calculateOrderPayments(order);
    const { totalAmount, amountPaid, balanceDue, isPricePending } = paymentsCalc;

    const customerName = order.customer?.name || order.customerName || 'Customer';
    const customerPhone = order.customer?.primaryPhone || order.customer?.secondaryPhone || '';
    const branchName = order.branch?.name || (order.branchId === 2 ? 'Bella Design' : 'JB Group (Main)');
    const itemName = order.garmentDetails?.dressType || order.dressType || 'Bespoke Garment';
    const quantity = Number(order.garmentDetails?.quantity || 1);

    const isDeliveredOrComplete = ['DELIVERED', 'COMPLETED'].includes(rawStatus);
    const isReady = rawStatus === 'READY';
    const promisedDeliveryDateColombo = resolveOrderDeliveryDate(order, delFollowUp);

    // ========================================================
    // A. FEATURE A: OVERDUE ORDERS
    // ========================================================
    if (!isDeliveredOrComplete && promisedDeliveryDateColombo && promisedDeliveryDateColombo < colomboToday) {
      const daysOverdue = getColomboDayDiff(colomboToday, promisedDeliveryDateColombo);
      const isCritical = daysOverdue >= 3 || balanceDue > 10000 || rawStatus === 'PENDING_APPROVAL';

      overdueQueue.push({
        queueType: 'OVERDUE',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName,
        customerPhone,
        customerEmail: order.customer?.email || '',
        branchId: order.branchId || 1,
        branchName,
        itemName,
        quantity,
        productionStatus: rawStatus,
        assignedTailor: order.assignedTailor?.name || 'Unassigned',
        assignedTailorId: order.assignedTailorId || null,
        promisedDate: promisedDeliveryDateColombo,
        daysOverdue,
        totalAmount,
        amountPaid,
        balanceDue,
        priority: isCritical ? 'CRITICAL' : 'HIGH',
        priorityLabel: isCritical ? 'Critical Overdue' : 'Overdue',
        nextAction: `Expedite ${rawStatus} stage (${daysOverdue}d overdue)`,
        order
      });
      uniqueOrderIds.add(order.id);
    }

    // ========================================================
    // B. FEATURE B: PRODUCTION DELAYS
    // ========================================================
    if (!isDeliveredOrComplete) {
      const orderOverdue = promisedDeliveryDateColombo && promisedDeliveryDateColombo < colomboToday;
      const orderDueToday = promisedDeliveryDateColombo && promisedDeliveryDateColombo === colomboToday;

      // Incomplete tasks
      const activeTasks = (order.tasks || []).filter(t => !['COMPLETED', 'CANCELLED'].includes(t.status));
      if (activeTasks.length > 0) {
        for (const task of activeTasks) {
          let isTaskDelayed = false;
          let delayReason = '';
          let priority = 'NORMAL';

          if (orderOverdue) {
            isTaskDelayed = true;
            const d = getColomboDayDiff(colomboToday, promisedDeliveryDateColombo);
            delayReason = `Order overdue by ${d} day${d === 1 ? '' : 's'}`;
            priority = d >= 3 ? 'CRITICAL' : 'HIGH';
          } else if (orderDueToday && rawStatus !== 'READY') {
            isTaskDelayed = true;
            delayReason = 'Order due today, stage incomplete';
            priority = 'CRITICAL';
          } else if (task.startedAt) {
            const daysInProg = getColomboDayDiff(colomboToday, getColomboDateString(task.startedAt));
            if (daysInProg >= 2) {
              isTaskDelayed = true;
              delayReason = `Task in progress for ${daysInProg} days`;
              priority = daysInProg >= 4 ? 'CRITICAL' : 'HIGH';
            }
          } else if (task.assignedAt) {
            const daysAssigned = getColomboDayDiff(colomboToday, getColomboDateString(task.assignedAt));
            if (daysAssigned >= 3) {
              isTaskDelayed = true;
              delayReason = `Task assigned ${daysAssigned} days ago, pending start`;
              priority = 'HIGH';
            }
          }

          if (isTaskDelayed) {
            productionDelayQueue.push({
              queueType: 'PRODUCTION_DELAY',
              orderId: order.id,
              orderNumber: order.orderNumber,
              customerId: order.customerId,
              customerName,
              customerPhone,
              branchId: order.branchId || 1,
              branchName,
              itemName,
              quantity,
              currentStage: rawStatus,
              taskId: task.id,
              taskType: task.taskType,
              taskName: task.taskName || task.taskType,
              assignedEmployee: task.assignedTailor?.name || order.assignedTailor?.name || 'Unassigned',
              assignedEmployeeId: task.assignedTailorId || order.assignedTailorId || null,
              delayReason,
              promisedDate: promisedDeliveryDateColombo || 'Standard',
              priority,
              priorityLabel: priority === 'CRITICAL' ? 'Critical Delay' : priority === 'HIGH' ? 'High Delay' : 'Delayed',
              nextAction: `Follow up with ${task.assignedTailor?.name || 'assigned craftsman'} on ${task.taskName || task.taskType}`,
              order
            });
            uniqueOrderIds.add(order.id);
          }
        }
      } else if (['ORDER_CONFIRMED', 'CUTTING', 'STITCHING', 'FINISHING', 'QUALITY_CHECK'].includes(rawStatus)) {
        // Order in production stage without granular tasks
        if (orderOverdue || orderDueToday) {
          const d = orderOverdue ? getColomboDayDiff(colomboToday, promisedDeliveryDateColombo) : 0;
          const priority = d >= 3 ? 'CRITICAL' : 'HIGH';
          productionDelayQueue.push({
            queueType: 'PRODUCTION_DELAY',
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            customerName,
            customerPhone,
            branchId: order.branchId || 1,
            branchName,
            itemName,
            quantity,
            currentStage: rawStatus,
            taskId: null,
            taskType: rawStatus,
            taskName: rawStatus.replace(/_/g, ' '),
            assignedEmployee: order.assignedTailor?.name || 'Unassigned',
            assignedEmployeeId: order.assignedTailorId || null,
            delayReason: orderOverdue ? `Order overdue by ${d} day${d === 1 ? '' : 's'}` : 'Order due today, not ready',
            promisedDate: promisedDeliveryDateColombo || 'Standard',
            priority,
            priorityLabel: priority === 'CRITICAL' ? 'Critical Delay' : 'High Delay',
            nextAction: `Expedite ${rawStatus} stage with craftsman`,
            order
          });
          uniqueOrderIds.add(order.id);
        }
      }
    }

    // ========================================================
    // C. FEATURE C: UNASSIGNED TASKS
    // ========================================================
    if (!isDeliveredOrComplete) {
      const unassignedOrderTasks = (order.tasks || []).filter(t => !t.assignedTailorId && !['COMPLETED', 'CANCELLED'].includes(t.status));

      if (unassignedOrderTasks.length > 0) {
        for (const t of unassignedOrderTasks) {
          const isUrgent = promisedDeliveryDateColombo && promisedDeliveryDateColombo <= colomboToday;
          unassignedQueue.push({
            queueType: 'UNASSIGNED',
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            customerName,
            customerPhone,
            branchId: order.branchId || 1,
            branchName,
            itemName,
            quantity,
            taskId: t.id,
            taskType: t.taskType,
            requiredTask: t.taskName || t.taskType,
            productionStatus: rawStatus,
            orderDate: getColomboDateString(order.orderDate || order.createdAt),
            promisedDate: promisedDeliveryDateColombo || 'Standard',
            priority: isUrgent ? 'CRITICAL' : 'HIGH',
            priorityLabel: isUrgent ? 'Critical Unassigned' : 'Pending Assignment',
            nextAction: `Assign ${t.taskName || t.taskType} craftsman`,
            order
          });
          uniqueOrderIds.add(order.id);
        }
      } else if (!order.assignedTailorId && ['ORDER_CONFIRMED', 'CUSTOMER_APPROVED', 'PENDING_PRODUCTION', 'CUTTING', 'STITCHING'].includes(rawStatus)) {
        const isUrgent = promisedDeliveryDateColombo && promisedDeliveryDateColombo <= colomboToday;
        unassignedQueue.push({
          queueType: 'UNASSIGNED',
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          customerName,
          customerPhone,
          branchId: order.branchId || 1,
          branchName,
          itemName,
          quantity,
          taskId: null,
          taskType: 'TAILOR',
          requiredTask: 'Master Tailor Assignment',
          productionStatus: rawStatus,
          orderDate: getColomboDateString(order.orderDate || order.createdAt),
          promisedDate: promisedDeliveryDateColombo || 'Standard',
          priority: isUrgent ? 'CRITICAL' : 'NORMAL',
          priorityLabel: isUrgent ? 'Critical Unassigned' : 'Pending Assignment',
          nextAction: 'Assign master tailor to commence production',
          order
        });
        uniqueOrderIds.add(order.id);
      }
    }

    // ========================================================
    // D. FEATURE D: PRICE PENDING FOLLOW-UP
    // ========================================================
    const isPriceAwaiting =
      !isDeliveredOrComplete &&
      !order.priceAcceptedByCustomer &&
      order.priceStatus !== 'ACCEPTED' &&
      (isPricePending ||
        order.priceStatus === 'PENDING' ||
        order.priceStatus === 'SENT' ||
        ['WAITING_CUSTOMER_APPROVAL', 'PRICE_SET', 'PRICE_PENDING', 'PENDING_APPROVAL'].includes(rawStatus));

    if (isPriceAwaiting) {
      const sentDateRaw = order.priceSentAt || order.priceSetAt || order.createdAt;
      const sentDateColombo = getColomboDateString(sentDateRaw) || colomboToday;
      const daysWaiting = Math.max(0, getColomboDayDiff(colomboToday, sentDateColombo));
      const priority = daysWaiting >= 4 ? 'CRITICAL' : daysWaiting >= 2 ? 'HIGH' : 'NORMAL';

      let approvalStatusText = 'Pending Price Approval';
      if (order.priceStatus === 'SENT' || rawStatus === 'WAITING_CUSTOMER_APPROVAL') {
        approvalStatusText = 'Quotation Sent - Awaiting Approval';
      } else if (order.priceStatus === 'PENDING' || isPricePending) {
        approvalStatusText = 'Pricing Estimation Pending';
      }

      const quotationNo = order.quotationNumber ||
        (order.orderNumber ? order.orderNumber.replace(/^(JB|BELLA)-/i, 'QT-') : `QT-${order.id}`);

      pricePendingQueue.push({
        queueType: 'PRICE_PENDING',
        orderId: order.id,
        orderNumber: order.orderNumber,
        quotationNumber: quotationNo,
        customerId: order.customerId,
        customerName,
        customerPhone,
        customerEmail: order.customer?.email || '',
        branchId: order.branchId || 1,
        branchName,
        itemName,
        quantity,
        totalAmount,
        approvalStatus: approvalStatusText,
        sentDate: sentDateColombo,
        daysWaiting,
        priority,
        priorityLabel: priority === 'CRITICAL' ? 'Critical Price Action' : priority === 'HIGH' ? 'High Follow-up' : 'Pending Approval',
        nextAction: daysWaiting >= 3 ? 'Call customer to confirm quotation' : 'Follow up with customer on pricing quote',
        order
      });
      uniqueOrderIds.add(order.id);
    }

    // ========================================================
    // 1. QUEUE 1: QUOTATION FOLLOW-UP (Preserved)
    // ========================================================
    const isQuotationAwaiting =
      (order.priceStatus === 'SENT' ||
        rawStatus === 'WAITING_CUSTOMER_APPROVAL' ||
        rawStatus === 'PRICE_SET') &&
      !order.priceAcceptedByCustomer &&
      rawStatus !== 'PRICE_DECLINED' &&
      !isDeliveredOrComplete;

    if (isQuotationAwaiting) {
      const resp = resolveResponsiblePerson(order, quoFollowUp);
      const sentDateRaw = order.priceSentAt || order.priceSetAt || order.bookingNotificationSentAt || order.orderDate;
      const sentDateColombo = getColomboDateString(sentDateRaw) || colomboToday;
      const daysAwaiting = Math.max(0, getColomboDayDiff(colomboToday, sentDateColombo));
      const followUpDateColombo = quoFollowUp?.followUpDate ? getColomboDateString(quoFollowUp.followUpDate) : null;

      const quotationNo = order.quotationNumber ||
        (order.orderNumber ? order.orderNumber.replace(/^(JB|BELLA)-/i, 'QT-') : `QT-${order.id}`);

      let nextAction = quoFollowUp?.nextAction;
      if (!nextAction) {
        if (daysAwaiting >= 3) {
          nextAction = 'Urgent: Follow up on quotation via WhatsApp';
        } else if (daysAwaiting >= 1) {
          nextAction = 'Check customer quotation feedback';
        } else {
          nextAction = 'Awaiting customer quotation confirmation';
        }
      }

      quotationQueue.push({
        queueType: 'QUOTATION',
        orderId: order.id,
        orderNumber: order.orderNumber,
        quotationNumber: quotationNo,
        customerId: order.customerId,
        customerName,
        customerPhone,
        customerEmail: order.customer?.email || '',
        branchId: order.branchId || 1,
        branchName,
        itemName,
        quantity,
        totalAmount,
        sentDate: sentDateColombo,
        daysAwaiting,
        followUpDate: followUpDateColombo,
        responsiblePerson: resp.name,
        responsiblePersonId: resp.id,
        nextAction,
        priority: daysAwaiting >= 3 ? 'CRITICAL' : daysAwaiting >= 1 ? 'HIGH' : 'NORMAL',
        followUpId: quoFollowUp?.id || null,
        followUpStatus: quoFollowUp?.status || 'PENDING',
        outcome: quoFollowUp?.outcome || null,
        order
      });
      uniqueOrderIds.add(order.id);
    }

    // ========================================================
    // 2. QUEUE 2: COLLECTION FOLLOW-UP (Preserved)
    // ========================================================
    const isPriceConfirmed =
      order.priceAcceptedByCustomer ||
      order.priceStatus === 'ACCEPTED' ||
      (!isPricePending && totalAmount > 0 && !['WAITING_CUSTOMER_APPROVAL', 'PRICE_SET', 'PENDING_APPROVAL'].includes(rawStatus));

    const isCollectionAwaiting = isPriceConfirmed && balanceDue > 0;

    if (isCollectionAwaiting) {
      totalOutstandingBalance += balanceDue;

      const resp = resolveResponsiblePerson(order, colFollowUp);
      const scheduledDateRaw = colFollowUp?.followUpDate || order.deliveryDate || order.dueDate || order.garmentDetails?.deliveryDate;
      const scheduledDateColombo = scheduledDateRaw ? getColomboDateString(scheduledDateRaw) : null;
      const isOverdueCollection = scheduledDateColombo && scheduledDateColombo < colomboToday;

      let nextAction = colFollowUp?.nextAction;
      if (!nextAction) {
        if (isReady) {
          nextAction = 'Collect full balance on garment pickup';
        } else if (isDeliveredOrComplete) {
          nextAction = 'Follow up on post-delivery balance settlement';
        } else if (isOverdueCollection) {
          nextAction = 'Urgent: Send balance reminder on WhatsApp';
        } else if (amountPaid === 0) {
          nextAction = 'Request advance payment for bespoke tailoring';
        } else {
          nextAction = 'Follow up on remaining balance due';
        }
      }

      let priorityScore = 40;
      let priority = 'NORMAL';
      if (isReady) { priorityScore = 100; priority = 'CRITICAL'; }
      else if (isOverdueCollection) { priorityScore = 80; priority = 'HIGH'; }
      else if (isDeliveredOrComplete) { priorityScore = 60; priority = 'HIGH'; }

      collectionQueue.push({
        queueType: 'COLLECTION',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName,
        customerPhone,
        customerEmail: order.customer?.email || '',
        branchId: order.branchId || 1,
        branchName,
        itemName,
        quantity,
        totalAmount,
        amountPaid,
        balanceDue,
        productionStatus: rawStatus,
        isReady,
        isDelivered: isDeliveredOrComplete,
        isOverdueCollection,
        scheduledDate: scheduledDateColombo,
        responsiblePerson: resp.name,
        responsiblePersonId: resp.id,
        nextAction,
        priority,
        priorityScore,
        followUpId: colFollowUp?.id || null,
        followUpStatus: colFollowUp?.status || 'PENDING',
        outcome: colFollowUp?.outcome || null,
        order
      });
      uniqueOrderIds.add(order.id);
    }

    // ========================================================
    // 3. QUEUE 3: DELIVERY FOLLOW-UP (Preserved)
    // ========================================================
    if (!isDeliveredOrComplete) {
      let urgency = null;
      let daysOverdue = 0;

      if (promisedDeliveryDateColombo) {
        const diff = getColomboDayDiff(colomboToday, promisedDeliveryDateColombo);
        if (diff > 0) {
          urgency = 'OVERDUE';
          daysOverdue = diff;
          overdueDeliveriesCount++;
        } else if (diff === 0) {
          urgency = 'DUE_TODAY';
          dueTodayDeliveriesCount++;
        }
      }

      if (isReady) {
        readyForDeliveryCount++;
        if (!urgency) {
          urgency = 'READY';
        }
      }

      if (urgency) {
        const resp = resolveResponsiblePerson(order, delFollowUp);

        let nextAction = delFollowUp?.nextAction;
        if (!nextAction) {
          if (isReady) {
            nextAction = 'Garment ready: Dispatch delivery notification / Call customer';
          } else if (urgency === 'OVERDUE') {
            nextAction = `Critical: Expedite ${rawStatus} stage (${daysOverdue}d overdue)`;
          } else if (urgency === 'DUE_TODAY') {
            nextAction = `Due today: Expedite finishing and quality check`;
          } else {
            nextAction = `Proceed with ${rawStatus} production`;
          }
        }

        const priority = urgency === 'OVERDUE' ? 'CRITICAL' : urgency === 'DUE_TODAY' ? 'HIGH' : isReady ? 'HIGH' : 'NORMAL';

        deliveryQueue.push({
          queueType: 'DELIVERY',
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          customerName,
          customerPhone,
          customerEmail: order.customer?.email || '',
          branchId: order.branchId || 1,
          branchName,
          itemName,
          quantity,
          promisedDate: promisedDeliveryDateColombo || 'Standard',
          urgency,
          daysOverdue,
          productionStatus: rawStatus,
          isReady,
          totalAmount,
          balanceDue,
          responsiblePerson: resp.name,
          responsiblePersonId: resp.id,
          nextAction,
          priority,
          followUpId: delFollowUp?.id || null,
          followUpStatus: delFollowUp?.status || 'PENDING',
          outcome: delFollowUp?.outcome || null,
          order
        });
        uniqueOrderIds.add(order.id);
      }
    }
  }

  // 6. Sort Queues
  overdueQueue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  productionDelayQueue.sort((a, b) => (b.priority === 'CRITICAL' ? 1 : 0) - (a.priority === 'CRITICAL' ? 1 : 0));
  unassignedQueue.sort((a, b) => (b.priority === 'CRITICAL' ? 1 : 0) - (a.priority === 'CRITICAL' ? 1 : 0));
  pricePendingQueue.sort((a, b) => b.daysWaiting - a.daysWaiting);
  collectionQueue.sort((a, b) => b.priorityScore - a.priorityScore);
  deliveryQueue.sort((a, b) => {
    if (a.urgency === 'OVERDUE' && b.urgency !== 'OVERDUE') return -1;
    if (b.urgency === 'OVERDUE' && a.urgency !== 'OVERDUE') return 1;
    if (a.urgency === 'OVERDUE' && b.urgency === 'OVERDUE') return b.daysOverdue - a.daysOverdue;
    if (a.urgency === 'DUE_TODAY' && b.urgency !== 'DUE_TODAY') return -1;
    if (b.urgency === 'DUE_TODAY' && a.urgency !== 'DUE_TODAY') return 1;
    return 0;
  });

  // 7. Filter helper for search query and responsible person
  const applyFilters = (list) => {
    let filtered = list;

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(item => {
        return (
          item.customerName?.toLowerCase().includes(q) ||
          item.orderNumber?.toLowerCase().includes(q) ||
          item.customerPhone?.toLowerCase().includes(q) ||
          item.quotationNumber?.toLowerCase().includes(q) ||
          item.itemName?.toLowerCase().includes(q) ||
          item.requiredTask?.toLowerCase().includes(q) ||
          item.taskName?.toLowerCase().includes(q) ||
          item.assignedEmployee?.toLowerCase().includes(q) ||
          item.assignedTailor?.toLowerCase().includes(q)
        );
      });
    }

    if (responsiblePersonId && responsiblePersonId.trim()) {
      const rId = responsiblePersonId.trim();
      if (rId.toUpperCase() === 'UNASSIGNED') {
        filtered = filtered.filter(item =>
          item.responsiblePerson === 'Unassigned' ||
          !item.responsiblePersonId ||
          item.assignedEmployee === 'Unassigned' ||
          item.assignedTailor === 'Unassigned'
        );
      } else {
        const idNum = parseInt(rId, 10);
        filtered = filtered.filter(item =>
          item.responsiblePersonId === idNum ||
          item.assignedTailorId === idNum ||
          item.assignedEmployeeId === idNum
        );
      }
    }

    return filtered;
  };

  const filteredQuotationQueue = applyFilters(quotationQueue);
  const filteredCollectionQueue = applyFilters(collectionQueue);
  const filteredDeliveryQueue = applyFilters(deliveryQueue);
  const filteredOverdueQueue = applyFilters(overdueQueue);
  const filteredProductionDelayQueue = applyFilters(productionDelayQueue);
  const filteredUnassignedQueue = applyFilters(unassignedQueue);
  const filteredPricePendingQueue = applyFilters(pricePendingQueue);

  // 8. Staff for filter dropdown
  const staffMap = new Map();
  [...quotationQueue, ...collectionQueue, ...deliveryQueue, ...overdueQueue, ...productionDelayQueue].forEach(it => {
    const sId = it.responsiblePersonId || it.assignedTailorId || it.assignedEmployeeId;
    const sName = it.responsiblePerson || it.assignedTailor || it.assignedEmployee;
    if (sId && sName && sName !== 'Unassigned') {
      staffMap.set(sId, { id: sId, name: sName });
    }
  });

  // 9. End-of-Day Summary Metrics (Real database calculations)
  const todayOrders = orders.filter(o => getColomboDateString(o.createdAt || o.orderDate) === colomboToday);
  const newOrdersTodayCount = todayOrders.length;

  // Today's Orders Summary calculations (Strictly for orders created today in Asia/Colombo)
  let todayOrderValue = 0;
  let todayPaymentsReceived = 0;
  let todayOutstandingBalance = 0;
  let todayPriceAcceptedCount = 0;
  let todayPricePendingCount = 0;
  let todayUnassignedTasksCount = 0;

  for (const o of todayOrders) {
    const calc = calculateOrderPayments(o);
    todayOrderValue += calc.totalAmount;
    todayPaymentsReceived += calc.amountPaid;
    todayOutstandingBalance += calc.balanceDue;

    const isConfirmed = o.priceAcceptedByCustomer || o.priceStatus === 'ACCEPTED' || (!calc.isPricePending && calc.totalAmount > 0);
    if (isConfirmed) {
      todayPriceAcceptedCount++;
    } else {
      todayPricePendingCount++;
    }

    const unassignedInOrder = (o.tasks || []).filter(t => !t.assignedTailorId && !['COMPLETED', 'CANCELLED'].includes(t.status));
    if (unassignedInOrder.length > 0) {
      todayUnassignedTasksCount += unassignedInOrder.length;
    } else if (!o.assignedTailorId) {
      todayUnassignedTasksCount += 1;
    }
  }

  const todayOrdersSummary = {
    ordersCreatedToday: todayOrders.length,
    todayOrderValue: Math.round(todayOrderValue * 100) / 100,
    todayPaymentsReceived: Math.round(todayPaymentsReceived * 100) / 100,
    todayOutstandingBalance: Math.round(todayOutstandingBalance * 100) / 100,
    priceAcceptedCount: todayPriceAcceptedCount,
    pricePendingCount: todayPricePendingCount,
    todayUnassignedTasksCount,
    allOutstandingCollections: Math.round(totalOutstandingBalance * 100) / 100
  };

  const completedTodayCount = orders.filter(o => {
    const compDate = o.completedAt ? getColomboDateString(o.completedAt) : (o.status === 'READY' || o.status === 'COMPLETED' ? getColomboDateString(o.updatedAt) : null);
    return compDate === colomboToday;
  }).length;

  const deliveredTodayCount = orders.filter(o => {
    const delDate = o.deliveredAt ? getColomboDateString(o.deliveredAt) : (o.status === 'DELIVERED' ? getColomboDateString(o.updatedAt) : null);
    return delDate === colomboToday;
  }).length;

  const totalQueueItems =
    overdueQueue.length +
    productionDelayQueue.length +
    unassignedQueue.length +
    pricePendingQueue.length +
    quotationQueue.length +
    collectionQueue.length +
    deliveryQueue.length;

  // 10. Today's Manager Checklist (Feature E - Live PostgreSQL backed)
  // Fix 3: In CEO ALL view, do not fall back to CEO's personal user.branchId
  let savedChecklistRecords = [];
  try {
    const checklistWhere = {
      businessDate: colomboToday
    };

    if (isCeo) {
      if (where.branchId) {
        checklistWhere.branchId = where.branchId;
      }
      // If CEO views ALL branches, where.branchId is undefined so checklistWhere has no branchId (all branches included)
    } else {
      // Non-CEO manager: strictly restricted to their assigned branch and their own user ID
      checklistWhere.branchId = where.branchId;
      if (user?.id) {
        checklistWhere.userId = user.id;
      }
    }

    savedChecklistRecords = await prisma.managerDailyChecklist.findMany({
      where: checklistWhere
    });
  } catch (err) {
    console.warn('ActionCentre: Could not fetch managerDailyChecklist records:', err.message);
  }

  // Fix 5: Key records by Branch ID + Manager ID + Checklist Item ID so records never mix across managers or branches
  const checklistRecordsMap = new Map();
  for (const r of savedChecklistRecords) {
    const key = `${r.branchId}_${r.userId}_${r.checklistItemId}`;
    checklistRecordsMap.set(key, r);
  }

  const resolveItemStatus = (itemId) => {
    let saved = null;
    if (!isCeo && user?.id) {
      // Manager view: strictly their own checklist record
      const key = `${where.branchId}_${user.id}_${itemId}`;
      saved = checklistRecordsMap.get(key) || null;
    } else if (where.branchId) {
      // CEO viewing a specific branch: find record for this branch and itemId
      for (const r of savedChecklistRecords) {
        if (r.branchId === where.branchId && r.checklistItemId === itemId) {
          saved = r;
          if (r.status === 'COMPLETED') break;
        }
      }
    } else {
      // CEO viewing ALL branches: find record for itemId without mixing across managers
      for (const r of savedChecklistRecords) {
        if (r.checklistItemId === itemId) {
          saved = r;
          if (r.status === 'COMPLETED') break;
        }
      }
    }

    const isCompleted = saved?.status === 'COMPLETED';
    return {
      status: isCompleted ? 'COMPLETED' : 'PENDING',
      isCompleted,
      completedBy: saved?.completedByName || null,
      completedAt: saved?.completedAt || null,
      completedAtFormatted: saved?.completedAt ? formatColomboDateTime(saved.completedAt) : null,
      notes: saved?.notes || null
    };
  };

  const checklist = {
    overdueOrders: {
      id: 'overdueOrders',
      title: 'Check Overdue Orders',
      description: 'Review orders whose promised delivery date has passed',
      count: overdueQueue.length,
      priority: overdueQueue.length > 0 ? 'CRITICAL' : 'NORMAL',
      targetQueue: 'overdue',
      ...resolveItemStatus('overdueOrders')
    },
    unassignedTasks: {
      id: 'unassignedTasks',
      title: 'Assign Unassigned Production Tasks',
      description: 'Allocate active orders and tasks to craftsmen',
      count: unassignedQueue.length,
      priority: unassignedQueue.length > 0 ? 'HIGH' : 'NORMAL',
      targetQueue: 'unassigned',
      ...resolveItemStatus('unassignedTasks')
    },
    pricePending: {
      id: 'pricePending',
      title: 'Follow Up Price Pending Orders',
      description: 'Contact customers awaiting price confirmation or quotation',
      count: pricePendingQueue.length,
      priority: pricePendingQueue.length > 0 ? 'HIGH' : 'NORMAL',
      targetQueue: 'pricePending',
      ...resolveItemStatus('pricePending')
    },
    customerCollections: {
      id: 'customerCollections',
      title: 'Follow Up Customer Collections',
      description: 'Collect outstanding balance payments on orders',
      count: collectionQueue.length,
      totalBalance: Math.round(totalOutstandingBalance * 100) / 100,
      priority: collectionQueue.length > 0 ? 'HIGH' : 'NORMAL',
      targetQueue: 'collection',
      ...resolveItemStatus('customerCollections')
    },
    readyGarments: {
      id: 'readyGarments',
      title: 'Check Ready Garments for Delivery',
      description: 'Dispatch customer delivery notifications for completed garments',
      count: readyForDeliveryCount,
      priority: readyForDeliveryCount > 0 ? 'HIGH' : 'NORMAL',
      targetQueue: 'delivery',
      ...resolveItemStatus('readyGarments')
    },
    staffAttendance: {
      id: 'staffAttendance',
      title: 'Review Staff Attendance',
      description: 'Verify attendance records for today',
      presentCount: attendanceSummary.present,
      totalStaff: attendanceSummary.total,
      priority: attendanceSummary.present === 0 ? 'HIGH' : 'NORMAL',
      targetQueue: null,
      ...resolveItemStatus('staffAttendance')
    }
  };

  const completedChecklistCount = Object.values(checklist).filter(i => i.status === 'COMPLETED').length;
  const checklistProgress = {
    completed: completedChecklistCount,
    total: 6,
    percentage: Math.round((completedChecklistCount / 6) * 100),
    label: `${completedChecklistCount}/6 Completed`
  };

  const endOfDaySummary = {
    ordersCompletedToday: completedTodayCount,
    ordersDeliveredToday: deliveredTodayCount,
    newOrdersReceivedToday: newOrdersTodayCount,
    outstandingCollections: Math.round(totalOutstandingBalance * 100) / 100,
    overdueProductionTasks: productionDelayQueue.length,
    pendingManagerActions: overdueQueue.length + unassignedQueue.length + (pricePendingQueue.length > 0 ? 1 : 0) + (collectionQueue.length > 0 ? 1 : 0)
  };

  return {
    businessDate: colomboToday,
    timezone: 'Asia/Colombo',
    summary: {
      totalQueueItems,
      uniqueOrdersCount: uniqueOrderIds.size,
      overdueCount: overdueQueue.length,
      productionDelaysCount: productionDelayQueue.length,
      unassignedCount: unassignedQueue.length,
      pricePendingCount: pricePendingQueue.length,
      quotationsCount: quotationQueue.length,
      collectionsCount: collectionQueue.length,
      deliveriesCount: deliveryQueue.length,
      totalOutstandingBalance: Math.round(totalOutstandingBalance * 100) / 100,
      overdueDeliveriesCount,
      dueTodayDeliveriesCount,
      readyForDeliveryCount,
      todayOrdersSummary,
      checklistProgress
    },
    todayOrdersSummary,
    checklist,
    checklistProgress,
    endOfDaySummary,
    filterOptions: {
      responsiblePersons: Array.from(staffMap.values()),
      availableTailors
    },
    overdueQueue: filteredOverdueQueue,
    productionDelayQueue: filteredProductionDelayQueue,
    unassignedQueue: filteredUnassignedQueue,
    pricePendingQueue: filteredPricePendingQueue,
    quotationQueue: filteredQuotationQueue,
    collectionQueue: filteredCollectionQueue,
    deliveryQueue: filteredDeliveryQueue
  };
}

/**
 * Creates or updates an Action Follow-up record.
 */
async function recordActionFollowUp({
  user,
  orderId,
  queueType,
  followUpDate,
  responsiblePersonId,
  nextAction,
  outcome,
  status = 'PENDING',
  notes
}) {
  const parsedOrderId = parseInt(orderId, 10);
  if (isNaN(parsedOrderId)) {
    throw new Error('Valid order ID is required.');
  }

  const order = await prisma.order.findUnique({
    where: { id: parsedOrderId },
    include: { branch: true }
  });

  if (!order) {
    throw new Error('Order not found.');
  }

  const userRole = String(user?.role || '').toUpperCase();
  const isCeo = ['SUPER_ADMIN', 'CEO'].includes(userRole);
  if (!isCeo) {
    const userBranch = Number(user?.branchId);
    if (!userBranch) {
      const err = new Error('Access denied: User is not assigned to any valid branch.');
      err.statusCode = 403;
      throw err;
    }
    const orderBranch = Number(order.branchId);
    if (!orderBranch || userBranch !== orderBranch) {
      const err = new Error('Access denied: Cannot record follow-up on order in another branch.');
      err.statusCode = 403;
      throw err;
    }
  }

  let responsiblePersonName = null;
  const respId = responsiblePersonId ? parseInt(responsiblePersonId, 10) : null;
  if (respId) {
    const respUser = await prisma.user.findUnique({
      where: { id: respId },
      select: { name: true }
    });
    if (respUser) responsiblePersonName = respUser.name;
  }

  const actorName = user?.name || user?.email || 'Authorized Staff';
  const isCompleted = status === 'COMPLETED';

  let followUpRecord;
  try {
    followUpRecord = await prisma.actionFollowUp.create({
      data: {
        orderId: parsedOrderId,
        queueType: String(queueType).toUpperCase(),
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        responsiblePersonId: respId,
        responsiblePersonName,
        assignedBy: actorName,
        status: status || 'PENDING',
        outcome: outcome || null,
        nextAction: nextAction || null,
        notes: notes || null,
        completedAt: isCompleted ? new Date() : null,
        completedBy: isCompleted ? actorName : null
      }
    });
  } catch (dbErr) {
    console.warn('Prisma create ActionFollowUp failed, executing raw insert:', dbErr.message);
    const client = await pool.connect();
    try {
      const res = await client.query(`
        INSERT INTO "ActionFollowUp" (
          "orderId", "queueType", "followUpDate", "responsiblePersonId",
          "responsiblePersonName", "assignedBy", "status", "outcome",
          "nextAction", "notes", "completedAt", "completedBy", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING *;
      `, [
        parsedOrderId,
        String(queueType).toUpperCase(),
        followUpDate ? new Date(followUpDate) : null,
        respId,
        responsiblePersonName,
        actorName,
        status || 'PENDING',
        outcome || null,
        nextAction || null,
        notes || null,
        isCompleted ? new Date() : null,
        isCompleted ? actorName : null
      ]);
      followUpRecord = res.rows[0];
    } finally {
      client.release();
    }
  }

  try {
    await prisma.auditLog.create({
      data: {
        action: isCompleted ? 'FOLLOW_UP_COMPLETED' : 'FOLLOW_UP_SCHEDULED',
        entityType: 'ORDER',
        entityId: parsedOrderId,
        userRole: userRole,
        userId: user?.id || null,
        userName: actorName,
        details: {
          queueType,
          nextAction,
          outcome,
          responsiblePersonName,
          status
        }
      }
    });
  } catch (auditErr) {
    console.warn('AuditLog error in recordActionFollowUp:', auditErr.message);
  }

  return followUpRecord;
}

/**
 * Mark a checklist item as completed or pending in PostgreSQL with audit log.
 */
async function completeChecklistItem({ user, checklistItemId, status = 'COMPLETED', notes = '', businessDate }) {
  if (!user || !user.id) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }

  const validItems = [
    'overdueOrders',
    'unassignedTasks',
    'pricePending',
    'customerCollections',
    'readyGarments',
    'staffAttendance'
  ];

  if (!validItems.includes(checklistItemId)) {
    const err = new Error(`Invalid checklist item ID "${checklistItemId}". Must be one of: ${validItems.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const userRole = String(user.role || '').toUpperCase();
  const isCeo = ['SUPER_ADMIN', 'CEO'].includes(userRole);
  if (isCeo) {
    const err = new Error('Access denied: CEO and Super Admin have read-only monitoring access to Manager Daily Checklists and cannot complete, update, or modify checklist items.');
    err.statusCode = 403;
    throw err;
  }

  const isManager = ['MANAGER', 'ADMIN', 'Manager'].includes(userRole);
  if (!isManager) {
    const err = new Error('Access denied: Only managers or branch admins can complete daily checklist items.');
    err.statusCode = 403;
    throw err;
  }

  const assignedBranch = user.branchId ? Number(user.branchId) : null;
  if (!assignedBranch) {
    const err = new Error('Access denied: User is not assigned to any branch.');
    err.statusCode = 403;
    throw err;
  }

  // Fix 2: Validate status - only COMPLETED and PENDING are accepted
  const normalizedStatus = String(status || 'COMPLETED').trim().toUpperCase();
  if (!['COMPLETED', 'PENDING'].includes(normalizedStatus)) {
    const err = new Error(`Invalid status "${status}". Only COMPLETED or PENDING are allowed.`);
    err.statusCode = 400;
    throw err;
  }

  const targetBranchId = assignedBranch;
  const targetBusinessDate = businessDate || getColomboDateString();
  const isCompleted = normalizedStatus === 'COMPLETED';
  const now = new Date();

  // Fix 4: Transactional update + audit log creation (rollback on failure, no silent ignore)
  let record;
  try {
    record = await prisma.$transaction(async (tx) => {
      const upsertedRecord = await tx.managerDailyChecklist.upsert({
        where: {
          uq_manager_daily_checklist: {
            branchId: targetBranchId,
            userId: user.id,
            checklistItemId,
            businessDate: targetBusinessDate
          }
        },
        update: {
          status: normalizedStatus,
          completedByUserId: isCompleted ? user.id : null,
          completedByName: isCompleted ? (user.name || user.email) : null,
          completedAt: isCompleted ? now : null,
          notes: notes || null,
          updatedAt: now
        },
        create: {
          branchId: targetBranchId,
          userId: user.id,
          checklistItemId,
          businessDate: targetBusinessDate,
          status: normalizedStatus,
          completedByUserId: isCompleted ? user.id : null,
          completedByName: isCompleted ? (user.name || user.email) : null,
          completedAt: isCompleted ? now : null,
          notes: notes || null
        }
      });

      await tx.managerChecklistAuditLog.create({
        data: {
          checklistRecordId: upsertedRecord.id,
          branchId: targetBranchId,
          userId: user.id,
          checklistItemId,
          businessDate: targetBusinessDate,
          action: isCompleted ? 'MARKED_COMPLETED' : 'MARKED_PENDING',
          performedByUserId: user.id,
          performedByName: user.name || user.email,
          notes: notes || null
        }
      });

      return upsertedRecord;
    });
  } catch (txErr) {
    console.error('Checklist update and audit log transaction failed, rolling back:', txErr.message);
    const err = new Error(`Failed to update checklist item and audit log: ${txErr.message}`);
    err.statusCode = 500;
    throw err;
  }

  // Calculate live progress for this user & branch on this date
  let completedCount = 0;
  try {
    const allRecords = await prisma.managerDailyChecklist.findMany({
      where: {
        branchId: targetBranchId,
        userId: user.id,
        businessDate: targetBusinessDate
      }
    });
    completedCount = allRecords.filter(r => r.status === 'COMPLETED').length;
  } catch (cntErr) {
    console.warn('Could not count completed records:', cntErr.message);
  }

  return {
    record: {
      ...record,
      completedAtFormatted: record.completedAt ? formatColomboDateTime(record.completedAt) : null
    },
    progress: {
      completed: completedCount,
      total: 6,
      percentage: Math.round((completedCount / 6) * 100),
      label: `${completedCount}/6 Completed`
    }
  };
}

/**
 * CEO / Super Admin Monitoring for all branches' manager checklists.
 */
async function getCeoChecklistMonitoringData({ user, date, branchId, managerId, statusFilter }) {
  const userRole = String(user?.role || '').toUpperCase();
  const isCeo = ['SUPER_ADMIN', 'CEO'].includes(userRole);
  if (!isCeo) {
    const err = new Error('Access denied: CEO or Super Admin authorization required for Checklist Monitoring.');
    err.statusCode = 403;
    throw err;
  }

  const targetBusinessDate = date || getColomboDateString();
  const colomboToday = getColomboDateString();

  // 1. Fetch branches
  const branchWhere = {};
  if (branchId && String(branchId).trim().toUpperCase() !== 'ALL') {
    const bId = parseInt(branchId, 10);
    if (bId > 0) branchWhere.id = bId;
  }
  const branches = await prisma.branch.findMany({
    where: branchWhere,
    orderBy: { id: 'asc' },
    include: {
      users: {
        where: {
          role: { in: ['MANAGER', 'ADMIN'] },
          isActive: true
        },
        select: { id: true, name: true, email: true, role: true }
      }
    }
  });

  // 2. Checklist definitions
  const checklistDef = [
    { id: 'overdueOrders', title: 'Check Overdue Orders', targetQueue: 'overdue' },
    { id: 'unassignedTasks', title: 'Assign Unassigned Production Tasks', targetQueue: 'unassigned' },
    { id: 'pricePending', title: 'Follow Up Price Pending Orders', targetQueue: 'pricePending' },
    { id: 'customerCollections', title: 'Follow Up Customer Collections', targetQueue: 'collection' },
    { id: 'readyGarments', title: 'Check Ready Garments for Delivery', targetQueue: 'delivery' },
    { id: 'staffAttendance', title: 'Review Staff Attendance', targetQueue: null }
  ];

  // 3. Saved checklist records for the target date
  let savedRecords = [];
  try {
    savedRecords = await prisma.managerDailyChecklist.findMany({
      where: {
        businessDate: targetBusinessDate,
        ...(branchWhere.id ? { branchId: branchWhere.id } : {})
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        completedByUser: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true } }
      }
    });
  } catch (err) {
    console.warn('Could not query saved checklist records:', err.message);
  }

  // 4. Build branch monitoring list
  const branchMonitoring = [];
  let totalAllItems = 0;
  let totalCompletedItems = 0;

  for (const b of branches) {
    let branchManagers = b.users;
    if (managerId) {
      const mId = parseInt(managerId, 10);
      branchManagers = branchManagers.filter(u => u.id === mId);
    }

    if (branchManagers.length === 0) {
      branchManagers = [{ id: 0, name: b.manager || `${b.name} Manager`, email: '', role: 'MANAGER' }];
    }

    for (const mgr of branchManagers) {
      const mgrRecords = savedRecords.filter(r => r.branchId === b.id && (r.userId === mgr.id || mgr.id === 0));

      const items = checklistDef.map(itemDef => {
        const record = mgrRecords.find(r => r.checklistItemId === itemDef.id);
        const isCompleted = record?.status === 'COMPLETED';
        return {
          id: itemDef.id,
          title: itemDef.title,
          status: isCompleted ? 'COMPLETED' : 'PENDING',
          completedBy: record?.completedByName || (isCompleted ? mgr.name : null),
          completedAt: record?.completedAt || null,
          completedAtFormatted: record?.completedAt ? formatColomboDateTime(record.completedAt) : null,
          notes: record?.notes || null,
          targetQueue: itemDef.targetQueue
        };
      });

      const completedCount = items.filter(i => i.status === 'COMPLETED').length;
      const pendingItems = items.filter(i => i.status !== 'COMPLETED').map(i => i.title);

      totalAllItems += items.length;
      totalCompletedItems += completedCount;

      let filteredItems = items;
      if (statusFilter === 'COMPLETED') {
        filteredItems = items.filter(i => i.status === 'COMPLETED');
      } else if (statusFilter === 'PENDING') {
        filteredItems = items.filter(i => i.status !== 'COMPLETED');
      }

      const completedRecordsWithDates = mgrRecords.filter(r => r.status === 'COMPLETED' && r.completedAt);
      const lastRecord = completedRecordsWithDates.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];

      branchMonitoring.push({
        branchId: b.id,
        branchName: b.name,
        manager: {
          id: mgr.id,
          name: mgr.name,
          email: mgr.email,
          role: mgr.role
        },
        progress: {
          completed: completedCount,
          total: 6,
          percentage: Math.round((completedCount / 6) * 100),
          label: `${completedCount}/6 Completed`
        },
        pendingItems,
        items: filteredItems,
        lastCompletedAt: lastRecord?.completedAt || null,
        lastCompletedFormatted: lastRecord?.completedAt ? formatColomboDateTime(lastRecord.completedAt) : null,
        lastCompletedBy: lastRecord?.completedByName || null
      });
    }
  }

  // 5. Generate historical date list (last 14 days)
  const historicalDates = [];
  const baseD = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(baseD.getTime() - i * 24 * 60 * 60 * 1000);
    const dStr = getColomboDateString(d);
    if (!historicalDates.includes(dStr)) {
      historicalDates.push(dStr);
    }
  }

  // 6. Audit logs for date & branch
  let auditLogs = [];
  try {
    const logs = await prisma.managerChecklistAuditLog.findMany({
      where: {
        businessDate: targetBusinessDate,
        ...(branchWhere.id ? { branchId: branchWhere.id } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 40
    });
    auditLogs = logs.map(a => ({
      ...a,
      formattedCreatedAt: formatColomboDateTime(a.createdAt)
    }));
  } catch (e) {
    console.warn('Could not query ManagerChecklistAuditLog:', e.message);
  }

  return {
    businessDate: targetBusinessDate,
    colomboToday,
    summary: {
      totalBranches: branches.length,
      totalManagers: branchMonitoring.length,
      totalItems: totalAllItems,
      totalCompleted: totalCompletedItems,
      totalPending: totalAllItems - totalCompletedItems,
      overallPercentage: totalAllItems > 0 ? Math.round((totalCompletedItems / totalAllItems) * 100) : 0
    },
    branches: branchMonitoring,
    historicalDates,
    auditLogs
  };
}

module.exports = {
  getColomboDateString,
  getColomboDayDiff,
  getDailyActionCentreData,
  recordActionFollowUp,
  completeChecklistItem,
  getCeoChecklistMonitoringData
};
