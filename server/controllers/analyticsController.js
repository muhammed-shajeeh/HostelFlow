const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Complaint = require('../models/Complaint');
const Notice = require('../models/Notice');
const Room = require('../models/Room');
const Hostel = require('../models/Hostel');
const User = require('../models/User');

// ======================================================
// ANALYTICS CONTROLLER
// ======================================================
// Powers the analytics & reporting system.
//
// Role scoping:
//   ADMIN  → system-wide metrics across all hostels
//   WARDEN → hostel-isolated metrics for their hostel only
//   STUDENT → personal stats (attendance %, leave history, complaints)
//
// All pipelines use:
//   - .lean() for read-only performance
//   - Promise.all() to run independent queries in parallel
//   - Indexed fields in $match stages for speed
// ======================================================


// ──────────────────────────────────────────────────────
// Shared helper: extract a plain ObjectId string from
// either a populated object or a raw ObjectId
// ──────────────────────────────────────────────────────
const toObjectId = (val) => {
  const mongoose = require('mongoose');
  const raw = val?._id || val;
  return new mongoose.Types.ObjectId(raw.toString());
};

// ──────────────────────────────────────────────────────
// Shared helper: generate last-N-days date labels
// e.g. ['May 10', 'May 11', ..., 'May 16']
// ──────────────────────────────────────────────────────
const getLastNDaysLabels = (n) => {
  const labels = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
  }
  return labels;
};

// ──────────────────────────────────────────────────────
// GET /api/analytics/admin
// Full system-wide analytics for ADMIN role
// ──────────────────────────────────────────────────────
const getAdminAnalytics = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // ── Run all aggregations in parallel ─────────────
    const [
      hostelOccupancy,         // Per-hostel occupancy comparison
      attendanceTrend,          // Daily attendance counts (last 30 days)
      complaintTrend,           // Complaints filed per day (last 30 days)
      complaintsByCategory,     // Distribution of categories
      complaintsByStatus,       // Open / In Progress / Resolved
      leaveTrend,               // Leaves approved per day
      lateReturns,              // Total late return count
      totalStudents,
      totalRooms,
      activeNotices,
      emergencyNotices
    ] = await Promise.all([
      // ── 1. Hostel-wise occupancy ──────────────────
      // Join hostels with rooms to compute occupancy %
      Hostel.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'rooms',
            localField: '_id',
            foreignField: 'hostelId',
            as: 'rooms'
          }
        },
        {
          $project: {
            name: 1,
            hostelCode: 1,
            totalRooms: { $size: '$rooms' },
            totalCapacity: { $sum: '$rooms.capacity' },
            totalOccupied: { $sum: '$rooms.occupiedBeds' }
          }
        },
        {
          $addFields: {
            occupancyPct: {
              $cond: [
                { $eq: ['$totalCapacity', 0] },
                0,
                { $round: [{ $multiply: [{ $divide: ['$totalOccupied', '$totalCapacity'] }, 100] }, 1] }
              ]
            }
          }
        }
      ]),

      // ── 2. Attendance trend (last 30 days) ────────
      // Group by date and count statuses
      Attendance.aggregate([
        { $match: { date: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            present: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] } },
            onLeave: { $sum: { $cond: [{ $eq: ['$status', 'ON_LEAVE'] }, 1, 0] } },
            lateReturn: { $sum: { $cond: [{ $eq: ['$status', 'LATE_RETURN'] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // ── 3. Complaint trend (last 30 days) ─────────
      Complaint.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // ── 4. Complaints by category ─────────────────
      Complaint.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 }
      ]),

      // ── 5. Complaints by status ───────────────────
      Complaint.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),

      // ── 6. Leave approval trend (last 30 days) ────
      Leave.aggregate([
        { $match: { status: 'APPROVED', createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // ── 7. Late return count (total) ──────────────
      Attendance.countDocuments({ status: 'LATE_RETURN' }),

      // ── Summary counts (run in parallel) ─────────
      User.countDocuments({ role: 'STUDENT', approvalStatus: 'APPROVED' }),
      Room.countDocuments(),
      Notice.countDocuments({ isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }),
      Notice.countDocuments({ priority: 'EMERGENCY', isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] })
    ]);

    // ── Flatten complaint status into object ──────
    const complaintStatusMap = {};
    complaintsByStatus.forEach(s => { complaintStatusMap[s._id] = s.count; });

    res.status(200).json({
      success: true,
      analytics: {
        summary: {
          totalStudents,
          totalRooms,
          activeNotices,
          emergencyNotices,
          lateReturns,
          openComplaints: complaintStatusMap.OPEN || 0,
          resolvedComplaints: complaintStatusMap.RESOLVED || 0
        },
        hostelOccupancy,
        attendanceTrend,
        complaintTrend,
        complaintsByCategory,
        complaintsByStatus: complaintStatusMap,
        leaveTrend
      }
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// GET /api/analytics/warden
// Hostel-isolated analytics for WARDEN role
// ──────────────────────────────────────────────────────
const getWardenAnalytics = async (req, res, next) => {
  try {
    // Hostel isolation: all queries scoped to this warden's hostel
    const hostelId = toObjectId(req.user.hostelId);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      roomOccupancy,          // Per-room occupancy in this hostel
      attendanceTrend,         // Daily attendance for this hostel (30 days)
      attendanceSummary,       // Today's count by status
      complaintsByCategory,    // Complaint category distribution
      complaintsByStatus,      // Status breakdown
      leaveSummary,            // Active leaves count
      lateReturnCount,
      totalStudents
    ] = await Promise.all([
      // ── 1. Room-level occupancy ───────────────────
      Room.find({ hostelId }, 'roomNumber floor capacity occupiedBeds availableBeds roomType')
        .sort({ floor: 1, roomNumber: 1 })
        .lean(),

      // ── 2. Attendance trend (30 days, this hostel) ─
      Attendance.aggregate([
        { $match: { hostelId, date: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            present: { $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] } },
            onLeave: { $sum: { $cond: [{ $eq: ['$status', 'ON_LEAVE'] }, 1, 0] } },
            lateReturn: { $sum: { $cond: [{ $eq: ['$status', 'LATE_RETURN'] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // ── 3. Today's attendance summary ─────────────
      Attendance.aggregate([
        {
          $match: {
            hostelId,
            date: {
              $gte: new Date(new Date().setHours(0, 0, 0, 0)),
              $lte: new Date(new Date().setHours(23, 59, 59, 999))
            }
          }
        },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),

      // ── 4. Complaints by category (this hostel) ───
      Complaint.aggregate([
        { $match: { hostelId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // ── 5. Complaint status breakdown ─────────────
      Complaint.aggregate([
        { $match: { hostelId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),

      // ── 6. Active leaves ──────────────────────────
      Leave.countDocuments({ hostelId, status: 'APPROVED' }),

      // ── 7. Late returns (this hostel, total) ──────
      Attendance.countDocuments({ hostelId, status: 'LATE_RETURN' }),

      // ── 8. Total approved students ────────────────
      User.countDocuments({ hostelId, role: 'STUDENT', approvalStatus: 'APPROVED' })
    ]);

    // Flatten summary maps
    const todayMap = {};
    attendanceSummary.forEach(s => { todayMap[s._id] = s.count; });

    const complaintStatusMap = {};
    complaintsByStatus.forEach(s => { complaintStatusMap[s._id] = s.count; });

    // Compute room utilisation %
    const totalCapacity = roomOccupancy.reduce((acc, r) => acc + r.capacity, 0);
    const totalOccupied = roomOccupancy.reduce((acc, r) => acc + r.occupiedBeds, 0);
    const occupancyPct = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    res.status(200).json({
      success: true,
      analytics: {
        summary: {
          totalStudents,
          totalRooms: roomOccupancy.length,
          occupancyPct,
          leaveSummary,
          lateReturnCount,
          openComplaints: complaintStatusMap.OPEN || 0
        },
        roomOccupancy,
        attendanceTrend,
        todayAttendance: todayMap,
        complaintsByCategory,
        complaintsByStatus: complaintStatusMap
      }
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// GET /api/analytics/student
// Personal analytics for logged-in STUDENT
// ──────────────────────────────────────────────────────
const getStudentAnalytics = async (req, res, next) => {
  try {
    const studentId = toObjectId(req.user._id);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [
      attendanceHistory,   // All records for this student
      leaveHistory,        // All leave records
      complaintSummary     // Grouped by status
    ] = await Promise.all([
      // ── 1. Attendance history (90 days) ──────────
      Attendance.find(
        { studentId, date: { $gte: ninetyDaysAgo } },
        'date status'
      ).sort({ date: 1 }).lean(),

      // ── 2. Leave history (all time) ───────────────
      Leave.find(
        { studentId },
        'leaveType status departureDate expectedReturnDate createdAt'
      ).sort({ createdAt: -1 }).lean(),

      // ── 3. Complaint status summary ───────────────
      Complaint.aggregate([
        { $match: { studentId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    // ── Calculate attendance % ─────────────────────
    const totalDays = attendanceHistory.length;
    const presentDays = attendanceHistory.filter(a => a.status === 'PRESENT').length;
    const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    // ── Build attendance timeline for chart ────────
    // Groups records by week for a cleaner chart
    const attendanceTimeline = attendanceHistory.map(a => ({
      date: new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      status: a.status,
      value: a.status === 'PRESENT' ? 1 : 0
    }));

    // ── Flatten complaint map ──────────────────────
    const complaintMap = {};
    complaintSummary.forEach(c => { complaintMap[c._id] = c.count; });

    res.status(200).json({
      success: true,
      analytics: {
        attendance: {
          pct: attendancePct,
          totalDays,
          presentDays,
          absentDays: attendanceHistory.filter(a => a.status === 'ABSENT').length,
          onLeaveDays: attendanceHistory.filter(a => a.status === 'ON_LEAVE').length,
          lateReturnDays: attendanceHistory.filter(a => a.status === 'LATE_RETURN').length,
          timeline: attendanceTimeline
        },
        leaves: {
          total: leaveHistory.length,
          approved: leaveHistory.filter(l => l.status === 'APPROVED').length,
          pending: leaveHistory.filter(l => l.status === 'PENDING').length,
          rejected: leaveHistory.filter(l => l.status === 'REJECTED').length,
          history: leaveHistory.slice(0, 10) // Last 10 for display
        },
        complaints: {
          total: Object.values(complaintMap).reduce((a, b) => a + b, 0),
          ...complaintMap
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────
// GET /api/analytics/export?type=attendance|complaints|leaves
// CSV export for Admin/Warden
// ──────────────────────────────────────────────────────
const exportData = async (req, res, next) => {
  try {
    const { type } = req.query;
    const hostelFilter = req.user.role === 'WARDEN'
      ? { hostelId: toObjectId(req.user.hostelId) }
      : {};

    let csvRows = [];
    let filename = '';

    if (type === 'attendance') {
      filename = 'attendance_export.csv';
      const records = await Attendance.find(hostelFilter)
        .populate('studentId', 'fullName admissionNumber')
        .populate('roomId', 'roomNumber floor')
        .sort({ date: -1 })
        .limit(1000)
        .lean();

      csvRows = [
        ['Student Name', 'Admission No', 'Room', 'Floor', 'Date', 'Status', 'Remarks'],
        ...records.map(r => [
          r.studentId?.fullName || '',
          r.studentId?.admissionNumber || '',
          r.roomId?.roomNumber || '',
          r.roomId?.floor || '',
          new Date(r.date).toLocaleDateString(),
          r.status,
          r.remarks || ''
        ])
      ];
    } else if (type === 'complaints') {
      filename = 'complaints_export.csv';
      const records = await Complaint.find(hostelFilter)
        .populate('studentId', 'fullName admissionNumber')
        .populate('roomId', 'roomNumber floor')
        .sort({ createdAt: -1 })
        .limit(1000)
        .lean();

      csvRows = [
        ['Title', 'Student', 'Admission No', 'Room', 'Category', 'Priority', 'Status', 'Date', 'Resolution Notes'],
        ...records.map(r => [
          r.title,
          r.studentId?.fullName || '',
          r.studentId?.admissionNumber || '',
          r.roomId?.roomNumber || '',
          r.category,
          r.priority,
          r.status,
          new Date(r.createdAt).toLocaleDateString(),
          r.resolutionNotes || ''
        ])
      ];
    } else if (type === 'leaves') {
      filename = 'leaves_export.csv';
      const records = await Leave.find(hostelFilter)
        .populate('studentId', 'fullName admissionNumber')
        .sort({ createdAt: -1 })
        .limit(1000)
        .lean();

      csvRows = [
        ['Student', 'Admission No', 'Leave Type', 'Status', 'Departure', 'Expected Return', 'Applied On'],
        ...records.map(r => [
          r.studentId?.fullName || '',
          r.studentId?.admissionNumber || '',
          r.leaveType,
          r.status,
          r.departureDate ? new Date(r.departureDate).toLocaleDateString() : '',
          r.expectedReturnDate ? new Date(r.expectedReturnDate).toLocaleDateString() : '',
          new Date(r.createdAt).toLocaleDateString()
        ])
      ];
    } else {
      return res.status(400).json({ success: false, message: 'Invalid export type. Use: attendance, complaints, leaves' });
    }

    // Convert to CSV string
    const csvContent = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminAnalytics,
  getWardenAnalytics,
  getStudentAnalytics,
  exportData
};
