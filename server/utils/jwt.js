const jwt = require('jsonwebtoken');

const generateToken = (userId, role, hostelId) => {
  return jwt.sign(
    { userId, role, hostelId },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = {
  generateToken,
  verifyToken
};
