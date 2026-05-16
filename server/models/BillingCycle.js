const mongoose = require('mongoose');

const billingCycleSchema = new mongoose.Schema({
  month: {
    type: String, // Format: YYYY-MM (e.g. "2026-05")
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['DRAFT', 'FINALIZED', 'CLOSED'],
    default: 'DRAFT'
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  finalizedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  finalizedAt: {
    type: Date
  },
  totalStudents: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BillingCycle', billingCycleSchema);
