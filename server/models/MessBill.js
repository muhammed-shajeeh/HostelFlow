const mongoose = require('mongoose');

const messBillSchema = new mongoose.Schema({
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
  totalMealsEligible: {
    type: Number,
    required: true
  },
  totalMealsSkipped: {
    type: Number,
    default: 0
  },
  consumedMeals: {
    type: Number,
    required: true
  },
  mealRate: {
    type: Number,
    required: true
  },
  specialCharges: {
    type: Number,
    default: 0
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

// Indexes for billing retrieval and dashboard stats
messBillSchema.index({ studentId: 1, month: 1 }, { unique: true });
messBillSchema.index({ hostelId: 1, status: 1 });

module.exports = mongoose.model('MessBill', messBillSchema);
