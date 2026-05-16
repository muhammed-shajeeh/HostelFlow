const Room = require('../models/Room');
const Hostel = require('../models/Hostel');
const { validationResult } = require('express-validator');

// @desc    Create a new room
// @route   POST /api/rooms
// @access  Private (Admin & Warden of that hostel)
const createRoom = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { hostelId, roomNumber, floor, capacity, roomType, gender, departmentPreference, batchPreference } = req.body;

    const hostel = await Hostel.findById(hostelId);
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found' });

    // Validate floor
    if (floor > hostel.totalFloors) {
      return res.status(400).json({ success: false, message: `Floor exceeds hostel total floors (${hostel.totalFloors})` });
    }

    // Duplicate room prevention inside same hostel
    const existingRoom = await Room.findOne({ hostelId, roomNumber });
    if (existingRoom) {
      return res.status(400).json({ success: false, message: `Room ${roomNumber} already exists in this hostel` });
    }

    const room = await Room.create({
      hostelId,
      roomNumber,
      floor,
      capacity,
      roomType,
      gender,
      departmentPreference,
      batchPreference
    });

    // Update hostel totalRooms
    hostel.totalRooms += 1;
    await hostel.save();

    res.status(201).json({ success: true, room, message: 'Room created successfully' });
  } catch (error) { 
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Room number already exists in this hostel' });
    }
    next(error); 
  }
};

// @desc    Get all rooms for a hostel
// @route   GET /api/rooms/hostel/:hostelId
// @access  Private (Admin & Warden of that hostel)
const getHostelRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find({ hostelId: req.params.hostelId })
      .populate('students', 'fullName email admissionNumber department');
    
    res.status(200).json({ success: true, count: rooms.length, rooms });
  } catch (error) { next(error); }
};

// @desc    Get single room
// @route   GET /api/rooms/:id
// @access  Private (Admin & Warden of that hostel)
const getSingleRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('students', 'fullName email admissionNumber department');
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    
    // Check isolation logic if warden
    if (req.user.role === 'WARDEN' && req.user.hostelId.toString() !== room.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    res.status(200).json({ success: true, room });
  } catch (error) { next(error); }
};

// @desc    Update room
// @route   PUT /api/rooms/:id
// @access  Private (Admin & Warden of that hostel)
const updateRoom = async (req, res, next) => {
  try {
    let room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    // Isolation check
    if (req.user.role === 'WARDEN' && req.user.hostelId.toString() !== room.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // If capacity is updated, check if it's less than currently occupied
    if (req.body.capacity && req.body.capacity < room.occupiedBeds) {
      return res.status(400).json({ success: false, message: 'New capacity cannot be less than currently occupied beds' });
    }

    // Room number unique check
    if (req.body.roomNumber && req.body.roomNumber !== room.roomNumber) {
      const existing = await Room.findOne({ hostelId: room.hostelId, roomNumber: req.body.roomNumber });
      if (existing) return res.status(400).json({ success: false, message: 'Room number already exists' });
    }

    room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    // This will trigger the pre-save hook indirectly? No, findByIdAndUpdate doesn't trigger pre-save by default
    // We should save to trigger pre-save for availableBeds recalculation
    room.availableBeds = room.capacity - room.occupiedBeds;
    await room.save();

    res.status(200).json({ success: true, room, message: 'Room updated successfully' });
  } catch (error) { next(error); }
};

// @desc    Delete room
// @route   DELETE /api/rooms/:id
// @access  Private (Admin & Warden of that hostel)
const deleteRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    if (req.user.role === 'WARDEN' && req.user.hostelId.toString() !== room.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (room.occupiedBeds > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete room with occupied beds' });
    }

    await Hostel.findByIdAndUpdate(room.hostelId, { $inc: { totalRooms: -1 } });
    await room.deleteOne();

    res.status(200).json({ success: true, message: 'Room deleted successfully' });
  } catch (error) { next(error); }
};

// @desc    Get available rooms
// @route   GET /api/rooms/available/:hostelId
// @access  Private (Admin & Warden of that hostel)
const getAvailableRooms = async (req, res, next) => {
  try {
    const { gender } = req.query; // optional filter
    let query = { hostelId: req.params.hostelId, availableBeds: { $gt: 0 }, isActive: true };
    if (gender) {
      query.gender = gender;
    }

    const rooms = await Room.find(query).sort('floor roomNumber');
    res.status(200).json({ success: true, count: rooms.length, rooms });
  } catch (error) { next(error); }
};

module.exports = {
  createRoom,
  getHostelRooms,
  getSingleRoom,
  updateRoom,
  deleteRoom,
  getAvailableRooms
};
