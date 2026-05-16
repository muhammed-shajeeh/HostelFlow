const express = require('express');
const { check } = require('express-validator');
const {
  markRoomAttendance,
  getDailyAttendance,
  getAttendanceSummary,
  getStudentAttendanceHistory
} = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authMiddleware);

// ======================================================
// WARDEN / ADMIN ROUTES
// ======================================================
router.post('/mark', 
  roleMiddleware('ADMIN', 'WARDEN'),
  [
    check('roomId', 'Room ID is required').notEmpty(),
    check('date', 'Date is required').isISO8601(),
    check('attendanceRecords', 'Attendance records array is required').isArray()
  ],
  markRoomAttendance
);

router.get('/daily', roleMiddleware('ADMIN', 'WARDEN'), getDailyAttendance);
router.get('/summary', roleMiddleware('ADMIN', 'WARDEN'), getAttendanceSummary);

// ======================================================
// STUDENT ROUTES
// ======================================================
router.get('/student/history', roleMiddleware('STUDENT'), getStudentAttendanceHistory);

module.exports = router;
