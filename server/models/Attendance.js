const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
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
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['PRESENT', 'ABSENT', 'ON_LEAVE', 'LATE_RETURN'],
    default: 'PRESENT'
  },
  remarks: {
    type: String
  },
  leaveReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Leave'
  },
  markedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ==========================================
// PERFORMANCE OPTIMIZATION: MONGODB INDEXES
// ==========================================
// Speeds up daily attendance, student history, and analytics queries
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true }); // Prevent duplicate attendance for same student on same date
attendanceSchema.index({ hostelId: 1, date: 1 });
attendanceSchema.index({ roomId: 1, date: 1 });
attendanceSchema.index({ status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
