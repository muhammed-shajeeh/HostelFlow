const mongoose = require('mongoose');

const financialAuditLogSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  actorRole: {
    type: String,
    enum: ['ADMIN', 'WARDEN', 'STUDENT', 'PARENT'],
    required: true
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
      'FEE_CONFIG_UPDATED'
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
