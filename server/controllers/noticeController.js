const Notice = require('../models/Notice');
const User = require('../models/User');
const { createAndEmitNotification, emitToRoom, getIO } = require('../utils/socket');

// ======================================================
// NOTICE / ANNOUNCEMENT CONTROLLER
// ======================================================

// ──────────────────────────────────────────────────────
// Helper: build notice visibility query for public noticeboard
// ──────────────────────────────────────────────────────
const buildVisibilityQuery = (user) => {
  const now = new Date();

  // Base conditions: active, published, and not expired
  const query = {
    isActive: true,
    isPublished: true,
    publishAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
  };

  // Role visibility filter (supporting visibleTo and new audienceScope)
  if (user.role === 'STUDENT') {
    query.$or = [
      { visibleTo: { $in: ['ALL', 'STUDENTS'] } },
      { audienceScope: { $in: ['ALL', 'STUDENTS'] } }
    ];
  } else if (user.role === 'WARDEN') {
    query.$or = [
      { visibleTo: { $in: ['ALL', 'WARDENS'] } },
      { audienceScope: { $in: ['ALL', 'WARDENS'] } }
    ];
  } else if (user.role === 'PARENT') {
    query.$or = [
      { visibleTo: { $in: ['ALL', 'PARENTS'] } },
      { audienceScope: { $in: ['ALL', 'PARENTS'] } }
    ];
  }

  // Hostel isolation scoping
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

  return query;
};

// Helper: dispatch notifications for published notices
const dispatchNoticeNotifications = async (notice) => {
  try {
    const targetType = notice.targetType;
    const resolvedHostelId = notice.hostelId;
    const audienceScope = notice.audienceScope || 'ALL';

    // Build target user audience query
    const userQuery = {};
    if (targetType === 'HOSTEL' && resolvedHostelId) {
      userQuery.hostelId = resolvedHostelId;
    }

    if (audienceScope === 'STUDENTS') {
      userQuery.role = 'STUDENT';
    } else if (audienceScope === 'PARENTS') {
      userQuery.role = 'PARENT';
    } else if (audienceScope === 'WARDENS') {
      userQuery.role = 'WARDEN';
    } else {
      userQuery.role = { $in: ['STUDENT', 'PARENT', 'WARDEN'] };
    }

    const targetedUsers = await User.find(userQuery).select('_id').lean();
    
    const isEmergency = notice.priority === 'EMERGENCY';
    const notificationTitle = isEmergency 
      ? '🚨 URGENT EMERGENCY NOTICE' 
      : notice.priority === 'IMPORTANT' 
        ? '⚠️ IMPORTANT ANNOUNCEMENT' 
        : '📋 New Announcement';

    const notificationType = isEmergency 
      ? 'EMERGENCY_NOTICE' 
      : 'NEW_ANNOUNCEMENT';

    for (const targetUser of targetedUsers) {
      await createAndEmitNotification({
        recipientId: targetUser._id,
        title: notificationTitle,
        message: `Notice: "${notice.title}". Click to view details.`,
        type: notificationType,
        priority: notice.priority,
        relatedEntityId: notice._id,
        actionUrl: '/notices',
        hostelId: targetType === 'GLOBAL' ? null : resolvedHostelId
      });
    }

    // Broadcast Socket triggers
    const io = getIO();
    if (targetType === 'GLOBAL') {
      io.emit('NEW_NOTICE', notice);
      io.emit('REFRESH_DASHBOARD', { type: 'NEW_NOTICE' });
    } else {
      io.to(`HOSTEL_${resolvedHostelId}`).emit('NEW_NOTICE', notice);
      io.to(`HOSTEL_${resolvedHostelId}`).emit('REFRESH_DASHBOARD', { type: 'NEW_NOTICE' });
    }
  } catch (err) {
    console.error('[Notice Controller] Failed to dispatch notifications', err);
  }
};

// ──────────────────────────────────────────────────────
// GET /api/notices
// ──────────────────────────────────────────────────────
const getNotices = async (req, res, next) => {
  try {
    const { mode } = req.query;
    let query = {};

    // Management view filters (Admins / Wardens moderating notices)
    if (mode === 'manage' && (req.user.role === 'ADMIN' || req.user.role === 'WARDEN')) {
      query.isActive = true;
      
      if (req.user.role === 'WARDEN') {
        const wardenHostel = req.user.hostelId?._id || req.user.hostelId;
        query.targetType = 'HOSTEL';
        query.hostelId = wardenHostel;
      }
    } else {
      // Standard public noticeboard view
      query = buildVisibilityQuery(req.user);
    }

    // Retrieve and populate
    const notices = await Notice.find(query)
      .populate('createdBy', 'fullName role')
      .populate('hostelId', 'name hostelCode')
      .sort({ isPinned: -1, priority: 1, createdAt: -1 })
      .lean();

    // Custom order sort helper (EMERGENCY > IMPORTANT > NORMAL)
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

    // Role-based visibility fence checks
    if (req.user.role !== 'ADMIN') {
      const now = new Date();
      // Enforce scheduled/expired boundaries for students/parents
      if (!notice.isPublished || (notice.publishAt && new Date(notice.publishAt) > now)) {
        return res.status(403).json({ success: false, message: 'Access denied: Notice is scheduled for future publishing.' });
      }
      if (notice.expiresAt && new Date(notice.expiresAt) <= now) {
        return res.status(403).json({ success: false, message: 'Access denied: Notice has expired.' });
      }

      // Hostel isolation fence checks
      if (notice.targetType === 'HOSTEL') {
        const userHostel = (req.user.hostelId?._id || req.user.hostelId)?.toString();
        const noticeHostel = notice.hostelId?._id?.toString() || notice.hostelId?.toString();
        if (userHostel !== noticeHostel) {
          return res.status(403).json({ success: false, message: 'Access denied: Notices are isolated by hostel residency.' });
        }
      }
    }

    res.status(200).json({ success: true, notice });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// POST /api/notices
// ──────────────────────────────────────────────────────
const createNotice = async (req, res, next) => {
  try {
    const { 
      title, 
      content, 
      targetType, 
      hostelId, 
      priority, 
      isPinned, 
      expiresAt, 
      visibleTo,
      publishAt,
      recurrenceType,
      audienceScope
    } = req.body;

    const userRole = req.user.role;

    // Wardens cannot create GLOBAL broadcasts
    if (userRole === 'WARDEN' && targetType === 'GLOBAL') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Wardens can only create notices for their assigned hostel.'
      });
    }

    // Determine target hostelId
    let resolvedHostelId = hostelId || null;
    if (userRole === 'WARDEN') {
      resolvedHostelId = req.user.hostelId?._id || req.user.hostelId;
    }

    if (targetType === 'HOSTEL' && !resolvedHostelId) {
      return res.status(400).json({
        success: false,
        message: 'A hostel selection is required for hostel-targeted announcements.'
      });
    }

    // Schedule details
    const parsedPublishAt = publishAt ? new Date(publishAt) : new Date();
    const isFutureScheduled = parsedPublishAt > new Date();
    const isPublished = !isFutureScheduled;

    const noticeRecurrence = recurrenceType || 'NONE';
    const isRecurring = noticeRecurrence !== 'NONE';

    const resolvedAudience = audienceScope || visibleTo || 'ALL';

    const notice = await Notice.create({
      title,
      content,
      createdBy: req.user._id,
      publishedBy: req.user._id,
      creatorRole: userRole,
      targetType: targetType || 'HOSTEL',
      hostelId: targetType === 'GLOBAL' ? null : resolvedHostelId,
      priority: priority || 'NORMAL',
      isPinned: isPinned || false,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      publishAt: parsedPublishAt,
      isPublished,
      recurrenceType: noticeRecurrence,
      isRecurring,
      audienceScope: resolvedAudience,
      visibleTo: resolvedAudience
    });

    // If active immediately, dispatch notifications & live alerts
    if (isPublished) {
      await dispatchNoticeNotifications(notice);
    }

    res.status(201).json({
      success: true,
      message: isFutureScheduled 
        ? `Notice scheduled successfully for ${parsedPublishAt.toLocaleString()}`
        : 'Notice published successfully.',
      notice
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// PUT /api/notices/:id
// ──────────────────────────────────────────────────────
const updateNotice = async (req, res, next) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice || !notice.isActive) {
      return res.status(404).json({ success: false, message: 'Notice not found.' });
    }

    // STRICT WARDEN SECURITY GATE
    if (req.user.role === 'WARDEN') {
      if (notice.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Wardens can only edit notices they created.'
        });
      }
    }

    const { 
      title, 
      content, 
      priority, 
      isPinned, 
      expiresAt, 
      visibleTo,
      publishAt,
      recurrenceType,
      audienceScope
    } = req.body;

    // Track original states
    const wasPublished = notice.isPublished;

    // Apply edits
    if (title) notice.title = title;
    if (content) notice.content = content;
    if (priority) notice.priority = priority;
    if (isPinned !== undefined) notice.isPinned = isPinned;
    
    if (expiresAt !== undefined) {
      notice.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    if (publishAt !== undefined) {
      notice.publishAt = publishAt ? new Date(publishAt) : new Date();
      // Re-evaluate published status
      notice.isPublished = new Date(notice.publishAt) <= new Date();
    }

    if (recurrenceType !== undefined) {
      notice.recurrenceType = recurrenceType;
      notice.isRecurring = recurrenceType !== 'NONE';
    }

    if (audienceScope || visibleTo) {
      const resolvedAudience = audienceScope || visibleTo;
      notice.audienceScope = resolvedAudience;
      notice.visibleTo = resolvedAudience;
    }

    await notice.save();

    // Broadcast Socket triggers
    const io = getIO();
    if (notice.targetType === 'GLOBAL') {
      io.emit('NOTICE_UPDATED', notice);
      io.emit('REFRESH_DASHBOARD', { type: 'NOTICE_UPDATED' });
    } else if (notice.hostelId) {
      io.to(`HOSTEL_${notice.hostelId}`).emit('NOTICE_UPDATED', notice);
      io.to(`HOSTEL_${notice.hostelId}`).emit('REFRESH_DASHBOARD', { type: 'NOTICE_UPDATED' });
    }

    // If edited to become published now (and wasn't previously published)
    if (notice.isPublished && !wasPublished) {
      await dispatchNoticeNotifications(notice);
    }

    res.status(200).json({ 
      success: true, 
      message: 'Notice updated successfully.', 
      notice 
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// DELETE /api/notices/:id
// ──────────────────────────────────────────────────────
const deleteNotice = async (req, res, next) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ success: false, message: 'Notice not found.' });
    }

    // STRICT WARDEN SECURITY GATE
    if (req.user.role === 'WARDEN') {
      if (notice.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Wardens can only delete notices they created.'
        });
      }
    }

    // Soft-delete: mark inactive
    notice.isActive = false;
    await notice.save();

    // Broadcast Socket triggers
    const io = getIO();
    if (notice.targetType === 'GLOBAL') {
      io.emit('NOTICE_DELETED', { _id: notice._id });
      io.emit('REFRESH_DASHBOARD', { type: 'NOTICE_DELETED' });
    } else if (notice.hostelId) {
      io.to(`HOSTEL_${notice.hostelId}`).emit('NOTICE_DELETED', { _id: notice._id });
      io.to(`HOSTEL_${notice.hostelId}`).emit('REFRESH_DASHBOARD', { type: 'NOTICE_DELETED' });
    }

    res.status(200).json({ success: true, message: 'Notice removed successfully.' });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// GET /api/notices/stats
// ──────────────────────────────────────────────────────
const getNoticeStats = async (req, res, next) => {
  try {
    const baseQuery = buildVisibilityQuery(req.user);

    const [total, emergency, pinned] = await Promise.all([
      Notice.countDocuments(baseQuery),
      Notice.countDocuments({ ...baseQuery, priority: 'EMERGENCY' }),
      Notice.countDocuments({ ...baseQuery, isPinned: true })
    ]);

    // Fetch 3 latest active notices for widget preview
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
