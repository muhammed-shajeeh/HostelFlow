const User = require('../models/User');
const Room = require('../models/Room');
const Hostel = require('../models/Hostel');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const sendEmail = require('../utils/email');
const { generateOTP } = require('../utils/otp');

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

try {

  await sendEmail({
    email: student.email,
    subject: 'Verify Email - Smart Hostel',
    html: emailHtml
  });

} catch (emailError) {

  console.error(emailError);

}

res.status(201).json({
  success: true,
  message: 'Registration successful. Please verify OTP.'
});


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

try {

  await sendEmail({
    email: student.email,
    subject: 'Hostel Approval',
    html: emailHtml
  });

} catch (emailError) {

  console.error(emailError);

}

// Parent Linking
if (student.parentEmail) {

  const parent = await User.findOne({
    email: student.parentEmail,
    role: 'PARENT'
  });

  if (
    parent &&
    !parent.linkedStudents.includes(student._id)
  ) {

    parent.linkedStudents.push(student._id);

    await parent.save();

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

try {

  await sendEmail({
    email: student.email,
    subject: 'Hostel Application Update',
    html: '<p>Your hostel application was rejected.</p>'
  });

} catch (emailError) {

  console.error(emailError);

}

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


const { newRoomId } = req.body;

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

if (
  !newRoom ||
  newRoom.availableBeds <= 0
) {

  return res.status(400).json({
    success: false,
    message: 'New room unavailable'
  });

}

// Remove from old room
const oldRoom = await Room.findById(student.roomId);

if (oldRoom) {

  oldRoom.students.pull(student._id);

  oldRoom.occupiedBeds -= 1;

  oldRoom.availableBeds =
    oldRoom.capacity - oldRoom.occupiedBeds;

  await oldRoom.save();

}

// Add to new room
newRoom.students.push(student._id);

newRoom.occupiedBeds += 1;

newRoom.availableBeds =
  newRoom.capacity - newRoom.occupiedBeds;

await newRoom.save();

// Assign new bed
const newBedNumber = await assignNextBed(
  newRoom._id,
  newRoom.capacity
);

student.roomId = newRoom._id;

student.bedNumber = newBedNumber;

await student.save();

// Email
try {

  await sendEmail({
    email: student.email,
    subject: 'Room Changed',
    html: `
      <p>
        You have been moved to
        Room ${newRoom.roomNumber}
      </p>
    `
  });

} catch (emailError) {

  console.error(emailError);

}

res.status(200).json({
  success: true,
  message: 'Room changed successfully'
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
  role: 'STUDENT'
};

if (req.user.role === 'WARDEN') {
  query.hostelId = req.user.hostelId;
}

const students = await User.find(query)
  .populate('roomId', 'roomNumber floor');

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
  approvalStatus: 'PENDING'
};

if (req.user.role === 'WARDEN') {
  query.hostelId = req.user.hostelId;
}

const students = await User.find(query);

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
  .populate('roomId', 'roomNumber floor');

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

module.exports = {
registerStudent,
approveStudent,
rejectStudent,
changeRoom,
getStudents,
getPendingStudents,
getSingleStudent
};
