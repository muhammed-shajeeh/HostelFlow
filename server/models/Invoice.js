const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true,
    index: true
  },
  billingCycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillingCycle',
    required: true,
    index: true
  },
  month: {
    type: String, // Format: YYYY-MM
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'PARTIAL', 'FAILED', 'OVERDUE', 'REFUNDED'],
    default: 'PENDING',
    index: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  
  // Snapshots of entities at the exact moment of generation for historical audit safety
  studentSnapshot: {
    fullName: String,
    admissionNumber: String,
    email: String,
    parentEmail: String,
    parentPhone: String
  },
  roomSnapshot: {
    roomNumber: String,
    floor: Number
  },
  hostelSnapshot: {
    name: String,
    hostelCode: String
  },

  // Financial components
  messMealRate: {
    type: Number,
    required: true
  },
  eligibleMeals: {
    type: Number,
    required: true
  },
  skippedMeals: {
    type: Number,
    required: true
  },
  messCharges: {
    type: Number,
    required: true
  },
  totalBreakfasts: {
    type: Number,
    default: 0
  },
  totalLunches: {
    type: Number,
    default: 0
  },
  totalDinners: {
    type: Number,
    default: 0
  },
  breakfastRateUsed: {
    type: Number,
    default: 0
  },
  lunchRateUsed: {
    type: Number,
    default: 0
  },
  dinnerRateUsed: {
    type: Number,
    default: 0
  },
  messTotal: {
    type: Number,
    default: 0
  },
  hostelRent: {
    type: Number,
    required: true
  },
  maintenanceFee: {
    type: Number,
    required: true
  },
  electricityFee: {
    type: Number,
    required: true
  },
  
  // Previous outstanding dues calculation snapshot
  previousBalance: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  fine: {
    type: Number,
    default: 0
  },
  adjustments: {
    type: Number,
    default: 0
  },
  adjustmentNotes: {
    type: String
  },
  totalAmount: {
    type: Number,
    required: true
  },
  amountPaid: {
    type: Number,
    default: 0
  },

  // Gateway integration
  razorpayOrderId: {
    type: String,
    index: true
  },
  paidAt: {
    type: Date
  },
  finalizedAt: {
    type: Date
  },
  lateFineApplied: {
    type: Boolean,
    default: false
  },
  lateFineAppliedAt: {
    type: Date
  },
  remindersCount: {
    type: Number,
    default: 0
  },
  lastReminderSentAt: {
    type: Date
  },
  financialHold: {
    type: Boolean,
    default: false
  },
  paymentTimeline: [{
    event: { type: String, required: true },
    date: { type: Date, default: Date.now },
    details: { type: String },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Invoice', invoiceSchema);
