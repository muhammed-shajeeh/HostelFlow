const Notification = require('../models/Notification');

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

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead
};
