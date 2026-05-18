const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { createAndEmitNotification, emitToRoom } = require('../utils/socket');

// ======================================================
// COMPLAINT CONTROLLER
// ======================================================
// Handles all complaint CRUD operations.
// 
// Security model:
//   STUDENT  → can create; can only read their OWN complaints
//   WARDEN   → can read/update; ONLY their hostel's complaints
//   ADMIN    → full access across all hostels
// ======================================================

// ──────────────────────────────────────────────────────
// STUDENT: Submit a new complaint
// POST /api/complaints
// ──────────────────────────────────────────────────────
const createComplaint = async (req, res, next) => {
  try {
    const { title, description, category, priority } = req.body;

    // Validate the authenticated student has a hostel assigned
    if (!req.user.hostelId) {
      return res.status(400).json({
        success: false,
        message: 'You must be allocated to a hostel before submitting a complaint.'
      });
    }

    // Create the complaint — hostelId and studentId pulled from JWT/auth context
    const complaint = await Complaint.create({
      studentId: req.user._id,
      hostelId: req.user.hostelId,         // Could be populated object; Mongoose handles both
      roomId: req.user.roomId || null,
      title,
      description,
      category,
      priority: priority || 'MEDIUM'
    });

    // Notify wardens about the new complaint
    const wardens = await User.find({ role: 'WARDEN', hostelId: req.user.hostelId }).select('_id').lean();
    for (const warden of wardens) {
      await createAndEmitNotification({
        recipientId: warden._id,
        title: 'New Student Complaint',
        message: `${req.user.fullName} submitted a new complaint: "${title}"`,
        type: 'NEW_COMPLAINT',
        actionUrl: '/complaints',
        hostelId: req.user.hostelId
      });
    }
    emitToRoom(`HOSTEL_${req.user.hostelId}`, 'REFRESH_DASHBOARD', { type: 'NEW_COMPLAINT' });

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully.',
      complaint
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// STUDENT: Get own complaint history
// GET /api/complaints/my
// ──────────────────────────────────────────────────────
const getMyComplaints = async (req, res, next) => {
  try {
    // Students only see their own complaints, newest first
    const complaints = await Complaint.find({ studentId: req.user._id })
      .populate('assignedTo', 'fullName')
      .sort({ createdAt: -1 })
      .lean(); // lean() for read-only → significant performance gain

    res.status(200).json({
      success: true,
      count: complaints.length,
      complaints
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// WARDEN/ADMIN: Get all complaints (hostel-isolated)
// GET /api/complaints?status=OPEN&priority=URGENT&category=PLUMBING
// ──────────────────────────────────────────────────────
const getAllComplaints = async (req, res, next) => {
  try {
    // ── Hostel Isolation ──────────────────────────────
    // Wardens are strictly restricted to their own hostel.
    // Admins see everything across all hostels.
    const query = {};

    if (req.user.role === 'WARDEN') {
      query.hostelId = req.user.hostelId;
    }

    // Optional filters passed as query params
    if (req.query.status) query.status = req.query.status;
    if (req.query.priority) query.priority = req.query.priority;
    if (req.query.category) query.category = req.query.category;

    const complaints = await Complaint.find(query)
      .populate('studentId', 'fullName admissionNumber')
      .populate('roomId', 'roomNumber floor')
      .populate('hostelId', 'name hostelCode')
      .populate('assignedTo', 'fullName')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: complaints.length,
      complaints
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// WARDEN/ADMIN: Get single complaint detail
// GET /api/complaints/:id
// ──────────────────────────────────────────────────────
const getComplaintById = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('studentId', 'fullName admissionNumber email department year')
      .populate('roomId', 'roomNumber floor')
      .populate('hostelId', 'name hostelCode')
      .populate('assignedTo', 'fullName email')
      .populate('resolvedBy', 'fullName')
      .lean();

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Hostel isolation check for wardens
    if (
      req.user.role === 'WARDEN' &&
      complaint.hostelId._id.toString() !== req.user.hostelId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Access denied. Not your hostel.' });
    }

    res.status(200).json({ success: true, complaint });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// WARDEN/ADMIN: Update complaint status
// PUT /api/complaints/:id/status
// Body: { status, resolutionNotes }
// ──────────────────────────────────────────────────────
const updateComplaintStatus = async (req, res, next) => {
  try {
    const { status, resolutionNotes } = req.body;

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Hostel isolation for wardens
    if (
      req.user.role === 'WARDEN' &&
      complaint.hostelId.toString() !== req.user.hostelId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Access denied. Not your hostel.' });
    }

    // Lifecycle guard: RESOLVED/REJECTED complaints cannot be re-opened
    if (
      (complaint.status === 'RESOLVED' || complaint.status === 'REJECTED') &&
      status === 'OPEN'
    ) {
      return res.status(400).json({
        success: false,
        message: 'A resolved or rejected complaint cannot be re-opened.'
      });
    }

    complaint.status = status;

    // When resolving or rejecting, record who did it and when
    if (status === 'RESOLVED' || status === 'REJECTED') {
      complaint.resolvedAt = new Date();
      complaint.resolvedBy = req.user._id;
      if (resolutionNotes) complaint.resolutionNotes = resolutionNotes;
    }

    await complaint.save();

    // Populate relations so client list views do not break on real-time state patch updates
    await complaint.populate([
      { path: 'studentId', select: 'fullName admissionNumber' },
      { path: 'roomId', select: 'roomNumber floor' },
      { path: 'assignedTo', select: 'fullName' }
    ]);

    // Notify the student that their complaint status has changed
    await createAndEmitNotification({
      recipientId: complaint.studentId._id,
      title: 'Complaint Status Updated',
      message: `Your complaint "${complaint.title}" is now marked as ${status}.`,
      type: 'COMPLAINT_RESOLVED',
      actionUrl: '/student/complaints',
      hostelId: complaint.hostelId
    });
    emitToRoom(`STUDENT_${complaint.studentId._id}`, 'REFRESH_DASHBOARD', { type: 'COMPLAINT_STATUS_UPDATED' });
    emitToRoom(`HOSTEL_${complaint.hostelId}`, 'REFRESH_DASHBOARD', { type: 'COMPLAINT_STATUS_UPDATED' });
    emitToRoom(`STUDENT_${complaint.studentId._id}`, 'COMPLAINT_UPDATED', complaint);
    emitToRoom(`HOSTEL_${complaint.hostelId}`, 'COMPLAINT_UPDATED', complaint);

    res.status(200).json({
      success: true,
      message: `Complaint status updated to ${status}.`,
      complaint
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// WARDEN/ADMIN: Assign complaint to a staff member
// PUT /api/complaints/:id/assign
// Body: { assignedTo } (User _id of the warden/staff)
// ──────────────────────────────────────────────────────
const assignComplaint = async (req, res, next) => {
  try {
    const { assignedTo } = req.body;

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // Hostel isolation for wardens
    if (
      req.user.role === 'WARDEN' &&
      complaint.hostelId.toString() !== req.user.hostelId.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    complaint.assignedTo = assignedTo;
    // Auto-move to IN_PROGRESS when assigned
    if (complaint.status === 'OPEN') complaint.status = 'IN_PROGRESS';

    await complaint.save();

    // Populate relations so client list views do not break on real-time state patch updates
    await complaint.populate([
      { path: 'studentId', select: 'fullName admissionNumber' },
      { path: 'roomId', select: 'roomNumber floor' },
      { path: 'assignedTo', select: 'fullName' }
    ]);

    // Notify the assigned staff/warden
    await createAndEmitNotification({
      recipientId: assignedTo,
      title: 'Complaint Assigned To You',
      message: `You have been assigned to investigate complaint: "${complaint.title}"`,
      type: 'NEW_COMPLAINT',
      actionUrl: '/complaints',
      hostelId: complaint.hostelId
    });
    emitToRoom(`HOSTEL_${complaint.hostelId}`, 'REFRESH_DASHBOARD', { type: 'COMPLAINT_ASSIGNED' });
    emitToRoom(`STUDENT_${complaint.studentId._id}`, 'COMPLAINT_UPDATED', complaint);
    emitToRoom(`HOSTEL_${complaint.hostelId}`, 'COMPLAINT_UPDATED', complaint);

    res.status(200).json({
      success: true,
      message: 'Complaint assigned and moved to In Progress.',
      complaint
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// SHARED: Dashboard analytics for complaint counts
// GET /api/complaints/stats
// ──────────────────────────────────────────────────────
const getComplaintStats = async (req, res, next) => {
  try {
    const matchQuery = {};

    // Scope appropriately
    if (req.user.role === 'WARDEN') matchQuery.hostelId = req.user.hostelId;
    if (req.user.role === 'STUDENT') matchQuery.studentId = req.user._id;

    // Aggregate counts by status and priority in one query (performance)
    const [statusCounts, priorityCounts, total] = await Promise.all([
      Complaint.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Complaint.aggregate([
        { $match: { ...matchQuery, status: { $ne: 'RESOLVED' } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      Complaint.countDocuments(matchQuery)
    ]);

    // Flatten aggregation results into a clean object
    const byStatus = {};
    statusCounts.forEach(s => { byStatus[s._id] = s.count; });

    const byPriority = {};
    priorityCounts.forEach(p => { byPriority[p._id] = p.count; });

    res.status(200).json({
      success: true,
      stats: {
        total,
        byStatus,
        byPriority,
        // Key dashboard widgets
        openComplaints: byStatus.OPEN || 0,
        inProgress: byStatus.IN_PROGRESS || 0,
        resolved: byStatus.RESOLVED || 0,
        urgentOpen: byPriority.URGENT || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createComplaint,
  getMyComplaints,
  getAllComplaints,
  getComplaintById,
  updateComplaintStatus,
  assignComplaint,
  getComplaintStats
};
