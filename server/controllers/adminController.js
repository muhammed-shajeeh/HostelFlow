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
    }).catch(emailError => {
      console.warn(`[MAILER] Credentials email failed for ${warden.email} — database update preserved.`);
    });

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

    // Symmetrical, decoupled notification email sent asynchronously in background
    if (password || email || hostelId !== undefined) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>HostelFlow Warden Account Update</h2>
          <p>Hi ${warden.fullName},</p>
          <p>Your institutional Warden profile details have been updated by the administrator:</p>
          <ul>
            <li><strong>Email:</strong> ${warden.email}</li>
            ${password ? `<li><strong>Temporary Password:</strong> ${password}</li>` : ''}
            ${warden.hostelId ? `<li><strong>Assigned Hostel:</strong> Mapped to hostel successfully</li>` : '<li><strong>Assigned Hostel:</strong> Unassigned</li>'}
          </ul>
          <p>If you did not expect these changes, please contact the campus network administrator immediately.</p>
        </div>
      `;
      sendEmail({
        email: warden.email,
        subject: 'Warden Account Updated - HostelFlow',
        html: emailHtml
      }).catch(emailError => {
        console.warn(`[MAILER] Credentials update email failed for ${warden.email} — database update preserved.`);
      });
    }
  } catch (error) { next(error); }
};

// @desc    Soft deactivate a Warden (safe unbinding)
// @route   DELETE /api/admin/wardens/:id
// @access  Private (Admin only)
const deleteWarden = async (req, res, next) => {
  try {
    const wardenId = req.params.id;

    const warden = await User.findOne({ _id: wardenId, role: 'WARDEN' });
    if (!warden) return res.status(404).json({ success: false, message: 'Warden not found' });

    // Safely unbind from any assigned hostel before deactivating
    if (warden.hostelId) {
      await Hostel.findByIdAndUpdate(warden.hostelId, { $unset: { warden: 1 } });
      warden.hostelId = undefined;
    }

    warden.isActive = false;
    await warden.save();

    // Centrally log the warden deactivation event
    const { logAudit } = require('../utils/auditLogger');
    await logAudit({
      req,
      actionType: 'WARDEN_DEACTIVATED',
      entityType: 'USER',
      entityId: wardenId,
      title: 'Warden Deactivated',
      description: `Warden account for ${warden.fullName} was deactivated. Hostel data and history were preserved.`,
      severity: 'WARNING'
    });

    res.status(200).json({ 
      success: true, 
      message: 'Warden account deactivated successfully. Hostel data preserved.' 
    });

    // Async alert
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h3>HostelFlow Warden Account Deactivated</h3>
        <p>Hello ${warden.fullName},</p>
        <p>Your warden account has been deactivated by the system administrator. You will no longer be able to log in to the Warden portal.</p>
      </div>
    `;
    sendEmail({
      email: warden.email,
      subject: 'Account Deactivated - HostelFlow',
      html: emailHtml
    }).catch(emailError => {
      console.warn(`[MAILER] Deactivation email failed for ${warden.email} — database update preserved.`);
    });
  } catch (error) { next(error); }
};

// @desc    Reactivate a soft-deactivated Warden
// @route   POST /api/admin/wardens/:id/reactivate
// @access  Private (Admin only)
const reactivateWarden = async (req, res, next) => {
  try {
    const wardenId = req.params.id;

    const warden = await User.findOne({ _id: wardenId, role: 'WARDEN' });
    if (!warden) return res.status(404).json({ success: false, message: 'Warden not found' });

    warden.isActive = true;
    await warden.save();

    // Centrally log the warden reactivation event
    const { logAudit } = require('../utils/auditLogger');
    await logAudit({
      req,
      actionType: 'WARDEN_REACTIVATED',
      entityType: 'USER',
      entityId: wardenId,
      title: 'Warden Account Reactivated',
      description: `Warden account for ${warden.fullName} was reactivated.`,
      severity: 'IMPORTANT'
    });

    res.status(200).json({ 
      success: true, 
      message: 'Warden account reactivated successfully.' 
    });

    // Async alert
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h3>HostelFlow Warden Account Reactivated</h3>
        <p>Hello ${warden.fullName},</p>
        <p>Your warden account has been reactivated. You can now log in using your registered credentials.</p>
      </div>
    `;
    sendEmail({
      email: warden.email,
      subject: 'Account Reactivated - HostelFlow',
      html: emailHtml
    }).catch(emailError => {
      console.warn(`[MAILER] Reactivation email failed for ${warden.email} — database update preserved.`);
    });
  } catch (error) { next(error); }
};

// @desc    Search students for transfer
// @route   GET /api/admin/students/search
// @access  Private (Admin only)
const searchStudentsForTransfer = async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query || query.trim() === '') {
      return res.status(200).json({ success: true, students: [] });
    }

    const searchRegex = new RegExp(query, 'i');
    const Room = require('../models/Room');

    // 1. Search for matching rooms
    const matchingRooms = await Room.find({ roomNumber: searchRegex }).select('_id');
    const roomIds = matchingRooms.map(r => r._id);

    // 2. Query matching students
    const matchQuery = {
      role: 'STUDENT',
      approvalStatus: 'APPROVED',
      isActive: true,
      $or: [
        { fullName: searchRegex },
        { admissionNumber: searchRegex }
      ]
    };

    if (roomIds.length > 0) {
      matchQuery.$or.push({ roomId: { $in: roomIds } });
    }

    const students = await User.find(matchQuery)
      .populate('hostelId', 'name gender')
      .populate('roomId', 'roomNumber floor')
      .lean();

    res.status(200).json({ success: true, students });
  } catch (error) {
    next(error);
  }
};

// @desc    Transfer student atomically
// @route   POST /api/admin/students/:id/transfer
// @access  Private (Admin only)
const transferStudent = async (req, res, next) => {
  const { newHostelId, newRoomId, newBedNumber, reason } = req.body;

  try {
    const Room = require('../models/Room');
    const RoomTransfer = require('../models/RoomTransfer');

    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'STUDENT') {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    if (!student.isApproved || student.approvalStatus !== 'APPROVED') {
      return res.status(400).json({ success: false, message: 'Cannot transfer a student who is not approved/allocated.' });
    }

    if (!student.isActive) {
      return res.status(400).json({ success: false, message: 'Cannot transfer an inactive student.' });
    }

    const oldHostelId = student.hostelId;
    const oldRoomId = student.roomId;
    const oldBedNumber = student.bedNumber;

    // Check same room/bed transfer
    if (oldRoomId && oldRoomId.toString() === newRoomId.toString() && oldBedNumber === Number(newBedNumber)) {
      return res.status(400).json({ success: false, message: 'Student is already assigned to this room and bed.' });
    }

    // Validate target Hostel
    const destinationHostel = await Hostel.findById(newHostelId);
    if (!destinationHostel || !destinationHostel.isActive) {
      return res.status(404).json({ success: false, message: 'Destination hostel not found or inactive.' });
    }

    // Validate source Hostel
    const sourceHostel = oldHostelId ? await Hostel.findById(oldHostelId) : null;
    if (sourceHostel) {
      // Prevent gender mismatch
      if (sourceHostel.gender !== destinationHostel.gender && destinationHostel.gender !== 'MIXED' && sourceHostel.gender !== 'MIXED') {
        return res.status(400).json({ success: false, message: `Gender mismatch! Cannot transfer from ${sourceHostel.gender} hostel to ${destinationHostel.gender} hostel.` });
      }
    }

    // Validate target Room
    const newRoom = await Room.findById(newRoomId);
    if (!newRoom || !newRoom.isActive) {
      return res.status(404).json({ success: false, message: 'Destination room not found or inactive.' });
    }

    if (newRoom.hostelId.toString() !== newHostelId.toString()) {
      return res.status(400).json({ success: false, message: 'Destination room does not belong to the selected destination hostel.' });
    }

    // Validate bed availability
    if (Number(newBedNumber) < 1 || Number(newBedNumber) > newRoom.capacity) {
      return res.status(400).json({ success: false, message: `Invalid bed number! Bed number must be between 1 and ${newRoom.capacity}.` });
    }

    // Check if target bed is already occupied by another student
    const occupantOnTargetBed = await User.findOne({
      roomId: newRoomId,
      bedNumber: Number(newBedNumber),
      role: 'STUDENT',
      _id: { $ne: student._id }
    });
    if (occupantOnTargetBed) {
      return res.status(400).json({ success: false, message: `Bed number ${newBedNumber} is already occupied by ${occupantOnTargetBed.fullName}.` });
    }

    // If transferring to a different room, ensure capacity isn't exceeded
    if (!oldRoomId || oldRoomId.toString() !== newRoomId.toString()) {
      if (newRoom.availableBeds <= 0 || newRoom.occupiedBeds >= newRoom.capacity) {
        return res.status(400).json({ success: false, message: 'Destination room is at full capacity.' });
      }
    }

    const oldRoom = oldRoomId ? await Room.findById(oldRoomId) : null;

    // 1. Remove from old room if exists
    if (oldRoom) {
      oldRoom.students.pull(student._id);
      oldRoom.occupiedBeds = Math.max(0, oldRoom.occupiedBeds - 1);
      oldRoom.availableBeds = oldRoom.capacity - oldRoom.occupiedBeds;
      await oldRoom.save();
    }

    // 2. Add to new room
    if (!oldRoomId || oldRoomId.toString() !== newRoomId.toString()) {
      newRoom.students.push(student._id);
      newRoom.occupiedBeds += 1;
      newRoom.availableBeds = newRoom.capacity - newRoom.occupiedBeds;
      await newRoom.save();
    }

    // 3. Update Student document
    student.hostelId = newHostelId;
    student.roomId = newRoomId;
    student.bedNumber = Number(newBedNumber);
    await student.save();

    // 4. Save to persistent transfer history
    const transferHistory = new RoomTransfer({
      studentId: student._id,
      oldHostelId: oldHostelId || null,
      newHostelId: newHostelId,
      oldRoomId: oldRoomId || null,
      newRoomId: newRoomId,
      oldBedNumber: oldBedNumber || null,
      newBedNumber: Number(newBedNumber),
      transferredBy: req.user._id,
      reason: reason || 'Administrative hostel reassignment'
    });
    await transferHistory.save();

    // 5. Generate Audit Logs
    const { logAudit } = require('../utils/auditLogger');
    const oldRoomNumber = oldRoom ? oldRoom.roomNumber : 'Unassigned';
    const oldHostelName = sourceHostel ? sourceHostel.name : 'Unassigned';
    await logAudit({
      req,
      actionType: 'HOSTEL_TRANSFER',
      entityType: 'USER',
      entityId: student._id,
      title: 'Student Hostel Transfer',
      description: `Student ${student.fullName} transferred from ${oldHostelName} Room ${oldRoomNumber} (Bed ${oldBedNumber || 'N/A'}) to ${destinationHostel.name} Room ${newRoom.roomNumber} (Bed ${newBedNumber}). Reason: ${reason || 'Administrative choice'}`,
      severity: 'IMPORTANT',
      hostelId: newHostelId
    });

    // 6. Trigger Real-time Notifications & Sockets
    const { createAndEmitNotification, emitToRoom } = require('../utils/socket');
    
    // Notify Student
    await createAndEmitNotification({
      recipientId: student._id,
      title: 'Hostel Transfer Completed',
      message: `Your hostel allocation has been shifted from ${oldHostelName} Room ${oldRoomNumber} to ${destinationHostel.name} Room ${newRoom.roomNumber} (Bed ${newBedNumber}).`,
      type: 'ROOM_TRANSFER',
      priority: 'CRITICAL',
      relatedEntityId: newRoomId,
      actionUrl: '/student',
      hostelId: newHostelId
    });

    // Notify Wardens of BOTH old and new hostels
    const wardensToNotify = [];
    if (sourceHostel && sourceHostel.warden) wardensToNotify.push(sourceHostel.warden);
    if (destinationHostel.warden && !wardensToNotify.includes(destinationHostel.warden)) {
      wardensToNotify.push(destinationHostel.warden);
    }

    for (const wardenId of wardensToNotify) {
      await createAndEmitNotification({
        recipientId: wardenId,
        title: 'Student Transferred',
        message: `Student ${student.fullName} has been transferred from ${oldHostelName} Room ${oldRoomNumber} to ${destinationHostel.name} Room ${newRoom.roomNumber}.`,
        type: 'ROOM_TRANSFER',
        priority: 'IMPORTANT',
        relatedEntityId: newRoomId,
        actionUrl: '/students/list',
        hostelId: newHostelId
      });
    }

    // Refresh dashboards in both old and new hostels in real-time
    if (oldHostelId) {
      emitToRoom(`HOSTEL_${oldHostelId}`, 'REFRESH_DASHBOARD', { type: 'ROOM_ALLOCATION' });
    }
    emitToRoom(`HOSTEL_${newHostelId}`, 'REFRESH_DASHBOARD', { type: 'ROOM_ALLOCATION' });
    emitToRoom('ADMIN_GLOBAL', 'REFRESH_DASHBOARD', { type: 'ROOM_ALLOCATION' });

    // Send email notification to Student
    sendEmail({
      email: student.email,
      subject: 'Official Hostel Transfer Confirmation - HostelFlow',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h3 style="color: #4f46e5;">Official Hostel Transfer Completed</h3>
          <p>Dear ${student.fullName},</p>
          <p>This is to officially confirm that your hostel allocation has been reassigned by the administration:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f9fafb;">
              <th style="padding: 10px; border: 1px solid #eee; text-align: left;">Details</th>
              <th style="padding: 10px; border: 1px solid #eee; text-align: left;">From</th>
              <th style="padding: 10px; border: 1px solid #eee; text-align: left;">To</th>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #eee;"><strong>Hostel</strong></td>
              <td style="padding: 10px; border: 1px solid #eee;">${oldHostelName}</td>
              <td style="padding: 10px; border: 1px solid #eee;">${destinationHostel.name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #eee;"><strong>Room</strong></td>
              <td style="padding: 10px; border: 1px solid #eee;">${oldRoomNumber}</td>
              <td style="padding: 10px; border: 1px solid #eee;">${newRoom.roomNumber}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #eee;"><strong>Bed</strong></td>
              <td style="padding: 10px; border: 1px solid #eee;">${oldBedNumber || 'N/A'}</td>
              <td style="padding: 10px; border: 1px solid #eee;">${newBedNumber}</td>
            </tr>
          </table>
          <p><strong>Reason for Transfer:</strong> ${reason || 'Administrative adjustment'}</p>
          <p>Please shift your belongings to your new room allocation at your earliest convenience.</p>
          <p>Regards,<br>Hostel Administration</p>
        </div>
      `
    }).catch(emailError => {
      console.warn(`[MAILER] Hostel transfer email failed for ${student.email} — database update preserved.`);
    });

    res.status(200).json({
      success: true,
      message: 'Student hostel transfer completed successfully.',
      student: {
        _id: student._id,
        fullName: student.fullName,
        hostelId: student.hostelId,
        roomId: student.roomId,
        bedNumber: student.bedNumber
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  createWarden,
  getAdminDashboard,
  getWardensList,
  updateWarden,
  deleteWarden,
  reactivateWarden,
  searchStudentsForTransfer,
  transferStudent
};
