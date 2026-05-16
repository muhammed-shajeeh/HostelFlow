const Leave = require('../models/Leave');
const User = require('../models/User');
const crypto = require('crypto');
const qrcode = require('qrcode');
const sendEmail = require('../utils/email');

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
// VERIFY QR CODE (WARDEN/ADMIN)
// ======================================================
const verifyQR = async (req, res, next) => {
  try {
    const { qrToken } = req.body;

    if (!qrToken) return res.status(400).json({ success: false, message: 'QR Token is required' });

    const leave = await Leave.findOne({ qrToken }).populate('studentId', 'fullName admissionNumber roomId');

    if (!leave) return res.status(404).json({ success: false, message: 'Invalid or Expired QR Token' });

    // Enforce Hostel Isolation
    if (req.user.role === 'WARDEN' && req.user.hostelId.toString() !== leave.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'This pass does not belong to your hostel.' });
    }

    if (leave.status === 'APPROVED') {
      // Student is exiting
      leave.status = 'EXITED';
      leave.exitedAt = new Date();
      leave.securityVerifiedBy = req.user._id;
      await leave.save();
      
      return res.status(200).json({ 
        success: true, 
        message: 'Exit marked successfully.', 
        action: 'EXIT',
        student: leave.studentId.fullName 
      });
    } 
    
    if (leave.status === 'EXITED') {
      // Student is returning
      leave.status = 'RETURNED';
      leave.returnedAt = new Date();
      
      // Invalidate the token to prevent reuse
      leave.qrToken = crypto.randomBytes(16).toString('hex') + '-expired';
      
      await leave.save();
      
      return res.status(200).json({ 
        success: true, 
        message: 'Return marked successfully. Pass expired.', 
        action: 'RETURN',
        student: leave.studentId.fullName 
      });
    }

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
