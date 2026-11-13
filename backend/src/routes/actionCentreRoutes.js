const express = require('express');
const router = express.Router();
const actionCentreController = require('../controllers/actionCentreController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

router.use(authenticateToken);

// All management and staff roles can access the Daily Action Centre
router.get(
  '/',
  authorizeRoles('SUPER_ADMIN', 'CEO', 'ADMIN', 'MANAGER', 'STAFF', 'Manager'),
  actionCentreController.getActionCentreData
);

// Record or complete follow-up
router.post(
  '/follow-ups',
  authorizeRoles('SUPER_ADMIN', 'CEO', 'ADMIN', 'MANAGER', 'STAFF', 'Manager'),
  actionCentreController.saveFollowUp
);

// Complete or update manager daily checklist item (Only MANAGER / ADMIN can update their own branch checklist; CEO is Read-Only)
router.post(
  '/checklist/complete',
  authorizeRoles('ADMIN', 'MANAGER', 'Manager'),
  actionCentreController.completeChecklistItem
);

// CEO / Super Admin Checklist Monitoring across all branches
router.get(
  '/checklist/monitoring',
  authorizeRoles('SUPER_ADMIN', 'CEO'),
  actionCentreController.getChecklistMonitoring
);

module.exports = router;

