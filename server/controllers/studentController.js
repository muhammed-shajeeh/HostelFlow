const User = require('../models/User');
const Room = require('../models/Room');
const Hostel = require('../models/Hostel');
const RoomTransfer = require('../models/RoomTransfer');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const sendEmail = require('../utils/email');
const { generateOTP } = require('../utils/otp');
const crypto = require('crypto');

// Helper to generate a secure random temporary password
const generateTempPassword = () => {
  return crypto.randomBytes(6).toString('hex'); // 12 character hex password
};

// @desc Register Student
// @route POST /api/students/register
// @access Public
const registerStudent = async (req, res, next) => {
try {

const errors = validationResult(req);

if (!errors.isEmpty()) {
  return res.status(400).json({
    success: false,
    errors: errors.array()
  });
}

const {
  fullName,
  email,
  password,
  department,
  year,
  semester,
  admissionNumber,
  parentName,
  parentEmail,
  hostelId
} = req.body;

const existingUser = await User.findOne({ email });

if (existingUser) {
  return res.status(400).json({
    success: false,
    message: 'Email already exists'
  });
}

const existingAdmission = await User.findOne({
  admissionNumber
});

if (existingAdmission) {
  return res.status(400).json({
    success: false,
    message: 'Admission number already exists'
  });
}

const hostel = await Hostel.findById(hostelId);

if (!hostel) {
  return res.status(404).json({
    success: false,
    message: 'Hostel not found'
  });
}

const otp = generateOTP();

const salt = await bcrypt.genSalt(10);

const hashedOtp = await bcrypt.hash(otp, salt);

const otpExpiry = new Date(
  Date.now() + 10 * 60 * 1000
);

const student = new User({
  fullName,
  email,
  password,
  role: 'STUDENT',
  department,
  year,
  semester,
  admissionNumber,
  parentName,
  parentEmail,
  hostelId,

  approvalStatus: 'PENDING',

  emailOtp: hashedOtp,
  emailOtpExpiry: otpExpiry,

  studentPreferences: {

    sameDepartmentPreferred:
      req.body.studentPreferences?.sameDepartmentPreferred || false,

    sameBatchPreferred:
      req.body.studentPreferences?.sameBatchPreferred || false,

    preferredFloor:
      req.body.studentPreferences?.preferredFloor || null,

    medicalNeeds:
      req.body.studentPreferences?.medicalNeeds || "",

    specialNotes:
      req.body.studentPreferences?.specialNotes || ""

  }

});

await student.save();

const emailHtml = `
  <div style="font-family: Arial; padding:20px;">
    <h2>Welcome to Smart Hostel</h2>

    <p>Hello ${fullName},</p>

    <p>Your registration has been received.</p>

    <p>
      Your OTP:
      <strong style="font-size:20px;">
        ${otp}
      </strong>
    </p>

  </div>
`;

  // Optimization: Send email asynchronously in the background
  sendEmail({
    email: student.email,
    subject: 'Verify Email - Smart Hostel',
    html: emailHtml
  }).catch(emailError => {
    console.warn(`[MAILER] Student registration email failed for ${student.email} — database registration preserved.`);
  });

res.status(201).json({
  success: true,
  message: 'Registration successful. Please check your email for OTP verification.'
});

console.timeEnd('registerStudentAPI');

} catch (error) {


next(error);


}
};

// ======================================================
// SMART ROOM ALLOCATION ENGINE
// ======================================================

// Find best room using scoring system
const findBestRoom = async (student) => {

const availableRooms = await Room.find({
hostelId: student.hostelId,
availableBeds: { $gt: 0 },
isActive: true
}).populate('students');

if (availableRooms.length === 0) {
return null;
}

let bestRoom = null;

let highestScore = -1;

for (const room of availableRooms) {

let score = 0;

// Preferred Floor
if (
  student.studentPreferences?.preferredFloor === room.floor
) {
  score += 3;
}

// Existing Students Matching
if (room.students.length > 0) {

  let departmentMatches = 0;

  let batchMatches = 0;

  for (const occupant of room.students) {

    if (
      occupant.department === student.department
    ) {
      departmentMatches++;
    }

    if (
      occupant.year == student.year
    ) {
      batchMatches++;
    }

  }

  if (
    student.studentPreferences?.sameDepartmentPreferred &&
    departmentMatches > 0
  ) {
    score += 2;
  }

  if (
    student.studentPreferences?.sameBatchPreferred &&
    batchMatches > 0
  ) {
    score += 2;
  }

} else {

  // Empty room base score
  score += 1;

}

if (score > highestScore) {

  highestScore = score;

  bestRoom = room;

}

}

return bestRoom || availableRooms[0];

};

// ======================================================
// BED ASSIGNMENT ENGINE
// ======================================================

const assignNextBed = async (roomId, capacity) => {

const studentsInRoom = await User.find({
roomId: roomId,
role: 'STUDENT'
}).select('bedNumber');

const occupiedBeds = studentsInRoom
.map(student => student.bedNumber)
.filter(Boolean);

for (let i = 1; i <= capacity; i++) {

if (!occupiedBeds.includes(i)) {
  return i;
}


}

return null;

};

// ======================================================
// APPROVE STUDENT
// ======================================================

const approveStudent = async (req, res, next) => {

try {

const student = await User.findById(req.params.id);

if (!student || student.role !== 'STUDENT') {

  return res.status(404).json({
    success: false,
    message: 'Student not found'
  });

}

// Hostel Isolation
if (
  req.user.role === 'WARDEN' &&
  req.user.hostelId.toString() !== student.hostelId.toString()
) {

  return res.status(403).json({
    success: false,
    message: 'Forbidden'
  });

}

if (student.approvalStatus === 'APPROVED') {

  return res.status(400).json({
    success: false,
    message: 'Student already approved'
  });

}

// Find best room
const bestRoom = await findBestRoom(student);

if (!bestRoom) {

  return res.status(400).json({
    success: false,
    message: 'No rooms available'
  });

}

// Assign bed
const bedNumber = await assignNextBed(
  bestRoom._id,
  bestRoom.capacity
);

if (!bedNumber) {

  return res.status(400).json({
    success: false,
    message: 'No beds available'
  });

}

// Update Room
bestRoom.students.push(student._id);

bestRoom.occupiedBeds += 1;

bestRoom.availableBeds =
  bestRoom.capacity - bestRoom.occupiedBeds;

await bestRoom.save();

// Update Student
student.approvalStatus = 'APPROVED';

student.isApproved = true;

student.approvedBy = req.user._id;

student.approvedAt = new Date();

student.roomId = bestRoom._id;

student.bedNumber = bedNumber;

await student.save();

const { createAndEmitNotification, emitToRoom } = require('../utils/socket');
emitToRoom(`HOSTEL_${student.hostelId}`, 'STUDENT_APPROVED', {
  studentId: student._id,
  fullName: student.fullName,
  admissionNumber: student.admissionNumber,
  hostelId: student.hostelId,
  roomId: bestRoom._id,
  roomNumber: bestRoom.roomNumber,
  bedNumber
});

// Log student approved audit event
const { logAudit } = require('../utils/auditLogger');
await logAudit({
  req,
  actionType: 'STUDENT_APPROVED',
  entityType: 'USER',
  entityId: student._id,
  title: 'Student Approved',
  description: `Student ${student.fullName} has been approved and assigned to room ${bestRoom.roomNumber} (bed ${bedNumber}) in hostel ${bestRoom.hostelId?.name || 'assigned hostel'}`,
  severity: 'IMPORTANT',
  hostelId: student.hostelId
});

// Send Email
const emailHtml = `
  <div style="font-family: Arial; padding:20px;">

    <h2>Hostel Application Approved</h2>

    <p>Hello ${student.fullName},</p>

    <p>
      Your hostel application has been approved.
    </p>

    <p>
      Room:
      <strong>${bestRoom.roomNumber}</strong>
    </p>

    <p>
      Bed Number:
      <strong>${bedNumber}</strong>
    </p>

  </div>
`;

  // Optimization: Send email asynchronously
  sendEmail({
    email: student.email,
    subject: 'Hostel Approval',
    html: emailHtml
  }).catch(emailError => {
    console.warn(`[MAILER] Hostel approval email failed for ${student.email} — database approval preserved.`);
  });

// ======================================================
// PARENT ACCOUNT WORKFLOW (PHASE 1, 3, 4, 5)
// ======================================================
if (student.parentEmail) {
  let parent = await User.findOne({ email: student.parentEmail, role: 'PARENT' });
  const tempPassword = generateTempPassword();

  if (!parent) {
    // Phase 1: Create new PARENT account automatically
    parent = new User({
      fullName: student.parentName || 'Guardian',
      email: student.parentEmail,
      password: tempPassword, // Will be hashed by pre-save middleware
      role: 'PARENT',
      emailVerified: true,
      isApproved: true,
      mustChangePassword: true,
      linkedStudents: [student._id]
    });

    await parent.save();

    // Phase 4: Send Onboarding Email to Parent
    const parentEmailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4f46e5;">Welcome to Smart Hostel Guardian Portal</h2>
        <p>Dear ${parent.fullName},</p>
        <p>Your child, <strong>${student.fullName}</strong>, has been approved for a stay at <strong>${bestRoom.hostelId?.name || 'our hostel'}</strong>.</p>
        <p>A guardian account has been automatically created for you to monitor their attendance, leave requests, and more.</p>
        
        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Portal Login:</strong> <a href="${process.env.FRONTEND_URL}/login">Guardian Portal</a></p>
          <p style="margin: 5px 0;"><strong>Username:</strong> ${parent.email}</p>
          <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #eee; padding: 2px 5px; border-radius: 3px;">${tempPassword}</code></p>
        </div>

        <p style="color: #ef4444; font-size: 0.9em;"><strong>Note:</strong> You will be required to change this password upon your first login for security reasons.</p>
        <p>Regards,<br>Hostel Administration</p>
      </div>
    `;

    sendEmail({
      email: parent.email,
      subject: 'Guardian Account Created - Smart Hostel',
      html: parentEmailHtml
    }).catch(err => {
      console.warn(`[MAILER] Parent onboarding email failed for ${parent.email} — database update preserved.`);
    });

  } else {
    // Phase 5: Existing Parent Detection & Sibling Linking
    if (!parent.linkedStudents.includes(student._id)) {
      parent.linkedStudents.push(student._id);
      await parent.save();

      // Notify parent about new student link
      const linkEmailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h3>New Student Linked to Your Account</h3>
          <p>Hi ${parent.fullName},</p>
          <p>Your child, <strong>${student.fullName}</strong>, has been linked to your existing guardian account.</p>
          <p>You can now monitor their activities alongside your other linked students.</p>
        </div>
      `;

      sendEmail({
        email: parent.email,
        subject: 'New Student Linked - Smart Hostel',
        html: linkEmailHtml
      }).catch(err => {
        console.warn(`[MAILER] Parent link notification email failed for ${parent.email} — database update preserved.`);
      });
    }
  }
}

res.status(200).json({
  success: true,
  message: 'Student approved and room allocated successfully',
  room: bestRoom.roomNumber,
  bedNumber
});


} catch (error) {

next(error);


}

};

// ======================================================
// REJECT STUDENT
// ======================================================

const rejectStudent = async (req, res, next) => {

try {


const student = await User.findById(req.params.id);

if (!student || student.role !== 'STUDENT') {

  return res.status(404).json({
    success: false,
    message: 'Student not found'
  });

}

if (
  req.user.role === 'WARDEN' &&
  req.user.hostelId.toString() !== student.hostelId.toString()
) {

  return res.status(403).json({
    success: false,
    message: 'Forbidden'
  });

}

student.approvalStatus = 'REJECTED';

student.isApproved = false;

await student.save();

const { emitToRoom } = require('../utils/socket');
emitToRoom(`HOSTEL_${student.hostelId}`, 'STUDENT_APPROVED', {
  studentId: student._id,
  fullName: student.fullName,
  admissionNumber: student.admissionNumber,
  hostelId: student.hostelId,
  approvalStatus: 'REJECTED'
});
emitToRoom(`HOSTEL_${student.hostelId}`, 'REFRESH_DASHBOARD', { type: 'STUDENT_REJECTED' });

// Log student rejected audit event
const { logAudit } = require('../utils/auditLogger');
await logAudit({
  req,
  actionType: 'STUDENT_REJECTED',
  entityType: 'USER',
  entityId: student._id,
  title: 'Student Rejected',
  description: `Student application for ${student.fullName} has been rejected`,
  severity: 'WARNING',
  hostelId: student.hostelId
});

  // Optimization: Send email asynchronously
  sendEmail({
    email: student.email,
    subject: 'Hostel Application Update',
    html: '<p>Your hostel application was rejected.</p>'
  }).catch(emailError => {
    console.warn(`[MAILER] Student rejection email failed for ${student.email} — database rejection preserved.`);
  });

res.status(200).json({
  success: true,
  message: 'Student rejected'
});


} catch (error) {


next(error);


}

};

// ======================================================
// CHANGE ROOM
// ======================================================

const changeRoom = async (req, res, next) => {
  try {
    const { newRoomId, reason } = req.body;

    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'STUDENT') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (
      req.user.role === 'WARDEN' &&
      req.user.hostelId.toString() !== student.hostelId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden'
      });
    }

    const newRoom = await Room.findById(newRoomId);
    if (!newRoom || newRoom.availableBeds <= 0 || !newRoom.isActive) {
      return res.status(400).json({
        success: false,
        message: 'New room unavailable or at full occupancy capacity'
      });
    }

    const oldRoomId = student.roomId;
    const oldRoom = oldRoomId ? await Room.findById(oldRoomId) : null;

    // Remove from old room
    if (oldRoom) {
      oldRoom.students.pull(student._id);
      oldRoom.occupiedBeds = Math.max(0, oldRoom.occupiedBeds - 1);
      oldRoom.availableBeds = oldRoom.capacity - oldRoom.occupiedBeds;
      await oldRoom.save();
    }

    // Add to new room
    newRoom.students.push(student._id);
    newRoom.occupiedBeds += 1;
    newRoom.availableBeds = newRoom.capacity - newRoom.occupiedBeds;
    await newRoom.save();

    // Assign new bed
    const newBedNumber = await assignNextBed(newRoom._id, newRoom.capacity);

    student.roomId = newRoom._id;
    student.bedNumber = newBedNumber;
    await student.save();

    // Preserve Room Shifting History Entry
    const transferLog = new RoomTransfer({
      studentId: student._id,
      oldRoomId: oldRoomId || null,
      newRoomId: newRoom._id,
      transferredBy: req.user._id,
      reason: reason || 'Dynamic room assignment'
    });
    await transferLog.save();

    // Notify affected student in real-time
    const { createAndEmitNotification, emitToRoom } = require('../utils/socket');
    const oldRoomNumber = oldRoom ? oldRoom.roomNumber : 'Unassigned';
    await createAndEmitNotification({
      recipientId: student._id,
      title: 'Room Reassigned',
      message: `Your hostel room has been shifted from ${oldRoomNumber} to ${newRoom.roomNumber} (bed ${newBedNumber}) by Warden.`,
      type: 'ROOM_TRANSFER',
      priority: 'IMPORTANT',
      relatedEntityId: newRoom._id,
      actionUrl: '/student',
      hostelId: student.hostelId
    });

    // Notify other portal users in the hostel in real-time to trigger instant dashboard/occupancy updates
    emitToRoom(`HOSTEL_${student.hostelId}`, 'REFRESH_DASHBOARD', { type: 'ROOM_ALLOCATION' });
    emitToRoom(`HOSTEL_${student.hostelId}`, 'ROOM_TRANSFERRED', {
      studentId: student._id,
      oldRoomId,
      oldRoomNumber,
      newRoomId: newRoom._id,
      newRoomNumber: newRoom.roomNumber,
      newBedNumber,
      reason: reason || 'Dynamic room assignment',
      updatedBy: req.user._id,
      updatedAt: new Date()
    });
    emitToRoom(`STUDENT_${student._id}`, 'ROOM_TRANSFERRED', {
      studentId: student._id,
      oldRoomId,
      oldRoomNumber,
      newRoomId: newRoom._id,
      newRoomNumber: newRoom.roomNumber,
      newBedNumber,
      reason: reason || 'Dynamic room assignment',
      updatedBy: req.user._id,
      updatedAt: new Date()
    });

    // Log atomic audit log for tracebility
    const { logAudit } = require('../utils/auditLogger');
    await logAudit({
      req,
      actionType: 'ROOM_REASSIGNED',
      entityType: 'USER',
      entityId: student._id,
      title: 'Room Reassigned',
      description: `Student ${student.fullName} room changed from ${oldRoomNumber} to ${newRoom.roomNumber} (bed ${newBedNumber}). Reason: ${reason || 'Warden choice'}`,
      severity: 'IMPORTANT',
      hostelId: student.hostelId
    });

    // Email notification
    sendEmail({
      email: student.email,
      subject: 'Room Changed - Smart Hostel',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h3 style="color: #4f46e5;">Room Shifting Completed</h3>
          <p>Dear ${student.fullName},</p>
          <p>This is to officially inform you that your hostel room has been shifted:</p>
          <ul>
            <li><strong>Previous Room:</strong> ${oldRoomNumber}</li>
            <li><strong>New Room:</strong> ${newRoom.roomNumber} (Bed ${newBedNumber})</li>
            <li><strong>Transferred By:</strong> ${req.user.fullName}</li>
            <li><strong>Reason:</strong> ${reason || 'Operational adjustment'}</li>
          </ul>
          <p>Please shift your belongings to the new room at your earliest convenience.</p>
          <p>Regards,<br>Hostel Administration</p>
        </div>
      `
    }).catch(emailError => {
      console.warn(`[MAILER] Room change email failed for ${student.email} — database update preserved.`);
    });

    res.status(200).json({
      success: true,
      message: `Student successfully reassigned to Room ${newRoom.roomNumber}`,
      newRoomNumber: newRoom.roomNumber,
      newBedNumber
    });

  } catch (error) {
    next(error);
  }
};

const getRoomTransferHistory = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'WARDEN') {
      const students = await User.find({ hostelId: req.user.hostelId, role: 'STUDENT' }).select('_id');
      const studentIds = students.map(s => s._id);
      query = { studentId: { $in: studentIds } };
    }
    const history = await RoomTransfer.find(query)
      .populate('studentId', 'fullName email admissionNumber')
      .populate('oldRoomId', 'roomNumber floor')
      .populate('newRoomId', 'roomNumber floor')
      .populate('transferredBy', 'fullName role')
      .sort({ transferredAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET ALL STUDENTS
// ======================================================

const getStudents = async (req, res, next) => {

try {

let query = {
  role: 'STUDENT',
  emailVerified: true
};

if (req.user.role === 'WARDEN') {
  query.hostelId = req.user.hostelId;
}

if (req.query.roomId) {
  query.roomId = req.query.roomId;
}

if (req.query.approvalStatus) {
  query.approvalStatus = req.query.approvalStatus;
}

const students = await User.find(query)
  .populate('roomId', 'roomNumber floor')
  .lean(); // Optimization: lean()

res.status(200).json({
  success: true,
  count: students.length,
  students
});


} catch (error) {


next(error);

}

};

// ======================================================
// GET PENDING STUDENTS
// ======================================================

const getPendingStudents = async (req, res, next) => {

try {


let query = {
  role: 'STUDENT',
  approvalStatus: 'PENDING',
  emailVerified: true
};

if (req.user.role === 'WARDEN') {
  query.hostelId = req.user.hostelId;
}

const students = await User.find(query).lean(); // Optimization: lean()

res.status(200).json({
  success: true,
  count: students.length,
  students
});


} catch (error) {


next(error);


}

};

// ======================================================
// GET SINGLE STUDENT
// ======================================================

const getSingleStudent = async (req, res, next) => {

try {

const student = await User.findById(req.params.id)
  .populate('roomId', 'roomNumber floor')
  .lean(); // Optimization: lean()

if (!student) {

  return res.status(404).json({
    success: false,
    message: 'Student not found'
  });

}

if (
  req.user.role === 'WARDEN' &&
  req.user.hostelId.toString() !== student.hostelId.toString()
) {

  return res.status(403).json({
    success: false,
    message: 'Forbidden'
  });

}

res.status(200).json({
  success: true,
  student
});


} catch (error) {
next(error);

}

};

const vacateStudent = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'STUDENT') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (
      req.user.role === 'WARDEN' &&
      req.user.hostelId.toString() !== student.hostelId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden'
      });
    }

    if (!student.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Student is already vacated/archived'
      });
    }

    const oldRoomId = student.roomId;
    let oldRoomNumber = 'Unassigned';

    // 1. Release room occupancy
    if (oldRoomId) {
      const oldRoom = await Room.findById(oldRoomId);
      if (oldRoom) {
        oldRoomNumber = oldRoom.roomNumber;
        oldRoom.students.pull(student._id);
        oldRoom.occupiedBeds = Math.max(0, oldRoom.occupiedBeds - 1);
        oldRoom.availableBeds = oldRoom.capacity - oldRoom.occupiedBeds;
        await oldRoom.save();

        const { emitToRoom } = require('../utils/socket');
        emitToRoom(`HOSTEL_${student.hostelId}`, 'ROOM_UPDATED', {
          roomId: oldRoom._id,
          roomNumber: oldRoom.roomNumber,
          occupiedBeds: oldRoom.occupiedBeds,
          availableBeds: oldRoom.availableBeds
        });
      }
    }

    // 2. Perform parent account deactivation/unlinking
    let parentCleanedUpInfo = 'No parent account linked';
    if (student.parentEmail) {
      const parents = await User.find({ role: 'PARENT', linkedStudents: student._id });
      for (const parent of parents) {
        if (parent.linkedStudents.length === 1) {
          // Linked ONLY to this student -> deactivate parent
          parent.isActive = false;
          parentCleanedUpInfo = `Deactivated parent account: ${parent.email}`;
        } else {
          // monitors multiple students -> unlink this student only
          parent.linkedStudents.pull(student._id);
          parentCleanedUpInfo = `Unlinked from multi-student parent account: ${parent.email}`;
        }
        await parent.save();
      }
    }

    // 3. Mark student as inactive, vacated, and archived
    student.isActive = false;
    student.status = 'VACATED';
    student.vacatedAt = new Date();
    student.vacatedBy = req.user._id;
    student.vacateReason = reason || 'Vacated by Warden/Admin';
    
    // Clear room assignment pointers to avoid orphans
    student.roomId = null;
    student.bedNumber = null;

    await student.save();

    // 4. Trigger Socket Realtime Updates
    const { emitToRoom } = require('../utils/socket');
    emitToRoom(`HOSTEL_${student.hostelId}`, 'STUDENT_VACATED', {
      studentId: student._id,
      fullName: student.fullName,
      hostelId: student.hostelId,
      oldRoomId,
      oldRoomNumber
    });
    emitToRoom(`HOSTEL_${student.hostelId}`, 'REFRESH_DASHBOARD', { type: 'STUDENT_VACATED' });
    emitToRoom('ADMIN_GLOBAL', 'REFRESH_DASHBOARD', { type: 'STUDENT_VACATED' });

    // 5. Create proper Audit Logging
    const { logAudit } = require('../utils/auditLogger');
    await logAudit({
      req,
      actionType: 'STUDENT_VACATED',
      entityType: 'USER',
      entityId: student._id,
      title: 'Student Vacated & Archived',
      description: `Student ${student.fullName} has vacated the hostel and account was archived. Room ${oldRoomNumber} occupancy released. ${parentCleanedUpInfo}`,
      severity: 'IMPORTANT',
      hostelId: student.hostelId,
      metadata: {
        vacatedBy: req.user._id,
        reason: student.vacateReason,
        previousRoom: oldRoomNumber,
        parentCleanedUp: parentCleanedUpInfo
      }
    });

    res.status(200).json({
      success: true,
      message: `Student ${student.fullName} has been successfully vacated and account archived.`,
      parentCleanedUpInfo
    });

  } catch (error) {
    next(error);
  }
};

const getArchivedStudents = async (req, res, next) => {
  try {
    let query = {
      role: 'STUDENT',
      isActive: false,
      status: 'VACATED'
    };

    if (req.user.role === 'WARDEN') {
      query.hostelId = req.user.hostelId;
    }

    const students = await User.find(query)
      .populate('vacatedBy', 'fullName email')
      .sort({ vacatedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: students.length,
      students
    });
  } catch (error) {
    next(error);
  }
};

const restoreStudent = async (req, res, next) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'STUDENT') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    if (
      req.user.role === 'WARDEN' &&
      req.user.hostelId.toString() !== student.hostelId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden'
      });
    }

    if (student.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Student is already active'
      });
    }

    // 1. Restore Student status flags
    student.isActive = true;
    student.status = 'ACTIVE';
    student.approvalStatus = 'PENDING'; // Return to pending so Warden can approve and run smart allocation!
    student.isApproved = false;

    // Clear vacated indicators
    student.vacatedAt = undefined;
    student.vacatedBy = undefined;
    student.vacateReason = undefined;

    await student.save();

    // 2. Reactivate and link Parent Account if necessary
    let parentRestoredInfo = 'No parent reactivated';
    if (student.parentEmail) {
      let parent = await User.findOne({ email: student.parentEmail, role: 'PARENT' });
      if (parent) {
        let changed = false;
        if (!parent.isActive) {
          parent.isActive = true;
          changed = true;
        }
        if (!parent.linkedStudents.includes(student._id)) {
          parent.linkedStudents.push(student._id);
          changed = true;
        }
        if (changed) {
          await parent.save();
          parentRestoredInfo = `Reactivated and re-linked parent account: ${parent.email}`;
        }
      }
    }

    // 3. Emit real-time broadcasts
    const { emitToRoom } = require('../utils/socket');
    emitToRoom(`HOSTEL_${student.hostelId}`, 'REFRESH_DASHBOARD', { type: 'STUDENT_RESTORED' });
    emitToRoom('ADMIN_GLOBAL', 'REFRESH_DASHBOARD', { type: 'STUDENT_RESTORED' });

    // 4. Log audit log
    const { logAudit } = require('../utils/auditLogger');
    await logAudit({
      req,
      actionType: 'STUDENT_RESTORED',
      entityType: 'USER',
      entityId: student._id,
      title: 'Student Account Restored',
      description: `Student account for ${student.fullName} has been restored back to the active list and routed to Pending approvals for smart allocation.`,
      severity: 'IMPORTANT',
      hostelId: student.hostelId,
      metadata: {
        restoredBy: req.user._id,
        parentRestored: parentRestoredInfo
      }
    });

    res.status(200).json({
      success: true,
      message: `Resident ${student.fullName} successfully restored and queued back to Pending approvals.`,
      parentRestoredInfo
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerStudent,
  approveStudent,
  rejectStudent,
  changeRoom,
  getStudents,
  getPendingStudents,
  getSingleStudent,
  getRoomTransferHistory,
  vacateStudent,
  getArchivedStudents,
  restoreStudent
};
