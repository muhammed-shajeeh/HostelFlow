const User = require('../models/User');
const Leave = require('../models/Leave');
const Attendance = require('../models/Attendance');
const Complaint = require('../models/Complaint');
const mongoose = require('mongoose');

// ======================================================
// PARENT CONTROLLER
// ======================================================
// Manages guardian access to linked student data and 
// emergency leave approvals.
// ======================================================

// @desc    Get all linked students for a parent
// @route   GET /api/parent/students
// @access  Private (Parent)
const getLinkedStudents = async (req, res, next) => {
  try {
    const parent = await User.findById(req.user._id).populate({
      path: 'linkedStudents',
      select: 'fullName admissionNumber department year semester profileImage hostelId roomId',
      populate: [
        { path: 'hostelId', select: 'name' },
        { path: 'roomId', select: 'roomNumber' }
      ]
    }).lean();

    res.status(200).json({
      success: true,
      students: parent.linkedStudents
    });
  } catch (error) { next(error); }
};

// @desc    Get detailed stats for a linked student
// @route   GET /api/parent/student/:id
// @access  Private (Parent)
const getStudentDetails = async (req, res, next) => {
  try {
    const studentId = req.params.id;

    // Security: Verify student is linked to this parent
    const parent = await User.findById(req.user._id).select('linkedStudents').lean();
    const linkedIds = parent?.linkedStudents?.map(id => id.toString()) || [];
    if (!linkedIds.includes(studentId.toString())) {
      return res.status(403).json({ success: false, message: 'You do not have access to this student' });
    }

    const [student, attendance, leaves, complaints] = await Promise.all([
      User.findById(studentId)
        .populate({ path: 'hostelId', select: 'name' })
        .populate({ path: 'roomId', select: 'roomNumber' })
        .lean(),
      Attendance.find({ studentId }).populate('markedBy', 'fullName').sort({ date: -1 }).limit(30).lean(),
      Leave.find({ studentId }).sort({ createdAt: -1 }).limit(10).lean(),
      Complaint.find({ studentId }).sort({ createdAt: -1 }).limit(10).lean()
    ]);

    // Calculate attendance metrics
    const presentCount = await Attendance.countDocuments({ studentId, status: 'PRESENT' });
    const absentCount = await Attendance.countDocuments({ studentId, status: 'ABSENT' });
    const onLeaveCount = await Attendance.countDocuments({ studentId, status: 'ON_LEAVE' });
    const lateReturnCount = await Attendance.countDocuments({ studentId, status: 'LATE_RETURN' });
    const totalAttendance = presentCount + absentCount + onLeaveCount + lateReturnCount;
    
    // Constructive attendance count = PRESENT + ON_LEAVE + LATE_RETURN
    const activePresent = presentCount + onLeaveCount + lateReturnCount;
    const attendancePct = totalAttendance > 0 ? Math.round((activePresent / totalAttendance) * 100) : 100;

    // Calculate Monthly Trend for the last 6 months
    const monthlyTrend = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const mPresent = await Attendance.countDocuments({ studentId, status: 'PRESENT', date: { $gte: start, $lte: end } });
      const mAbsent = await Attendance.countDocuments({ studentId, status: 'ABSENT', date: { $gte: start, $lte: end } });
      const mLeave = await Attendance.countDocuments({ studentId, status: 'ON_LEAVE', date: { $gte: start, $lte: end } });
      const mLate = await Attendance.countDocuments({ studentId, status: 'LATE_RETURN', date: { $gte: start, $lte: end } });
      const mTotal = mPresent + mAbsent + mLeave + mLate;
      const mPct = mTotal > 0 ? Math.round(((mPresent + mLeave + mLate) / mTotal) * 100) : 100;

      monthlyTrend.push({
        monthName: d.toLocaleString('default', { month: 'short' }),
        year: d.getFullYear(),
        present: mPresent,
        absent: mAbsent,
        onLeave: mLeave,
        lateReturn: mLate,
        total: mTotal,
        percentage: mPct
      });
    }

    // Base notice query targeting this student's hostel or global
    const hostelId = student?.hostelId?._id || student?.hostelId;
    const baseNoticeQuery = {
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      visibleTo: { $in: ['ALL', 'STUDENTS'] },
    };
    if (hostelId) {
      baseNoticeQuery.$and = [
        {
          $or: [
            { targetType: 'GLOBAL' },
            { targetType: 'HOSTEL', hostelId: hostelId }
          ]
        }
      ];
    } else {
      baseNoticeQuery.targetType = 'GLOBAL';
    }

    const notices = await mongoose.model('Notice').find(baseNoticeQuery)
      .populate('createdBy', 'fullName role')
      .sort({ isPinned: -1, priority: 1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        student,
        attendance: {
          history: attendance,
          percentage: attendancePct,
          presentCount,
          absentCount,
          onLeaveCount,
          lateReturnCount,
          totalCount: totalAttendance,
          monthlyTrend
        },
        leaves,
        complaints,
        notices
      }
    });
  } catch (error) { next(error); }
};

// @desc    Change Parent Password (Initial)
// @route   PUT /api/parent/change-password
// @access  Private (Parent)
const changeInitialPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findById(req.user._id);

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) { next(error); }
};

module.exports = {
  getLinkedStudents,
  getStudentDetails,
  changeInitialPassword
};
