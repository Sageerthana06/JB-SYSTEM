const { prisma } = require('../prisma');
const { validateDressMeasurements } = require('../utils/measurementValidation');

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

const bcrypt = require('bcrypt');

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
      const existing = await prisma.customer.findUnique({
        where: { primaryPhone: primaryContact.trim() }
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'A customer with this phone number already exists. Please use Returning Customer.'
        });
      }

      customer = await prisma.customer.create({
        data: {
          name: customerName.trim(),
          primaryPhone: primaryContact.trim(),
          alternativePhone: alternativeContact ? alternativeContact.trim() : null,
          address: address ? address.trim() : null,
          profilePhoto: profilePhoto || null
        }
      });
      createdCustomerId = customer.id;

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

      // If returning customer provided or replaced their profile photo, update it in DB
      if (profilePhoto && customer) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { profilePhoto }
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
        { name: { contains: query.trim(), mode: 'insensitive' } }
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
    const { name, primaryPhone, alternativePhone, email, password, address } = req.body;

    if (!name || !primaryPhone || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, Primary Phone, Email and Password are required' });
    }

    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { primaryPhone: primaryPhone },
          { email: email }
        ]
      }
    });

    if (existingCustomer) {
      return res.status(409).json({ success: false, message: 'Customer with this Phone or Email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newCustomer = await prisma.customer.create({
      data: {
        name,
        primaryPhone,
        alternativePhone: alternativePhone || null,
        email: email || null,
        password: hashedPassword,
        address: address || null
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully. They can now login to the Customer Portal.',
      data: {
        customer: newCustomer
      }
    });

  } catch (err) {
    console.error('Register Customer Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error while registering customer.' });
  }
};
