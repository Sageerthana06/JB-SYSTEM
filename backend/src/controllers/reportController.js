const { prisma } = require('../prisma');

/**
 * Helper to compute start and end of day in Asia/Colombo (UTC+05:30)
 */
const parseColomboDateRange = (dateString) => {
  let dateKey = dateString;
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    // Current date in Asia/Colombo
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(now);
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    dateKey = `${y}-${m}-${d}`;
  }

  const startOfDay = new Date(`${dateKey}T00:00:00+05:30`);
  const endOfDay = new Date(`${dateKey}T23:59:59.999+05:30`);

  return { dateKey, startOfDay, endOfDay };
};

/**
 * Format timestamp in Asia/Colombo timezone (12-hour or readable)
 */
const formatColomboTime = (date) => {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleTimeString('en-US', {
      timeZone: 'Asia/Colombo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return '-';
  }
};

/**
 * GET /api/reports/daily
 * Daily Reports Controller — Provides real PostgreSQL data for:
 * 1. Daily Orders Report
 * 2. Daily Attendance Report
 * 3. Daily Payments Report
 * 4. Daily Production Report
 * 5. Daily Business Summary
 */
exports.getDailyReports = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const role = (user.role || '').toUpperCase();
    const isExecutive = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'CEO';
    const isManager = role === 'MANAGER';

    if (!isExecutive && !isManager) {
      return res.status(403).json({ success: false, message: 'Access denied. Management authorization required.' });
    }

    // Date range resolution in Asia/Colombo
    const { dateKey, startOfDay, endOfDay } = parseColomboDateRange(req.query.date);

    // Branch authorization & scoping
    const allBranches = await prisma.branch.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, phone: true, address: true },
      orderBy: { id: 'asc' }
    });

    let targetBranchId = null;
    let isCompanyWide = false;
    let branchLabel = 'All Branches (Company-wide)';

    if (isExecutive) {
      if (req.query.branchId && req.query.branchId !== 'ALL') {
        targetBranchId = parseInt(req.query.branchId, 10);
        const match = allBranches.find(b => b.id === targetBranchId);
        branchLabel = match ? match.name : `Branch #${targetBranchId}`;
      } else {
        isCompanyWide = true;
        branchLabel = 'All Branches (Company-wide)';
      }
    } else {
      // MANAGER: Strictly locked to their assigned branch
      let managerBranchId = user.branchId;
      if (!managerBranchId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { branchId: true }
        });
        managerBranchId = dbUser?.branchId || 1;
      }

      // Cross-branch isolation check: Managers cannot request reports for another branch
      if (req.query.branchId && req.query.branchId !== 'ALL' && parseInt(req.query.branchId, 10) !== managerBranchId) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Managers are restricted to their assigned branch (${managerBranchId}). Cannot access branch ${req.query.branchId}.`
        });
      }

      targetBranchId = managerBranchId;
      const match = allBranches.find(b => b.id === targetBranchId);
      branchLabel = match ? match.name : `Branch #${targetBranchId}`;
      isCompanyWide = false;
    }

    // -------------------------------------------------------------
    // 1. DAILY ORDERS REPORT DATA
    // -------------------------------------------------------------
    const ordersWhere = {
      orderDate: { gte: startOfDay, lte: endOfDay },
      ...(targetBranchId ? { branchId: targetBranchId } : {})
    };

    const ordersRaw = await prisma.order.findMany({
      where: ordersWhere,
      include: {
        customer: { select: { id: true, name: true, primaryPhone: true } },
        assignedTailor: { select: { id: true, name: true, role: true } },
        branch: { select: { id: true, name: true } },
        garmentDetails: { select: { dressType: true, quantity: true } }
      },
      orderBy: { orderDate: 'desc' }
    });

    let totalOrderAmount = 0;
    let totalOrderAdvance = 0;
    let totalOrderBalance = 0;
    const ordersByStatus = {};
    const ordersByPaymentStatus = { Paid: 0, Partial: 0, Unpaid: 0 };

    const ordersList = ordersRaw.map((o) => {
      const amt = Number(o.totalAmount || 0);
      const adv = Number(o.advancePayment || 0);
      const bal = Number(o.balanceAmount || 0);

      totalOrderAmount += amt;
      totalOrderAdvance += adv;
      totalOrderBalance += bal;

      ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
      const pStatus = o.paymentStatus || (bal <= 0 && amt > 0 ? 'Paid' : adv > 0 ? 'Partial' : 'Unpaid');
      ordersByPaymentStatus[pStatus] = (ordersByPaymentStatus[pStatus] || 0) + 1;

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer?.name || 'Walk-in Customer',
        customerPhone: o.customer?.primaryPhone || '-',
        assignedTailor: o.assignedTailor?.name || 'Unassigned',
        dressType: o.garmentDetails?.dressType || 'Bespoke Garment',
        quantity: o.garmentDetails?.quantity || 1,
        status: o.status,
        totalAmount: amt,
        advancePayment: adv,
        balanceAmount: bal,
        paymentStatus: pStatus,
        branchName: o.branch?.name || (o.branchId === 2 ? 'Bella Design' : 'JB Group (Main)'),
        orderTime: formatColomboTime(o.orderDate)
      };
    });

    const ordersSummary = {
      totalOrders: ordersList.length,
      totalAmount: totalOrderAmount,
      totalAdvance: totalOrderAdvance,
      totalBalance: totalOrderBalance,
      byStatus: ordersByStatus,
      byPaymentStatus: ordersByPaymentStatus
    };

    // -------------------------------------------------------------
    // 2. DAILY ATTENDANCE REPORT DATA
    // -------------------------------------------------------------
    // Active team members for branch / company
    const activeStaffWhere = {
      isActive: true,
      ...(targetBranchId ? { branchId: targetBranchId } : {})
    };

    const activeUsers = await prisma.user.findMany({
      where: activeStaffWhere,
      include: {
        branch: { select: { id: true, name: true } }
      },
      orderBy: { name: 'asc' }
    });

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        date: dateKey,
        ...(targetBranchId ? { user: { branchId: targetBranchId } } : {})
      }
    });

    const attendanceMap = {};
    for (const att of attendanceRecords) {
      if (att.userId) attendanceMap[att.userId] = att;
      if (att.tailorId) attendanceMap[att.tailorId] = att;
    }

    let presentCount = 0;
    let checkedOutCount = 0;
    let absentCount = 0;
    let notMarkedCount = 0;

    const attendanceList = activeUsers.map((u) => {
      const att = attendanceMap[u.id] || null;
      let status = 'Not Marked';

      if (att) {
        if (att.status === 'Checked Out' || (att.checkIn && att.checkOut)) {
          status = 'Checked Out';
          checkedOutCount++;
        } else if (att.status === 'Present' || att.checkIn) {
          status = 'Present';
          presentCount++;
        } else if (att.status === 'Absent') {
          status = 'Absent';
          absentCount++;
        } else {
          status = att.status || 'Present';
          presentCount++;
        }
      } else {
        notMarkedCount++;
      }

      return {
        userId: u.id,
        employeeName: u.name,
        role: u.role,
        branchName: u.branch?.name || att?.branch || (u.branchId === 2 ? 'Bella Design' : 'JB Group (Main)'),
        attendanceStatus: status,
        checkInTime: att?.checkIn ? formatColomboTime(att.checkIn) : '-',
        checkOutTime: att?.checkOut ? formatColomboTime(att.checkOut) : '-',
        markedBy: att?.markedBy || '-'
      };
    });

    const attendanceSummary = {
      totalStaff: activeUsers.length,
      present: presentCount,
      checkedOut: checkedOutCount,
      absent: absentCount,
      notMarked: notMarkedCount,
      attendanceRate: activeUsers.length > 0 ? Math.round(((presentCount + checkedOutCount) / activeUsers.length) * 100) : 0
    };

    // -------------------------------------------------------------
    // 3. DAILY PAYMENTS REPORT DATA
    // -------------------------------------------------------------
    const paymentsWhere = {
      createdAt: { gte: startOfDay, lte: endOfDay },
      ...(targetBranchId ? { order: { branchId: targetBranchId } } : {})
    };

    const paymentsRaw = await prisma.payment.findMany({
      where: paymentsWhere,
      include: {
        order: {
          include: {
            customer: { select: { id: true, name: true, primaryPhone: true } },
            branch: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    let totalCollected = 0;
    const byPaymentMethod = {};
    const touchedOrderMap = new Map();
    let fullySettledCount = 0;
    let partialPaymentCount = 0;

    const paymentsList = paymentsRaw.map((p) => {
      const amt = Number(p.amount || 0);
      totalCollected += amt;
      const method = p.paymentMethod || 'Cash';
      byPaymentMethod[method] = (byPaymentMethod[method] || 0) + amt;

      const orderBal = Number(p.order?.balanceAmount || 0);
      const orderTot = Number(p.order?.totalAmount || 0);

      if (p.orderId && !touchedOrderMap.has(p.orderId)) {
        touchedOrderMap.set(p.orderId, orderBal);
      }

      if (orderBal <= 0) {
        fullySettledCount++;
      } else {
        partialPaymentCount++;
      }

      return {
        paymentId: p.id,
        orderNumber: p.order?.orderNumber || `ORD-${p.orderId}`,
        customerName: p.order?.customer?.name || 'Customer',
        customerPhone: p.order?.customer?.primaryPhone || '-',
        paymentMethod: method,
        amountCollected: amt,
        orderTotal: orderTot,
        currentOutstandingBalance: orderBal,
        orderPaymentStatus: p.order?.paymentStatus || (orderBal <= 0 ? 'Paid' : 'Partial'),
        recordedBy: p.recordedBy || 'Staff',
        status: p.status || 'VERIFIED',
        branchName: p.order?.branch?.name || (p.order?.branchId === 2 ? 'Bella Design' : 'JB Group (Main)'),
        paymentTime: formatColomboTime(p.createdAt),
        notes: p.notes || '-'
      };
    });

    let totalOutstandingOnActiveOrders = 0;
    for (const bal of touchedOrderMap.values()) {
      totalOutstandingOnActiveOrders += bal;
    }

    const paymentsSummary = {
      totalCollected,
      transactionCount: paymentsList.length,
      byMethod: byPaymentMethod,
      totalOutstandingOnActiveOrders,
      fullySettledCount,
      partialPaymentCount
    };

    // -------------------------------------------------------------
    // 4. DAILY PRODUCTION REPORT DATA
    // -------------------------------------------------------------
    // 4a. Production History transitions occurring on selected day
    const prodHistory = await prisma.productionHistory.findMany({
      where: {
        startedAt: { gte: startOfDay, lte: endOfDay },
        ...(targetBranchId ? { order: { branchId: targetBranchId } } : {})
      },
      include: {
        order: {
          include: {
            customer: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            garmentDetails: { select: { dressType: true, quantity: true } }
          }
        },
        assignedTo: { select: { id: true, name: true, role: true } }
      },
      orderBy: { startedAt: 'desc' }
    });

    // 4b. Order Tasks completed on selected day
    const tasksCompleted = await prisma.orderTask.findMany({
      where: {
        completedAt: { gte: startOfDay, lte: endOfDay },
        ...(targetBranchId ? { branchId: targetBranchId } : {})
      },
      include: {
        order: {
          include: {
            customer: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } }
          }
        },
        assignedTailor: { select: { id: true, name: true, role: true } }
      },
      orderBy: { completedAt: 'desc' }
    });

    // 4c. Orders completed or moved to READY on selected day
    const readyOrders = await prisma.order.findMany({
      where: {
        status: 'READY',
        updatedAt: { gte: startOfDay, lte: endOfDay },
        ...(targetBranchId ? { branchId: targetBranchId } : {})
      },
      include: {
        customer: { select: { id: true, name: true } },
        assignedTailor: { select: { id: true, name: true } },
        garmentDetails: { select: { dressType: true, quantity: true } }
      }
    });

    // 4d. Orders DELIVERED or COMPLETED on selected day
    const deliveredOrders = await prisma.order.findMany({
      where: {
        status: { in: ['DELIVERED', 'COMPLETED'] },
        deliveredAt: { gte: startOfDay, lte: endOfDay },
        ...(targetBranchId ? { branchId: targetBranchId } : {})
      },
      include: {
        customer: { select: { id: true, name: true } },
        assignedTailor: { select: { id: true, name: true } },
        garmentDetails: { select: { dressType: true, quantity: true } }
      }
    });

    // 4e. Current Active Pending Work (WIP) in production
    const pendingWipOrders = await prisma.order.findMany({
      where: {
        status: {
          in: [
            'PENDING_PRODUCTION',
            'TAILOR_ASSIGNED',
            'IN_PROGRESS',
            'CUTTING',
            'STITCHING',
            'AARI_EMBROIDERY',
            'QUALITY_CHECK',
            'ALTERATION',
            'FITTING_ALTERATION',
            'FINISHING'
          ]
        },
        ...(targetBranchId ? { branchId: targetBranchId } : {})
      },
      include: {
        customer: { select: { id: true, name: true } },
        assignedTailor: { select: { id: true, name: true } },
        garmentDetails: { select: { dressType: true, quantity: true } },
        branch: { select: { id: true, name: true } }
      },
      orderBy: { orderDate: 'asc' }
    });

    const wipByStage = {};
    pendingWipOrders.forEach((o) => {
      wipByStage[o.status] = (wipByStage[o.status] || 0) + 1;
    });

    const productionSummary = {
      completedTasksCount: tasksCompleted.length,
      readyOrdersCount: readyOrders.length,
      deliveredOrdersCount: deliveredOrders.length,
      pendingWipCount: pendingWipOrders.length,
      stageTransitionsCount: prodHistory.length,
      wipByStage
    };

    const productionData = {
      stageTransitions: prodHistory.map(h => ({
        id: h.id,
        orderNumber: h.order?.orderNumber,
        customerName: h.order?.customer?.name || 'Customer',
        dressType: h.order?.garmentDetails?.dressType || 'Garment',
        stage: h.stage,
        previousStage: h.previousStage || '-',
        assignedTo: h.assignedTo?.name || 'Craftsman',
        time: formatColomboTime(h.startedAt),
        notes: h.notes || '-'
      })),
      completedTasks: tasksCompleted.map(t => ({
        id: t.id,
        orderNumber: t.order?.orderNumber,
        taskName: t.taskName || t.taskType,
        assignedTailor: t.assignedTailor?.name || 'Craftsman',
        completedAt: formatColomboTime(t.completedAt),
        notes: t.notes || '-'
      })),
      readyOrders: readyOrders.map(r => ({
        id: r.id,
        orderNumber: r.orderNumber,
        customerName: r.customer?.name || 'Customer',
        dressType: r.garmentDetails?.dressType || 'Garment',
        assignedTailor: r.assignedTailor?.name || 'Tailor',
        updatedAt: formatColomboTime(r.updatedAt)
      })),
      deliveredOrders: deliveredOrders.map(d => ({
        id: d.id,
        orderNumber: d.orderNumber,
        customerName: d.customer?.name || 'Customer',
        dressType: d.garmentDetails?.dressType || 'Garment',
        assignedTailor: d.assignedTailor?.name || 'Tailor',
        deliveredAt: formatColomboTime(d.deliveredAt)
      })),
      pendingWip: pendingWipOrders.map(w => ({
        id: w.id,
        orderNumber: w.orderNumber,
        customerName: w.customer?.name || 'Customer',
        dressType: w.garmentDetails?.dressType || 'Garment',
        status: w.status,
        assignedTailor: w.assignedTailor?.name || 'Unassigned',
        branchName: w.branch?.name || (w.branchId === 2 ? 'Bella Design' : 'JB Group (Main)')
      }))
    };

    // -------------------------------------------------------------
    // 5. COMBINED DAILY BUSINESS SUMMARY
    // -------------------------------------------------------------
    const businessSummary = {
      executiveKpis: {
        newOrders: ordersSummary.totalOrders,
        newOrdersCount: ordersSummary.totalOrders,
        newOrdersValue: ordersSummary.totalAmount,
        completedOrders: (productionSummary.readyOrdersCount || 0) + (productionSummary.deliveredOrdersCount || 0),
        completedOrdersCount: (productionSummary.readyOrdersCount || 0) + (productionSummary.deliveredOrdersCount || 0),
        moneyReceived: paymentsSummary.totalCollected,
        paymentsCollected: paymentsSummary.totalCollected,
        paymentTransactions: paymentsSummary.transactionCount,
        staffPresent: attendanceSummary.present + attendanceSummary.checkedOut,
        totalStaff: attendanceSummary.totalStaff,
        attendanceRate: attendanceSummary.attendanceRate,
        pendingOrders: productionSummary.pendingWipCount,
        activeWipCount: productionSummary.pendingWipCount,
        tasksCompleted: productionSummary.completedTasksCount,
        readyOrders: productionSummary.readyOrdersCount,
        deliveredOrders: productionSummary.deliveredOrdersCount
      },
      orders: ordersSummary,
      attendance: attendanceSummary,
      payments: paymentsSummary,
      production: productionSummary
    };

    // Return structured, secure report data
    res.json({
      success: true,
      meta: {
        date: dateKey,
        branchId: targetBranchId,
        branchName: branchLabel,
        isCompanyWide,
        generatedAt: new Date().toISOString(),
        generatedBy: {
          id: user.id,
          name: user.name || 'Authorized User',
          email: user.email,
          role: user.role
        },
        availableBranches: isExecutive ? allBranches : allBranches.filter(b => b.id === targetBranchId)
      },
      orders: {
        summary: ordersSummary,
        records: ordersList
      },
      attendance: {
        summary: attendanceSummary,
        records: attendanceList
      },
      payments: {
        summary: paymentsSummary,
        records: paymentsList
      },
      production: {
        summary: productionSummary,
        data: productionData
      },
      businessSummary
    });
  } catch (error) {
    console.error('Error generating daily reports:', error);
    next(error);
  }
};
