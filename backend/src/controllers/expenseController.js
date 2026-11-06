/**
 * Separate Expense Management Controller
 * JB GROUP (PVT) LTD — Version 3.4.0
 *
 * Dedicated strictly to Business Expenses only.
 * NO Sales, NO Sales Revenue, NO Order Income, NO Customer Receivables.
 * Enforces two-branch isolation (Branch 1: JB Group Main, Branch 2: Bella Design).
 * Complete CRUD, Multiple Partial/Full Payments, Recurring Bills, Audit Logs, and Comprehensive Reports.
 */

const { prisma } = require('../prisma');
const {
  generateExpenseNumberTx,
  generateExpensePaymentNumberTx,
  generateTransactionNumberTx
} = require('../utils/financialSequenceGenerator');
const { logFinancialAudit } = require('../utils/financialAuditLogger');

// 15 Standard Expense Categories for JB GROUP
const VALID_CATEGORIES = [
  'SHOP_RENT',
  'ELECTRICITY_BILL',
  'WATER_BILL',
  'INTERNET_BILL',
  'TELEPHONE_BILL',
  'STAFF_SALARY',
  'TRANSPORT',
  'OFFICE_EXPENSES',
  'MAINTENANCE',
  'REPAIR_EXPENSES',
  'STAFF_WELFARE',
  'PURCHASES',
  'DELIVERY_EXPENSES',
  'EMERGENCY_EXPENSES',
  'OTHER_EXPENSES'
];

// Recurring bill standard categories
const RECURRING_CATEGORIES = [
  { key: 'SHOP_RENT', defaultTitle: 'Shop Rent', defaultExpected: 45000.00 },
  { key: 'ELECTRICITY_BILL', defaultTitle: 'Ceylon Electricity Board Bill', defaultExpected: 12000.00 },
  { key: 'WATER_BILL', defaultTitle: 'Water Supply Utility Bill', defaultExpected: 2500.00 },
  { key: 'INTERNET_BILL', defaultTitle: 'Broadband Fiber Internet Bill', defaultExpected: 6500.00 },
  { key: 'TELEPHONE_BILL', defaultTitle: 'Official Telephone / Mobile Bill', defaultExpected: 4000.00 }
];

// Map expense categories to AccountingCategory code for GL integration
const CATEGORY_TO_GL_MAP = {
  SHOP_RENT: 'EXP_RENT',
  ELECTRICITY_BILL: 'EXP_ELECTRICITY',
  WATER_BILL: 'EXP_WATER',
  INTERNET_BILL: 'EXP_INTERNET',
  TELEPHONE_BILL: 'EXP_TELEPHONE',
  STAFF_SALARY: 'EXP_STAFF_SALARY',
  TRANSPORT: 'EXP_TRANSPORT',
  OFFICE_EXPENSES: 'EXP_OFFICE',
  MAINTENANCE: 'EXP_MAINTENANCE',
  REPAIR_EXPENSES: 'EXP_REPAIRS',
  STAFF_WELFARE: 'EXP_WELFARE',
  PURCHASES: 'EXP_FABRIC_PURCHASE',
  DELIVERY_EXPENSES: 'EXP_PACKAGING',
  EMERGENCY_EXPENSES: 'EXP_EMERGENCY',
  OTHER_EXPENSES: 'EXP_MISC'
};

/**
 * Resolve branch scope for expenses strictly by RBAC:
 * - CEO / SUPER_ADMIN: Consolidated ('ALL'), Branch 1, or Branch 2.
 * - MANAGER: Strictly locked to their assigned branch (1 or 2).
 * - ADMIN: Strictly locked to their assigned branch (1 or 2).
 */
const resolveBranchScope = (req) => {
  const user = req.user;
  const role = String(user?.role || '').toUpperCase();
  const isCeo = ['SUPER_ADMIN', 'CEO'].includes(role);
  const assignedBranch = user?.branchId ? Number(user.branchId) : null;

  if (isCeo) {
    const qBranch = req.query?.branchId || req.body?.branchId;
    if (qBranch && String(qBranch).trim().toUpperCase() !== 'ALL') {
      const bId = parseInt(qBranch, 10);
      if (bId !== 1 && bId !== 2) {
        throw { status: 400, message: 'Invalid branch ID. JB GROUP operates only Branch 1 and Branch 2.' };
      }
      return bId;
    }
    return 'ALL';
  }

  // Both ADMIN and MANAGER are restricted to their assigned branch
  if (!assignedBranch || (assignedBranch !== 1 && assignedBranch !== 2)) {
    throw { status: 403, message: `Access denied: ${role} is not assigned to an active branch (Branch 1 or 2).` };
  }

  const qBranch = req.query?.branchId || req.body?.branchId;
  if (qBranch) {
    const cleanQ = String(qBranch).trim().toUpperCase();
    if (cleanQ === 'ALL' || parseInt(cleanQ, 10) !== assignedBranch) {
      throw {
        status: 403,
        message: `Access denied: ${role} accounts are restricted to their assigned branch (${assignedBranch}). Cross-branch and consolidated access is prohibited.`
      };
    }
  }

  return assignedBranch;
};

/**
 * Helper: Build Date Filter from query params (period, startDate, endDate, month, year)
 */
const buildDateFilter = (query) => {
  const { period, startDate, endDate, month, year } = query;
  const now = new Date();

  if (startDate && endDate) {
    return {
      gte: new Date(startDate),
      lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
    };
  }

  if (month && year) {
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    return { gte: start, lte: end };
  }

  if (year && !month) {
    const y = parseInt(year, 10);
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31, 23, 59, 59, 999);
    return { gte: start, lte: end };
  }

  if (period) {
    switch (period) {
      case 'today': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return { gte: start, lte: end };
      }
      case 'this_week': {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(now.setDate(diff));
        start.setHours(0, 0, 0, 0);
        return { gte: start };
      }
      case 'this_month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { gte: start };
      }
      case 'last_month': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { gte: start, lte: end };
      }
      case 'this_year': {
        const start = new Date(now.getFullYear(), 0, 1);
        return { gte: start };
      }
      default:
        return undefined;
    }
  }

  return undefined;
};

/**
 * GET /api/expenses/dashboard
 * Summary telemetry for expenses ONLY.
 * Zero sales, zero customer income.
 */
exports.getExpenseDashboard = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const now = new Date();
    
    // Determine Asia/Colombo year and month
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const currentYear = parts.find(p => p.type === 'year').value;
    const currentMonth = parts.find(p => p.type === 'month').value;
    const currentMonthPrefix = `${currentYear}-${currentMonth}`;

    const whereBranch = branchScope !== 'ALL' ? { branchId: branchScope } : {};

    // Fetch all business expenses for the branch scope
    const allExpenses = await prisma.businessExpense.findMany({
      where: whereBranch,
      select: {
        id: true,
        expenseNumber: true,
        title: true,
        category: true,
        branchId: true,
        totalAmount: true,
        paidAmount: true,
        pendingAmount: true,
        dueDate: true,
        expenseDate: true,
        status: true,
        paymentMethod: true,
        isRecurring: true,
        billingMonth: true
      }
    });

    let totalExpensesThisMonth = 0;
    let totalExpensesThisYear = 0;
    let totalPaidExpenses = 0;
    let totalPendingExpenses = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    let salaryExpenses = 0;
    let monthlyRent = 0;
    let electricityExpenses = 0;
    let otherExpenses = 0;

    // Initialize 15 category breakdown
    const categoryBreakdown = {};
    VALID_CATEGORIES.forEach(cat => {
      categoryBreakdown[cat] = {
        category: cat,
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        count: 0
      };
    });

    // Monthly trend tracking for last 6 months
    const monthlyTrendMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyTrendMap[mStr] = { month: mStr, total: 0, paid: 0, pending: 0 };
    }

    allExpenses.forEach(exp => {
      const tot = Number(exp.totalAmount) || 0;
      const pd = Number(exp.paidAmount) || 0;
      const pnd = Number(exp.pendingAmount) || 0;
      const expDate = new Date(exp.expenseDate);
      const expYearStr = String(expDate.getFullYear());
      const expMonthStr = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;

      // Life-to-date totals
      totalPaidExpenses += pd;
      totalPendingExpenses += pnd;

      // This Year
      if (expYearStr === currentYear) {
        totalExpensesThisYear += tot;
      }

      // This Month
      if (expMonthStr === currentMonthPrefix) {
        totalExpensesThisMonth += tot;
      }

      // Overdue Check
      const isPastDue = exp.dueDate && new Date(exp.dueDate) < now && pnd > 0;
      if (isPastDue || exp.status === 'OVERDUE') {
        overdueCount += 1;
        overdueAmount += pnd;
      }

      // Specific highlight KPIs
      if (exp.category === 'STAFF_SALARY') salaryExpenses += tot;
      if (exp.category === 'SHOP_RENT') monthlyRent += tot;
      if (exp.category === 'ELECTRICITY_BILL') electricityExpenses += tot;
      if (exp.category === 'OTHER_EXPENSES' || exp.category === 'EMERGENCY_EXPENSES') otherExpenses += tot;

      // Category breakdown
      if (categoryBreakdown[exp.category]) {
        categoryBreakdown[exp.category].totalAmount += tot;
        categoryBreakdown[exp.category].paidAmount += pd;
        categoryBreakdown[exp.category].pendingAmount += pnd;
        categoryBreakdown[exp.category].count += 1;
      }

      // Monthly Trend (if within 6 months)
      if (monthlyTrendMap[expMonthStr]) {
        monthlyTrendMap[expMonthStr].total += tot;
        monthlyTrendMap[expMonthStr].paid += pd;
        monthlyTrendMap[expMonthStr].pending += pnd;
      }
    });

    res.json({
      success: true,
      data: {
        branchScope,
        currency: 'LKR',
        summary: {
          totalExpensesThisMonth,
          totalExpensesThisYear,
          totalPaidExpenses,
          totalPendingExpenses,
          overdueCount,
          overdueAmount,
          salaryExpenses,
          monthlyRent,
          electricityExpenses,
          otherExpenses
        },
        categoryBreakdown: Object.values(categoryBreakdown),
        monthlyTrend: Object.values(monthlyTrendMap),
        totalExpensesCount: allExpenses.length
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * GET /api/expenses
 * List expenses with filters, search, pagination, and date range support
 */
exports.getExpenses = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const {
      category,
      status,
      month,
      year,
      startDate,
      endDate,
      period,
      isRecurring,
      billingMonth,
      search,
      page = 1,
      limit = 50
    } = req.query;

    const where = {};
    if (branchScope !== 'ALL') {
      where.branchId = branchScope;
    }
    if (category && category !== 'ALL') {
      where.category = String(category).toUpperCase();
    }
    if (status && status !== 'ALL') {
      if (status === 'OVERDUE') {
        where.pendingAmount = { gt: 0 };
        where.dueDate = { lt: new Date() };
      } else {
        where.status = String(status).toUpperCase();
      }
    }
    if (isRecurring !== undefined && isRecurring !== 'ALL') {
      where.isRecurring = isRecurring === 'true' || isRecurring === true;
    }
    if (billingMonth) {
      where.billingMonth = String(billingMonth).trim();
    }

    // Apply date filtering
    const dateFilter = buildDateFilter({ period, startDate, endDate, month, year });
    if (dateFilter) {
      where.expenseDate = dateFilter;
    }

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { expenseNumber: { contains: q, mode: 'insensitive' } },
        { paidTo: { contains: q, mode: 'insensitive' } },
        { paidBy: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(100, Math.max(10, parseInt(limit, 10)));
    const skip = (pageNum - 1) * pageSize;

    const [expenses, total] = await Promise.all([
      prisma.businessExpense.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          payments: {
            orderBy: { paymentDate: 'desc' },
            take: 10
          }
        },
        orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize
      }),
      prisma.businessExpense.count({ where })
    ]);

    const now = new Date();

    // Format Decimal amounts as Numbers and evaluate overdue status dynamically
    const formatted = expenses.map(e => {
      const isPastDue = e.dueDate && new Date(e.dueDate) < now && Number(e.pendingAmount) > 0;
      let effectiveStatus = e.status;
      if (isPastDue && e.status !== 'PAID') {
        effectiveStatus = 'OVERDUE';
      }

      return {
        ...e,
        totalAmount: Number(e.totalAmount),
        paidAmount: Number(e.paidAmount),
        pendingAmount: Number(e.pendingAmount),
        previousBalance: Number(e.previousBalance || 0),
        expectedAmount: e.expectedAmount ? Number(e.expectedAmount) : null,
        status: effectiveStatus,
        isOverdue: isPastDue,
        payments: e.payments.map(p => ({
          ...p,
          amount: Number(p.amount)
        }))
      };
    });

    res.json({
      success: true,
      data: formatted,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * GET /api/expenses/:id
 * Retrieve single expense with complete payment history
 */
exports.getExpenseById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid expense ID' });
    }

    const branchScope = resolveBranchScope(req);

    const expense = await prisma.businessExpense.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      }
    });

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    if (branchScope !== 'ALL' && expense.branchId !== branchScope) {
      return res.status(403).json({ success: false, message: 'Access denied for requested expense branch.' });
    }

    const now = new Date();
    const isPastDue = expense.dueDate && new Date(expense.dueDate) < now && Number(expense.pendingAmount) > 0;

    res.json({
      success: true,
      data: {
        ...expense,
        totalAmount: Number(expense.totalAmount),
        paidAmount: Number(expense.paidAmount),
        pendingAmount: Number(expense.pendingAmount),
        previousBalance: Number(expense.previousBalance || 0),
        expectedAmount: expense.expectedAmount ? Number(expense.expectedAmount) : null,
        isOverdue: isPastDue,
        status: isPastDue && expense.status !== 'PAID' ? 'OVERDUE' : expense.status,
        payments: expense.payments.map(p => ({
          ...p,
          amount: Number(p.amount)
        }))
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * POST /api/expenses
 * Create new business expense (Paid Now or Pending / Bill)
 */
exports.createExpense = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const {
      title,
      category,
      amount,
      branchId,
      expenseDate,
      dueDate,
      paymentStatus, // 'PAID_NOW' or 'PENDING'
      paymentMethod,
      accountId,
      paidBy,
      paidTo,
      description,
      notes,
      receiptImage,
      approvalStatus,
      isRecurring,
      billingMonth,
      expectedAmount
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Expense title is required.' });
    }

    const cleanCategory = String(category || '').toUpperCase();
    if (!VALID_CATEGORIES.includes(cleanCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid expense category. Must be one of the 15 standard categories: ${VALID_CATEGORIES.join(', ')}`
      });
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Expense amount must be greater than zero.' });
    }

    let targetBranchId;
    if (branchScope === 'ALL') {
      targetBranchId = parseInt(branchId, 10);
      if (targetBranchId !== 1 && targetBranchId !== 2) {
        return res.status(400).json({ success: false, message: 'Target branch must be 1 (JB Group Main) or 2 (Bella Design).' });
      }
    } else {
      targetBranchId = branchScope;
    }

    // Receipt image size safety check
    if (receiptImage && receiptImage.length > 7 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Receipt attachment exceeds maximum size limit (5MB).' });
    }

    const isPaidNow = String(paymentStatus || '').toUpperCase() === 'PAID_NOW';
    const initialPaidAmount = isPaidNow ? numAmount : 0;
    const initialPendingAmount = isPaidNow ? 0 : numAmount;
    const initialStatus = isPaidNow ? 'PAID' : 'PENDING';

    const role = String(req.user?.role || '').toUpperCase();
    const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);
    const initialApproval = approvalStatus ? String(approvalStatus).toUpperCase() : (isExecutive ? 'APPROVED' : 'APPROVED');

    // Atomic creation inside Prisma interactive transaction
    const result = await prisma.$transaction(async (tx) => {
      const expenseNumber = await generateExpenseNumberTx(tx, 'EXP');

      const created = await tx.businessExpense.create({
        data: {
          expenseNumber,
          title: String(title).trim(),
          category: cleanCategory,
          branchId: targetBranchId,
          totalAmount: numAmount,
          paidAmount: initialPaidAmount,
          pendingAmount: initialPendingAmount,
          dueDate: dueDate ? new Date(dueDate) : null,
          expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
          paymentMethod: isPaidNow ? (paymentMethod ? String(paymentMethod).toUpperCase() : 'CASH') : null,
          paidBy: paidBy ? String(paidBy).trim() : (isPaidNow ? req.user.name : null),
          paidTo: paidTo ? String(paidTo).trim() : null,
          description: description ? String(description).trim() : null,
          notes: notes ? String(notes).trim() : null,
          receiptImage: receiptImage || null,
          status: initialStatus,
          approvalStatus: initialApproval,
          approvedById: isExecutive ? req.user.id : null,
          approvedByName: isExecutive ? req.user.name : null,
          createdById: req.user.id,
          createdByName: req.user.name || req.user.email,
          isRecurring: isRecurring === true || isRecurring === 'true',
          billingMonth: billingMonth ? String(billingMonth).trim() : null,
          expectedAmount: expectedAmount ? Number(expectedAmount) : numAmount
        }
      });

      // If paid immediately, create the initial payment history record
      if (isPaidNow) {
        const paymentNumber = await generateExpensePaymentNumberTx(tx, 'EXPPAY');
        let linkedTransactionId = null;

        // If financial account is specified and exists, adjust balance and log GL transaction
        if (accountId) {
          const accId = parseInt(accountId, 10);
          const account = await tx.financialAccount.findUnique({ where: { id: accId } });

          if (account && account.status === 'ACTIVE' && (!account.branchId || account.branchId === targetBranchId)) {
            // Decrement account balance
            await tx.financialAccount.update({
              where: { id: accId },
              data: {
                currentBalance: {
                  decrement: numAmount
                }
              }
            });

            // Find accounting category
            const glCode = CATEGORY_TO_GL_MAP[cleanCategory] || 'EXP_MISC';
            const catRecord = await tx.accountingCategory.findUnique({ where: { code: glCode } });

            if (catRecord) {
              const txnNumber = await generateTransactionNumberTx(tx, 'EXP');
              const glTxn = await tx.financialTransaction.create({
                data: {
                  transactionNumber: txnNumber,
                  transactionDate: new Date(),
                  branchId: targetBranchId,
                  type: 'EXPENSE',
                  categoryId: catRecord.id,
                  accountId: accId,
                  amount: numAmount,
                  paymentMethod: paymentMethod ? String(paymentMethod).toUpperCase() : 'CASH',
                  referenceNo: expenseNumber,
                  description: `Payment for ${title} (${cleanCategory})`,
                  notes: notes ? String(notes).trim() : null,
                  receiptImage: receiptImage || null,
                  approvalStatus: 'APPROVED',
                  approvedById: req.user.id,
                  approvedByName: req.user.name,
                  approvedAt: new Date(),
                  createdById: req.user.id,
                  createdByName: req.user.name || req.user.email,
                  sourceModule: 'BUSINESS_EXPENSE',
                  sourceRecordId: created.id
                }
              });
              linkedTransactionId = glTxn.id;
            }
          }
        }

        await tx.expensePaymentHistory.create({
          data: {
            expenseId: created.id,
            paymentNumber,
            amount: numAmount,
            paymentDate: expenseDate ? new Date(expenseDate) : new Date(),
            paymentMethod: paymentMethod ? String(paymentMethod).toUpperCase() : 'CASH',
            accountId: accountId ? parseInt(accountId, 10) : null,
            paidBy: paidBy ? String(paidBy).trim() : req.user.name,
            paidTo: paidTo ? String(paidTo).trim() : null,
            receiptImage: receiptImage || null,
            notes: notes ? String(notes).trim() : 'Initial payment on creation',
            transactionId: linkedTransactionId,
            createdById: req.user.id
          }
        });
      }

      return created;
    }, { timeout: 15000 });

    await logFinancialAudit({
      action: isPaidNow ? 'EXPENSE_RECORDED_AND_PAID' : 'EXPENSE_CREATED',
      entityType: 'BUSINESS_EXPENSE',
      entityId: result.id,
      amount: numAmount,
      branchId: targetBranchId,
      req,
      newState: result
    });

    res.status(201).json({
      success: true,
      message: `Expense ${result.expenseNumber} of LKR ${numAmount.toLocaleString()} recorded successfully.`,
      data: {
        ...result,
        totalAmount: Number(result.totalAmount),
        paidAmount: Number(result.paidAmount),
        pendingAmount: Number(result.pendingAmount)
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * PUT /api/expenses/:id
 * Edit an existing expense (Title, Amount, Due Date, Vendor, Notes, Category)
 * Strictly preserves payment history and recalculates pending balance
 */
exports.updateExpense = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid expense ID' });
    }

    const branchScope = resolveBranchScope(req);
    const existing = await prisma.businessExpense.findUnique({
      where: { id },
      include: { payments: true }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    if (branchScope !== 'ALL' && existing.branchId !== branchScope) {
      return res.status(403).json({ success: false, message: 'Access denied: Cannot edit expense belonging to another branch.' });
    }

    const {
      title,
      category,
      amount,
      dueDate,
      expenseDate,
      paidTo,
      description,
      notes,
      receiptImage,
      isRecurring,
      billingMonth,
      expectedAmount
    } = req.body;

    const existingPaid = Number(existing.paidAmount);
    let newTotal = amount !== undefined ? Number(amount) : Number(existing.totalAmount);

    if (newTotal <= 0) {
      return res.status(400).json({ success: false, message: 'Expense amount must be greater than zero.' });
    }

    // Amount cannot be lower than what has already been settled
    if (newTotal < existingPaid - 0.01) {
      return res.status(400).json({
        success: false,
        message: `Expense total cannot be reduced below the already settled amount of LKR ${existingPaid.toLocaleString()}.`
      });
    }

    const newPending = Math.max(0, newTotal - existingPaid);
    let newStatus = existing.status;
    if (newPending <= 0.01) {
      newStatus = 'PAID';
    } else if (existingPaid > 0) {
      newStatus = 'PARTIALLY_PAID';
    } else {
      newStatus = 'PENDING';
    }

    const cleanCategory = category ? String(category).toUpperCase() : existing.category;
    if (category && !VALID_CATEGORIES.includes(cleanCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid expense category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
      });
    }

    const updated = await prisma.businessExpense.update({
      where: { id },
      data: {
        title: title ? String(title).trim() : existing.title,
        category: cleanCategory,
        totalAmount: newTotal,
        pendingAmount: newPending,
        status: newStatus,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existing.dueDate,
        expenseDate: expenseDate ? new Date(expenseDate) : existing.expenseDate,
        paidTo: paidTo !== undefined ? (paidTo ? String(paidTo).trim() : null) : existing.paidTo,
        description: description !== undefined ? (description ? String(description).trim() : null) : existing.description,
        notes: notes !== undefined ? (notes ? String(notes).trim() : null) : existing.notes,
        receiptImage: receiptImage !== undefined ? receiptImage : existing.receiptImage,
        isRecurring: isRecurring !== undefined ? (isRecurring === true || isRecurring === 'true') : existing.isRecurring,
        billingMonth: billingMonth !== undefined ? (billingMonth ? String(billingMonth).trim() : null) : existing.billingMonth,
        expectedAmount: expectedAmount !== undefined ? (expectedAmount ? Number(expectedAmount) : null) : existing.expectedAmount
      },
      include: {
        branch: { select: { id: true, name: true } },
        payments: { orderBy: { paymentDate: 'desc' } }
      }
    });

    await logFinancialAudit({
      action: 'EXPENSE_UPDATED',
      entityType: 'BUSINESS_EXPENSE',
      entityId: id,
      amount: newTotal,
      branchId: existing.branchId,
      req,
      previousState: existing,
      newState: updated
    });

    res.json({
      success: true,
      message: `Expense ${updated.expenseNumber} updated successfully.`,
      data: {
        ...updated,
        totalAmount: Number(updated.totalAmount),
        paidAmount: Number(updated.paidAmount),
        pendingAmount: Number(updated.pendingAmount),
        payments: updated.payments.map(p => ({
          ...p,
          amount: Number(p.amount)
        }))
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * POST /api/expenses/:id/pay
 * Record full or partial payment for an existing pending expense
 * Never marks fully PAID until complete amount settled.
 */
exports.payExpense = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid expense ID' });
    }

    const branchScope = resolveBranchScope(req);
    const { amount, paymentDate, paymentMethod, accountId, paidBy, paidTo, receiptImage, notes } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    }

    const expense = await prisma.businessExpense.findUnique({ where: { id } });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    if (branchScope !== 'ALL' && expense.branchId !== branchScope) {
      return res.status(403).json({ success: false, message: 'Access denied: Cannot pay expense of another branch.' });
    }

    const pending = Number(expense.pendingAmount);
    if (pending <= 0) {
      return res.status(400).json({ success: false, message: 'This expense is already fully paid.' });
    }

    if (numAmount > pending + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (LKR ${numAmount.toLocaleString()}) cannot exceed pending amount (LKR ${pending.toLocaleString()}).`
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const paymentNumber = await generateExpensePaymentNumberTx(tx, 'EXPPAY');
      let linkedTransactionId = null;

      // Adjust FinancialAccount balance if account selected
      if (accountId) {
        const accId = parseInt(accountId, 10);
        const account = await tx.financialAccount.findUnique({ where: { id: accId } });

        if (account && account.status === 'ACTIVE' && (!account.branchId || account.branchId === expense.branchId)) {
          await tx.financialAccount.update({
            where: { id: accId },
            data: {
              currentBalance: {
                decrement: numAmount
              }
            }
          });

          // Create general ledger transaction
          const glCode = CATEGORY_TO_GL_MAP[expense.category] || 'EXP_MISC';
          const catRecord = await tx.accountingCategory.findUnique({ where: { code: glCode } });

          if (catRecord) {
            const txnNumber = await generateTransactionNumberTx(tx, 'EXP');
            const glTxn = await tx.financialTransaction.create({
              data: {
                transactionNumber: txnNumber,
                transactionDate: new Date(),
                branchId: expense.branchId,
                type: 'EXPENSE',
                categoryId: catRecord.id,
                accountId: accId,
                amount: numAmount,
                paymentMethod: paymentMethod ? String(paymentMethod).toUpperCase() : 'CASH',
                referenceNo: expense.expenseNumber,
                description: `Payment towards ${expense.title} (${expense.category})`,
                notes: notes ? String(notes).trim() : null,
                receiptImage: receiptImage || null,
                approvalStatus: 'APPROVED',
                approvedById: req.user.id,
                approvedByName: req.user.name,
                approvedAt: new Date(),
                createdById: req.user.id,
                createdByName: req.user.name || req.user.email,
                sourceModule: 'BUSINESS_EXPENSE',
                sourceRecordId: expense.id
              }
            });
            linkedTransactionId = glTxn.id;
          }
        }
      }

      // Record payment history
      await tx.expensePaymentHistory.create({
        data: {
          expenseId: expense.id,
          paymentNumber,
          amount: numAmount,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          paymentMethod: paymentMethod ? String(paymentMethod).toUpperCase() : 'CASH',
          accountId: accountId ? parseInt(accountId, 10) : null,
          paidBy: paidBy ? String(paidBy).trim() : req.user.name,
          paidTo: paidTo ? String(paidTo).trim() : expense.paidTo,
          receiptImage: receiptImage || null,
          notes: notes ? String(notes).trim() : 'Payment recorded',
          transactionId: linkedTransactionId,
          createdById: req.user.id
        }
      });

      const newPaidAmount = Number(expense.paidAmount) + numAmount;
      const newPendingAmount = Math.max(0, Number(expense.totalAmount) - newPaidAmount);
      const newStatus = newPendingAmount <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';

      const expUpdated = await tx.businessExpense.update({
        where: { id: expense.id },
        data: {
          paidAmount: newPaidAmount,
          pendingAmount: newPendingAmount,
          status: newStatus,
          paymentMethod: paymentMethod ? String(paymentMethod).toUpperCase() : expense.paymentMethod,
          paidBy: paidBy ? String(paidBy).trim() : expense.paidBy,
          paidTo: paidTo ? String(paidTo).trim() : expense.paidTo,
          receiptImage: receiptImage || expense.receiptImage
        }
      });

      return expUpdated;
    }, { timeout: 15000 });

    await logFinancialAudit({
      action: 'EXPENSE_PAYMENT_RECORDED',
      entityType: 'BUSINESS_EXPENSE',
      entityId: expense.id,
      amount: numAmount,
      branchId: expense.branchId,
      req,
      newState: updated
    });

    res.json({
      success: true,
      message: `Payment of LKR ${numAmount.toLocaleString()} recorded for expense ${expense.expenseNumber}.`,
      data: {
        ...updated,
        totalAmount: Number(updated.totalAmount),
        paidAmount: Number(updated.paidAmount),
        pendingAmount: Number(updated.pendingAmount)
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * DELETE /api/expenses/:id
 * Delete / cancel an unpaid expense (Admin / CEO only)
 * Strictly prevented if any payment has been recorded.
 */
exports.deleteExpense = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid expense ID' });
    }

    const branchScope = resolveBranchScope(req);
    const expense = await prisma.businessExpense.findUnique({ where: { id } });

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    if (branchScope !== 'ALL' && expense.branchId !== branchScope) {
      return res.status(403).json({ success: false, message: 'Access denied: Cannot delete expense of another branch.' });
    }

    if (Number(expense.paidAmount) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete an expense with recorded payments. Financial safety rule.'
      });
    }

    await prisma.businessExpense.delete({ where: { id } });

    await logFinancialAudit({
      action: 'EXPENSE_CANCELLED',
      entityType: 'BUSINESS_EXPENSE',
      entityId: id,
      amount: Number(expense.totalAmount),
      branchId: expense.branchId,
      req,
      previousState: expense
    });

    res.json({
      success: true,
      message: `Expense ${expense.expenseNumber} cancelled successfully.`
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * GET /api/expenses/recurring
 * Get recurring bills for a given month with previous balance and outstanding calculation
 */
exports.getRecurringBills = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const { billingMonth } = req.query;

    const currentBillingMonth = billingMonth || new Date().toISOString().substring(0, 7);

    const where = {
      isRecurring: true,
      billingMonth: currentBillingMonth
    };
    if (branchScope !== 'ALL') {
      where.branchId = branchScope;
    }

    const bills = await prisma.businessExpense.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        payments: { orderBy: { paymentDate: 'desc' } }
      },
      orderBy: [{ branchId: 'asc' }, { category: 'asc' }]
    });

    const formatted = bills.map(b => ({
      ...b,
      totalAmount: Number(b.totalAmount),
      paidAmount: Number(b.paidAmount),
      pendingAmount: Number(b.pendingAmount),
      previousBalance: Number(b.previousBalance || 0),
      expectedAmount: b.expectedAmount ? Number(b.expectedAmount) : Number(b.totalAmount),
      payments: b.payments.map(p => ({
        ...p,
        amount: Number(p.amount)
      }))
    }));

    res.json({
      success: true,
      data: formatted,
      billingMonth: currentBillingMonth,
      branchScope
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * POST /api/expenses/recurring/generate
 * Generate recurring monthly commitments for a billing month
 * Carries over previous month's unpaid balance into previousBalance!
 * Prevents duplicate bill creation.
 */
exports.generateRecurringBills = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const { billingMonth, branchId } = req.body;

    if (!billingMonth || !/^\d{4}-\d{2}$/.test(billingMonth)) {
      return res.status(400).json({ success: false, message: 'Valid billingMonth in format YYYY-MM is required.' });
    }

    let targetBranches = [];
    if (branchScope === 'ALL') {
      if (branchId && (branchId === 1 || branchId === 2)) {
        targetBranches = [branchId];
      } else {
        targetBranches = [1, 2];
      }
    } else {
      targetBranches = [branchScope];
    }

    // Determine previous month string (e.g. 2026-10 if billingMonth is 2026-11)
    const [y, m] = billingMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const createdBills = [];
    const skippedBills = [];

    await prisma.$transaction(async (tx) => {
      for (const bId of targetBranches) {
        for (const catDef of RECURRING_CATEGORIES) {
          // Check if bill already exists for this branch, category, and month
          const existing = await tx.businessExpense.findFirst({
            where: {
              branchId: bId,
              category: catDef.key,
              billingMonth: billingMonth,
              isRecurring: true
            }
          });

          if (existing) {
            skippedBills.push({
              branchId: bId,
              category: catDef.key,
              reason: 'Already exists'
            });
            continue;
          }

          // Check if previous month had an unpaid balance
          const prevBill = await tx.businessExpense.findFirst({
            where: {
              branchId: bId,
              category: catDef.key,
              billingMonth: prevMonthStr,
              isRecurring: true
            }
          });

          const previousUnpaid = prevBill ? Number(prevBill.pendingAmount) : 0;
          const expected = catDef.defaultExpected;
          const totalObligation = expected + previousUnpaid;

          const expNumber = await generateExpenseNumberTx(tx, 'EXP');

          // Due date defaults to 15th of the billing month
          const dueDate = new Date(y, m - 1, 15);

          const newBill = await tx.businessExpense.create({
            data: {
              expenseNumber: expNumber,
              title: `${catDef.defaultTitle} – ${billingMonth}`,
              category: catDef.key,
              branchId: bId,
              totalAmount: totalObligation,
              paidAmount: 0,
              pendingAmount: totalObligation,
              previousBalance: previousUnpaid,
              expectedAmount: expected,
              dueDate,
              expenseDate: new Date(y, m - 1, 1),
              status: 'PENDING',
              approvalStatus: 'APPROVED',
              isRecurring: true,
              billingMonth,
              description: `Recurring ${catDef.defaultTitle} for ${billingMonth}. Expected: LKR ${expected.toLocaleString()}, Carried Unpaid Balance: LKR ${previousUnpaid.toLocaleString()}`,
              createdById: req.user.id,
              createdByName: req.user.name || req.user.email
            }
          });

          createdBills.push(newBill);
        }
      }
    });

    await logFinancialAudit({
      action: 'RECURRING_BILLS_GENERATED',
      entityType: 'BUSINESS_EXPENSE',
      entityId: 0,
      branchId: targetBranches.length === 1 ? targetBranches[0] : null,
      req,
      newState: { createdCount: createdBills.length, skippedCount: skippedBills.length, billingMonth }
    });

    res.json({
      success: true,
      message: `Generated ${createdBills.length} recurring bill(s) for ${billingMonth}. ${skippedBills.length} existing bill(s) were preserved.`,
      data: {
        createdCount: createdBills.length,
        skippedCount: skippedBills.length,
        billingMonth,
        createdBills: createdBills.map(b => ({
          id: b.id,
          expenseNumber: b.expenseNumber,
          title: b.title,
          category: b.category,
          branchId: b.branchId,
          totalAmount: Number(b.totalAmount),
          previousBalance: Number(b.previousBalance)
        }))
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * GET /api/expenses/reports/comprehensive
 * Comprehensive aggregation: daily, weekly, monthly, yearly, category, and branch analytics
 */
exports.getComprehensiveExpenseReports = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const { year, month, startDate, endDate } = req.query;

    const targetYear = parseInt(year, 10) || new Date().getFullYear();
    const where = {};
    if (branchScope !== 'ALL') {
      where.branchId = branchScope;
    }

    const dateFilter = buildDateFilter({ startDate, endDate, month, year: targetYear });
    if (dateFilter) {
      where.expenseDate = dateFilter;
    } else {
      where.expenseDate = {
        gte: new Date(targetYear, 0, 1),
        lte: new Date(targetYear, 11, 31, 23, 59, 59, 999)
      };
    }

    const expenses = await prisma.businessExpense.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        payments: true
      },
      orderBy: { expenseDate: 'asc' }
    });

    let totalIncurred = 0;
    let totalPaid = 0;
    let totalPending = 0;

    // 1. Category-wise reports
    const categoryMap = {};
    VALID_CATEGORIES.forEach(cat => {
      categoryMap[cat] = { category: cat, total: 0, paid: 0, pending: 0, count: 0 };
    });

    // 2. Branch-wise reports
    const branchMap = {
      1: { branchId: 1, name: 'JB Group (Main)', total: 0, paid: 0, pending: 0, count: 0 },
      2: { branchId: 2, name: 'Bella Design', total: 0, paid: 0, pending: 0, count: 0 }
    };

    // 3. Monthly breakdown (12 months)
    const monthlyMap = {};
    for (let m = 1; m <= 12; m++) {
      const mStr = `${targetYear}-${String(m).padStart(2, '0')}`;
      monthlyMap[mStr] = { month: mStr, monthNum: m, total: 0, paid: 0, pending: 0, count: 0 };
    }

    // 4. Daily breakdown
    const dailyMap = {};

    expenses.forEach(exp => {
      const tot = Number(exp.totalAmount);
      const pd = Number(exp.paidAmount);
      const pnd = Number(exp.pendingAmount);

      totalIncurred += tot;
      totalPaid += pd;
      totalPending += pnd;

      // Category
      if (categoryMap[exp.category]) {
        categoryMap[exp.category].total += tot;
        categoryMap[exp.category].paid += pd;
        categoryMap[exp.category].pending += pnd;
        categoryMap[exp.category].count += 1;
      }

      // Branch
      if (branchMap[exp.branchId]) {
        branchMap[exp.branchId].total += tot;
        branchMap[exp.branchId].paid += pd;
        branchMap[exp.branchId].pending += pnd;
        branchMap[exp.branchId].count += 1;
      }

      // Monthly
      const d = new Date(exp.expenseDate);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[mKey]) {
        monthlyMap[mKey].total += tot;
        monthlyMap[mKey].paid += pd;
        monthlyMap[mKey].pending += pnd;
        monthlyMap[mKey].count += 1;
      }

      // Daily
      const dayKey = d.toISOString().split('T')[0];
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { date: dayKey, total: 0, paid: 0, pending: 0, count: 0 };
      }
      dailyMap[dayKey].total += tot;
      dailyMap[dayKey].paid += pd;
      dailyMap[dayKey].pending += pnd;
      dailyMap[dayKey].count += 1;
    });

    res.json({
      success: true,
      data: {
        targetYear,
        branchScope,
        currency: 'LKR',
        summary: {
          totalIncurred,
          totalPaid,
          totalPending,
          settlementRate: totalIncurred > 0 ? Math.round((totalPaid / totalIncurred) * 100) : 100
        },
        categoryBreakdown: Object.values(categoryMap),
        branchBreakdown: Object.values(branchMap),
        monthlyBreakdown: Object.values(monthlyMap),
        dailyBreakdown: Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 31)
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * GET /api/expenses/reports/monthly
 * Legacy monthly detailed expense report
 */
exports.getMonthlyExpenseReport = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const { year, month } = req.query;

    const targetYear = year || new Date().getFullYear();
    const targetMonth = month ? String(month).padStart(2, '0') : null;

    const where = {};
    if (branchScope !== 'ALL') {
      where.branchId = branchScope;
    }

    const expenses = await prisma.businessExpense.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        payments: true
      },
      orderBy: { expenseDate: 'asc' }
    });

    const reportByCategory = {};
    VALID_CATEGORIES.forEach(cat => {
      reportByCategory[cat] = {
        category: cat,
        total: 0,
        paid: 0,
        pending: 0,
        count: 0,
        items: []
      };
    });

    expenses.forEach(exp => {
      const d = new Date(exp.expenseDate);
      const expYear = d.getFullYear();
      const expMonth = String(d.getMonth() + 1).padStart(2, '0');

      if (String(expYear) === String(targetYear)) {
        if (!targetMonth || expMonth === targetMonth) {
          const tot = Number(exp.totalAmount);
          const pd = Number(exp.paidAmount);
          const pnd = Number(exp.pendingAmount);

          if (reportByCategory[exp.category]) {
            reportByCategory[exp.category].total += tot;
            reportByCategory[exp.category].paid += pd;
            reportByCategory[exp.category].pending += pnd;
            reportByCategory[exp.category].count += 1;
            reportByCategory[exp.category].items.push({
              id: exp.id,
              expenseNumber: exp.expenseNumber,
              title: exp.title,
              date: exp.expenseDate,
              total: tot,
              paid: pd,
              pending: pnd,
              status: exp.status,
              branchName: exp.branch?.name
            });
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        year: targetYear,
        month: targetMonth,
        branchScope,
        categories: Object.values(reportByCategory)
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};
