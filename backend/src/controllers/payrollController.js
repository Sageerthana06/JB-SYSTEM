/**
 * Employee Payroll & Salary Advance Controller
 * JB GROUP (PVT) LTD — Version 3.2.0
 * Handles monthly staff payroll, salary advance requests, deductions, and disbursements.
 */

const { prisma } = require('../prisma');
const { generatePayrollNumberTx, generateAdvanceNumberTx, generateTransactionNumberTx } = require('../utils/financialSequenceGenerator');
const { logFinancialAudit } = require('../utils/financialAuditLogger');

// Helper: validate branch ID strictly for Branch 1 or 2
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

  const managerBranch = Number(user?.branchId);
  if (!managerBranch || (managerBranch !== 1 && managerBranch !== 2)) {
    throw { status: 403, message: 'Access denied: Manager is not assigned to an active branch.' };
  }

  if (targetBranchId && parseInt(targetBranchId, 10) !== managerBranch) {
    throw { status: 403, message: 'Access denied: Managers cannot manage payroll for another branch.' };
  }

  return managerBranch;
};

/**
 * GET /api/finance/payroll
 * List monthly staff payroll records
 */
exports.getStaffPayroll = async (req, res, next) => {
  try {
    const { branchId, month, status } = req.query;
    const role = String(req.user?.role || '').toUpperCase();
    const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);

    const where = {};

    if (isExecutive) {
      if (branchId && String(branchId).trim().toUpperCase() !== 'ALL') {
        where.branchId = parseInt(branchId, 10);
      }
    } else {
      where.branchId = req.user.branchId || 1;
    }

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      where.month = month;
    }

    if (status && status !== 'ALL') {
      where.status = String(status).toUpperCase();
    }

    const payrollRecords = await prisma.employeeSalary.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeId: true, name: true, role: true, phone: true } },
        branch: { select: { id: true, name: true } },
        paidFromAccount: { select: { id: true, accountName: true, accountType: true } }
      },
      orderBy: [
        { month: 'desc' },
        { id: 'asc' }
      ]
    });

    res.status(200).json({
      success: true,
      payroll: payrollRecords.map(p => ({
        ...p,
        basicSalary: Number(p.basicSalary),
        allowances: Number(p.allowances),
        overtimeAmount: Number(p.overtimeAmount),
        grossSalary: Number(p.grossSalary),
        advanceDeductions: Number(p.advanceDeductions),
        epfDeduction: Number(p.epfDeduction),
        otherDeductions: Number(p.otherDeductions),
        netSalary: Number(p.netSalary)
      }))
    });
  } catch (error) {
    console.error('Error fetching payroll:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving payroll records.' });
  }
};

/**
 * POST /api/finance/payroll/generate
 * Generate draft monthly payroll for employees in a branch
 */
exports.generateStaffPayroll = async (req, res, next) => {
  try {
    const { branchId, month, employeeSalaries } = req.body;

    const validatedBranchId = resolveBranchId(req, branchId);

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Month format must be YYYY-MM.' });
    }

    if (!Array.isArray(employeeSalaries) || employeeSalaries.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of employeeSalaries is required.' });
    }

    const generated = await prisma.$transaction(async (tx) => {
      const records = [];

      for (const item of employeeSalaries) {
        const empId = parseInt(item.employeeId, 10);
        if (isNaN(empId)) continue;

        const employee = await tx.employee.findUnique({
          where: { id: empId }
        });

        if (!employee) continue;

        // Check for existing payroll in this month
        const existing = await tx.employeeSalary.findUnique({
          where: {
            employeeId_month: {
              employeeId: empId,
              month
            }
          }
        });

        if (existing) continue; // Skip already generated

        const basic = Number(item.basicSalary) || 0;
        const allowances = Number(item.allowances) || 0;
        const overtime = Number(item.overtimeAmount) || 0;
        const gross = basic + allowances + overtime;

        // Auto-check pending advances for this employee
        const pendingAdvances = await tx.salaryAdvance.findMany({
          where: {
            employeeId: empId,
            status: 'DISBURSED'
          }
        });

        const totalAdvanceDue = pendingAdvances.reduce((sum, a) => sum + Number(a.amount), 0);
        const advanceDeduction = item.advanceDeductions !== undefined ? Number(item.advanceDeductions) : Math.min(gross, totalAdvanceDue);
        const epf = Number(item.epfDeduction) || 0;
        const other = Number(item.otherDeductions) || 0;
        const net = Math.max(0, gross - advanceDeduction - epf - other);

        const payrollNumber = await generatePayrollNumberTx(tx, month);

        const created = await tx.employeeSalary.create({
          data: {
            payrollNumber,
            employeeId: empId,
            userId: employee.userId,
            branchId: validatedBranchId,
            month,
            basicSalary: basic,
            allowances,
            overtimeAmount: overtime,
            grossSalary: gross,
            advanceDeductions: advanceDeduction,
            epfDeduction: epf,
            otherDeductions: other,
            netSalary: net,
            status: 'DRAFT',
            notes: item.notes || null
          }
        });

        records.push(created);
      }

      return records;
    }, { timeout: 20000 });

    res.status(201).json({
      success: true,
      message: `Generated ${generated.length} monthly payroll draft record(s) for ${month}.`,
      generatedCount: generated.length
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error generating payroll:', error);
    res.status(500).json({ success: false, message: 'Server error generating monthly payroll.' });
  }
};

/**
 * POST /api/finance/payroll/:id/pay
 * Disburse monthly salary from cash drawer or bank account
 */
exports.disburseStaffSalary = async (req, res, next) => {
  try {
    const salaryId = parseInt(req.params.id, 10);
    const { paidFromAccountId, paymentMethod, referenceNo, notes } = req.body;

    if (isNaN(salaryId)) {
      return res.status(400).json({ success: false, message: 'Invalid salary record ID.' });
    }

    const targetAccountId = parseInt(paidFromAccountId, 10);
    if (isNaN(targetAccountId)) {
      return res.status(400).json({ success: false, message: 'paidFromAccountId is required.' });
    }

    const [salaryRecord, account] = await Promise.all([
      prisma.employeeSalary.findUnique({
        where: { id: salaryId },
        include: { employee: true }
      }),
      prisma.financialAccount.findUnique({
        where: { id: targetAccountId }
      })
    ]);

    if (!salaryRecord) {
      return res.status(404).json({ success: false, message: 'Payroll record not found.' });
    }

    if (salaryRecord.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'This payroll record is already paid.' });
    }

    if (!account || account.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Invalid or inactive payment account.' });
    }

    const role = String(req.user?.role || '').toUpperCase();
    if (role === 'MANAGER' && salaryRecord.branchId !== req.user.branchId) {
      return res.status(403).json({ success: false, message: 'Access denied: Cannot disburse salary for another branch.' });
    }

    let salaryCat = await prisma.accountingCategory.findFirst({
      where: { code: 'EXP_STAFF_SALARY' }
    });
    if (!salaryCat) {
      salaryCat = await prisma.accountingCategory.findFirst({
        where: { categoryType: 'EXPENSE' }
      });
    }

    const netAmount = Number(salaryRecord.netSalary);

    // Atomic disbursement and ledger posting
    const disburseResult = await prisma.$transaction(async (tx) => {
      const txnNumber = await generateTransactionNumberTx(tx, 'PAY');

      // 1. Deduct from account balance
      await tx.financialAccount.update({
        where: { id: targetAccountId },
        data: { currentBalance: { decrement: netAmount } }
      });

      // 2. Post to FinancialTransaction ledger with unique sourceModule + sourceRecordId
      const txn = await tx.financialTransaction.create({
        data: {
          transactionNumber: txnNumber,
          transactionDate: new Date(),
          branchId: salaryRecord.branchId,
          type: 'EXPENSE',
          categoryId: salaryCat.id,
          accountId: targetAccountId,
          amount: netAmount,
          paymentMethod: paymentMethod ? String(paymentMethod).toUpperCase() : 'CASH',
          referenceNo: referenceNo ? String(referenceNo).trim() : salaryRecord.payrollNumber,
          description: `Staff Salary for ${salaryRecord.employee.name} (${salaryRecord.month})`,
          notes: notes ? String(notes).trim() : null,
          approvalStatus: 'APPROVED',
          approvedById: req.user.id,
          approvedByName: req.user.name || req.user.email,
          approvedAt: new Date(),
          createdById: req.user.id,
          createdByName: req.user.name || req.user.email,
          sourceModule: 'STAFF_PAYROLL',
          sourceRecordId: salaryRecord.id
        }
      });

      // 3. Mark linked advances as DEDUCTED
      if (Number(salaryRecord.advanceDeductions) > 0) {
        await tx.salaryAdvance.updateMany({
          where: {
            employeeId: salaryRecord.employeeId,
            status: 'DISBURSED'
          },
          data: {
            status: 'DEDUCTED',
            deductedInSalaryId: salaryRecord.id
          }
        });
      }

      // 4. Update EmployeeSalary record to PAID
      const updatedSalary = await tx.employeeSalary.update({
        where: { id: salaryId },
        data: {
          status: 'PAID',
          paymentDate: new Date(),
          paidFromAccountId: targetAccountId,
          paymentMethod: paymentMethod ? String(paymentMethod).toUpperCase() : 'CASH',
          paidById: req.user.id
        }
      });

      return { txn, updatedSalary };
    }, { timeout: 15000 });

    await logFinancialAudit({
      action: 'SALARY_DISBURSED',
      entityType: 'PAYROLL',
      entityId: salaryId,
      amount: netAmount,
      branchId: salaryRecord.branchId,
      req,
      newState: disburseResult.updatedSalary
    });

    res.status(200).json({
      success: true,
      message: `Salary of LKR ${netAmount.toLocaleString()} disbursed to ${salaryRecord.employee.name}.`,
      transactionNumber: disburseResult.txn.transactionNumber
    });
  } catch (error) {
    if (error.code === 'P2002' || error.code === '23505') {
      return res.status(409).json({ success: false, message: 'This payroll record has already been disbursed in the financial ledger.' });
    }
    console.error('Error disbursing salary:', error);
    res.status(500).json({ success: false, message: 'Server error disbursing staff salary.' });
  }
};

/**
 * GET /api/finance/advances
 * List salary advances
 */
exports.getSalaryAdvances = async (req, res, next) => {
  try {
    const { branchId, status } = req.query;
    const role = String(req.user?.role || '').toUpperCase();
    const isExecutive = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(role);

    const where = {};

    if (isExecutive) {
      if (branchId && String(branchId).trim().toUpperCase() !== 'ALL') {
        where.branchId = parseInt(branchId, 10);
      }
    } else {
      where.branchId = req.user.branchId || 1;
    }

    if (status && status !== 'ALL') {
      where.status = String(status).toUpperCase();
    }

    const advances = await prisma.salaryAdvance.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeId: true, name: true, role: true, phone: true } },
        branch: { select: { id: true, name: true } },
        disbursedFromAccount: { select: { id: true, accountName: true, accountType: true } }
      },
      orderBy: { advanceDate: 'desc' }
    });

    res.status(200).json({
      success: true,
      advances: advances.map(a => ({
        ...a,
        amount: Number(a.amount)
      }))
    });
  } catch (error) {
    console.error('Error fetching advances:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving salary advances.' });
  }
};

/**
 * POST /api/finance/advances
 * Request a salary advance for an employee
 */
exports.requestSalaryAdvance = async (req, res, next) => {
  try {
    const { employeeId, branchId, amount, reason } = req.body;

    const validatedBranchId = resolveBranchId(req, branchId);
    const empId = parseInt(employeeId, 10);
    const numAmount = Number(amount);

    if (isNaN(empId) || !numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid employeeId and positive amount are required.' });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: empId }
    });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const newAdvance = await prisma.$transaction(async (tx) => {
      const advanceNumber = await generateAdvanceNumberTx(tx);

      return await tx.salaryAdvance.create({
        data: {
          advanceNumber,
          employeeId: empId,
          userId: employee.userId,
          branchId: validatedBranchId,
          amount: numAmount,
          advanceDate: new Date(),
          reason: reason ? String(reason).trim() : null,
          status: 'PENDING'
        },
        include: {
          employee: { select: { id: true, name: true } }
        }
      });
    });

    await logFinancialAudit({
      action: 'SALARY_ADVANCE_REQUESTED',
      entityType: 'ADVANCE',
      entityId: newAdvance.id,
      amount: numAmount,
      branchId: validatedBranchId,
      req,
      newState: newAdvance
    });

    res.status(201).json({
      success: true,
      message: `Salary advance of LKR ${numAmount.toLocaleString()} requested for ${employee.name}.`,
      advance: {
        ...newAdvance,
        amount: Number(newAdvance.amount)
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Error requesting advance:', error);
    res.status(500).json({ success: false, message: 'Server error requesting salary advance.' });
  }
};

/**
 * POST /api/finance/advances/:id/approve
 * Approve a pending salary advance
 */
exports.approveSalaryAdvance = async (req, res, next) => {
  try {
    const advanceId = parseInt(req.params.id, 10);
    if (isNaN(advanceId)) {
      return res.status(400).json({ success: false, message: 'Invalid advance ID.' });
    }

    const advance = await prisma.salaryAdvance.findUnique({
      where: { id: advanceId },
      include: { employee: true }
    });

    if (!advance) {
      return res.status(404).json({ success: false, message: 'Salary advance record not found.' });
    }

    if (advance.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Advance cannot be approved from status '${advance.status}'.` });
    }

    const updated = await prisma.salaryAdvance.update({
      where: { id: advanceId },
      data: {
        status: 'APPROVED',
        approvedById: req.user.id
      }
    });

    await logFinancialAudit({
      action: 'SALARY_ADVANCE_APPROVED',
      entityType: 'ADVANCE',
      entityId: advanceId,
      amount: Number(advance.amount),
      branchId: advance.branchId,
      req,
      previousState: { status: advance.status },
      newState: { status: 'APPROVED' }
    });

    res.status(200).json({
      success: true,
      message: `Salary advance of LKR ${Number(advance.amount).toLocaleString()} for ${advance.employee.name} approved.`,
      advance: {
        ...updated,
        amount: Number(updated.amount)
      }
    });
  } catch (error) {
    console.error('Error approving advance:', error);
    res.status(500).json({ success: false, message: 'Server error approving salary advance.' });
  }
};

/**
 * POST /api/finance/advances/:id/reject
 * Reject a pending salary advance
 */
exports.rejectSalaryAdvance = async (req, res, next) => {
  try {
    const advanceId = parseInt(req.params.id, 10);
    const { reason } = req.body;

    if (isNaN(advanceId)) {
      return res.status(400).json({ success: false, message: 'Invalid advance ID.' });
    }

    const advance = await prisma.salaryAdvance.findUnique({
      where: { id: advanceId },
      include: { employee: true }
    });

    if (!advance) {
      return res.status(404).json({ success: false, message: 'Salary advance record not found.' });
    }

    if (advance.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Advance cannot be rejected from status '${advance.status}'.` });
    }

    const updated = await prisma.salaryAdvance.update({
      where: { id: advanceId },
      data: {
        status: 'REJECTED',
        approvedById: req.user.id,
        reason: reason ? `${advance.reason ? advance.reason + ' | ' : ''}Rejected: ${reason}` : advance.reason
      }
    });

    await logFinancialAudit({
      action: 'SALARY_ADVANCE_REJECTED',
      entityType: 'ADVANCE',
      entityId: advanceId,
      amount: Number(advance.amount),
      branchId: advance.branchId,
      req,
      previousState: { status: advance.status },
      newState: { status: 'REJECTED' },
      reason: reason || 'Salary advance rejected by management'
    });

    res.status(200).json({
      success: true,
      message: `Salary advance for ${advance.employee.name} rejected.`,
      advance: {
        ...updated,
        amount: Number(updated.amount)
      }
    });
  } catch (error) {
    console.error('Error rejecting advance:', error);
    res.status(500).json({ success: false, message: 'Server error rejecting salary advance.' });
  }
};

/**
 * POST /api/finance/advances/:id/disburse
 * Disburse approved salary advance from cash drawer
 */
exports.disburseSalaryAdvance = async (req, res, next) => {
  try {
    const advanceId = parseInt(req.params.id, 10);
    const { disbursedFromAccountId } = req.body;

    if (isNaN(advanceId)) {
      return res.status(400).json({ success: false, message: 'Invalid advance ID.' });
    }

    const targetAccountId = parseInt(disbursedFromAccountId, 10);
    if (isNaN(targetAccountId)) {
      return res.status(400).json({ success: false, message: 'disbursedFromAccountId is required.' });
    }

    const [advance, account] = await Promise.all([
      prisma.salaryAdvance.findUnique({
        where: { id: advanceId },
        include: { employee: true }
      }),
      prisma.financialAccount.findUnique({
        where: { id: targetAccountId }
      })
    ]);

    if (!advance) {
      return res.status(404).json({ success: false, message: 'Salary advance record not found.' });
    }

    if (advance.status === 'DISBURSED' || advance.status === 'DEDUCTED') {
      return res.status(400).json({ success: false, message: `Advance is already ${advance.status}.` });
    }

    if (!account || account.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Invalid or inactive account.' });
    }

    const numAmount = Number(advance.amount);

    let advanceCat = await prisma.accountingCategory.findFirst({
      where: { code: 'EXP_STAFF_SALARY' }
    });
    if (!advanceCat) {
      advanceCat = await prisma.accountingCategory.findFirst({
        where: { categoryType: 'EXPENSE' }
      });
    }

    const disburseResult = await prisma.$transaction(async (tx) => {
      const txnNumber = await generateTransactionNumberTx(tx, 'ADV');

      // 1. Deduct from account balance
      await tx.financialAccount.update({
        where: { id: targetAccountId },
        data: { currentBalance: { decrement: numAmount } }
      });

      // 2. Create financial transaction in ledger with unique sourceModule + sourceRecordId
      const txn = await tx.financialTransaction.create({
        data: {
          transactionNumber: txnNumber,
          transactionDate: new Date(),
          branchId: advance.branchId,
          type: 'EXPENSE',
          categoryId: advanceCat.id,
          accountId: targetAccountId,
          amount: numAmount,
          paymentMethod: 'CASH',
          referenceNo: advance.advanceNumber,
          description: `Salary Advance to ${advance.employee.name}`,
          notes: advance.reason,
          approvalStatus: 'APPROVED',
          approvedById: req.user.id,
          approvedByName: req.user.name || req.user.email,
          approvedAt: new Date(),
          createdById: req.user.id,
          createdByName: req.user.name || req.user.email,
          sourceModule: 'SALARY_ADVANCE',
          sourceRecordId: advance.id
        }
      });

      // 3. Mark advance as DISBURSED
      const updatedAdvance = await tx.salaryAdvance.update({
        where: { id: advanceId },
        data: {
          status: 'DISBURSED',
          disbursedFromAccountId: targetAccountId,
          disbursedAt: new Date(),
          approvedById: req.user.id
        }
      });

      return { txn, updatedAdvance };
    }, { timeout: 15000 });

    await logFinancialAudit({
      action: 'SALARY_ADVANCE_DISBURSED',
      entityType: 'ADVANCE',
      entityId: advanceId,
      amount: numAmount,
      branchId: advance.branchId,
      req,
      newState: disburseResult.updatedAdvance
    });

    res.status(200).json({
      success: true,
      message: `Salary advance of LKR ${numAmount.toLocaleString()} disbursed to ${advance.employee.name}.`,
      transactionNumber: disburseResult.txn.transactionNumber
    });
  } catch (error) {
    if (error.code === 'P2002' || error.code === '23505') {
      return res.status(409).json({ success: false, message: 'This salary advance has already been disbursed in the financial ledger.' });
    }
    console.error('Error disbursing advance:', error);
    res.status(500).json({ success: false, message: 'Server error disbursing salary advance.' });
  }
};
