const express = require('express');
const router = express.Router();
const {
  getTomorrowMealStatus,
  toggleTomorrowMeals,
  getTomorrowCounts,
  getMessDues,
  handleFeeConfig,
  createBillingCycleDraft,
  regenerateBillingCycleDraft,
  finalizeBillingCycle,
  getBillingCycles,
  getCycleInvoices,
  updateInvoiceAdjustments,
  createInvoicePaymentOrder,
  verifyInvoicePayment,
  getLedger,
  getReceiptDetails,
  sendPaymentReminder,
  refundInvoice,
  exportFinancialReport,
  freezeMealsManual,
  overrideDailyMealRecord,
  getStudentMealLedger
} = require('../controllers/messController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Protect all routes
router.use(authMiddleware);

// Daily meal status & planning
router.get('/tomorrow-meals', roleMiddleware('STUDENT'), getTomorrowMealStatus);
router.post('/toggle-tomorrow', roleMiddleware('STUDENT'), toggleTomorrowMeals);
router.get('/tomorrow-counts', roleMiddleware('WARDEN', 'ADMIN'), getTomorrowCounts);

// Frozen Daily Ledger manual override, freeze and student logs
router.post('/freeze-meals', roleMiddleware('WARDEN', 'ADMIN'), freezeMealsManual);
router.post('/override-meals', roleMiddleware('WARDEN', 'ADMIN'), overrideDailyMealRecord);
router.get('/meal-ledger/:studentId', getStudentMealLedger);

// Fee Configuration Engine (Warden can view, Admin can edit)
router.get('/fee-config', handleFeeConfig);
router.post('/fee-config', roleMiddleware('ADMIN'), handleFeeConfig);

// Billing Cycles Workflow (Admin only can finalize!)
router.get('/billing-cycles', roleMiddleware('WARDEN', 'ADMIN'), getBillingCycles);
router.post('/billing-cycles', roleMiddleware('WARDEN', 'ADMIN'), createBillingCycleDraft);
router.post('/billing-cycles/:id/regenerate', roleMiddleware('WARDEN', 'ADMIN'), regenerateBillingCycleDraft);
router.post('/billing-cycles/:id/finalize', roleMiddleware('ADMIN'), finalizeBillingCycle); // Restrict to Admin!
router.get('/billing-cycles/:id/invoices', roleMiddleware('WARDEN', 'ADMIN'), getCycleInvoices);

// Draft Adjustments & Ledger (Warden/Admin scoped)
router.put('/invoices/:id', roleMiddleware('WARDEN', 'ADMIN'), updateInvoiceAdjustments);
router.get('/ledger', roleMiddleware('WARDEN', 'ADMIN'), getLedger);

// Reminders, Exports & Refunds (ERP Phase 7, 9 & 11)
router.post('/send-reminder', roleMiddleware('WARDEN', 'ADMIN'), sendPaymentReminder);
router.get('/export-report', roleMiddleware('WARDEN', 'ADMIN'), exportFinancialReport);
router.post('/refund-invoice', roleMiddleware('ADMIN'), refundInvoice); // Admin only refunding!

// Payments & Receipts (Student & Parent)
router.get('/dues/:studentId', getMessDues);
router.post('/pay-invoice', roleMiddleware('STUDENT', 'PARENT'), createInvoicePaymentOrder);
router.post('/verify-invoice', roleMiddleware('STUDENT', 'PARENT'), verifyInvoicePayment);
router.get('/receipts/:paymentId', getReceiptDetails);

module.exports = router;
