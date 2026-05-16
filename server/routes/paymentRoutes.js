const express = require('express');
const router = express.Router();
const {
  createOrder,
  verifyPayment,
  issueRefund,
  getAdminPaymentAnalytics,
  handleWebhook
} = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// 1. PUBLIC WEBHOOK ENDPOINT (Must not be protected by authMiddleware!)
router.post('/webhook', handleWebhook);

// 2. PROTECTED ENDPOINTS
router.use(authMiddleware);

// Payments & Checkout (Student & Parent)
router.post('/create-order', roleMiddleware('STUDENT', 'PARENT'), createOrder);
router.post('/verify', roleMiddleware('STUDENT', 'PARENT'), verifyPayment);

// refunds (Admin only)
router.post('/refund', roleMiddleware('ADMIN'), issueRefund);

// Revenue & Transaction Analytics (Warden & Admin)
router.get('/analytics', roleMiddleware('WARDEN', 'ADMIN'), getAdminPaymentAnalytics);

module.exports = router;
