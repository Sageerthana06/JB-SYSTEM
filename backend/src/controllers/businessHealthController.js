/**
 * Business Financial Control & Health Dashboard Controller
 * JB GROUP (PVT) LTD — Version 4.0.0
 *
 * Comprehensive Executive Financial Control & Remaining Balance System.
 * Connects Orders, Verified Payments, Expense Management (15 Categories),
 * Staff Payroll, Weekly Tailor Salary Allocations, Monthly Bills, and General Ledger.
 *
 * Strict Compliance:
 * 1. Only counts actual received payments. Unpaid order balances are NOT counted as received cash.
 * 2. Does NOT assume net cashflow is the same as available cash.
 * 3. If opening balances are not configured, clearly indicates available balance is incomplete.
 * 4. Shows two separate calculations: Actual Cashflow vs. Available Cash & Bank Balance.
 * 5. Shows Projected Balance after settling obligations separately.
 * 6. Branch RBAC: CEO has consolidated ('ALL'), Branch 1, Branch 2; Manager & Admin locked to assigned branch.
 */

const { prisma, pool } = require('../prisma');

const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Standard 15 Expense Categories for JB GROUP
 */
const EXPENSE_CATEGORIES = [
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

/**
 * Resolve branch scope strictly according to RBAC.
 * SUPER_ADMIN / CEO: 'ALL', 1, or 2.
 * MANAGER / ADMIN: strictly locked to assigned branch (1 or 2).
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
        message: `Access denied: ${role} is restricted to assigned Branch ${assignedBranch}. Cannot access consolidated 'ALL' or other branches.`
      };
    }
  }

  return assignedBranch;
};

/**
 * Helper: Parse date range in Asia/Colombo (+05:30)
 */
const resolveColomboDateRange = (period, customStart, customEnd) => {
  const now = new Date();
  const colomboNow = new Date(now.getTime() + COLOMBO_OFFSET_MS);

  const year = colomboNow.getUTCFullYear();
  const month = colomboNow.getUTCMonth();
  const date = colomboNow.getUTCDate();
  const day = colomboNow.getUTCDay();

  let startDateUtc;
  let endDateUtc;

  switch (period) {
    case 'today': {
      startDateUtc = new Date(Date.UTC(year, month, date, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
      endDateUtc = new Date(Date.UTC(year, month, date, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);
      break;
    }
    case 'this_week': {
      const diffToMonday = day === 0 ? 6 : day - 1;
      const mondayDate = date - diffToMonday;
      startDateUtc = new Date(Date.UTC(year, month, mondayDate, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
      endDateUtc = new Date(Date.UTC(year, month, mondayDate + 6, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);
      break;
    }
    case 'this_month': {
      startDateUtc = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      endDateUtc = new Date(Date.UTC(year, month, lastDay, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);
      break;
    }
    case 'last_month': {
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      startDateUtc = new Date(Date.UTC(prevYear, prevMonth, 1, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
      const lastDayPrev = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
      endDateUtc = new Date(Date.UTC(prevYear, prevMonth, lastDayPrev, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);
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
 * GET /api/finance/dashboard/business-health
 * Complete Business Financial Control & Remaining Balance Dashboard
 */
async function buildDashboardData(req) {
  const branchScope = resolveBranchScope(req);
  const { period = 'this_month', startDate, endDate } = req.query;

  const { startDateUtc, endDateUtc } = resolveColomboDateRange(period, startDate, endDate);
  const now = new Date();

    // Colombo Time Boundaries for Fixed Intervals (Today, Week, Month, Year)
    const colomboNow = new Date(now.getTime() + COLOMBO_OFFSET_MS);
    const curYear = colomboNow.getUTCFullYear();
    const curMonth = colomboNow.getUTCMonth();
    const curDate = colomboNow.getUTCDate();
    const curDay = colomboNow.getUTCDay();

    const todayStartUtc = new Date(Date.UTC(curYear, curMonth, curDate, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
    const todayEndUtc = new Date(Date.UTC(curYear, curMonth, curDate, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);

    const diffToMon = curDay === 0 ? 6 : curDay - 1;
    const weekStartUtc = new Date(Date.UTC(curYear, curMonth, curDate - diffToMon, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
    const weekEndUtc = new Date(Date.UTC(curYear, curMonth, curDate - diffToMon + 6, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);

    const monthStartUtc = new Date(Date.UTC(curYear, curMonth, 1, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
    const lastDayCurMonth = new Date(Date.UTC(curYear, curMonth + 1, 0)).getUTCDate();
    const monthEndUtc = new Date(Date.UTC(curYear, curMonth, lastDayCurMonth, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);

    const yearStartUtc = new Date(Date.UTC(curYear, 0, 1, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
    const yearEndUtc = new Date(Date.UTC(curYear, 11, 31, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);

    // =========================================================================
    // 1. TOTAL BUSINESS INCOME (Only Actual Received Payments)
    // =========================================================================
    // Base filter for payments
    const basePaymentWhere = {
      status: 'VERIFIED'
    };
    if (branchScope !== 'ALL') {
      basePaymentWhere.order = { branchId: branchScope };
    }

    // A. Selected Period Payments
    const periodPayments = await prisma.payment.findMany({
      where: {
        ...basePaymentWhere,
        createdAt: { gte: startDateUtc, lte: endDateUtc }
      },
      include: {
        order: { select: { id: true, orderNumber: true, branchId: true } }
      }
    });

    let periodIncome = 0;
    let cashReceived = 0;
    let bankReceived = 0;
    let cardReceived = 0;
    let branch1PeriodIncome = 0;
    let branch2PeriodIncome = 0;

    let advancePaymentsReceived = 0;
    let partialPaymentsReceived = 0;
    let finalPaymentsReceived = 0;

    periodPayments.forEach(p => {
      const amt = Number(p.amount) || 0;
      periodIncome += amt;

      const m = String(p.paymentMethod || 'Cash').toLowerCase();
      if (m.includes('cash')) cashReceived += amt;
      else if (m.includes('bank') || m.includes('transfer') || m.includes('cheque')) bankReceived += amt;
      else if (m.includes('card')) cardReceived += amt;
      else cashReceived += amt;

      const bId = p.order?.branchId || 1;
      if (bId === 1) branch1PeriodIncome += amt;
      else if (bId === 2) branch2PeriodIncome += amt;

      const notes = String(p.notes || '').toLowerCase();
      if (notes.includes('advance')) advancePaymentsReceived += amt;
      else if (notes.includes('final') || notes.includes('settlement')) finalPaymentsReceived += amt;
      else partialPaymentsReceived += amt;
    });

    // B. Other Non-Order Operating Income from General Ledger
    const otherIncomeWhere = {
      type: 'INCOME',
      approvalStatus: 'APPROVED',
      isReversed: false,
      transactionDate: { gte: startDateUtc, lte: endDateUtc },
      sourceModule: { not: 'ORDER_PAYMENT' } // prevent double counting
    };
    if (branchScope !== 'ALL') otherIncomeWhere.branchId = branchScope;

    const otherIncomeTxns = await prisma.financialTransaction.findMany({
      where: otherIncomeWhere,
      select: { amount: true, branchId: true, paymentMethod: true }
    });

    let otherIncomeTotal = 0;
    otherIncomeTxns.forEach(t => {
      const amt = Number(t.amount) || 0;
      otherIncomeTotal += amt;
      periodIncome += amt;
      const m = String(t.paymentMethod || 'CASH').toLowerCase();
      if (m.includes('cash')) cashReceived += amt;
      else bankReceived += amt;

      if (t.branchId === 1) branch1PeriodIncome += amt;
      else if (t.branchId === 2) branch2PeriodIncome += amt;
    });

    // C. Income by Fixed Timeframes (Today, This Week, This Month, This Year)
    // Efficient single query for year payments; subsets filtered in-memory to prevent connection pool exhaustion
    const yearPaymentsAll = await prisma.payment.findMany({
      where: { ...basePaymentWhere, createdAt: { gte: yearStartUtc, lte: yearEndUtc } },
      select: { amount: true, createdAt: true }
    });

    let todayIncome = 0;
    let thisWeekIncome = 0;
    let thisMonthIncome = 0;
    let thisYearIncome = 0;

    for (const p of yearPaymentsAll) {
      const amt = Number(p.amount) || 0;
      thisYearIncome += amt;
      const createdTime = new Date(p.createdAt).getTime();
      if (createdTime >= todayStartUtc.getTime() && createdTime <= todayEndUtc.getTime()) {
        todayIncome += amt;
      }
      if (createdTime >= weekStartUtc.getTime() && createdTime <= weekEndUtc.getTime()) {
        thisWeekIncome += amt;
      }
      if (createdTime >= monthStartUtc.getTime() && createdTime <= monthEndUtc.getTime()) {
        thisMonthIncome += amt;
      }
    }

    // =========================================================================
    // 2. COMPLETE BUSINESS EXPENSES (15 Categories from BusinessExpense & GL)
    // =========================================================================
    const expWhere = {
      expenseDate: { gte: startDateUtc, lte: endDateUtc }
    };
    if (branchScope !== 'ALL') expWhere.branchId = branchScope;

    const businessExpenses = await prisma.businessExpense.findMany({
      where: expWhere,
      include: { branch: { select: { id: true, name: true } } }
    });

    const categoryStats = {};
    EXPENSE_CATEGORIES.forEach(cat => {
      categoryStats[cat] = { paid: 0, pending: 0, total: 0, count: 0 };
    });

    let totalExpensesPaid = 0;
    let totalExpensesPending = 0;
    let branch1ExpensesPaid = 0;
    let branch2ExpensesPaid = 0;

    businessExpenses.forEach(exp => {
      const tot = Number(exp.totalAmount) || 0;
      const pd = Number(exp.paidAmount) || 0;
      const pnd = Number(exp.pendingAmount) || 0;

      totalExpensesPaid += pd;
      totalExpensesPending += pnd;

      if (exp.branchId === 1) branch1ExpensesPaid += pd;
      else if (exp.branchId === 2) branch2ExpensesPaid += pd;

      const catKey = exp.category;
      if (categoryStats[catKey]) {
        categoryStats[catKey].paid += pd;
        categoryStats[catKey].pending += pnd;
        categoryStats[catKey].total += tot;
        categoryStats[catKey].count += 1;
      } else {
        categoryStats['OTHER_EXPENSES'].paid += pd;
        categoryStats['OTHER_EXPENSES'].pending += pnd;
        categoryStats['OTHER_EXPENSES'].total += tot;
        categoryStats['OTHER_EXPENSES'].count += 1;
      }
    });

    // Also include any other approved expense transactions from FinancialTransaction
    // where sourceModule !== 'BUSINESS_EXPENSE' to prevent double counting
    const extraExpTxns = await prisma.financialTransaction.findMany({
      where: {
        type: 'EXPENSE',
        approvalStatus: 'APPROVED',
        isReversed: false,
        transactionDate: { gte: startDateUtc, lte: endDateUtc },
        sourceModule: { notIn: ['BUSINESS_EXPENSE', 'STAFF_SALARY', 'TAILOR_SALARY'] },
        ...(branchScope !== 'ALL' ? { branchId: branchScope } : {})
      },
      include: { category: true }
    });

    extraExpTxns.forEach(t => {
      const amt = Number(t.amount) || 0;
      totalExpensesPaid += amt;
      if (t.branchId === 1) branch1ExpensesPaid += amt;
      else if (t.branchId === 2) branch2ExpensesPaid += amt;
      categoryStats['OTHER_EXPENSES'].paid += amt;
      categoryStats['OTHER_EXPENSES'].total += amt;
      categoryStats['OTHER_EXPENSES'].count += 1;
    });

    // Extract key categories for dashboard cards
    const rentPaid = categoryStats['SHOP_RENT'].paid;
    const rentPending = categoryStats['SHOP_RENT'].pending;
    const electricityPaid = categoryStats['ELECTRICITY_BILL'].paid;
    const electricityPending = categoryStats['ELECTRICITY_BILL'].pending;
    const waterPaid = categoryStats['WATER_BILL'].paid;
    const waterPending = categoryStats['WATER_BILL'].pending;
    const internetPaid = categoryStats['INTERNET_BILL'].paid;
    const telephonePaid = categoryStats['TELEPHONE_BILL'].paid;

    // =========================================================================
    // 3. COMPLETE STAFF SALARY CONTROL (Tailors & Staff)
    // =========================================================================
    // A. Tailor Salaries Paid
    let tailorSalariesPaid = 0;
    let branch1TailorPaid = 0;
    let branch2TailorPaid = 0;

    try {
      const tailorSql = `
        SELECT p."amountPaid", COALESCE(o."branchId", 1) as "branchId"
        FROM "TailorSalaryPayment" p
        LEFT JOIN "Order" o ON p."orderId" = o.id
        WHERE p."paymentDate" >= $1 AND p."paymentDate" <= $2
        ${branchScope !== 'ALL' ? 'AND COALESCE(o."branchId", 1) = $3' : ''}
      `;
      const tailorParams = branchScope !== 'ALL' ? [startDateUtc, endDateUtc, branchScope] : [startDateUtc, endDateUtc];
      const tailorRes = await pool.query(tailorSql, tailorParams);

      tailorRes.rows.forEach(r => {
        const amt = Number(r.amountPaid) || 0;
        tailorSalariesPaid += amt;
        if (Number(r.branchId) === 1) branch1TailorPaid += amt;
        else if (Number(r.branchId) === 2) branch2TailorPaid += amt;
      });
    } catch (e) {
      console.warn('TailorSalaryPayment query notice:', e.message);
    }

    // B. Staff, Admin, and Manager Salaries Paid
    const staffSalaryPaidWhere = {
      status: 'PAID',
      paymentDate: { gte: startDateUtc, lte: endDateUtc }
    };
    if (branchScope !== 'ALL') staffSalaryPaidWhere.branchId = branchScope;

    const staffSalariesPaidList = await prisma.employeeSalary.findMany({
      where: staffSalaryPaidWhere,
      select: { netSalary: true, branchId: true }
    });

    let staffSalariesPaid = 0;
    let branch1StaffPaid = 0;
    let branch2StaffPaid = 0;

    staffSalariesPaidList.forEach(s => {
      const amt = Number(s.netSalary) || 0;
      staffSalariesPaid += amt;
      if (s.branchId === 1) branch1StaffPaid += amt;
      else if (s.branchId === 2) branch2StaffPaid += amt;
    });

    const totalSalariesPaid = tailorSalariesPaid + staffSalariesPaid;
    const branch1TotalSalaries = branch1TailorPaid + branch1StaffPaid;
    const branch2TotalSalaries = branch2TailorPaid + branch2StaffPaid;

    // C. Pending Staff Salaries (Approved / Draft awaiting disbursement)
    const staffPendingWhere = {
      status: { in: ['DRAFT', 'APPROVED'] }
    };
    if (branchScope !== 'ALL') staffPendingWhere.branchId = branchScope;

    const staffPendingList = await prisma.employeeSalary.findMany({
      where: staffPendingWhere,
      select: { netSalary: true }
    });
    const pendingStaffSalary = staffPendingList.reduce((acc, s) => acc + (Number(s.netSalary) || 0), 0);

    // D. Pending Tailor Salaries (Completed cutting & stitching tasks on valid orders)
    let pendingTailorSalary = 0;
    try {
      const pendingTailorSql = `
        SELECT COALESCE(SUM(
          COALESCE(o."agreedTotal", o."totalAmount", 0) * 0.25
        ), 0)::numeric AS "pendingWages"
        FROM "OrderTask" t
        JOIN "Order" o ON t."orderId" = o.id
        WHERE t.status = 'COMPLETED'
          AND o.status NOT IN ('CANCELLED', 'REJECTED')
          ${branchScope !== 'ALL' ? 'AND o."branchId" = ' + branchScope : ''}
          AND NOT EXISTS (
            SELECT 1 FROM "TailorSalaryPayment" p 
            WHERE p."orderId" = o.id 
              AND (((t."taskType" ILIKE '%cutting%' OR t."taskName" ILIKE '%cutting%') AND p."workType" = 'CUTTING') 
                OR ((t."taskType" NOT ILIKE '%cutting%' AND t."taskName" NOT ILIKE '%cutting%') AND p."workType" = 'STITCHING'))
          );
      `;
      const pTailorRes = await pool.query(pendingTailorSql);
      pendingTailorSalary = Math.round((Number(pTailorRes.rows[0]?.pendingWages) || 0) * 100) / 100;
    } catch (e) {
      console.warn('Pending tailor query notice:', e.message);
    }

    const totalPendingSalaries = pendingStaffSalary + pendingTailorSalary;
    const totalSalariesPayable = totalSalariesPaid + totalPendingSalaries;

    // E. Salary Advances (Disbursed and active, not yet deducted)
    const advanceWhere = {
      status: 'DISBURSED',
      deductedInSalaryId: null
    };
    if (branchScope !== 'ALL') advanceWhere.branchId = branchScope;

    const activeAdvances = await prisma.salaryAdvance.findMany({
      where: advanceWhere,
      select: { amount: true }
    });
    const salaryAdvancesTotal = activeAdvances.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

    // =========================================================================
    // 4. MONTHLY BILLS AND OUTSTANDING PAYMENTS
    // =========================================================================
    // Utility and Rent categories in BusinessExpense where isRecurring = true OR category in utility list
    const RECURRING_KEYS = ['SHOP_RENT', 'ELECTRICITY_BILL', 'WATER_BILL', 'INTERNET_BILL', 'TELEPHONE_BILL'];
    
    let totalBillsReceived = 0;
    let totalBillsPaid = 0;
    let totalPendingBills = 0;
    let overdueBillsAmount = 0;
    let overdueBillsCount = 0;
    const billAlerts = [];

    // Also include MonthlyBill table if records exist
    const monthlyBills = await prisma.monthlyBill.findMany({
      where: branchScope !== 'ALL' ? { branchId: branchScope } : {}
    });

    monthlyBills.forEach(b => {
      const exp = Number(b.expectedAmount) || 0;
      const act = b.actualAmount !== null ? Number(b.actualAmount) : exp;
      const paid = Number(b.paidAmount) || 0;
      const bal = Math.max(0, act - paid);

      totalBillsReceived += act;
      totalBillsPaid += paid;
      totalPendingBills += bal;

      if (bal > 0.01 && new Date(b.dueDate) < now) {
        overdueBillsAmount += bal;
        overdueBillsCount++;
        billAlerts.push({
          title: `${b.billName} Overdue`,
          amount: bal,
          dueDate: b.dueDate,
          category: b.category
        });
      }
    });

    // Add recurring commitments from BusinessExpense
    businessExpenses.forEach(exp => {
      if (exp.isRecurring || RECURRING_KEYS.includes(exp.category)) {
        const tot = Number(exp.totalAmount) || 0;
        const pd = Number(exp.paidAmount) || 0;
        const pnd = Number(exp.pendingAmount) || 0;

        totalBillsReceived += tot;
        totalBillsPaid += pd;
        totalPendingBills += pnd;

        if (pnd > 0.01 && exp.dueDate && new Date(exp.dueDate) < now) {
          overdueBillsAmount += pnd;
          overdueBillsCount++;
          billAlerts.push({
            title: `${exp.title} Overdue`,
            amount: pnd,
            dueDate: exp.dueDate,
            category: exp.category
          });
        }
      }
    });

    // Other pending non-bill expenses
    let otherPendingExpenses = 0;
    businessExpenses.forEach(exp => {
      if (!exp.isRecurring && !RECURRING_KEYS.includes(exp.category)) {
        otherPendingExpenses += Number(exp.pendingAmount) || 0;
      }
    });

    // Total Business Obligations (Pending Salaries + Unpaid Bills + Other Pending Expenses)
    const totalBusinessObligations = totalPendingSalaries + totalPendingBills + otherPendingExpenses;

    // =========================================================================
    // 5. CUSTOMER OUTSTANDING (Accounts Receivable)
    // =========================================================================
    const orderWhere = {
      status: { notIn: ['CANCELLED', 'REJECTED'] }
    };
    if (branchScope !== 'ALL') orderWhere.branchId = branchScope;

    const allOrders = await prisma.order.findMany({
      where: orderWhere,
      select: {
        id: true,
        orderNumber: true,
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

    let totalCustomerBalance = 0; // Customer receivables
    let fullyPaidOrdersCount = 0;
    let unpaidOrdersCount = 0;

    allOrders.forEach(o => {
      const orderTotal = Number(o.agreedTotal || o.totalAmount || 0);
      let paid = 0;
      if (o.payments && o.payments.length > 0) {
        paid = o.payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      } else if (o.advancePayment && Number(o.advancePayment) > 0) {
        paid = Number(o.advancePayment);
      }

      const balanceDue = Math.max(0, orderTotal - paid);
      if (balanceDue <= 0.01) {
        fullyPaidOrdersCount++;
      } else {
        totalCustomerBalance += balanceDue;
        unpaidOrdersCount++;
      }
    });

    // =========================================================================
    // 6. FINAL REMAINING MONEY CALCULATION (TWO SEPARATE CALCULATIONS)
    // =========================================================================
    // Calculation 1: ACTUAL CASHFLOW
    // Total actual income received - Actual operating expenses paid - Actual salaries paid = Net cashflow
    const totalActualIncomeReceived = periodIncome;
    const totalActualExpensesPaid = totalExpensesPaid;
    const totalActualSalariesPaid = totalSalariesPaid;
    const totalMoneyPaid = totalActualExpensesPaid + totalActualSalariesPaid;
    const netCashflow = totalActualIncomeReceived - totalMoneyPaid;

    // Calculation 2: ACTUAL AVAILABLE CASH & BANK BALANCE
    // Opening cash & bank balances + Actual money received - Actual money paid = Current balance
    const acctWhere = { status: 'ACTIVE' };
    if (branchScope !== 'ALL') {
      acctWhere.OR = [
        { branchId: branchScope },
        { branchId: null }
      ];
    }

    const accounts = await prisma.financialAccount.findMany({
      where: acctWhere,
      include: { branch: { select: { id: true, name: true } } }
    });

    let openingCash = 0;
    let openingBank = 0;
    let currentCash = 0;
    let currentBank = 0;
    const cashAccountsList = [];
    const bankAccountsList = [];

    accounts.forEach(acc => {
      const op = Number(acc.openingBalance) || 0;
      const cur = Number(acc.currentBalance) || 0;
      const item = {
        id: acc.id,
        name: acc.accountName,
        type: acc.accountType,
        openingBalance: op,
        currentBalance: cur,
        bankName: acc.bankName,
        branchName: acc.branch?.name || 'Group Central'
      };

      if (acc.accountType === 'CASH') {
        openingCash += op;
        currentCash += cur;
        cashAccountsList.push(item);
      } else {
        openingBank += op;
        currentBank += cur;
        bankAccountsList.push(item);
      }
    });

    const totalOpeningBalance = openingCash + openingBank;
    const totalCurrentAccountBalance = currentCash + currentBank;
    const isOpeningBalanceConfigured = accounts.length > 0 && totalOpeningBalance > 0;

    // =========================================================================
    // 7. AFTER ALL PAYMENTS – FINAL BUSINESS POSITION (MANAGEMENT PROJECTION)
    // =========================================================================
    // Current available funds - Outstanding obligations = Projected balance
    // If accounts are configured, use totalCurrentAccountBalance; otherwise use netCashflow
    const baseFundForProjection = isOpeningBalanceConfigured ? totalCurrentAccountBalance : netCashflow;
    const projectedRemainingBalance = baseFundForProjection - totalBusinessObligations;

    // =========================================================================
    // 8. 6-MONTH HISTORICAL TREND
    // =========================================================================
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mYear = d.getFullYear();
      const mMonth = d.getMonth();
      const mStart = new Date(Date.UTC(mYear, mMonth, 1, 0, 0, 0) - COLOMBO_OFFSET_MS);
      const lastDay = new Date(Date.UTC(mYear, mMonth + 1, 0)).getUTCDate();
      const mEnd = new Date(Date.UTC(mYear, mMonth, lastDay, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);

      const mPayments = await prisma.payment.findMany({
        where: {
          status: 'VERIFIED',
          createdAt: { gte: mStart, lte: mEnd },
          ...(branchScope !== 'ALL' ? { order: { branchId: branchScope } } : {})
        },
        select: { amount: true }
      });
      const mIncome = mPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

      const mExpenses = await prisma.businessExpense.findMany({
        where: {
          expenseDate: { gte: mStart, lte: mEnd },
          ...(branchScope !== 'ALL' ? { branchId: branchScope } : {})
        },
        select: { paidAmount: true }
      });
      const mExpPaid = mExpenses.reduce((acc, e) => acc + (Number(e.paidAmount) || 0), 0);

      const monthLabel = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      monthlyTrend.push({
        month: monthLabel,
        income: Math.round(mIncome * 100) / 100,
        expense: Math.round(mExpPaid * 100) / 100,
        netCashflow: Math.round((mIncome - mExpPaid) * 100) / 100
      });
    }

    // Response Payload
    return {
      success: true,
      branchScope,
      period,
      currency: 'LKR',
      dateRange: {
        start: startDateUtc.toISOString(),
        end: endDateUtc.toISOString()
      },

      // 5. CEO MAIN FINANCIAL DASHBOARD (CARDS A THROUGH H)
      dashboardCards: {
        cardA_totalMoneyReceived: Math.round(totalActualIncomeReceived * 100) / 100,
        cardB_totalExpensesPaid: Math.round(totalActualExpensesPaid * 100) / 100,
        cardC_totalSalariesPaid: Math.round(totalActualSalariesPaid * 100) / 100,
        cardD_totalRemainingCashflow: Math.round(netCashflow * 100) / 100,
        cardE_totalPendingSalaries: Math.round(totalPendingSalaries * 100) / 100,
        cardF_totalPendingBills: Math.round(totalPendingBills * 100) / 100,
        cardG_totalCustomerBalance: Math.round(totalCustomerBalance * 100) / 100,
        cardH_totalBusinessObligations: Math.round(totalBusinessObligations * 100) / 100
      },

      // 6. FINAL REMAINING MONEY CALCULATION (TWO SEPARATE CALCULATIONS)
      remainingCalculations: {
        // Calculation 1: Actual Cashflow
        cashflowCalculation: {
          title: 'ACTUAL CASHFLOW (Period Inflows Minus Outflows)',
          totalIncomeReceived: Math.round(totalActualIncomeReceived * 100) / 100,
          totalExpensesPaid: Math.round(totalActualExpensesPaid * 100) / 100,
          totalSalariesPaid: Math.round(totalActualSalariesPaid * 100) / 100,
          totalPaidDisbursements: Math.round(totalMoneyPaid * 100) / 100,
          netCashflow: Math.round(netCashflow * 100) / 100,
          isSurplus: netCashflow >= 0
        },

        // Calculation 2: Available Cash & Bank Balance
        availableBalanceCalculation: {
          title: 'ACTUAL AVAILABLE CASH & BANK BALANCE',
          isOpeningBalanceConfigured,
          incompleteWarning: !isOpeningBalanceConfigured
            ? 'Opening balances are not configured for financial accounts. Available balance is incomplete. Net cashflow is shown separately above.'
            : null,
          openingCash: Math.round(openingCash * 100) / 100,
          openingBank: Math.round(openingBank * 100) / 100,
          totalOpeningBalance: Math.round(totalOpeningBalance * 100) / 100,
          moneyReceived: Math.round(totalActualIncomeReceived * 100) / 100,
          moneyPaid: Math.round(totalMoneyPaid * 100) / 100,
          currentCashInHand: Math.round(currentCash * 100) / 100,
          currentBankBalance: Math.round(currentBank * 100) / 100,
          totalAvailableBalance: Math.round(totalCurrentAccountBalance * 100) / 100,
          cashAccounts: cashAccountsList,
          bankAccounts: bankAccountsList
        }
      },

      // 7. AFTER ALL PAYMENTS – FINAL BUSINESS POSITION (MANAGEMENT PROJECTION)
      finalBusinessPosition: {
        title: 'AFTER ALL PAYMENTS — PROJECTED BUSINESS POSITION',
        badge: 'MANAGEMENT PROJECTION',
        note: 'Projected balance after settling all pending salaries, unpaid utility bills, and outstanding obligations. Clearly separated from actual physical cash.',
        baseAvailableFunds: Math.round(baseFundForProjection * 100) / 100,
        deductions: {
          pendingSalaries: Math.round(totalPendingSalaries * 100) / 100,
          unpaidBills: Math.round(totalPendingBills * 100) / 100,
          otherPendingExpenses: Math.round(otherPendingExpenses * 100) / 100,
          totalObligationsToSettle: Math.round(totalBusinessObligations * 100) / 100
        },
        projectedRemainingBalance: Math.round(projectedRemainingBalance * 100) / 100,
        customerReceivables: {
          amount: Math.round(totalCustomerBalance * 100) / 100,
          note: 'Customer outstanding orders are shown separately as receivables. Unpaid customer orders are NOT received cash.'
        }
      },

      // 1. TOTAL BUSINESS INCOME BREAKDOWN
      incomeDetails: {
        today: Math.round(todayIncome * 100) / 100,
        thisWeek: Math.round(thisWeekIncome * 100) / 100,
        thisMonth: Math.round(thisMonthIncome * 100) / 100,
        thisYear: Math.round(thisYearIncome * 100) / 100,
        periodTotal: Math.round(totalActualIncomeReceived * 100) / 100,
        byMethod: {
          cash: Math.round(cashReceived * 100) / 100,
          bank: Math.round(bankReceived * 100) / 100,
          card: Math.round(cardReceived * 100) / 100
        },
        byBranch: {
          branch1_jbGroupMain: Math.round(branch1PeriodIncome * 100) / 100,
          branch2_bellaDesign: Math.round(branch2PeriodIncome * 100) / 100
        },
        byType: {
          advancePayments: Math.round(advancePaymentsReceived * 100) / 100,
          partialPayments: Math.round(partialPaymentsReceived * 100) / 100,
          finalPayments: Math.round(finalPaymentsReceived * 100) / 100,
          otherOperatingIncome: Math.round(otherIncomeTotal * 100) / 100
        }
      },

      // 2. COMPLETE BUSINESS EXPENSES BREAKDOWN (15 Categories)
      expenseDetails: {
        totalPaid: Math.round(totalActualExpensesPaid * 100) / 100,
        totalPending: Math.round(totalExpensesPending * 100) / 100,
        grandTotal: Math.round((totalActualExpensesPaid + totalExpensesPending) * 100) / 100,
        categories: categoryStats,
        majorUtilities: {
          rent: { paid: rentPaid, pending: rentPending },
          electricity: { paid: electricityPaid, pending: electricityPending },
          water: { paid: waterPaid, pending: waterPending },
          internet: { paid: internetPaid, pending: categoryStats['INTERNET_BILL'].pending },
          telephone: { paid: telephonePaid, pending: categoryStats['TELEPHONE_BILL'].pending }
        }
      },

      // 3. COMPLETE STAFF SALARY CONTROL
      salaryControl: {
        totalSalariesPayable: Math.round(totalSalariesPayable * 100) / 100,
        totalSalariesPaid: Math.round(totalSalariesPaid * 100) / 100,
        remainingSalaryPayable: Math.round(totalPendingSalaries * 100) / 100,
        breakdown: {
          tailorSalariesPaid: Math.round(tailorSalariesPaid * 100) / 100,
          staffSalariesPaid: Math.round(staffSalariesPaid * 100) / 100,
          pendingTailorSalary: Math.round(pendingTailorSalary * 100) / 100,
          pendingStaffSalary: Math.round(pendingStaffSalary * 100) / 100,
          salaryAdvancesDisbursed: Math.round(salaryAdvancesTotal * 100) / 100
        },
        branchSalaries: {
          branch1: Math.round(branch1TotalSalaries * 100) / 100,
          branch2: Math.round(branch2TotalSalaries * 100) / 100
        }
      },

      // 4. MONTHLY BILLS & OUTSTANDING OBLIGATIONS
      billsAndObligations: {
        totalBillsReceived: Math.round(totalBillsReceived * 100) / 100,
        totalBillsPaid: Math.round(totalBillsPaid * 100) / 100,
        unpaidBills: Math.round(totalPendingBills * 100) / 100,
        overdueBillsAmount: Math.round(overdueBillsAmount * 100) / 100,
        overdueBillsCount,
        outstandingSalaries: Math.round(totalPendingSalaries * 100) / 100,
        otherPendingExpenses: Math.round(otherPendingExpenses * 100) / 100,
        completeOutstandingObligations: Math.round(totalBusinessObligations * 100) / 100,
        alerts: billAlerts
      },

      // 9. TWO BRANCHES BREAKDOWN
      branchComparison: {
        branch1: {
          branchId: 1,
          name: 'JB Group (Main)',
          income: Math.round(branch1PeriodIncome * 100) / 100,
          expensesPaid: Math.round(branch1ExpensesPaid * 100) / 100,
          salariesPaid: Math.round(branch1TotalSalaries * 100) / 100,
          netCashflow: Math.round((branch1PeriodIncome - branch1ExpensesPaid - branch1TotalSalaries) * 100) / 100
        },
        branch2: {
          branchId: 2,
          name: 'Bella Design',
          income: Math.round(branch2PeriodIncome * 100) / 100,
          expensesPaid: Math.round(branch2ExpensesPaid * 100) / 100,
          salariesPaid: Math.round(branch2TotalSalaries * 100) / 100,
          netCashflow: Math.round((branch2PeriodIncome - branch2ExpensesPaid - branch2TotalSalaries) * 100) / 100
        }
      },

      monthlyTrend
    };
}

exports.getBusinessHealthDashboard = async (req, res, next) => {
  try {
    let payload;
    try {
      payload = await buildDashboardData(req);
    } catch (firstErr) {
      if (firstErr.status) throw firstErr;
      console.warn('Dashboard query retry after transient socket disconnect:', firstErr.message);
      await new Promise(r => setTimeout(r, 400));
      payload = await buildDashboardData(req);
    }
    return res.status(200).json(payload);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error generating Financial Control Dashboard:', error);
    res.status(500).json({ success: false, message: 'Server error generating Financial Control Dashboard.' });
  }
};

/**
 * GET /api/finance/reports/monthly-control
 * Monthly Executive Financial Control Report with previous month comparison
 */
exports.getMonthlyControlReport = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const { year, month } = req.query;

    const targetYear = parseInt(year, 10) || new Date().getFullYear();
    const targetMonth = parseInt(month, 10) || (new Date().getMonth() + 1); // 1-12

    // Current Month UTC Bounds
    const mStartUtc = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0) - COLOMBO_OFFSET_MS);
    const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    const mEndUtc = new Date(Date.UTC(targetYear, targetMonth - 1, lastDay, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);

    // Previous Month UTC Bounds
    const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    const prevStartUtc = new Date(Date.UTC(prevYear, prevMonth - 1, 1, 0, 0, 0) - COLOMBO_OFFSET_MS);
    const lastDayPrev = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
    const prevEndUtc = new Date(Date.UTC(prevYear, prevMonth - 1, lastDayPrev, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);

    // Helper to calculate month stats
    const computeMonthMetrics = async (sUtc, eUtc) => {
      // 1. Income (Verified Payments)
      const payWhere = {
        status: 'VERIFIED',
        createdAt: { gte: sUtc, lte: eUtc },
        ...(branchScope !== 'ALL' ? { order: { branchId: branchScope } } : {})
      };
      const payments = await prisma.payment.findMany({ where: payWhere, select: { amount: true } });
      const totalIncome = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      // 2. Expenses Paid
      const expWhere = {
        expenseDate: { gte: sUtc, lte: eUtc },
        ...(branchScope !== 'ALL' ? { branchId: branchScope } : {})
      };
      const expenses = await prisma.businessExpense.findMany({ where: expWhere, select: { paidAmount: true, pendingAmount: true } });
      const totalExpensesPaid = expenses.reduce((sum, e) => sum + (Number(e.paidAmount) || 0), 0);
      const totalPendingBills = expenses.reduce((sum, e) => sum + (Number(e.pendingAmount) || 0), 0);

      // 3. Salaries Paid
      let tailorWages = 0;
      try {
        const tSql = `
          SELECT COALESCE(SUM(p."amountPaid"), 0)::numeric AS "wages"
          FROM "TailorSalaryPayment" p
          LEFT JOIN "Order" o ON p."orderId" = o.id
          WHERE p."paymentDate" >= $1 AND p."paymentDate" <= $2
          ${branchScope !== 'ALL' ? 'AND COALESCE(o."branchId", 1) = $3' : ''}
        `;
        const tParams = branchScope !== 'ALL' ? [sUtc, eUtc, branchScope] : [sUtc, eUtc];
        const tRes = await pool.query(tSql, tParams);
        tailorWages = Number(tRes.rows[0]?.wages) || 0;
      } catch (e) {
        console.warn('Tailor query in monthly report notice:', e.message);
      }

      const staffSalWhere = {
        status: 'PAID',
        paymentDate: { gte: sUtc, lte: eUtc },
        ...(branchScope !== 'ALL' ? { branchId: branchScope } : {})
      };
      const staffSal = await prisma.employeeSalary.findMany({ where: staffSalWhere, select: { netSalary: true } });
      const staffWages = staffSal.reduce((sum, s) => sum + (Number(s.netSalary) || 0), 0);
      const totalSalariesPaid = tailorWages + staffWages;

      // Pending Salaries
      const staffPending = await prisma.employeeSalary.findMany({
        where: {
          status: { in: ['DRAFT', 'APPROVED'] },
          ...(branchScope !== 'ALL' ? { branchId: branchScope } : {})
        },
        select: { netSalary: true }
      });
      const pendingSalaries = staffPending.reduce((sum, s) => sum + (Number(s.netSalary) || 0), 0);

      const totalPaid = totalExpensesPaid + totalSalariesPaid;
      const netCashflow = totalIncome - totalPaid;

      return {
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpensesPaid: Math.round(totalExpensesPaid * 100) / 100,
        totalSalariesPaid: Math.round(totalSalariesPaid * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        pendingSalaries: Math.round(pendingSalaries * 100) / 100,
        pendingBills: Math.round(totalPendingBills * 100) / 100,
        netCashflow: Math.round(netCashflow * 100) / 100
      };
    };

    const currentMonthData = await computeMonthMetrics(mStartUtc, mEndUtc);
    const prevMonthData = await computeMonthMetrics(prevStartUtc, prevEndUtc);

    const comparison = {
      incomeDiff: Math.round((currentMonthData.totalIncome - prevMonthData.totalIncome) * 100) / 100,
      expensesDiff: Math.round((currentMonthData.totalExpensesPaid - prevMonthData.totalExpensesPaid) * 100) / 100,
      salariesDiff: Math.round((currentMonthData.totalSalariesPaid - prevMonthData.totalSalariesPaid) * 100) / 100,
      cashflowDiff: Math.round((currentMonthData.netCashflow - prevMonthData.netCashflow) * 100) / 100
    };

    res.status(200).json({
      success: true,
      branchScope,
      year: targetYear,
      month: targetMonth,
      monthLabel: new Date(targetYear, targetMonth - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      prevMonthLabel: new Date(prevYear, prevMonth - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      currentMonth: currentMonthData,
      previousMonth: prevMonthData,
      comparison
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error generating monthly control report:', error);
    res.status(500).json({ success: false, message: 'Server error generating monthly control report.' });
  }
};
