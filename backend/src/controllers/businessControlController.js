/**
 * Business Financial Control & P&L Controller
 * JB GROUP (PVT) LTD — Version 3.2.0
 * Provides executive financial control, branch-isolated P&L, customer outstanding AR,
 * and executive summary dashboards in Asia/Colombo time.
 */

const { prisma, pool } = require('../prisma');

const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Helper: Resolve branch scope strictly according to RBAC.
 * Executive (SUPER_ADMIN, ADMIN, CEO) -> 'ALL', 1, or 2.
 * Manager -> Strictly locked to their assigned branch (1 or 2).
 */
const resolveBranchScope = (req) => {
  const user = req.user;
  const role = String(user?.role || '').toUpperCase();
  const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);
  const managerBranch = user?.branchId ? Number(user.branchId) : null;

  if (isExecutive) {
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

  // Managers are strictly isolated
  if (!managerBranch || (managerBranch !== 1 && managerBranch !== 2)) {
    throw { status: 403, message: 'Access denied: Manager is not assigned to an active branch.' };
  }

  const qBranch = req.query?.branchId || req.body?.branchId;
  if (qBranch) {
    const cleanQ = String(qBranch).trim().toUpperCase();
    if (cleanQ === 'ALL' || parseInt(cleanQ, 10) !== managerBranch) {
      throw {
        status: 403,
        message: `Access denied: Managers are restricted to their assigned branch (${managerBranch}). Cannot access consolidated 'ALL' or other branches.`
      };
    }
  }

  return managerBranch;
};

/**
 * Helper: Parse date range in Asia/Colombo (+05:30)
 */
const resolveColomboDateRange = (period, customStart, customEnd) => {
  const now = new Date();
  const colomboNow = new Date(now.getTime() + COLOMBO_OFFSET_MS);

  const year = colomboNow.getUTCFullYear();
  const month = colomboNow.getUTCMonth(); // 0-11
  const date = colomboNow.getUTCDate();
  const day = colomboNow.getUTCDay(); // 0 is Sunday

  let startDateUtc;
  let endDateUtc;

  switch (period) {
    case 'today': {
      startDateUtc = new Date(Date.UTC(year, month, date, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
      endDateUtc = new Date(Date.UTC(year, month, date, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);
      break;
    }
    case 'this_week': {
      // Monday as first day of week
      const diffToMonday = day === 0 ? 6 : day - 1;
      const mondayDate = date - diffToMonday;
      startDateUtc = new Date(Date.UTC(year, month, mondayDate, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
      endDateUtc = new Date(Date.UTC(year, month, mondayDate + 6, 23, 59, 59, 999) - COLOMBO_OFFSET_MS);
      break;
    }
    case 'this_month': {
      startDateUtc = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - COLOMBO_OFFSET_MS);
      // Last day of month
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
        // Default to this_month
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
 * GET /api/finance/reports/profit-and-loss
 * Calculate real Profit & Loss statement based on verified payments, COGS, and OPEX.
 * Internal transfers and unverified/unpaid transactions are strictly excluded.
 */
exports.getProfitAndLoss = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const { period = 'this_month', startDate, endDate } = req.query;

    const { startDateUtc, endDateUtc } = resolveColomboDateRange(period, startDate, endDate);

    // 1. REVENUE: Verified customer payments
    const paymentWhere = {
      status: 'VERIFIED',
      createdAt: { gte: startDateUtc, lte: endDateUtc }
    };

    if (branchScope !== 'ALL') {
      paymentWhere.order = { branchId: branchScope };
    }

    const verifiedPayments = await prisma.payment.findMany({
      where: paymentWhere,
      include: {
        order: { select: { id: true, orderNumber: true, branchId: true, orderSource: true } }
      }
    });

    let totalRevenue = 0;
    const revenueByMethod = {};
    const revenueByBranch = { 1: 0, 2: 0 };
    const revenueBySource = { SHOP: 0, ONLINE: 0 };

    verifiedPayments.forEach(p => {
      const amt = Number(p.amount) || 0;
      totalRevenue += amt;

      const method = p.paymentMethod || 'Cash';
      revenueByMethod[method] = (revenueByMethod[method] || 0) + amt;

      const bId = p.order?.branchId || 1;
      if (revenueByBranch[bId] !== undefined) {
        revenueByBranch[bId] += amt;
      }

      const src = p.order?.orderSource === 'ONLINE' ? 'ONLINE' : 'SHOP';
      revenueBySource[src] = (revenueBySource[src] || 0) + amt;
    });

    // 2. COGS: Direct Material Spend & Tailor Production Costs
    // A. Material purchases from FinancialTransaction (PURCHASE_MATERIAL or COGS_MATERIAL)
    const cogsTxnWhere = {
      type: 'EXPENSE',
      approvalStatus: 'APPROVED',
      isReversed: false,
      transactionDate: { gte: startDateUtc, lte: endDateUtc },
      category: {
        code: { in: ['PURCHASE_MATERIAL', 'COGS_MATERIAL'] }
      }
    };
    if (branchScope !== 'ALL') {
      cogsTxnWhere.branchId = branchScope;
    }

    const cogsTransactions = await prisma.financialTransaction.findMany({
      where: cogsTxnWhere,
      include: { category: true }
    });

    let materialSpend = 0;
    const cogsByBranch = { 1: 0, 2: 0 };

    cogsTransactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      materialSpend += amt;
      if (cogsByBranch[t.branchId] !== undefined) {
        cogsByBranch[t.branchId] += amt;
      }
    });

    // B. Tailor wages / payments from TailorSalaryPayment
    let tailorWages = 0;
    try {
      const tailorSalarySql = `
        SELECT COALESCE(SUM(p."amountPaid"), 0)::numeric AS "totalWages",
               COALESCE(o."branchId", 1) AS "branchId"
        FROM "TailorSalaryPayment" p
        LEFT JOIN "Order" o ON p."orderId" = o.id
        WHERE p."createdAt" >= $1 AND p."createdAt" <= $2
        ${branchScope !== 'ALL' ? 'AND COALESCE(o."branchId", 1) = $3' : ''}
        GROUP BY o."branchId"
      `;
      const tailorSalaryParams = branchScope !== 'ALL'
        ? [startDateUtc, endDateUtc, branchScope]
        : [startDateUtc, endDateUtc];

      const tailorRes = await pool.query(tailorSalarySql, tailorSalaryParams);
      tailorRes.rows.forEach(r => {
        const amt = Number(r.totalWages) || 0;
        tailorWages += amt;
        const bId = Number(r.branchId) || 1;
        if (cogsByBranch[bId] !== undefined) {
          cogsByBranch[bId] += amt;
        }
      });
    } catch (tailorErr) {
      console.warn('TailorSalaryPayment query notice (non-fatal):', tailorErr.message);
    }

    const totalCogs = materialSpend + tailorWages;
    const grossProfit = totalRevenue - totalCogs;
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // 3. OPERATING EXPENSES (OPEX)
    // All approved expenses in FinancialTransaction that are NOT direct materials (COGS)
    const opexWhere = {
      type: 'EXPENSE',
      approvalStatus: 'APPROVED',
      isReversed: false,
      transactionDate: { gte: startDateUtc, lte: endDateUtc },
      category: {
        code: { notIn: ['PURCHASE_MATERIAL', 'COGS_MATERIAL'] }
      }
    };
    if (branchScope !== 'ALL') {
      opexWhere.branchId = branchScope;
    }

    const opexTransactions = await prisma.financialTransaction.findMany({
      where: opexWhere,
      include: {
        category: { select: { id: true, code: true, name: true } },
        account: { select: { id: true, accountName: true, accountType: true } }
      }
    });

    let totalOpex = 0;
    const opexByCategory = {};
    const opexByBranch = { 1: 0, 2: 0 };

    opexTransactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      totalOpex += amt;

      const catName = t.category?.name || 'General Operating Expense';
      opexByCategory[catName] = (opexByCategory[catName] || 0) + amt;

      if (opexByBranch[t.branchId] !== undefined) {
        opexByBranch[t.branchId] += amt;
      }
    });

    // 4. NET PROFIT
    const netProfit = grossProfit - totalOpex;
    const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // 5. Branch-wise breakdown if ALL requested
    let branchBreakdown = null;
    if (branchScope === 'ALL') {
      const b1Rev = revenueByBranch[1] || 0;
      const b1Cogs = cogsByBranch[1] || 0;
      const b1Gross = b1Rev - b1Cogs;
      const b1Opex = opexByBranch[1] || 0;
      const b1Net = b1Gross - b1Opex;

      const b2Rev = revenueByBranch[2] || 0;
      const b2Cogs = cogsByBranch[2] || 0;
      const b2Gross = b2Rev - b2Cogs;
      const b2Opex = opexByBranch[2] || 0;
      const b2Net = b2Gross - b2Opex;

      branchBreakdown = {
        branch1: {
          id: 1,
          name: 'JB Group (Main)',
          revenue: Math.round(b1Rev * 100) / 100,
          cogs: Math.round(b1Cogs * 100) / 100,
          grossProfit: Math.round(b1Gross * 100) / 100,
          opex: Math.round(b1Opex * 100) / 100,
          netProfit: Math.round(b1Net * 100) / 100,
          netMargin: b1Rev > 0 ? Math.round((b1Net / b1Rev) * 1000) / 10 : 0
        },
        branch2: {
          id: 2,
          name: 'Bella Design',
          revenue: Math.round(b2Rev * 100) / 100,
          cogs: Math.round(b2Cogs * 100) / 100,
          grossProfit: Math.round(b2Gross * 100) / 100,
          opex: Math.round(b2Opex * 100) / 100,
          netProfit: Math.round(b2Net * 100) / 100,
          netMargin: b2Rev > 0 ? Math.round((b2Net / b2Rev) * 1000) / 10 : 0
        }
      };
    }

    res.status(200).json({
      success: true,
      branchScope,
      period,
      dateRange: {
        startColombo: startDateUtc.toISOString(),
        endColombo: endDateUtc.toISOString()
      },
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCogs: Math.round(totalCogs * 100) / 100,
        materialSpend: Math.round(materialSpend * 100) / 100,
        tailorWages: Math.round(tailorWages * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossProfitMargin: Math.round(grossProfitMargin * 10) / 10,
        totalOpex: Math.round(totalOpex * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        netProfitMargin: Math.round(netProfitMargin * 10) / 10
      },
      revenueByMethod,
      revenueBySource,
      opexByCategory,
      branchBreakdown
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error calculating P&L:', error);
    res.status(500).json({ success: false, message: 'Server error generating Profit & Loss report.' });
  }
};

/**
 * GET /api/finance/reports/customer-outstanding
 * Calculate real Accounts Receivable (Customer Outstanding) with aging analysis.
 * Unpaid orders are tracked as receivables, not revenue.
 */
exports.getCustomerOutstanding = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const { aging, search } = req.query;

    const orderWhere = {
      status: { notIn: ['CANCELLED', 'REJECTED'] }
    };

    if (branchScope !== 'ALL') {
      orderWhere.branchId = branchScope;
    }

    const orders = await prisma.order.findMany({
      where: orderWhere,
      include: {
        customer: { select: { id: true, name: true, primaryPhone: true, email: true } },
        branch: { select: { id: true, name: true } },
        payments: {
          where: { status: 'VERIFIED' },
          select: { id: true, amount: true, paymentMethod: true, createdAt: true }
        }
      },
      orderBy: { orderDate: 'desc' }
    });

    const now = new Date();
    const customerMap = {};
    const agingSummary = {
      current: { amount: 0, count: 0 },       // 0-30 days
      overdue_30: { amount: 0, count: 0 },    // 31-60 days
      overdue_60: { amount: 0, count: 0 },    // 61-90 days
      overdue_90_plus: { amount: 0, count: 0 } // 91+ days
    };

    let totalOutstanding = 0;

    orders.forEach(order => {
      const orderTotal = Number(order.agreedTotal || order.totalAmount || 0);

      // Sum verified payments
      let paidAmount = 0;
      if (order.payments && order.payments.length > 0) {
        paidAmount = order.payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      } else if (order.advancePayment && Number(order.advancePayment) > 0) {
        paidAmount = Number(order.advancePayment);
      }

      const balanceDue = Math.max(0, Math.round((orderTotal - paidAmount) * 100) / 100);

      // Skip orders that are fully paid
      if (balanceDue <= 0.01) return;

      const orderDate = new Date(order.orderDate || order.createdAt);
      const daysOutstanding = Math.max(0, Math.floor((now - orderDate) / (1000 * 60 * 60 * 24)));

      let bucket = 'current';
      if (daysOutstanding > 90) bucket = 'overdue_90_plus';
      else if (daysOutstanding > 60) bucket = 'overdue_60';
      else if (daysOutstanding > 30) bucket = 'overdue_30';

      // Apply aging filter if requested
      if (aging && aging !== 'all' && aging !== bucket) {
        return;
      }

      // Apply search filter if requested
      if (search) {
        const q = String(search).toLowerCase();
        const matchesName = order.customer?.name?.toLowerCase().includes(q);
        const matchesPhone = order.customer?.primaryPhone?.includes(q);
        const matchesOrder = order.orderNumber?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesOrder) {
          return;
        }
      }

      totalOutstanding += balanceDue;
      agingSummary[bucket].amount += balanceDue;
      agingSummary[bucket].count += 1;

      const cId = order.customerId;
      if (!customerMap[cId]) {
        customerMap[cId] = {
          customerId: cId,
          customerName: order.customer?.name || 'Walk-in Customer',
          phone: order.customer?.primaryPhone || 'N/A',
          email: order.customer?.email || null,
          branchName: order.branch?.name || 'JB Group',
          totalOutstanding: 0,
          orders: []
        };
      }

      customerMap[cId].totalOutstanding += balanceDue;
      customerMap[cId].orders.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        orderTotal,
        paidAmount,
        balanceDue,
        daysOutstanding,
        agingBucket: bucket,
        orderStatus: order.status
      });
    });

    const customers = Object.values(customerMap)
      .map(c => ({
        ...c,
        totalOutstanding: Math.round(c.totalOutstanding * 100) / 100
      }))
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    res.status(200).json({
      success: true,
      branchScope,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalCustomers: customers.length,
      agingSummary: {
        current: { amount: Math.round(agingSummary.current.amount * 100) / 100, count: agingSummary.current.count },
        overdue_30: { amount: Math.round(agingSummary.overdue_30.amount * 100) / 100, count: agingSummary.overdue_30.count },
        overdue_60: { amount: Math.round(agingSummary.overdue_60.amount * 100) / 100, count: agingSummary.overdue_60.count },
        overdue_90_plus: { amount: Math.round(agingSummary.overdue_90_plus.amount * 100) / 100, count: agingSummary.overdue_90_plus.count }
      },
      customers
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error fetching customer outstanding:', error);
    res.status(500).json({ success: false, message: 'Server error generating Customer Outstanding report.' });
  }
};

/**
 * GET /api/finance/dashboard/executive
 * CEO and Executive Financial Control Dashboard
 * Aggregates cash drawers, bank accounts, today/month revenue, today/month expenses,
 * net profit, pending payroll, and branch comparison.
 */
exports.getExecutiveDashboard = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const { startDateUtc: startToday, endDateUtc: endToday } = resolveColomboDateRange('today');
    const { startDateUtc: startMonth, endDateUtc: endMonth } = resolveColomboDateRange('this_month');

    // 1. Financial Accounts (Cash & Bank)
    const acctWhere = {};
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

    let totalCashBalance = 0;
    let totalBankBalance = 0;
    const accountsSummary = accounts.map(a => {
      const bal = Number(a.currentBalance) || 0;
      if (a.accountType === 'CASH') totalCashBalance += bal;
      if (a.accountType === 'BANK') totalBankBalance += bal;
      return {
        id: a.id,
        name: a.accountName,
        type: a.accountType,
        branchName: a.branch?.name || 'Group Central / HQ',
        balance: bal,
        isPrimary: a.isPrimary
      };
    });

    // 2. Today's Revenue & Month's Revenue (verified payments)
    const revWhereBase = { status: 'VERIFIED' };
    if (branchScope !== 'ALL') {
      revWhereBase.order = { branchId: branchScope };
    }

    const [todayPayments, monthPayments] = await Promise.all([
      prisma.payment.findMany({
        where: { ...revWhereBase, createdAt: { gte: startToday, lte: endToday } },
        select: { amount: true }
      }),
      prisma.payment.findMany({
        where: { ...revWhereBase, createdAt: { gte: startMonth, lte: endMonth } },
        select: { amount: true }
      })
    ]);

    const todayRevenue = todayPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const monthRevenue = monthPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    // 3. Today's OPEX & Month's OPEX
    const expWhereBase = {
      type: 'EXPENSE',
      approvalStatus: 'APPROVED',
      isReversed: false
    };
    if (branchScope !== 'ALL') {
      expWhereBase.branchId = branchScope;
    }

    const [todayExpenses, monthExpenses] = await Promise.all([
      prisma.financialTransaction.findMany({
        where: { ...expWhereBase, transactionDate: { gte: startToday, lte: endToday } },
        select: { amount: true }
      }),
      prisma.financialTransaction.findMany({
        where: { ...expWhereBase, transactionDate: { gte: startMonth, lte: endMonth } },
        select: { amount: true }
      })
    ]);

    const todayExpense = todayExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const monthExpense = monthExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const monthNetOperating = monthRevenue - monthExpense;

    // 4. Pending Payroll & Advances
    const [pendingPayrollCount, pendingAdvances] = await Promise.all([
      prisma.employeeSalary.count({
        where: {
          status: 'DRAFT',
          ...(branchScope !== 'ALL' ? { branchId: branchScope } : {})
        }
      }),
      prisma.salaryAdvance.findMany({
        where: {
          status: 'PENDING',
          ...(branchScope !== 'ALL' ? { branchId: branchScope } : {})
        },
        select: { amount: true }
      })
    ]);

    const pendingAdvancesTotal = pendingAdvances.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

    // 5. Recent Transactions
    const recentTxnWhere = {};
    if (branchScope !== 'ALL') {
      recentTxnWhere.branchId = branchScope;
    }

    const recentTransactions = await prisma.financialTransaction.findMany({
      where: recentTxnWhere,
      include: {
        category: { select: { name: true } },
        account: { select: { accountName: true } },
        branch: { select: { name: true } }
      },
      orderBy: { transactionDate: 'desc' },
      take: 10
    });

    res.status(200).json({
      success: true,
      branchScope,
      liquidity: {
        totalCash: Math.round(totalCashBalance * 100) / 100,
        totalBank: Math.round(totalBankBalance * 100) / 100,
        totalLiquid: Math.round((totalCashBalance + totalBankBalance) * 100) / 100,
        accounts: accountsSummary
      },
      operatingPerformance: {
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        todayExpense: Math.round(todayExpense * 100) / 100,
        monthRevenue: Math.round(monthRevenue * 100) / 100,
        monthExpense: Math.round(monthExpense * 100) / 100,
        monthNetOperating: Math.round(monthNetOperating * 100) / 100
      },
      pendingActions: {
        pendingPayrollCount,
        pendingAdvancesCount: pendingAdvances.length,
        pendingAdvancesTotal: Math.round(pendingAdvancesTotal * 100) / 100
      },
      recentTransactions: recentTransactions.map(t => ({
        id: t.id,
        transactionNumber: t.transactionNumber,
        date: t.transactionDate,
        branchName: t.branch?.name,
        type: t.type,
        category: t.category?.name,
        account: t.account?.accountName,
        amount: Number(t.amount),
        status: t.approvalStatus
      }))
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error generating executive dashboard:', error);
    res.status(500).json({ success: false, message: 'Server error generating Executive Dashboard.' });
  }
};

/**
 * GET /api/finance/audit-logs
 * Retrieve system financial audit logs with filtering and pagination
 */
exports.getFinancialAuditLogs = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const { entityType, action, page = 1, limit = 50 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(100, Math.max(10, parseInt(limit, 10)));
    const skip = (pageNum - 1) * pageSize;

    const where = {};
    if (branchScope !== 'ALL') {
      where.OR = [
        { branchId: branchScope },
        { branchId: null }
      ];
    }

    if (entityType) where.entityType = String(entityType).toUpperCase();
    if (action) where.action = String(action).toUpperCase();

    const [totalLogs, logs] = await Promise.all([
      prisma.financialAuditLog.count({ where }),
      prisma.financialAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          performedBy: { select: { id: true, name: true, email: true, role: true } }
        }
      })
    ]);

    res.status(200).json({
      success: true,
      branchScope,
      pagination: {
        page: pageNum,
        limit: pageSize,
        totalLogs,
        totalPages: Math.ceil(totalLogs / pageSize)
      },
      logs: logs.map(l => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        amount: l.amount ? Number(l.amount) : null,
        branchId: l.branchId,
        performedByName: l.performedByName,
        performedByRole: l.performedByRole,
        ipAddress: l.ipAddress,
        reason: l.reason,
        createdAt: l.createdAt,
        previousState: l.previousState,
        newState: l.newState
      }))
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Server error fetching Financial Audit Logs.' });
  }
};
