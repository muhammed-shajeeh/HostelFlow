const express = require('express');
const { check } = require('express-validator');
const {
  requestLeave,
  getPendingLeaves,
  getLeaveHistory,
  getStudentLeaveHistory,
  approveLeave,
  rejectLeave,
  verifyQR,
  getLeaveStats
} = require('../controllers/leaveController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authMiddleware);

// ======================================================
// STUDENT ROUTES
// ======================================================
router.post('/request', 
  roleMiddleware('STUDENT'),
  [
    check('leaveType', 'Invalid leave type').isIn(['HOME', 'DAY_PASS', 'EMERGENCY', 'MEDICAL', 'OTHER']),
    check('reason', 'Reason must be at least 5 characters').isLength({ min: 5 }),
    check('destination', 'Destination is required').notEmpty(),
    check('emergencyContact', 'Emergency contact is required').notEmpty(),
    check('departureDate', 'Departure date is required').isISO8601(),
    check('expectedReturnDate', 'Expected return date is required').isISO8601(),
  ],
  requestLeave
);

router.get('/student/history', roleMiddleware('STUDENT'), getStudentLeaveHistory);

// ======================================================
// WARDEN / ADMIN ROUTES
// ======================================================
router.get('/pending', roleMiddleware('ADMIN', 'WARDEN'), getPendingLeaves);
router.get('/history', roleMiddleware('ADMIN', 'WARDEN'), getLeaveHistory);

router.put('/:id/approve', roleMiddleware('ADMIN', 'WARDEN'), approveLeave);
router.put('/:id/reject', 
  roleMiddleware('ADMIN', 'WARDEN'), 
  [check('rejectionReason', 'Rejection reason is mandatory').notEmpty()],
  rejectLeave
);

// This can be accessed by ADMIN, WARDEN, and SECURITY role
router.post('/verify-qr', roleMiddleware('ADMIN', 'WARDEN', 'SECURITY'), verifyQR);

// ======================================================
// DASHBOARD STATS
// ======================================================
// Can be accessed by Student (sees own), Warden (sees hostel), Admin (sees all)
router.get('/stats', getLeaveStats);

module.exports = router;
