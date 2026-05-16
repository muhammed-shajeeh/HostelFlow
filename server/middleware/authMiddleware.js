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
      
      // Attach user to req, excluding password
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
         return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
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
