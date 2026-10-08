const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'TAILOR', 'CUTTING', 'EMBROIDERY', 'Manager'];

// GET /api/users — List all users (SUPER_ADMIN only)
exports.listUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true,
        role: true, branchId: true, isActive: true, createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
};

// POST /api/users — Create user (SUPER_ADMIN only)
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, branchId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'name, email, password, and role are required.' });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Valid roles: ${VALID_ROLES.join(', ')}` });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name, email, password: hashedPassword,
        role, branchId: branchId ? parseInt(branchId) : null,
        isActive: true
      },
      select: { id: true, name: true, email: true, role: true, branchId: true, isActive: true, createdAt: true }
    });

    res.status(201).json({ success: true, message: 'User created successfully.', user });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/users/:id — Update user role/status/branch (SUPER_ADMIN only)
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, role, branchId, isActive, password } = req.body;

    const userId = parseInt(id);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID.' });

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) return res.status(404).json({ success: false, message: 'User not found.' });

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ success: false, message: `Invalid role: ${role}` });
      }
      updateData.role = role;
    }
    if (branchId !== undefined) updateData.branchId = branchId ? parseInt(branchId) : null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (password) updateData.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, branchId: true, isActive: true }
    });

    res.json({ success: true, message: 'User updated successfully.', user });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/users/:id — Soft-delete (deactivate) user (SUPER_ADMIN only)
exports.deactivateUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID.' });

    // Prevent CEO from deactivating themselves
    if (req.user.id === userId) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }

    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    res.json({ success: true, message: 'User deactivated successfully.' });
  } catch (error) {
    next(error);
  }
};

// GET /api/users/branches - List all branches
exports.getBranches = async (req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, branches });
  } catch (error) {
    next(error);
  }
};
