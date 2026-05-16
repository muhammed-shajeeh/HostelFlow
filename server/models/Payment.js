const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
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
  billType: {
    type: String,
    enum: ['MESS_BILL', 'HOSTEL_FEE', 'COMBINED'],
    required: true
  },
  messBillId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MessBill'
  },
  hostelFeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HostelFee'
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  amount: {
    type: Number,
    required: true
  },
  razorpayOrderId: {
    type: String,
    required: true,
    unique: true
  },
  razorpayPaymentId: {
    type: String
  },
  razorpaySignature: {
    type: String
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED'],
    default: 'PENDING'
  },
  paymentMethod: {
    type: String
  },
  paidAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for fast receipt retrieval and payment audit logs
paymentSchema.index({ studentId: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
