const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// All user management routes require authentication
router.use(authenticateToken);

// Branches can be read by anyone authenticated
router.get('/branches', userController.getBranches);

router.use(authorizeRoles('SUPER_ADMIN'));

router.get('/', userController.listUsers);
router.post('/', userController.createUser);
router.patch('/:id', userController.updateUser);
router.delete('/:id', userController.deactivateUser);

module.exports = router;
