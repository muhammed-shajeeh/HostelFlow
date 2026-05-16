const mongoose = require('mongoose');

const scanLogSchema = new mongoose.Schema({
  scannerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  action: {
    type: String,
    enum: ['EXIT', 'RETURN', 'FAILED'],
    required: true
  },
  success: {
    type: Boolean,
    required: true
  },
  errorMessage: {
    type: String
  },
  qrTokenHash: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Performance indexing for quick query of daily shifts and reports
scanLogSchema.index({ hostelId: 1, createdAt: -1 });
scanLogSchema.index({ scannerId: 1, createdAt: -1 });

module.exports = mongoose.model('ScanLog', scanLogSchema);
