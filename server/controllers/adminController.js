const User = require('../models/User');
const Hostel = require('../models/Hostel');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const sendEmail = require('../utils/email');

// Helper to generate temp password
const generateTempPassword = () => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// @desc    Create a new Warden
// @route   POST /api/admin/create-warden
// @access  Private (Admin only)
const createWarden = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { fullName, email, hostelId } = req.body;

    // Check duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: 'Email already exists' });

    // Validate Hostel
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) return res.status(400).json({ success: false, message: 'Invalid Hostel ID. Hostel not found.' });

    // Check if hostel already has a warden
    if (hostel.warden) {
      return res.status(400).json({ success: false, message: 'This hostel already has a warden assigned' });
    }

    const tempPassword = generateTempPassword();

    const warden = new User({
      fullName,
      email,
      password: tempPassword, // Will be hashed by pre-save middleware
      role: 'WARDEN',
      hostelId,
      emailVerified: true,
      isApproved: true
    });

    await warden.save();

    // Assign warden to hostel
    hostel.warden = warden._id;
    await hostel.save();

    // Send Email with credentials
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to Smart Hostel Management System</h2>
        <p>Hi ${fullName},</p>
        <p>You have been assigned as the Warden for <strong>${hostel.name}</strong>.</p>
        <p>Here are your temporary login credentials:</p>
        <ul>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Password:</strong> ${tempPassword}</li>
        </ul>
        <p style="color: red;"><strong>Security Recommendation:</strong> Please login and change your password immediately.</p>
      </div>
    `;

    try {
      await sendEmail({
        email: warden.email,
        subject: 'Warden Account Created - Smart Hostel',
        html: emailHtml
      });
    } catch (emailError) {
      console.error('Credentials email could not be sent', emailError);
    }

    res.status(201).json({ 
      success: true, 
      message: 'Warden created and assigned successfully.',
      warden: { _id: warden._id, fullName: warden.fullName, email: warden.email }
    });
  } catch (error) { next(error); }
};

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
const getAdminDashboard = async (req, res, next) => {
  try {
    const totalHostels = await Hostel.countDocuments();
    const activeHostels = await Hostel.countDocuments({ isActive: true });
    const totalWardens = await User.countDocuments({ role: 'WARDEN' });
    const totalStudents = await User.countDocuments({ role: 'STUDENT' });

    res.status(200).json({
      success: true,
      stats: {
        totalHostels,
        activeHostels,
        totalWardens,
        totalStudents
      }
    });
  } catch (error) { next(error); }
};

// @desc    Get all wardens
// @route   GET /api/admin/wardens
// @access  Private (Admin only)
const getWardensList = async (req, res, next) => {
  try {
    const wardens = await User.find({ role: 'WARDEN' })
      .populate('hostelId', 'name hostelCode gender totalRooms')
      .select('-password -emailOtp -emailOtpExpiry');
      
    res.status(200).json({ success: true, count: wardens.length, wardens });
  } catch (error) { next(error); }
};

module.exports = {
  createWarden,
  getAdminDashboard,
  getWardensList
};
