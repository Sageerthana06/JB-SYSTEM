/**
 * Financial Transactions & General Ledger Controller
 * JB GROUP (PVT) LTD — Version 3.2.0
 * Enforces Decimal precision, atomic sequence generation, and strict two-branch isolation.
 */

const { prisma } = require('../prisma');
const { generateTransactionNumberTx } = require('../utils/financialSequenceGenerator');
const { logFinancialAudit } = require('../utils/financialAuditLogger');

// Helper: resolve branch ID strictly
const resolveBranchId = (req, targetBranchId) => {
  const user = req.user;
  const role = String(user?.role || '').toUpperCase();
  const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);

  if (isExecutive) {
    const bId = parseInt(targetBranchId, 10);
    if (bId !== 1 && bId !== 2) {
      throw { status: 400, message: 'Invalid branch ID. Must be 1 (JB Group Main) or 2 (Bella Design).' };
    }
    return bId;
  }

  // Manager: Strictly locked to their branch
  const managerBranch = Number(user?.branchId);
  if (!managerBranch || (managerBranch !== 1 && managerBranch !== 2)) {
    throw { status: 403, message: 'Access denied: Manager is not assigned to an active branch.' };
  }

  if (targetBranchId && parseInt(targetBranchId, 10) !== managerBranch) {
    throw { status: 403, message: `Access denied: Managers cannot record transactions for another branch.` };
  }

  return managerBranch;
};

/**
 * POST /api/finance/transactions
 * Record a manual financial transaction (Operating Expense or Other Income)
 */
exports.recordTransaction = async (req, res, next) => {
  try {
    const {
      branchId,
      type,
      categoryId,
      accountId,
      amount,
      paymentMethod,
      referenceNo,
      description,
      notes,
      receiptImage,
      sourceModule,
      sourceRecordId
    } = req.body;

    const validatedBranchId = resolveBranchId(req, branchId);

    const txnType = String(type || '').toUpperCase();
    if (!['INCOME', 'EXPENSE'].includes(txnType)) {
      return res.status(400).json({ success: false, message: 'Transaction type must be INCOME or EXPENSE.' });
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Transaction amount must be greater than zero.' });
    }

    const targetCategoryId = parseInt(categoryId, 10);
    const targetAccountId = parseInt(accountId, 10);

    if (isNaN(targetCategoryId) || isNaN(targetAccountId)) {
      return res.status(400).json({ success: false, message: 'Valid categoryId and accountId are required.' });
    }

    // Verify account and category
    const [account, category] = await Promise.all([
      prisma.financialAccount.findUnique({ where: { id: targetAccountId } }),
      prisma.accountingCategory.findUnique({ where: { id: targetCategoryId } })
    ]);

    if (!account) {
      return res.status(404).json({ success: false, message: 'Source financial account not found.' });
    }
    if (account.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: `Account is ${account.status}. Cannot process transactions.` });
    }
    if (account.branchId && account.branchId !== validatedBranchId) {
      return res.status(400).json({ success: false, message: 'Account does not belong to the selected branch.' });
    }

    if (!category || !category.isActive) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive category selected.' });
    }

    const role = String(req.user?.role || '').toUpperCase();
    const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);

    // Large expenses (> 50,000 LKR) created by non-executives require CEO/Admin approval
    const requiresApproval = txnType === 'EXPENSE' && numAmount > 50000 && !isExecutive;
    const initialStatus = requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED';

    const prefix = txnType === 'EXPENSE' ? 'EXP' : 'INC';

    // Atomic database transaction
    const createdTxn = await prisma.$transaction(async (tx) => {
      const transactionNumber = await generateTransactionNumberTx(tx, prefix);

      // Only adjust account balance immediately if approved
      if (initialStatus === 'APPROVED') {
        const balanceChange = txnType === 'INCOME' ? numAmount : -numAmount;
        await tx.financialAccount.update({
          where: { id: targetAccountId },
          data: {
            currentBalance: {
              increment: balanceChange
            }
          }
        });
      }

      const txn = await tx.financialTransaction.create({
        data: {
          transactionNumber,
          transactionDate: new Date(),
          branchId: validatedBranchId,
          type: txnType,
          categoryId: targetCategoryId,
          accountId: targetAccountId,
          amount: numAmount,
          paymentMethod: paymentMethod ? String(paymentMethod).toUpperCase() : 'CASH',
          referenceNo: referenceNo ? String(referenceNo).trim() : null,
          description: description ? String(description).trim() : null,
          notes: notes ? String(notes).trim() : null,
          receiptImage: receiptImage || null,
          approvalStatus: initialStatus,
          approvedById: isExecutive ? req.user.id : null,
          approvedByName: isExecutive ? req.user.name : null,
          approvedAt: isExecutive ? new Date() : null,
          createdById: req.user.id,
          createdByName: req.user.name || req.user.email,
          sourceModule: sourceModule || 'MANUAL',
          sourceRecordId: sourceRecordId ? Number(sourceRecordId) : null
        },
        include: {
          category: { select: { id: true, code: true, name: true } },
          account: { select: { id: true, accountName: true, accountType: true } },
          branch: { select: { id: true, name: true } }
        }
      });

      return txn;
    }, { timeout: 15000 });

    await logFinancialAudit({
      action: initialStatus === 'APPROVED' ? 'TRANSACTION_RECORDED' : 'TRANSACTION_PENDING_APPROVAL',
      entityType: 'TRANSACTION',
      entityId: createdTxn.id,
      amount: numAmount,
      branchId: validatedBranchId,
      req,
      newState: createdTxn
    });

    res.status(201).json({
      success: true,
      message: `${txnType === 'EXPENSE' ? 'Expense' : 'Income'} of LKR ${numAmount.toLocaleString()} recorded successfully.${requiresApproval ? ' Awaiting executive approval.' : ''}`,
      transaction: {
        ...createdTxn,
        amount: Number(createdTxn.amount)
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    // Check for PostgreSQL unique constraint violation on (sourceModule, sourceRecordId)
    if (error.code === 'P2002' || error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate transaction prevented. This source record has already been posted to the financial ledger.'
      });
    }
    console.error('Error recording transaction:', error);
    res.status(500).json({ success: false, message: 'Server error recording transaction.' });
  }
};

/**
 * GET /api/finance/transactions
 * General Ledger listing with date range, branch, and category filters
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const role = String(req.user?.role || '').toUpperCase();
    const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);
    const { branchId, type, categoryId, accountId, startDate, endDate, page = 1, limit = 50 } = req.query;

    const where = {};

    if (isExecutive) {
      if (branchId && String(branchId).trim().toUpperCase() !== 'ALL') {
        where.branchId = parseInt(branchId, 10);
      }
    } else {
      where.branchId = req.user.branchId || 1;
    }

    if (type && type !== 'ALL') {
      where.type = String(type).toUpperCase();
    }

    if (categoryId && categoryId !== 'ALL') {
      where.categoryId = parseInt(categoryId, 10);
    }

    if (accountId && accountId !== 'ALL') {
      where.accountId = parseInt(accountId, 10);
    }

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) {
        where.transactionDate.gte = new Date(`${startDate}T00:00:00+05:30`);
      }
      if (endDate) {
        where.transactionDate.lte = new Date(`${endDate}T23:59:59.999+05:30`);
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * take;

    const [totalCount, txns] = await Promise.all([
      prisma.financialTransaction.count({ where }),
      prisma.financialTransaction.findMany({
        where,
        include: {
          category: { select: { id: true, code: true, name: true, categoryType: true } },
          account: { select: { id: true, accountName: true, accountType: true } },
          toAccount: { select: { id: true, accountName: true, accountType: true } },
          branch: { select: { id: true, name: true } }
        },
        orderBy: { transactionDate: 'desc' },
        skip,
        take
      })
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        page: pageNum,
        limit: take,
        total: totalCount,
        totalPages: Math.ceil(totalCount / take)
      },
      transactions: txns.map(t => ({
        ...t,
        amount: Number(t.amount)
      }))
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving transactions.' });
  }
};

/**
 * POST /api/finance/transactions/transfer
 * Inter-account or Inter-branch transfer (e.g. Cash Drawer to Bank, or Main Branch to Bella Design)
 * Strictly excluded from Profit & Loss revenue/expenses!
 */
exports.transferFunds = async (req, res, next) => {
  try {
    const { fromAccountId, toAccountId, amount, paymentMethod, referenceNo, notes } = req.body;

    const sourceAccountId = parseInt(fromAccountId, 10);
    const destAccountId = parseInt(toAccountId, 10);
    const numAmount = Number(amount);

    if (isNaN(sourceAccountId) || isNaN(destAccountId)) {
      return res.status(400).json({ success: false, message: 'Valid fromAccountId and toAccountId are required.' });
    }

    if (sourceAccountId === destAccountId) {
      return res.status(400).json({ success: false, message: 'Source and destination accounts must be different.' });
    }

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Transfer amount must be greater than zero.' });
    }

    const [fromAccount, toAccount] = await Promise.all([
      prisma.financialAccount.findUnique({ where: { id: sourceAccountId } }),
      prisma.financialAccount.findUnique({ where: { id: destAccountId } })
    ]);

    if (!fromAccount || !toAccount) {
      return res.status(404).json({ success: false, message: 'Source or destination account not found.' });
    }

    const role = String(req.user?.role || '').toUpperCase();
    if (role === 'MANAGER' && fromAccount.branchId && fromAccount.branchId !== req.user.branchId) {
      return res.status(403).json({ success: false, message: 'Access denied: Managers cannot transfer funds out of other branches.' });
    }

    // Check transfer category
    let transferCat = await prisma.accountingCategory.findFirst({
      where: { code: 'TRF_INTERNAL' }
    });
    if (!transferCat) {
      transferCat = await prisma.accountingCategory.findFirst({
        where: { categoryType: 'TRANSFER' }
      });
    }

    const transferBranchId = fromAccount.branchId || toAccount.branchId || 1;

    // Atomic transfer execution
    const transferResult = await prisma.$transaction(async (tx) => {
      const outTxnNumber = await generateTransactionNumberTx(tx, 'TRF');

      // 1. Deduct from source account
      await tx.financialAccount.update({
        where: { id: sourceAccountId },
        data: { currentBalance: { decrement: numAmount } }
      });

      // 2. Credit destination account
      await tx.financialAccount.update({
        where: { id: destAccountId },
        data: { currentBalance: { increment: numAmount } }
      });

      // 3. Create TRANSFER_OUT transaction
      const outTxn = await tx.financialTransaction.create({
        data: {
          transactionNumber: outTxnNumber,
          transactionDate: new Date(),
          branchId: transferBranchId,
          type: 'TRANSFER_OUT',
          categoryId: transferCat.id,
          accountId: sourceAccountId,
          toAccountId: destAccountId,
          amount: numAmount,
          paymentMethod: paymentMethod ? String(paymentMethod).toUpperCase() : 'BANK_TRANSFER',
          referenceNo: referenceNo ? String(referenceNo).trim() : null,
          description: `Transfer to ${toAccount.accountName}`,
          notes: notes ? String(notes).trim() : null,
          approvalStatus: 'APPROVED',
          createdById: req.user.id,
          createdByName: req.user.name || req.user.email,
          sourceModule: 'INTERNAL_TRANSFER'
        }
      });

      return { outTxn };
    }, { timeout: 15000 });

    await logFinancialAudit({
      action: 'FUNDS_TRANSFERRED',
      entityType: 'TRANSACTION',
      entityId: transferResult.outTxn.id,
      amount: numAmount,
      branchId: transferBranchId,
      req,
      newState: { fromAccount: fromAccount.accountName, toAccount: toAccount.accountName, amount: numAmount }
    });

    res.status(200).json({
      success: true,
      message: `Successfully transferred LKR ${numAmount.toLocaleString()} from ${fromAccount.accountName} to ${toAccount.accountName}.`,
      transferNumber: transferResult.outTxn.transactionNumber
    });
  } catch (error) {
    console.error('Error transferring funds:', error);
    res.status(500).json({ success: false, message: 'Server error processing funds transfer.' });
  }
};

/**
 * POST /api/finance/transactions/:id/reverse
 * Controlled reversal of a transaction (NEVER permanently deletes!)
 */
exports.reverseTransaction = async (req, res, next) => {
  try {
    const txnId = parseInt(req.params.id, 10);
    const { reason } = req.body;

    if (isNaN(txnId)) {
      return res.status(400).json({ success: false, message: 'Invalid transaction ID.' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Reversal reason is required.' });
    }

    const existingTxn = await prisma.financialTransaction.findUnique({
      where: { id: txnId },
      include: { account: true }
    });

    if (!existingTxn) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    if (existingTxn.isReversed) {
      return res.status(400).json({ success: false, message: 'Transaction is already reversed.' });
    }

    const role = String(req.user?.role || '').toUpperCase();
    if (role === 'MANAGER' && existingTxn.branchId !== req.user.branchId) {
      return res.status(403).json({ success: false, message: 'Access denied: Cannot reverse transaction from another branch.' });
    }

    const numAmount = Number(existingTxn.amount);

    // Atomic reversal
    const reversalResult = await prisma.$transaction(async (tx) => {
      const revTxnNumber = await generateTransactionNumberTx(tx, 'REV');

      // Reverse account balance effect
      if (existingTxn.approvalStatus === 'APPROVED') {
        const rollbackDelta = existingTxn.type === 'INCOME' ? -numAmount : (existingTxn.type === 'EXPENSE' ? numAmount : 0);
        if (rollbackDelta !== 0) {
          await tx.financialAccount.update({
            where: { id: existingTxn.accountId },
            data: { currentBalance: { increment: rollbackDelta } }
          });
        }
      }

      // Mark original transaction as reversed
      await tx.financialTransaction.update({
        where: { id: txnId },
        data: {
          isReversed: true,
          approvalStatus: 'REVERSED',
          reversalReason: reason.trim()
        }
      });

      // Insert offsetting reversal entry
      const revTxn = await tx.financialTransaction.create({
        data: {
          transactionNumber: revTxnNumber,
          transactionDate: new Date(),
          branchId: existingTxn.branchId,
          type: existingTxn.type === 'INCOME' ? 'EXPENSE' : 'INCOME',
          categoryId: existingTxn.categoryId,
          accountId: existingTxn.accountId,
          amount: numAmount,
          paymentMethod: existingTxn.paymentMethod,
          referenceNo: `REV-${existingTxn.transactionNumber}`,
          description: `Reversal of ${existingTxn.transactionNumber}: ${reason.trim()}`,
          notes: reason.trim(),
          approvalStatus: 'REVERSED',
          createdById: req.user.id,
          createdByName: req.user.name || req.user.email,
          reversalOfId: existingTxn.id,
          sourceModule: 'REVERSAL'
        }
      });

      return revTxn;
    }, { timeout: 15000 });

    await logFinancialAudit({
      action: 'TRANSACTION_REVERSED',
      entityType: 'TRANSACTION',
      entityId: txnId,
      amount: numAmount,
      branchId: existingTxn.branchId,
      req,
      reason: reason.trim(),
      previousState: existingTxn,
      newState: reversalResult
    });

    res.status(200).json({
      success: true,
      message: `Transaction ${existingTxn.transactionNumber} reversed successfully.`,
      reversalNumber: reversalResult.transactionNumber
    });
  } catch (error) {
    console.error('Error reversing transaction:', error);
    res.status(500).json({ success: false, message: 'Server error reversing transaction.' });
  }
};
