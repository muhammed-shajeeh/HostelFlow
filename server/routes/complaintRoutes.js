const express = require('express');
const { check } = require('express-validator');
const {
  createComplaint,
  getMyComplaints,
  getAllComplaints,
  getComplaintById,
  updateComplaintStatus,
  assignComplaint,
  getComplaintStats
} = require('../controllers/complaintController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// All complaint routes require a valid JWT token
router.use(authMiddleware);

// ── Stats route (all roles, scoped by role in controller) ──
router.get('/stats', getComplaintStats);

// ── Student-only routes ────────────────────────────────────
router.post(
  '/',
  roleMiddleware('STUDENT'),
  [
    check('title', 'Title is required').notEmpty(),
    check('description', 'Description must be at least 20 characters').isLength({ min: 20 }),
    check('category', 'Valid category is required').notEmpty()
  ],
  createComplaint
);

// Students see their own complaints
router.get('/my', roleMiddleware('STUDENT'), getMyComplaints);

// ── Warden/Admin routes ────────────────────────────────────
router.get('/', roleMiddleware('WARDEN', 'ADMIN'), getAllComplaints);

// Single complaint detail (must come after specific /my and /stats routes)
router.get('/:id', roleMiddleware('WARDEN', 'ADMIN'), getComplaintById);

// Update status: IN_PROGRESS, RESOLVED, REJECTED
router.put(
  '/:id/status',
  roleMiddleware('WARDEN', 'ADMIN'),
  [
    check('status', 'Valid status is required').isIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'])
  ],
  updateComplaintStatus
);

// Assign complaint to a staff member
router.put(
  '/:id/assign',
  roleMiddleware('WARDEN', 'ADMIN'),
  [
    check('assignedTo', 'Valid assignee ID is required').isMongoId()
  ],
  assignComplaint
);

module.exports = router;
