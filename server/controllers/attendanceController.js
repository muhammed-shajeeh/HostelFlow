const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Leave = require('../models/Leave');
const Room = require('../models/Room');
const { createAndEmitNotification, emitToRoom } = require('../utils/socket');

// Helper function to normalize date to midnight UTC for consistent querying
const normalizeDate = (dateString) => {
  const date = new Date(dateString);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

// ======================================================
// BULK MARK ROOM ATTENDANCE (WARDEN/ADMIN)
// ======================================================
const markRoomAttendance = async (req, res, next) => {
  try {
    const { roomId, date, attendanceRecords } = req.body;
    
    if (!roomId || !date || !Array.isArray(attendanceRecords)) {
      return res.status(400).json({ success: false, message: 'Invalid data format' });
    }

    const normalizedDate = normalizeDate(date);
    
    // Verify room exists and belongs to the warden's hostel
    const room = await Room.findById(roomId).lean();
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    
    if (req.user.role === 'WARDEN' && room.hostelId.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden: Room not in your hostel' });
    }

    const operations = [];
    const currentDate = new Date();

    for (const record of attendanceRecords) {
      let finalStatus = record.status;
      let leaveRef = null;

      // Automatically Detect Leaves and Late Returns
      // Look for a leave that intersects with the attendance date
      const activeLeave = await Leave.findOne({
        studentId: record.studentId,
        status: { $in: ['APPROVED', 'EXITED'] },
        departureDate: { $lte: new Date(normalizedDate.getTime() + 86400000) } // Leave started before end of attendance day
      }).sort('-departureDate').lean();

      if (activeLeave) {
        leaveRef = activeLeave._id;
        // Check if late return
        if (new Date(activeLeave.expectedReturnDate) < currentDate) {
          finalStatus = 'LATE_RETURN';
        } else {
          finalStatus = 'ON_LEAVE';
        }
      }

      // Prepare upsert operation to prevent duplicates for the same student on the same date
      operations.push({
        updateOne: {
          filter: { studentId: record.studentId, date: normalizedDate },
          update: {
            $set: {
              hostelId: room.hostelId,
              roomId: roomId,
              markedBy: req.user._id,
              status: finalStatus,
              remarks: record.remarks || '',
              leaveReference: leaveRef,
              markedAt: new Date()
            }
          },
          upsert: true
        }
      });
    }

    if (operations.length > 0) {
      await Attendance.bulkWrite(operations);

      // Trigger Real-Time Notification Alerts & Dashboard Resets
      for (const record of attendanceRecords) {
        let finalStatus = record.status;
        const activeLeave = await Leave.findOne({
          studentId: record.studentId,
          status: { $in: ['APPROVED', 'EXITED'] },
          departureDate: { $lte: new Date(normalizedDate.getTime() + 86400000) }
        }).sort('-departureDate').lean();

        if (activeLeave) {
          finalStatus = new Date(activeLeave.expectedReturnDate) < currentDate ? 'LATE_RETURN' : 'ON_LEAVE';
        }

        // Notify student
        await createAndEmitNotification({
          recipientId: record.studentId,
          title: 'Daily Attendance Marked',
          message: `Your attendance status for ${normalizedDate.toDateString()} is marked as ${finalStatus.replace('_', ' ')}.`,
          type: 'ATTENDANCE_ALERT',
          actionUrl: '/student/attendance',
          hostelId: room.hostelId
        });

        // Notify parents
        const parents = await User.find({ role: 'PARENT', students: record.studentId }).select('_id').lean();
        for (const parent of parents) {
          await createAndEmitNotification({
            recipientId: parent._id,
            title: finalStatus === 'LATE_RETURN' ? '🚨 Child Late Return Alert' : 'Daily Attendance Update',
            message: finalStatus === 'LATE_RETURN' 
              ? `URGENT: Your child has failed to check in before curfew cutoff on ${normalizedDate.toDateString()}.`
              : `${record.studentId} child attendance marked as ${finalStatus.replace('_', ' ')}.`,
            type: finalStatus === 'LATE_RETURN' ? 'LATE_RETURN_ALERT' : 'ATTENDANCE_ALERT',
            actionUrl: '/parent/dashboard',
            hostelId: room.hostelId
          });
          emitToRoom(`PARENT_${parent._id}`, 'REFRESH_DASHBOARD', { type: 'ATTENDANCE_MARKED' });
        }

        emitToRoom(`STUDENT_${record.studentId}`, 'REFRESH_DASHBOARD', { type: 'ATTENDANCE_MARKED' });
      }

      emitToRoom(`HOSTEL_${room.hostelId}`, 'REFRESH_DASHBOARD', { type: 'ATTENDANCE_MARKED' });
      emitToRoom('ADMIN_GLOBAL', 'REFRESH_DASHBOARD', { type: 'ATTENDANCE_MARKED' });
    }

    res.status(200).json({ success: true, message: 'Attendance marked successfully' });
  } catch (error) { next(error); }
};

// ======================================================
// GET DAILY ATTENDANCE (WARDEN/ADMIN)
// ======================================================
const getDailyAttendance = async (req, res, next) => {
  try {
    const { date, roomId } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

    const normalizedDate = normalizeDate(date);
    let query = { date: normalizedDate };

    // Hostel isolation
    if (req.user.role === 'WARDEN') {
      query.hostelId = req.user.hostelId;
    }
    
    if (roomId) query.roomId = roomId;

    const attendances = await Attendance.find(query)
      .populate('studentId', 'fullName admissionNumber')
      .populate('roomId', 'roomNumber')
      .lean();

    res.status(200).json({ success: true, count: attendances.length, attendances });
  } catch (error) { next(error); }
};

// ======================================================
// GET ATTENDANCE SUMMARY ANALYTICS (WARDEN/ADMIN)
// ======================================================
const getAttendanceSummary = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

    const normalizedDate = normalizeDate(date);
    let query = { date: normalizedDate };

    if (req.user.role === 'WARDEN') {
      query.hostelId = req.user.hostelId;
    }

    // Parallelize aggregate and total count queries
    const [stats, totalHostelStudents] = await Promise.all([
      Attendance.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      User.countDocuments({ 
        role: 'STUDENT', 
        approvalStatus: 'APPROVED', 
        ...(req.user.role === 'WARDEN' && { hostelId: req.user.hostelId }) 
      })
    ]);

    const summary = {
      PRESENT: 0,
      ABSENT: 0,
      ON_LEAVE: 0,
      LATE_RETURN: 0,
      totalMarked: 0,
      totalStudents: totalHostelStudents
    };

    stats.forEach(stat => {
      if (summary[stat._id] !== undefined) {
        summary[stat._id] = stat.count;
        summary.totalMarked += stat.count;
      }
    });

    const attendancePercentage = summary.totalMarked > 0 
      ? Math.round((summary.PRESENT / summary.totalMarked) * 100) 
      : 0;

    res.status(200).json({ 
      success: true, 
      summary: { ...summary, attendancePercentage } 
    });
  } catch (error) { next(error); }
};

// ======================================================
// GET STUDENT ATTENDANCE HISTORY (STUDENT)
// ======================================================
const getStudentAttendanceHistory = async (req, res, next) => {
  try {
    const studentId = req.user._id;

    const [attendances, totalCount, presentCount] = await Promise.all([
      Attendance.find({ studentId })
        .sort('-date')
        .populate('leaveReference', 'leaveType status')
        .lean(),
      Attendance.countDocuments({ studentId }),
      Attendance.countDocuments({ studentId, status: 'PRESENT' })
    ]);

    const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

    res.status(200).json({ 
      success: true, 
      count: attendances.length, 
      percentage,
      attendances 
    });
  } catch (error) { next(error); }
};

module.exports = {
  markRoomAttendance,
  getDailyAttendance,
  getAttendanceSummary,
  getStudentAttendanceHistory
};
