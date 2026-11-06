/**
 * Supplier Payables & Debt Management Controller
 * JB GROUP (PVT) LTD — Version 5.0.0
 *
 * Tracks supplier invoices, purchase debts, payment history, and branch liabilities.
 * Strict Accounting Rule: Unpaid supplier invoices are NOT counted as cash expenses
 * until actual payment occurs.
 */

const { prisma } = require('../prisma');

/**
 * Resolve branch scope for supplier payables
 * CEO/SUPER_ADMIN: 'ALL', 1, or 2
 * MANAGER/ADMIN: strictly locked to assigned branch
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
 * GET /api/finance/suppliers
 * List active suppliers
 */
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: suppliers });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve suppliers.' });
  }
};

/**
 * POST /api/finance/suppliers
 * Create a new supplier
 */
exports.createSupplier = async (req, res) => {
  try {
    const { name, contactPerson, phone, email, address, category, paymentTerms, taxId, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required.' });
    }

    const count = await prisma.supplier.count();
    const code = `SUP-${String(count + 1).padStart(4, '0')}`;

    const supplier = await prisma.supplier.create({
      data: {
        code,
        name: name.trim(),
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        category: category?.trim() || 'GENERAL',
        paymentTerms: paymentTerms?.trim() || 'NET_30',
        taxId: taxId?.trim() || null,
        notes: notes?.trim() || null
      }
    });

    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ success: false, message: 'Failed to create supplier.' });
  }
};

/**
 * GET /api/finance/suppliers/payables
 * List supplier payables with status filter and totals
 */
exports.getSupplierPayables = async (req, res) => {
  try {
    const branchScope = resolveBranchScope(req);
    const { status, search, supplierId } = req.query;

    const where = {};
    if (branchScope !== 'ALL') {
      where.branchId = branchScope;
    }

    if (status && status !== 'ALL') {
      where.paymentStatus = status.toUpperCase();
    } else {
      where.paymentStatus = { not: 'CANCELLED' };
    }

    if (supplierId && !isNaN(parseInt(supplierId, 10))) {
      where.supplierId = parseInt(supplierId, 10);
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { purchaseDescription: { contains: q, mode: 'insensitive' } },
        { supplier: { name: { contains: q, mode: 'insensitive' } } }
      ];
    }

    const payables = await prisma.supplierPayable.findMany({
      where,
      include: {
        supplier: { select: { id: true, code: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
        payments: { orderBy: { paymentDate: 'desc' } }
      },
      orderBy: { invoiceDate: 'desc' }
    });

    // Summary calculations
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    const now = new Date();

    payables.forEach(p => {
      const tot = Number(p.totalAmount) || 0;
      const pd = Number(p.paidAmount) || 0;
      const out = Number(p.outstandingAmount) || 0;

      totalInvoiced += tot;
      totalPaid += pd;
      totalOutstanding += out;

      if (out > 0.01 && p.dueDate && new Date(p.dueDate) < now) {
        overdueCount++;
        overdueAmount += out;
      }
    });

    res.json({
      success: true,
      branchScope,
      summary: {
        totalPayablesCount: payables.length,
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        overdueCount,
        overdueAmount
      },
      data: payables
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error fetching supplier payables:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve supplier payables.' });
  }
};

/**
 * POST /api/finance/suppliers/payables
 * Record a new supplier invoice / payable
 */
exports.createSupplierPayable = async (req, res) => {
  try {
    const branchScope = resolveBranchScope(req);
    const {
      supplierId,
      invoiceNumber,
      purchaseDescription,
      branchId,
      totalAmount,
      paidAmount = 0,
      dueDate,
      notes,
      paymentMethod = 'CASH',
      accountId
    } = req.body;

    if (!supplierId || isNaN(parseInt(supplierId, 10))) {
      return res.status(400).json({ success: false, message: 'Valid supplier is required.' });
    }
    if (!purchaseDescription || !purchaseDescription.trim()) {
      return res.status(400).json({ success: false, message: 'Purchase description is required.' });
    }

    const totalAmt = parseFloat(totalAmount);
    if (isNaN(totalAmt) || totalAmt <= 0) {
      return res.status(400).json({ success: false, message: 'Total invoice amount must be greater than zero.' });
    }

    const paidAmt = Math.max(0, parseFloat(paidAmount) || 0);
    const outAmt = Math.max(0, totalAmt - paidAmt);

    // Determine target branch
    let targetBranchId = branchScope === 'ALL' ? (branchId ? parseInt(branchId, 10) : 1) : branchScope;

    // Generate Invoice Number if omitted
    let invNo = invoiceNumber?.trim();
    if (!invNo) {
      const count = await prisma.supplierPayable.count();
      invNo = `INV-SUP-${String(count + 1).padStart(5, '0')}`;
    }

    // Check unique invoiceNumber
    const existing = await prisma.supplierPayable.findUnique({ where: { invoiceNumber: invNo } });
    if (existing) {
      return res.status(400).json({ success: false, message: `Invoice number "${invNo}" already exists.` });
    }

    let status = 'UNPAID';
    if (outAmt <= 0.01) status = 'PAID';
    else if (paidAmt > 0) status = 'PARTIALLY_PAID';

    const payable = await prisma.supplierPayable.create({
      data: {
        invoiceNumber: invNo,
        supplierId: parseInt(supplierId, 10),
        purchaseDescription: purchaseDescription.trim(),
        branchId: targetBranchId,
        totalAmount: totalAmt,
        paidAmount: paidAmt,
        outstandingAmount: outAmt,
        dueDate: dueDate ? new Date(dueDate) : null,
        paymentStatus: status,
        notes: notes?.trim() || null,
        createdById: req.user.id,
        createdByName: req.user.name || 'System User'
      }
    });

    // If initial payment was made at recording time
    if (paidAmt > 0) {
      const payNumber = `PAY-SUP-${payable.id}-01`;
      await prisma.supplierPaymentHistory.create({
        data: {
          payableId: payable.id,
          paymentNumber: payNumber,
          amount: paidAmt,
          paymentMethod,
          accountId: accountId ? parseInt(accountId, 10) : null,
          paidBy: req.user.name || 'User',
          notes: 'Initial advance or settlement payment upon invoice entry',
          createdById: req.user.id
        }
      });

      // Update FinancialAccount balance if account specified
      if (accountId) {
        await prisma.financialAccount.update({
          where: { id: parseInt(accountId, 10) },
          data: { currentBalance: { decrement: paidAmt } }
        });
      }
    }

    res.status(201).json({ success: true, data: payable });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error creating supplier payable:', error);
    res.status(500).json({ success: false, message: 'Failed to record supplier payable.' });
  }
};

/**
 * POST /api/finance/suppliers/payables/:id/pay
 * Record payment towards a supplier payable
 */
exports.recordSupplierPayment = async (req, res) => {
  try {
    const branchScope = resolveBranchScope(req);
    const payableId = parseInt(req.params.id, 10);
    if (isNaN(payableId)) return res.status(400).json({ success: false, message: 'Invalid payable ID.' });

    const payable = await prisma.supplierPayable.findUnique({
      where: { id: payableId },
      include: { supplier: true }
    });

    if (!payable) {
      return res.status(404).json({ success: false, message: 'Supplier payable not found.' });
    }

    if (branchScope !== 'ALL' && payable.branchId !== branchScope) {
      return res.status(403).json({ success: false, message: 'Access denied: Payable belongs to another branch.' });
    }

    const { amount, paymentMethod = 'CASH', accountId, referenceNo, notes, receiptImage } = req.body;
    const payAmt = parseFloat(amount);
    if (isNaN(payAmt) || payAmt <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    }

    const curPaid = Number(payable.paidAmount) || 0;
    const curTotal = Number(payable.totalAmount) || 0;
    const curOutstanding = Number(payable.outstandingAmount) || (curTotal - curPaid);

    if (payAmt > curOutstanding + 0.01) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (LKR ${payAmt.toFixed(2)}) cannot exceed outstanding balance (LKR ${curOutstanding.toFixed(2)}).`
      });
    }

    const newPaid = curPaid + payAmt;
    const newOutstanding = Math.max(0, curTotal - newPaid);
    const newStatus = newOutstanding <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';

    // Generate Payment Number
    const count = await prisma.supplierPaymentHistory.count({ where: { payableId } });
    const paymentNumber = `PAY-SUP-${payable.id}-${String(count + 1).padStart(2, '0')}`;

    // Update account if specified
    let targetAccountId = null;
    if (accountId && !isNaN(parseInt(accountId, 10))) {
      targetAccountId = parseInt(accountId, 10);
      await prisma.financialAccount.update({
        where: { id: targetAccountId },
        data: { currentBalance: { decrement: payAmt } }
      });
    }

    // Create payment history record
    const payment = await prisma.supplierPaymentHistory.create({
      data: {
        payableId: payable.id,
        paymentNumber,
        amount: payAmt,
        paymentMethod,
        accountId: targetAccountId,
        paidBy: req.user.name || 'User',
        referenceNo: referenceNo?.trim() || null,
        receiptImage: receiptImage || null,
        notes: notes?.trim() || null,
        createdById: req.user.id
      }
    });

    // Update payable
    const updatedPayable = await prisma.supplierPayable.update({
      where: { id: payable.id },
      data: {
        paidAmount: newPaid,
        outstandingAmount: newOutstanding,
        paymentStatus: newStatus
      },
      include: {
        supplier: true,
        payments: { orderBy: { paymentDate: 'desc' } }
      }
    });

    res.json({
      success: true,
      message: `Payment of LKR ${payAmt.toFixed(2)} recorded successfully.`,
      data: updatedPayable,
      payment
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error recording supplier payment:', error);
    res.status(500).json({ success: false, message: 'Failed to record supplier payment.' });
  }
};

