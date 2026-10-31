const { prisma } = require('../prisma');

/**
 * Helper to get today's date formatted as YYYY-MM-DD in Asia/Colombo (UTC+05:30)
 */
const getTodayDateString = (inputDate) => {
  if (inputDate && typeof inputDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
    return inputDate;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
};

/**
 * Calculate working hours between checkIn and checkOut
 * Returns { diffMs, hours, minutes, seconds, hoursDecimal, formatted }
 */
const calculateWorkingHours = (checkIn, checkOut) => {
  if (!checkIn) return null;
  const start = new Date(checkIn).getTime();
  const end = checkOut ? new Date(checkOut).getTime() : Date.now();
  if (isNaN(start) || isNaN(end) || end < start) return null;

  const diffMs = end - start;
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hoursDecimal = Number((totalSeconds / 3600).toFixed(2));
  const formatted = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;

  return {
    diffMs,
    hours,
    minutes,
    seconds,
    hoursDecimal,
    formatted
  };
};

exports.calculateWorkingHours = calculateWorkingHours;
exports.getTodayDateString = getTodayDateString;

/**
 * GET /api/attendance/my-today
 * Self attendance lookup for logged-in Tailor, Staff, Manager, or Admin
 */
exports.getMyTodayAttendance = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const date = getTodayDateString(req.query.date);

    // Look for record by userId or tailorId
    const record = await prisma.attendance.findFirst({
      where: {
        OR: [
          { userId, date },
          { tailorId: userId, date }
        ]
      }
    });

    const working = record ? calculateWorkingHours(record.checkIn, record.checkOut) : null;

    res.json({
      success: true,
      data: record ? {
        ...record,
        workingHours: working?.formatted || null,
        workingHoursDecimal: working?.hoursDecimal || null
      } : null,
      date
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/attendance/clock-in
 * Self Clock-In (ADMIN, MANAGER, STAFF, TAILOR)
 */
exports.clockIn = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const date = getTodayDateString();
    const now = new Date();

    // Fetch user details for branch & role
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { branch: true }
    });

    if (!dbUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const role = dbUser.role;
    const branchName = dbUser.branch?.name || 'Main Branch';

    // Check if already exists for today in Asia/Colombo
    const existing = await prisma.attendance.findFirst({
      where: {
        OR: [
          { userId, date },
          { tailorId: userId, date }
        ]
      }
    });

    if (existing && existing.checkIn) {
      return res.status(400).json({
        success: false,
        message: 'You have already clocked in for today.',
        data: existing
      });
    }

    let record;
    if (existing) {
      record = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          userId,
          tailorId: userId,
          status: 'Present',
          checkIn: now,
          role,
          branch: branchName,
          markedBy: dbUser.name || dbUser.email
        }
      });
    } else {
      record = await prisma.attendance.create({
        data: {
          userId,
          tailorId: userId,
          date,
          status: 'Present',
          checkIn: now,
          checkOut: null,
          role,
          branch: branchName,
          markedBy: dbUser.name || dbUser.email
        }
      });
    }

    res.json({
      success: true,
      message: 'Clocked in successfully.',
      data: record
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/attendance/clock-out
 * Self Clock-Out (ADMIN, MANAGER, STAFF, TAILOR)
 */
exports.clockOut = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const date = getTodayDateString();
    const now = new Date();

    const existing = await prisma.attendance.findFirst({
      where: {
        OR: [
          { userId, date },
          { tailorId: userId, date }
        ]
      }
    });

    if (!existing || !existing.checkIn) {
      return res.status(400).json({
        success: false,
        message: 'You must clock in first before clocking out.'
      });
    }

    if (existing.checkOut) {
      return res.status(400).json({
        success: false,
        message: 'You have already clocked out for today.',
        data: existing
      });
    }

    const record = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        status: 'Checked Out',
        checkOut: now
      }
    });

    const working = calculateWorkingHours(record.checkIn, record.checkOut);

    res.json({
      success: true,
      message: 'Clocked out successfully.',
      data: {
        ...record,
        workingHours: working?.formatted || null,
        workingHoursDecimal: working?.hoursDecimal || null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/attendance/ceo-center
 * CEO & Super Admin Attendance Center: View all employees, live status, and statistics
 */
exports.getCeoAttendanceCenter = async (req, res, next) => {
  try {
    const date = getTodayDateString(req.query.date);

    // Fetch authorized working team: Admins, Manager, Pratheep (Staff), and 3 Tailors (Pushpamalar, Uruththiradevi, Susitha)
    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: 'ADMIN' },
          {
            email: {
              in: [
                'manager@jbgroup.com',
                'staff@jbgroup.com',
                'pushpamalar@jbgroup.com',
                'uruththiradevi@jbgroup.com',
                'susitha@jbgroup.com'
              ]
            }
          }
        ]
      },
      include: {
        branch: { select: { id: true, name: true } }
      },
      orderBy: { id: 'asc' }
    });

    // Fetch all attendance rows for today
    const attendanceRecords = await prisma.attendance.findMany({
      where: { date }
    });

    // Index by userId and tailorId
    const attendanceMap = {};
    for (const att of attendanceRecords) {
      if (att.userId) attendanceMap[att.userId] = att;
      if (att.tailorId) attendanceMap[att.tailorId] = att;
    }

    let presentCount = 0;
    let checkedOutCount = 0;
    let notMarkedCount = 0;
    let absentCount = 0;

    const roleDisplayMap = {
      'SUPER_ADMIN': 'CEO / MD',
      'ADMIN': 'Admin',
      'MANAGER': 'Manager',
      'STAFF': 'Staff',
      'TAILOR': 'Tailor',
      'CUTTING': 'Cutting',
      'EMBROIDERY': 'Embroidery',
      'CASHIER': 'Cashier'
    };

    const roster = employees.map((emp) => {
      const att = attendanceMap[emp.id] || null;
      let status = 'Not Marked';

      if (att) {
        if (att.status === 'Checked Out' || att.checkOut) {
          status = 'Checked Out';
          checkedOutCount++;
        } else if (att.status === 'Present') {
          status = 'Present';
          presentCount++;
        } else if (att.status === 'Absent') {
          status = 'Absent';
          absentCount++;
        } else {
          status = att.status || 'Present';
          presentCount++;
        }
      } else {
        notMarkedCount++;
      }

      const working = att && att.checkIn && att.checkOut ? calculateWorkingHours(att.checkIn, att.checkOut) : null;

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        role: emp.role,
        roleLabel: roleDisplayMap[emp.role] || emp.role,
        branch: att?.branch || emp.branch?.name || 'Main Branch',
        date: 'Today',
        dateKey: date,
        checkIn: att?.checkIn || null,
        checkOut: att?.checkOut || null,
        workingHours: working?.formatted || (att?.checkIn && !att?.checkOut ? 'In Progress' : '—'),
        workingHoursDecimal: working?.hoursDecimal || 0,
        status,
        markedBy: att?.markedBy || null,
        attendanceId: att?.id || null
      };
    });

    res.json({
      success: true,
      date,
      summary: {
        total: employees.length,
        present: presentCount,
        checkedOut: checkedOutCount,
        notMarked: notMarkedCount,
        absent: absentCount
      },
      records: roster
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Backward-compatible endpoints for Tailor Details View
 */
exports.getTodayAttendanceByTailor = async (req, res, next) => {
  try {
    const tailorId = parseInt(req.params.tailorId, 10);
    const date = getTodayDateString(req.query.date);

    const record = await prisma.attendance.findFirst({
      where: {
        OR: [
          { userId: tailorId, date },
          { tailorId, date }
        ]
      }
    });

    res.json({
      success: true,
      data: record || null,
      date
    });
  } catch (error) {
    next(error);
  }
};

exports.getAllTodayAttendance = async (req, res, next) => {
  try {
    const date = getTodayDateString(req.query.date);
    const records = await prisma.attendance.findMany({ where: { date } });
    const attendanceMap = {};
    for (const r of records) {
      if (r.userId) attendanceMap[r.userId] = r;
      if (r.tailorId) attendanceMap[r.tailorId] = r;
    }
    res.json({ success: true, data: attendanceMap, list: records, date });
  } catch (error) {
    next(error);
  }
};

exports.markPresent = async (req, res, next) => {
  try {
    const { tailorId } = req.body;
    const parsedId = parseInt(tailorId, 10);
    const date = getTodayDateString();
    const user = await prisma.user.findUnique({ where: { id: parsedId }, include: { branch: true } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const record = await prisma.attendance.upsert({
      where: { userId_date: { userId: parsedId, date } },
      create: {
        userId: parsedId,
        tailorId: parsedId,
        date,
        status: 'Present',
        checkIn: new Date(),
        role: user.role,
        branch: user.branch?.name || 'Main Branch',
        markedBy: req.user?.name || req.user?.email || 'CEO/Manager'
      },
      update: {
        status: 'Present',
        checkIn: new Date(),
        markedBy: req.user?.name || req.user?.email || 'CEO/Manager'
      }
    });
    res.json({ success: true, message: `${user.name} marked Present successfully.`, data: record });
  } catch (error) {
    next(error);
  }
};

exports.markAbsent = async (req, res, next) => {
  try {
    const { tailorId } = req.body;
    const parsedId = parseInt(tailorId, 10);
    const date = getTodayDateString();
    const user = await prisma.user.findUnique({ where: { id: parsedId }, include: { branch: true } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const record = await prisma.attendance.upsert({
      where: { userId_date: { userId: parsedId, date } },
      create: {
        userId: parsedId,
        tailorId: parsedId,
        date,
        status: 'Absent',
        checkIn: null,
        checkOut: null,
        role: user.role,
        branch: user.branch?.name || 'Main Branch',
        markedBy: req.user?.name || req.user?.email || 'CEO/Manager'
      },
      update: {
        status: 'Absent',
        checkIn: null,
        checkOut: null,
        markedBy: req.user?.name || req.user?.email || 'CEO/Manager'
      }
    });
    res.json({ success: true, message: `${user.name} marked Absent successfully.`, data: record });
  } catch (error) {
    next(error);
  }
};

exports.checkOut = async (req, res, next) => {
  try {
    const { tailorId } = req.body;
    const parsedId = parseInt(tailorId, 10);
    const date = getTodayDateString();
    const existing = await prisma.attendance.findFirst({
      where: {
        OR: [
          { userId: parsedId, date },
          { tailorId: parsedId, date }
        ]
      }
    });
    if (!existing || existing.status !== 'Present') {
      return res.status(400).json({ success: false, message: 'Check Out is only enabled after tailor is marked Present.' });
    }
    const record = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        status: 'Checked Out',
        checkOut: new Date(),
        markedBy: req.user?.name || req.user?.email || existing.markedBy
      }
    });
    res.json({ success: true, message: 'Check out recorded successfully.', data: record });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/attendance/my-history
 * Attendance history for logged-in staff member / user
 * Supports optional date filters: ?date=YYYY-MM-DD or ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getMyAttendanceHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, date } = req.query;

    const where = {
      OR: [
        { userId },
        { tailorId: userId }
      ]
    };

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      where.date = date;
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        where.date.gte = startDate;
      }
      if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        where.date.lte = endDate;
      }
    }

    const records = await prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 100
    });

    const enhancedRecords = records.map(r => {
      const working = r.checkIn && r.checkOut ? calculateWorkingHours(r.checkIn, r.checkOut) : null;
      return {
        ...r,
        workingHours: working?.formatted || (r.checkIn && !r.checkOut ? 'In Progress' : '—'),
        workingHoursDecimal: working?.hoursDecimal || 0
      };
    });

    res.json({
      success: true,
      records: enhancedRecords
    });
  } catch (error) {
    next(error);
  }
};
