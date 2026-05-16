const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const { generateToken } = require('../utils/jwt');
const { generateOTP } = require('../utils/otp');
const sendEmail = require('../utils/email');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { fullName, email, password, role, admissionNumber } = req.body;

    // Check duplicate email
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }

    // Check duplicate admission number if provided
    if (admissionNumber) {
      const existingAdm = await User.findOne({ admissionNumber });
      if (existingAdm) {
        return res.status(400).json({ success: false, message: 'Admission number is already in use' });
      }
    }

    // Generate OTP
    const otp = generateOTP();
    // Hash OTP before storing
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);
    // OTP Expiry - 10 mins
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const user = new User({
      fullName,
      email,
      password, // Pre-save hook will hash this
      role: role || 'STUDENT',
      admissionNumber,
      emailOtp: hashedOtp,
      emailOtpExpiry: otpExpiry
    });

    await user.save();

    // Send Email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to Smart Hostel Management System</h2>
        <p>Hi ${fullName},</p>
        <p>Your email verification OTP is: <strong style="font-size: 20px;">${otp}</strong></p>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `;

    res.status(201).json({ 
      success: true, 
      message: 'Registration successful. Please check your email for OTP verification.' 
    });

    // Optimization: Send email asynchronously
    sendEmail({
      email: user.email,
      subject: 'Verify your Email - Smart Hostel Management System',
      html: emailHtml
    }).catch(emailError => console.error('Email could not be sent', emailError));

  } catch (error) {
    next(error);
  }
};

// @desc    Verify Email OTP
// @route   POST /api/auth/verify-email
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    if (!user.emailOtp || !user.emailOtpExpiry) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
    }

    if (new Date() > user.emailOtpExpiry) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    const isMatch = await bcrypt.compare(otp, user.emailOtp);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Success
    user.emailVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpiry = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Email verified successfully. You can now login.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // We need to select password because it's disabled by default in schema
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email before logging in' });
    }

    if (user.role === 'STUDENT' && !user.isApproved) {
      return res.status(403).json({ success: false, message: 'Your account is pending admin approval' });
    }

    const token = generateToken(user._id, user.role, user.hostelId);

    // Create a user object without password
    const userObj = user.toObject();
    delete userObj.password;

    res.status(200).json({
      success: true,
      token,
      user: userObj
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    // Populate hostel and room details for the profile/dashboard
    const user = await User.findById(req.user._id)
      .select('-password -emailOtp -emailOtpExpiry')
      .populate('hostelId', 'name hostelCode')
      .populate('roomId', 'roomNumber floor');

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { fullName, department, year, semester, parentName, parentEmail } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (fullName) user.fullName = fullName;
    if (department) user.department = department;
    if (year) user.year = year;
    if (semester) user.semester = semester;
    if (parentName) user.parentName = parentName;
    if (parentEmail) user.parentEmail = parentEmail;

    await user.save();

    const updatedUser = await User.findById(req.user._id)
      .select('-password -emailOtp -emailOtpExpiry')
      .populate('hostelId', 'name hostelCode')
      .populate('roomId', 'roomNumber floor');

    res.status(200).json({ success: true, message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  verifyEmail,
  login,
  getMe,
  updateProfile
};
