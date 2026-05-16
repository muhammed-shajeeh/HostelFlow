const mongoose = require('mongoose');

const hostelFeeSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true
  },
  month: {
    type: String, // format: YYYY-MM (e.g. "2026-05")
    required: true
  },
  rent: {
    type: Number,
    required: true,
    default: 3000
  },
  maintenance: {
    type: Number,
    required: true,
    default: 500
  },
  electricity: {
    type: Number,
    required: true,
    default: 300
  },
  security: {
    type: Number,
    required: true,
    default: 200
  },
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED'],
    default: 'PENDING'
  },
  dueDate: {
    type: Date,
    required: true
  },
  paidAt: {
    type: Date
  },
  razorpayOrderId: {
    type: String
  }
}, {
  timestamps: true
});

// Unique index to prevent duplicate fixed billing entries per student per month
hostelFeeSchema.index({ studentId: 1, month: 1 }, { unique: true });
hostelFeeSchema.index({ hostelId: 1, status: 1 });

module.exports = mongoose.model('HostelFee', hostelFeeSchema);
