const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// All user management routes require valid authentication
router.use(authenticateToken);

// Branches lookup can be read by authenticated users
router.get('/branches', userController.getBranches);

// Restrict all User Management API operations strictly to CEO/SUPER_ADMIN, ADMIN, and authorized MANAGER
// Staff, Tailor, and Cashier are strictly denied with 403 Forbidden
router.use(authorizeRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'));

// User & Employee Management Endpoints
router.get('/', userController.listUsers);
router.get('/employees', userController.listEligibleEmployees);
router.post('/', userController.createUser);
router.post('/link', userController.linkAccount);
router.post('/:id/reset-password', userController.initiatePasswordReset);
router.post('/:id/set-password', userController.setPasswordManually);
router.patch('/:id/status', userController.toggleUserStatus);
router.patch('/:id', userController.updateUser);
router.delete('/:id', userController.toggleUserStatus); // Backward compatibility soft-deactivate

module.exports = router;
