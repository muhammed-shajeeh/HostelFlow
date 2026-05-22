const express = require('express');
const { createAlert, getActiveAlerts, resolveAlert } = require('../controllers/emergencyController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// All emergency operations require a secure, authenticated JWT session
router.use(authMiddleware);

// Students-only emergency SOS alert trigger
router.post('/alert', roleMiddleware('STUDENT'), createAlert);

// Wardens, Security Guards, and Admins can fetch active alerts or resolve them
router.get('/alerts/active', roleMiddleware('WARDEN', 'SECURITY', 'ADMIN'), getActiveAlerts);
router.put('/alerts/:id/resolve', roleMiddleware('WARDEN', 'SECURITY', 'ADMIN'), resolveAlert);

module.exports = router;
