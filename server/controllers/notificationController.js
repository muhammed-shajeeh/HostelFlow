const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');

const getNotifications = async (req, res, next) => {
  try {
    // SECURITY terminal accounts are blocked from receiving or viewing notifications
    if (req.user.role === 'SECURITY') {
      return res.status(403).json({ 
        success: false, 
        message: 'Security gate terminals do not support personalized notifications.' 
      });
    }

    // Run parallel queries using compound index for speed
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipientId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Notification.countDocuments({ recipientId: req.user._id, isRead: false })
    ]);

    res.status(200).json({ 
      success: true, 
      count: notifications.length, 
      unreadCount, 
      notifications 
    });
  } catch (error) { 
    next(error); 
  }
};

const markAsRead = async (req, res, next) => {
  try {
    if (req.user.role === 'SECURITY') {
      return res.status(403).json({ success: false, message: 'Operation not permitted.' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user._id },
      { isRead: true },
      { returnDocument: 'after' }
    );
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    // Recalculate unread count to keep client in sync
    const unreadCount = await Notification.countDocuments({ recipientId: req.user._id, isRead: false });

    res.status(200).json({ success: true, notification, unreadCount });
  } catch (error) { 
    next(error); 
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    if (req.user.role === 'SECURITY') {
      return res.status(403).json({ success: false, message: 'Operation not permitted.' });
    }

    await Notification.updateMany(
      { recipientId: req.user._id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({ 
      success: true, 
      message: 'All notifications marked as read.',
      unreadCount: 0
    });
  } catch (error) { 
    next(error); 
  }
};

const registerDeviceToken = async (req, res, next) => {
  try {
    const { fcmToken, deviceType } = req.body;

    if (req.user.role === 'SECURITY') {
      return res.status(403).json({ success: false, message: 'Security terminals cannot register push tokens.' });
    }

    if (!fcmToken || !deviceType) {
      return res.status(400).json({ success: false, message: 'fcmToken and deviceType are required.' });
    }

    const tokenDoc = await DeviceToken.findOneAndUpdate(
      { fcmToken },
      {
        userId: req.user._id,
        role: req.user.role,
        hostelId: req.user.hostelId || null,
        deviceType,
        lastActiveAt: new Date()
      },
      { upsert: true, returnDocument: 'after' }
    );

    res.status(200).json({ success: true, message: 'Device token registered successfully.', token: tokenDoc });
  } catch (error) {
    next(error);
  }
};

const deregisterDeviceToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'fcmToken is required.' });
    }

    await DeviceToken.deleteOne({ fcmToken, userId: req.user._id });

    res.status(200).json({ success: true, message: 'Device token deregistered successfully.' });
  } catch (error) {
    next(error);
  }
};

const User = require('../models/User');
const Leave = require('../models/Leave');
const Complaint = require('../models/Complaint');

const getNotificationSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;
    const hostelId = req.user.hostelId;

    const summary = {
      pendingStudents: 0,
      pendingLeaves: 0,
      pendingComplaints: 0,
      unreadNotifications: 0,
      leaveUpdates: 0,
      complaintUpdates: 0
    };

    // 1. Fetch unread notification counts for all roles except SECURITY
    if (role !== 'SECURITY') {
      summary.unreadNotifications = await Notification.countDocuments({
        recipientId: userId,
        isRead: false
      });
    }

    // 2. Fetch specific ERP action items depending on role
    if (role === 'ADMIN') {
      const [students, complaints] = await Promise.all([
        User.countDocuments({ role: 'STUDENT', approvalStatus: 'PENDING' }),
        Complaint.countDocuments({ status: 'OPEN' })
      ]);
      summary.pendingStudents = students;
      summary.pendingComplaints = complaints;
    } else if (role === 'WARDEN') {
      // For wardens, filter by their assigned hostel if configured
      const queryFilter = hostelId ? { hostelId } : {};
      
      const [leaves, complaints, students] = await Promise.all([
        Leave.countDocuments({ ...queryFilter, status: 'PENDING' }),
        Complaint.countDocuments({ ...queryFilter, status: 'OPEN' }),
        User.countDocuments({ ...queryFilter, role: 'STUDENT', approvalStatus: 'PENDING' })
      ]);
      summary.pendingLeaves = leaves;
      summary.pendingComplaints = complaints;
      summary.pendingStudents = students;
    } else if (role === 'STUDENT') {
      const [leaves, complaints, unreadNotifs] = await Promise.all([
        Leave.countDocuments({ studentId: userId, status: 'PENDING' }),
        Complaint.countDocuments({ studentId: userId, status: 'OPEN' }),
        Notification.find({ recipientId: userId, isRead: false }).lean()
      ]);

      // Calculate category-specific updates based on unread notifications
      const leaveNotifications = unreadNotifs.filter(n => 
        n.type && (n.type.startsWith('LEAVE_') || n.type === 'QR_EXIT_MARKED' || n.type === 'QR_RETURN_MARKED')
      ).length;

      const complaintNotifications = unreadNotifs.filter(n => 
        n.type && (n.type.startsWith('COMPLAINT_') || n.type === 'NEW_COMPLAINT' || n.type === 'COMPLAINT_RESOLVED')
      ).length;

      summary.pendingLeaves = leaves;
      summary.pendingComplaints = complaints;
      summary.leaveUpdates = leaveNotifications || leaves; // Resilient fallback
      summary.complaintUpdates = complaintNotifications || complaints; // Resilient fallback
    }

    res.status(200).json({
      success: true,
      summary
    });
  } catch (error) {
    next(error);
  }
};

const markCategoryAsRead = async (req, res, next) => {
  try {
    const { category } = req.body; // 'LEAVE' or 'COMPLAINT'
    let types = [];
    
    if (category === 'LEAVE') {
      types = ['LEAVE_APPROVED', 'LEAVE_REJECTED', 'LEAVE_REQUESTED', 'QR_EXIT_MARKED', 'QR_RETURN_MARKED'];
    } else if (category === 'COMPLAINT') {
      types = ['NEW_COMPLAINT', 'COMPLAINT_RESOLVED'];
    }

    if (types.length > 0) {
      await Notification.updateMany(
        { recipientId: req.user._id, type: { $in: types }, isRead: false },
        { isRead: true }
      );
    }

    res.status(200).json({ 
      success: true, 
      message: `Notifications of category ${category} marked as read.`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  registerDeviceToken,
  deregisterDeviceToken,
  getNotificationSummary,
  markCategoryAsRead
};
