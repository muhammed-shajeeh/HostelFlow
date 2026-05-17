const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['STUDENT', 'PARENT', 'WARDEN', 'ADMIN'],
    required: true
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: false
  },
  deviceType: {
    type: String,
    enum: ['web', 'android'],
    required: true
  },
  fcmToken: {
    type: String,
    required: true,
    unique: true
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Ensure lightning fast lookups by token and userId
deviceTokenSchema.index({ fcmToken: 1 });
deviceTokenSchema.index({ userId: 1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
