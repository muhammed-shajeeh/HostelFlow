const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Hostel name is required'],
    unique: true,
    trim: true
  },
  hostelCode: {
    type: String,
    required: [true, 'Hostel code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  gender: {
    type: String,
    enum: ['BOYS', 'GIRLS', 'MIXED'],
    required: true
  },
  description: {
    type: String
  },
  totalFloors: {
    type: Number,
    required: [true, 'Total floors are required'],
    min: [1, 'Minimum 1 floor is required']
  },
  totalRooms: {
    type: Number,
    default: 0
  },
  warden: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Hostel', hostelSchema);
