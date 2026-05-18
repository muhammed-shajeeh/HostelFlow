const mongoose = require('mongoose');

const RoomTransferSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  oldHostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel'
  },
  newHostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel'
  },
  oldRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  },
  newRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  oldBedNumber: {
    type: Number
  },
  newBedNumber: {
    type: Number
  },
  transferredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    default: 'Room reassignment'
  },
  transferredAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('RoomTransfer', RoomTransferSchema);
