const express = require('express');
const {
  getAdminAnalytics,
  getWardenAnalytics,
  getStudentAnalytics,
  exportData
} = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authMiddleware);

// Admin-only: system-wide analytics
router.get('/admin', roleMiddleware('ADMIN'), getAdminAnalytics);

// Warden-only: hostel-scoped analytics
router.get('/warden', roleMiddleware('WARDEN'), getWardenAnalytics);

// Student-only: personal analytics
router.get('/student', roleMiddleware('STUDENT'), getStudentAnalytics);

// Export CSV — Admin or Warden
// ?type=attendance|complaints|leaves
router.get('/export', roleMiddleware('ADMIN', 'WARDEN'), exportData);

module.exports = router;
