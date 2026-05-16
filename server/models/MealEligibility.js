const mongoose = require('mongoose');

const mealEligibilitySchema = new mongoose.Schema({
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
  date: {
    type: Date,
    required: true
  },
  breakfast: {
    type: Boolean,
    default: true
  },
  lunch: {
    type: Boolean,
    default: true
  },
  dinner: {
    type: Boolean,
    default: true
  },
  skippedManually: {
    type: Boolean,
    default: false
  },
  skippedByLeave: {
    type: Boolean,
    default: false
  },
  leaveReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Leave'
  }
}, {
  timestamps: true
});

// Performance optimization: Indexes for fast querying on date and student/hostel filters
mealEligibilitySchema.index({ studentId: 1, date: 1 }, { unique: true });
mealEligibilitySchema.index({ hostelId: 1, date: 1 });

module.exports = mongoose.model('MealEligibility', mealEligibilitySchema);
