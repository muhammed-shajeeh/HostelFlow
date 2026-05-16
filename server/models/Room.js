const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
    required: [true, 'Hostel ID is required']
  },
  roomNumber: {
    type: String,
    required: [true, 'Room number is required'],
    trim: true
  },
  floor: {
    type: Number,
    required: [true, 'Floor is required'],
    min: [1, 'Minimum floor is 1']
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: [1, 'Minimum capacity is 1'],
    max: [10, 'Maximum capacity is 10']
  },
  occupiedBeds: {
    type: Number,
    default: 0,
    min: [0, 'Occupied beds cannot be negative']
  },
  availableBeds: {
    type: Number
  },
  roomType: {
    type: String,
    enum: ['SINGLE', 'DOUBLE', 'TRIPLE', 'DORMITORY'],
    required: true
  },
  gender: {
    type: String,
    enum: ['BOYS', 'GIRLS', 'MIXED'],
    required: true
  },
  departmentPreference: [{
    type: String
  }],
  batchPreference: [{
    type: String
  }],
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Pre-save middleware to auto-calculate availableBeds
roomSchema.pre("save", async function () {

  this.availableBeds = this.capacity - this.occupiedBeds;

  if (this.availableBeds < 0) {
    throw new Error("Room capacity exceeded");
  }

});


// Ensure roomNumber is unique within the same hostel
roomSchema.index({ hostelId: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);
