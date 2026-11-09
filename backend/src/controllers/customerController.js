const { prisma } = require('../prisma');
const bcrypt = require('bcrypt');
const { validateDressMeasurements } = require('../utils/measurementValidation');
const {
  cleanPhoneRaw,
  normalizePhoneNumber,
  getPhoneSearchVariants,
  validatePhoneNumber
} = require('../utils/phoneUtils');

// Helper to generate a unique order number (e.g., JB-20260916-0001)
const generateOrderNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const prefix = `JB-${year}${month}${day}-`;

  const lastOrder = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: 'desc' }
  });

  if (!lastOrder) return `${prefix}0001`;

  const lastNumberStr = lastOrder.orderNumber.split('-')[2];
  const nextNumber = parseInt(lastNumberStr, 10) + 1;
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

// Build garment create payload from request body
const buildGarmentData = (g) => ({
  dressType: g.dressType,
  quantity: parseInt(g.quantity) || 1,
  occasion: g.occasion || null,
  fabricSuppliedBy: g.fabricSuppliedBy || null,
  fabricType: g.fabricType || null,
  fabricColour: g.fabricColour || null,
  liningRequired: g.liningRequired === 'Yes' || g.liningRequired === true,
  paddingCupRequired: g.paddingCupRequired === 'Yes' || g.paddingCupRequired === true,
  workRequired: g.workRequired === 'Yes' || g.workRequired === true,
  workDetails: g.workDetails || null,
  accessoriesSupplied: g.accessoriesSupplied || null,
  specialDesignInstructions: g.specialDesignInstructions || null,
  designReferenceImage: g.designReferenceImage || g.designReferencePhoto || null,
  measurements: g.measurements || null,
  measurementUnit: g.measurementUnit || 'cm',
  fitPreference: g.fitPreference || 'Regular',
  additionalImages: g.additionalImages || null,
  customerMeasurementId: g.customerMeasurementId || null
});
// CREATE CUSTOMER & ORDER
exports.createCustomer = async (req, res, next) => {
  let createdCustomerId = null; // Track for rollback if order fails

  try {
    const {
      customerName,
      primaryContact,
      alternativeContact,
      address,
      customerType,
      previousOrderNumber,
      garmentDetails,
      branchId,
      paymentDetails,
      profilePhoto,
      orderSource,
      assignedTailorId
    } = req.body;

    // Validation
    if (customerType === 'NEW') {
      if (!customerName || !primaryContact) {
        return res.status(400).json({
          success: false,
          message: 'Customer Name and Primary Contact are required for a new customer.'
        });
      }
      const cleanedPrimary = primaryContact.trim();
      const digitsOnly = cleanedPrimary.replace(/\D/g, '');
      if (digitsOnly.length < 7 || digitsOnly.length > 15 || !/^\+?[0-9\s\-()]+$/.test(cleanedPrimary)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid phone number (e.g., +447XXXXXXXXX, +9477XXXXXXX, or 077XXXXXXX).'
        });
      }
      if (alternativeContact && alternativeContact.trim()) {
        const cleanedAlt = alternativeContact.trim();
        const altDigits = cleanedAlt.replace(/\D/g, '');
        if (altDigits.length < 7 || altDigits.length > 15 || !/^\+?[0-9\s\-()]+$/.test(cleanedAlt)) {
          return res.status(400).json({
            success: false,
            message: 'Please enter a valid alternative contact phone number.'
          });
        }
      }
    } else if (customerType !== 'RETURNING') {
      return res.status(400).json({ success: false, message: 'Invalid customer type.' });
    }

    let customer;
    let prevOrderId = null;

    // Step 1: Resolve customer
    if (customerType === 'NEW') {
      const phoneVariants = getPhoneSearchVariants(primaryContact);
      const existing = await prisma.customer.findFirst({
        where: { primaryPhone: { in: phoneVariants } }
      });
      const normalizedPhone = normalizePhoneNumber(primaryContact) || primaryContact.trim();

      if (existing) {
        // Existing customer found with this phone: reuse and update record seamlessly
        const updateCustomerData = {
          name: customerName ? customerName.trim() : existing.name,
          address: address ? address.trim() : existing.address,
          alternativePhone: alternativeContact ? alternativeContact.trim() : existing.alternativePhone
        };
        // Preserve existing customer profile photo; never clear or overwrite with null/empty
        if (profilePhoto && typeof profilePhoto === 'string' && profilePhoto.trim()) {
          updateCustomerData.profilePhoto = profilePhoto.trim();
        }
        customer = await prisma.customer.update({
          where: { id: existing.id },
          data: updateCustomerData
        });
      } else {
        customer = await prisma.customer.create({
          data: {
            name: customerName.trim(),
            primaryPhone: normalizedPhone,
            alternativePhone: alternativeContact ? alternativeContact.trim() : null,
            address: address ? address.trim() : null,
            profilePhoto: (profilePhoto && typeof profilePhoto === 'string') ? profilePhoto.trim() : null
          }
        });
        createdCustomerId = customer.id;
      }
    } else {
      // RETURNING: resolve by previous order OR by phone
      if (previousOrderNumber) {
        const prevOrder = await prisma.order.findFirst({
          where: {
            OR: [
              { id: parseInt(previousOrderNumber) || -1 },
              { orderNumber: String(previousOrderNumber) }
            ]
          },
          include: { customer: true }
        });
        if (!prevOrder) {
          return res.status(404).json({
            success: false,
            message: 'The selected previous order could not be found.'
          });
        }
        customer = prevOrder.customer;
        prevOrderId = prevOrder.id;
      } else {
        if (!primaryContact) {
          return res.status(400).json({
            success: false,
            message: 'Please search and select the returning customer before submitting.'
          });
        }
        const found = await prisma.customer.findUnique({
          where: { primaryPhone: primaryContact.trim() }
        });
        if (!found) {
          return res.status(404).json({
            success: false,
            message: 'Returning customer not found. Please search and select the customer first.'
          });
        }
        customer = found;
      }

      // If returning customer provided a valid new profile photo, update it in DB
      if (profilePhoto && typeof profilePhoto === 'string' && profilePhoto.trim() && customer && profilePhoto.trim() !== customer.profilePhoto) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { profilePhoto: profilePhoto.trim() }
        });
      }
    }

    // Step 2: Validate garment & tailoring measurements
    if (!garmentDetails || !garmentDetails.dressType) {
      return res.status(400).json({
        success: false,
        message: 'Dress Type is required in Garment Details.'
      });
    }

    const measurementValidation = validateDressMeasurements(garmentDetails.dressType, garmentDetails.measurements);
    if (!measurementValidation.valid) {
      return res.status(400).json({
        success: false,
        message: measurementValidation.message
      });
    }

    let customerMeasurementRecord = null;
    if (garmentDetails.measurements && typeof garmentDetails.measurements === 'object' && Object.keys(garmentDetails.measurements).length > 0) {
      customerMeasurementRecord = await prisma.customerMeasurement.create({
        data: {
          customerId: customer.id,
          dressType: garmentDetails.dressType || 'Custom',
          measurementUnit: garmentDetails.measurementUnit || 'cm',
          fitPreference: garmentDetails.fitPreference || 'Regular',
          takenBy: garmentDetails.takenBy || req.user?.name || req.user?.username || 'Staff',
          measurementDate: garmentDetails.measurementDate ? new Date(garmentDetails.measurementDate) : new Date(),
          measurements: garmentDetails.measurements,
          fittingInstructions: garmentDetails.fittingInstructions || garmentDetails.specialDesignInstructions || null
        }
      });
      garmentDetails.customerMeasurementId = customerMeasurementRecord.id;
    }


    // Step 3: Generate order number
    const orderNumber = await generateOrderNumber();

    // Step 4: Create order with nested garment
    const totalAmount = paymentDetails?.totalAmount ? parseFloat(paymentDetails.totalAmount) : 0;
    const advancePayment = paymentDetails?.advancePayment ? parseFloat(paymentDetails.advancePayment) : 0;
    const balanceAmount = Math.max(0, totalAmount - advancePayment);
    const paymentStatus = advancePayment <= 0 ? 'Unpaid' : (balanceAmount <= 0 && totalAmount > 0 ? 'Paid' : 'Partially Paid');

    const source = orderSource || 'SHOP';
    const initialStatus = source === 'ONLINE' ? 'PENDING_APPROVAL' : 'ORDER_CONFIRMED';

    const orderData = {
      orderNumber,
      customerId: customer.id,
      previousOrderId: prevOrderId,
      branchId: branchId ? parseInt(branchId) : null,
      orderSource: source,
      status: initialStatus,
      priceStatus: 'PENDING',
      priceAcceptedByCustomer: false,
      totalAmount,
      advancePayment,
      balanceAmount,
      paymentStatus,
      assignedTailorId: assignedTailorId ? parseInt(assignedTailorId) : null
    };

    if (garmentDetails) {
      orderData.garmentDetails = { create: buildGarmentData(garmentDetails) };
    }

    const newOrder = await prisma.order.create({
      data: orderData,
      include: {
        garmentDetails: true,
        payments: true
      }
    });

    // Link measurement record to order
    if (customerMeasurementRecord && newOrder) {
      await prisma.customerMeasurement.update({
        where: { id: customerMeasurementRecord.id },
        data: { orderId: newOrder.id }
      });
    }

    if (advancePayment > 0 || paymentDetails?.slipImage) {
      await prisma.payment.create({
        data: {
          orderId: newOrder.id,
          amount: advancePayment > 0 ? advancePayment : 0,
          paymentMethod: paymentDetails?.paymentMethod || 'Cash',
          transactionRef: paymentDetails?.transactionRef || null,
          slipImage: paymentDetails?.slipImage || null,
          notes: paymentDetails?.notes || (advancePayment > 0 ? 'Advance payment received at order creation' : 'Payment slip attached at order creation'),
          status: 'VERIFIED',
          recordedBy: req.user?.name || req.user?.email || 'Staff'
        }
      });
    }

    createdCustomerId = null; // Success, no rollback needed

    // Re-fetch order to include newly created payment record
    const completeOrder = await prisma.order.findUnique({
      where: { id: newOrder.id },
      include: {
        garmentDetails: true,
        branch: true,
        payments: { orderBy: { createdAt: 'asc' } },
        assignedTailor: { select: { id: true, name: true, email: true } }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Customer and order created successfully',
      customer,
      order: completeOrder || newOrder
    });

  } catch (error) {
    console.error('Error creating customer and order:', error);

    // Rollback: if we created a customer but order creation failed, clean up
    if (createdCustomerId) {
      try {
        await prisma.customer.delete({ where: { id: createdCustomerId } });
        console.log(`Rolled back customer id=${createdCustomerId}`);
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr.message);
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Server error creating customer and order.',
      error: error.message
    });
  }
};

// SEARCH CUSTOMERS
exports.searchCustomer = async (req, res, next) => {
  try {
    if (req.user?.role === 'CUSTOMER') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const roleUpper = (req.user?.role || '').toUpperCase();
    const isFullAccess = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(roleUpper);

    const { query } = req.query;

    const where = query && query.trim() ? {
      OR: [
        { primaryPhone: { contains: query.trim() } },
        { name: { contains: query.trim(), mode: 'insensitive' } },
        { email: { contains: query.trim(), mode: 'insensitive' } }
      ]
    } : {};

    const customers = await prisma.customer.findMany({
      where,
      take: 50,
      orderBy: { updatedAt: 'desc' },
      include: {
        ...(isFullAccess && {
          orders: { orderBy: { createdAt: 'desc' }, take: 10, include: { garmentDetails: true } },
          measurements: { orderBy: { createdAt: 'desc' }, take: 5 }
        })
      }
    });

    // If STAFF or TAILOR, return name and id only
    if (!isFullAccess) {
      const sanitized = customers.map(c => ({
        id: c.id,
        name: c.name
      }));
      return res.status(200).json({ success: true, customers: sanitized });
    }

    return res.status(200).json({ success: true, customers });
  } catch (error) {
    console.error('Error searching customers:', error);
    return res.status(500).json({ success: false, message: 'Server error searching customers.' });
  }
};

// UPDATE CUSTOMER PROFILE PHOTO
exports.updateCustomerPhoto = async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.id);
    const { profilePhoto } = req.body;

    if (isNaN(customerId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID.' });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    // Security check: Customer can only update their own photo
    if (req.user?.role === 'CUSTOMER' && customer.id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only update your own photo.' });
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { profilePhoto: profilePhoto || null }
    });

    return res.status(200).json({
      success: true,
      message: 'Customer profile photo updated successfully.',
      customer: updated
    });
  } catch (error) {
    console.error('Error updating customer photo:', error);
    return res.status(500).json({ success: false, message: 'Server error updating customer photo.' });
  }
};

// GET LATEST MEASUREMENT FOR A CUSTOMER (BY DRESS TYPE)
exports.getLatestCustomerMeasurement = async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.id);
    const { dressType } = req.query;

    if (isNaN(customerId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID.' });
    }

    // Security check: CEO, MANAGER, and STAFF (or customer viewing own)
    const roleUpper = (req.user?.role || '').toUpperCase();
    const isFullAccess = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'].includes(roleUpper);
    if (!isFullAccess && (req.user?.role !== 'CUSTOMER' || customerId !== req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Measurements are restricted to staff and managers.'
      });
    }

    const where = { customerId };
    if (dressType && dressType.trim()) {
      where.dressType = { equals: dressType.trim(), mode: 'insensitive' };
    }

    const latest = await prisma.customerMeasurement.findFirst({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      measurement: latest || null
    });
  } catch (error) {
    console.error('Error fetching latest customer measurement:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching measurement.' });
  }
};

// GET MEASUREMENT HISTORY FOR A CUSTOMER
exports.getCustomerMeasurements = async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.id);

    if (isNaN(customerId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID.' });
    }

    // Security check: CEO, MANAGER, and STAFF (or customer viewing own)
    const roleUpper = (req.user?.role || '').toUpperCase();
    const isFullAccess = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'].includes(roleUpper);
    if (!isFullAccess && (req.user?.role !== 'CUSTOMER' || customerId !== req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Measurements are restricted to staff and managers.'
      });
    }

    const measurements = await prisma.customerMeasurement.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return res.status(200).json({
      success: true,
      measurements
    });
  } catch (error) {
    console.error('Error fetching customer measurement history:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching measurements.' });
  }
};

// GET CUSTOMER BY ID WITH ORDERS TIMELINE
exports.getCustomerById = async (req, res, next) => {
  try {
    const customerId = parseInt(req.params.id);
    if (isNaN(customerId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID.' });
    }

    // RBAC: Only CEO & MANAGER have access to full customer profiles
    const roleUpper = (req.user?.role || '').toUpperCase();
    const isFullAccess = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(roleUpper);

    if (!isFullAccess) {
      if (req.user?.role === 'CUSTOMER' && customerId === req.user.id) {
        // Customer viewing own portal profile is ok
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Full customer profiles are restricted to CEO and Managers.'
        });
      }
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            garmentDetails: true,
            assignedTailor: {
              select: { id: true, name: true, email: true, role: true }
            },
            branch: {
              select: { id: true, name: true }
            },
            payments: {
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        measurements: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const primaryBranch = customer.orders?.[0]?.branch?.name || 'Main Branch';

    return res.status(200).json({
      success: true,
      customer: {
        ...customer,
        branch: primaryBranch
      }
    });
  } catch (error) {
    console.error('Error getting customer by ID:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving customer profile.' });
  }
};

// REGISTER CUSTOMER ONLY (No Order)
exports.registerCustomerOnly = async (req, res, next) => {
  try {
    const { name, primaryPhone, alternativePhone, email, password, address, profilePhoto } = req.body;

    // 1. Required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Full Name is required.' });
    }
    if (!primaryPhone || !primaryPhone.trim()) {
      return res.status(400).json({ success: false, message: 'Primary Phone Number is required.' });
    }

    // 2. Validate primary phone format
    const phoneValidation = validatePhoneNumber(primaryPhone);
    if (!phoneValidation.valid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.error || 'Please enter a valid primary phone number.'
      });
    }

    // Validate alternative phone if supplied
    if (alternativePhone && alternativePhone.trim()) {
      const altValidation = validatePhoneNumber(alternativePhone);
      if (!altValidation.valid) {
        return res.status(400).json({
          success: false,
          message: altValidation.error || 'Please enter a valid alternative phone number.'
        });
      }
    }

    // 3. Email is optional; validate if provided
    let cleanEmail = null;
    if (email && email.trim()) {
      cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      }
    }

    // 4. Password validation (optional if staff creates customer without portal access; required if setting portal password)
    let hashedPassword = null;
    if (password && password.trim()) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Portal Password must be at least 6 characters long.' });
      }
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // 5. Phone normalization
    const normalizedPhone = normalizePhoneNumber(primaryPhone) || primaryPhone.trim();
    const phoneVariants = getPhoneSearchVariants(primaryPhone);

    // 6. Check existing customer by phone variants OR email
    const duplicateChecks = [
      { primaryPhone: { in: phoneVariants } }
    ];
    if (cleanEmail) {
      duplicateChecks.push({ email: cleanEmail });
    }

    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: duplicateChecks
      }
    });

    let customerResult;
    if (existingCustomer) {
      // If customer exists and already has a portal password, check if it's duplicate
      if (existingCustomer.password && hashedPassword) {
        return res.status(409).json({
          success: false,
          message: 'A customer account with this phone number or email already has portal access. Please log in or use password reset.'
        });
      }

      // Pre-existing customer created during in-store order without password: link and activate portal
      const updateData = {
        name: name.trim() || existingCustomer.name,
        address: address !== undefined ? (address ? address.trim() : null) : existingCustomer.address,
        alternativePhone: alternativePhone !== undefined ? (alternativePhone ? alternativePhone.trim() : null) : existingCustomer.alternativePhone
      };
      if (cleanEmail && !existingCustomer.email) {
        updateData.email = cleanEmail;
      }
      if (profilePhoto && !existingCustomer.profilePhoto) {
        updateData.profilePhoto = profilePhoto;
      }
      if (hashedPassword && !existingCustomer.password) {
        updateData.password = hashedPassword;
      }

      customerResult = await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: updateData
      });
    } else {
      // Create new customer
      customerResult = await prisma.customer.create({
        data: {
          name: name.trim(),
          primaryPhone: normalizedPhone,
          alternativePhone: alternativePhone ? alternativePhone.trim() : null,
          email: cleanEmail,
          password: hashedPassword,
          address: address ? address.trim() : null,
          profilePhoto: profilePhoto || null
        }
      });
    }

    // 7. Sanitize response: NEVER return password hash
    const { password: _pwd, ...sanitizedCustomer } = customerResult;

    return res.status(201).json({
      success: true,
      message: hashedPassword
        ? 'Customer profile created and portal account activated successfully.'
        : 'Customer profile created successfully.',
      data: {
        customer: sanitizedCustomer
      }
    });

  } catch (err) {
    console.error('Register Customer Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error while registering customer.' });
  }
};

// GET MONTHLY TOP 3 CUSTOMER WINNERS & LEADERBOARD
exports.getMonthlyCustomerWinners = async (req, res, next) => {
  try {
    const roleUpper = (req.user?.role || '').toUpperCase();
    const isExecutiveOrManager = ['SUPER_ADMIN', 'ADMIN', 'CEO', 'MANAGER'].includes(roleUpper);

    if (!isExecutiveOrManager && req.user?.role !== 'STAFF') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Monthly winners are restricted to authorized personnel.'
      });
    }

    // Asia/Colombo timezone offset is UTC+5.5 (330 minutes)
    const now = new Date();
    const colomboOffsetMs = 5.5 * 60 * 60 * 1000;
    const colomboNow = new Date(now.getTime() + colomboOffsetMs);

    let year = req.query.year ? parseInt(req.query.year, 10) : colomboNow.getUTCFullYear();
    let month = req.query.month ? parseInt(req.query.month, 10) : colomboNow.getUTCMonth() + 1;

    if (isNaN(year) || year < 2020 || year > 2100) year = colomboNow.getUTCFullYear();
    if (isNaN(month) || month < 1 || month > 12) month = colomboNow.getUTCMonth() + 1;

    // Build ISO timestamps aligned with Asia/Colombo (+05:30)
    const monthPadded = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const lastDayPadded = String(lastDay).padStart(2, '0');

    const startIso = `${year}-${monthPadded}-01T00:00:00.000+05:30`;
    const endIso = `${year}-${monthPadded}-${lastDayPadded}T23:59:59.999+05:30`;

    const startDateUtc = new Date(startIso);
    const endDateUtc = new Date(endIso);

    // Branch isolation / filtering
    let targetBranchId = null;
    if (roleUpper === 'MANAGER' && req.user?.branchId) {
      targetBranchId = req.user.branchId;
    } else if (req.query.branchId && req.query.branchId !== 'ALL') {
      const parsedBranch = parseInt(req.query.branchId, 10);
      if (!isNaN(parsedBranch)) {
        targetBranchId = parsedBranch;
      }
    }

    // Exclude rejected, cancelled, and price declined orders
    const invalidStatuses = ['REJECTED', 'CANCELLED', 'PRICE_DECLINED'];

    // =========================================================================
    // 1. ORDERS RANKING DATASET
    // =========================================================================
    const orderWhere = {
      createdAt: { gte: startDateUtc, lte: endDateUtc },
      status: { notIn: invalidStatuses }
    };

    if (targetBranchId) {
      orderWhere.branchId = targetBranchId;
    }

    // Fetch valid orders for the target month
    const orders = await prisma.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            primaryPhone: true,
            alternativePhone: true,
            address: true,
            profilePhoto: true
          }
        },
        garmentDetails: {
          select: {
            dressType: true,
            specialDesignInstructions: true,
            fabricType: true,
            workDetails: true
          }
        },
        assignedTailor: {
          select: {
            id: true,
            name: true
          }
        },
        payments: {
          select: {
            amount: true,
            status: true
          }
        }
      }
    });

    // Aggregate by customer for Orders Ranking
    const ordersCustomerMap = new Map();

    for (const o of orders) {
      const custId = o.customerId;
      if (!ordersCustomerMap.has(custId)) {
        ordersCustomerMap.set(custId, {
          customerId: custId,
          customerName: o.customer?.name || 'Unknown Client',
          primaryPhone: o.customer?.primaryPhone || '',
          alternativePhone: o.customer?.alternativePhone || '',
          address: o.customer?.address || '',
          profilePhoto: o.customer?.profilePhoto || null,
          orderCount: 0,
          totalOrderValue: 0,
          totalPaid: 0,
          outstandingBalance: 0,
          orders: []
        });
      }

      const cData = ordersCustomerMap.get(custId);
      cData.orderCount += 1;

      const total = Number(o.totalAmount) || 0;
      const balance = Number(o.balanceAmount) || 0;
      const paid = Math.max(0, total - balance);

      cData.totalOrderValue += total;
      cData.totalPaid += paid;
      cData.outstandingBalance += balance;

      cData.orders.push({
        id: o.id,
        orderNumber: o.orderNumber || `ORD-${o.id}`,
        date: o.createdAt || o.orderDate,
        design: o.garmentDetails?.dressType || o.garmentDetails?.specialDesignInstructions || 'Custom Design',
        dressType: o.garmentDetails?.dressType || 'Custom Dress',
        status: o.status,
        assignedTailor: o.assignedTailor,
        totalAmount: total,
        paidAmount: paid,
        balanceAmount: balance
      });
    }

    // Rank customers: primary by orderCount DESC, tie-breaker by totalOrderValue DESC
    const ordersRanked = Array.from(ordersCustomerMap.values()).sort((a, b) => {
      if (b.orderCount !== a.orderCount) {
        return b.orderCount - a.orderCount;
      }
      return b.totalOrderValue - a.totalOrderValue;
    });

    const medals = ['GOLD', 'SILVER', 'BRONZE'];
    const ordersLeaderboard = ordersRanked.map((c, idx) => ({
      rank: idx + 1,
      medal: idx < 3 ? medals[idx] : null,
      ...c
    }));

    const ordersTopThree = ordersLeaderboard.slice(0, 3);

    const ordersSummary = {
      totalValidOrders: orders.length,
      totalCustomers: ordersLeaderboard.length,
      totalOrderValue: ordersLeaderboard.reduce((acc, c) => acc + c.totalOrderValue, 0),
      totalPaid: ordersLeaderboard.reduce((acc, c) => acc + c.totalPaid, 0),
      totalOutstanding: ordersLeaderboard.reduce((acc, c) => acc + c.outstandingBalance, 0)
    };

    // =========================================================================
    // 2. PAYMENTS RANKING DATASET (Only VERIFIED payments in the month)
    // =========================================================================
    const paymentWhere = {
      createdAt: { gte: startDateUtc, lte: endDateUtc },
      status: 'VERIFIED',
      order: {
        status: { notIn: invalidStatuses },
        ...(targetBranchId ? { branchId: targetBranchId } : {})
      }
    };

    const verifiedPayments = await prisma.payment.findMany({
      where: paymentWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                primaryPhone: true,
                alternativePhone: true,
                address: true,
                profilePhoto: true
              }
            },
            garmentDetails: {
              select: {
                dressType: true,
                specialDesignInstructions: true,
                fabricType: true,
                workDetails: true
              }
            },
            assignedTailor: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    // Aggregate by customer for Payments Ranking
    const paymentsCustomerMap = new Map();

    for (const p of verifiedPayments) {
      const o = p.order;
      const c = o?.customer;
      if (!c) continue;
      const custId = c.id;

      if (!paymentsCustomerMap.has(custId)) {
        paymentsCustomerMap.set(custId, {
          customerId: custId,
          customerName: c.name || 'Unknown Client',
          primaryPhone: c.primaryPhone || '',
          alternativePhone: c.alternativePhone || '',
          address: c.address || '',
          profilePhoto: c.profilePhoto || null,
          totalVerifiedPayments: 0,
          paymentCount: 0,
          uniqueOrderIds: new Set(),
          ordersMap: new Map(),
          payments: []
        });
      }

      const cData = paymentsCustomerMap.get(custId);
      const amount = Number(p.amount) || 0;
      cData.totalVerifiedPayments += amount;
      cData.paymentCount += 1;
      cData.uniqueOrderIds.add(o.id);

      if (!cData.ordersMap.has(o.id)) {
        const total = Number(o.totalAmount) || 0;
        const balance = Number(o.balanceAmount) || 0;
        const paid = Math.max(0, total - balance);
        cData.ordersMap.set(o.id, {
          id: o.id,
          orderNumber: o.orderNumber || `ORD-${o.id}`,
          date: o.createdAt || o.orderDate,
          design: o.garmentDetails?.dressType || o.garmentDetails?.specialDesignInstructions || 'Custom Design',
          dressType: o.garmentDetails?.dressType || 'Custom Dress',
          status: o.status,
          assignedTailor: o.assignedTailor,
          totalAmount: total,
          paidAmount: paid,
          balanceAmount: balance,
          monthlyVerifiedPayments: 0
        });
      }

      cData.ordersMap.get(o.id).monthlyVerifiedPayments += amount;

      cData.payments.push({
        id: p.id,
        amount,
        paymentMethod: p.paymentMethod || 'Cash',
        createdAt: p.createdAt,
        orderId: o.id,
        orderNumber: o.orderNumber || `ORD-${o.id}`,
        notes: p.notes,
        transactionRef: p.transactionRef
      });
    }

    // Rank customers: primary by totalVerifiedPayments DESC, tie-breaker by uniqueOrderCount DESC
    const paymentsRanked = Array.from(paymentsCustomerMap.values()).map(c => {
      const ordersList = Array.from(c.ordersMap.values());
      const totalOrderValue = ordersList.reduce((sum, ord) => sum + ord.totalAmount, 0);
      const outstandingBalance = ordersList.reduce((sum, ord) => sum + ord.balanceAmount, 0);
      return {
        customerId: c.customerId,
        customerName: c.customerName,
        primaryPhone: c.primaryPhone,
        alternativePhone: c.alternativePhone,
        address: c.address,
        profilePhoto: c.profilePhoto,
        totalVerifiedPayments: c.totalVerifiedPayments,
        paymentCount: c.paymentCount,
        uniqueOrderCount: c.uniqueOrderIds.size,
        orderCount: c.uniqueOrderIds.size, // for compatibility with order modal view
        totalPaid: c.totalVerifiedPayments, // for modal display consistency
        totalOrderValue,
        outstandingBalance,
        orders: ordersList,
        payments: c.payments
      };
    }).sort((a, b) => {
      if (b.totalVerifiedPayments !== a.totalVerifiedPayments) {
        return b.totalVerifiedPayments - a.totalVerifiedPayments;
      }
      return b.uniqueOrderCount - a.uniqueOrderCount;
    });

    const paymentsLeaderboard = paymentsRanked.map((c, idx) => ({
      rank: idx + 1,
      medal: idx < 3 ? medals[idx] : null,
      ...c
    }));

    const paymentsTopThree = paymentsLeaderboard.slice(0, 3);

    const paymentsSummary = {
      totalVerifiedPayments: paymentsLeaderboard.reduce((acc, c) => acc + c.totalVerifiedPayments, 0),
      totalPaymentTransactions: verifiedPayments.length,
      totalCustomers: paymentsLeaderboard.length,
      uniqueOrdersPaid: new Set(verifiedPayments.map(p => p.orderId)).size,
      totalOrderValue: paymentsLeaderboard.reduce((acc, c) => acc + c.totalOrderValue, 0),
      totalOutstanding: paymentsLeaderboard.reduce((acc, c) => acc + c.outstandingBalance, 0)
    };

    // =========================================================================
    // 3. AVAILABLE MONTHS FROM VALID ORDERS & VERIFIED PAYMENTS
    // =========================================================================
    const allValidOrders = await prisma.order.findMany({
      where: {
        status: { notIn: invalidStatuses },
        ...(targetBranchId ? { branchId: targetBranchId } : {})
      },
      select: { createdAt: true }
    });

    const allVerifiedPayments = await prisma.payment.findMany({
      where: {
        status: 'VERIFIED',
        order: {
          status: { notIn: invalidStatuses },
          ...(targetBranchId ? { branchId: targetBranchId } : {})
        }
      },
      select: { createdAt: true }
    });

    const monthsMap = new Map();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    for (const o of allValidOrders) {
      const d = new Date(o.createdAt.getTime() + colomboOffsetMs);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (!monthsMap.has(key)) {
        monthsMap.set(key, {
          year: y,
          month: m,
          label: `${monthNames[m - 1]} ${y}`,
          orderCount: 0,
          paymentCount: 0
        });
      }
      monthsMap.get(key).orderCount += 1;
    }

    for (const p of allVerifiedPayments) {
      const d = new Date(p.createdAt.getTime() + colomboOffsetMs);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (!monthsMap.has(key)) {
        monthsMap.set(key, {
          year: y,
          month: m,
          label: `${monthNames[m - 1]} ${y}`,
          orderCount: 0,
          paymentCount: 0
        });
      }
      monthsMap.get(key).paymentCount += 1;
    }

    // Ensure currently requested month is present in the list even if 0 records
    const currentKey = `${year}-${String(month).padStart(2, '0')}`;
    if (!monthsMap.has(currentKey)) {
      monthsMap.set(currentKey, {
        year,
        month,
        label: `${monthNames[month - 1]} ${year}`,
        orderCount: orders.length,
        paymentCount: verifiedPayments.length
      });
    }

    const availableMonths = Array.from(monthsMap.values()).sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.month - a.month;
    });

    return res.status(200).json({
      success: true,
      year,
      month,
      monthName: `${monthNames[month - 1]} ${year}`,
      branchId: targetBranchId || 'ALL',
      availableMonths,
      ordersRanking: {
        summary: ordersSummary,
        topThree: ordersTopThree,
        leaderboard: ordersLeaderboard
      },
      paymentsRanking: {
        summary: paymentsSummary,
        topThree: paymentsTopThree,
        leaderboard: paymentsLeaderboard
      },
      // Backward compatibility fields
      summary: ordersSummary,
      topThree: ordersTopThree,
      leaderboard: ordersLeaderboard
    });
  } catch (error) {
    console.error('Error calculating monthly customer winners:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error calculating monthly customer winners.'
    });
  }
};
