const mongoose = require('mongoose');

// ======================================================
// COMPLAINT MODEL
// ======================================================
// Tracks student-submitted maintenance and grievance
// complaints. Supports a multi-step status lifecycle:
// OPEN -> IN_PROGRESS -> RESOLVED (or REJECTED)
// Enforces hostel isolation so wardens only see their own.
// ======================================================

const complaintSchema = new mongoose.Schema(
  {
    // The student who filed this complaint
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required']
    },

    // Hostel isolation key — every query filters by this
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'Hostel reference is required']
    },

    // Room from which the complaint originates
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room'
    },

    // Short, descriptive title of the issue
    title: {
      type: String,
      required: [true, 'Complaint title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters']
    },

    // Detailed description of the problem
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },

    // Category of the issue for routing/analytics
    category: {
      type: String,
      enum: [
        'ELECTRICAL',
        'PLUMBING',
        'FURNITURE',
        'WIFI',
        'CLEANING',
        'SECURITY',
        'HARASSMENT',
        'MESS',
        'ROOM_CHANGE',
        'OTHER'
      ],
      required: [true, 'Category is required']
    },

    // Priority set by student, can be overridden by warden
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM'
    },

    // Current lifecycle state of the complaint
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
      default: 'OPEN'
    },

    // Warden/Admin who took ownership of this complaint
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    // Warden's notes when closing/resolving the complaint
    resolutionNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Resolution notes cannot exceed 1000 characters']
    },

    // Timestamp when the complaint was marked RESOLVED or REJECTED
    resolvedAt: {
      type: Date
    },

    // Who resolved it (warden or admin _id)
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    // Placeholder for future image uploads via Multer
    // Currently stored as a URL string after upload
    image: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true // Adds createdAt and updatedAt automatically
  }
);

// ======================================================
// PERFORMANCE INDEXES
// ======================================================
// Compound indexes for the most common query patterns:
// - Wardens listing complaints for their hostel
// - Students viewing their own complaints
// - Dashboard analytics filtering by status/priority
// ======================================================

complaintSchema.index({ hostelId: 1, status: 1 });
complaintSchema.index({ hostelId: 1, priority: 1 });
complaintSchema.index({ hostelId: 1, category: 1 });
complaintSchema.index({ studentId: 1, createdAt: -1 });
complaintSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Complaint', complaintSchema);
