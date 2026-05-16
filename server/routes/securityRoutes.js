const express = require('express');
const {
  getSecurityAccounts,
  createSecurityAccount,
  resetSecurityPassword,
  toggleSecurityStatus,
  getSecurityShiftStats
} = require('../controllers/securityController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Require authenticated sessions
router.use(authMiddleware);

// Warden security management routes
router.get('/accounts', roleMiddleware('WARDEN'), getSecurityAccounts);
router.post('/accounts', roleMiddleware('WARDEN'), createSecurityAccount);
router.put('/accounts/:id/reset-password', roleMiddleware('WARDEN'), resetSecurityPassword);
router.put('/accounts/:id/toggle-status', roleMiddleware('WARDEN'), toggleSecurityStatus);

// Security guard shift dashboard stats route
router.get('/shift-stats', roleMiddleware('SECURITY'), getSecurityShiftStats);

module.exports = router;
