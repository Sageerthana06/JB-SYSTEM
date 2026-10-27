const express = require('express');
const router = express.Router();
const customerPortalController = require('../controllers/customerPortalController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { handleMultipartUpload } = require('../middleware/uploadMiddleware');

// Public endpoints
router.post('/register', customerPortalController.register);
router.post('/login', customerPortalController.login);
router.post('/forgot-password/send-otp', customerPortalController.sendOtp);
router.post('/forgot-password', customerPortalController.forgotPassword);

// Authenticated customer endpoints
router.get('/me', authenticateToken, customerPortalController.getProfile);
router.put('/profile', authenticateToken, handleMultipartUpload, customerPortalController.updateProfile);
router.get('/orders', authenticateToken, customerPortalController.getMyOrders);
router.get('/orders/:id', authenticateToken, customerPortalController.getMyOrderById);
router.post('/orders', authenticateToken, customerPortalController.createCustomerOrder);
router.get('/measurements/latest', authenticateToken, customerPortalController.getLatestMeasurement);
router.get('/measurements', authenticateToken, customerPortalController.getMeasurementHistory);
router.post('/orders/:id/accept-price', authenticateToken, customerPortalController.acceptPrice);
router.post('/orders/:id/decline-price', authenticateToken, customerPortalController.declinePrice);
router.post('/orders/:id/payment-slip', authenticateToken, handleMultipartUpload, customerPortalController.uploadPaymentSlip);

router.put('/change-password', authenticateToken, customerPortalController.changePassword);

module.exports = router;
