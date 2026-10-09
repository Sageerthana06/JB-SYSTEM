const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// All order routes require authentication
router.use(authenticateToken);

// Get all orders — management and production roles
router.get('/', authorizeRoles('ADMIN', 'MANAGER', 'STAFF', 'TAILOR', 'CUTTING', 'EMBROIDERY'), orderController.getAllOrders);

// Dashboard summary metrics — all authenticated staff/management
router.get('/dashboard-summary', orderController.getDashboardSummary);

// Get list of active tailors for assignment (Must be defined before /:id)
router.get('/tailors/list', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), orderController.getTailorsList);

// Get real tailor performance & leaderboard metrics (Must be defined before /:id)
router.get('/tailors/performance', authorizeRoles('ADMIN', 'MANAGER', 'STAFF', 'TAILOR', 'CUTTING', 'EMBROIDERY'), orderController.getTailorPerformance);

// Get orders by customer — all authenticated roles
router.get('/customer/:customerId', orderController.getCustomerOrders);

// Get a single order by ID — all authenticated roles
router.get('/:id', orderController.getOrderById);

// Generate Order PDF — all authenticated roles
router.get('/:id/pdf', orderController.generateOrderPdf);

// Get production history — all authenticated roles
router.get('/:id/history', orderController.getOrderHistory);

// Create order — order entry roles
router.post('/', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), orderController.createOrder);

// CEO / Manager Approval & Price Workflow
router.patch('/:id/approve', authorizeRoles('ADMIN', 'MANAGER'), orderController.approveOrder);
router.patch('/:id/request-changes', authorizeRoles('ADMIN', 'MANAGER'), orderController.requestChangesOrder);
router.patch('/:id/price', authorizeRoles('ADMIN', 'MANAGER'), orderController.setOrderPrice);
router.patch('/:id/confirm-price', authorizeRoles('ADMIN', 'MANAGER'), orderController.confirmCustomerPrice);
router.patch('/:id/request-price-revision', authorizeRoles('ADMIN', 'MANAGER'), orderController.requestCustomerPriceRevision);
router.patch('/:id/reject', authorizeRoles('ADMIN', 'MANAGER'), orderController.rejectOrder);
router.patch('/:id/assign-tailor', authorizeRoles('ADMIN', 'MANAGER'), orderController.assignTailor);

// Tailor Acceptance / Rejection Workflow
router.patch('/:id/tailor-accept', authorizeRoles('TAILOR'), orderController.tailorAcceptOrder);
router.patch('/:id/tailor-reject', authorizeRoles('TAILOR'), orderController.tailorRejectAssignment);

// Delivery & Completion Workflow
router.patch('/:id/deliver', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), orderController.deliverOrder);
router.patch('/:id/complete', authorizeRoles('ADMIN', 'MANAGER'), orderController.completeOrder);

// Update Order Status — production + management roles
router.patch(
  '/:id/status',
  authorizeRoles('ADMIN', 'MANAGER', 'STAFF', 'TAILOR', 'CUTTING', 'EMBROIDERY'),
  orderController.updateOrderStatus
);

// WhatsApp Ready Notification — management and staff
router.post(
  '/:id/notify-ready',
  authorizeRoles('ADMIN', 'MANAGER', 'STAFF', 'TAILOR'),
  orderController.notifyOrderReady
);

// Record payment — management, staff, cashier, manager
router.post(
  '/:id/payment',
  authorizeRoles('ADMIN', 'MANAGER', 'STAFF', 'Manager', 'CASHIER'),
  orderController.recordPayment
);

// Verify or reject customer payment slip (Manager / CEO / Admin)
router.patch(
  '/:id/payments/:paymentId/verify',
  authorizeRoles('ADMIN', 'MANAGER', 'CEO', 'SUPER_ADMIN'),
  orderController.verifyPaymentSlip
);
router.patch(
  '/:id/payments/:paymentId/reject',
  authorizeRoles('ADMIN', 'MANAGER', 'CEO', 'SUPER_ADMIN'),
  orderController.rejectPaymentSlip
);

module.exports = router;
