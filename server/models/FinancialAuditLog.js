const mongoose = require('mongoose');

const financialAuditLogSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
    // NOT required — system-generated events (e.g. overdue engine) have no actorId
  },
  actorRole: {
    type: String,
    enum: ['ADMIN', 'WARDEN', 'STUDENT', 'PARENT', 'SYSTEM'],
    default: 'SYSTEM'
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    index: true
  },
  actionType: {
    type: String,
    enum: [
      'BILL_GENERATED',
      'BILL_FINALIZED',
      'ADJUSTMENT_APPLIED',
      'PAYMENT_VERIFIED',
      'REFUND_ISSUED',
      'LATE_FINE_APPLIED',
      'PAYMENT_REMINDER_SENT',
      'FEE_CONFIG_UPDATED',
      'MEAL_OVERRIDE_APPLIED'
    ],
    required: true,
    index: true
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    index: true
  },
  billingCycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillingCycle',
    index: true
  },
  previousValue: {
    type: mongoose.Schema.Types.Mixed
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed
  },
  reason: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String
  }
}, {
  timestamps: true
});

financialAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('FinancialAuditLog', financialAuditLogSchema);
