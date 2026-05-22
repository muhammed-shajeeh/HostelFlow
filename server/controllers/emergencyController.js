const EmergencyAlert = require('../models/EmergencyAlert');
const User = require('../models/User');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const sendEmail = require('../utils/email');
const { emitToRoom } = require('../utils/socket');

// @desc    Trigger a student emergency SOS alert
// @route   POST /api/emergency/alert
// @access  Private (STUDENT only)
const createAlert = async (req, res, next) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, message: 'Only students can trigger emergency alerts.' });
    }

    const hostelId = req.user.hostelId;
    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'You must be assigned to a hostel to trigger an emergency alert.' });
    }

    // 1. Strict 2-minute rate-limiting check
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const existingRecentAlert = await EmergencyAlert.findOne({
      studentId: req.user._id,
      createdAt: { $gte: twoMinutesAgo }
    });

    if (existingRecentAlert) {
      return res.status(429).json({
        success: false,
        message: 'Emergency alert already sent within the last 2 minutes. Please wait before triggering another one.'
      });
    }

    // 2. Create the emergency alert log
    const alert = new EmergencyAlert({
      studentId: req.user._id,
      hostelId: req.user.hostelId,
      roomId: req.user.roomId || null,
      status: 'ACTIVE'
    });

    await alert.save();

    // 3. Populate relationships for descriptive client broadcast & emails
    const populatedAlert = await EmergencyAlert.findById(alert._id)
      .populate('studentId', 'fullName email admissionNumber bedNumber')
      .populate('hostelId', 'name')
      .populate('roomId', 'roomNumber');

    // 4. Emit targeted Socket.IO event instantly
    emitToRoom(`HOSTEL_${hostelId}`, 'EMERGENCY_ALERT', populatedAlert);
    emitToRoom('ADMIN_GLOBAL', 'EMERGENCY_ALERT', populatedAlert);

    // 5. Asynchronous background transactional email and FCM push notification dispatch (does not block controller response)
    (async () => {
      try {
        const student = populatedAlert.studentId;
        const room = populatedAlert.roomId;
        const hostelName = populatedAlert.hostelId ? populatedAlert.hostelId.name : 'Hostel';

        // Retrieve active wardens and security of the student's hostel, and all active system admins
        const recipients = await User.find({
          $or: [
            { role: 'WARDEN', hostelId: hostelId, isActive: true },
            { role: 'SECURITY', hostelId: hostelId, isActive: true },
            { role: 'ADMIN', isActive: true }
          ]
        }).select('email fullName role');

        if (recipients.length > 0) {
          // A. Send FCM Push Notifications asynchronously
          (async () => {
            try {
              const recipientIds = recipients.map(r => r._id);
              const DeviceToken = require('../models/DeviceToken');
              const { sendPushNotification } = require('../utils/fcmHelper');

              const deviceTokens = await DeviceToken.find({
                userId: { $in: recipientIds }
              }).select('fcmToken');

              const fcmTokens = deviceTokens.map(dt => dt.fcmToken);

              if (fcmTokens.length > 0) {
                const roomNum = room ? room.roomNumber : 'Unassigned';
                const bodyText = `Student from Room ${roomNum} triggered an emergency alert.`;

                console.log(`[Emergency Push System] Dispatched push request to ${fcmTokens.length} active device tokens.`);
                
                await sendPushNotification(fcmTokens, {
                  title: '🚨 Emergency Alert',
                  body: bodyText,
                  route: '/dashboard',
                  sound: 'emergency_siren',
                  channelId: 'emergency_channel',
                  entityId: populatedAlert._id.toString()
                });
              }
            } catch (fcmErr) {
              console.error('[Emergency Push System Error] FCM dispatch thread failed:', fcmErr.message);
            }
          })();

          // B. Send transactional emails
          const subject = `🚨 EMERGENCY SOS ALERT - Room ${room ? room.roomNumber : 'N/A'} - ${student.fullName}`;
          const htmlContent = `
            <div style="font-family: Arial, sans-serif; border: 2px solid #ef4444; border-radius: 16px; padding: 24px; max-width: 600px; margin: 0 auto; background-color: #fef2f2; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <h2 style="color: #dc2626; margin-top: 0; display: flex; align-items: center; gap: 8px; font-weight: 900;">🚨 ACTIVE EMERGENCY SOS ALERT</h2>
              <p style="font-size: 15px; color: #7f1d1d; font-weight: bold; margin-bottom: 20px;">
                An emergency SOS alert has been triggered by a resident student at ${hostelName}.
              </p>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; color: #4b5563;">
                <tr style="border-bottom: 1px solid #fee2e2;"><td style="padding: 10px 0; font-weight: bold; width: 140px; color: #991b1b;">Student Name:</td><td style="padding: 10px 0; color: #111827; font-weight: 600;">${student.fullName}</td></tr>
                <tr style="border-bottom: 1px solid #fee2e2;"><td style="padding: 10px 0; font-weight: bold; color: #991b1b;">Admission No:</td><td style="padding: 10px 0; color: #111827; font-weight: 600;">${student.admissionNumber || 'N/A'}</td></tr>
                <tr style="border-bottom: 1px solid #fee2e2;"><td style="padding: 10px 0; font-weight: bold; color: #991b1b;">Room / Bed No:</td><td style="padding: 10px 0; color: #111827; font-weight: 600;">Room ${room ? room.roomNumber : 'Unassigned'} / Bed ${student.bedNumber || 'N/A'}</td></tr>
                <tr style="border-bottom: 1px solid #fee2e2;"><td style="padding: 10px 0; font-weight: bold; color: #991b1b;">Hostel Name:</td><td style="padding: 10px 0; color: #111827; font-weight: 600;">${hostelName}</td></tr>
                <tr style="border-bottom: 1px solid #fee2e2;"><td style="padding: 10px 0; font-weight: bold; color: #991b1b;">Time Triggered:</td><td style="padding: 10px 0; color: #111827; font-weight: 600;">${new Date().toLocaleString()}</td></tr>
              </table>
              
              <div style="font-size: 13px; color: #b91c1c; font-weight: bold; background-color: #fee2e2; padding: 14px; border-radius: 12px; border-left: 4px solid #ef4444;">
                CRITICAL WARNING: Please log in to the HostelFlow dashboard immediately to coordinate emergency response. Mark this issue as resolved inside the portal once settled.
              </div>
            </div>
          `;

          for (const recipient of recipients) {
            // Send emails only if they have a valid email format configured
            if (recipient.email) {
              sendEmail({
                email: recipient.email,
                subject,
                html: htmlContent
              }).catch(err => console.error(`[Emergency Email System Error] Failed to send to ${recipient.email}:`, err.message));
            }
          }
        }
      } catch (emailErr) {
        console.error('[Emergency Email Dispatch Thread Failed]', emailErr);
      }
    })();

    res.status(201).json({
      success: true,
      message: 'Emergency alert has been triggered successfully. Hostel authorities have been notified.',
      alert: populatedAlert
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all active emergency alerts for Wardens, Security, or Admins
// @route   GET /api/emergency/alerts/active
// @access  Private (WARDEN, SECURITY, ADMIN only)
const getActiveAlerts = async (req, res, next) => {
  try {
    const role = req.user.role;
    if (role !== 'WARDEN' && role !== 'SECURITY' && role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized dashboard access.' });
    }

    const query = { status: 'ACTIVE' };

    // Wardens and Security terminals are strictly isolated to their own hostel
    if (role === 'WARDEN' || role === 'SECURITY') {
      const hostelId = req.user.hostelId;
      if (!hostelId) {
        return res.status(400).json({ success: false, message: 'Your account is not assigned to a hostel.' });
      }
      query.hostelId = hostelId;
    }

    const alerts = await EmergencyAlert.find(query)
      .populate('studentId', 'fullName email admissionNumber bedNumber')
      .populate('hostelId', 'name')
      .populate('roomId', 'roomNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      alerts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark an active emergency alert as resolved
// @route   PUT /api/emergency/alerts/:id/resolve
// @access  Private (WARDEN, SECURITY, ADMIN only)
const resolveAlert = async (req, res, next) => {
  try {
    const role = req.user.role;
    if (role !== 'WARDEN' && role !== 'SECURITY' && role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized resolution permissions.' });
    }

    const alert = await EmergencyAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Emergency alert not found.' });
    }

    if (alert.status === 'RESOLVED') {
      return res.status(400).json({ success: false, message: 'This emergency alert is already resolved.' });
    }

    // Wardens and Security can only resolve alerts for their own hostel
    if (role === 'WARDEN' || role === 'SECURITY') {
      if (alert.hostelId.toString() !== req.user.hostelId.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: Alert belongs to another hostel.' });
      }
    }

    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date();
    alert.resolvedBy = req.user._id;

    await alert.save();

    // Broadcast the resolution to all connected dashboards to stop visual alerts and siren tones
    emitToRoom(`HOSTEL_${alert.hostelId}`, 'EMERGENCY_RESOLVED', {
      alertId: alert._id,
      resolvedBy: req.user.fullName
    });
    emitToRoom('ADMIN_GLOBAL', 'EMERGENCY_RESOLVED', {
      alertId: alert._id,
      resolvedBy: req.user.fullName
    });

    res.status(200).json({
      success: true,
      message: 'Emergency alert marked resolved successfully.',
      alert
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAlert,
  getActiveAlerts,
  resolveAlert
};
