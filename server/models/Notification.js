const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  type: {
    type: String,
    enum: [
      'LEAVE_APPROVED',
      'LEAVE_REJECTED',
      'LEAVE_REQUESTED',
      'NEW_COMPLAINT',
      'COMPLAINT_RESOLVED',
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
  isRead: {
    type: Boolean,
    default: false
  },
  actionUrl: {
    type: String,
    default: ''
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', NotificationSchema);
