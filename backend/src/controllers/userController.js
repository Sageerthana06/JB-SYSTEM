const crypto = require('crypto');
const { prisma } = require('../prisma');
const bcrypt = require('bcrypt');
const emailService = require('../utils/emailService');
const { logAudit } = require('../utils/auditLogger');

const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'TAILOR', 'CUTTING', 'EMBROIDERY', 'CASHIER'];
const MANAGER_PERMITTED_ROLES = ['STAFF', 'TAILOR', 'CUTTING', 'EMBROIDERY', 'CASHIER'];
const PRIVILEGED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

/**
 * Helper to generate next unique Employee ID
 */
const generateNextEmployeeId = async () => {
  const latest = await prisma.employee.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true, employeeId: true }
  });
  const nextNumber = (latest?.id || 0) + 1;
  return `EMP-${String(nextNumber).padStart(3, '0')}`;
};

/**
 * Check if caller is authorized to manage a specific target user / role / branch
 */
const checkManagementPermission = (caller, targetUser = null, targetRole = null, targetBranchId = null) => {
  if (!caller) return { allowed: false, reason: 'Unauthenticated.' };

  // SUPER_ADMIN (CEO) has full access across all branches and roles
  if (caller.role === 'SUPER_ADMIN') {
    return { allowed: true };
  }

  // ADMIN has full access except cannot modify SUPER_ADMIN
  if (caller.role === 'ADMIN') {
    if (targetUser && targetUser.role === 'SUPER_ADMIN') {
      return { allowed: false, reason: 'Admins cannot modify CEO/Super Admin accounts.' };
    }
    if (targetRole === 'SUPER_ADMIN') {
      return { allowed: false, reason: 'Admins cannot create or assign CEO/Super Admin role.' };
    }
    return { allowed: true };
  }

  // MANAGER restrictions
  if (caller.role === 'MANAGER') {
    // Manager must have an assigned branch
    if (!caller.branchId) {
      return { allowed: false, reason: 'Manager has no assigned branch.' };
    }

    // Branch check for target user
    if (targetUser && targetUser.branchId !== caller.branchId) {
      return { allowed: false, reason: 'Managers can only manage users within their assigned branch.' };
    }

    // Branch check for target branch
    if (targetBranchId && parseInt(targetBranchId, 10) !== caller.branchId) {
      return { allowed: false, reason: 'Managers cannot create or move accounts to other branches.' };
    }

    // Target user role check
    if (targetUser && PRIVILEGED_ROLES.includes(targetUser.role)) {
      return { allowed: false, reason: 'Managers cannot modify CEO, Admin, or Manager accounts.' };
    }

    // Target role check
    if (targetRole && !MANAGER_PERMITTED_ROLES.includes(targetRole)) {
      return {
        allowed: false,
        reason: `Managers can only assign permitted roles: ${MANAGER_PERMITTED_ROLES.join(', ')}.`
      };
    }

    return { allowed: true };
  }

  // All other roles (STAFF, TAILOR, CASHIER, etc.)
  return { allowed: false, reason: 'Access denied. You do not have user management privileges.' };
};

// =====================================================================
// GET /api/users — List all users and linked employees
// =====================================================================
exports.listUsers = async (req, res, next) => {
  try {
    const caller = req.user;
    const { search, role, branchId, status } = req.query;

    // Check base permission
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(caller.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Build branch filter
    let effectiveBranchId = null;
    if (caller.role === 'MANAGER') {
      effectiveBranchId = caller.branchId;
    } else if (branchId && branchId !== 'ALL') {
      effectiveBranchId = parseInt(branchId, 10);
    }

    // Fetch users with their linked employee & branch
    const userWhere = {};
    if (effectiveBranchId) {
      userWhere.branchId = effectiveBranchId;
    }
    if (role && role !== 'ALL') {
      userWhere.role = role;
    }
    if (status && status !== 'ALL') {
      userWhere.isActive = status === 'ACTIVE';
    }
    if (search) {
      const q = search.trim();
      userWhere.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        branch: { select: { id: true, name: true } },
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        employee: {
          select: {
            id: true,
            employeeId: true,
            phone: true,
            status: true
          }
        }
      },
      orderBy: { id: 'asc' }
    });

    // Also fetch any unlinked employees in this branch scope so they can be viewed and linked
    const empWhere = { userId: null };
    if (effectiveBranchId) {
      empWhere.branchId = effectiveBranchId;
    }
    if (role && role !== 'ALL') {
      empWhere.role = role;
    }
    if (status && status !== 'ALL') {
      empWhere.status = status;
    }

    const unlinkedEmployees = await prisma.employee.findMany({
      where: empWhere,
      include: {
        branch: { select: { id: true, name: true } }
      },
      orderBy: { id: 'asc' }
    });

    // Map into unified response
    const formattedUsers = users.map(u => ({
      id: u.id,
      userId: u.id,
      employeeRecordId: u.employee?.id || null,
      employeeId: u.employee?.employeeId || `EMP-${String(u.id).padStart(3, '0')}`,
      name: u.name,
      email: u.email,
      phone: u.employee?.phone || null,
      role: u.role,
      branchId: u.branchId,
      branchName: u.branch?.name || (u.branchId === 1 ? 'JB Group (Main)' : u.branchId === 2 ? 'Bella Design' : 'Unassigned'),
      hasLogin: true,
      loginStatus: u.isActive ? 'Active Login' : 'Inactive Login',
      accountStatus: u.isActive ? 'Active' : 'Inactive',
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      isLinked: Boolean(u.employee),
      createdAt: u.createdAt
    }));

    const formattedUnlinked = unlinkedEmployees.map(e => ({
      id: `emp-${e.id}`,
      userId: null,
      employeeRecordId: e.id,
      employeeId: e.employeeId,
      name: e.name,
      email: e.email || '',
      phone: e.phone || null,
      role: e.role,
      branchId: e.branchId,
      branchName: e.branch?.name || (e.branchId === 1 ? 'JB Group (Main)' : e.branchId === 2 ? 'Bella Design' : 'Unassigned'),
      hasLogin: false,
      loginStatus: 'No Login Account',
      accountStatus: e.status === 'ACTIVE' ? 'Active' : 'Inactive',
      isActive: e.status === 'ACTIVE',
      lastLoginAt: null,
      isLinked: false,
      createdAt: e.createdAt
    }));

    // Filter unlinked by search if provided
    let finalUnlinked = formattedUnlinked;
    if (search) {
      const q = search.trim().toLowerCase();
      finalUnlinked = formattedUnlinked.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.employeeId.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
      );
    }

    const combined = [...formattedUsers, ...finalUnlinked];

    res.json({
      success: true,
      totalCount: combined.length,
      users: combined,
      stats: {
        total: combined.length,
        activeLogins: formattedUsers.filter(u => u.isActive).length,
        inactiveLogins: formattedUsers.filter(u => !u.isActive).length,
        unlinkedEmployees: formattedUnlinked.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================================
// GET /api/users/employees — List unlinked employees for account creation
// =====================================================================
exports.listEligibleEmployees = async (req, res, next) => {
  try {
    const caller = req.user;
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(caller.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const where = { userId: null };
    if (caller.role === 'MANAGER') {
      where.branchId = caller.branchId;
      where.role = { in: MANAGER_PERMITTED_ROLES };
    }

    const employees = await prisma.employee.findMany({
      where,
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { employeeId: 'asc' }
    });

    res.json({ success: true, employees });
  } catch (error) {
    next(error);
  }
};

// =====================================================================
// POST /api/users — Create User & Employee Account
// =====================================================================
exports.createUser = async (req, res, next) => {
  try {
    const caller = req.user;
    const {
      name,
      email,
      role,
      branchId,
      password,
      sendSetupLink,
      employeeRecordId,
      phone,
      isActive = true
    } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ success: false, message: 'Name, email, and role are required.' });
    }

    if (!ALL_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Allowed roles: ${ALL_ROLES.join(', ')}` });
    }

    const parsedBranchId = branchId ? parseInt(branchId, 10) : caller.branchId || 1;

    // Validate role and branch permission
    const perm = checkManagementPermission(caller, null, role, parsedBranchId);
    if (!perm.allowed) {
      return res.status(403).json({ success: false, message: perm.reason });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check duplicate user email
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
    });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'A login account with this email already exists.' });
    }

    let initialHashedPassword;
    let setupTokenRaw = null;

    if (sendSetupLink) {
      // Generate a temporary high-entropy random password that the user will replace via setup link
      const randomSecret = crypto.randomBytes(24).toString('base64');
      initialHashedPassword = await bcrypt.hash(randomSecret, 12);
    } else {
      if (!password || password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
      }
      initialHashedPassword = await bcrypt.hash(password, 12);
    }

    // Resolve Employee record
    let linkedEmployee = null;
    if (employeeRecordId) {
      linkedEmployee = await prisma.employee.findUnique({
        where: { id: parseInt(employeeRecordId, 10) }
      });

      if (!linkedEmployee) {
        return res.status(404).json({ success: false, message: 'Selected employee record not found.' });
      }
      if (linkedEmployee.userId) {
        return res.status(409).json({ success: false, message: 'This employee is already linked to another login account.' });
      }
      // Manager branch check on employee
      if (caller.role === 'MANAGER' && linkedEmployee.branchId !== caller.branchId) {
        return res.status(403).json({ success: false, message: 'Cannot link an employee from another branch.' });
      }
    }

    // Create User record
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: initialHashedPassword,
        role,
        branchId: parsedBranchId,
        isActive: Boolean(isActive)
      },
      include: { branch: true }
    });

    // Create or Link Employee record
    if (linkedEmployee) {
      await prisma.employee.update({
        where: { id: linkedEmployee.id },
        data: {
          userId: newUser.id,
          name: name.trim(),
          email: normalizedEmail,
          role,
          branchId: parsedBranchId,
          status: isActive ? 'ACTIVE' : 'INACTIVE',
          phone: phone || linkedEmployee.phone
        }
      });
      linkedEmployee.userId = newUser.id;
    } else {
      const generatedEmpId = await generateNextEmployeeId();
      linkedEmployee = await prisma.employee.create({
        data: {
          employeeId: generatedEmpId,
          name: name.trim(),
          email: normalizedEmail,
          phone: phone || null,
          role,
          branchId: parsedBranchId,
          userId: newUser.id,
          status: isActive ? 'ACTIVE' : 'INACTIVE'
        }
      });
    }

    // If setup email was requested, generate token and send email
    let emailSent = false;
    if (sendSetupLink) {
      setupTokenRaw = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(setupTokenRaw).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: {
          userId: newUser.id,
          tokenHash,
          expiresAt,
          requestedBy: `ADMIN_${caller.role}_${caller.name}`,
          isUsed: false
        }
      });

      const baseUrl = process.env.APP_URL || 'http://localhost:5173';
      const setupUrl = `${baseUrl}/?resetToken=${setupTokenRaw}`;

      const sendRes = await emailService.sendAccountSetupEmail({
        to: newUser.email,
        name: newUser.name,
        setupUrl,
        role: newUser.role,
        branchName: newUser.branch?.name || 'Main Branch',
        expiresMinutes: 60
      });
      emailSent = sendRes.success;
    }

    // Audit Log
    await logAudit({
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: newUser.id,
      req,
      details: {
        role: newUser.role,
        branchId: newUser.branchId,
        employeeId: linkedEmployee.employeeId,
        setupViaEmail: Boolean(sendSetupLink)
      }
    });

    res.status(201).json({
      success: true,
      message: sendSetupLink
        ? `Account created successfully! ${emailSent ? 'Setup email sent to ' + newUser.email : 'Setup link generated.'}`
        : 'User and Employee account created successfully.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        branchId: newUser.branchId,
        branchName: newUser.branch?.name || null,
        employeeId: linkedEmployee.employeeId,
        isActive: newUser.isActive
      },
      setupUrl: setupTokenRaw ? `${process.env.APP_URL || 'http://localhost:5173'}/?resetToken=${setupTokenRaw}` : null
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================================
// POST /api/users/link — Link Existing Login to Employee Record
// =====================================================================
exports.linkAccount = async (req, res, next) => {
  try {
    const caller = req.user;
    const { userId, employeeId, employeeRecordId } = req.body;

    if (!userId || (!employeeId && !employeeRecordId)) {
      return res.status(400).json({ success: false, message: 'userId and employee identifier are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) },
      include: { employee: true }
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    if (user.employee) {
      return res.status(409).json({ success: false, message: 'This user account is already linked to an employee record.' });
    }

    let employee;
    if (employeeRecordId) {
      employee = await prisma.employee.findUnique({ where: { id: parseInt(employeeRecordId, 10) } });
    } else {
      employee = await prisma.employee.findUnique({ where: { employeeId: String(employeeId).trim() } });
    }

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee record not found.' });
    }

    if (employee.userId) {
      return res.status(409).json({ success: false, message: 'This employee is already linked to another user account.' });
    }

    // Role & branch security check
    const perm = checkManagementPermission(caller, user, employee.role, employee.branchId);
    if (!perm.allowed) {
      return res.status(403).json({ success: false, message: perm.reason });
    }

    // Prevent changing privileged roles via linking
    if (PRIVILEGED_ROLES.includes(user.role) && caller.role === 'MANAGER') {
      return res.status(403).json({ success: false, message: 'Managers cannot link privileged accounts.' });
    }

    // Update Employee link
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        userId: user.id,
        status: user.isActive ? 'ACTIVE' : 'INACTIVE'
      }
    });

    await logAudit({
      action: 'USER_LINKED',
      entityType: 'USER',
      entityId: user.id,
      req,
      details: {
        employeeId: employee.employeeId,
        role: user.role,
        branchId: user.branchId
      }
    });

    res.json({
      success: true,
      message: `User ${user.name} successfully linked to employee record ${employee.employeeId}.`,
      employee: {
        id: employee.id,
        employeeId: employee.employeeId,
        name: employee.name,
        role: employee.role,
        userId: user.id
      }
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================================
// POST /api/users/:id/reset-password — Admin/Manager initiated reset
// =====================================================================
exports.initiatePasswordReset = async (req, res, next) => {
  try {
    const caller = req.user;
    const targetUserId = parseInt(req.params.id, 10);

    if (isNaN(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { branch: true }
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Permission check
    const perm = checkManagementPermission(caller, targetUser);
    if (!perm.allowed) {
      return res.status(403).json({ success: false, message: perm.reason });
    }

    if (caller.role === 'MANAGER' && (targetUser.role === 'SUPER_ADMIN' || targetUser.role === 'ADMIN')) {
      return res.status(403).json({ success: false, message: 'Managers must never change CEO or Super Admin passwords.' });
    }

    // Generate single-use token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate existing active tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: targetUser.id, isUsed: false },
      data: { isUsed: true, usedAt: new Date() }
    });

    // Create token record
    await prisma.passwordResetToken.create({
      data: {
        userId: targetUser.id,
        tokenHash,
        expiresAt,
        requestedBy: `${caller.role}:${caller.name || caller.id}`,
        isUsed: false
      }
    });

    // Send email
    const baseUrl = process.env.APP_URL || 'http://localhost:5173';
    const resetUrl = `${baseUrl}/?resetToken=${rawToken}`;

    const sendRes = await emailService.sendPasswordResetEmail({
      to: targetUser.email,
      name: targetUser.name,
      resetUrl,
      isManagerInitiated: true,
      expiresMinutes: 60
    });

    // Audit log without token or credentials
    await logAudit({
      action: 'PASSWORD_RESET_REQUESTED_BY_ADMIN',
      entityType: 'USER',
      entityId: targetUser.id,
      req,
      details: {
        targetRole: targetUser.role,
        targetEmailDomain: targetUser.email.split('@')[1],
        emailSent: sendRes.success
      }
    });

    res.json({
      success: true,
      message: sendRes.success
        ? `Password reset link sent to ${targetUser.email}. Valid for 60 minutes.`
        : `Password reset token generated. Reset URL: ${resetUrl}`,
      emailSent: sendRes.success,
      resetUrl // Provided for testing and manual delivery if mail server is offline
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================================
// POST /api/users/:id/set-password — Manual password setup by CEO / Manager
// =====================================================================
exports.setPasswordManually = async (req, res, next) => {
  try {
    const caller = req.user;
    const targetUserId = parseInt(req.params.id, 10);
    const { password, confirmPassword } = req.body;

    if (isNaN(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'New password is required.' });
    }

    const trimmedPassword = password.trim();
    if (trimmedPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    if (confirmPassword !== undefined && trimmedPassword !== String(confirmPassword).trim()) {
      return res.status(400).json({ success: false, message: 'New password and confirmation password do not match.' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { branch: true }
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target user not found.' });
    }

    // Role-based authorization checks:
    // 1. CEO (SUPER_ADMIN): Full authority to set passwords for any account across all branches.
    // 2. ADMIN: Full authority except cannot set CEO/SUPER_ADMIN password.
    // 3. MANAGER:
    //    - Manager must NEVER change CEO/SUPER_ADMIN or ADMIN password
    //    - Manager cannot change other Manager passwords
    //    - Manager can only change passwords for accounts in their authorized branch
    //    - Manager can only change passwords for permitted roles (STAFF, TAILOR, CUTTING, EMBROIDERY, CASHIER)
    if (caller.role === 'SUPER_ADMIN') {
      // Full authority
    } else if (caller.role === 'ADMIN') {
      if (targetUser.role === 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, message: 'Admins cannot change CEO/Super Admin passwords.' });
      }
    } else if (caller.role === 'MANAGER') {
      if (!caller.branchId) {
        return res.status(403).json({ success: false, message: 'Manager has no assigned branch.' });
      }

      // Requirement 4: Manager must never change the CEO/SUPER_ADMIN password
      if (targetUser.role === 'SUPER_ADMIN' || targetUser.role === 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Managers must never change CEO or Super Admin passwords.'
        });
      }

      if (targetUser.role === 'MANAGER') {
        return res.status(403).json({
          success: false,
          message: 'Managers cannot change passwords for other Manager accounts.'
        });
      }

      // Requirement 3: within authorized branch
      if (targetUser.branchId !== caller.branchId) {
        return res.status(403).json({
          success: false,
          message: 'Managers can only set passwords for user accounts within their authorized branch.'
        });
      }

      // Requirement 3: within permitted roles
      if (!MANAGER_PERMITTED_ROLES.includes(targetUser.role)) {
        return res.status(403).json({
          success: false,
          message: `Managers can only set passwords for permitted roles: ${MANAGER_PERMITTED_ROLES.join(', ')}.`
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to manage passwords.'
      });
    }

    // Securely hash password using existing bcrypt service (cost factor 12)
    const hashedPassword = await bcrypt.hash(trimmedPassword, 12);

    // Update user password and invalidate any active password reset tokens
    await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUser.id },
        data: {
          password: hashedPassword
        }
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: targetUser.id, isUsed: false },
        data: { isUsed: true, usedAt: new Date() }
      })
    ]);

    // Audit log without logging plaintext password
    await logAudit({
      action: 'USER_PASSWORD_SET_MANUALLY',
      entityType: 'USER',
      entityId: targetUser.id,
      req,
      details: {
        targetRole: targetUser.role,
        targetBranchId: targetUser.branchId,
        changedByRole: caller.role,
        changedByName: caller.name || caller.id
      }
    });

    res.json({
      success: true,
      message: `Password successfully updated for ${targetUser.name} (${targetUser.role}).`
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================================
// PATCH /api/users/:id — Update User & Employee Details
// =====================================================================
exports.updateUser = async (req, res, next) => {
  try {
    const caller = req.user;
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID.' });

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true }
    });
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    const { name, role, branchId, isActive, password, phone } = req.body;

    // Check permissions
    const perm = checkManagementPermission(caller, targetUser, role, branchId);
    if (!perm.allowed) {
      return res.status(403).json({ success: false, message: perm.reason });
    }

    // Prevent self-role modification or self-deactivation
    if (caller.id === userId && role && role !== caller.role) {
      return res.status(400).json({ success: false, message: 'You cannot change your own role.' });
    }
    if (caller.id === userId && isActive === false) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }

    const updateData = {};
    const employeeUpdateData = {};

    if (name !== undefined) {
      updateData.name = name.trim();
      employeeUpdateData.name = name.trim();
    }
    if (role !== undefined) {
      if (!ALL_ROLES.includes(role)) {
        return res.status(400).json({ success: false, message: `Invalid role: ${role}` });
      }
      updateData.role = role;
      employeeUpdateData.role = role;
    }
    if (branchId !== undefined) {
      const parsedBranch = branchId ? parseInt(branchId, 10) : null;
      updateData.branchId = parsedBranch;
      employeeUpdateData.branchId = parsedBranch;
    }
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
      employeeUpdateData.status = isActive ? 'ACTIVE' : 'INACTIVE';
    }
    if (password) {
      if (caller.role === 'MANAGER') {
        if (targetUser.role === 'SUPER_ADMIN' || targetUser.role === 'ADMIN') {
          return res.status(403).json({ success: false, message: 'Managers must never change CEO or Super Admin passwords.' });
        }
        if (targetUser.role === 'MANAGER' || !MANAGER_PERMITTED_ROLES.includes(targetUser.role)) {
          return res.status(403).json({ success: false, message: 'Managers cannot change passwords for privileged accounts.' });
        }
        if (targetUser.branchId !== caller.branchId) {
          return res.status(403).json({ success: false, message: 'Managers can only manage users within their authorized branch.' });
        }
      }
      if (caller.role === 'ADMIN' && targetUser.role === 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, message: 'Admins cannot change CEO/Super Admin passwords.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      }
      updateData.password = await bcrypt.hash(password, 12);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        isActive: true,
        lastLoginAt: true
      }
    });

    if (targetUser.employee) {
      if (phone !== undefined) employeeUpdateData.phone = phone;
      await prisma.employee.update({
        where: { id: targetUser.employee.id },
        data: employeeUpdateData
      });
    }

    await logAudit({
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: userId,
      req,
      details: {
        updatedFields: Object.keys(updateData).filter(k => k !== 'password')
      }
    });

    res.json({ success: true, message: 'User updated successfully.', user: updatedUser });
  } catch (error) {
    next(error);
  }
};

// =====================================================================
// PATCH /api/users/:id/status (or DELETE /api/users/:id) — Activate / Deactivate
// =====================================================================
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const caller = req.user;
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID.' });

    // Prevent self-deactivation
    if (caller.id === userId) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: true,
        assignedOrders: {
          where: {
            status: { in: ['ORDER_CONFIRMED', 'PENDING_PRODUCTION', 'IN_PROGRESS', 'CUTTING', 'STITCHING'] }
          },
          select: { id: true, orderNumber: true, status: true }
        }
      }
    });

    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

    // Permission check
    const perm = checkManagementPermission(caller, targetUser);
    if (!perm.allowed) {
      return res.status(403).json({ success: false, message: perm.reason });
    }

    // Determine target status
    const newStatus = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !targetUser.isActive;

    // Check active commitments if deactivating
    let activeWarning = null;
    if (!newStatus && targetUser.assignedOrders?.length > 0) {
      activeWarning = `User has ${targetUser.assignedOrders.length} active in-progress order(s): ${targetUser.assignedOrders.map(o => o.orderNumber).slice(0, 3).join(', ')}`;
    }

    // Soft update — NEVER DELETE RECORDS
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: newStatus }
    });

    if (targetUser.employee) {
      await prisma.employee.update({
        where: { id: targetUser.employee.id },
        data: { status: newStatus ? 'ACTIVE' : 'INACTIVE' }
      });
    }

    await logAudit({
      action: newStatus ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'USER',
      entityId: userId,
      req,
      details: {
        targetRole: targetUser.role,
        warning: activeWarning
      }
    });

    res.json({
      success: true,
      message: `User account ${newStatus ? 'activated' : 'deactivated'} successfully.`,
      isActive: newStatus,
      warning: activeWarning
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================================
// GET /api/users/branches — List active branches
// =====================================================================
exports.getBranches = async (req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { id: 'asc' }
    });
    res.json({ success: true, branches });
  } catch (error) {
    next(error);
  }
};
