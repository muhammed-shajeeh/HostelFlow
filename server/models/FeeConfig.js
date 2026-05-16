const mongoose = require('mongoose');

const feeConfigSchema = new mongoose.Schema({
  hostelRent: {
    type: Number,
    required: true,
    default: 3000
  },
  maintenanceFee: {
    type: Number,
    required: true,
    default: 500
  },
  electricityFee: {
    type: Number,
    required: true,
    default: 300
  },
  messMealRate: {
    type: Number,
    required: true,
    default: 50
  },
  lateFineAmount: {
    type: Number,
    required: true,
    default: 200
  },
  effectiveFrom: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('FeeConfig', feeConfigSchema);
