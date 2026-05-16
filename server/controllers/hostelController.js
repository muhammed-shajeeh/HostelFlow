const Hostel = require('../models/Hostel');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Create new hostel
// @route   POST /api/hostels
// @access  Private (Admin only)
const createHostel = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, hostelCode, gender, description, totalFloors } = req.body;

    const existingName = await Hostel.findOne({ name });
    if (existingName) return res.status(400).json({ success: false, message: 'Hostel name already exists' });

    const existingCode = await Hostel.findOne({ hostelCode: hostelCode.toUpperCase() });
    if (existingCode) return res.status(400).json({ success: false, message: 'Hostel code already exists' });

    const hostel = await Hostel.create({ 
      name, 
      hostelCode: hostelCode.toUpperCase(), 
      gender, 
      description, 
      totalFloors 
    });

    res.status(201).json({ success: true, hostel, message: 'Hostel created successfully' });
  } catch (error) { next(error); }
};

// @desc    Get all hostels
// @route   GET /api/hostels
// @access  Private (Admin & Student & Warden)
const getAllHostels = async (req, res, next) => {
  try {
    const hostels = await Hostel.find().populate('warden', 'fullName email');
    res.status(200).json({ success: true, count: hostels.length, hostels });
  } catch (error) { next(error); }
};

// @desc    Get single hostel
// @route   GET /api/hostels/:id
// @access  Private
const getSingleHostel = async (req, res, next) => {
  try {
    const hostel = await Hostel.findById(req.params.id).populate('warden', 'fullName email');
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found' });
    res.status(200).json({ success: true, hostel });
  } catch (error) { next(error); }
};

// @desc    Update hostel
// @route   PUT /api/hostels/:id
// @access  Private (Admin only)
const updateHostel = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    let hostel = await Hostel.findById(req.params.id);
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found' });

    const { name, hostelCode } = req.body;

    // Check duplicate name
    if (name && name !== hostel.name) {
      const existingName = await Hostel.findOne({ name });
      if (existingName) return res.status(400).json({ success: false, message: 'Hostel name already exists' });
    }

    // Check duplicate code
    if (hostelCode && hostelCode.toUpperCase() !== hostel.hostelCode) {
      const existingCode = await Hostel.findOne({ hostelCode: hostelCode.toUpperCase() });
      if (existingCode) return res.status(400).json({ success: false, message: 'Hostel code already exists' });
    }

    if (req.body.hostelCode) {
      req.body.hostelCode = req.body.hostelCode.toUpperCase();
    }

    hostel = await Hostel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({ success: true, hostel, message: 'Hostel updated successfully' });
  } catch (error) { next(error); }
};

// @desc    Delete hostel
// @route   DELETE /api/hostels/:id
// @access  Private (Admin only)
const deleteHostel = async (req, res, next) => {
  try {
    const hostel = await Hostel.findById(req.params.id);
    if (!hostel) return res.status(404).json({ success: false, message: 'Hostel not found' });

    // Ensure no warden is assigned before deleting or handle it
    if (hostel.warden) {
      // Remove hostel ref from warden
      await User.findByIdAndUpdate(hostel.warden, { $unset: { hostelId: 1 } });
    }

    await hostel.deleteOne();
    res.status(200).json({ success: true, message: 'Hostel deleted successfully' });
  } catch (error) { next(error); }
};

module.exports = {
  createHostel,
  getAllHostels,
  getSingleHostel,
  updateHostel,
  deleteHostel
};
