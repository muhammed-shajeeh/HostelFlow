const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
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
  leaveType: {
    type: String,
    enum: ['HOME', 'DAY_PASS', 'EMERGENCY', 'MEDICAL', 'OTHER'],
    required: true
  },
  reason: {
    type: String,
    required: true,
    minlength: 5
  },
  destination: {
    type: String,
    required: true
  },
  emergencyContact: {
    type: String,
    required: true
  },
  departureDate: {
    type: Date,
    required: true
  },
  expectedReturnDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXITED', 'RETURNED'],
    default: 'PENDING'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  qrToken: {
    type: String,
    unique: true,
    sparse: true
  },
  qrGenerated: {
    type: Boolean,
    default: false
  },
  exitedAt: {
    type: Date
  },
  returnedAt: {
    type: Date
  },
  securityVerifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  parentApprovalRequired: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// ==========================================
// PERFORMANCE OPTIMIZATION: MONGODB INDEXES
// ==========================================
// Speeds up warden dashboard and history queries
leaveSchema.index({ hostelId: 1, status: 1 });
leaveSchema.index({ studentId: 1 });
// qrToken already has a unique index from the schema definition

module.exports = mongoose.model('Leave', leaveSchema);
