/**
 * Monthly Recurring Bills Controller
 * JB GROUP (PVT) LTD — Version 3.2.0
 * Manages fixed recurring commitments (Rent, Electricity, Water, Internet, etc.)
 * Strictly enforces that creating a bill DOES NOT reduce accounts until confirmed payment.
 */

const { prisma } = require('../prisma');
const { generateBillNumberTx, generateTransactionNumberTx } = require('../utils/financialSequenceGenerator');
const { logFinancialAudit } = require('../utils/financialAuditLogger');

/**
 * Resolve branch scope for bills strictly by RBAC.
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

  if (!managerBranch || (managerBranch !== 1 && managerBranch !== 2)) {
    throw { status: 403, message: 'Access denied: Manager is not assigned to an active branch.' };
  }

  const qBranch = req.query?.branchId || req.body?.branchId;
  if (qBranch) {
    const cleanQ = String(qBranch).trim().toUpperCase();
    if (cleanQ === 'ALL' || parseInt(cleanQ, 10) !== managerBranch) {
      throw {
        status: 403,
        message: `Access denied: Managers are restricted to their assigned branch (${managerBranch}).`
      };
    }
  }

  return managerBranch;
};

// Map bill category string to AccountingCategory code
const CATEGORY_MAP = {
  RENT: 'EXP_RENT',
  ELECTRICITY: 'EXP_ELECTRICITY',
  WATER: 'EXP_WATER',
  INTERNET: 'EXP_INTERNET',
  TELEPHONE: 'EXP_TELEPHONE',
  SECURITY: 'EXP_SECURITY',
  CLEANING: 'EXP_CLEANING',
  MAINTENANCE: 'EXP_MAINTENANCE',
  OTHER: 'EXP_MISC'
};

/**
 * GET /api/finance/bills
 * Retrieve monthly bills with filters and pagination
 */
exports.getMonthlyBills = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const { billingMonth, category, status, search, page = 1, limit = 50 } = req.query;

    const where = {};
    if (branchScope !== 'ALL') {
      where.branchId = branchScope;
    }
    if (billingMonth) {
      where.billingMonth = String(billingMonth).trim();
    }
    if (category && category !== 'ALL') {
      where.category = String(category).toUpperCase();
    }
    if (status && status !== 'ALL') {
      where.status = String(status).toUpperCase();
    }
    if (search) {
      const q = String(search).trim();
      where.OR = [
        { billName: { contains: q, mode: 'insensitive' } },
        { providerName: { contains: q, mode: 'insensitive' } },
        { billNumber: { contains: q, mode: 'insensitive' } },
        { billReference: { contains: q, mode: 'insensitive' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(100, Math.max(10, parseInt(limit, 10)));
    const skip = (pageNum - 1) * pageSize;

    const [totalBills, bills] = await Promise.all([
      prisma.monthlyBill.count({ where }),
      prisma.monthlyBill.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          paymentAccount: { select: { id: true, accountName: true, accountType: true } }
        },
        orderBy: [{ billingMonth: 'desc' }, { dueDate: 'asc' }],
        skip,
        take: pageSize
      })
    ]);

    // Recalculate dynamic OVERDUE status for unpaid bills past due
    const now = new Date();
    const formattedBills = bills.map(b => {
      let currentStatus = b.status;
      const expected = Number(b.expectedAmount) || 0;
      const actual = b.actualAmount !== null ? Number(b.actualAmount) : expected;
      const paid = Number(b.paidAmount) || 0;
      const balanceDue = Math.max(0, actual - paid);

      if (paid >= actual && actual > 0) {
        currentStatus = 'PAID';
      } else if (paid > 0 && paid < actual) {
        currentStatus = 'PARTIALLY_PAID';
      } else if (new Date(b.dueDate) < now) {
        currentStatus = 'OVERDUE';
      } else if (new Date(b.billDate) > now) {
        currentStatus = 'UPCOMING';
      } else {
        currentStatus = 'UNPAID';
      }

      return {
        id: b.id,
        billNumber: b.billNumber,
        billName: b.billName,
        category: b.category,
        branchId: b.branchId,
        branchName: b.branch?.name || `Branch ${b.branchId}`,
        providerName: b.providerName,
        expectedAmount: expected,
        actualAmount: actual,
        paidAmount: paid,
        balanceDue: Math.round(balanceDue * 100) / 100,
        billReference: b.billReference,
        billingMonth: b.billingMonth,
        billDate: b.billDate,
        dueDate: b.dueDate,
        status: currentStatus,
        paymentMethod: b.paymentMethod,
        paymentAccountId: b.paymentAccountId,
        paymentAccountName: b.paymentAccount?.accountName || null,
        paymentDate: b.paymentDate,
        receiptImage: b.receiptImage,
        notes: b.notes,
        createdByName: b.createdByName,
        createdAt: b.createdAt
      };
    });

    res.status(200).json({
      success: true,
      branchScope,
      pagination: {
        page: pageNum,
        limit: pageSize,
        totalBills,
        totalPages: Math.ceil(totalBills / pageSize)
      },
      bills: formattedBills
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error fetching monthly bills:', error);
    res.status(500).json({ success: false, message: 'Server error fetching monthly bills.' });
  }
};

/**
 * POST /api/finance/bills
 * Add a new monthly bill record (DOES NOT affect cash/bank balance)
 */
exports.createMonthlyBill = async (req, res, next) => {
  try {
    const {
      branchId,
      billName,
      category,
      providerName,
      expectedAmount,
      actualAmount,
      billingMonth,
      billDate,
      dueDate,
      billReference,
      receiptImage,
      notes
    } = req.body;

    const role = String(req.user?.role || '').toUpperCase();
    const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);
    let targetBranchId;

    if (isExecutive) {
      targetBranchId = parseInt(branchId, 10);
      if (targetBranchId !== 1 && targetBranchId !== 2) {
        return res.status(400).json({ success: false, message: 'Branch ID must be 1 (JB Group Main) or 2 (Bella Design).' });
      }
    } else {
      targetBranchId = Number(req.user?.branchId);
      if (!targetBranchId || (targetBranchId !== 1 && targetBranchId !== 2)) {
        return res.status(403).json({ success: false, message: 'Access denied: Manager is not assigned to an active branch.' });
      }
    }

    if (!billName || !String(billName).trim()) {
      return res.status(400).json({ success: false, message: 'Bill name is required.' });
    }

    const cleanCategory = String(category || '').trim().toUpperCase();
    const validCategories = Object.keys(CATEGORY_MAP);
    if (!validCategories.includes(cleanCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    const expAmt = Number(expectedAmount);
    if (isNaN(expAmt) || expAmt <= 0) {
      return res.status(400).json({ success: false, message: 'Expected amount must be a positive number.' });
    }

    const actAmt = actualAmount !== undefined && actualAmount !== null && actualAmount !== ''
      ? Number(actualAmount)
      : null;

    if (actAmt !== null && (isNaN(actAmt) || actAmt < 0)) {
      return res.status(400).json({ success: false, message: 'Actual amount cannot be negative.' });
    }

    // Validate billing month format (YYYY-MM)
    const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!billingMonth || !monthRegex.test(String(billingMonth).trim())) {
      return res.status(400).json({ success: false, message: 'Billing month is required in YYYY-MM format (e.g. 2026-11).' });
    }
    const cleanMonth = String(billingMonth).trim();

    if (!dueDate) {
      return res.status(400).json({ success: false, message: 'Due date is required.' });
    }

    const parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid due date format.' });
    }

    const parsedBillDate = billDate ? new Date(billDate) : new Date();

    // Check unique constraint: one bill per branch, category, and month
    const existing = await prisma.monthlyBill.findUnique({
      where: {
        MonthlyBill_branch_cat_month_key: {
          branchId: targetBranchId,
          category: cleanCategory,
          billingMonth: cleanMonth
        }
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A bill for ${cleanCategory} in branch ${targetBranchId} for month ${cleanMonth} already exists (${existing.billNumber}). Please edit or pay the existing bill.`
      });
    }

    // Determine initial status
    const now = new Date();
    let initialStatus = 'UNPAID';
    if (parsedDueDate < now) {
      initialStatus = 'OVERDUE';
    } else if (parsedBillDate > now) {
      initialStatus = 'UPCOMING';
    }

    // Atomic creation with bill number sequence
    const createdBill = await prisma.$transaction(async (tx) => {
      const billNumber = await generateBillNumberTx(tx, 'BILL');

      const bill = await tx.monthlyBill.create({
        data: {
          billNumber,
          billName: String(billName).trim(),
          category: cleanCategory,
          branchId: targetBranchId,
          providerName: providerName ? String(providerName).trim() : null,
          expectedAmount: expAmt,
          actualAmount: actAmt,
          paidAmount: 0,
          billReference: billReference ? String(billReference).trim() : null,
          billingMonth: cleanMonth,
          billDate: parsedBillDate,
          dueDate: parsedDueDate,
          status: initialStatus,
          receiptImage: receiptImage || null,
          notes: notes ? String(notes).trim() : null,
          createdById: req.user.id,
          createdByName: req.user.name || req.user.email
        },
        include: {
          branch: { select: { id: true, name: true } }
        }
      });

      return bill;
    }, { timeout: 15000 });

    await logFinancialAudit({
      action: 'BILL_CREATED',
      entityType: 'MONTHLY_BILL',
      entityId: createdBill.id,
      amount: expAmt,
      branchId: targetBranchId,
      performedById: req.user.id,
      performedByName: req.user.name || req.user.email,
      performedByRole: role,
      newState: {
        billNumber: createdBill.billNumber,
        category: cleanCategory,
        billingMonth: cleanMonth,
        expectedAmount: expAmt
      },
      ipAddress: req.ip,
      reason: `Created monthly bill ${createdBill.billNumber} for ${cleanCategory} (${cleanMonth})`
    });

    res.status(201).json({
      success: true,
      message: `Monthly bill ${createdBill.billNumber} created successfully.`,
      bill: createdBill
    });
  } catch (error) {
    console.error('Error creating monthly bill:', error);
    res.status(500).json({ success: false, message: 'Server error creating monthly bill.' });
  }
};

/**
 * POST /api/finance/bills/:id/pay
 * Disburse payment for an existing monthly bill.
 * Decrements the selected FinancialAccount and records an approved FinancialTransaction.
 */
exports.payMonthlyBill = async (req, res, next) => {
  try {
    const billId = parseInt(req.params.id, 10);
    if (isNaN(billId)) {
      return res.status(400).json({ success: false, message: 'Invalid bill ID.' });
    }

    const {
      amount,
      paymentAccountId,
      paymentMethod = 'CASH',
      paymentDate,
      receiptImage,
      notes
    } = req.body;

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    }

    const targetAccountId = parseInt(paymentAccountId, 10);
    if (isNaN(targetAccountId)) {
      return res.status(400).json({ success: false, message: 'A valid payment account (Cash Drawer or Bank Account) is required.' });
    }

    const bill = await prisma.monthlyBill.findUnique({
      where: { id: billId },
      include: { branch: true }
    });

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Monthly bill not found.' });
    }

    // Role and branch authorization
    const role = String(req.user?.role || '').toUpperCase();
    const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);
    if (!isExecutive) {
      const managerBranch = Number(req.user?.branchId);
      if (bill.branchId !== managerBranch) {
        return res.status(403).json({
          success: false,
          message: `Access denied: You are not authorized to pay bills for branch ${bill.branchId}.`
        });
      }
    }

    // Verify account
    const account = await prisma.financialAccount.findUnique({
      where: { id: targetAccountId }
    });

    if (!account) {
      return res.status(404).json({ success: false, message: 'Payment account not found.' });
    }
    if (account.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: `Payment account is ${account.status}. Cannot process payments.` });
    }
    if (account.branchId && account.branchId !== bill.branchId) {
      return res.status(400).json({ success: false, message: `Account belongs to branch ${account.branchId}, but bill is for branch ${bill.branchId}.` });
    }

    // Calculate remaining balance
    const currentActual = bill.actualAmount !== null ? Number(bill.actualAmount) : Number(bill.expectedAmount);
    const currentPaid = Number(bill.paidAmount) || 0;
    const remainingBalance = Math.max(0, currentActual - currentPaid);

    if (remainingBalance <= 0) {
      return res.status(400).json({ success: false, message: 'This bill is already fully settled.' });
    }

    if (payAmount > remainingBalance + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (LKR ${payAmount}) exceeds the remaining balance due (LKR ${remainingBalance.toFixed(2)}).`
      });
    }

    // Resolve AccountingCategory
    const categoryCode = CATEGORY_MAP[bill.category] || 'EXP_GENERAL';
    const accountingCat = await prisma.accountingCategory.findFirst({
      where: { code: categoryCode, isActive: true }
    });

    if (!accountingCat) {
      return res.status(500).json({
        success: false,
        message: `Accounting category ${categoryCode} is missing or inactive. Please contact system administrator.`
      });
    }

    const newPaidAmount = currentPaid + payAmount;
    const isFullyPaid = newPaidAmount >= currentActual - 0.01;
    const newStatus = isFullyPaid ? 'PAID' : 'PARTIALLY_PAID';
    const parsedPaymentDate = paymentDate ? new Date(paymentDate) : new Date();

    // Execute atomic transaction: Update account balance, update bill, create financial transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Decrement account current balance
      await tx.financialAccount.update({
        where: { id: targetAccountId },
        data: {
          currentBalance: {
            decrement: payAmount
          }
        }
      });

      // 2. Generate transaction number for general ledger
      const transactionNumber = await generateTransactionNumberTx(tx, 'EXP');

      // 3. Create approved FinancialTransaction record
      const txn = await tx.financialTransaction.create({
        data: {
          transactionNumber,
          transactionDate: parsedPaymentDate,
          branchId: bill.branchId,
          type: 'EXPENSE',
          categoryId: accountingCat.id,
          accountId: targetAccountId,
          amount: payAmount,
          paymentMethod: String(paymentMethod).toUpperCase(),
          referenceNo: bill.billReference || bill.billNumber,
          description: `Monthly Bill Settlement: ${bill.billName} (${bill.billingMonth})`,
          notes: notes ? String(notes).trim() : null,
          receiptImage: receiptImage || bill.receiptImage,
          approvalStatus: 'APPROVED',
          approvedById: req.user.id,
          approvedByName: req.user.name || req.user.email,
          approvedAt: new Date(),
          createdById: req.user.id,
          createdByName: req.user.name || req.user.email,
          sourceModule: 'MONTHLY_BILL',
          sourceRecordId: bill.id
        }
      });

      // 4. Update MonthlyBill record
      const updatedBill = await tx.monthlyBill.update({
        where: { id: bill.id },
        data: {
          paidAmount: newPaidAmount,
          actualAmount: currentActual,
          status: newStatus,
          paymentAccountId: targetAccountId,
          paymentMethod: String(paymentMethod).toUpperCase(),
          paymentDate: parsedPaymentDate,
          receiptImage: receiptImage || bill.receiptImage,
          notes: notes ? `${bill.notes ? bill.notes + ' | ' : ''}${notes}` : bill.notes
        },
        include: {
          branch: { select: { id: true, name: true } },
          paymentAccount: { select: { id: true, accountName: true, accountType: true } }
        }
      });

      return { txn, updatedBill };
    }, { timeout: 15000 });

    await logFinancialAudit({
      action: 'BILL_PAID',
      entityType: 'MONTHLY_BILL',
      entityId: bill.id,
      amount: payAmount,
      branchId: bill.branchId,
      performedById: req.user.id,
      performedByName: req.user.name || req.user.email,
      performedByRole: role,
      previousState: { status: bill.status, paidAmount: currentPaid },
      newState: { status: newStatus, paidAmount: newPaidAmount, transactionNumber: result.txn.transactionNumber },
      ipAddress: req.ip,
      reason: `Settled LKR ${payAmount} for ${bill.billNumber} from account ${account.accountName}`
    });

    res.status(200).json({
      success: true,
      message: `Successfully recorded payment of LKR ${payAmount.toLocaleString()} for ${bill.billName}.`,
      bill: result.updatedBill,
      transaction: result.txn
    });
  } catch (error) {
    console.error('Error paying monthly bill:', error);
    res.status(500).json({ success: false, message: 'Server error processing monthly bill payment.' });
  }
};

/**
 * DELETE /api/finance/bills/:id
 * Cancel or delete an UNPAID bill (cannot delete if payments were recorded)
 */
exports.deleteMonthlyBill = async (req, res, next) => {
  try {
    const billId = parseInt(req.params.id, 10);
    if (isNaN(billId)) {
      return res.status(400).json({ success: false, message: 'Invalid bill ID.' });
    }

    const bill = await prisma.monthlyBill.findUnique({
      where: { id: billId }
    });

    if (!bill) {
      return res.status(404).json({ success: false, message: 'Monthly bill not found.' });
    }

    if (Number(bill.paidAmount) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a bill that has payments recorded. Reverse the payment transactions first.'
      });
    }

    const role = String(req.user?.role || '').toUpperCase();
    const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);
    if (!isExecutive) {
      const managerBranch = Number(req.user?.branchId);
      if (bill.branchId !== managerBranch) {
        return res.status(403).json({ success: false, message: 'Access denied: Cannot delete bill from another branch.' });
      }
    }

    await prisma.monthlyBill.delete({ where: { id: billId } });

    await logFinancialAudit({
      action: 'BILL_DELETED',
      entityType: 'MONTHLY_BILL',
      entityId: billId,
      amount: Number(bill.expectedAmount),
      branchId: bill.branchId,
      performedById: req.user.id,
      performedByName: req.user.name || req.user.email,
      performedByRole: role,
      previousState: bill,
      ipAddress: req.ip,
      reason: `Cancelled unpaid bill ${bill.billNumber}`
    });

    res.status(200).json({
      success: true,
      message: `Monthly bill ${bill.billNumber} was removed.`
    });
  } catch (error) {
    console.error('Error deleting monthly bill:', error);
    res.status(500).json({ success: false, message: 'Server error deleting monthly bill.' });
  }
};

