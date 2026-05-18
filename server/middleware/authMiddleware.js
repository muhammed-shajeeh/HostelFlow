const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
    }

    try {
      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) {
        return res.status(401).json({ success: false, message: 'Not authorized, invalid or expired token' });
      }
      
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
         return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      // Enforce email verification on all authenticated routes
      if (!user.emailVerified) {
         return res.status(403).json({ success: false, message: 'Please verify your email before accessing system resources.' });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Not authorized, invalid or expired token' });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = authMiddleware;
