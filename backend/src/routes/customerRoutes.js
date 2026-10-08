const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// All customer routes require authentication
router.use(authenticateToken);

// Search customers — all authenticated roles
router.get('/search', customerController.searchCustomer);

// Get customer measurements
router.get('/:id/measurements/latest', customerController.getLatestCustomerMeasurement);
router.get('/:id/measurements', customerController.getCustomerMeasurements);

// Get customer by ID — all authenticated roles
router.get('/:id', customerController.getCustomerById);

// Create customer ONLY (without order) - Admin-level and above (+ STAFF)
router.post('/register', authorizeRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'), customerController.registerCustomerOnly);

// Create customer AND order - Admin-level and above (+ STAFF who do order entry)
router.post('/', authorizeRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'), customerController.createCustomer);

// Update customer profile photo
router.patch('/:id/photo', authorizeRoles('ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER'), customerController.updateCustomerPhoto);

module.exports = router;

