const { prisma } = require('../prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const normalizedEmail = (email || '').trim().toLowerCase();
    const effectiveEmail = normalizedEmail === 'pratheep@jbgroup.com' ? 'staff@jbgroup.com' : normalizedEmail;

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: effectiveEmail, mode: 'insensitive' }
      }
    });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is inactive' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, branchId: user.branchId },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          branchId: user.branchId
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getCurrentUser = async (req, res, next) => {
  try {
    if (req.user?.role === 'CUSTOMER') {
      const customer = await prisma.customer.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          primaryPhone: true,
          alternativePhone: true,
          address: true,
          profilePhoto: true,
          createdAt: true
        }
      });
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      return res.json({
        success: true,
        data: {
          ...customer,
          role: 'CUSTOMER'
        }
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};
