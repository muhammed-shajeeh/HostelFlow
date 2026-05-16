const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    minlength: [3, 'Full name must be at least 3 characters long']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // Do not return password by default
  },
  role: {
    type: String,
    enum: ['ADMIN', 'WARDEN', 'STUDENT', 'PARENT', 'SECURITY'],
    default: 'STUDENT'
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel'
  },
  admissionNumber: {
    type: String,
    unique: true,
    sparse: true // Allows multiple null values
  },
  department: {
    type: String
  },
  year: {
    type: String
  },
  semester: {
    type: String
  },
  parentName: {
    type: String
  },
  parentEmail: {
    type: String,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  emailOtp: {
    type: String
  },
  emailOtpExpiry: {
    type: Date
  },
  profileImage: {
    type: String
  },
  idProof: {
    type: String
  },
  linkedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  },
  bedNumber: {
    type: Number
  },
  studentPreferences: {
    sameDepartmentPreferred: { type: Boolean, default: false },
    sameBatchPreferred: { type: Boolean, default: false },
    preferredFloor: { type: Number },
    medicalNeeds: { type: String },
    specialNotes: { type: String }
  },
  approvalStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  parentPhone: {
    type: String
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  securityPinHash: {
    type: String
  },
  securityEnabled: {
    type: Boolean,
    default: true
  },
  lastSecurityLogin: {
    type: Date
  },
  securityLoginCount: {
    type: Number,
    default: 0
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  loginLockUntil: {
    type: Date
  }
}, {
  timestamps: true
});

// Pre-save middleware to hash password
userSchema.pre("save", async function () {

if (!this.isModified("password")) {
return;
}

const salt = await bcrypt.genSalt(10);

this.password = await bcrypt.hash(this.password, salt);

});


// Method to compare password
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to compare security PIN
userSchema.methods.comparePin = async function(enteredPin) {
  if (!this.securityPinHash) return false;
  return await bcrypt.compare(enteredPin, this.securityPinHash);
};

// ==========================================
// PERFORMANCE OPTIMIZATION: MONGODB INDEXES
// ==========================================
// Indexing role and hostelId speeds up warden/admin queries significantly
userSchema.index({ role: 1, hostelId: 1 });
userSchema.index({ approvalStatus: 1 });
userSchema.index({ roomId: 1 });

module.exports = mongoose.model('User', userSchema);
