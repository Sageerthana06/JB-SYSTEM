const { prisma, pool } = require('../prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const {
  cleanPhoneRaw,
  normalizePhoneNumber,
  getPhoneSearchVariants,
  validatePhoneNumber
} = require('../utils/phoneUtils');
const {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit
} = require('../utils/rateLimiter');

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

    if (!name || !name.trim() || !primaryPhone || !primaryPhone.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Phone Number, and Password are required.'
      });
    }

    const cleanPhone = primaryPhone.trim();
    const cleanName = name.trim();

    // Phone validation
    const phoneValidation = validatePhoneNumber(cleanPhone);
    if (!phoneValidation.valid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.error || 'Please enter a valid phone number.'
      });
    }

    // Email validation (optional)
    let cleanEmail = null;
    if (email && email.trim()) {
      cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      }
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const normalizedPhone = normalizePhoneNumber(cleanPhone) || cleanPhone;
    const phoneVariants = getPhoneSearchVariants(cleanPhone);

    // Check if customer already exists by phone variants OR email
    const duplicateChecks = [
      { primaryPhone: { in: phoneVariants } }
    ];
    if (cleanEmail) {
      duplicateChecks.push({ email: cleanEmail });
    }

    const existing = await prisma.customer.findFirst({
      where: {
        OR: duplicateChecks
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
          email: cleanEmail || existing.email,
          password: hashedPassword,
          address: address ? address.trim() : existing.address
        }
      });
    } else {
      // Create new customer
      customer = await prisma.customer.create({
        data: {
          name: cleanName,
          primaryPhone: normalizedPhone,
          email: cleanEmail,
          password: hashedPassword,
          address: address ? address.trim() : null
        }
      });
    }

    // Issue JWT token with role 'CUSTOMER'
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
        message: 'Phone number or email, and password are required.'
      });
    }

    const cleanIdentifier = identifier.trim();
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown-ip';
    const rateLimitKey = `cust_login:${clientIp}:${cleanIdentifier.toLowerCase()}`;

    // Rate limiting: 5 failed attempts per 15 minutes window
    const rateStatus = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
    if (rateStatus.isBlocked) {
      return res.status(429).json({
        success: false,
        message: `Too many failed login attempts. Please try again in ${rateStatus.retryAfterSeconds} seconds.`
      });
    }

    // Phone search variants
    const phoneVariants = getPhoneSearchVariants(cleanIdentifier);
    const searchConditions = [
      { email: cleanIdentifier.toLowerCase() }
    ];
    if (phoneVariants.length > 0) {
      searchConditions.push({ primaryPhone: { in: phoneVariants } });
    } else {
      searchConditions.push({ primaryPhone: cleanIdentifier });
    }

    // Look up customer
    const customer = await prisma.customer.findFirst({
      where: {
        OR: searchConditions
      }
    });

    if (!customer || !customer.password) {
      recordFailedAttempt(rateLimitKey);
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number / email or password.'
      });
    }

    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) {
      recordFailedAttempt(rateLimitKey);
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number / email or password.'
      });
    }

    // Successful login: reset failed attempts
    resetRateLimit(rateLimitKey);

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
          address: customer.address,
          profilePhoto: customer.profilePhoto
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

    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ success: false, message: 'Email or phone number is required.' });
    }

    const rawId = identifier.trim();
    const phoneVariants = getPhoneSearchVariants(rawId);
    const searchConditions = [{ email: rawId.toLowerCase() }];
    if (phoneVariants.length > 0) {
      searchConditions.push({ primaryPhone: { in: phoneVariants } });
    }

    // Look up customer
    const customer = await prisma.customer.findFirst({
      where: { OR: searchConditions }
    });

    // Rate limit check using CustomerOtp
    const otpKey = customer?.email ? customer.email.toLowerCase() : rawId.toLowerCase();
    const existingOtp = await prisma.customerOtp.findUnique({
      where: { identifier: otpKey }
    });

    if (existingOtp) {
      const timeSinceLastSent = Date.now() - new Date(existingOtp.lastSentAt).getTime();
      if (timeSinceLastSent < 60000) { // 60 seconds cooldown
        return res.status(429).json({ success: false, message: 'Please wait 60 seconds before requesting another OTP.' });
      }
    }

    // If customer doesn't exist, simulate fake delay to prevent enumeration
    if (!customer) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 500));
      return res.status(200).json({
        success: true,
        message: 'If a matching account with email recovery exists, an OTP has been sent.'
      });
    }

    // Check if customer has an email address
    if (customer.email) {
      const otp = crypto.randomInt(100000, 999999).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      const otpHash = await bcrypt.hash(otp, 10);

      await prisma.customerOtp.upsert({
        where: { identifier: customer.email.toLowerCase() },
        update: {
          otpHash,
          attempts: 0,
          lastSentAt: new Date(),
          expiresAt
        },
        create: {
          identifier: customer.email.toLowerCase(),
          otpHash,
          expiresAt
        }
      });

      // Brevo SMTP configuration
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
        port: process.env.SMTP_PORT || 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: customer.email,
          subject: 'Bella Design - Password Reset OTP',
          text: `Your OTP for password reset is: ${otp}\n\nThis OTP is valid for 5 minutes. Do not share this with anyone.`
        });

        // Mask email for response (e.g. j***n@example.com)
        const parts = customer.email.split('@');
        const masked = parts[0].length > 2
          ? `${parts[0][0]}***${parts[0].slice(-1)}@${parts[1]}`
          : `${parts[0][0]}***@${parts[1]}`;

        return res.status(200).json({
          success: true,
          message: `Password reset OTP has been sent to your registered email (${masked}).`,
          destination: 'email',
          maskedEmail: masked
        });
      } catch (mailErr) {
        console.error('SMTP Delivery Error:', mailErr.message);
        return res.status(500).json({ success: false, message: 'Error sending email. Please try again later.' });
      }
    } else {
      // Customer has NO email registered
      const hasSmsConfig = Boolean(process.env.SMS_API_KEY || process.env.SMS_GATEWAY_URL || process.env.TWILIO_ACCOUNT_SID);
      if (!hasSmsConfig) {
        return res.status(400).json({
          success: false,
          requiresStaffAssistance: true,
          message: 'This account does not have a registered email address, and SMS OTP recovery is not currently configured on the system. Please visit Bella Design or contact our store staff to reset or update your portal account.'
        });
      }
    }

  } catch (error) {
    console.error('Customer sendOtp error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing request.' });
  }
};

/**
 * 6. Forgot Password - Verify OTP & Set New Password
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { identifier, otp, newPassword } = req.body;

    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email / Phone, OTP, and New Password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    const rawId = identifier.trim().toLowerCase();
    const phoneVariants = getPhoneSearchVariants(rawId);

    const searchConditions = [{ email: rawId }];
    if (phoneVariants.length > 0) {
      searchConditions.push({ primaryPhone: { in: phoneVariants } });
    }
    const customer = await prisma.customer.findFirst({
      where: { OR: searchConditions }
    });

    const otpLookups = [rawId];
    if (customer?.email) otpLookups.push(customer.email.toLowerCase());
    if (customer?.primaryPhone) otpLookups.push(customer.primaryPhone);

    const otpRecord = await prisma.customerOtp.findFirst({
      where: { identifier: { in: otpLookups } }
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    if (otpRecord.attempts >= 3) {
      await prisma.customerOtp.delete({ where: { id: otpRecord.id } });
      return res.status(400).json({ success: false, message: 'Too many failed attempts. Please request a new OTP.' });
    }

    if (Date.now() > new Date(otpRecord.expiresAt).getTime()) {
      await prisma.customerOtp.delete({ where: { id: otpRecord.id } });
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isMatch) {
      await prisma.customerOtp.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } }
      });
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    if (!customer) {
      return res.status(400).json({ success: false, message: 'Account not found.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.customer.update({
      where: { id: customer.id },
      data: { password: hashedPassword }
    });

    // Delete OTP securely after successful reset
    await prisma.customerOtp.delete({ where: { id: otpRecord.id } });

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
 * 7. Change Password (Authenticated Customer)
 */
exports.changePassword = async (req, res, next) => {
  try {
    const customerId = req.user?.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.'
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match.'
      });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer account not found.' });
    }

    if (customer.password) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required.'
        });
      }
      const isMatch = await bcrypt.compare(currentPassword, customer.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect.'
        });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.customer.update({
      where: { id: customerId },
      data: { password: hashedPassword }
    });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });

  } catch (error) {
    console.error('Customer changePassword error:', error);
    return res.status(500).json({ success: false, message: 'Server error changing password.' });
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
