const mongoose = require('mongoose');

const dailyMealRecordSchema = new mongoose.Schema({
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
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  
  // Granular Meal Statuses
  breakfastIncluded: {
    type: Boolean,
    default: true
  },
  lunchIncluded: {
    type: Boolean,
    default: true
  },
  dinnerIncluded: {
    type: Boolean,
    default: true
  },

  // Independent Tracking Reasons
  breakfastReason: {
    type: String,
    enum: [
      'AUTO_INCLUDED_BY_ATTENDANCE',
      'MANUAL_SKIP',
      'APPROVED_LEAVE',
      'LATE_RETURN',
      'ADMIN_OVERRIDE',
      'WARDEN_OVERRIDE',
      'AUTO_RESUME'
    ],
    default: 'AUTO_INCLUDED_BY_ATTENDANCE'
  },
  lunchReason: {
    type: String,
    enum: [
      'AUTO_INCLUDED_BY_ATTENDANCE',
      'MANUAL_SKIP',
      'APPROVED_LEAVE',
      'LATE_RETURN',
      'ADMIN_OVERRIDE',
      'WARDEN_OVERRIDE',
      'AUTO_RESUME'
    ],
    default: 'AUTO_INCLUDED_BY_ATTENDANCE'
  },
  dinnerReason: {
    type: String,
    enum: [
      'AUTO_INCLUDED_BY_ATTENDANCE',
      'MANUAL_SKIP',
      'APPROVED_LEAVE',
      'LATE_RETURN',
      'ADMIN_OVERRIDE',
      'WARDEN_OVERRIDE',
      'AUTO_RESUME'
    ],
    default: 'AUTO_INCLUDED_BY_ATTENDANCE'
  },

  // References
  attendanceReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendance'
  },
  leaveReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Leave'
  },

  // Audit Logs
  manuallyModified: {
    type: Boolean,
    default: false
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  modifiedAt: {
    type: Date
  },
  finalized: {
    type: Boolean,
    default: false,
    index: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Performance optimization and duplicate prevention compound index
dailyMealRecordSchema.index({ studentId: 1, date: 1 }, { unique: true });
dailyMealRecordSchema.index({ hostelId: 1, date: 1 });

module.exports = mongoose.model('DailyMealRecord', dailyMealRecordSchema);
