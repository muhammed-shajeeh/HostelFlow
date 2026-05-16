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

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed: Secure handshake rejected.'));
    }
  });

  // Live Connections Handler
  io.on('connection', (socket) => {
    const user = socket.user;
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
    }

    if (user.role === 'SECURITY' && user.hostelId) {
      socket.join(`SECURITY_${user.hostelId}`);
    }

    if (user.role === 'STUDENT') {
      socket.join(`STUDENT_${user._id}`);
      if (user.hostelId) {
        socket.join(`HOSTEL_${user.hostelId}`);
      }
    }

    if (user.role === 'PARENT') {
      socket.join(`PARENT_${user._id}`);
      // Join linked student channels to receive children alerts
      if (user.students && Array.isArray(user.students)) {
        user.students.forEach(studentId => {
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
const createAndEmitNotification = async ({ recipientId, title, message, type, actionUrl = '', hostelId = null }) => {
  try {
    const notification = await Notification.create({
      recipientId,
      title,
      message,
      type,
      actionUrl,
      hostelId
    });

    if (io) {
      // Direct emit to the user's specific room
      io.to(`USER_${recipientId}`).emit('NEW_NOTIFICATION', notification);
      
      // Auto-trigger dashboard refresh events
      io.to(`USER_${recipientId}`).emit('REFRESH_DASHBOARD', { type });
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
