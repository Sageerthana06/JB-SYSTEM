const { prisma, pool } = require('../prisma');
const {
  getColomboWeekRange,
  calculateOrderSalaryAllocations,
  computeWeeklySalaryMetrics,
  roundLKR
} = require('../utils/salaryCalculator');
const { logAudit } = require('../utils/auditLogger');

/**
 * Helper to fetch all salary payments from the database safely
 */
async function fetchAllSalaryPayments(whereClause = {}) {
  try {
    let sql = `
      SELECT p.*, o."branchId", o."orderNumber" as "orderRef", b."name" as "branchName"
      FROM "TailorSalaryPayment" p
      LEFT JOIN "Order" o ON p."orderId" = o."id"
      LEFT JOIN "Branch" b ON o."branchId" = b."id"
    `;
    const params = [];
    const conditions = [];

    if (whereClause.tailorId) {
      params.push(whereClause.tailorId);
      conditions.push(`p."tailorId" = $${params.length}`);
    }

    if (whereClause.branchId) {
      params.push(whereClause.branchId);
      conditions.push(`o."branchId" = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY p."paymentDate" DESC';
    const res = await pool.query(sql, params);
    return res.rows || [];
  } catch (err) {
    console.warn('Note: Could not query TailorSalaryPayment directly via pool:', err.message);
    return [];
  }
}

/**
 * GET /api/salary/weekly-report
 * Comprehensive weekly tailor salary report for authorized Management and CEO
 */
exports.getWeeklySalaryReport = async (req, res, next) => {
  try {
    const { week, branchId, tailorId, workType, status, search } = req.query;

    // 1. Calculate Asia/Colombo week range
    const weekRange = getColomboWeekRange(week || null);

    // 2. Build where filter for orders with strict role & branch scoping
    const orderWhere = {};

    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user.branchId;
      if (!managerBranch) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Manager is not assigned to any branch.'
        });
      }
      if (branchId && branchId !== 'ALL' && parseInt(branchId, 10) !== managerBranch) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Managers are restricted to their assigned branch (${managerBranch}). Cannot access branch ${branchId}.`
        });
      }
      // Strictly enforce manager's assigned branch
      orderWhere.branchId = managerBranch;
    } else if (branchId && branchId !== 'ALL') {
      orderWhere.branchId = parseInt(branchId, 10);
    }

    // Exclude cancelled and rejected orders from salary generation
    orderWhere.status = { notIn: ['CANCELLED', 'REJECTED'] };

    // 3. Fetch orders with all required relations
    const orders = await prisma.order.findMany({
      where: orderWhere,
      include: {
        customer: { select: { id: true, name: true, primaryPhone: true } },
        garmentDetails: { select: { dressType: true, quantity: true } },
        branch: { select: { id: true, name: true } },
        assignedTailor: { select: { id: true, name: true, email: true, role: true } },
        tasks: {
          include: {
            assignedTailor: { select: { id: true, name: true, email: true, role: true } }
          },
          orderBy: { sequence: 'asc' }
        },
        payments: {
          orderBy: { createdAt: 'asc' }
        },
        productionHistory: {
          orderBy: { startedAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 4. Fetch all recorded salary payment disbursements
    const allSalaryPayments = await fetchAllSalaryPayments();

    // 5. Generate allocations for each order
    const allRawAllocations = [];
    let totalOfficeAllocation = 0;
    let totalCuttingAllocation = 0;
    let totalStitchingAllocation = 0;

    for (const order of orders) {
      const orderSalary = calculateOrderSalaryAllocations(order, allSalaryPayments);
      if (orderSalary && orderSalary.allocations) {
        totalOfficeAllocation += Number(orderSalary.officeAllocation || 0);

        for (const alloc of orderSalary.allocations) {
          if (alloc.workType === 'CUTTING') totalCuttingAllocation += alloc.allocatedAmount;
          if (alloc.workType === 'STITCHING') totalStitchingAllocation += alloc.allocatedAmount;
          allRawAllocations.push(alloc);
        }
      }
    }

    // 6. Compute weekly metrics across all allocations
    const { summary, weeklyAllocationsList, carriedForwardList } = computeWeeklySalaryMetrics(
      allRawAllocations,
      allSalaryPayments,
      weekRange
    );

    // 7. Apply UI Filters (Tailor, WorkType, Status, Search)
    let filteredAllocations = [...allRawAllocations];

    if (tailorId && tailorId !== 'ALL') {
      const targetId = parseInt(tailorId, 10);
      filteredAllocations = filteredAllocations.filter(a => Number(a.tailorId) === targetId);
    }

    if (workType && workType !== 'ALL') {
      filteredAllocations = filteredAllocations.filter(a => a.workType === workType);
    }

    if (status && status !== 'ALL') {
      filteredAllocations = filteredAllocations.filter(a => a.status === status);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredAllocations = filteredAllocations.filter(a =>
        (a.orderNumber && a.orderNumber.toLowerCase().includes(q)) ||
        (a.customerName && a.customerName.toLowerCase().includes(q)) ||
        (a.tailorName && a.tailorName.toLowerCase().includes(q))
      );
    }

    // 8. Group into Individual Tailor Statements
    const tailorMap = new Map();
    for (const alloc of allRawAllocations) {
      if (!alloc.tailorId) continue;

      if (!tailorMap.has(alloc.tailorId)) {
        tailorMap.set(alloc.tailorId, {
          tailorId: alloc.tailorId,
          tailorName: alloc.tailorName,
          tailorEmail: alloc.tailorEmail,
          branchName: alloc.branchName,
          totalEarnedInWeek: 0,
          totalPayable: 0,
          totalHeld: 0,
          totalWorkPending: 0,
          totalPaidInWeek: 0,
          totalCarriedForward: 0,
          jobsCount: 0,
          jobs: []
        });
      }

      const stmt = tailorMap.get(alloc.tailorId);
      stmt.jobsCount += 1;
      stmt.jobs.push(alloc);

      const workCompletedMs = alloc.workCompletedAt ? new Date(alloc.workCompletedAt).getTime() : null;
      const startMs = weekRange.startOfWeek.getTime();
      const endMs = weekRange.endOfWeek.getTime();

      if (workCompletedMs && workCompletedMs >= startMs && workCompletedMs <= endMs) {
        stmt.totalEarnedInWeek += alloc.allocatedAmount;
      }

      if (workCompletedMs && workCompletedMs < startMs && alloc.isCustomerFullyPaid && alloc.status !== 'PAID') {
        stmt.totalCarriedForward += alloc.allocatedAmount;
      }

      if (alloc.status === 'PAYABLE') stmt.totalPayable += alloc.allocatedAmount;
      if (alloc.status === 'ON_HOLD_CUSTOMER_PAYMENT') stmt.totalHeld += alloc.allocatedAmount;
      if (alloc.status === 'WORK_PENDING') stmt.totalWorkPending += alloc.allocatedAmount;
    }

    // Add paid disbursements to tailor statements
    for (const sp of allSalaryPayments) {
      const spDateMs = new Date(sp.paymentDate).getTime();
      const startMs = weekRange.startOfWeek.getTime();
      const endMs = weekRange.endOfWeek.getTime();

      if (sp.tailorId && tailorMap.has(sp.tailorId) && spDateMs >= startMs && spDateMs <= endMs) {
        const stmt = tailorMap.get(sp.tailorId);
        stmt.totalPaidInWeek += Number(sp.amountPaid || 0);
      }
    }

    const tailorStatements = Array.from(tailorMap.values()).map(stmt => ({
      ...stmt,
      totalEarnedInWeek: roundLKR(stmt.totalEarnedInWeek),
      totalPayable: roundLKR(stmt.totalPayable),
      totalHeld: roundLKR(stmt.totalHeld),
      totalWorkPending: roundLKR(stmt.totalWorkPending),
      totalPaidInWeek: roundLKR(stmt.totalPaidInWeek),
      totalCarriedForward: roundLKR(stmt.totalCarriedForward),
      outstandingBalance: roundLKR(stmt.totalPayable)
    })).sort((a, b) => b.outstandingBalance - a.outstandingBalance);

    // 9. Cutting vs Stitching Overview
    const cuttingAllocations = allRawAllocations.filter(a => a.workType === 'CUTTING');
    const stitchingAllocations = allRawAllocations.filter(a => a.workType === 'STITCHING');

    const cuttingVsStitching = {
      cutting: {
        totalAllocated: roundLKR(totalCuttingAllocation),
        completedCount: cuttingAllocations.filter(a => a.isWorkCompleted).length,
        payableAmount: roundLKR(cuttingAllocations.filter(a => a.status === 'PAYABLE').reduce((s, a) => s + a.allocatedAmount, 0)),
        paidAmount: roundLKR(cuttingAllocations.filter(a => a.status === 'PAID').reduce((s, a) => s + a.allocatedAmount, 0))
      },
      stitching: {
        totalAllocated: roundLKR(totalStitchingAllocation),
        completedCount: stitchingAllocations.filter(a => a.isWorkCompleted).length,
        payableAmount: roundLKR(stitchingAllocations.filter(a => a.status === 'PAYABLE').reduce((s, a) => s + a.allocatedAmount, 0)),
        paidAmount: roundLKR(stitchingAllocations.filter(a => a.status === 'PAID').reduce((s, a) => s + a.allocatedAmount, 0))
      },
      office: {
        totalAllocated: roundLKR(totalOfficeAllocation),
        percent: 50.0,
        description: 'Office gross profit allocation (50% of agreed garment order prices)'
      }
    };

    // Log view audit trail
    logAudit({
      action: 'SALARY_REPORT_VIEWED',
      entityType: 'WeeklySalaryReport',
      entityId: null,
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      userRole: req.user.role,
      details: {
        week: weekRange.formattedRange,
        branchScope: orderWhere.branchId || 'ALL',
        requestedBranchId: branchId || 'ALL'
      },
      ipAddress: req.ip
    }).catch(err => console.warn('Salary report audit view log skipped:', err.message));

    res.json({
      success: true,
      roleContext: {
        role: req.user?.role,
        isCeo: req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'CEO',
        isManager: req.user?.role === 'MANAGER',
        isAdmin: req.user?.role === 'ADMIN',
        branchScope: orderWhere.branchId || 'ALL',
        canDisburse: ['SUPER_ADMIN', 'MANAGER'].includes(req.user?.role)
      },
      weekRange,
      summary,
      allocations: filteredAllocations,
      allAllocationsCount: allRawAllocations.length,
      filteredCount: filteredAllocations.length,
      tailorStatements,
      cuttingVsStitching,
      carriedForwardList,
      recentPayments: allSalaryPayments.slice(0, 50)
    });
  } catch (error) {
    console.error('Error fetching weekly salary report:', error);
    next(error);
  }
};

/**
 * GET /api/salary/my-salary
 * Individual Tailor Salary Panel (Tailor views only their own salary records)
 */
exports.getMySalary = async (req, res, next) => {
  try {
    const tailorId = req.user.id;
    const { week } = req.query;

    const weekRange = getColomboWeekRange(week || null);

    // Find orders where tailor is assigned to order or tasks
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { assignedTailorId: tailorId },
          { tasks: { some: { assignedTailorId: tailorId } } }
        ],
        status: { notIn: ['CANCELLED', 'REJECTED'] }
      },
      include: {
        customer: { select: { id: true, name: true } },
        garmentDetails: { select: { dressType: true, quantity: true } },
        branch: { select: { id: true, name: true } },
        tasks: {
          include: {
            assignedTailor: { select: { id: true, name: true, role: true } }
          }
        },
        payments: true,
        productionHistory: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch this tailor's recorded payments
    const tailorPayments = await fetchAllSalaryPayments({ tailorId });

    // Generate allocations and filter only for this tailor
    const myAllocations = [];
    let myEarnedInWeek = 0;
    let myPayable = 0;
    let myHeld = 0;
    let myWorkPending = 0;
    let myCarriedForward = 0;
    let myPaidInWeek = 0;

    const startMs = weekRange.startOfWeek.getTime();
    const endMs = weekRange.endOfWeek.getTime();

    for (const order of orders) {
      const orderSalary = calculateOrderSalaryAllocations(order, tailorPayments);
      if (orderSalary && orderSalary.allocations) {
        for (const alloc of orderSalary.allocations) {
          if (Number(alloc.tailorId) === Number(tailorId)) {
            myAllocations.push(alloc);

            const workCompletedMs = alloc.workCompletedAt ? new Date(alloc.workCompletedAt).getTime() : null;
            if (workCompletedMs && workCompletedMs >= startMs && workCompletedMs <= endMs) {
              myEarnedInWeek += alloc.allocatedAmount;
            }

            if (workCompletedMs && workCompletedMs < startMs && alloc.isCustomerFullyPaid && alloc.status !== 'PAID') {
              myCarriedForward += alloc.allocatedAmount;
            }

            if (alloc.status === 'PAYABLE') myPayable += alloc.allocatedAmount;
            if (alloc.status === 'ON_HOLD_CUSTOMER_PAYMENT') myHeld += alloc.allocatedAmount;
            if (alloc.status === 'WORK_PENDING') myWorkPending += alloc.allocatedAmount;
          }
        }
      }
    }

    for (const sp of tailorPayments) {
      const spDateMs = new Date(sp.paymentDate).getTime();
      if (spDateMs >= startMs && spDateMs <= endMs) {
        myPaidInWeek += Number(sp.amountPaid || 0);
      }
    }

    const summary = {
      totalEarnedInWeek: roundLKR(myEarnedInWeek),
      totalPayable: roundLKR(myPayable),
      totalHeldOnCustomerPayment: roundLKR(myHeld),
      totalWorkPending: roundLKR(myWorkPending),
      totalPaidInWeek: roundLKR(myPaidInWeek),
      totalCarriedForward: roundLKR(myCarriedForward),
      outstandingBalance: roundLKR(myPayable + myCarriedForward)
    };

    res.json({
      success: true,
      tailor: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      },
      weekRange,
      summary,
      allocations: myAllocations,
      paymentHistory: tailorPayments
    });
  } catch (error) {
    console.error('Error fetching tailor personal salary:', error);
    next(error);
  }
};

/**
 * POST /api/salary/record-payment
 * Record actual salary disbursement (Manager & CEO only)
 * Enforces business payment rules and prevents duplicate disbursements.
 */
exports.recordSalaryPayment = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { orderId, tailorId, workType, amountPaid, paymentDate, paymentMethod, referenceNo, notes } = req.body;

    // Validate inputs
    const parsedOrderId = parseInt(orderId, 10);
    const parsedTailorId = parseInt(tailorId, 10);
    const parsedAmount = parseFloat(amountPaid);

    if (isNaN(parsedOrderId) || isNaN(parsedTailorId)) {
      return res.status(400).json({ success: false, message: 'Valid Order ID and Tailor ID are required.' });
    }

    if (!['CUTTING', 'STITCHING'].includes(workType)) {
      return res.status(400).json({ success: false, message: 'Work type must be CUTTING or STITCHING.' });
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount paid must be greater than zero.' });
    }

    // Financial payout authority check: Only CEO (SUPER_ADMIN) and authorized Managers can disburse salary
    const allowedPaymentRoles = ['SUPER_ADMIN', 'MANAGER'];
    if (!allowedPaymentRoles.includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Financial payment approval and disbursement requires Manager or CEO authorization. Admin role does not grant financial payout authority.'
      });
    }

    // Fetch order with tasks and payments to evaluate eligibility
    const order = await prisma.order.findUnique({
      where: { id: parsedOrderId },
      include: {
        tasks: { include: { assignedTailor: true } },
        payments: true,
        assignedTailor: true,
        garmentDetails: true,
        productionHistory: true
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Branch authorization check for Managers: Managers cannot disburse salary outside their assigned branch
    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user.branchId;
      if (!managerBranch) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Manager is not assigned to any branch.'
        });
      }
      if (order.branchId && order.branchId !== managerBranch) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Manager cannot disburse salary for order in branch ${order.branchId}. Your authorized branch is ${managerBranch}.`
        });
      }
    }

    // Check existing disbursements for duplicate prevention
    const existingCheck = await client.query(
      `SELECT * FROM "TailorSalaryPayment" WHERE "orderId" = $1 AND "tailorId" = $2 AND "workType" = $3`,
      [parsedOrderId, parsedTailorId, workType]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Salary for ${workType} on order ${order.orderNumber} has already been paid on ${new Date(existingCheck.rows[0].paymentDate).toLocaleDateString()}. Duplicate payments are strictly prohibited.`
      });
    }

    // Compute order allocations and verify PAYABLE status
    const existingPayments = await fetchAllSalaryPayments();
    const orderSalary = calculateOrderSalaryAllocations(order, existingPayments);
    const targetAlloc = orderSalary.allocations?.find(a =>
      a.workType === workType && Number(a.tailorId) === parsedTailorId
    );

    if (!targetAlloc) {
      return res.status(400).json({
        success: false,
        message: `No eligible ${workType} salary allocation found for tailor ID ${parsedTailorId} on order ${order.orderNumber}.`
      });
    }

    if (!targetAlloc.isWorkCompleted) {
      return res.status(400).json({
        success: false,
        message: `Cannot disburse salary: ${workType} work is not yet marked completed in production workflow.`
      });
    }

    if (!targetAlloc.isCustomerFullyPaid) {
      return res.status(400).json({
        success: false,
        message: `Cannot disburse salary: Customer has not settled the full agreed order amount (Balance due: LKR ${targetAlloc.customerBalanceDue.toLocaleString()}). Salary is on hold until full customer payment.`
      });
    }

    // Insert payment record atomically
    await client.query('BEGIN');

    const recordedByName = req.user.name || (req.user.role === 'SUPER_ADMIN' ? 'CEO' : 'Manager');
    const pDate = paymentDate ? new Date(paymentDate) : new Date();

    const insertResult = await client.query(
      `INSERT INTO "TailorSalaryPayment" (
        "orderId", "tailorId", "workType", "orderNumber",
        "agreedPrice", "allocationPercent", "amountPaid",
        "paymentDate", "paymentMethod", "referenceNo", "notes",
        "recordedById", "recordedByName", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING *`,
      [
        parsedOrderId,
        parsedTailorId,
        workType,
        order.orderNumber,
        targetAlloc.agreedPrice,
        targetAlloc.allocationPercent,
        roundLKR(parsedAmount),
        pDate,
        paymentMethod || 'Cash',
        referenceNo || null,
        notes || null,
        req.user.id,
        recordedByName
      ]
    );

    await client.query('COMMIT');

    const createdPayment = insertResult.rows[0];

    // Log audit
    await logAudit({
      action: 'TAILOR_SALARY_PAID',
      entityType: 'TailorSalaryPayment',
      entityId: createdPayment.id,
      userId: req.user.id,
      userName: recordedByName,
      userRole: req.user.role,
      details: {
        orderId: parsedOrderId,
        orderNumber: order.orderNumber,
        tailorId: parsedTailorId,
        tailorName: targetAlloc.tailorName,
        workType,
        amountPaid: parsedAmount,
        paymentMethod: paymentMethod || 'Cash',
        referenceNo: referenceNo || null
      },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: `Salary payment of LKR ${roundLKR(parsedAmount).toLocaleString()} for ${workType} successfully recorded for ${targetAlloc.tailorName}.`,
      payment: createdPayment
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate payment submission detected. This salary allocation has already been disbursed.'
      });
    }
    console.error('Error recording salary payment:', err);
    next(err);
  } finally {
    client.release();
  }
};

/**
 * GET /api/salary/payment-history
 * Audit list of historical tailor salary disbursements
 */
exports.getSalaryPaymentHistory = async (req, res, next) => {
  try {
    const { tailorId, branchId, limit } = req.query;
    const where = {};
    if (tailorId && tailorId !== 'ALL') {
      where.tailorId = parseInt(tailorId, 10);
    }

    // Role check: Tailor can view only their own payments
    if (['TAILOR', 'CUTTING', 'EMBROIDERY'].includes(req.user?.role)) {
      where.tailorId = req.user.id;
    }

    // Role check: Manager is restricted strictly to payments for orders in their assigned branch
    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user.branchId;
      if (!managerBranch) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Manager is not assigned to any branch.'
        });
      }
      where.branchId = managerBranch;
    } else if (branchId && branchId !== 'ALL') {
      where.branchId = parseInt(branchId, 10);
    }

    const payments = await fetchAllSalaryPayments(where);
    const take = limit ? parseInt(limit, 10) : 100;

    res.json({
      success: true,
      payments: payments.slice(0, take),
      totalCount: payments.length,
      roleScope: req.user?.role,
      branchScope: where.branchId || 'ALL'
    });
  } catch (error) {
    console.error('Error fetching salary payment history:', error);
    next(error);
  }
};
