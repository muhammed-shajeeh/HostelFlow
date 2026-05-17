const AuditLog = require('../models/AuditLog');
const { getIO } = require('./socket');

/**
 * Centrally records operational audit logs, validates actor details, 
 * and broadcasts to MAIN ADMIN users via real-time Socket.IO.
 */
const logAudit = async ({
  req = null,          // Option to parse actor and IP from express request
  actor = null,        // Custom actor object if request context isn't available
  actionType,
  entityType,
  entityId = null,
  title,
  description,
  severity = 'INFO',
  metadata = null,
  hostelId = null
}) => {
  try {
    let finalActorId = null;
    let finalActorName = 'SYSTEM';
    let finalActorRole = 'SYSTEM';
    let finalHostelId = hostelId;
    let finalIp = '127.0.0.1';

    // 1. Resolve actor parameters from Express request
    if (req) {
      finalIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      if (req.user) {
        finalActorId = req.user._id;
        finalActorName = req.user.fullName || req.user.email || 'System User';
        finalActorRole = req.user.role || 'SYSTEM';
        if (!finalHostelId) {
          finalHostelId = req.user.hostelId;
        }
      }
    } 
    // 2. Fallback to passed actor arguments
    else if (actor) {
      finalActorId = actor._id;
      finalActorName = actor.fullName || actor.email || 'System User';
      finalActorRole = actor.role || 'SYSTEM';
      if (!finalHostelId) {
        finalHostelId = actor.hostelId;
      }
    }

    // 3. Create the persistent AuditLog entry
    const auditLog = await AuditLog.create({
      actorId: finalActorId,
      actorName: finalActorName,
      actorRole: finalActorRole,
      hostelId: finalHostelId || null,
      actionType,
      entityType,
      entityId,
      title,
      description,
      severity,
      metadata,
      ipAddress: finalIp
    });

    // 4. Real-time broadcast to the ADMIN_GLOBAL socket room
    try {
      const io = getIO();
      if (io) {
        io.to('ADMIN_GLOBAL').emit('NEW_AUDIT_LOG', auditLog);
      }
    } catch (socketErr) {
      // Fail silently if Socket.IO isn't running or initialized yet
    }

    return auditLog;
  } catch (error) {
    console.error('[Audit Logger] Failed to write audit record:', error.message);
    return null;
  }
};

module.exports = {
  logAudit
};
