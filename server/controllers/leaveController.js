const Leave = require('../models/Leave');
const User = require('../models/User');
const crypto = require('crypto');
const qrcode = require('qrcode');
const sendEmail = require('../utils/email');
const ScanLog = require('../models/ScanLog');
const { createAndEmitNotification, emitToRoom } = require('../utils/socket');

// ======================================================
// REQUEST LEAVE (STUDENT)
// ======================================================
const requestLeave = async (req, res, next) => {
  console.time('requestLeaveAPI');
  try {
    const student = await User.findById(req.user._id).lean(); // Optimization: lean()


    // Validation: student must be approved and have a room
    if (student.approvalStatus !== 'APPROVED' || !student.roomId) {
      return res.status(400).json({ success: false, message: 'You must be approved and allocated to a room to request leave.' });
    }

    const { leaveType, reason, destination, emergencyContact, departureDate, expectedReturnDate, isEmergency } = req.body;

    if (!departureDate || !expectedReturnDate) {
      return res.status(400).json({ success: false, message: 'Departure and expected return dates are required.' });
    }

    if (new Date(expectedReturnDate) <= new Date(departureDate)) {
      return res.status(400).json({ success: false, message: 'Return date must be after departure date.' });
    }

    // Validation: prevent multiple active leave requests
    const activeLeave = await Leave.findOne({
      studentId: student._id,
      status: { $in: ['PENDING', 'APPROVED', 'EXITED'] }
    });

    if (activeLeave) {
      return res.status(400).json({ success: false, message: 'You already have an active leave request.' });
    }

    const leave = await Leave.create({
      studentId: student._id,
      hostelId: student.hostelId,
      roomId: student.roomId,
      leaveType,
      reason,
      destination,
      emergencyContact,
      departureDate,
      expectedReturnDate,
      isEmergency: isEmergency || false
    });

    // Notify all wardens in the student's hostel and emit real-time event
    const wardens = await User.find({ role: 'WARDEN', hostelId: student.hostelId }).select('_id').lean();
    for (const warden of wardens) {
      await createAndEmitNotification({
        recipientId: warden._id,
        title: 'New Leave Request',
        message: `${student.fullName} has requested a new ${leaveType} leave.`,
        type: 'LEAVE_REQUESTED',
        actionUrl: '/leaves/pending',
        hostelId: student.hostelId
      });
    }
    emitToRoom(`HOSTEL_${student.hostelId}`, 'REFRESH_DASHBOARD', { type: 'LEAVE_REQUESTED' });
    emitToRoom('ADMIN_GLOBAL', 'REFRESH_DASHBOARD', { type: 'LEAVE_REQUESTED' });

    res.status(201).json({ success: true, message: 'Leave requested successfully.', leave });
    console.timeEnd('requestLeaveAPI');
  } catch (error) { next(error); }
};

// ======================================================
// GET PENDING LEAVES (WARDEN/ADMIN)
// ======================================================
const getPendingLeaves = async (req, res, next) => {
  try {
    let query = { status: 'PENDING' };
    if (req.user.role === 'WARDEN') {
      query.hostelId = req.user.hostelId;
    }

    const leaves = await Leave.find(query)
      .populate('studentId', 'fullName email admissionNumber department')
      .populate('roomId', 'roomNumber floor')
      .sort('departureDate')
      .lean(); // Optimization: use lean() for read-only queries

    res.status(200).json({ success: true, count: leaves.length, leaves });
  } catch (error) { next(error); }
};

// ======================================================
// GET LEAVE HISTORY (WARDEN/ADMIN)
// ======================================================
const getLeaveHistory = async (req, res, next) => {
  try {
    let query = { status: { $ne: 'PENDING' } };
    if (req.user.role === 'WARDEN') {
      query.hostelId = req.user.hostelId;
    }

    const leaves = await Leave.find(query)
      .populate('studentId', 'fullName email admissionNumber department')
      .populate('roomId', 'roomNumber floor')
      .sort('-updatedAt')
      .lean(); // Optimization: use lean() for read-only queries

    res.status(200).json({ success: true, count: leaves.length, leaves });
  } catch (error) { next(error); }
};

// ======================================================
// GET STUDENT'S OWN LEAVE HISTORY (STUDENT)
// ======================================================
const getStudentLeaveHistory = async (req, res, next) => {
  try {
    const leaves = await Leave.find({ studentId: req.user._id }).sort('-createdAt').lean();
    res.status(200).json({ success: true, count: leaves.length, leaves });
  } catch (error) { next(error); }
};

// ======================================================
// APPROVE LEAVE (WARDEN/ADMIN)
// ======================================================
const approveLeave = async (req, res, next) => {
  console.time('approveLeaveAPI');
  try {
    const leave = await Leave.findById(req.params.id).populate('studentId', 'fullName email');

    if (!leave || leave.status !== 'PENDING') {
      return res.status(404).json({ success: false, message: 'Leave not found or not pending.' });
    }

    if (req.user.role === 'WARDEN' && req.user.hostelId.toString() !== leave.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Generate Secure QR Token
    const qrToken = crypto.randomBytes(32).toString('hex');
    
    // Generate QR Image Data URL
    const qrImage = await qrcode.toDataURL(qrToken);

    leave.status = 'APPROVED';
    leave.approvedBy = req.user._id;
    leave.approvedAt = new Date();
    leave.qrToken = qrToken;
    leave.qrGenerated = true;

    await leave.save();

    // Centrally log the operational audit timeline event
    const { logAudit } = require('../utils/auditLogger');
    await logAudit({
      req,
      actionType: 'LEAVE_APPROVED',
      entityType: 'LEAVE',
      entityId: leave._id,
      title: 'Leave Request Approved',
      description: `Approved leave request for student ${leave.studentId.fullName}. Departure: ${new Date(leave.departureDate).toDateString()}`,
      severity: 'INFO',
      hostelId: leave.hostelId
    });

    // Notify student about leave approval
    await createAndEmitNotification({
      recipientId: leave.studentId._id,
      title: 'Leave Request Approved',
      message: `Your outpass for ${new Date(leave.departureDate).toDateString()} is approved.`,
      type: 'LEAVE_APPROVED',
      actionUrl: '/student/leaves/history',
      hostelId: leave.hostelId
    });
    emitToRoom(`STUDENT_${leave.studentId._id}`, 'LEAVE_STATUS_UPDATED', leave);
    emitToRoom(`HOSTEL_${leave.hostelId}`, 'REFRESH_DASHBOARD', { type: 'LEAVE_APPROVED' });

    // Send Approval Email with QR Embedded
    const emailHtml = `
      <div style="font-family: Arial; padding:20px;">
        <h2>Leave Approved</h2>
        <p>Hello ${leave.studentId.fullName},</p>
        <p>Your leave request has been <strong>APPROVED</strong>.</p>
        <p><strong>Departure:</strong> ${new Date(leave.departureDate).toDateString()}</p>
        <p><strong>Return:</strong> ${new Date(leave.expectedReturnDate).toDateString()}</p>
        <hr/>
        <h3>Your Security QR Code</h3>
        <p>Please present this QR code to the security desk when exiting and returning.</p>
        <img src="${qrImage}" alt="QR Code" style="width: 250px; height: 250px; border: 1px solid #ccc;" />
      </div>
    `;

    res.status(200).json({ success: true, message: 'Leave approved and QR generated.', leave });

    // Optimization: Non-blocking asynchronous email
    sendEmail({ email: leave.studentId.email, subject: 'Leave Request Approved - QR Pass Inside', html: emailHtml })
      .catch(e => console.error('Failed to send QR email', e));
      
    console.timeEnd('approveLeaveAPI');
  } catch (error) { next(error); }
};

// ======================================================
// REJECT LEAVE (WARDEN/ADMIN)
// ======================================================
const rejectLeave = async (req, res, next) => {
  try {
    const { rejectionReason } = req.body;
    
    if (!rejectionReason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is mandatory.' });
    }

    const leave = await Leave.findById(req.params.id).populate('studentId', 'fullName email');

    if (!leave || leave.status !== 'PENDING') {
      return res.status(404).json({ success: false, message: 'Leave not found or not pending.' });
    }

    if (req.user.role === 'WARDEN' && req.user.hostelId.toString() !== leave.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    leave.status = 'REJECTED';
    leave.rejectionReason = rejectionReason;
    await leave.save();

    // Centrally log the operational audit timeline event
    const { logAudit } = require('../utils/auditLogger');
    await logAudit({
      req,
      actionType: 'LEAVE_REJECTED',
      entityType: 'LEAVE',
      entityId: leave._id,
      title: 'Leave Request Rejected',
      description: `Rejected leave request for student ${leave.studentId.fullName}. Reason: ${rejectionReason}`,
      severity: 'INFO',
      hostelId: leave.hostelId
    });

    // Notify student about leave rejection
    await createAndEmitNotification({
      recipientId: leave.studentId._id,
      title: 'Leave Request Rejected',
      message: `Your outpass request was rejected: "${rejectionReason}"`,
      type: 'LEAVE_REJECTED',
      actionUrl: '/student/leaves/history',
      hostelId: leave.hostelId
    });
    emitToRoom(`STUDENT_${leave.studentId._id}`, 'LEAVE_STATUS_UPDATED', leave);
    emitToRoom(`HOSTEL_${leave.hostelId}`, 'REFRESH_DASHBOARD', { type: 'LEAVE_REJECTED' });

    const emailHtml = `
      <div style="font-family: Arial; padding:20px;">
        <h2>Leave Rejected</h2>
        <p>Hello ${leave.studentId.fullName},</p>
        <p>Your leave request has been <strong>REJECTED</strong>.</p>
        <p><strong>Reason:</strong> ${rejectionReason}</p>
      </div>
    `;

    res.status(200).json({ success: true, message: 'Leave rejected successfully.' });

    // Optimization: Non-blocking email
    sendEmail({ email: leave.studentId.email, subject: 'Leave Request Rejected', html: emailHtml })
      .catch(e => console.error('Failed to send rejection email', e));
  } catch (error) { next(error); }
};

// ======================================================
// VERIFY QR CODE (WARDEN / ADMIN / SECURITY)
// ======================================================
const verifyQR = async (req, res, next) => {
  try {
    const { qrToken } = req.body;

    if (!qrToken) {
      return res.status(400).json({ success: false, message: 'QR Token is required.' });
    }

    const qrTokenHash = crypto.createHash('sha256').update(qrToken).digest('hex');

    // Helper to log all gate scan attempts
    const saveScanLog = async (action, success, errorMessage = null, studentId = null, leaveHostelId = null) => {
      try {
        await ScanLog.create({
          scannerId: req.user._id,
          hostelId: leaveHostelId || req.user.hostelId,
          studentId,
          action,
          success,
          errorMessage,
          qrTokenHash
        });
      } catch (err) {
        console.error('ScanLog creation failed:', err);
      }
    };

    // If token ends with -expired, it's a direct duplicate attempt
    if (qrToken.endsWith('-expired')) {
      await saveScanLog('FAILED', false, 'Duplicate scan: token was already completed and invalidated.');
      return res.status(400).json({
        success: false,
        warningType: 'DUPLICATE',
        message: 'Warning: This QR pass has already been used and completed.'
      });
    }

    const leave = await Leave.findOne({ qrToken })
      .populate('studentId', 'fullName admissionNumber roomId')
      .populate('roomId', 'roomNumber');

    if (!leave) {
      await saveScanLog('FAILED', false, 'Invalid or unrecognized QR token.');
      return res.status(404).json({ success: false, message: 'Invalid or unrecognized QR Token.' });
    }

    // Enforce Hostel Isolation for WARDEN and SECURITY roles
    const userHostelIdStr = req.user.hostelId ? req.user.hostelId.toString() : '';
    const leaveHostelIdStr = leave.hostelId ? leave.hostelId.toString() : '';

    if ((req.user.role === 'WARDEN' || req.user.role === 'SECURITY') && userHostelIdStr !== leaveHostelIdStr) {
      await saveScanLog('FAILED', false, 'Access Denied: Pass belongs to a different hostel.', leave.studentId?._id, leave.hostelId);
      return res.status(403).json({ success: false, message: 'This pass belongs to a student of another hostel.' });
    }

    if (leave.status === 'RETURNED') {
      await saveScanLog('FAILED', false, 'Duplicate scan attempt: leave already completed.', leave.studentId?._id, leave.hostelId);
      return res.status(400).json({
        success: false,
        warningType: 'DUPLICATE',
        message: 'Duplicate Scan Warning: This leave has already been completed and the student returned.'
      });
    }

    if (leave.status === 'REJECTED') {
      await saveScanLog('FAILED', false, 'Scan attempt on rejected leave request.', leave.studentId?._id, leave.hostelId);
      return res.status(400).json({ success: false, message: 'This leave request was rejected by management.' });
    }

    if (leave.status === 'PENDING') {
      await saveScanLog('FAILED', false, 'Scan attempt on non-approved leave request.', leave.studentId?._id, leave.hostelId);
      return res.status(400).json({ success: false, message: 'This leave request is still pending approval.' });
    }

    if (leave.status === 'APPROVED') {
      // Student is exiting
      leave.status = 'EXITED';
      leave.exitedAt = new Date();
      leave.securityVerifiedBy = req.user._id;
      await leave.save();

      await saveScanLog('EXIT', true, null, leave.studentId?._id, leave.hostelId);

      // Notify student
      await createAndEmitNotification({
        recipientId: leave.studentId._id,
        title: 'Exit Marked at Gate',
        message: 'Your gate exit pass was scanned and verified successfully.',
        type: 'QR_EXIT_MARKED',
        actionUrl: '/student/leaves/history',
        hostelId: leave.hostelId
      });

      // Find parents and notify them
      const parents = await User.find({ role: 'PARENT', students: leave.studentId._id }).select('_id').lean();
      for (const parent of parents) {
        await createAndEmitNotification({
          recipientId: parent._id,
          title: 'Child Exit Alert',
          message: `${leave.studentId.fullName} has successfully checked out of the hostel gates.`,
          type: 'QR_EXIT_MARKED',
          actionUrl: '/parent/dashboard',
          hostelId: leave.hostelId
        });
      }

      // Live update dashboard metrics
      emitToRoom(`HOSTEL_${leave.hostelId}`, 'REFRESH_DASHBOARD', { type: 'QR_EXIT_MARKED' });
      emitToRoom(`STUDENT_${leave.studentId._id}`, 'LEAVE_STATUS_UPDATED', leave);

      return res.status(200).json({
        success: true,
        message: 'Exit authorized successfully.',
        action: 'EXIT',
        student: {
          fullName: leave.studentId.fullName,
          admissionNumber: leave.studentId.admissionNumber,
          roomNumber: leave.roomId?.roomNumber || 'Unassigned',
          hostelId: leave.hostelId
        },
        timestamp: leave.exitedAt
      });
    }

    if (leave.status === 'EXITED') {
      // Student is returning
      leave.status = 'RETURNED';
      leave.returnedAt = new Date();
      
      // Invalidate the token to prevent any future reuse
      leave.qrToken = crypto.randomBytes(16).toString('hex') + '-expired';
      await leave.save();

      await saveScanLog('RETURN', true, null, leave.studentId?._id, leave.hostelId);

      // Notify student
      await createAndEmitNotification({
        recipientId: leave.studentId._id,
        title: 'Return Marked at Gate',
        message: 'Your gate return check-in was verified successfully. Welcome back!',
        type: 'QR_RETURN_MARKED',
        actionUrl: '/student/leaves/history',
        hostelId: leave.hostelId
      });

      // Find parents and notify them
      const parents = await User.find({ role: 'PARENT', students: leave.studentId._id }).select('_id').lean();
      for (const parent of parents) {
        await createAndEmitNotification({
          recipientId: parent._id,
          title: 'Child Return Alert',
          message: `${leave.studentId.fullName} has returned safely to the hostel.`,
          type: 'QR_RETURN_MARKED',
          actionUrl: '/parent/dashboard',
          hostelId: leave.hostelId
        });
      }

      // Live update dashboard metrics
      emitToRoom(`HOSTEL_${leave.hostelId}`, 'REFRESH_DASHBOARD', { type: 'QR_RETURN_MARKED' });
      emitToRoom(`STUDENT_${leave.studentId._id}`, 'LEAVE_STATUS_UPDATED', leave);

      return res.status(200).json({
        success: true,
        message: 'Return authorized successfully. Pass completed and invalidated.',
        action: 'RETURN',
        student: {
          fullName: leave.studentId.fullName,
          admissionNumber: leave.studentId.admissionNumber,
          roomNumber: leave.roomId?.roomNumber || 'Unassigned',
          hostelId: leave.hostelId
        },
        timestamp: leave.returnedAt
      });
    }

    await saveScanLog('FAILED', false, 'Unhandled status code transition.', leave.studentId?._id, leave.hostelId);
    return res.status(400).json({ success: false, message: 'This pass is not active or has already been completed.' });
  } catch (error) { next(error); }
};

// ======================================================
// DASHBOARD STATS (WARDEN/STUDENT)
// ======================================================
const getLeaveStats = async (req, res, next) => {
  try {
    if (req.user.role === 'STUDENT') {
      // Optimization: Parallelize async queries
      const [activeLeave, totalLeaves] = await Promise.all([
        Leave.findOne({ studentId: req.user._id, status: { $in: ['PENDING', 'APPROVED', 'EXITED'] } }).lean(),
        Leave.countDocuments({ studentId: req.user._id })
      ]);
      return res.status(200).json({ success: true, stats: { activeLeave, totalLeaves } });
    }

    // For Warden/Admin
    let query = {};
    if (req.user.role === 'WARDEN') query.hostelId = req.user.hostelId;

    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date();
    endOfDay.setHours(23,59,59,999);

    // Optimization: Parallelize independent DB queries using Promise.all
    const [pendingLeaves, studentsOutside, returnedToday] = await Promise.all([
      Leave.countDocuments({ ...query, status: 'PENDING' }),
      Leave.countDocuments({ ...query, status: 'EXITED' }),
      Leave.countDocuments({ 
        ...query, 
        status: 'RETURNED',
        returnedAt: { $gte: startOfDay, $lte: endOfDay }
      })
    ]);

    res.status(200).json({
      success: true,
      stats: {
        pendingLeaves,
        studentsOutside,
        returnedToday
      }
    });

  } catch (error) { next(error); }
};

module.exports = {
  requestLeave,
  getPendingLeaves,
  getLeaveHistory,
  getStudentLeaveHistory,
  approveLeave,
  rejectLeave,
  verifyQR,
  getLeaveStats
};
