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
    if (!req.user.linkedStudents.includes(studentId)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this student' });
    }

    const [student, attendance, leaves, complaints] = await Promise.all([
      User.findById(studentId).populate('hostelId roomId').lean(),
      Attendance.find({ studentId }).sort({ date: -1 }).limit(10).lean(),
      Leave.find({ studentId }).sort({ createdAt: -1 }).limit(10).lean(),
      Complaint.find({ studentId }).sort({ createdAt: -1 }).limit(5).lean()
    ]);

    // Calculate attendance percentage
    const totalAttendance = await Attendance.countDocuments({ studentId });
    const presentCount = await Attendance.countDocuments({ studentId, status: 'PRESENT' });
    const attendancePct = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        student,
        attendance: {
          history: attendance,
          percentage: attendancePct
        },
        leaves,
        complaints
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
