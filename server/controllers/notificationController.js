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
      { new: true }
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
      { upsert: true, new: true }
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

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  registerDeviceToken,
  deregisterDeviceToken
};
