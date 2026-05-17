const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['ADMIN', 'WARDEN', 'STUDENT', 'PARENT'],
    required: true
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel'
  },
  type: {
    type: String,
    enum: [
      'LEAVE_APPROVED',
      'LEAVE_REJECTED',
      'LEAVE_REQUESTED',
      'NEW_COMPLAINT',
      'COMPLAINT_RESOLVED',
      'PAYMENT_SUCCESS',
      'PAYMENT_OVERDUE',
      'NOTICE_POSTED',
      'ATTENDANCE_WARNING',
      'LOW_ATTENDANCE',
      'BILL_GENERATED',
      'ROOM_TRANSFER',
      'SYSTEM_ALERT',
      'EMERGENCY_NOTICE',
      'NEW_NOTICE',
      'PAYMENT_SUCCESSFUL',
      'OVERDUE_WARNING',
      'ATTENDANCE_ALERT',
      'LATE_RETURN_ALERT',
      'QR_EXIT_MARKED',
      'QR_RETURN_MARKED'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['NORMAL', 'IMPORTANT', 'EMERGENCY'],
    default: 'NORMAL'
  },
  relatedEntityId: {
    type: mongoose.Schema.Types.ObjectId
  },
  actionUrl: {
    type: String,
    default: ''
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Optimize query speeds with compound indexes for fetching unread lists quickly
NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
