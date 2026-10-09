const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// All attendance routes require authentication
router.use(authenticateToken);

// --- Self Attendance (Manager, Staff, Tailor) ---
router.get('/my-today', attendanceController.getMyTodayAttendance);
router.get('/my-history', attendanceController.getMyAttendanceHistory);
router.post('/clock-in', attendanceController.clockIn);
router.post('/clock-out', attendanceController.clockOut);

// --- CEO Attendance Center (CEO / Super Admin / Manager) ---
router.get('/ceo-center', authorizeRoles('ADMIN', 'MANAGER'), attendanceController.getCeoAttendanceCenter);

// --- Backward-Compatible & Tailor Details Endpoints ---
router.get('/today', authorizeRoles('ADMIN', 'MANAGER', 'STAFF', 'TAILOR'), attendanceController.getAllTodayAttendance);
router.get('/today/:tailorId', authorizeRoles('ADMIN', 'MANAGER', 'STAFF', 'TAILOR'), attendanceController.getTodayAttendanceByTailor);
router.post('/mark-present', authorizeRoles('ADMIN', 'MANAGER'), attendanceController.markPresent);
router.post('/mark-absent', authorizeRoles('ADMIN', 'MANAGER'), attendanceController.markAbsent);
router.post('/check-out', authorizeRoles('ADMIN', 'MANAGER'), attendanceController.checkOut);

module.exports = router;
