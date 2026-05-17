const express = require('express');
const { getAuditLogs } = require('../controllers/auditController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Strict security perimeter gating: Only authenticated Main Admins allowed
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

router.get('/', getAuditLogs);

module.exports = router;
