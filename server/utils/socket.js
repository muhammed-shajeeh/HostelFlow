const socketIo = require('socket.io');
const { verifyToken } = require('./jwt');
const User = require('../models/User');
const Notification = require('../models/Notification');

let io = null;

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true
    }
  });

  // Authentication Middleware for Sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication failed: Token is missing.'));
      }

      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) {
        return next(new Error('Authentication failed: Invalid or expired token.'));
      }

      const user = await User.findById(decoded.userId).select('-password').lean();
      if (!user) {
        return next(new Error('Authentication failed: User account not found.'));
      }

      // Security terminal accounts are blocked from receiving notifications
      if (user.role === 'SECURITY') {
        socket.user = user;
        return next();
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed: Secure handshake rejected.'));
    }
  });

  // Live Connections Handler
  io.on('connection', (socket) => {
    const user = socket.user;
    if (!user) return;
    
    console.log(`[Socket.IO] Authenticated client connected: ${user.fullName} (${user.role}) [ID: ${socket.id}]`);

    // 1. Join Universal User room
    socket.join(`USER_${user._id}`);

    // 2. Join Role-Scoped and Scope-Isolated Rooms
    if (user.role === 'ADMIN') {
      socket.join('ADMIN_GLOBAL');
    }

    if (user.role === 'WARDEN' && user.hostelId) {
      socket.join(`HOSTEL_${user.hostelId}`);
      socket.join(`WARDEN_${user._id}`);
      socket.join(`ROLE_WARDEN`);
    }

    if (user.role === 'STUDENT') {
      socket.join(`STUDENT_${user._id}`);
      socket.join(`ROLE_STUDENT`);
      if (user.hostelId) {
        socket.join(`HOSTEL_${user.hostelId}`);
      }
    }

    if (user.role === 'PARENT') {
      socket.join(`PARENT_${user._id}`);
      socket.join(`ROLE_PARENT`);
      // Join linked student channels to receive children alerts
      if (user.linkedStudents && Array.isArray(user.linkedStudents)) {
        user.linkedStudents.forEach(studentId => {
          socket.join(`PARENT_STUDENT_${studentId}`);
        });
      }
    }

    // Handle Disconnections
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${user.fullName} [ID: ${socket.id}]`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initSocket(server) first.');
  }
  return io;
};

/**
 * Creates a notification in the database and broadcasts it in real-time to the recipient
 */
const createAndEmitNotification = async ({ recipientId, title, message, type, priority = 'NORMAL', relatedEntityId = null, actionUrl = '', hostelId = null }) => {
  try {
    const recipient = await User.findById(recipientId).select('role hostelId').lean();
    if (!recipient) {
      console.warn(`[Socket Manager] Recipient user ${recipientId} not found. Skipping notification.`);
      return null;
    }

    // Security roles are entirely blocked from notifications
    if (recipient.role === 'SECURITY') {
      return null;
    }

    const notification = await Notification.create({
      recipientId,
      role: recipient.role,
      hostelId: hostelId || recipient.hostelId || null,
      type,
      title,
      message,
      priority,
      relatedEntityId,
      actionUrl,
      isRead: false
    });

    if (io) {
      // Direct emit to the user's specific room
      io.to(`USER_${recipientId}`).emit('NEW_NOTIFICATION', notification);
      
      // Auto-trigger dashboard refresh events so pages sync live!
      io.to(`USER_${recipientId}`).emit('REFRESH_DASHBOARD', { type });
    }

    // Hybrid Background Push Delivery: Dispatch FCM push notification asynchronously
    try {
      const DeviceToken = require('../models/DeviceToken');
      const deviceDocs = await DeviceToken.find({ userId: recipientId }).select('fcmToken').lean();
      if (deviceDocs && deviceDocs.length > 0) {
        const tokens = deviceDocs.map(d => d.fcmToken);
        const { sendPushNotification } = require('./fcmHelper');
        sendPushNotification(tokens, {
          title,
          body: message,
          route: actionUrl || '/',
          entityId: String(relatedEntityId || '')
        }).catch(err => console.error('[FCM Async Delivery Error]', err));
      }
    } catch (pushErr) {
      console.error('[FCM Registration Lookup Failed]', pushErr);
    }

    return notification;
  } catch (error) {
    console.error('[Socket Manager] Failed to create or broadcast notification:', error);
  }
};

/**
 * Generic event emitter to specific rooms
 */
const emitToRoom = (room, event, data) => {
  if (io) {
    io.to(room).emit(event, data);
  }
};

module.exports = {
  initSocket,
  getIO,
  createAndEmitNotification,
  emitToRoom
};
