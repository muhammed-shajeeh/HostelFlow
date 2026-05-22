const mongoose = require('mongoose');

const emergencyAlertSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required']
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'Hostel reference is required']
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room'
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'RESOLVED'],
      default: 'ACTIVE',
      required: true
    },
    resolvedAt: {
      type: Date
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Indexes for common query filters
emergencyAlertSchema.index({ hostelId: 1, status: 1 });
emergencyAlertSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('EmergencyAlert', emergencyAlertSchema);
