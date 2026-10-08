const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// In-memory OTP store (identifier -> { otp, expiresAt })
const otpStore = new Map();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Helper to generate the exact existing ERP order number (e.g., ORD-2026-0001)
const generateOrderNumber = async () => {
  const currentYear = new Date().getFullYear();
  const prefix = `ORD-${currentYear}-`;

  const lastOrder = await prisma.order.findFirst({
    where: {
      orderNumber: { startsWith: prefix }
    },
    orderBy: {
      orderNumber: 'desc'
    }
  });

  if (!lastOrder) {
    return `${prefix}0001`;
  }

  const lastNumberStr = lastOrder.orderNumber.split('-')[2];
  const nextNumber = parseInt(lastNumberStr, 10) + 1;
  const nextNumberStr = nextNumber.toString().padStart(4, '0');

  return `${prefix}${nextNumberStr}`;
};

/**
 * 1. Customer Registration
 */
exports.register = async (req, res, next) => {
  try {
    const { name, primaryPhone, email, password, address } = req.body;

    if (!name || !primaryPhone || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, WhatsApp / Primary Contact, Email, and Password are required.'
      });
    }

    const cleanPhone = primaryPhone.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // Phone validation
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid phone number (7-15 digits).'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Check if customer already exists by phone or email
    const existing = await prisma.customer.findFirst({
      where: {
        OR: [
          { primaryPhone: cleanPhone },
          { email: cleanEmail }
        ]
      }
    });

    const hashedPassword = await bcrypt.hash(password, 10);

    let customer;

    if (existing) {
      // If customer exists and already has a password, prompt to login
      if (existing.password) {
        return res.status(409).json({
          success: false,
          message: 'An account with this phone number or email already exists. Please log in.'
        });
      }

      // Pre-existing customer created by staff in ERP: activate portal account
      customer = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: cleanName || existing.name,
          email: cleanEmail,
          password: hashedPassword,
          address: address ? address.trim() : existing.address
        }
      });
    } else {
      // Create new customer
      customer = await prisma.customer.create({
        data: {
          name: cleanName,
          primaryPhone: cleanPhone,
          email: cleanEmail,
          password: hashedPassword,
          address: address ? address.trim() : null
        }
      });
    }

    // Issue JWT token
    const token = jwt.sign(
      {
        id: customer.id,
        customerId: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.primaryPhone,
        role: 'CUSTOMER'
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      data: {
        token,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          primaryPhone: customer.primaryPhone,
          address: customer.address
        }
      }
    });

  } catch (error) {
    console.error('Customer registration error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration.', error: error.message });
  }
};

/**
 * 2. Customer Login
 */
exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email / Phone and Password are required.'
      });
    }

    const cleanIdentifier = identifier.trim();

    // Look up by email or phone
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: cleanIdentifier.toLowerCase() },
          { primaryPhone: cleanIdentifier }
        ]
      }
    });

    if (!customer || !customer.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email/phone or password.'
      });
    }

    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email/phone or password.'
      });
    }

    const token = jwt.sign(
      {
        id: customer.id,
        customerId: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.primaryPhone,
        role: 'CUSTOMER'
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          primaryPhone: customer.primaryPhone,
          alternativePhone: customer.alternativePhone,
          address: customer.address
        }
      }
    });

  } catch (error) {
    console.error('Customer login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.', error: error.message });
  }
};

/**
 * 3. Get Current Customer Profile
 */
exports.getProfile = async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        primaryPhone: true,
        alternativePhone: true,
        email: true,
        address: true,
        profilePhoto: true,
        createdAt: true
      }
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    return res.status(200).json({ success: true, customer });
  } catch (error) {
    console.error('Customer getProfile error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving profile.' });
  }
};

/**
 * 4. Update Customer Profile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, alternativePhone, address, email, profilePhoto } = req.body;

    const dataToUpdate = {};
    if (name && name.trim()) dataToUpdate.name = name.trim();
    if (alternativePhone !== undefined) dataToUpdate.alternativePhone = alternativePhone ? alternativePhone.trim() : null;
    if (address !== undefined) dataToUpdate.address = address ? address.trim() : null;

    // Check if a file was uploaded via multipart/form-data middleware
    const uploadedFile = (req.files && req.files.length > 0) ? req.files[0] : req.file;
    if (uploadedFile) {
      dataToUpdate.profilePhoto = `/uploads/designs/${uploadedFile.filename}`;
    } else if (profilePhoto !== undefined) {
      dataToUpdate.profilePhoto = profilePhoto || null;
    }

    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      // Check if email already taken by someone else
      const existing = await prisma.customer.findFirst({
        where: {
          email: cleanEmail,
          id: { not: req.user.id }
        }
      });
      if (existing) {
        return res.status(409).json({ success: false, message: 'This email is already in use by another account.' });
      }
      dataToUpdate.email = cleanEmail;
    }

    const updated = await prisma.customer.update({
      where: { id: req.user.id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        primaryPhone: true,
        alternativePhone: true,
        email: true,
        address: true,
        profilePhoto: true,
        createdAt: true
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      customer: updated
    });
  } catch (error) {
    console.error('Customer updateProfile error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating profile.' });
  }
};

/**
 * 5. Forgot Password - Send OTP
 */
exports.sendOtp = async (req, res, next) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Email / Phone is required.'
      });
    }

    const cleanIdentifier = identifier.trim();

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: cleanIdentifier.toLowerCase() },
          { primaryPhone: cleanIdentifier }
        ]
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email or phone number.'
      });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(cleanIdentifier.toLowerCase(), { otp, expiresAt });

    // Setup Nodemailer transporter (requires EMAIL_USER and EMAIL_PASS in .env)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    try {
      // Send the OTP email
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: cleanIdentifier.toLowerCase(),
        subject: 'Bella Design - Password Reset OTP',
        text: `Your OTP for password reset is: ${otp}\n\nThis OTP is valid for 10 minutes.`
      });
      console.log(`[OTP] Sent OTP to ${cleanIdentifier} via Email`);
      
      return res.status(200).json({
        success: true,
        message: `OTP sent successfully to ${cleanIdentifier}`
      });
    } catch (mailErr) {
      console.error('Failed to send email:', mailErr);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send OTP email. Please check server email configuration.' 
      });
    }

  } catch (error) {
    console.error('Customer sendOtp error:', error);
    return res.status(500).json({ success: false, message: 'Server error sending OTP.' });
  }
};

/**
 * 6. Forgot Password - Verify OTP & Set New Password
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { identifier, otp, newPassword } = req.body;

    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email / Phone, OTP, and New Password are required.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.'
      });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    // Verify OTP
    const storedOtpData = otpStore.get(cleanIdentifier);
    if (!storedOtpData || storedOtpData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP.'
      });
    }

    if (Date.now() > storedOtpData.expiresAt) {
      otpStore.delete(cleanIdentifier);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: cleanIdentifier },
          { primaryPhone: cleanIdentifier }
        ]
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email or phone number.'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.customer.update({
      where: { id: customer.id },
      data: { password: hashedPassword }
    });

    // Clear OTP after successful reset
    otpStore.delete(cleanIdentifier);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    });

  } catch (error) {
    console.error('Customer forgotPassword error:', error);
    return res.status(500).json({ success: false, message: 'Server error resetting password.' });
  }
};

/**
 * 6. Get My Orders (strictly customer's own orders)
 */
exports.getMyOrders = async (req, res, next) => {
  try {
    const customerId = req.user.id;

    const orders = await prisma.order.findMany({
      where: { customerId },
      orderBy: { orderDate: 'desc' },
      include: {
        garmentDetails: true,
        branch: {
          select: { id: true, name: true, phone: true, address: true }
        },
        payments: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('Customer getMyOrders error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving orders.' });
  }
};

/**
 * 7. Get My Order Details By ID (strictly verifies ownership)
 */
exports.getMyOrderById = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const orderId = parseInt(req.params.id);

    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        customerId
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            primaryPhone: true,
            alternativePhone: true,
            email: true,
            address: true
          }
        },
        garmentDetails: true,
        branch: true,
        payments: {
          orderBy: { createdAt: 'asc' }
        },
        productionHistory: {
          orderBy: { startedAt: 'asc' }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or you do not have permission to view it.'
      });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('Customer getMyOrderById error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving order details.' });
  }
};

/**
 * 8. Create Customer Order (With Tailoring Measurements & Customer Updates)
 */
exports.createCustomerOrder = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const { garmentDetails, branchId, customerDetails } = req.body;

    if (!garmentDetails || !garmentDetails.dressType) {
      return res.status(400).json({
        success: false,
        message: 'Dress Type is required.'
      });
    }

    const quantity = parseInt(garmentDetails.quantity) || 1;
    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1.'
      });
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer account not found.' });
    }

    // Update customer details if provided in checkout
    if (customerDetails) {
      const updateData = {};
      if (customerDetails.name && customerDetails.name.trim()) updateData.name = customerDetails.name.trim();
      if (customerDetails.alternativePhone !== undefined) updateData.alternativePhone = customerDetails.alternativePhone ? customerDetails.alternativePhone.trim() : null;
      if (customerDetails.address !== undefined) updateData.address = customerDetails.address ? customerDetails.address.trim() : null;
      if (customerDetails.profilePhoto) updateData.profilePhoto = customerDetails.profilePhoto;
      
      if (Object.keys(updateData).length > 0) {
        await prisma.customer.update({
          where: { id: customerId },
          data: updateData
        });
      }
    }

    // Validate measurements if provided (ensure all numeric values are non-negative)
    if (garmentDetails.measurements && typeof garmentDetails.measurements === 'object') {
      for (const [key, val] of Object.entries(garmentDetails.measurements)) {
        if (val !== null && val !== undefined && val !== '') {
          const num = Number(val);
          if (!isNaN(num) && num < 0) {
            return res.status(400).json({
              success: false,
              message: `Measurement for ${key} cannot be negative.`
            });
          }
        }
      }
    }

    // Save Customer Measurement record in history
    let customerMeasurementRecord = null;
    if (garmentDetails.measurements && Object.keys(garmentDetails.measurements).length > 0) {
      customerMeasurementRecord = await prisma.customerMeasurement.create({
        data: {
          customerId,
          dressType: garmentDetails.dressType,
          measurementUnit: garmentDetails.measurementUnit || 'Inches',
          fitPreference: garmentDetails.fitPreference || 'Regular',
          takenBy: garmentDetails.takenBy || 'Customer',
          measurementDate: garmentDetails.measurementDate ? new Date(garmentDetails.measurementDate) : new Date(),
          measurements: garmentDetails.measurements,
          fittingInstructions: garmentDetails.fittingInstructions || garmentDetails.specialDesignInstructions || null
        }
      });
    }

    // Generate unique order number (e.g., ORD-2026-0001)
    const orderNumber = await generateOrderNumber();

    // Default to first active branch if not specified
    let targetBranchId = branchId ? parseInt(branchId) : null;
    if (!targetBranchId) {
      const defaultBranch = await prisma.branch.findFirst({
        where: { status: 'ACTIVE' }
      });
      if (defaultBranch) {
        targetBranchId = defaultBranch.id;
      }
    }

    // Construct order data
    const orderData = {
      orderNumber,
      customerId,
      branchId: targetBranchId,
      orderSource: 'ONLINE',
      status: 'PENDING_APPROVAL', // Starts in PENDING_APPROVAL for CEO / Manager review
      priceStatus: 'PENDING',
      priceAcceptedByCustomer: false,
      totalAmount: 0,
      advancePayment: 0,
      balanceAmount: 0,
      serviceCharge: 0,
      additionalWorkCharge: 0,
      materialCharge: 0,
      discountAmount: 0,
      garmentDetails: {
        create: {
          dressType: garmentDetails.dressType,
          quantity: quantity,
          occasion: garmentDetails.occasion || null,
          fabricSuppliedBy: garmentDetails.fabricSuppliedBy || null,
          fabricType: garmentDetails.fabricType || null,
          fabricColour: garmentDetails.fabricColour || null,
          liningRequired: garmentDetails.liningRequired === 'Yes' || garmentDetails.liningRequired === true,
          paddingCupRequired: garmentDetails.paddingCupRequired === 'Yes' || garmentDetails.paddingCupRequired === true,
          workRequired: garmentDetails.workRequired === 'Yes' || garmentDetails.workRequired === true,
          workDetails: garmentDetails.workDetails || null,
          accessoriesSupplied: garmentDetails.accessoriesSupplied || null,
          specialDesignInstructions: garmentDetails.specialDesignInstructions || null,
          designReferenceImage: garmentDetails.designReferenceImage || null,
          measurements: garmentDetails.measurements || null,
          measurementUnit: garmentDetails.measurementUnit || 'Inches',
          fitPreference: garmentDetails.fitPreference || 'Regular',
          additionalImages: garmentDetails.additionalImages || null,
          customerMeasurementId: customerMeasurementRecord ? customerMeasurementRecord.id : null
        }
      }
    };

    const newOrder = await prisma.order.create({
      data: orderData,
      include: {
        garmentDetails: true,
        branch: true
      }
    });

    // Link measurement record to order
    if (customerMeasurementRecord && newOrder) {
      await prisma.customerMeasurement.update({
        where: { id: customerMeasurementRecord.id },
        data: { orderId: newOrder.id }
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Your order has been submitted successfully! Waiting for CEO / Manager approval.',
      order: newOrder
    });

  } catch (error) {
    console.error('Customer createCustomerOrder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error submitting order.',
      error: error.message
    });
  }
};

/**
 * 9. Get Latest Compatible Measurement for a Dress Type
 */
exports.getLatestMeasurement = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const { dressType } = req.query;

    if (!dressType) {
      return res.status(400).json({ success: false, message: 'dressType parameter is required.' });
    }

    const latest = await prisma.customerMeasurement.findFirst({
      where: {
        customerId,
        dressType: { equals: dressType, mode: 'insensitive' }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      measurement: latest || null
    });
  } catch (error) {
    console.error('getLatestMeasurement error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve measurements.' });
  }
};

/**
 * 10. Get Customer Measurement History
 */
exports.getMeasurementHistory = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const measurements = await prisma.customerMeasurement.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      measurements
    });
  } catch (error) {
    console.error('getMeasurementHistory error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve measurement history.' });
  }
};

/**
 * 9. Customer Accepts Price Quote & Confirms Order
 */
exports.acceptPrice = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const orderId = parseInt(req.params.id);

    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.priceStatus !== 'SENT') {
      return res.status(400).json({
        success: false,
        message: 'No pending price quote to accept for this order.'
      });
    }

    const now = new Date();
    const quotedTotal = Number(order.totalAmount || 0);
    const quotedAdvance = Number(order.advanceRequired || 0);
    const quotedBalance = Math.max(0, quotedTotal - quotedAdvance);
    const currentPaid = Number(order.advancePayment || 0);
    const currentBalance = Math.max(0, quotedTotal - currentPaid);
    const paymentStatus = currentPaid <= 0 ? 'Unpaid' : (currentBalance <= 0 && quotedTotal > 0 ? 'Paid' : 'Partially Paid');

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        priceAcceptedByCustomer: true,
        priceAcceptedAt: now,
        agreedTotal: quotedTotal,
        agreedAdvance: quotedAdvance,
        agreedBalance: quotedBalance,
        priceStatus: 'ACCEPTED',
        status: 'ORDER_CONFIRMED',
        balanceAmount: currentBalance,
        paymentStatus
      },
      include: {
        garmentDetails: true,
        branch: true,
        payments: { orderBy: { createdAt: 'asc' } }
      }
    });

    await prisma.productionHistory.create({
      data: {
        orderId,
        stage: 'ORDER_CONFIRMED',
        previousStage: order.status,
        notes: `Customer accepted price quote: Total LKR ${quotedTotal.toLocaleString()} (Agreed Advance: LKR ${quotedAdvance.toLocaleString()}). Order confirmed.`
      }
    });

    res.status(200).json({
      success: true,
      message: 'Price accepted! Your order is now confirmed and will be assigned to a master tailor.',
      order: updated
    });
  } catch (error) {
    console.error('Error accepting price in customer portal:', error);
    res.status(500).json({ success: false, message: 'Server error accepting price quote.' });
  }
};

/**
 * 10. Customer Declines Price Quote
 */
exports.declinePrice = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const orderId = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.priceStatus !== 'SENT') {
      return res.status(400).json({
        success: false,
        message: 'No pending price quote to decline for this order.'
      });
    }

    const now = new Date();
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        priceAcceptedByCustomer: false,
        priceStatus: 'DECLINED',
        priceDeclinedAt: now,
        priceDeclineReason: reason ? reason.trim() : null,
        status: 'PRICE_DECLINED'
      },
      include: {
        garmentDetails: true,
        branch: true
      }
    });

    await prisma.productionHistory.create({
      data: {
        orderId,
        stage: 'PRICE_DECLINED',
        previousStage: order.status,
        notes: `Customer declined price quote. Reason: ${reason ? reason.trim() : 'Not specified'}.`
      }
    });

    res.status(200).json({
      success: true,
      message: 'Price quote declined. Our management team will review and send an updated quotation.',
      order: updated
    });
  } catch (error) {
    console.error('Error declining price in customer portal:', error);
    res.status(500).json({ success: false, message: 'Server error declining price quote.' });
  }
};

/**
 * 11. Customer Uploads Payment Slip (Bank Transfer / Deposit Receipt)
 */
exports.uploadPaymentSlip = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const orderId = parseInt(req.params.id);
    const { amount, paymentMethod, transactionRef, notes, slipImage: bodySlipImage } = req.body;

    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: { customer: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    }

    // Determine uploaded slip image URL
    let slipImage = bodySlipImage || null;
    const uploadedFile = (req.files && req.files.length > 0) ? req.files[0] : req.file;
    if (uploadedFile) {
      slipImage = `/uploads/designs/${uploadedFile.filename}`;
    }

    if (!slipImage) {
      return res.status(400).json({ success: false, message: 'Payment slip photo / receipt image is required.' });
    }

    // Create payment in PENDING_VERIFICATION status
    const customerName = order.customer?.name || req.user.name || 'Customer';
    const method = paymentMethod || 'Bank Transfer';

    const newPayment = await prisma.payment.create({
      data: {
        orderId,
        amount: paymentAmount,
        paymentMethod: method,
        slipImage,
        status: 'PENDING_VERIFICATION',
        transactionRef: transactionRef ? transactionRef.trim() : null,
        notes: notes ? notes.trim() : `Customer deposit slip uploaded for ${method}`,
        recordedBy: `Customer (${customerName})`
      }
    });

    // Record production history activity log
    await prisma.productionHistory.create({
      data: {
        orderId,
        stage: order.status,
        notes: `Customer uploaded ${method} payment slip for LKR ${paymentAmount.toLocaleString()} (Ref: ${transactionRef || 'N/A'}). Awaiting manager verification.`
      }
    });

    // Return updated order with payments
    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        garmentDetails: true,
        branch: true,
        payments: { orderBy: { createdAt: 'desc' } },
        productionHistory: { orderBy: { startedAt: 'asc' } }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Payment slip submitted successfully! Manager will verify and confirm your payment shortly.',
      payment: newPayment,
      order: updatedOrder
    });

  } catch (error) {
    console.error('Error uploading payment slip in customer portal:', error);
    res.status(500).json({ success: false, message: 'Server error uploading payment slip.', error: error.message });
  }
};

