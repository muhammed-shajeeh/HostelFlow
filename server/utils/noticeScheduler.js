const Notice = require('../models/Notice');
const User = require('../models/User');
const { createAndEmitNotification, emitToRoom, getIO } = require('./socket');

// Helper to calculate the next publishing date based on recurrence pattern
const getNextOccurrenceDate = (date, recurrenceType) => {
  const nextDate = new Date(date);
  switch (recurrenceType) {
    case 'DAILY':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'WEEKLY':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'MONTHLY':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    default:
      return null;
  }
  return nextDate;
};

// Main scheduled worker task
const runNoticeScheduler = async () => {
  try {
    const now = new Date();

    // ──────────────────────────────────────────────────────
    // 1. PROCESS AND ACTIVATE SCHEDULED NOTICES
    // ──────────────────────────────────────────────────────
    // Find all scheduled notices whose publishAt time has come and are not yet published
    const scheduledNotices = await Notice.find({
      isPublished: false,
      publishAt: { $lte: now },
      isActive: true
    }).populate('createdBy', 'fullName role');

    for (const notice of scheduledNotices) {
      notice.isPublished = true;
      await notice.save();

      console.log(`[Notice Scheduler] Notice published: "${notice.title}"`);

      // Resolve targets for notifications
      const targetType = notice.targetType;
      const resolvedHostelId = notice.hostelId;
      const audienceScope = notice.audienceScope || 'ALL';

      // Build target audience user query
      const userQuery = {};
      if (targetType === 'HOSTEL' && resolvedHostelId) {
        userQuery.hostelId = resolvedHostelId;
      }

      // Map audienceScope to database roles
      if (audienceScope === 'STUDENTS') {
        userQuery.role = 'STUDENT';
      } else if (audienceScope === 'PARENTS') {
        userQuery.role = 'PARENT';
      } else if (audienceScope === 'WARDENS') {
        userQuery.role = 'WARDEN';
      } else {
        // ALL
        userQuery.role = { $in: ['STUDENT', 'PARENT', 'WARDEN'] };
      }

      // Trigger Database Alerts & Real-Time Push notifications
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

      // Broadcast Real-time event to socket rooms
      try {
        const io = getIO();
        if (targetType === 'GLOBAL') {
          io.emit('NEW_NOTICE', notice);
          io.emit('REFRESH_DASHBOARD', { type: 'NEW_NOTICE' });
        } else {
          io.to(`HOSTEL_${resolvedHostelId}`).emit('NEW_NOTICE', notice);
          io.to(`HOSTEL_${resolvedHostelId}`).emit('REFRESH_DASHBOARD', { type: 'NEW_NOTICE' });
        }
      } catch (err) {
        console.error('[Notice Scheduler] Socket broadcast failed', err);
      }
    }

    // ──────────────────────────────────────────────────────
    // 2. GENERATE NEXT RECURRING NOTICE INSTANCES
    // ──────────────────────────────────────────────────────
    // Find published recurring notices that haven't generated their next child instance yet
    const recurringNotices = await Notice.find({
      isRecurring: true,
      isPublished: true,
      hasGeneratedNext: false,
      recurrenceType: { $ne: 'NONE' },
      publishAt: { $lte: now },
      isActive: true
    });

    for (const notice of recurringNotices) {
      const nextPublishAt = getNextOccurrenceDate(notice.publishAt, notice.recurrenceType);
      
      if (nextPublishAt) {
        // Calculate the next expiry date if one was configured on the original
        let nextExpiresAt = null;
        if (notice.expiresAt && notice.publishAt) {
          const durationMs = new Date(notice.expiresAt).getTime() - new Date(notice.publishAt).getTime();
          nextExpiresAt = new Date(nextPublishAt.getTime() + durationMs);
        }

        // Clone notice configuration for next occurrence (schedule it in future)
        const nextNotice = new Notice({
          title: notice.title,
          content: notice.content,
          createdBy: notice.createdBy,
          targetType: notice.targetType,
          hostelId: notice.hostelId,
          priority: notice.priority,
          isPinned: notice.isPinned,
          visibleTo: notice.visibleTo,
          attachments: notice.attachments,
          creatorRole: notice.creatorRole,
          audienceScope: notice.audienceScope,
          recurrenceType: notice.recurrenceType,
          isRecurring: true,
          isPublished: false, // Will publish at nextPublishAt
          publishAt: nextPublishAt,
          expiresAt: nextExpiresAt,
          parentRecurringId: notice.parentRecurringId || notice._id,
          hasGeneratedNext: false
        });

        await nextNotice.save();
        console.log(`[Notice Scheduler] Queued next occurrence of recurring notice: "${notice.title}" for ${nextPublishAt.toDateString()}`);
      }

      // Mark current instance as completed for recurrence generation
      notice.hasGeneratedNext = true;
      await notice.save();
    }

  } catch (error) {
    console.error('[Notice Scheduler Worker Error]', error);
  }
};

module.exports = {
  runNoticeScheduler
};
