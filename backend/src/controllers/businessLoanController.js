/**
 * Business Loans & Financing Management Controller
 * JB GROUP (PVT) LTD — Version 5.0.0
 *
 * Tracks bank loans, business financing, repayments, principal balances, and interest expenses.
 * Strict Accounting Rules:
 * 1. Loan principal received is financing (liability), NOT sales revenue.
 * 2. Principal repayments reduce the loan liability, NOT operating expenses.
 * 3. Interest repayments are recorded separately as financial interest expenses.
 */

const { prisma } = require('../prisma');

/**
 * Resolve branch scope for business loans
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
        throw { status: 400, message: 'Invalid branch ID. JB GROUP operates Branch 1 and Branch 2.' };
      }
      return bId;
    }
    return 'ALL';
  }

  if (!assignedBranch || (assignedBranch !== 1 && assignedBranch !== 2)) {
    throw { status: 403, message: `Access denied: ${role} is not assigned to an active branch.` };
  }

  const qBranch = req.query?.branchId || req.body?.branchId;
  if (qBranch) {
    const cleanQ = String(qBranch).trim().toUpperCase();
    if (cleanQ === 'ALL' || parseInt(cleanQ, 10) !== assignedBranch) {
      throw {
        status: 403,
        message: `Access denied: ${role} is restricted to assigned Branch ${assignedBranch}.`
      };
    }
  }

  return assignedBranch;
};

/**
 * GET /api/finance/loans
 * List loans with branch RBAC, status filter, and totals
 */
exports.getBusinessLoans = async (req, res) => {
  try {
    const branchScope = resolveBranchScope(req);
    const { status, search } = req.query;

    const where = {};
    if (branchScope !== 'ALL') {
      where.OR = [
        { branchId: branchScope },
        { branchId: null }
      ];
    }

    if (status && status !== 'ALL') {
      where.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { loanNumber: { contains: q, mode: 'insensitive' } },
        { providerName: { contains: q, mode: 'insensitive' } }
      ];
    }

    const loans = await prisma.businessLoan.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        depositAccount: { select: { id: true, accountName: true, accountType: true } },
        repayments: {
          orderBy: { paymentDate: 'desc' },
          include: {
            paidFromAccount: { select: { id: true, accountName: true, accountType: true } }
          }
        }
      },
      orderBy: { disbursementDate: 'desc' }
    });

    let totalOriginalPrincipal = 0;
    let totalOutstandingPrincipal = 0;
    let totalPrincipalRepaid = 0;
    let totalInterestPaid = 0;
    let activeLoansCount = 0;
    let paidOffLoansCount = 0;

    loans.forEach(l => {
      const orig = Number(l.originalPrincipal) || 0;
      const out = Number(l.outstandingPrincipal) || 0;

      totalOriginalPrincipal += orig;
      totalOutstandingPrincipal += out;

      if (l.status === 'ACTIVE') activeLoansCount++;
      else if (l.status === 'PAID_OFF') paidOffLoansCount++;

      if (l.repayments) {
        l.repayments.forEach(r => {
          totalPrincipalRepaid += Number(r.principalAmount) || 0;
          totalInterestPaid += Number(r.interestAmount) || 0;
        });
      }
    });

    res.json({
      success: true,
      branchScope,
      summary: {
        totalLoansCount: loans.length,
        activeLoansCount,
        paidOffLoansCount,
        totalOriginalPrincipal,
        totalOutstandingPrincipal,
        totalPrincipalRepaid,
        totalInterestPaid
      },
      data: loans
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error fetching business loans:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve business loans.' });
  }
};

/**
 * POST /api/finance/loans
 * Create a new business or bank loan
 */
exports.createBusinessLoan = async (req, res) => {
  try {
    const branchScope = resolveBranchScope(req);
    const {
      providerName,
      loanType = 'BANK_LOAN',
      originalPrincipal,
      interestRate = 0,
      monthlyInstalment = 0,
      disbursementDate,
      nextPaymentDate,
      maturityDate,
      depositAccountId,
      branchId,
      notes
    } = req.body;

    if (!providerName || !providerName.trim()) {
      return res.status(400).json({ success: false, message: 'Loan provider name is required.' });
    }

    const principal = parseFloat(originalPrincipal);
    if (isNaN(principal) || principal <= 0) {
      return res.status(400).json({ success: false, message: 'Original loan principal must be greater than zero.' });
    }

    const count = await prisma.businessLoan.count();
    const loanNumber = `LOAN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    let targetBranchId = null;
    if (branchScope !== 'ALL') {
      targetBranchId = branchScope;
    } else if (branchId && !isNaN(parseInt(branchId, 10))) {
      targetBranchId = parseInt(branchId, 10);
    }

    let depAcctId = null;
    if (depositAccountId && !isNaN(parseInt(depositAccountId, 10))) {
      depAcctId = parseInt(depositAccountId, 10);
    }

    const loan = await prisma.businessLoan.create({
      data: {
        loanNumber,
        loanType,
        providerName: providerName.trim(),
        branchId: targetBranchId,
        originalPrincipal: principal,
        outstandingPrincipal: principal,
        interestRate: parseFloat(interestRate) || 0,
        monthlyInstalment: parseFloat(monthlyInstalment) || 0,
        disbursementDate: disbursementDate ? new Date(disbursementDate) : new Date(),
        nextPaymentDate: nextPaymentDate ? new Date(nextPaymentDate) : null,
        maturityDate: maturityDate ? new Date(maturityDate) : null,
        depositAccountId: depAcctId,
        status: 'ACTIVE',
        notes: notes?.trim() || null,
        createdById: req.user.id,
        createdByName: req.user.name || 'User'
      }
    });

    // Credit destination account if chosen
    if (depAcctId) {
      await prisma.financialAccount.update({
        where: { id: depAcctId },
        data: { currentBalance: { increment: principal } }
      });
    }

    res.status(201).json({ success: true, data: loan });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error creating business loan:', error);
    res.status(500).json({ success: false, message: 'Failed to record business loan.' });
  }
};

/**
 * POST /api/finance/loans/:id/repay
 * Record loan repayment (principal reduction + interest expense)
 */
exports.recordLoanRepayment = async (req, res) => {
  try {
    const branchScope = resolveBranchScope(req);
    const loanId = parseInt(req.params.id, 10);
    if (isNaN(loanId)) return res.status(400).json({ success: false, message: 'Invalid loan ID.' });

    const loan = await prisma.businessLoan.findUnique({
      where: { id: loanId }
    });

    if (!loan) {
      return res.status(404).json({ success: false, message: 'Business loan not found.' });
    }

    if (branchScope !== 'ALL' && loan.branchId && loan.branchId !== branchScope) {
      return res.status(403).json({ success: false, message: 'Access denied: Loan belongs to another branch.' });
    }

    const {
      principalAmount = 0,
      interestAmount = 0,
      paymentMethod = 'BANK_TRANSFER',
      paidFromAccountId,
      paymentDate,
      nextPaymentDate,
      referenceNo,
      receiptImage,
      notes
    } = req.body;

    const pAmt = Math.max(0, parseFloat(principalAmount) || 0);
    const iAmt = Math.max(0, parseFloat(interestAmount) || 0);
    const totalPaid = pAmt + iAmt;

    if (totalPaid <= 0) {
      return res.status(400).json({ success: false, message: 'Repayment amount must be greater than zero.' });
    }

    const curOutstanding = Number(loan.outstandingPrincipal) || 0;
    if (pAmt > curOutstanding + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Principal payment (LKR ${pAmt.toFixed(2)}) cannot exceed outstanding principal (LKR ${curOutstanding.toFixed(2)}).`
      });
    }

    const newOutstanding = Math.max(0, curOutstanding - pAmt);
    const newStatus = newOutstanding <= 0.01 ? 'PAID_OFF' : 'ACTIVE';

    // Generate Repayment Number
    const count = await prisma.loanRepaymentHistory.count({ where: { loanId } });
    const repaymentNumber = `REP-${loan.loanNumber}-${String(count + 1).padStart(2, '0')}`;

    let acctId = null;
    if (paidFromAccountId && !isNaN(parseInt(paidFromAccountId, 10))) {
      acctId = parseInt(paidFromAccountId, 10);
      // Deduct total payment from account
      await prisma.financialAccount.update({
        where: { id: acctId },
        data: { currentBalance: { decrement: totalPaid } }
      });
    }

    const repayment = await prisma.loanRepaymentHistory.create({
      data: {
        loanId: loan.id,
        repaymentNumber,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        principalAmount: pAmt,
        interestAmount: iAmt,
        totalPaid,
        paymentMethod,
        paidFromAccountId: acctId,
        referenceNo: referenceNo?.trim() || null,
        receiptImage: receiptImage || null,
        notes: notes?.trim() || null,
        createdById: req.user.id,
        createdByName: req.user.name || 'User'
      }
    });

    const updatedLoan = await prisma.businessLoan.update({
      where: { id: loan.id },
      data: {
        outstandingPrincipal: newOutstanding,
        status: newStatus,
        nextPaymentDate: nextPaymentDate ? new Date(nextPaymentDate) : loan.nextPaymentDate
      },
      include: {
        repayments: { orderBy: { paymentDate: 'desc' } }
      }
    });

    res.json({
      success: true,
      message: `Loan repayment of LKR ${totalPaid.toFixed(2)} (Principal: LKR ${pAmt.toFixed(2)}, Interest: LKR ${iAmt.toFixed(2)}) recorded successfully.`,
      data: updatedLoan,
      repayment
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error recording loan repayment:', error);
    res.status(500).json({ success: false, message: 'Failed to record loan repayment.' });
  }
};

