/**
 * Separate Expense Management Controller
 * JB GROUP (PVT) LTD — Version 3.4.0
 *
 * Dedicated strictly to Business Expenses only.
 * NO Sales, NO Sales Revenue, NO Order Income, NO Customer Receivables.
 * Enforces two-branch isolation (Branch 1: JB Group Main, Branch 2: Bella Design).
 * Complete CRUD, Multiple Partial/Full Payments, Recurring Bills, Audit Logs, and Comprehensive Reports.
 */

const { prisma, pool } = require('../prisma');
const {
  generateExpenseNumberTx,
  generateExpensePaymentNumberTx,
  generateTransactionNumberTx
} = require('../utils/financialSequenceGenerator');
const { logFinancialAudit } = require('../utils/financialAuditLogger');
const PDFDocument = require('pdfkit');

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

const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const resolveCashSummaryDateRange = (period = 'this_month', customStart, customEnd) => {
  const now = new Date();
  const colomboNow = new Date(now.getTime() + COLOMBO_OFFSET_MS);

  const year = colomboNow.getUTCFullYear();
  const month = colomboNow.getUTCMonth();
  const date = colomboNow.getUTCDate();

  let startDateUtc;
  let endDateUtc;

  switch (period) {
    case 'today': {
      startDateUtc = new Date(Date.UTC(year, month, date, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
      endDateUtc = new Date(Date.UTC(year, month, date, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);
      break;
    }
    case 'this_month': {
      startDateUtc = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      endDateUtc = new Date(Date.UTC(year, month, lastDay, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);
      break;
    }
    case 'this_year': {
      startDateUtc = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
      endDateUtc = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);
      break;
    }
    case 'custom':
    default: {
      if (customStart && customEnd) {
        const [sY, sM, sD] = customStart.split('-').map(Number);
        const [eY, eM, eD] = customEnd.split('-').map(Number);
        startDateUtc = new Date(Date.UTC(sY, sM - 1, sD, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
        endDateUtc = new Date(Date.UTC(eY, eM - 1, eD, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);
      } else {
        startDateUtc = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
        const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        endDateUtc = new Date(Date.UTC(year, month, lastDay, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);
      }
      break;
    }
  }

  return { startDateUtc, endDateUtc };
};

/**
 * GET /api/expenses/cash-summary
 * Business Cash Balance Integration Summary
 */
async function buildCashSummaryData(req) {
  const branchScope = resolveBranchScope(req);
  const { period = 'this_month', startDate, endDate } = req.query;
  const { startDateUtc, endDateUtc } = resolveCashSummaryDateRange(period, startDate, endDate);

  // 1. Total Sales Cash Received (Verified customer payments only)
  const paymentWhere = {
    status: 'VERIFIED',
    createdAt: { gte: startDateUtc, lte: endDateUtc }
  };
  if (branchScope !== 'ALL') {
    paymentWhere.order = { branchId: branchScope };
  }

  const periodPayments = await prisma.payment.findMany({
    where: paymentWhere,
    select: {
      amount: true,
      paymentMethod: true,
      notes: true,
      order: { select: { branchId: true } }
    }
  });

  let totalSalesReceived = 0;
  let cashReceived = 0;
  let bankReceived = 0;

  periodPayments.forEach(p => {
    const amt = Number(p.amount) || 0;
    totalSalesReceived += amt;
    const m = String(p.paymentMethod || 'Cash').toLowerCase();
    if (m.includes('cash')) cashReceived += amt;
    else bankReceived += amt;
  });

  // 2. Pending Customer Payments (Active order unpaid balances)
  const orderWhere = {
    status: { notIn: ['CANCELLED', 'REJECTED'] }
  };
  if (branchScope !== 'ALL') orderWhere.branchId = branchScope;

  const allOrders = await prisma.order.findMany({
    where: orderWhere,
    select: {
      id: true,
      totalAmount: true,
      agreedTotal: true,
      advancePayment: true,
      branchId: true,
      payments: {
        where: { status: 'VERIFIED' },
        select: { amount: true }
      }
    }
  });

  let pendingCustomerPayments = 0;
  allOrders.forEach(o => {
    const orderTotal = Number(o.agreedTotal || o.totalAmount || 0);
    let paid = 0;
    if (o.payments && o.payments.length > 0) {
      paid = o.payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    } else if (o.advancePayment && Number(o.advancePayment) > 0) {
      paid = Number(o.advancePayment);
    }
    const balanceDue = Math.max(0, orderTotal - paid);
    if (balanceDue > 0.01) {
      pendingCustomerPayments += balanceDue;
    }
  });

  // 3. Expenses Paid & Pending from BusinessExpense
  const expWhere = {
    expenseDate: { gte: startDateUtc, lte: endDateUtc }
  };
  if (branchScope !== 'ALL') expWhere.branchId = branchScope;

  const expensesList = await prisma.businessExpense.findMany({
    where: expWhere,
    select: {
      totalAmount: true,
      paidAmount: true,
      pendingAmount: true,
      category: true,
      branchId: true
    }
  });

  let totalExpenses = 0;
  let expensesPaid = 0;
  let pendingExpenses = 0;

  expensesList.forEach(e => {
    const tot = Number(e.totalAmount) || 0;
    const pd = Number(e.paidAmount) || 0;
    const pnd = Number(e.pendingAmount) || 0;

    totalExpenses += tot;
    // Prevent duplicate salary counting: exclude STAFF_SALARY category from expensesPaid
    if (e.category !== 'STAFF_SALARY') {
      expensesPaid += pd;
    }
    pendingExpenses += pnd;
  });

  // 4. Salaries Paid from Staff Payroll and Tailor Wages
  let tailorPaid = 0;
  try {
    const tailorSql = `
      SELECT COALESCE(SUM(p."amountPaid"), 0)::numeric as "tailorPaid"
      FROM "TailorSalaryPayment" p
      LEFT JOIN "Order" o ON p."orderId" = o.id
      WHERE p."paymentDate" >= $1 AND p."paymentDate" <= $2
      ${branchScope !== 'ALL' ? 'AND COALESCE(o."branchId", 1) = $3' : ''}
    `;
    const tailorParams = branchScope !== 'ALL' ? [startDateUtc, endDateUtc, branchScope] : [startDateUtc, endDateUtc];
    const tailorRes = await pool.query(tailorSql, tailorParams);
    tailorPaid = Number(tailorRes.rows[0]?.tailorPaid) || 0;
  } catch (err) {
    console.warn('TailorSalaryPayment query notice in cash-summary:', err.message);
  }

  const staffSalaryWhere = {
    status: 'PAID',
    paymentDate: { gte: startDateUtc, lte: endDateUtc }
  };
  if (branchScope !== 'ALL') staffSalaryWhere.branchId = branchScope;

  const staffSalaryList = await prisma.employeeSalary.findMany({
    where: staffSalaryWhere,
    select: { netSalary: true }
  });
  const staffPaid = staffSalaryList.reduce((s, e) => s + (Number(e.netSalary) || 0), 0);
  const totalSalariesPaid = tailorPaid + staffPaid;

  // 5. Remaining Cash Calculation
  // Actual Sales Payments Received - Actual Expenses Paid - Actual Salaries Paid
  const remainingCash = Math.round((totalSalesReceived - expensesPaid - totalSalariesPaid) * 100) / 100;

  // 6. Check Opening Balance Configuration
  const accountCount = await prisma.financialAccount.count();
  const isOpeningBalanceConfigured = accountCount > 0;

  return {
    success: true,
    branchScope,
    currency: 'LKR',
    period,
    dateRange: {
      start: startDateUtc.toISOString(),
      end: endDateUtc.toISOString()
    },
    summary: {
      totalSalesReceived: Math.round(totalSalesReceived * 100) / 100,
      pendingCustomerPayments: Math.round(pendingCustomerPayments * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      expensesPaid: Math.round(expensesPaid * 100) / 100,
      pendingExpenses: Math.round(pendingExpenses * 100) / 100,
      salariesPaid: Math.round(totalSalariesPaid * 100) / 100,
      remainingCash,
      isSurplus: remainingCash >= 0,
      isOpeningBalanceConfigured,
      balanceLabel: isOpeningBalanceConfigured
        ? 'Actual Available Cash & Bank Balance'
        : 'Net Cash Movement (Opening Balance Not Configured)',
      balanceNote: isOpeningBalanceConfigured
        ? 'Includes opening cash and bank balances plus period net cashflow.'
        : 'Opening balances are not configured for financial accounts. This represents Net Cash Movement for the selected period, not physical cash in till.',
      breakdown: {
        salesByMethod: {
          cash: Math.round(cashReceived * 100) / 100,
          bank: Math.round(bankReceived * 100) / 100
        },
        salaries: {
          tailorPaid: Math.round(tailorPaid * 100) / 100,
          staffPaid: Math.round(staffPaid * 100) / 100
        },
        ordersCount: allOrders.length,
        verifiedPaymentsCount: periodPayments.length
      }
    }
  };
}

exports.getBusinessCashSummary = async (req, res, next) => {
  try {
    let payload;
    try {
      payload = await buildCashSummaryData(req);
    } catch (firstErr) {
      if (firstErr.status) throw firstErr;
      console.warn('Cash summary retry after transient socket reset:', firstErr.message);
      await new Promise(r => setTimeout(r, 350));
      payload = await buildCashSummaryData(req);
    }
    return res.status(200).json(payload);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error in getBusinessCashSummary:', error);
    res.status(500).json({ success: false, message: 'Server error generating Business Cash Summary.' });
  }
};

/**
 * GET /api/expenses/:id/pdf
 * Generate and stream official printable Expense / Payment Voucher PDF
 */
exports.generateExpensePdf = async (req, res, next) => {
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
          orderBy: { paymentDate: 'asc' }
        }
      }
    });

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    if (branchScope !== 'ALL' && expense.branchId !== branchScope) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Cannot access expense vouchers outside your assigned branch.'
      });
    }

    // Determine overdue status
    const isPastDue = expense.dueDate && new Date(expense.dueDate) < new Date() && Number(expense.pendingAmount) > 0;
    const effectiveStatus = isPastDue && expense.status !== 'PAID' ? 'OVERDUE' : expense.status;

    // Set HTTP response headers for PDF download/inline preview
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="Expense_Voucher_${expense.expenseNumber}.pdf"`
    );

    const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });
    doc.pipe(res);

    const accentColor = '#dc2626';
    const borderColor = '#cbd5e1';
    const tableBg = '#f8fafc';

    // Company Branch Branding
    const branchName = expense.branchId === 2 ? 'BELLA DESIGN (PVT) LTD' : 'JB GROUP (PVT) LTD';
    const branchSubtitle = expense.branchId === 2
      ? 'Exclusive Atelier & Design Studio — Official Operating Disbursement'
      : 'Main Showroom & Executive Operations — Official Operating Disbursement';
    const branchAddress = expense.branchId === 2
      ? 'Branch 2 — Commercial Hub, Sri Lanka | Contact: +94 77 123 4568'
      : 'Branch 1 — Main Street, Colombo / Jaffna, Sri Lanka | Contact: +94 77 123 4567';

    // Header Bar
    doc.rect(40, 40, 515, 60).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text(branchName, 55, 48);
    doc.fontSize(8.5).font('Helvetica').fillColor('#cbd5e1').text(branchSubtitle, 55, 68);
    doc.text(branchAddress, 55, 80);

    // Voucher Title & Badge
    doc.rect(40, 105, 515, 34).fill(tableBg);
    doc.rect(40, 105, 515, 34).stroke(borderColor);
    doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold').text('PAYMENT & EXPENSE VOUCHER', 55, 114);

    // Status Badge
    const statusColors = {
      PAID: { bg: '#dcfce7', text: '#15803d' },
      PARTIALLY_PAID: { bg: '#fef3c7', text: '#b45309' },
      PENDING: { bg: '#ffedd5', text: '#c2410c' },
      OVERDUE: { bg: '#fee2e2', text: '#b91c1c' },
      CANCELLED: { bg: '#f1f5f9', text: '#64748b' }
    };
    const sc = statusColors[effectiveStatus] || { bg: '#f1f5f9', text: '#475569' };
    doc.roundedRect(435, 112, 105, 20, 4).fill(sc.bg);
    doc.fillColor(sc.text).fontSize(8.5).font('Helvetica-Bold').text(
      effectiveStatus.replace(/_/g, ' '),
      435,
      117,
      { width: 105, align: 'center' }
    );

    // Metadata Card
    doc.rect(40, 145, 515, 96).fill('#ffffff');
    doc.rect(40, 145, 515, 96).stroke(borderColor);

    const metaLeft = 55;
    const metaCol2 = 300;
    let curY = 153;

    const renderField = (label, val, x, y) => {
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text(label.toUpperCase(), x, y);
      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica').text(String(val || '—'), x, y + 10);
    };

    renderField('Voucher Number', expense.expenseNumber, metaLeft, curY);
    renderField(
      'Branch / Unit',
      expense.branch?.name || (expense.branchId === 1 ? 'JB Group (Main)' : 'Bella Design'),
      metaCol2,
      curY
    );

    curY += 28;
    renderField('Category', expense.category.replace(/_/g, ' '), metaLeft, curY);
    renderField('Payment Method', expense.paymentMethod || 'CASH', metaCol2, curY);

    curY += 28;
    renderField('Expense / Voucher Date', new Date(expense.expenseDate).toLocaleDateString('en-GB'), metaLeft, curY);
    renderField(
      'Due Date',
      expense.dueDate ? new Date(expense.dueDate).toLocaleDateString('en-GB') : 'Immediate',
      metaCol2,
      curY
    );

    // Payee & Beneficiary Card
    curY = 248;
    doc.rect(40, curY, 515, 46).fill(tableBg);
    doc.rect(40, curY, 515, 46).stroke(borderColor);

    renderField('Paid To (Beneficiary / Vendor)', expense.paidTo || 'N/A', metaLeft, curY + 6);
    renderField('Disbursed By (Cashier / Officer)', expense.paidBy || expense.createdByName || 'N/A', metaCol2, curY + 6);

    // Particulars / Description
    curY = 302;
    doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text('PARTICULARS & DISBURSEMENT DETAILS', 40, curY);
    curY += 14;
    doc.rect(40, curY, 515, 55).fill('#ffffff');
    doc.rect(40, curY, 515, 55).stroke(borderColor);

    doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text(expense.title, 50, curY + 8);
    if (expense.description) {
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica').text(expense.description, 50, curY + 22, { width: 495 });
    }
    if (expense.notes) {
      doc.fillColor('#64748b').fontSize(8).font('Helvetica-Oblique').text(`Notes: ${expense.notes}`, 50, curY + 36, { width: 495 });
    }

    // Financial Breakdown Box
    curY = 368;
    doc.rect(40, curY, 515, 52).fill('#f1f5f9');
    doc.rect(40, curY, 515, 52).stroke(borderColor);

    const colWidth = 515 / 3;
    // Total Incurred
    doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text('TOTAL INCURRED', 40, curY + 10, { width: colWidth, align: 'center' });
    doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text(
      `LKR ${Number(expense.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      40,
      curY + 24,
      { width: colWidth, align: 'center' }
    );

    // Paid Amount
    doc.fillColor('#15803d').fontSize(8).font('Helvetica-Bold').text('AMOUNT PAID', 40 + colWidth, curY + 10, { width: colWidth, align: 'center' });
    doc.fillColor('#15803d').fontSize(13).font('Helvetica-Bold').text(
      `LKR ${Number(expense.paidAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      40 + colWidth,
      curY + 24,
      { width: colWidth, align: 'center' }
    );

    // Pending Amount
    const pendColor = Number(expense.pendingAmount) > 0 ? '#ea580c' : '#64748b';
    doc.fillColor(pendColor).fontSize(8).font('Helvetica-Bold').text('BALANCE PENDING', 40 + colWidth * 2, curY + 10, { width: colWidth, align: 'center' });
    doc.fillColor(pendColor).fontSize(13).font('Helvetica-Bold').text(
      `LKR ${Number(expense.pendingAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      40 + colWidth * 2,
      curY + 24,
      { width: colWidth, align: 'center' }
    );

    // Payment Settlements Table
    curY = 432;
    doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text('SETTLEMENT / PAYMENT TRANSACTIONS', 40, curY);
    curY += 14;

    // Table Header
    doc.rect(40, curY, 515, 20).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
    doc.text('REC #', 45, curY + 6);
    doc.text('DATE', 125, curY + 6);
    doc.text('METHOD', 190, curY + 6);
    doc.text('PAID BY', 255, curY + 6);
    doc.text('PAID TO', 330, curY + 6);
    doc.text('AMOUNT (LKR)', 445, curY + 6, { width: 100, align: 'right' });
    curY += 20;

    if (expense.payments && expense.payments.length > 0) {
      expense.payments.forEach((p, idx) => {
        if (curY > 700) {
          doc.addPage();
          curY = 40;
        }

        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(40, curY, 515, 18).fill(bg);
        doc.rect(40, curY, 515, 18).stroke('#e2e8f0');

        doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica');
        doc.text(p.paymentNumber, 45, curY + 5);
        doc.text(new Date(p.paymentDate).toLocaleDateString('en-GB'), 125, curY + 5);
        doc.text(p.paymentMethod || 'CASH', 190, curY + 5);
        doc.text(p.paidBy || '—', 255, curY + 5);
        doc.text(p.paidTo || '—', 330, curY + 5);
        doc.font('Helvetica-Bold').text(
          Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }),
          445,
          curY + 5,
          { width: 100, align: 'right' }
        );
        curY += 18;
      });
    } else {
      doc.rect(40, curY, 515, 24).fill('#ffffff');
      doc.rect(40, curY, 515, 24).stroke('#e2e8f0');
      doc.fillColor('#64748b').fontSize(8).font('Helvetica-Oblique').text(
        `No settlements recorded yet. Full balance of LKR ${Number(expense.pendingAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} remains pending.`,
        50,
        curY + 8
      );
      curY += 24;
    }

    // Signatures Section (3 Signature Blocks)
    if (curY + 90 > 770) {
      doc.addPage();
      curY = 50;
    } else {
      curY = Math.max(curY + 35, 680);
    }

    const sigWidth = 145;
    const gap = 35;
    const s1X = 40;
    const s2X = s1X + sigWidth + gap;
    const s3X = s2X + sigWidth + gap;

    const renderSig = (x, title, name) => {
      doc.strokeColor('#94a3b8').lineWidth(1).moveTo(x, curY + 30).lineTo(x + sigWidth, curY + 30).stroke();
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(title, x, curY + 35, { width: sigWidth, align: 'center' });
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(name || 'Authorized Signatory', x, curY + 47, { width: sigWidth, align: 'center' });
    };

    renderSig(s1X, 'PREPARED BY', expense.createdByName || 'Cashier / Accountant');
    renderSig(s2X, 'CHECKED & APPROVED BY', expense.approvedByName || 'Manager / CEO');
    renderSig(s3X, 'RECEIVED BY', expense.paidTo || 'Beneficiary');

    // Bottom Footer Note
    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text(
      `JB GROUP ENTERPRISE ERP — Computer generated official voucher on ${new Date().toLocaleString('en-GB')}.`,
      40,
      785,
      { width: 515, align: 'center' }
    );

    doc.end();
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error generating expense voucher PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Server error generating expense voucher PDF.' });
    }
  }
};

/**
 * GET /api/expenses/export/pdf
 * Export filtered expense statements / category reports in Landscape A4 PDF
 */
exports.exportExpensesPdf = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const {
      category,
      status,
      search,
      period,
      startDate,
      endDate,
      month,
      year,
      billingMonth,
      isRecurring
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

    const expenses = await prisma.businessExpense.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } }
      },
      orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }]
    });

    const categoryTitle = category && category !== 'ALL'
      ? category.replace(/_/g, ' ') + ' Expenses'
      : 'All Business Expenses';

    const branchLabel = branchScope === 'ALL'
      ? 'All Branches (Consolidated)'
      : (branchScope === 1 ? 'Branch 1 — JB Group (Main)' : 'Branch 2 — Bella Design');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="Expense_Statement_${category || 'ALL'}_${Date.now()}.pdf"`
    );

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 35, autoFirstPage: true });
    doc.pipe(res);

    const pageWidth = 841.89;
    const pageHeight = 595.28;
    const margin = 35;
    const contentWidth = pageWidth - margin * 2; // 771.89

    // Header Banner
    doc.rect(margin, margin, contentWidth, 54).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text('JB GROUP ENTERPRISE — EXPENSE STATEMENT', margin + 15, margin + 10);
    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text(
      `Category: ${categoryTitle}  |  Branch: ${branchLabel}  |  Generated: ${new Date().toLocaleString('en-GB')}`,
      margin + 15,
      margin + 32
    );

    // Compute Totals
    const totalIncurred = expenses.reduce((acc, e) => acc + Number(e.totalAmount || 0), 0);
    const totalPaid = expenses.reduce((acc, e) => acc + Number(e.paidAmount || 0), 0);
    const totalPending = expenses.reduce((acc, e) => acc + Number(e.pendingAmount || 0), 0);

    // KPI Summary Bar
    let curY = margin + 62;
    doc.rect(margin, curY, contentWidth, 38).fill('#f8fafc');
    doc.rect(margin, curY, contentWidth, 38).stroke('#cbd5e1');

    const kpiWidth = contentWidth / 4;
    const renderKpi = (label, val, col, x) => {
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text(label.toUpperCase(), x, curY + 7, { width: kpiWidth, align: 'center' });
      doc.fillColor(col).fontSize(11).font('Helvetica-Bold').text(val, x, curY + 19, { width: kpiWidth, align: 'center' });
    };

    renderKpi('Total Records', `${expenses.length} Vouchers`, '#0f172a', margin);
    renderKpi('Total Incurred', `LKR ${totalIncurred.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, '#0f172a', margin + kpiWidth);
    renderKpi('Total Paid', `LKR ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, '#15803d', margin + kpiWidth * 2);
    renderKpi('Total Pending', `LKR ${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, totalPending > 0 ? '#ea580c' : '#64748b', margin + kpiWidth * 3);

    // Table Setup
    curY += 46;
    const cols = [
      { label: 'VOUCHER #', width: 90, align: 'left' },
      { label: 'DATE', width: 65, align: 'left' },
      { label: 'BRANCH', width: 95, align: 'left' },
      { label: 'EXPENSE TITLE & PARTICULARS', width: 200, align: 'left' },
      { label: 'PAID TO', width: 95, align: 'left' },
      { label: 'TOTAL (LKR)', width: 75, align: 'right' },
      { label: 'PAID (LKR)', width: 75, align: 'right' },
      { label: 'PENDING', width: 75, align: 'right' }
    ];

    const drawTableHeader = (y) => {
      doc.rect(margin, y, contentWidth, 20).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
      let xOffset = margin + 6;
      cols.forEach(c => {
        doc.text(c.label, xOffset, y + 6, { width: c.width, align: c.align });
        xOffset += c.width;
      });
    };

    drawTableHeader(curY);
    curY += 20;

    expenses.forEach((e, idx) => {
      if (curY > pageHeight - margin - 50) {
        doc.addPage();
        curY = margin;
        drawTableHeader(curY);
        curY += 20;
      }

      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(margin, curY, contentWidth, 20).fill(rowBg);
      doc.rect(margin, curY, contentWidth, 20).stroke('#e2e8f0');

      doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica');
      let xOffset = margin + 6;

      doc.font('Helvetica-Bold').text(e.expenseNumber, xOffset, curY + 6, { width: cols[0].width });
      xOffset += cols[0].width;

      doc.font('Helvetica').text(new Date(e.expenseDate).toLocaleDateString('en-GB'), xOffset, curY + 6, { width: cols[1].width });
      xOffset += cols[1].width;

      const bName = e.branch?.name || (e.branchId === 1 ? 'JB Group (Main)' : 'Bella Design');
      doc.text(bName, xOffset, curY + 6, { width: cols[2].width });
      xOffset += cols[2].width;

      doc.text(e.title || '—', xOffset, curY + 6, { width: cols[3].width, lineBreak: false });
      xOffset += cols[3].width;

      doc.text(e.paidTo || '—', xOffset, curY + 6, { width: cols[4].width });
      xOffset += cols[4].width;

      doc.font('Helvetica-Bold').text(
        Number(e.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }),
        xOffset,
        curY + 6,
        { width: cols[5].width, align: 'right' }
      );
      xOffset += cols[5].width;

      doc.fillColor('#15803d').text(
        Number(e.paidAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }),
        xOffset,
        curY + 6,
        { width: cols[6].width, align: 'right' }
      );
      xOffset += cols[6].width;

      const pCol = Number(e.pendingAmount) > 0 ? '#ea580c' : '#64748b';
      doc.fillColor(pCol).text(
        Number(e.pendingAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }),
        xOffset,
        curY + 6,
        { width: cols[7].width, align: 'right' }
      );

      curY += 20;
    });

    // Totals Row
    if (curY > pageHeight - margin - 50) {
      doc.addPage();
      curY = margin;
    }
    doc.rect(margin, curY, contentWidth, 22).fill('#e2e8f0');
    doc.rect(margin, curY, contentWidth, 22).stroke('#94a3b8');
    doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
    doc.text('STATEMENT TOTALS:', margin + 10, curY + 7);

    let xOffset = margin + 6 + cols[0].width + cols[1].width + cols[2].width + cols[3].width + cols[4].width;
    doc.text(totalIncurred.toLocaleString('en-US', { minimumFractionDigits: 2 }), xOffset, curY + 7, { width: cols[5].width, align: 'right' });
    xOffset += cols[5].width;
    doc.fillColor('#15803d').text(totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 }), xOffset, curY + 7, { width: cols[6].width, align: 'right' });
    xOffset += cols[6].width;
    doc.fillColor(totalPending > 0 ? '#ea580c' : '#0f172a').text(totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 }), xOffset, curY + 7, { width: cols[7].width, align: 'right' });

    // Signatures Block
    curY = Math.min(curY + 35, pageHeight - margin - 40);
    const sWidth = 160;
    const sGap = (contentWidth - sWidth * 3) / 2;
    const sigs = [
      { title: 'PREPARED BY', sub: 'Accounts / Disbursement Officer' },
      { title: 'VERIFIED BY', sub: 'Branch Manager / Audit' },
      { title: 'APPROVED BY', sub: 'CEO / Managing Director' }
    ];

    sigs.forEach((s, i) => {
      const sx = margin + i * (sWidth + sGap);
      doc.strokeColor('#94a3b8').lineWidth(1).moveTo(sx, curY).lineTo(sx + sWidth, curY).stroke();
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(s.title, sx, curY + 5, { width: sWidth, align: 'center' });
      doc.fillColor('#64748b').fontSize(7).font('Helvetica').text(s.sub, sx, curY + 15, { width: sWidth, align: 'center' });
    });

    doc.end();
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error exporting expense statement PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Server error exporting expense statement PDF.' });
    }
  }
};

