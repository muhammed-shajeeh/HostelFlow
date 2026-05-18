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

    // Centrally log the warden creation event
    const { logAudit } = require('../utils/auditLogger');
    await logAudit({
      req,
      actionType: 'WARDEN_CREATED',
      entityType: 'USER',
      entityId: warden._id,
      title: 'Warden Created',
      description: `Warden account created for ${fullName} and assigned to hostel ${hostel.name}`,
      severity: 'IMPORTANT'
    });

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

    res.status(201).json({ 
      success: true, 
      message: 'Warden created and assigned successfully.',
      warden: { _id: warden._id, fullName: warden.fullName, email: warden.email }
    });

    // Optimization: Send email asynchronously in the background so it doesn't block API response
    sendEmail({
      email: warden.email,
      subject: 'Warden Account Created - Smart Hostel',
      html: emailHtml
    }).catch(emailError => console.error('Credentials email could not be sent', emailError));

  } catch (error) { next(error); }
};

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
const getAdminDashboard = async (req, res, next) => {
  try {
    const Room = require('../models/Room');
    console.time('adminDashboardStats');

    // Optimization: Parallelize all independent DB count queries
    const [
      totalHostels, 
      activeHostels, 
      totalWardens, 
      totalStudents, 
      pendingStudents,
      rooms
    ] = await Promise.all([
      Hostel.countDocuments(),
      Hostel.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'WARDEN' }),
      User.countDocuments({ role: 'STUDENT', approvalStatus: 'APPROVED' }),
      User.countDocuments({ role: 'STUDENT', approvalStatus: 'PENDING' }),
      Room.find().lean() // Optimization: lean() for fast read
    ]);
    
    console.timeEnd('adminDashboardStats');

    let totalRooms = rooms.length;
    let occupiedRooms = rooms.filter(r => r.occupiedBeds > 0).length;
    let availableBeds = rooms.reduce((acc, curr) => acc + (curr.availableBeds || 0), 0);

    res.status(200).json({
      success: true,
      stats: {
        totalHostels,
        activeHostels,
        totalWardens,
        totalStudents,
        pendingStudents,
        totalRooms,
        occupiedRooms,
        availableBeds
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
      .select('-password -emailOtp -emailOtpExpiry')
      .lean(); // Optimization: lean()

      
    res.status(200).json({ success: true, count: wardens.length, wardens });
  } catch (error) { next(error); }
};

// @desc    Update an existing Warden
// @route   PUT /api/admin/wardens/:id
// @access  Private (Admin only)
const updateWarden = async (req, res, next) => {
  try {
    const { fullName, email, password, hostelId } = req.body;
    const wardenId = req.params.id;

    const warden = await User.findOne({ _id: wardenId, role: 'WARDEN' });
    if (!warden) return res.status(404).json({ success: false, message: 'Warden not found' });

    // Validate email uniqueness if changed
    if (email && email.toLowerCase() !== warden.email.toLowerCase()) {
      const emailExists = await User.findOne({ email });
      if (emailExists) return res.status(400).json({ success: false, message: 'Email is already taken by another account' });
      warden.email = email;
    }

    if (fullName) warden.fullName = fullName;
    
    // Hash and update password if provided
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
      }
      warden.password = password; // Will be hashed automatically by userSchema pre-save middleware
    }

    // Handle Hostel re-assignment / un-assignment
    if (hostelId !== undefined) {
      // If we are assigning to a new hostel
      if (hostelId && String(hostelId) !== String(warden.hostelId)) {
        const targetHostel = await Hostel.findById(hostelId);
        if (!targetHostel) return res.status(404).json({ success: false, message: 'Target hostel not found' });

        if (targetHostel.warden && String(targetHostel.warden) !== String(warden._id)) {
          return res.status(400).json({ success: false, message: `The hostel ${targetHostel.name} already has a warden assigned.` });
        }

        // Unassign old hostel
        if (warden.hostelId) {
          await Hostel.findByIdAndUpdate(warden.hostelId, { $unset: { warden: 1 } });
        }

        // Assign new hostel
        warden.hostelId = hostelId;
        targetHostel.warden = warden._id;
        await targetHostel.save();
      } else if (!hostelId && warden.hostelId) {
        // Unassigning from current hostel
        await Hostel.findByIdAndUpdate(warden.hostelId, { $unset: { warden: 1 } });
        warden.hostelId = undefined;
      }
    }

    await warden.save();

    // Centrally log the warden update event
    const { logAudit } = require('../utils/auditLogger');
    await logAudit({
      req,
      actionType: 'WARDEN_UPDATED',
      entityType: 'USER',
      entityId: warden._id,
      title: 'Warden Account Updated',
      description: `Warden account ${warden.fullName} was updated by admin.`,
      severity: 'IMPORTANT'
    });

    res.status(200).json({ 
      success: true, 
      message: 'Warden updated successfully',
      warden: { _id: warden._id, fullName: warden.fullName, email: warden.email, hostelId: warden.hostelId }
    });
  } catch (error) { next(error); }
};

// @desc    Delete a Warden (safe unbinding)
// @route   DELETE /api/admin/wardens/:id
// @access  Private (Admin only)
const deleteWarden = async (req, res, next) => {
  try {
    const wardenId = req.params.id;

    const warden = await User.findOne({ _id: wardenId, role: 'WARDEN' });
    if (!warden) return res.status(404).json({ success: false, message: 'Warden not found' });

    // Safely unbind from any assigned hostel before deleting the account
    if (warden.hostelId) {
      await Hostel.findByIdAndUpdate(warden.hostelId, { $unset: { warden: 1 } });
    }

    await User.deleteOne({ _id: wardenId });

    // Centrally log the warden deletion event
    const { logAudit } = require('../utils/auditLogger');
    await logAudit({
      req,
      actionType: 'WARDEN_DELETED',
      entityType: 'USER',
      entityId: wardenId,
      title: 'Warden Deleted',
      description: `Warden account for ${warden.fullName} was permanently deleted. Hostel data was preserved.`,
      severity: 'WARNING'
    });

    res.status(200).json({ 
      success: true, 
      message: 'Warden account deleted successfully. Hostel data preserved.' 
    });
  } catch (error) { next(error); }
};

module.exports = {
  createWarden,
  getAdminDashboard,
  getWardensList,
  updateWarden,
  deleteWarden
};
