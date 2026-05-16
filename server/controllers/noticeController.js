const Notice = require('../models/Notice');

// ======================================================
// NOTICE CONTROLLER
// ======================================================
// Handles all notice CRUD and visibility logic.
//
// Security model:
//   ADMIN   → create GLOBAL or HOSTEL notices; full CRUD on all notices
//   WARDEN  → create/update/delete ONLY within their assigned hostel; cannot create GLOBAL
//   STUDENT → read only; sees hostel notices + applicable global notices
//
// Notice is excluded from queries when:
//   - isActive === false (soft-deleted or archived)
//   - expiresAt is set and is in the past
// ======================================================

// ──────────────────────────────────────────────────────
// Shared helper: build the base "visible to me" query
// Used by both GET /notices and GET /notices/:id
// ──────────────────────────────────────────────────────
const buildVisibilityQuery = (user) => {
  const now = new Date();

  // Base conditions: active, not expired
  const query = {
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
  };

  // ── Role visibility filter ─────────────────────────
  // visibleTo: ALL = everyone sees it
  //            STUDENTS = only students
  //            WARDENS = only wardens/admins
  if (user.role === 'STUDENT') {
    query.visibleTo = { $in: ['ALL', 'STUDENTS'] };
  } else if (user.role === 'WARDEN') {
    query.visibleTo = { $in: ['ALL', 'WARDENS'] };
  }
  // ADMIN sees everything regardless of visibleTo

  // ── Hostel isolation scoping ───────────────────────
  // A user sees: GLOBAL notices + HOSTEL notices for their hostel
  if (user.role !== 'ADMIN') {
    const hostelId = user.hostelId?._id || user.hostelId;
    query.$and = [
      {
        $or: [
          { targetType: 'GLOBAL' },
          { targetType: 'HOSTEL', hostelId: hostelId }
        ]
      }
    ];
  }
  // Admins skip hostel scoping — they see all notices

  return query;
};

// ──────────────────────────────────────────────────────
// GET /api/notices
// All authenticated users — visibility-filtered results
// ──────────────────────────────────────────────────────
const getNotices = async (req, res, next) => {
  try {
    const query = buildVisibilityQuery(req.user);

    // Sort: pinned first, then EMERGENCY > IMPORTANT > NORMAL, then newest
    const notices = await Notice.find(query)
      .populate('createdBy', 'fullName role')
      .populate('hostelId', 'name hostelCode')
      .sort({ isPinned: -1, priority: 1, createdAt: -1 })
      .lean();

    // Re-sort priority correctly (mongoose sorts strings alphabetically,
    // so we enforce EMERGENCY > IMPORTANT > NORMAL manually)
    const priorityOrder = { EMERGENCY: 0, IMPORTANT: 1, NORMAL: 2 };
    notices.sort((a, b) => {
      if (b.isPinned !== a.isPinned) return b.isPinned - a.isPinned;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    res.status(200).json({
      success: true,
      count: notices.length,
      notices
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// GET /api/notices/:id
// Single notice — enforces same visibility rules
// ──────────────────────────────────────────────────────
const getNoticeById = async (req, res, next) => {
  try {
    const notice = await Notice.findById(req.params.id)
      .populate('createdBy', 'fullName role')
      .populate('hostelId', 'name')
      .lean();

    if (!notice || !notice.isActive) {
      return res.status(404).json({ success: false, message: 'Notice not found.' });
    }

    // Hostel isolation check for non-admins
    if (notice.targetType === 'HOSTEL' && req.user.role !== 'ADMIN') {
      const userHostel = (req.user.hostelId?._id || req.user.hostelId)?.toString();
      const noticeHostel = notice.hostelId?._id?.toString() || notice.hostelId?.toString();
      if (userHostel !== noticeHostel) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    res.status(200).json({ success: true, notice });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// POST /api/notices
// Admin: can create GLOBAL or HOSTEL notices
// Warden: can ONLY create HOSTEL notices for their hostel
// ──────────────────────────────────────────────────────
const createNotice = async (req, res, next) => {
  try {
    const { title, content, targetType, hostelId, priority, isPinned, expiresAt, visibleTo } = req.body;

    // Wardens cannot create GLOBAL broadcasts
    if (req.user.role === 'WARDEN' && targetType === 'GLOBAL') {
      return res.status(403).json({
        success: false,
        message: 'Wardens can only create hostel-specific notices, not global broadcasts.'
      });
    }

    // Determine the hostelId to use
    // Wardens always use their own hostelId, regardless of what was sent in body
    let resolvedHostelId = hostelId || null;
    if (req.user.role === 'WARDEN') {
      resolvedHostelId = req.user.hostelId?._id || req.user.hostelId;
    }

    // Hostel notices MUST have a hostelId
    if (targetType === 'HOSTEL' && !resolvedHostelId) {
      return res.status(400).json({
        success: false,
        message: 'A hostelId is required for hostel-targeted notices.'
      });
    }

    const notice = await Notice.create({
      title,
      content,
      createdBy: req.user._id,
      targetType: targetType || 'HOSTEL',
      hostelId: targetType === 'GLOBAL' ? null : resolvedHostelId,
      priority: priority || 'NORMAL',
      isPinned: isPinned || false,
      expiresAt: expiresAt || null,
      visibleTo: visibleTo || 'ALL'
    });

    res.status(201).json({
      success: true,
      message: 'Notice published successfully.',
      notice
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// PUT /api/notices/:id
// Admin: can update any notice
// Warden: can only update notices from their hostel
// ──────────────────────────────────────────────────────
const updateNotice = async (req, res, next) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice || !notice.isActive) {
      return res.status(404).json({ success: false, message: 'Notice not found.' });
    }

    // Warden can only update their own hostel's notices
    if (req.user.role === 'WARDEN') {
      const wardenHostel = (req.user.hostelId?._id || req.user.hostelId)?.toString();
      const noticeHostel = notice.hostelId?.toString();
      if (wardenHostel !== noticeHostel) {
        return res.status(403).json({ success: false, message: 'Access denied. Not your hostel notice.' });
      }
    }

    const { title, content, priority, isPinned, expiresAt, visibleTo } = req.body;

    if (title) notice.title = title;
    if (content) notice.content = content;
    if (priority) notice.priority = priority;
    if (isPinned !== undefined) notice.isPinned = isPinned;
    if (expiresAt !== undefined) notice.expiresAt = expiresAt;
    if (visibleTo) notice.visibleTo = visibleTo;

    await notice.save();

    res.status(200).json({ success: true, message: 'Notice updated.', notice });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// DELETE /api/notices/:id
// Soft-delete: sets isActive = false (preserves records)
// ──────────────────────────────────────────────────────
const deleteNotice = async (req, res, next) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found.' });
    }

    // Warden hostel isolation check
    if (req.user.role === 'WARDEN') {
      const wardenHostel = (req.user.hostelId?._id || req.user.hostelId)?.toString();
      if (notice.hostelId?.toString() !== wardenHostel) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    // Soft-delete: mark inactive instead of permanent removal
    notice.isActive = false;
    await notice.save();

    res.status(200).json({ success: true, message: 'Notice removed successfully.' });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// GET /api/notices/stats
// For dashboard widgets — returns summary counts
// ──────────────────────────────────────────────────────
const getNoticeStats = async (req, res, next) => {
  try {
    const now = new Date();
    const baseQuery = buildVisibilityQuery(req.user);

    const [total, emergency, pinned] = await Promise.all([
      Notice.countDocuments(baseQuery),
      Notice.countDocuments({ ...baseQuery, priority: 'EMERGENCY' }),
      Notice.countDocuments({ ...baseQuery, isPinned: true })
    ]);

    // Fetch 3 latest for dashboard widget preview
    const latest = await Notice.find(baseQuery)
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(3)
      .select('title priority isPinned createdAt targetType')
      .lean();

    res.status(200).json({
      success: true,
      stats: { total, emergency, pinned, latest }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotices,
  getNoticeById,
  createNotice,
  updateNotice,
  deleteNotice,
  getNoticeStats
};
