/**
 * Financial Account & Chart of Accounts Controller
 * JB GROUP (PVT) LTD — Version 3.2.0
 * Scoped strictly to Branch 1 (JB Group Main) and Branch 2 (Bella Design).
 */

const { prisma } = require('../prisma');
const { logFinancialAudit } = require('../utils/financialAuditLogger');

// Helper: validate branch access and return authorized branchId or 'ALL'
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

  // Manager: Strictly restricted to their assigned branch
  if (!managerBranch || (managerBranch !== 1 && managerBranch !== 2)) {
    throw { status: 403, message: 'Access denied: Manager is not assigned to an authorized branch.' };
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
 * GET /api/finance/accounts
 * List all cash and bank accounts within user's branch authority
 */
exports.getAccounts = async (req, res, next) => {
  try {
    const branchScope = resolveBranchScope(req);
    const where = {};

    if (branchScope !== 'ALL') {
      // Show accounts belonging to manager's branch OR central group accounts (branchId is null)
      where.OR = [
        { branchId: branchScope },
        { branchId: null }
      ];
    }

    const accounts = await prisma.financialAccount.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { transactions: true } }
      },
      orderBy: [
        { isPrimary: 'desc' },
        { accountType: 'asc' },
        { id: 'asc' }
      ]
    });

    res.status(200).json({
      success: true,
      branchScope,
      accounts: accounts.map(a => ({
        id: a.id,
        branchId: a.branchId,
        branchName: a.branch?.name || 'Group Central / HQ',
        accountType: a.accountType,
        accountName: a.accountName,
        accountNumber: a.accountNumber,
        bankName: a.bankName,
        bankBranch: a.bankBranch,
        currency: a.currency,
        openingBalance: Number(a.openingBalance),
        currentBalance: Number(a.currentBalance),
        status: a.status,
        isPrimary: a.isPrimary,
        transactionCount: a._count?.transactions || 0,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      }))
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error fetching financial accounts:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving financial accounts.' });
  }
};

/**
 * POST /api/finance/accounts
 * Create a new Cash Drawer or Bank Account for Branch 1 or Branch 2
 */
exports.createAccount = async (req, res, next) => {
  try {
    const { branchId, accountType, accountName, accountNumber, bankName, bankBranch, isPrimary, openingBalance } = req.body;

    if (!accountType || !['CASH', 'BANK', 'PETTY_CASH'].includes(accountType.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid accountType. Must be CASH, BANK, or PETTY_CASH.' });
    }

    if (!accountName || !accountName.trim()) {
      return res.status(400).json({ success: false, message: 'Account name is required.' });
    }

    let targetBranchId = null;
    const role = String(req.user?.role || '').toUpperCase();

    if (branchId !== undefined && branchId !== null && branchId !== '') {
      targetBranchId = parseInt(branchId, 10);
      if (targetBranchId !== 1 && targetBranchId !== 2) {
        return res.status(400).json({ success: false, message: 'Branch ID must be 1 (JB Group Main) or 2 (Bella Design).' });
      }

      if (role === 'MANAGER' && req.user.branchId !== targetBranchId) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Managers cannot create accounts for other branches.`
        });
      }
    } else if (role === 'MANAGER') {
      targetBranchId = req.user.branchId;
    }

    const initialOpening = Number(openingBalance) || 0.00;

    const newAccount = await prisma.financialAccount.create({
      data: {
        branchId: targetBranchId,
        accountType: accountType.toUpperCase(),
        accountName: accountName.trim(),
        accountNumber: accountNumber ? String(accountNumber).trim() : null,
        bankName: bankName ? String(bankName).trim() : null,
        bankBranch: bankBranch ? String(bankBranch).trim() : null,
        currency: 'LKR',
        openingBalance: initialOpening,
        currentBalance: initialOpening,
        status: 'ACTIVE',
        isPrimary: Boolean(isPrimary)
      },
      include: {
        branch: { select: { id: true, name: true } }
      }
    });

    await logFinancialAudit({
      action: 'ACCOUNT_CREATED',
      entityType: 'ACCOUNT',
      entityId: newAccount.id,
      branchId: targetBranchId,
      req,
      newState: newAccount
    });

    res.status(201).json({
      success: true,
      message: `${accountType} account "${accountName}" created successfully.`,
      account: {
        ...newAccount,
        openingBalance: Number(newAccount.openingBalance),
        currentBalance: Number(newAccount.currentBalance)
      }
    });
  } catch (error) {
    console.error('Error creating financial account:', error);
    res.status(500).json({ success: false, message: 'Server error creating financial account.' });
  }
};

/**
 * GET /api/finance/accounts/:id
 * Get account details and recent transactions
 */
exports.getAccountById = async (req, res, next) => {
  try {
    const accountId = parseInt(req.params.id, 10);
    if (isNaN(accountId)) {
      return res.status(400).json({ success: false, message: 'Invalid account ID.' });
    }

    const account = await prisma.financialAccount.findUnique({
      where: { id: accountId },
      include: {
        branch: { select: { id: true, name: true } }
      }
    });

    if (!account) {
      return res.status(404).json({ success: false, message: 'Financial account not found.' });
    }

    const role = String(req.user?.role || '').toUpperCase();
    if (role === 'MANAGER' && account.branchId && account.branchId !== req.user.branchId) {
      return res.status(403).json({ success: false, message: 'Access denied: You are not authorized to view this account.' });
    }

    const recentTransactions = await prisma.financialTransaction.findMany({
      where: { accountId },
      include: {
        category: { select: { id: true, code: true, name: true } }
      },
      orderBy: { transactionDate: 'desc' },
      take: 20
    });

    res.status(200).json({
      success: true,
      account: {
        ...account,
        openingBalance: Number(account.openingBalance),
        currentBalance: Number(account.currentBalance)
      },
      recentTransactions: recentTransactions.map(t => ({
        ...t,
        amount: Number(t.amount)
      }))
    });
  } catch (error) {
    console.error('Error fetching account by ID:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving account.' });
  }
};

/**
 * GET /api/finance/categories
 * List Chart of Accounts / Categories
 */
exports.getCategories = async (req, res, next) => {
  try {
    const { type } = req.query;
    const where = { isActive: true };
    if (type) {
      where.categoryType = String(type).toUpperCase();
    }

    const categories = await prisma.accountingCategory.findMany({
      where,
      orderBy: [
        { categoryType: 'asc' },
        { code: 'asc' }
      ]
    });

    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving categories.' });
  }
};

/**
 * POST /api/finance/categories
 * Create custom category
 */
exports.createCategory = async (req, res, next) => {
  try {
    const { categoryType, code, name, description, parentCategoryId } = req.body;

    if (!categoryType || !['INCOME', 'EXPENSE', 'TRANSFER', 'ASSET', 'LIABILITY'].includes(categoryType.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid categoryType.' });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Category code is required.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    const existing = await prisma.accountingCategory.findUnique({
      where: { code: cleanCode }
    });
    if (existing) {
      return res.status(400).json({ success: false, message: `Category code ${cleanCode} already exists.` });
    }

    const newCat = await prisma.accountingCategory.create({
      data: {
        categoryType: categoryType.toUpperCase(),
        code: cleanCode,
        name: name.trim(),
        description: description ? description.trim() : null,
        parentCategoryId: parentCategoryId ? parseInt(parentCategoryId, 10) : null,
        isSystem: false,
        isActive: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      category: newCat
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ success: false, message: 'Server error creating category.' });
  }
};
