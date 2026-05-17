const express = require('express');
const { check } = require('express-validator');
const { 
  register, 
  verifyEmail, 
  login, 
  getMe, 
  updateProfile, 
  securityLogin,
  requestPasswordReset,
  verifyResetOtp,
  resetPassword
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// @route   POST /api/auth/register
router.post(
  '/register',
  [
    check('fullName', 'Full name is required and must be at least 3 characters').isLength({ min: 3 }),
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
  ],
  register
);

// @route   POST /api/auth/verify-email
router.post(
  '/verify-email',
  [
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('otp', 'OTP is required and must be 6 digits').isLength({ min: 6, max: 6 }).isNumeric()
  ],
  verifyEmail
);

// @route   POST /api/auth/login
// Note: Limiter is applied at app.js level
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('password', 'Password is required').exists()
  ],
  login
);

// @route   POST /api/auth/security-login
router.post('/security-login', securityLogin);

// @route   GET /api/auth/me
router.get('/me', authMiddleware, getMe);

// @route   PUT /api/auth/profile
router.put('/profile', authMiddleware, updateProfile);

// @route   POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  [check('email', 'Please include a valid email').isEmail().normalizeEmail()],
  requestPasswordReset
);

// @route   POST /api/auth/verify-reset-otp
router.post(
  '/verify-reset-otp',
  [
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('otp', 'OTP is required and must be 6 digits').isLength({ min: 6, max: 6 }).isNumeric()
  ],
  verifyResetOtp
);

// @route   POST /api/auth/reset-password
router.post(
  '/reset-password',
  [
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('otp', 'OTP is required and must be 6 digits').isLength({ min: 6, max: 6 }).isNumeric(),
    check('password', 'Password must be at least 6 characters long').isLength({ min: 6 }),
    check('confirmPassword', 'Confirm password is required').exists()
  ],
  resetPassword
);

module.exports = router;
