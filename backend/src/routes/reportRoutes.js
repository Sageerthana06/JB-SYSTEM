const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// All report endpoints require authentication and management roles
router.use(authenticateToken);

// GET /api/reports/daily — CEO (SUPER_ADMIN), Admin, and Manager
router.get(
  '/daily',
  authorizeRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CEO'),
  reportController.getDailyReports
);

module.exports = router;
