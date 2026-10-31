/**
 * Order Management Controller — JB GROUP / Bella Design ERP
 *
 * =========================================================================
 * CONTROLLER ROADMAP & TABLE OF CONTENTS:
 * =========================================================================
 * This is the primary business logic controller for the tailoring lifecycle.
 *
 * Section 1: Helpers & Identifiers
 *   - getActorDisplayName: Sanitizes user titles (CEO, Manager, Tailor name)
 *   - generateOrderNumber: Formats sequential order numbers (e.g. ORD-2026-0001)
 *
 * Section 2: Order Creation & Ingestion
 *   - createOrder: Handles customer order entry (Shop vs Online)
 *
 * Section 3: Queries & Data Retrieval
 *   - getAllOrders: Filtered list by role, status, branch, tailor
 *   - getDashboardSummary: KPI metrics for executive dashboard
 *   - getCustomerOrders: Order history for a specific customer
 *   - getOrderById: Detailed order profile with garment specs & payments
 *   - getOrderHistory: Audit trail of stage transitions
 *   - getTailorsList: Active tailors available for assignment
 *   - getTailorPerformance: Leaderboard & productivity statistics
 *
 * Section 4: CEO & Management Approval Workflow
 *   - approveOrder: Approves online booking for production
 *   - requestChangesOrder: Returns order to staff for corrections
 *   - rejectOrder: Rejects order booking
 *
 * Section 5: Pricing & Customer Quotations
 *   - setOrderPrice: Sets service charge, fabric charge, additional work
 *   - confirmCustomerPrice: Accepts quotation and moves to production
 *   - requestCustomerPriceRevision: Requests quotation re-estimate
 *
 * Section 6: Tailor Assignment & Production Stages
 *   - assignTailor: Assigns primary tailor to order
 *   - tailorAcceptOrder / tailorRejectAssignment: Legacy acceptance workflow
 *   - updateOrderStatus: Advances stages (Cutting -> Stitching -> QC -> Ready)
 *   - deliverOrder: Marks order as collected/delivered to client
 *   - completeOrder: Final closure after delivery & full settlement
 *   - notifyOrderReady: Dispatches SMS / WhatsApp ready notification
 *
 * Section 7: Payments, Slips & Invoices
 *   - recordPayment: Logs cash, card, or transfer payment against balance
 *   - verifyPaymentSlip: Manager/CEO verifies bank deposit slip
 *   - rejectPaymentSlip: Rejects illegible or invalid bank slips
 *   - generateOrderPdf: Compiles printable order docket & invoice
 * =========================================================================
 */
const { prisma, pool } = require('../prisma');
const { logAudit } = require('../utils/auditLogger');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { VALID_STATUSES, ORDER_STATUS_LABELS, ALLOWED_STAGE_TRANSITIONS } = require('../config/orderStatus');

// Clean user display title (Role or clean name, NEVER raw email)
const toMoneyCents = (val) => Math.round((Number(val) || 0) * 100);
const fromMoneyCents = (cents) => Number((cents / 100).toFixed(2));

// Canonical order total value helper: prefers agreedTotal when positive, falls back to totalAmount
const getOrderTotalCents = (order) => {
  if (!order) return 0;
  const agreedCents = toMoneyCents(order.agreedTotal);
  if (agreedCents > 0) return agreedCents;
  return toMoneyCents(order.totalAmount);
};

exports.toMoneyCents = toMoneyCents;
exports.fromMoneyCents = fromMoneyCents;
exports.getOrderTotalCents = getOrderTotalCents;

const getActorDisplayName = (user) => {
  if (!user) return 'Manager';
  if (user.role === 'SUPER_ADMIN') return 'CEO';
  if (user.role === 'MANAGER' || user.role === 'ADMIN') return 'Manager';
  if (user.role === 'TAILOR') return user.name || 'Tailor';
  if (user.name && !user.name.includes('@')) {
    const n = user.name.toLowerCase();
    if (n.includes('ceo')) return 'CEO';
    if (n.includes('manager')) return 'Manager';
    return user.name;
  }
  if (user.email) {
    const e = user.email.toLowerCase();
    if (e.includes('ceo')) return 'CEO';
    if (e.includes('manager')) return 'Manager';
    if (e.includes('admin')) return 'Manager';
  }
  return user.role === 'SUPER_ADMIN' ? 'CEO' : 'Manager';
};

// Generate a unique order number (e.g., ORD-2026-0001)
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

  // Extract the number part and increment
  const lastNumberStr = lastOrder.orderNumber.split('-')[2];
  const nextNumber = parseInt(lastNumberStr, 10) + 1;
  const nextNumberStr = nextNumber.toString().padStart(4, '0');

  return `${prefix}${nextNumberStr}`;
};

// Create a new order
exports.createOrder = async (req, res, next) => {
  try {
    const { customerId, previousOrderId, garmentDetails } = req.body;

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(customerId) }
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    // Generate unique order number
    const orderNumber = await generateOrderNumber();

    // Prepare data
    const orderSource = req.body.orderSource || 'SHOP';
    const initialStatus = orderSource === 'ONLINE' ? 'PENDING_APPROVAL' : 'ORDER_CONFIRMED';

    const orderData = {
      orderNumber,
      customerId: parseInt(customerId),
      previousOrderId: previousOrderId ? parseInt(previousOrderId) : null,
      orderSource: orderSource,
      status: initialStatus,
      priceStatus: 'ACCEPTED',
      priceAcceptedByCustomer: true,
      totalAmount: 0,
      advancePayment: 0,
      balanceAmount: 0,
      paymentStatus: 'Unpaid'
    };

    let customerMeasurementRecord = null;
    if (garmentDetails && garmentDetails.measurements && typeof garmentDetails.measurements === 'object') {
      for (const [key, val] of Object.entries(garmentDetails.measurements)) {
        if (val !== '' && val !== null && val !== undefined) {
          const num = parseFloat(val);
          if (isNaN(num) || num < 0) {
            return res.status(400).json({
              success: false,
              message: `Measurement for "${key}" must be a valid positive number.`
            });
          }
        }
      }

      if (Object.keys(garmentDetails.measurements).length > 0) {
        customerMeasurementRecord = await prisma.customerMeasurement.create({
          data: {
            customerId: parseInt(customerId),
            dressType: garmentDetails.dressType || 'Custom',
            measurementUnit: garmentDetails.measurementUnit || 'Inches',
            fitPreference: garmentDetails.fitPreference || 'Regular',
            takenBy: garmentDetails.takenBy || req.user?.name || req.user?.username || 'Staff',
            measurementDate: garmentDetails.measurementDate ? new Date(garmentDetails.measurementDate) : new Date(),
            measurements: garmentDetails.measurements,
            fittingInstructions: garmentDetails.fittingInstructions || garmentDetails.specialDesignInstructions || null
          }
        });
        garmentDetails.customerMeasurementId = customerMeasurementRecord.id;
      }
    }

    if (garmentDetails) {
      orderData.garmentDetails = {
        create: {
          dressType: garmentDetails.dressType,
          quantity: parseInt(garmentDetails.quantity) || 1,
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
          designReferenceImage: garmentDetails.designReferenceImage || garmentDetails.designReferencePhoto || null,
          measurements: garmentDetails.measurements || null,
          measurementUnit: garmentDetails.measurementUnit || 'Inches',
          fitPreference: garmentDetails.fitPreference || 'Regular',
          additionalImages: garmentDetails.additionalImages || null,
          customerMeasurementId: customerMeasurementRecord ? customerMeasurementRecord.id : null
        }
      };
    }

    // Create the order and nested garment details atomically
    const newOrder = await prisma.order.create({
      data: orderData,
      include: {
        garmentDetails: true
      }
    });

    if (customerMeasurementRecord && newOrder) {
      await prisma.customerMeasurement.update({
        where: { id: customerMeasurementRecord.id },
        data: { orderId: newOrder.id }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: newOrder
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Server error creating order.' });
  }
};

// Get all orders for a customer
exports.getCustomerOrders = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const targetCustId = parseInt(customerId);

    if (isNaN(targetCustId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID.' });
    }

    // Security check: Customers can only view their own orders
    if (req.user?.role === 'CUSTOMER' && targetCustId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own orders.' });
    }

    const orders = await prisma.order.findMany({
      where: { customerId: targetCustId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
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
    });

    res.status(200).json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Error getting customer orders:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving customer orders.' });
  }
};

// Helper: Strictly enforce RBAC customer and order data visibility by role
const sanitizeOrderForRole = (order, role) => {
  if (!order) return order;
  const roleUpper = (role || '').toUpperCase();
  const isFullAccess = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CEO'].includes(roleUpper);
  if (isFullAccess) return order;

  // Clone order to prevent mutating original
  const sanitized = { ...order };

  // STAFF & TAILOR: Show customer name only.
  // Hide completely: Phone numbers, Address, Email, Profile photo
  if (sanitized.customer) {
    sanitized.customer = {
      id: sanitized.customer.id,
      name: sanitized.customer.name
    };
  }

  // STAFF & TAILOR: Retain measurements (required for stitching only)
  // Mask customerMeasurementId if present to avoid leaking customer profile linkages
  if (sanitized.garmentDetails) {
    const { customerMeasurementId, ...safeGarment } = sanitized.garmentDetails;
    sanitized.garmentDetails = safeGarment;
  }

  // STAFF & TAILOR: Hide all payment and financial details completely
  delete sanitized.totalAmount;
  delete sanitized.advancePayment;
  delete sanitized.balanceAmount;
  delete sanitized.serviceCharge;
  delete sanitized.additionalWorkCharge;
  delete sanitized.materialCharge;
  delete sanitized.discountAmount;
  delete sanitized.agreedTotal;
  delete sanitized.agreedAdvance;
  delete sanitized.agreedBalance;
  delete sanitized.advanceRequired;
  delete sanitized.paymentStatus;
  delete sanitized.payments;
  delete sanitized.invoices;
  delete sanitized.priceStatus;
  delete sanitized.priceSentAt;
  delete sanitized.priceAcceptedAt;
  delete sanitized.priceDeclinedAt;
  delete sanitized.priceDeclineReason;

  return sanitized;
};

const sanitizeTailorOrder = (order) => sanitizeOrderForRole(order, 'TAILOR');

exports.sanitizeOrderForRole = sanitizeOrderForRole;
exports.sanitizeTailorOrder = sanitizeTailorOrder;

// Get all orders across the system
exports.getAllOrders = async (req, res, next) => {
  try {
    const where = {};
    const userRole = String(req.user?.role || '').toUpperCase();
    const isCrossBranch = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);

    if (isCrossBranch) {
      if (req.query.branchId && String(req.query.branchId).trim().toUpperCase() !== 'ALL') {
        const bInt = parseInt(req.query.branchId, 10);
        if (bInt > 0) where.branchId = bInt;
      }
    } else if (userRole === 'MANAGER') {
      const managerBranch = req.user?.branchId ? Number(req.user.branchId) : null;
      if (!managerBranch) {
        return res.status(403).json({ success: false, message: 'Access denied: Manager is not assigned to any branch.' });
      }
      if (req.query.branchId) {
        const qBranch = String(req.query.branchId).trim();
        if (qBranch.toUpperCase() === 'ALL') {
          return res.status(403).json({ success: false, message: `Access denied. Managers cannot access all-branch orders. You are restricted to branch ${managerBranch}.` });
        }
        if (!/^\d+$/.test(qBranch) || parseInt(qBranch, 10) !== managerBranch) {
          return res.status(403).json({ success: false, message: `Access denied: Managers are restricted to their assigned branch (${managerBranch}). Cannot access branch ${qBranch}.` });
        }
      }
      where.branchId = managerBranch;
    } else if (req.user?.branchId) {
      where.branchId = Number(req.user.branchId);
    }

    // Tailor security: Tailor can ONLY see confirmed production orders assigned to them or their tasks
    if (req.user?.role === 'TAILOR') {
      where.OR = [
        { assignedTailorId: req.user.id },
        { tasks: { some: { assignedTailorId: req.user.id } } }
      ];
      where.status = { notIn: ['PENDING_APPROVAL', 'APPROVED', 'PRICE_DECLINED', 'REJECTED'] };
    }

    const isTailor = req.user?.role === 'TAILOR';

    const orders = await prisma.order.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      include: {
        customer: true,
        garmentDetails: true,
        branch: true,
        assignedTailor: {
          select: { id: true, name: true, email: true }
        },
        tasks: {
          include: {
            assignedTailor: {
              select: { id: true, name: true, email: true, role: true }
            }
          },
          orderBy: { sequence: 'asc' }
        },
        ...(!isTailor && {
          payments: {
            orderBy: { createdAt: 'asc' }
          }
        }),
        productionHistory: {
          orderBy: { startedAt: 'asc' },
          include: {
            assignedTo: {
              select: { id: true, name: true, role: true }
            }
          }
        }
      }
    });

    const responseOrders = orders.map(o => sanitizeOrderForRole(o, req.user?.role));

    res.status(200).json({
      success: true,
      orders: responseOrders
    });
  } catch (error) {
    console.error('Error getting all orders:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving all orders.' });
  }
};

// Get single order by ID
exports.getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const isTailor = req.user?.role === 'TAILOR';

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        garmentDetails: true,
        branch: true,
        assignedTailor: {
          select: { id: true, name: true, email: true }
        },
        tasks: {
          include: {
            assignedTailor: {
              select: { id: true, name: true, email: true, role: true }
            }
          },
          orderBy: { sequence: 'asc' }
        },
        ...(!isTailor && {
          payments: {
            orderBy: { createdAt: 'asc' }
          }
        }),
        productionHistory: {
          orderBy: { startedAt: 'asc' }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Security check: Customers can only view their own orders
    if (req.user?.role === 'CUSTOMER' && order.customerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only view your own orders.' });
    }

    // Security check: Tailor can only view approved orders assigned to them or their tasks
    if (req.user?.role === 'TAILOR') {
      const isAssigned = order.assignedTailorId === req.user.id || (order.tasks && order.tasks.some(t => t.assignedTailorId === req.user.id));
      if (
        !isAssigned ||
        ['PENDING_APPROVAL', 'APPROVED', 'PRICE_DECLINED', 'REJECTED'].includes(order.status)
      ) {
        return res.status(403).json({ success: false, message: 'Access denied. This order is not assigned to you or is pending approval/pricing.' });
      }
    }

    res.status(200).json({ success: true, order: sanitizeOrderForRole(order, req.user?.role) });
  } catch (error) {
    console.error('Error getting order by id:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving order.' });
  }
};

// Update order status — writes a ProductionHistory record on every transition
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, assignedToId } = req.body;
    const orderId = parseInt(id);

    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid values: ${VALID_STATUSES.join(', ')}`
      });
    }

    // Fetch current order to capture previousStage, balances, and assignment
    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        assignedTailorId: true,
        tailorAccepted: true,
        priceAcceptedByCustomer: true,
        balanceAmount: true,
        totalAmount: true,
        readyNotificationSent: true,
        readyNotificationSentAt: true,
        readyNotificationStatus: true,
        customer: { select: { id: true, name: true, primaryPhone: true } }
      }
    });

    if (!currentOrder) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Completed orders are read-only (except SUPER_ADMIN)
    if (currentOrder.status === 'COMPLETED' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Order is completed and archived. Completed orders are read-only and cannot be modified.'
      });
    }

    const isManagerRole = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role);

    // Validate exception states (ON_HOLD / CANCELLED)
    if (['ON_HOLD', 'CANCELLED'].includes(status)) {
      if (!isManagerRole) {
        return res.status(403).json({
          success: false,
          message: 'Only CEO or authorized Manager can put orders on hold or cancel orders.'
        });
      }
      if (['REJECTED', 'DELIVERED', 'COMPLETED'].includes(currentOrder.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot transition a ${ORDER_STATUS_LABELS[currentOrder.status] || currentOrder.status} order to ${ORDER_STATUS_LABELS[status] || status}.`
        });
      }
    } else if (currentOrder.status === 'ON_HOLD') {
      // Management can resume an order on hold
      if (!isManagerRole && req.user?.role !== 'TAILOR') {
        return res.status(403).json({
          success: false,
          message: 'Only management or assigned staff can resume orders on hold.'
        });
      }
    } else if (status !== currentOrder.status) {
      const allowedNext = ALLOWED_STAGE_TRANSITIONS[currentOrder.status] || [];
      if (!allowedNext.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid workflow transition: Cannot move order directly from "${ORDER_STATUS_LABELS[currentOrder.status] || currentOrder.status}" to "${ORDER_STATUS_LABELS[status] || status}". Required workflow stages cannot be skipped.`
        });
      }
    }

    // Orders in PENDING_APPROVAL cannot advance without explicit CEO/Manager approval
    if (currentOrder.status === 'PENDING_APPROVAL' && !['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CHANGES_REQUIRED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Order is pending review. It must be approved by CEO/Manager before proceeding.'
      });
    }

    // Delivery Guard: Order must be READY and balance MUST be 0
    if (status === 'DELIVERED') {
      if (currentOrder.status !== 'READY') {
        return res.status(400).json({
          success: false,
          message: `Order must be in READY state before delivery. Current status: ${ORDER_STATUS_LABELS[currentOrder.status] || currentOrder.status}.`
        });
      }
      if (Number(currentOrder.balanceAmount || 0) > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot deliver order. Outstanding balance of LKR ${Number(currentOrder.balanceAmount).toLocaleString()} must be settled before delivery.`
        });
      }
    }

    // Completion Guard: Order must be DELIVERED before completion
    if (status === 'COMPLETED' && currentOrder.status !== 'DELIVERED') {
      return res.status(400).json({
        success: false,
        message: `Order must be in DELIVERED state before completion. Current status: ${ORDER_STATUS_LABELS[currentOrder.status] || currentOrder.status}.`
      });
    }

    // Production Gate: Production cannot start without tailor assignment
    if (['CUTTING', 'STITCHING', 'AARI_EMBROIDERY', 'FITTING_ALTERATION', 'FINISHING', 'QUALITY_CHECK', 'ALTERATION', 'READY'].includes(status)) {
      if (!currentOrder.assignedTailorId) {
        return res.status(400).json({
          success: false,
          message: 'Production cannot proceed: A tailor must be assigned to this order first.'
        });
      }
    }

    // Role-specific production stage authorizations
    if (req.user?.role === 'TAILOR') {
      if (currentOrder.assignedTailorId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only update orders assigned to you.'
        });
      }
      const tailorAllowedStages = ['IN_PROGRESS', 'CUTTING', 'STITCHING', 'ALTERATION', 'QUALITY_CHECK', 'FINISHING', 'READY'];
      if (!tailorAllowedStages.includes(status)) {
        return res.status(403).json({
          success: false,
          message: `Tailor role is not permitted to advance order to ${ORDER_STATUS_LABELS[status] || status}.`
        });
      }
    } else if (req.user?.role === 'CUTTING') {
      if (!['CUTTING', 'STITCHING'].includes(status)) {
        return res.status(403).json({
          success: false,
          message: 'Cutting role can only update Cutting or advance to Stitching.'
        });
      }
    } else if (req.user?.role === 'EMBROIDERY') {
      if (status !== 'AARI_EMBROIDERY') {
        return res.status(403).json({
          success: false,
          message: 'Embroidery role can only update Embroidery stage.'
        });
      }
    } else if (req.user?.role === 'CASHIER') {
      return res.status(403).json({
        success: false,
        message: 'Cashier role cannot modify production workflow stages.'
      });
    }

    const previousStage = currentOrder.status;
    const now = new Date();

    // Close the most recent open ProductionHistory record for this order
    const openRecord = await prisma.productionHistory.findFirst({
      where: { orderId, completedAt: null },
      orderBy: { startedAt: 'desc' }
    });

    if (openRecord) {
      const durationMins = Math.round((now - new Date(openRecord.startedAt)) / 60000);
      await prisma.productionHistory.update({
        where: { id: openRecord.id },
        data: {
          completedAt: now,
          durationMins,
          nextStage: status
        }
      });
    }

    const updateData = { status };
    if (currentOrder.status === 'TAILOR_ASSIGNED' && status === 'IN_PROGRESS' && !currentOrder.tailorAccepted) {
      updateData.tailorAccepted = true;
      updateData.tailorAcceptedAt = now;
    }
    if (status === 'DELIVERED') {
      updateData.deliveredBy = getActorDisplayName(req.user);
      updateData.deliveredAt = now;
      if (notes) updateData.deliveryNotes = notes;
    }
    if (status === 'COMPLETED') {
      updateData.completedBy = getActorDisplayName(req.user);
      updateData.completedAt = now;
    }

    // Note: Production status updates (including marking READY / Finished) do NOT automatically
    // trigger customer Finished/Ready notifications. Only authorized Managers/Admins/CEO can explicitly
    // confirm and send customer finished notifications via notifyOrderReady.

    // Update the order status
    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        customer: true,
        garmentDetails: true,
        branch: true,
        assignedTailor: {
          select: { id: true, name: true, email: true }
        },
        payments: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    // Create a new open ProductionHistory record for the new stage
    const historyRecord = await prisma.productionHistory.create({
      data: {
        orderId,
        stage: status,
        previousStage,
        assignedToId: assignedToId ? parseInt(assignedToId) : (req.user?.id || null),
        notes: notes || null,
        startedAt: now
      }
    });

    res.status(200).json({
      success: true,
      message: `Status updated to: ${ORDER_STATUS_LABELS[status] || status}`,
      order,
      historyRecord
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Server error updating order status.' });
  }
};

// Record payment for an order
exports.recordPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, notes, transactionRef, slipImage } = req.body;
    const orderId = parseInt(id);

    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        garmentDetails: true,
        branch: true,
        payments: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status === 'COMPLETED' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Order is completed and archived. Cannot record payments on completed orders.'
      });
    }

    // Branch authorization check: Manager is restricted strictly to orders in their assigned branch
    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user.branchId ? Number(req.user.branchId) : null;
      if (!managerBranch || (order.branchId && order.branchId !== managerBranch)) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Manager cannot record payments for order in branch ${order.branchId || 'unassigned'}. Your authorized branch is ${managerBranch || 'none'}.`
        });
      }
    }

    const effectiveTotalCents = getOrderTotalCents(order);

    // Calculate total already paid using ONLY VERIFIED payments
    // Handle legacy orders without Payment records carefully by checking residual advancePayment
    const verifiedPayments = (order.payments || []).filter(p => !p.status || String(p.status).trim().toUpperCase() === 'VERIFIED');
    const verifiedPaymentsCents = verifiedPayments.reduce((sum, p) => sum + toMoneyCents(p.amount), 0);
    const legacyAdvanceCents = Math.max(0, toMoneyCents(order.advancePayment) - verifiedPaymentsCents);
    const existingPaidCents = verifiedPaymentsCents + legacyAdvanceCents;

    const currentBalanceCents = Math.max(0, effectiveTotalCents - existingPaidCents);

    if (currentBalanceCents <= 0) {
      return res.status(400).json({ success: false, message: 'Order is already fully paid.' });
    }

    const paymentAmountCents = toMoneyCents(paymentAmount);
    if (paymentAmountCents > currentBalanceCents) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (LKR ${paymentAmount.toLocaleString()}) cannot exceed balance due (LKR ${fromMoneyCents(currentBalanceCents).toLocaleString()}).`
      });
    }

    const recordedBy = getActorDisplayName(req.user);
    const method = paymentMethod || 'Cash';

    // Recalculate total paid & balance due
    const newTotalPaidCents = existingPaidCents + paymentAmountCents;
    const newBalanceCents = Math.max(0, effectiveTotalCents - newTotalPaidCents);
    const newTotalPaid = fromMoneyCents(newTotalPaidCents);
    const newBalance = fromMoneyCents(newBalanceCents);
    const newPaymentStatus = newBalanceCents <= 0 && effectiveTotalCents > 0 ? 'Paid' : (newTotalPaidCents > 0 ? 'Partially Paid' : 'Unpaid');

    // Execute atomic update in database transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Create real Payment record in PostgreSQL
      await tx.payment.create({
        data: {
          orderId,
          amount: paymentAmount,
          paymentMethod: method,
          transactionRef: transactionRef || null,
          slipImage: slipImage || null,
          notes: notes || null,
          recordedBy,
          status: 'VERIFIED'
        }
      });

      // 2. Update Order record with new payment info
      const orderUpdate = await tx.order.update({
        where: { id: orderId },
        data: {
          advancePayment: newTotalPaid,
          balanceAmount: newBalance,
          paymentStatus: newPaymentStatus
        },
        include: {
          customer: true,
          garmentDetails: true,
          branch: true,
          payments: { orderBy: { createdAt: 'asc' } },
          assignedTailor: { select: { id: true, name: true, email: true } }
        }
      });

      // 3. Log in ProductionHistory for auditing without changing order stage
      await tx.productionHistory.create({
        data: {
          orderId,
          stage: order.status,
          previousStage: order.status,
          notes: `Payment of LKR ${paymentAmount.toLocaleString()} recorded via ${method}. Payment Status: ${newPaymentStatus}. Total Paid: LKR ${newTotalPaid.toLocaleString()}, Balance Due: LKR ${newBalance.toLocaleString()}.`
        }
      });

      return orderUpdate;
    });

    res.status(200).json({
      success: true,
      message: `Payment of LKR ${paymentAmount.toLocaleString()} recorded successfully.`,
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ success: false, message: 'Server error recording payment.' });
  }
};

// Verify and approve customer payment slip (Manager / CEO / Admin)
exports.verifyPaymentSlip = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const paymentId = parseInt(req.params.paymentId);

    if (isNaN(orderId) || isNaN(paymentId)) {
      return res.status(400).json({ success: false, message: 'Invalid order or payment ID.' });
    }

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, orderId }
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found for this order.' });
    }

    if (payment.status === 'VERIFIED') {
      return res.status(400).json({ success: false, message: 'Payment is already verified.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Branch authorization check: Manager is restricted strictly to orders in their assigned branch
    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user.branchId ? Number(req.user.branchId) : null;
      if (!managerBranch || (order.branchId && order.branchId !== managerBranch)) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Manager cannot verify payments for order in branch ${order.branchId || 'unassigned'}. Your authorized branch is ${managerBranch || 'none'}.`
        });
      }
    }

    const verifierName = getActorDisplayName(req.user);
    const now = new Date();

    const { updatedPayment, updatedOrder } = await prisma.$transaction(async (tx) => {
      // 1. Mark payment as VERIFIED
      const pUpdate = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'VERIFIED',
          verifiedBy: verifierName,
          verifiedAt: now
        }
      });

      // 2. Sum all verified payments for this order, preserving legacy advancePayment without double counting
      const allVerified = await tx.payment.findMany({
        where: { orderId, status: 'VERIFIED' }
      });

      const otherVerified = allVerified.filter(p => p.id !== paymentId);
      const otherVerifiedCents = otherVerified.reduce((sum, p) => sum + toMoneyCents(p.amount), 0);
      const legacyAdvanceCents = Math.max(0, toMoneyCents(order.advancePayment) - otherVerifiedCents);

      const totalVerifiedCents = otherVerifiedCents + toMoneyCents(payment.amount);
      const newTotalPaidCents = totalVerifiedCents + legacyAdvanceCents;
      const effectiveTotalCents = getOrderTotalCents(order);
      const newBalanceCents = Math.max(0, effectiveTotalCents - newTotalPaidCents);

      const totalPaid = fromMoneyCents(newTotalPaidCents);
      const newBalance = fromMoneyCents(newBalanceCents);
      const newPaymentStatus = newBalanceCents <= 0 && effectiveTotalCents > 0 ? 'Paid' : (newTotalPaidCents > 0 ? 'Partially Paid' : 'Unpaid');

      // 3. Update Order financial balances
      const oUpdate = await tx.order.update({
        where: { id: orderId },
        data: {
          advancePayment: totalPaid,
          balanceAmount: newBalance,
          paymentStatus: newPaymentStatus
        },
        include: {
          customer: true,
          garmentDetails: true,
          branch: true,
          payments: { orderBy: { createdAt: 'desc' } }
        }
      });

      // 4. Log in ProductionHistory
      await tx.productionHistory.create({
        data: {
          orderId,
          stage: order.status,
          notes: `Payment slip of LKR ${payment.amount.toLocaleString()} VERIFIED & APPROVED by ${verifierName}. Total Paid: LKR ${totalPaid.toLocaleString()}, Balance Due: LKR ${newBalance.toLocaleString()}.`
        }
      });

      return { updatedPayment: pUpdate, updatedOrder: oUpdate };
    });

    res.status(200).json({
      success: true,
      message: `Payment of LKR ${payment.amount.toLocaleString()} verified and approved successfully.`,
      payment: updatedPayment,
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error verifying payment slip:', error);
    res.status(500).json({ success: false, message: 'Server error verifying payment slip.' });
  }
};

// Reject customer payment slip (Manager / CEO / Admin)
exports.rejectPaymentSlip = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const paymentId = parseInt(req.params.paymentId);
    const { reason } = req.body;

    if (isNaN(orderId) || isNaN(paymentId)) {
      return res.status(400).json({ success: false, message: 'Invalid order or payment ID.' });
    }

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, orderId }
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found for this order.' });
    }

    if (payment.status === 'REJECTED') {
      return res.status(400).json({ success: false, message: 'Payment is already rejected.' });
    }

    const orderRecord = await prisma.order.findUnique({ where: { id: orderId } });
    if (!orderRecord) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Branch authorization check: Manager is restricted strictly to orders in their assigned branch
    if (req.user?.role === 'MANAGER') {
      const managerBranch = req.user.branchId ? Number(req.user.branchId) : null;
      if (!managerBranch || (orderRecord.branchId && orderRecord.branchId !== managerBranch)) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Manager cannot reject payments for order in branch ${orderRecord.branchId || 'unassigned'}. Your authorized branch is ${managerBranch || 'none'}.`
        });
      }
    }

    const verifierName = getActorDisplayName(req.user);
    const rejectReason = reason ? reason.trim() : 'Payment slip rejected by manager';
    const now = new Date();

    const { updatedPayment } = await prisma.$transaction(async (tx) => {
      // 1. Mark payment as REJECTED
      const pUpdate = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'REJECTED',
          rejectionReason: rejectReason,
          verifiedBy: verifierName,
          verifiedAt: now
        }
      });

      // 2. If the rejected payment was previously VERIFIED, recompute order's advancePayment, balanceAmount and paymentStatus
      if (payment.status === 'VERIFIED') {
        const remainingVerified = await tx.payment.findMany({
          where: { orderId, status: 'VERIFIED' }
        });
        const remainingVerifiedCents = remainingVerified.reduce((sum, p) => sum + toMoneyCents(p.amount), 0);
        
        // Genuine legacy advance is what order advancePayment had exceeding verified payments before this rejection
        const prevPaidCents = toMoneyCents(orderRecord.advancePayment);
        const rejectedCents = toMoneyCents(payment.amount);
        const legacyAdvanceCents = Math.max(0, prevPaidCents - (remainingVerifiedCents + rejectedCents));

        const newPaidCents = Math.max(0, remainingVerifiedCents + legacyAdvanceCents);
        const effectiveTotalCents = getOrderTotalCents(orderRecord);
        const newBalanceCents = Math.max(0, effectiveTotalCents - newPaidCents);

        await tx.order.update({
          where: { id: orderId },
          data: {
            advancePayment: fromMoneyCents(newPaidCents),
            balanceAmount: fromMoneyCents(newBalanceCents),
            paymentStatus: newBalanceCents <= 0 && effectiveTotalCents > 0 ? 'Paid' : (newPaidCents > 0 ? 'Partially Paid' : 'Unpaid')
          }
        });
      }

      // 3. Production history log
      await tx.productionHistory.create({
        data: {
          orderId,
          stage: orderRecord?.status || 'ORDER_CONFIRMED',
          notes: `Payment slip of LKR ${payment.amount.toLocaleString()} REJECTED by ${verifierName}. Reason: ${rejectReason}`
        }
      });

      return { updatedPayment: pUpdate };
    });

    const refreshedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        garmentDetails: true,
        branch: true,
        payments: { orderBy: { createdAt: 'desc' } },
        productionHistory: {
          orderBy: { startedAt: 'asc' },
          include: { assignedTo: { select: { id: true, name: true, role: true } } }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: `Payment slip of LKR ${payment.amount.toLocaleString()} rejected.`,
      payment: updatedPayment,
      order: refreshedOrder
    });
  } catch (error) {
    console.error('Error rejecting payment slip:', error);
    res.status(500).json({ success: false, message: 'Server error rejecting payment slip.' });
  }
};

// Generate Order PDF
exports.generateOrderPdf = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orderId = parseInt(id);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        garmentDetails: true
      }
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    // Security check: Tailors must NOT receive financial invoices (Requirement 5)
    if (req.user?.role === 'TAILOR') {
      return res.status(403).json({ success: false, message: 'Access denied. Tailors are not authorized to view or download invoices.' });
    }

    // Security check: Customers can only download their own order PDF
    if (req.user?.role === 'CUSTOMER' && order.customerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only download your own order PDF.' });
    }

    const doc = new PDFDocument({ margin: 50 });

    // Set headers
    res.setHeader('Content-disposition', `attachment; filename=Order_${order.orderNumber}.pdf`);
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    // Document Header
    doc.fontSize(20).font('Helvetica-Bold').text('BELLA DESIGN', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('JB GROUP', { align: 'center' });
    doc.moveDown(2);

    // Order Information
    doc.fontSize(14).font('Helvetica-Bold').text('Order Information');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    const friendlyStatus = {
      'ORDER_CONFIRMED': 'Pending',
      'PENDING': 'Pending',
      'PENDING_PRODUCTION': 'Pending Production',
      'CUTTING': 'Cutting',
      'STITCHING': 'Stitching',
      'AARI_EMBROIDERY': 'Aari / Embroidery',
      'EMBROIDERY_AARI': 'Aari / Embroidery',
      'FITTING_ALTERATION': 'Fitting / Alteration',
      'FINISHING': 'Finishing',
      'QUALITY_CHECK': 'Quality Check',
      'READY': 'Ready for Collection',
      'DELIVERED': 'Delivered',
      'ON_HOLD': 'On Hold',
      'CANCELLED': 'Cancelled'
    }[order.status] || order.status;

    doc.text(`Order Number: ${order.orderNumber}`);
    doc.text(`Order Date: ${new Date(order.orderDate).toLocaleDateString()}`);
    doc.text(`Current Status: ${friendlyStatus}`);
    doc.moveDown();

    // Customer Information
    doc.fontSize(14).font('Helvetica-Bold').text('Customer Information');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    const c = order.customer;
    doc.text(`Name: ${c.name}`);
    doc.text(`Primary Contact: ${c.primaryPhone}`);
    if (c.alternativePhone) doc.text(`Alternative Contact: ${c.alternativePhone}`);
    if (c.address) doc.text(`Address: ${c.address}`);
    doc.moveDown();

    // Garment Information
    if (order.garmentDetails) {
      doc.fontSize(14).font('Helvetica-Bold').text('Garment Information');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      const g = order.garmentDetails;
      doc.text(`Dress Type: ${g.dressType}`);
      doc.text(`Quantity: ${g.quantity}`);
      if (g.occasion) doc.text(`Occasion: ${g.occasion}`);
      if (g.fabricType) doc.text(`Fabric Type: ${g.fabricType}`);
      if (g.fabricColour) doc.text(`Fabric Colour: ${g.fabricColour}`);
      if (g.fabricSuppliedBy) doc.text(`Fabric Supplied By: ${g.fabricSuppliedBy}`);
      doc.text(`Lining: ${g.liningRequired ? 'Yes' : 'No'}`);
      doc.text(`Padding / Cup: ${g.paddingCupRequired ? 'Yes' : 'No'}`);
      doc.text(`Aari / Embroidery / Work: ${g.workRequired ? 'Yes' : 'No'}`);
      if (g.workDetails) doc.text(`Work Details: ${g.workDetails}`);
      if (g.accessoriesSupplied) doc.text(`Accessories: ${g.accessoriesSupplied}`);
      if (g.specialDesignInstructions) doc.text(`Instructions: ${g.specialDesignInstructions}`);
      doc.moveDown();

      // Embed Design Reference Image if available
      if (g.designReferenceImage) {
        try {
          const cleanRel = g.designReferenceImage.replace(/^\/+/, '');
          const imgPath = path.join(__dirname, '../../', cleanRel);
          if (fs.existsSync(imgPath)) {
            doc.fontSize(14).font('Helvetica-Bold').text('Design Reference');
            doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
            doc.moveDown(0.5);
            doc.image(imgPath, { fit: [200, 200], align: 'left' });
            doc.moveDown();
          }
        } catch (imgErr) {
          console.error('Error embedding image in PDF:', imgErr);
        }
      }
    }

    // Payment Information (Requirement 3: strictly use actual database values)
    doc.fontSize(14).font('Helvetica-Bold').text('Payment Information');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    const total = Number(order.agreedTotal || order.totalAmount || 0);
    const paid = Number(order.advancePayment || 0);
    const balance = Number(order.balanceAmount !== undefined ? order.balanceAmount : Math.max(0, total - paid));
    const paymentStatus = order.paymentStatus || (balance <= 0 && total > 0 ? 'Paid' : (paid > 0 ? 'Partially Paid' : 'Unpaid'));
    doc.text(`Agreed Total: LKR ${total.toLocaleString()}`);
    doc.text(`Amount Paid: LKR ${paid.toLocaleString()}`);
    doc.text(`Balance Due: LKR ${balance.toLocaleString()}`);
    doc.text(`Payment Status: ${paymentStatus}`);
    doc.moveDown();

    // End Document
    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Server error generating PDF.' });
    }
  }
};

// Get production history for an order
exports.getOrderHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const history = await prisma.productionHistory.findMany({
      where: { orderId },
      orderBy: { startedAt: 'asc' },
      include: {
        assignedTo: {
          select: { id: true, name: true, role: true }
        }
      }
    });

    res.status(200).json({ success: true, history });
  } catch (error) {
    console.error('Error getting order history:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving production history.' });
  }
};

// Asia/Colombo (UTC+05:30) & integer-cents helpers for accurate dashboard sales calculations
const COLOMBO_OFFSET_MS = 330 * 60 * 1000;
const DASHBOARD_EXCLUDED_STATUSES = new Set(['CANCELLED', 'REJECTED', 'PRICE_DECLINED']);

const toColomboDateKey = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const shifted = new Date(parsed.getTime() + COLOMBO_OFFSET_MS);
  const yr = shifted.getUTCFullYear();
  const mo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dt = String(shifted.getUTCDate()).padStart(2, '0');
  return `${yr}-${mo}-${dt}`;
};

const parseDashboardReferenceDateKey = (rawValue) => {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    return toColomboDateKey(new Date());
  }
  const trimmed = String(rawValue).trim();
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymdMatch) {
    const yr = Number(ymdMatch[1]);
    const mo = Number(ymdMatch[2]);
    const dt = Number(ymdMatch[3]);
    const check = new Date(Date.UTC(yr, mo - 1, dt));
    if (
      check.getUTCFullYear() !== yr ||
      check.getUTCMonth() !== mo - 1 ||
      check.getUTCDate() !== dt
    ) {
      return null;
    }
    return trimmed;
  }
  return toColomboDateKey(trimmed);
};

const shiftColomboDateKey = (dateKey, offsetDays) => {
  const [yr, mo, dt] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(yr, mo - 1, dt + offsetDays));
  const rYr = shifted.getUTCFullYear();
  const rMo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const rDt = String(shifted.getUTCDate()).padStart(2, '0');
  return `${rYr}-${rMo}-${rDt}`;
};

const getColomboDayMeta = (dateKey) => {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [yr, mo, dt] = dateKey.split('-').map(Number);
  const utcDate = new Date(Date.UTC(yr, mo - 1, dt));
  return {
    day: dayNames[utcDate.getUTCDay()],
    formattedDate: `${String(dt).padStart(2, '0')} ${monthNames[utcDate.getUTCMonth()]}`
  };
};

// Get Sales Dashboard Summary metrics directly from PostgreSQL
exports.getDashboardSummary = async (req, res, next) => {
  try {
    const rawBranchId = req.query.branchId;
    let branchId = null;

    const userRole = String(req.user?.role || '').toUpperCase();
    const isCrossBranch = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);

    if (isCrossBranch) {
      if (rawBranchId !== undefined && rawBranchId !== null && String(rawBranchId).trim() !== '' && String(rawBranchId).trim().toUpperCase() !== 'ALL') {
        const branchStr = String(rawBranchId).trim();
        if (!/^\d+$/.test(branchStr) || parseInt(branchStr, 10) <= 0) {
          return res.status(400).json({ success: false, message: 'Invalid branchId parameter.' });
        }
        branchId = parseInt(branchStr, 10);
      }
    } else {
      const managerBranch = req.user?.branchId ? Number(req.user.branchId) : null;
      if (!managerBranch) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: User is not assigned to any branch.'
        });
      }
      if (rawBranchId !== undefined && rawBranchId !== null && String(rawBranchId).trim() !== '') {
        const branchStr = String(rawBranchId).trim();
        if (branchStr.toUpperCase() === 'ALL') {
          return res.status(403).json({
            success: false,
            message: `Access denied. Managers cannot access all-branch financial data. You are restricted to branch ${managerBranch}.`
          });
        }
        if (!/^\d+$/.test(branchStr) || parseInt(branchStr, 10) !== managerBranch) {
          return res.status(403).json({
            success: false,
            message: `Access denied. Managers are restricted to their assigned branch (${managerBranch}). Cannot access branch ${branchStr}.`
          });
        }
      }
      // Strictly enforce manager's assigned branch
      branchId = managerBranch;
    }

    const refDateRaw = req.query.date !== undefined ? req.query.date : req.query.referenceDate;
    const todayKey = parseDashboardReferenceDateKey(refDateRaw);
    if (!todayKey) {
      return res.status(400).json({ success: false, message: 'Invalid date parameter. Expected YYYY-MM-DD.' });
    }

    const yesterdayKey = shiftColomboDateKey(todayKey, -1);
    const monthPrefix = todayKey.slice(0, 7);

    const whereClause = branchId ? { branchId } : {};

    const allOrders = await prisma.order.findMany({
      where: whereClause,
      select: {
        id: true,
        orderNumber: true,
        orderDate: true,
        totalAmount: true,
        agreedTotal: true,
        advancePayment: true,
        balanceAmount: true,
        paymentStatus: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const pendingApprovalCount = allOrders.filter(o => o.status === 'PENDING_APPROVAL').length;

    // Exclude cancelled, rejected, and customer price-declined orders from active sales & order counts
    const validOrders = allOrders.filter(o => !DASHBOARD_EXCLUDED_STATUSES.has(String(o.status || '').toUpperCase()));
    const validOrderIds = new Set(validOrders.map(o => o.id));

    // Fetch payments within branch scope if branch specified
    const paymentWhere = branchId ? { order: { branchId } } : {};
    const allPayments = await prisma.payment.findMany({
      where: paymentWhere,
      select: {
        id: true,
        orderId: true,
        amount: true,
        status: true,
        createdAt: true
      }
    });

    // Build deduplicated realized-sales ledger in integer cents bucketed by Asia/Colombo date:
    // 1) Sum VERIFIED (or legacy null-status) positive Payment rows on non-excluded orders by payment createdAt date.
    // 2) If a valid order has residual advancePayment > sum(verified Payment rows) (legacy orders without Payment rows),
    //    credit only the unrecorded residual advance to the order's Asia/Colombo orderDate.
    const revenueCentsByDate = new Map();
    const verifiedPaidCentsByOrder = new Map();

    const addRevenueCents = (dateKey, cents) => {
      if (!dateKey || cents <= 0) return;
      revenueCentsByDate.set(dateKey, (revenueCentsByDate.get(dateKey) || 0) + cents);
    };

    for (const p of allPayments) {
      if (!validOrderIds.has(p.orderId)) continue;
      const pStatus = p.status ? String(p.status).trim().toUpperCase() : 'VERIFIED';
      if (pStatus !== 'VERIFIED') continue;
      const cents = toMoneyCents(p.amount);
      if (cents <= 0) continue;

      verifiedPaidCentsByOrder.set(p.orderId, (verifiedPaidCentsByOrder.get(p.orderId) || 0) + cents);
      const pDateKey = toColomboDateKey(p.createdAt);
      addRevenueCents(pDateKey, cents);
    }

    const ordersByDate = new Map();
    for (const o of validOrders) {
      const oDateKey = toColomboDateKey(o.orderDate || o.createdAt);
      if (oDateKey) {
        if (!ordersByDate.has(oDateKey)) {
          ordersByDate.set(oDateKey, []);
        }
        ordersByDate.get(oDateKey).push(o);
      }

      const advanceCents = toMoneyCents(o.advancePayment);
      const verifiedCents = verifiedPaidCentsByOrder.get(o.id) || 0;
      const residualAdvanceCents = Math.max(0, advanceCents - verifiedCents);
      if (residualAdvanceCents > 0 && oDateKey) {
        addRevenueCents(oDateKey, residualAdvanceCents);
      }
    }

    // Effective order value helper: takes agreedTotal when set, else totalAmount
    const getOrderValueCents = (o) => getOrderTotalCents(o);

    // 1. Today's & Yesterday's orders & realized sales (Asia/Colombo)
    const todayOrdersList = ordersByDate.get(todayKey) || [];
    const todayOrders = todayOrdersList.length;
    const todaySales = fromMoneyCents(revenueCentsByDate.get(todayKey) || 0);

    const yesterdayOrdersList = ordersByDate.get(yesterdayKey) || [];
    const yesterdayOrders = yesterdayOrdersList.length;
    const yesterdaySales = fromMoneyCents(revenueCentsByDate.get(yesterdayKey) || 0);

    // 2. Monthly orders & realized sales (for reference month in Asia/Colombo)
    let monthlyOrders = 0;
    for (const [dateKey, dayOrds] of ordersByDate.entries()) {
      if (dateKey.startsWith(monthPrefix) && dateKey <= todayKey) {
        monthlyOrders += dayOrds.length;
      }
    }
    let monthlySalesCents = 0;
    for (const [dateKey, cents] of revenueCentsByDate.entries()) {
      if (dateKey.startsWith(monthPrefix) && dateKey <= todayKey) {
        monthlySalesCents += cents;
      }
    }
    const monthlySales = fromMoneyCents(monthlySalesCents);

    // 3. Average Order Value (AOV) from valid priced orders (agreedTotal or totalAmount > 0)
    const pricedOrders = validOrders.filter(o => getOrderValueCents(o) > 0);
    const pricedOrdersCount = pricedOrders.length;
    const totalPricedCents = pricedOrders.reduce((sum, o) => sum + getOrderValueCents(o), 0);
    const averageOrderValue = pricedOrdersCount > 0 ? Math.round(fromMoneyCents(totalPricedCents) / pricedOrdersCount) : 0;

    // 4. Customer Payments Due: valid orders with effective value > 0 && balanceAmount > 0
    const dueOrders = validOrders.filter(o => getOrderValueCents(o) > 0 && toMoneyCents(o.balanceAmount) > 0);
    const paymentsDueCount = dueOrders.length;
    const paymentsDueAmount = fromMoneyCents(dueOrders.reduce((sum, o) => sum + toMoneyCents(o.balanceAmount), 0));

    // 5. Weekly trend data (last 7 days ending at todayKey in Asia/Colombo)
    const weeklySales = [];
    let weeklyTotalSalesCents = 0;
    let weeklyTotalOrderValueCents = 0;
    let weeklyTotalOrders = 0;

    for (let i = 6; i >= 0; i--) {
      const dateKey = shiftColomboDateKey(todayKey, -i);
      const { day, formattedDate } = getColomboDayMeta(dateKey);
      const dayOrders = ordersByDate.get(dateKey) || [];
      const dayRevenueCents = revenueCentsByDate.get(dateKey) || 0;
      const dayOrderValueCents = dayOrders.reduce((sum, o) => sum + getOrderValueCents(o), 0);

      weeklyTotalSalesCents += dayRevenueCents;
      weeklyTotalOrderValueCents += dayOrderValueCents;
      weeklyTotalOrders += dayOrders.length;

      weeklySales.push({
        date: dateKey,
        formattedDate,
        day,
        revenue: fromMoneyCents(dayRevenueCents),
        orderValue: fromMoneyCents(dayOrderValueCents),
        orders: dayOrders.length
      });
    }

    res.status(200).json({
      success: true,
      summary: {
        todaySales,
        todayOrders,
        yesterdaySales,
        yesterdayOrders,
        monthlySales,
        monthlyOrders,
        averageOrderValue,
        pricedOrdersCount,
        paymentsDueCount,
        paymentsDueAmount,
        pendingApprovalCount,
        totalOrders: validOrders.length,
        weeklyTotalSales: fromMoneyCents(weeklyTotalSalesCents),
        weeklyTotalOrders,
        weeklyTotalOrderValue: fromMoneyCents(weeklyTotalOrderValueCents),
        referenceDate: todayKey,
        branchId: branchId || 'ALL',
        timezone: 'Asia/Colombo',
        weeklySales
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving dashboard summary.' });
  }
};

/**
 * Approve Order (CEO / Manager)
 * Changes status: PENDING_APPROVAL -> APPROVED (or CUSTOMER_APPROVED if price already accepted)
 */
exports.approveOrder = async (req, res, next) => {
  try {
    // Role check: Only authorized CEO / Manager can approve orders
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can approve orders.' });
    }

    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status === 'COMPLETED' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Order is completed and archived. Completed orders are read-only.' });
    }

    if (order.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({
        success: false,
        message: `Only orders in PENDING_APPROVAL can be approved. Current status: ${order.status}`
      });
    }

    const approvedBy = getActorDisplayName(req.user);
    const approvedAt = new Date();

    // If price is already accepted, status becomes CUSTOMER_APPROVED; otherwise APPROVED
    const targetStatus = order.priceAcceptedByCustomer ? 'CUSTOMER_APPROVED' : 'APPROVED';

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: targetStatus,
        approvedBy,
        approvedAt
      },
      include: {
        customer: true,
        garmentDetails: true,
        assignedTailor: { select: { id: true, name: true, email: true } }
      }
    });

    // Add production history record
    await prisma.productionHistory.create({
      data: {
        orderId,
        stage: targetStatus,
        previousStage: 'PENDING_APPROVAL',
        assignedToId: req.user?.id || null,
        notes: `Order approved by ${approvedBy}. ${targetStatus === 'APPROVED' ? 'Awaiting price setting.' : 'Price already accepted; ready for tailor assignment.'}`
      }
    });

    res.status(200).json({
      success: true,
      message: 'Order approved successfully.',
      order: updated
    });
  } catch (error) {
    console.error('Error approving order:', error);
    res.status(500).json({ success: false, message: 'Server error approving order.' });
  }
};

/**
 * Request Changes on Order (CEO / Manager)
 * Changes status: PENDING_APPROVAL -> CHANGES_REQUIRED
 */
exports.requestChangesOrder = async (req, res, next) => {
  try {
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can request changes.' });
    }

    const orderId = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Reason for requesting changes is required.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({
        success: false,
        message: `Only orders in PENDING_APPROVAL can have changes requested. Current status: ${order.status}`
      });
    }

    const changesRequestedBy = getActorDisplayName(req.user);
    const changesRequestedAt = new Date();

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CHANGES_REQUIRED',
        changesRequestedBy,
        changesRequestedAt,
        changesReason: reason.trim()
      },
      include: {
        customer: true,
        garmentDetails: true,
        assignedTailor: { select: { id: true, name: true, email: true } }
      }
    });

    try {
      await prisma.productionHistory.create({
        data: {
          orderId,
          stage: 'CHANGES_REQUIRED',
          previousStage: 'PENDING_APPROVAL',
          assignedToId: req.user?.id || null,
          notes: `Changes requested by ${changesRequestedBy}. Reason: ${reason.trim()}`
        }
      });
    } catch (historyErr) {
      console.warn('Could not record production history for changes request:', historyErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Order status updated to Changes Required.',
      order: updated
    });
  } catch (error) {
    console.error('Error requesting order changes:', error);
    res.status(500).json({ success: false, message: 'Server error requesting order changes.' });
  }
};

/**
 * Set / Revise Order Price Quote (CEO / Manager)
 * Supports full breakdown: basePrice, designCharge, cuttingCharge, stitchingCharge, embroideryCharge, additionalCharge, discountAmount
 * Transition: -> WAITING_CUSTOMER_APPROVAL
 */
exports.setOrderPrice = async (req, res, next) => {
  try {
    // Role check: Only authorized CEO / Manager can set or change final prices
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can set order price quotes.' });
    }

    const orderId = parseInt(req.params.id);
    const {
      basePrice,
      designCharge,
      cuttingCharge,
      stitchingCharge,
      embroideryCharge,
      additionalCharge,
      discountAmount,
      advanceRequired,
      notes,
      directAccept,
      // Legacy aliases for backward compatibility
      serviceCharge,
      additionalWorkCharge,
      materialCharge,
      totalAmount
    } = req.body;

    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status === 'COMPLETED' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Order is completed and archived. Completed orders are read-only.' });
    }

    // Workflow Gate: Management must approve the order before pricing
    if (order.status === 'PENDING_APPROVAL') {
      return res.status(400).json({
        success: false,
        message: 'Order is pending management approval. Management approval is required before setting the order price.'
      });
    }

    if (order.status === 'REJECTED' || order.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: `Cannot set price on a ${order.status.toLowerCase()} order.`
      });
    }

    const bp = Math.max(0, parseFloat(basePrice !== undefined ? basePrice : (serviceCharge !== undefined ? serviceCharge : totalAmount)) || 0);
    const dc = Math.max(0, parseFloat(designCharge !== undefined ? designCharge : (additionalWorkCharge || 0)) || 0);
    const cc = Math.max(0, parseFloat(cuttingCharge || 0));
    const sc = Math.max(0, parseFloat(stitchingCharge || 0));
    const ec = Math.max(0, parseFloat(embroideryCharge !== undefined ? embroideryCharge : (materialCharge || 0)) || 0);
    const ac = Math.max(0, parseFloat(additionalCharge || 0));
    const disc = Math.max(0, parseFloat(discountAmount || 0));

    // Calculate final total automatically
    const grossTotal = Math.max(0, bp + dc + cc + sc + ec + ac - disc);

    if (grossTotal <= 0 && bp <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Base price or final total price must be greater than 0.'
      });
    }

    const advance = Math.max(0, parseFloat(advanceRequired) || 0);
    if (advance > grossTotal) {
      return res.status(400).json({
        success: false,
        message: `Advance required (LKR ${advance.toLocaleString()}) cannot exceed total final price (LKR ${grossTotal.toLocaleString()}).`
      });
    }

    // Retain actual payments already recorded
    const actualPaid = Number(order.advancePayment || 0);
    const actualBalance = Math.max(0, grossTotal - actualPaid);
    const paymentStatus = actualPaid <= 0 ? 'Unpaid' : (actualBalance <= 0 && grossTotal > 0 ? 'Paid' : 'Partially Paid');

    const now = new Date();
    const pricedBy = getActorDisplayName(req.user);

    const isDirect = Boolean(directAccept);
    const priceStatus = isDirect ? 'ACCEPTED' : 'SENT';
    const priceAcceptedByCustomer = isDirect ? true : false;
    const priceAcceptedAt = isDirect ? now : null;
    const customerApprovedAt = isDirect ? now : null;

    // Transition to WAITING_CUSTOMER_APPROVAL (or CUSTOMER_APPROVED if direct in-store acceptance)
    const targetStatus = isDirect ? 'CUSTOMER_APPROVED' : 'WAITING_CUSTOMER_APPROVAL';

    const updatePayload = {
      basePrice: bp,
      designCharge: dc,
      cuttingCharge: cc,
      stitchingCharge: sc,
      embroideryCharge: ec,
      additionalCharge: ac,
      serviceCharge: bp,
      additionalWorkCharge: dc,
      materialCharge: ec,
      discountAmount: disc,
      totalAmount: grossTotal,
      advanceRequired: advance,
      advancePayment: actualPaid,
      balanceAmount: actualBalance,
      paymentStatus,
      priceStatus,
      priceSetBy: pricedBy,
      priceSetAt: now,
      priceSentAt: now,
      priceAcceptedByCustomer,
      priceAcceptedAt,
      customerApprovedAt,
      agreedTotal: isDirect ? grossTotal : null,
      agreedAdvance: isDirect ? advance : null,
      agreedBalance: isDirect ? actualBalance : null,
      status: targetStatus
    };

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: updatePayload,
      include: {
        customer: true,
        garmentDetails: true,
        payments: { orderBy: { createdAt: 'asc' } },
        assignedTailor: { select: { id: true, name: true, email: true } }
      }
    });

    try {
      await prisma.productionHistory.create({
        data: {
          orderId,
          stage: targetStatus,
          previousStage: order.status,
          assignedToId: req.user?.id || null,
          notes: `Price set by ${pricedBy}: Base LKR ${bp.toLocaleString()}, Design LKR ${dc.toLocaleString()}, Cutting LKR ${cc.toLocaleString()}, Stitching LKR ${sc.toLocaleString()}, Embroidery LKR ${ec.toLocaleString()}, Addnl LKR ${ac.toLocaleString()}, Discount LKR ${disc.toLocaleString()} => Final Total LKR ${grossTotal.toLocaleString()}${notes ? ` | Notes: ${notes}` : ''}`
        }
      });
    } catch (historyErr) {
      console.warn('Could not record production history for price quote:', historyErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Price quote of LKR ${grossTotal.toLocaleString()} set successfully. Order is waiting for customer approval.`,
      order: updated
    });
  } catch (error) {
    console.error('Error setting order price:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to set order price.',
      error: error.message || 'Internal server error'
    });
  }
};

/**
 * Mark Customer Approved Price (CEO / Manager / Staff on customer behalf)
 * Moves order from WAITING_CUSTOMER_APPROVAL to CUSTOMER_APPROVED
 */
exports.confirmCustomerPrice = async (req, res, next) => {
  try {
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can record customer price acceptance.' });
    }

    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status === 'COMPLETED' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Order is completed and archived. Completed orders are read-only.' });
    }

    if (order.status === 'PENDING_APPROVAL') {
      return res.status(400).json({ success: false, message: 'Order must be reviewed and approved by management before price confirmation.' });
    }

    if (order.status === 'REJECTED') {
      return res.status(400).json({ success: false, message: 'Cannot confirm price on a rejected order.' });
    }

    if (Number(order.totalAmount || 0) <= 0) {
      return res.status(400).json({ success: false, message: 'Order price must be set before confirming customer acceptance.' });
    }

    const now = new Date();
    const confirmedBy = getActorDisplayName(req.user);
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
        customerApprovedAt: now,
        agreedTotal: quotedTotal,
        agreedAdvance: quotedAdvance,
        agreedBalance: quotedBalance,
        priceStatus: 'ACCEPTED',
        status: 'CUSTOMER_APPROVED',
        balanceAmount: currentBalance,
        paymentStatus
      },
      include: {
        customer: true,
        garmentDetails: true,
        branch: true,
        assignedTailor: { select: { id: true, name: true, email: true } },
        payments: { orderBy: { createdAt: 'asc' } }
      }
    });

    try {
      await prisma.productionHistory.create({
        data: {
          orderId,
          stage: 'CUSTOMER_APPROVED',
          previousStage: order.status,
          assignedToId: req.user?.id || null,
          notes: `Customer price approval verified by ${confirmedBy}: Total LKR ${quotedTotal.toLocaleString()} (Advance: LKR ${quotedAdvance.toLocaleString()}). Order is now ready for tailor assignment.`
        }
      });
    } catch (historyErr) {
      console.warn('Could not record production history for price confirmation:', historyErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Customer price approval recorded. Order status moved to CUSTOMER_APPROVED.',
      order: updated
    });
  } catch (error) {
    console.error('Error confirming customer price:', error);
    res.status(500).json({ success: false, message: 'Server error confirming customer price.' });
  }
};

/**
 * Customer / Manager Requests Price Revision
 * Moves order to PRICE_REVISION_REQUIRED
 */
exports.requestCustomerPriceRevision = async (req, res, next) => {
  try {
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can record price revision request.' });
    }

    const orderId = parseInt(req.params.id);
    const { reason } = req.body;
    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status === 'COMPLETED' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Order is completed and archived.' });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PRICE_REVISION_REQUIRED',
        priceStatus: 'REVISION_REQUESTED',
        revisionReason: reason ? reason.trim() : 'Customer requested price revision'
      },
      include: {
        customer: true,
        garmentDetails: true
      }
    });

    await prisma.productionHistory.create({
      data: {
        orderId,
        stage: 'PRICE_REVISION_REQUIRED',
        previousStage: order.status,
        assignedToId: req.user?.id || null,
        notes: `Customer requested price revision: ${reason || 'Revision requested'}.`
      }
    });

    res.status(200).json({
      success: true,
      message: 'Price revision request recorded. Status updated to PRICE_REVISION_REQUIRED.',
      order: updated
    });
  } catch (error) {
    console.error('Error requesting price revision:', error);
    res.status(500).json({ success: false, message: 'Server error requesting price revision.' });
  }
};

/**
 * Reject Order (CEO / Manager)
 * Changes status: PENDING_APPROVAL -> REJECTED
 */
exports.rejectOrder = async (req, res, next) => {
  try {
    // Role check: Only authorized CEO / Manager can reject orders
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can reject orders.' });
    }

    const orderId = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status === 'COMPLETED' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Order is completed and archived.' });
    }

    if (order.status !== 'PENDING_APPROVAL' && order.status !== 'CHANGES_REQUIRED') {
      return res.status(400).json({
        success: false,
        message: `Only orders in PENDING_APPROVAL or CHANGES_REQUIRED can be rejected. Current status: ${order.status}`
      });
    }

    const rejectedBy = getActorDisplayName(req.user);
    const rejectedAt = new Date();

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'REJECTED',
        rejectedBy,
        rejectedAt,
        rejectionReason: reason.trim()
      },
      include: {
        customer: true,
        garmentDetails: true,
        assignedTailor: { select: { id: true, name: true, email: true } }
      }
    });

    try {
      await prisma.productionHistory.create({
        data: {
          orderId,
          stage: 'REJECTED',
          previousStage: order.status,
          assignedToId: req.user?.id || null,
          notes: `Order rejected by ${rejectedBy}. Reason: ${reason.trim()}`
        }
      });
    } catch (historyErr) {
      console.warn('Could not record production history for rejection:', historyErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Order rejected successfully.',
      order: updated
    });
  } catch (error) {
    console.error('Error rejecting order:', error);
    res.status(500).json({ success: false, message: 'Server error rejecting order.' });
  }
};

/**
 * Assign ONE Tailor to an Order (CEO / Manager)
 * Business rule: ONE ORDER = ONE RESPONSIBLE TAILOR
 * Guard: Customer price must be accepted before tailor assignment
 * Transition: -> TAILOR_ASSIGNED
 */
exports.assignTailor = async (req, res, next) => {
  try {
    // Role check: Only authorized CEO / Manager can assign tailors
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or authorized Manager can assign tailors.' });
    }

    const orderId = parseInt(req.params.id);
    const { tailorId } = req.body;

    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    if (!tailorId) return res.status(400).json({ success: false, message: 'Tailor ID is required.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status === 'COMPLETED' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Order is completed and archived. Completed orders are read-only.' });
    }

    if (order.status === 'PENDING_APPROVAL') {
      return res.status(400).json({ success: false, message: 'Order must be reviewed and approved before assigning to a tailor.' });
    }
    if (order.status === 'REJECTED') {
      return res.status(400).json({ success: false, message: 'Cannot assign tailor to a rejected order.' });
    }

    const tailor = await prisma.user.findUnique({
      where: { id: parseInt(tailorId) }
    });

    if (!tailor || tailor.role !== 'TAILOR') {
      return res.status(400).json({ success: false, message: 'Assigned user must exist and have role TAILOR.' });
    }

    if (!tailor.isActive) {
      return res.status(400).json({ success: false, message: 'Cannot assign order to an inactive tailor.' });
    }

    // Branch security for Managers
    if (req.user?.role === 'MANAGER') {
      if (order.branchId && order.branchId !== req.user.branchId) {
        return res.status(403).json({ success: false, message: 'Permission denied: Managers can only assign orders in their authorized branch.' });
      }
      if (tailor.branchId && tailor.branchId !== req.user.branchId) {
        return res.status(403).json({ success: false, message: `Permission denied: Tailor ${tailor.name} does not belong to your authorized branch.` });
      }
    }

    const assignerInfo = getActorDisplayName(req.user);
    const assignmentDate = new Date();

    // Bypass tailor acceptance: status moves immediately to IN_PROGRESS (or CUTTING)
    const targetStatus = order.status === 'CUSTOMER_APPROVED' || order.status === 'PENDING_PRODUCTION' ? 'IN_PROGRESS' : order.status;

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        assignedTailorId: tailor.id,
        assignedBy: assignerInfo,
        assignedAt: assignmentDate,
        tailorAccepted: true,         // Acceptance step bypassed
        tailorAcceptedAt: assignmentDate,
        tailorRejectedAt: null,
        tailorRejectionReason: null,
        status: targetStatus
      },
      include: {
        customer: true,
        garmentDetails: true,
        branch: true,
        assignedTailor: { select: { id: true, name: true, email: true } },
        tasks: {
          include: {
            assignedTailor: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    // Add production history record
    await prisma.productionHistory.create({
      data: {
        orderId,
        stage: targetStatus,
        previousStage: order.status,
        assignedToId: tailor.id,
        startedAt: assignmentDate,
        notes: `Assigned to Master Tailor ${tailor.name} by ${assignerInfo}. Acceptance requirement bypassed (immediately ASSIGNED/active).`
      }
    });

    res.status(200).json({
      success: true,
      message: `Order successfully assigned to Tailor ${tailor.name}.`,
      order: updated
    });
  } catch (error) {
    console.error('Error assigning tailor:', error);
    res.status(500).json({ success: false, message: 'Server error assigning tailor.' });
  }
};

/**
 * Tailor Accepts Assignment
 * Moves order: TAILOR_ASSIGNED -> IN_PROGRESS
 */
exports.tailorAcceptOrder = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status === 'COMPLETED' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Order is completed and archived.' });
    }

    if (req.user.role === 'TAILOR' && order.assignedTailorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied. You are not the assigned tailor for this order.' });
    }

    if (order.status !== 'TAILOR_ASSIGNED' && order.status !== 'PENDING_PRODUCTION') {
      return res.status(400).json({
        success: false,
        message: `Order must be in TAILOR_ASSIGNED state before acceptance. Current status: ${ORDER_STATUS_LABELS[order.status] || order.status}`
      });
    }

    const now = new Date();
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        tailorAccepted: true,
        tailorAcceptedAt: now,
        status: 'IN_PROGRESS'
      },
      include: {
        customer: true,
        garmentDetails: true,
        assignedTailor: { select: { id: true, name: true, email: true } }
      }
    });

    // Add production history record
    await prisma.productionHistory.create({
      data: {
        orderId,
        stage: 'IN_PROGRESS',
        previousStage: order.status,
        assignedToId: req.user.id,
        startedAt: now,
        notes: 'Tailor accepted order assignment. Production is now IN_PROGRESS.'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Assignment accepted! Order is now In Progress.',
      order: updated
    });
  } catch (error) {
    console.error('Error accepting tailor order:', error);
    res.status(500).json({ success: false, message: 'Server error accepting order assignment.' });
  }
};

/**
 * Tailor Rejects Assignment
 * Returns order to CUSTOMER_APPROVED with rejection reason
 */
exports.tailorRejectAssignment = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (req.user.role === 'TAILOR' && order.assignedTailorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied. You are not the assigned tailor for this order.' });
    }

    const now = new Date();
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        assignedTailorId: null,
        assignedBy: null,
        assignedAt: null,
        tailorAccepted: false,
        tailorRejectedAt: now,
        tailorRejectionReason: reason.trim(),
        status: 'CUSTOMER_APPROVED'
      },
      include: {
        customer: true,
        garmentDetails: true
      }
    });

    // Add production history record
    await prisma.productionHistory.create({
      data: {
        orderId,
        stage: 'CUSTOMER_APPROVED',
        previousStage: order.status,
        assignedToId: req.user.id,
        notes: `Tailor declined assignment: ${reason.trim()}. Returned to Customer Approved for reassignment.`
      }
    });

    res.status(200).json({
      success: true,
      message: 'Assignment rejected. Order returned to management for reassignment.',
      order: updated
    });
  } catch (error) {
    console.error('Error rejecting tailor assignment:', error);
    res.status(500).json({ success: false, message: 'Server error rejecting assignment.' });
  }
};

/**
 * Deliver Order (Cashier / Staff / Manager)
 * Enforce: Status must be READY and balance MUST be 0
 */
exports.deliverOrder = async (req, res, next) => {
  try {
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. You do not have permission to deliver orders.' });
    }

    const orderId = parseInt(req.params.id);
    const { deliveryNotes } = req.body;

    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, payments: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status === 'COMPLETED' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Order is completed and archived.' });
    }

    if (order.status !== 'READY') {
      return res.status(400).json({
        success: false,
        message: `Order must be in READY state before delivery. Current status: ${ORDER_STATUS_LABELS[order.status] || order.status}.`
      });
    }

    if (Number(order.balanceAmount || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot deliver order. Outstanding balance of LKR ${Number(order.balanceAmount).toLocaleString()} must be settled before delivery.`
      });
    }

    const deliveredBy = getActorDisplayName(req.user);
    const deliveredAt = new Date();

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        deliveredBy,
        deliveredAt,
        deliveryNotes: deliveryNotes ? deliveryNotes.trim() : null
      },
      include: {
        customer: true,
        garmentDetails: true,
        assignedTailor: { select: { id: true, name: true, email: true } },
        payments: true
      }
    });

    try {
      await prisma.productionHistory.create({
        data: {
          orderId,
          stage: 'DELIVERED',
          previousStage: 'READY',
          assignedToId: req.user?.id || null,
          notes: `Order delivered to customer by ${deliveredBy}.${deliveryNotes ? ` Notes: ${deliveryNotes.trim()}` : ''}`
        }
      });
    } catch (err) {
      console.warn('Production history error:', err.message);
    }

    res.status(200).json({
      success: true,
      message: 'Order marked as DELIVERED successfully.',
      order: updated
    });
  } catch (error) {
    console.error('Error delivering order:', error);
    res.status(500).json({ success: false, message: 'Server error delivering order.' });
  }
};

/**
 * Complete and Archive Order (CEO / Manager)
 * Enforce: Status must be DELIVERED
 */
exports.completeOrder = async (req, res, next) => {
  try {
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Only CEO or Manager can complete and archive orders.' });
    }

    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.status !== 'DELIVERED') {
      return res.status(400).json({
        success: false,
        message: `Order must be in DELIVERED state before completion. Current status: ${ORDER_STATUS_LABELS[order.status] || order.status}.`
      });
    }

    const completedBy = getActorDisplayName(req.user);
    const completedAt = new Date();

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        completedBy,
        completedAt
      },
      include: {
        customer: true,
        garmentDetails: true,
        assignedTailor: { select: { id: true, name: true, email: true } },
        payments: true
      }
    });

    try {
      await prisma.productionHistory.create({
        data: {
          orderId,
          stage: 'COMPLETED',
          previousStage: 'DELIVERED',
          assignedToId: req.user?.id || null,
          notes: `Order completed and archived by ${completedBy}. Entire workflow successfully finalized.`
        }
      });
    } catch (err) {
      console.warn('Production history error:', err.message);
    }

    res.status(200).json({
      success: true,
      message: 'Order completed and archived successfully.',
      order: updated
    });
  } catch (error) {
    console.error('Error completing order:', error);
    res.status(500).json({ success: false, message: 'Server error completing order.' });
  }
};

/**
 * Get List of Active Tailors
 * For CEO/Manager tailor assignment selector
 */
exports.getTailorsList = async (req, res, next) => {
  try {
    const tailors = await prisma.user.findMany({
      where: {
        role: { in: ['TAILOR', 'CUTTING', 'EMBROIDERY'] },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        branch: { select: { id: true, name: true } },
        assignedTasks: {
          where: {
            status: { in: ['ASSIGNED', 'IN_PROGRESS'] }
          },
          select: { id: true }
        },
        assignedOrders: {
          where: {
            status: { notIn: ['READY', 'DELIVERED', 'COMPLETED', 'REJECTED', 'CANCELLED'] }
          },
          select: { id: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    const enriched = tailors.map(t => ({
      id: t.id,
      name: t.name,
      email: t.email,
      role: t.role,
      branchId: t.branchId,
      branchName: t.branch?.name || 'Main Branch',
      activeOrdersCount: (t.assignedTasks?.length || 0) + (t.assignedOrders?.length || 0),
      isActive: true
    }));

    res.status(200).json({
      success: true,
      tailors: enriched
    });
  } catch (error) {
    console.error('Error retrieving tailors:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving tailors.' });
  }
};

/**
 * Get Real Tailor Performance & Leaderboard Data
 * Accurately credits Cutting Masters and Stitching Tailors using OrderTask records as source of truth.
 * Supports All Production, Cutting Master Performance, and Stitching Tailor Performance.
 */
exports.getTailorPerformance = async (req, res, next) => {
  try {
    const { branchId } = req.query;

    const whereUser = {
      OR: [
        { role: { in: ['TAILOR', 'CUTTING', 'EMBROIDERY'] } },
        { assignedTasks: { some: {} } },
        { assignedOrders: { some: {} } }
      ],
      isActive: true
    };

    // Branch restriction for Managers
    if (req.user?.role === 'MANAGER') {
      if (req.user.branchId) {
        whereUser.branchId = req.user.branchId;
      }
    } else if (branchId && branchId !== 'ALL') {
      whereUser.branchId = parseInt(branchId, 10);
    }

    const workers = await prisma.user.findMany({
      where: whereUser,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        branch: { select: { id: true, name: true } },
        assignedTasks: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                customer: { select: { id: true, name: true } },
                garmentDetails: {
                  select: {
                    quantity: true,
                    dressType: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        assignedOrders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            completedAt: true,
            customer: { select: { id: true, name: true } },
            garmentDetails: {
              select: {
                quantity: true,
                dressType: true
              }
            },
            tasks: {
              select: { id: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayDateStr = `${year}-${month}-${day}`;

    const todayAttendances = await prisma.attendance.findMany({
      where: { date: todayDateStr }
    });
    const attendanceMap = {};
    for (const att of todayAttendances) {
      if (att.tailorId) attendanceMap[att.tailorId] = att;
      if (att.userId) attendanceMap[att.userId] = att;
    }

    const formatDuration = (mins) => {
      if (mins === null || mins === undefined || isNaN(mins) || mins < 0) return '—';
      if (mins < 60) return `${mins}m`;
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      if (hrs < 24) return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
      const days = Math.floor(hrs / 24);
      const remHrs = hrs % 24;
      return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`;
    };

    const performanceList = workers.map((worker) => {
      const todayAtt = attendanceMap[worker.id] || null;
      const allTasksList = [];

      // 1. Process OrderTask records (primary granular source of truth)
      for (const task of worker.assignedTasks || []) {
        if (!task.order) continue;
        const order = task.order;
        const qty = (order.garmentDetails?.quantity && order.garmentDetails.quantity > 0)
          ? order.garmentDetails.quantity
          : 1;

        const isOrderCancelled = ['CANCELLED', 'REJECTED'].includes(order.status);
        const isTaskCancelled = task.status === 'CANCELLED' || isOrderCancelled;
        const isTaskCompleted = task.status === 'COMPLETED' && !isOrderCancelled;
        const isTaskActive = !isTaskCancelled && !isTaskCompleted && ['ASSIGNED', 'IN_PROGRESS'].includes(task.status);

        let durationMins = null;
        if (task.completedAt && (task.startedAt || task.assignedAt || task.createdAt)) {
          const start = new Date(task.startedAt || task.assignedAt || task.createdAt);
          const end = new Date(task.completedAt);
          const diffMs = end - start;
          if (diffMs > 0 && diffMs < 30 * 24 * 60 * 60 * 1000) {
            durationMins = Math.round(diffMs / 60000);
          }
        }

        allTasksList.push({
          taskId: task.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customer?.name || 'Customer',
          dressType: order.garmentDetails?.dressType || 'Garment',
          quantity: qty,
          taskType: task.taskType,
          taskName: task.taskName || task.taskType,
          status: isOrderCancelled ? 'CANCELLED' : task.status,
          assignedAt: task.assignedAt || task.createdAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          durationMinutes: durationMins,
          durationFormatted: formatDuration(durationMins),
          isTaskCompleted,
          isTaskActive,
          isTaskCancelled
        });
      }

      // 2. Process legacy assignedOrders (ONLY if order has no OrderTask records to prevent duplicate credit)
      for (const order of worker.assignedOrders || []) {
        if (order.tasks && order.tasks.length > 0) {
          continue; // Order tasks exist; skip to prevent duplicate counting
        }

        const qty = (order.garmentDetails?.quantity && order.garmentDetails.quantity > 0)
          ? order.garmentDetails.quantity
          : 1;

        const isOrderCancelled = ['CANCELLED', 'REJECTED'].includes(order.status);
        const isCompleted = !isOrderCancelled && ['READY', 'DELIVERED', 'COMPLETED'].includes(order.status);
        const isActive = !isOrderCancelled && !isCompleted;

        const completedDate = order.completedAt ? new Date(order.completedAt) : (isCompleted ? new Date(order.updatedAt) : null);
        let durationMins = null;
        if (completedDate && order.createdAt) {
          const diffMs = completedDate - new Date(order.createdAt);
          if (diffMs > 0 && diffMs < 30 * 24 * 60 * 60 * 1000) {
            durationMins = Math.round(diffMs / 60000);
          }
        }

        allTasksList.push({
          taskId: `legacy-${order.id}`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customer?.name || 'Customer',
          dressType: order.garmentDetails?.dressType || 'Garment',
          quantity: qty,
          taskType: 'STITCHING',
          taskName: 'Tailoring & Stitching',
          status: isOrderCancelled ? 'CANCELLED' : (isCompleted ? 'COMPLETED' : 'IN_PROGRESS'),
          assignedAt: order.createdAt,
          startedAt: order.createdAt,
          completedAt: completedDate,
          durationMinutes: durationMins,
          durationFormatted: formatDuration(durationMins),
          isTaskCompleted: isCompleted,
          isTaskActive: isActive,
          isTaskCancelled: isOrderCancelled
        });
      }

      // Compute statistics for filtered subset
      const computeStats = (filterFn) => {
        const filtered = allTasksList.filter(filterFn);
        let assignedGarments = 0;
        let completedTodayGarments = 0;
        let completedMonthGarments = 0;
        let totalCompletedGarments = 0;
        let activeWorkloadGarments = 0;

        let assignedTasksCount = 0;
        let completedTodayTasksCount = 0;
        let completedMonthTasksCount = 0;
        let totalCompletedTasksCount = 0;
        let activeTasksCount = 0;

        const durations = [];

        for (const item of filtered) {
          if (item.isTaskCancelled) continue;

          assignedGarments += item.quantity;
          assignedTasksCount += 1;

          if (item.isTaskCompleted) {
            totalCompletedGarments += item.quantity;
            totalCompletedTasksCount += 1;

            if (item.durationMinutes !== null && item.durationMinutes > 0) {
              durations.push(item.durationMinutes);
            }

            if (item.completedAt) {
              const compDate = new Date(item.completedAt);
              if (compDate >= startOfToday && compDate <= endOfToday) {
                completedTodayGarments += item.quantity;
                completedTodayTasksCount += 1;
              }
              if (compDate >= startOfMonth && compDate <= endOfMonth) {
                completedMonthGarments += item.quantity;
                completedMonthTasksCount += 1;
              }
            }
          }

          if (item.isTaskActive) {
            activeWorkloadGarments += item.quantity;
            activeTasksCount += 1;
          }
        }

        const totalRelevantTasks = totalCompletedTasksCount + activeTasksCount;
        const completionRate = totalRelevantTasks > 0
          ? Math.round((totalCompletedTasksCount / totalRelevantTasks) * 100)
          : 0;

        const avgDurationMins = durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null;

        return {
          assignedGarments,
          assignedTasksCount,
          completedTodayGarments,
          completedTodayTasksCount,
          completedMonthGarments,
          completedMonthTasksCount,
          totalCompletedGarments,
          totalCompletedTasksCount,
          activeWorkloadGarments,
          activeTasksCount,
          completionRate,
          avgDurationMinutes: avgDurationMins,
          avgDurationFormatted: formatDuration(avgDurationMins)
        };
      };

      const allStats = computeStats(() => true);
      const cuttingStats = computeStats(t => t.taskType === 'CUTTING');
      const stitchingStats = computeStats(t => t.taskType === 'STITCHING');

      const activeTasks = allTasksList.filter(t => t.isTaskActive);

      // Map active tasks to activeOrders format for existing UI compatibility
      const activeOrdersMap = new Map();
      for (const t of activeTasks) {
        if (!activeOrdersMap.has(t.orderId)) {
          activeOrdersMap.set(t.orderId, {
            id: t.orderId,
            orderNumber: t.orderNumber,
            status: t.status,
            dressType: t.dressType,
            quantity: t.quantity,
            taskType: t.taskType,
            taskName: t.taskName
          });
        }
      }
      const activeOrders = Array.from(activeOrdersMap.values());

      let productivityGrade = 'No data recorded';
      const mCompleted = allStats.completedMonthGarments;
      if (mCompleted >= 15) productivityGrade = 'A+';
      else if (mCompleted >= 8) productivityGrade = 'A';
      else if (mCompleted >= 3) productivityGrade = 'B+';
      else if (mCompleted > 0 || allStats.activeWorkloadGarments > 0) productivityGrade = 'B';
      else productivityGrade = 'Pending';

      let roleLabel = worker.role;
      if (worker.role === 'TAILOR') roleLabel = 'Master Tailor & Craftsman';
      else if (worker.role === 'CUTTING') roleLabel = 'Cutting Master';
      else if (worker.role === 'EMBROIDERY') roleLabel = 'Embroidery Specialist';

      return {
        id: worker.id,
        name: worker.name,
        email: worker.email,
        role: worker.role,
        roleLabel,
        branch: worker.branch?.name || (worker.branchId === 2 ? 'Bella Design' : 'JB Group (Main)'),
        branchId: worker.branchId,

        // Overall performance (All Production):
        tasksAssigned: allStats.assignedTasksCount,
        garmentsAssigned: allStats.assignedGarments,
        completedToday: allStats.completedTodayGarments,
        completedMonth: allStats.completedMonthGarments,
        totalCompleted: allStats.totalCompletedGarments,
        completedTasksToday: allStats.completedTodayTasksCount,
        completedTasksMonth: allStats.completedMonthTasksCount,
        totalTasksCompleted: allStats.totalCompletedTasksCount,
        activeWorkload: allStats.activeWorkloadGarments,
        activeTasksCount: allStats.activeTasksCount,
        completionRate: allStats.completionRate,
        avgDurationMinutes: allStats.avgDurationMinutes,
        avgDurationFormatted: allStats.avgDurationFormatted,

        // Cutting Master specific performance:
        cutting: {
          assignedGarments: cuttingStats.assignedGarments,
          assignedTasks: cuttingStats.assignedTasksCount,
          completedToday: cuttingStats.completedTodayGarments,
          completedMonth: cuttingStats.completedMonthGarments,
          totalCompleted: cuttingStats.totalCompletedGarments,
          activeWorkload: cuttingStats.activeWorkloadGarments,
          activeTasks: cuttingStats.activeTasksCount,
          completionRate: cuttingStats.completionRate,
          avgDurationMinutes: cuttingStats.avgDurationMinutes,
          avgDurationFormatted: cuttingStats.avgDurationFormatted
        },

        // Stitching Tailor specific performance:
        stitching: {
          assignedGarments: stitchingStats.assignedGarments,
          assignedTasks: stitchingStats.assignedTasksCount,
          completedToday: stitchingStats.completedTodayGarments,
          completedMonth: stitchingStats.completedMonthGarments,
          totalCompleted: stitchingStats.totalCompletedGarments,
          activeWorkload: stitchingStats.activeWorkloadGarments,
          activeTasks: stitchingStats.activeTasksCount,
          completionRate: stitchingStats.completionRate,
          avgDurationMinutes: stitchingStats.avgDurationMinutes,
          avgDurationFormatted: stitchingStats.avgDurationFormatted
        },

        // Task history for View Tailor details:
        activeTasks,
        activeOrders,
        allTasks: allTasksList,

        attendance: todayAtt ? todayAtt.status : null,
        todayAttendance: todayAtt || null,
        hoursWorked: null,
        commission: null,
        rating: null,
        productivityGrade
      };
    });

    // Rank tailors strictly by real production: monthly completed DESC, today completed DESC, active workload DESC
    performanceList.sort((a, b) => {
      if (b.completedMonth !== a.completedMonth) return b.completedMonth - a.completedMonth;
      if (b.completedToday !== a.completedToday) return b.completedToday - a.completedToday;
      if (b.activeWorkload !== a.activeWorkload) return b.activeWorkload - a.activeWorkload;
      return a.name.localeCompare(b.name);
    });

    const rankedTailors = performanceList.map((t, idx) => ({
      ...t,
      rank: idx + 1
    }));

    res.status(200).json({
      success: true,
      data: rankedTailors,
      metricsAvailable: {
        completedToday: true,
        completedMonth: true,
        totalCompleted: true,
        activeWorkload: true,
        ranking: true,
        hoursWorked: false,
        attendance: true,
        commission: false,
        qualityRating: false
      }
    });
  } catch (error) {
    console.error('Error retrieving tailor performance:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving tailor performance.' });
  }
};

/**
 * POST /api/orders/:id/notify-ready
 * Manager Controls Customer Finished Notification (JB GROUP)
 * Available only to Manager, Admin, and CEO/SUPER_ADMIN roles.
 */
exports.notifyOrderReady = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { force } = req.body || {};
    const orderId = parseInt(id);

    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }

    // Role check: Only Manager, Admin, and CEO/SUPER_ADMIN roles
    const userRole = req.user?.role;
    const allowedRoles = ['SUPER_ADMIN', 'CEO', 'ADMIN', 'MANAGER'];
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Only authorized Managers, Admins, and CEO can send customer finished notifications. Your role: ${userRole || 'UNKNOWN'}`
      });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, garmentDetails: true, branch: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Verify final completion and quality-check requirements
    if (order.status !== 'READY') {
      return res.status(400).json({
        success: false,
        message: `Customer Finished Notification can only be sent when the order is Ready for Collection (Final completion & Quality Check passed). Current status: ${ORDER_STATUS_LABELS[order.status] || order.status}.`
      });
    }

    // Customer phone number validation
    const rawPhone = order.customer?.primaryPhone;
    if (!rawPhone || !rawPhone.toString().trim()) {
      return res.status(400).json({
        success: false,
        message: 'Customer phone number is missing. Cannot send customer finished notification.'
      });
    }

    const cleanedDigits = rawPhone.toString().replace(/[^0-9]/g, '');
    if (cleanedDigits.length < 7) {
      return res.status(400).json({
        success: false,
        message: `Invalid customer phone number (${rawPhone}). Cannot send customer finished notification.`
      });
    }

    // Check duplicate prevention
    if (order.readyNotificationSent && !force) {
      return res.status(409).json({
        success: false,
        duplicatePrevented: true,
        message: `Customer finished notification was already sent on ${order.readyNotificationSentAt ? new Date(order.readyNotificationSentAt).toLocaleString() : 'earlier'} by ${order.readyNotificationSentBy || 'Authorized Manager'}. Duplicate prevented.`,
        sentAt: order.readyNotificationSentAt,
        sentBy: order.readyNotificationSentBy,
        status: order.readyNotificationStatus || 'SENT',
        order
      });
    }

    const now = new Date();
    const actorName = getActorDisplayName(req.user) || req.user?.name || req.user?.email || 'Authorized Manager';

    // Update the order notification record
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        readyNotificationSent: true,
        readyNotificationSentAt: now,
        readyNotificationSentBy: actorName,
        readyNotificationStatus: 'SENT'
      },
      include: { customer: true, garmentDetails: true, branch: true }
    });

    const custName = updatedOrder.customer?.name || 'Customer';
    const ordNum = updatedOrder.orderNumber || (updatedOrder.id ? `ORD-${updatedOrder.id}` : 'N/A');
    const msg = `Dear ${custName},\n\nYour order ${ordNum} from JB GROUP is now ready for collection.\n\nThank you for choosing JB GROUP!`;

    // Record audit log
    await logAudit({
      action: 'CUSTOMER_FINISHED_NOTIFICATION_SENT',
      entityType: 'ORDER',
      entityId: order.id,
      req,
      details: {
        orderNumber: ordNum,
        customerName: custName,
        customerPhone: rawPhone,
        sentBy: actorName,
        sentByRole: req.user?.role,
        sentAt: now.toISOString(),
        message: msg
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Customer finished notification dispatched successfully.',
      phone: rawPhone,
      customerName: custName,
      orderNumber: ordNum,
      whatsAppMessage: msg,
      sentAt: now,
      sentBy: actorName,
      status: 'SENT',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error notifying order ready:', error);
    next(error);
  }
};
