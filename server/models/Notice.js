const mongoose = require('mongoose');

// ======================================================
// NOTICE / ANNOUNCEMENT MODEL
// ======================================================
// Powers the hostel noticeboard system.
//
// Visibility rules:
//   targetType = GLOBAL  → visible to all users across all hostels
//   targetType = HOSTEL  → visible only to users in that specific hostel
//   visibleTo            → further narrows to specific roles (ALL / STUDENTS / WARDENS)
//
// Priority sort order (highest first):
//   EMERGENCY > IMPORTANT > NORMAL
//   Pinned notices always appear at the top regardless of priority.
//
// Expiration:
//   If expiresAt is set and is in the past, the notice is excluded from all queries.
// ======================================================

const noticeSchema = new mongoose.Schema(
  {
    // Short, descriptive heading for the notice
    title: {
      type: String,
      required: [true, 'Notice title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters']
    },

    // Full body content of the announcement
    content: {
      type: String,
      required: [true, 'Notice content is required'],
      trim: true,
      maxlength: [5000, 'Content cannot exceed 5000 characters']
    },

    // Warden or Admin who published this notice
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // GLOBAL = broadcast to all hostels; HOSTEL = one specific hostel only
    targetType: {
      type: String,
      enum: ['GLOBAL', 'HOSTEL'],
      default: 'HOSTEL'
    },

    // Required when targetType is HOSTEL; ignored for GLOBAL notices
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      default: null
    },

    // Controls visual prominence and sort order
    priority: {
      type: String,
      enum: ['NORMAL', 'IMPORTANT', 'EMERGENCY'],
      default: 'NORMAL'
    },

    // Pinned notices always appear above all others
    isPinned: {
      type: Boolean,
      default: false
    },

    // Optional auto-expiration date; expired notices are hidden from readers
    expiresAt: {
      type: Date,
      default: null
    },

    // Date/time at which the notice should be active and published
    publishAt: {
      type: Date,
      default: Date.now
    },

    // publishing state
    isPublished: {
      type: Boolean,
      default: true
    },

    // User who published this notice
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    // creator role snapshot
    creatorRole: {
      type: String,
      enum: ['ADMIN', 'WARDEN']
    },

    // target audience role
    audienceScope: {
      type: String,
      enum: ['ALL', 'STUDENTS', 'PARENTS', 'WARDENS'],
      default: 'ALL'
    },

    // recurrence options for automatic reminders
    recurrenceType: {
      type: String,
      enum: ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'],
      default: 'NONE'
    },

    isRecurring: {
      type: Boolean,
      default: false
    },

    parentRecurringId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notice',
      default: null
    },

    hasGeneratedNext: {
      type: Boolean,
      default: false
    },

    // Role-based filtering: ALL (every authenticated user), STUDENTS, WARDENS, PARENTS
    visibleTo: {
      type: String,
      enum: ['ALL', 'STUDENTS', 'WARDENS', 'PARENTS'],
      default: 'ALL'
    },

    // Placeholder for future file attachments (PDF, images, etc.)
    attachments: {
      type: [String],
      default: []
    },

    // Soft-delete flag: false = archived, not shown to users
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true // Adds createdAt and updatedAt
  }
);

// ======================================================
// PERFORMANCE INDEXES
// ======================================================
// These compound indexes match the most common query
// patterns: hostel-scoped filtering + sort by priority/pin.
// ======================================================

noticeSchema.index({ targetType: 1, hostelId: 1 });
noticeSchema.index({ isPinned: -1, priority: 1, createdAt: -1 });
noticeSchema.index({ hostelId: 1, isActive: 1 });
noticeSchema.index({ expiresAt: 1 });
noticeSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Notice', noticeSchema);
