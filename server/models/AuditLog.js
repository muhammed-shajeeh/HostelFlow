const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
    // null for SYSTEM/automated actions
  },
  actorName: {
    type: String,
    required: true
  },
  actorRole: {
    type: String,
    enum: ['ADMIN', 'WARDEN', 'STUDENT', 'PARENT', 'SYSTEM'],
    default: 'SYSTEM'
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    index: true
  },
  actionType: {
    type: String,
    required: true,
    index: true
  },
  entityType: {
    type: String,
    enum: ['USER', 'ATTENDANCE', 'LEAVE', 'BILLING', 'PAYMENT', 'SECURITY', 'COMPLAINT', 'NOTICE', 'SYSTEM'],
    required: true,
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['INFO', 'IMPORTANT', 'WARNING', 'CRITICAL'],
    default: 'INFO',
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  }
}, {
  timestamps: true
});

// Compound indexes for optimal timeline querying and filtering
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entityType: 1, severity: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
