const User = require('../models/User');
const ScanLog = require('../models/ScanLog');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// @desc    Get the single security gate account for Warden's hostel
// @route   GET /api/security-gate/accounts
// @access  Private (Warden only)
const getSecurityAccounts = async (req, res, next) => {
  try {
    if (req.user.role !== 'WARDEN') {
      return res.status(403).json({ success: false, message: 'Access denied. Wardens only.' });
    }

    const hostelId = req.user.hostelId;
    if (!hostelId) {
      return res.status(400).json({ success: false, message: 'Warden is not assigned to a hostel.' });
    }

    // Find the single security profile for this hostel
    let securityUser = await User.findOne({ role: 'SECURITY', hostelId })
      .select('fullName lastLogin isActive hostelId securityLoginCount lastSecurityLogin securityEnabled failedLoginAttempts loginLockUntil')
      .populate('hostelId', 'name');

    // If no security profile exists yet, auto-create one with a safe default PIN
    if (!securityUser) {
      const Hostel = mongoose.model('Hostel');
      const hostel = await Hostel.findById(hostelId);
      const hostelName = hostel ? hostel.name : 'Hostel';

      const uniqueId = crypto.randomBytes(4).toString('hex');
      const email = `gate_${uniqueId}@security.com`;
      const password = crypto.randomBytes(16).toString('hex');

      // Default PIN is 123456
      const salt = await bcrypt.genSalt(10);
      const defaultPinHash = await bcrypt.hash('123456', salt);

      securityUser = new User({
        fullName: `${hostelName} Shared Gatehouse`,
        email,
        password,
        role: 'SECURITY',
        hostelId,
        emailVerified: true,
        isApproved: true,
        approvalStatus: 'APPROVED',
        securityPinHash: defaultPinHash,
        securityEnabled: true,
        isActive: true
      });

      await securityUser.save();
      
      // Reload to get fully populated fields
      securityUser = await User.findById(securityUser._id)
        .select('fullName lastLogin isActive hostelId securityLoginCount lastSecurityLogin securityEnabled failedLoginAttempts loginLockUntil')
        .populate('hostelId', 'name');
    }

    // Count today's scans for this security user
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayScanCount = await ScanLog.countDocuments({
      scannerId: securityUser._id,
      createdAt: { $gte: startOfToday }
    });

    const accountData = {
      ...securityUser.toObject(),
      todayScanCount
    };

    // Return both direct object and array list for maximum backward and forward compatibility
    res.status(200).json({
      success: true,
      account: accountData,
      accounts: [accountData] // Keeps list displays functioning smoothly without crashes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Placeholder for legacy route compatibility
// @route   POST /api/security-gate/accounts
// @access  Private (Warden only)
const createSecurityAccount = async (req, res, next) => {
  return res.status(400).json({
    success: false,
    message: 'Individual terminal creation is disabled. Each hostel has exactly one shared terminal.'
  });
};

// @desc    Reset the shared security gate PIN (Strictly 6 Digits)
// @route   PUT /api/security-gate/accounts/:id/reset-password
// @access  Private (Warden only)
const resetSecurityPassword = async (req, res, next) => {
  try {
    const { pin, generateRandom } = req.body;
    const guard = await User.findById(req.params.id);

    if (!guard || guard.role !== 'SECURITY') {
      return res.status(404).json({ success: false, message: 'Security account not found.' });
    }

    // Warden isolation check
    if (req.user.role === 'WARDEN' && guard.hostelId.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied: account belongs to another hostel.' });
    }

    let finalPin = String(pin || '').trim();
    if (generateRandom) {
      // Generate unique random 6-digit PIN
      let attempts = 0;
      const activeGuards = await User.find({ role: 'SECURITY', isActive: true, _id: { $ne: guard._id } });

      while (attempts < 100) {
        // Generates exactly 6 digits between 100000 and 999999
        const potentialPin = Math.floor(100000 + Math.random() * 900000).toString();
        let isDuplicate = false;
        
        for (const other of activeGuards) {
          if (await other.comparePin(potentialPin)) {
            isDuplicate = true;
            break;
          }
        }
        
        if (!isDuplicate) {
          finalPin = potentialPin;
          break;
        }
        attempts++;
      }
      
      if (!finalPin) {
        finalPin = Math.floor(100000 + Math.random() * 900000).toString();
      }
    }

    // Validation rule: PIN must be exactly 6 numeric digits
    if (!/^\d{6}$/.test(finalPin)) {
      return res.status(400).json({ success: false, message: 'Security PIN must be exactly 6 numeric digits.' });
    }

    // Enforce global uniqueness of active PINs to prevent gate terminal conflicts
    const activeGuards = await User.find({ role: 'SECURITY', isActive: true, _id: { $ne: guard._id } });
    for (const other of activeGuards) {
      const isMatch = await other.comparePin(finalPin);
      if (isMatch) {
        return res.status(400).json({ success: false, message: 'This PIN is already assigned to another hostel gate terminal.' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    guard.securityPinHash = await bcrypt.hash(finalPin, salt);
    
    // Clear lockout variables
    guard.failedLoginAttempts = 0;
    guard.loginLockUntil = undefined;

    await guard.save();

    res.status(200).json({
      success: true,
      message: `PIN updated successfully. ${generateRandom ? 'New random PIN: ' + finalPin : ''}`,
      randomPin: generateRandom ? finalPin : undefined
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle active state of a security account
// @route   PUT /api/security-gate/accounts/:id/toggle-status
// @access  Private (Warden only)
const toggleSecurityStatus = async (req, res, next) => {
  try {
    const guard = await User.findById(req.params.id);

    if (!guard || guard.role !== 'SECURITY') {
      return res.status(404).json({ success: false, message: 'Security account not found.' });
    }

    // Hostel isolation check
    if (req.user.role === 'WARDEN' && guard.hostelId.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied: account belongs to another hostel.' });
    }

    guard.isActive = !guard.isActive;
    
    // Reset any failed attempts
    guard.failedLoginAttempts = 0;
    guard.loginLockUntil = undefined;
    
    await guard.save();

    res.status(200).json({
      success: true,
      message: `Security terminal access has been ${guard.isActive ? 'enabled' : 'disabled'} successfully.`,
      isActive: guard.isActive
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get shift stats for security portal homepage
// @route   GET /api/security-gate/shift-stats
// @access  Private (Security only)
const getSecurityShiftStats = async (req, res, next) => {
  try {
    if (req.user.role !== 'SECURITY') {
      return res.status(403).json({ success: false, message: 'Only security accounts can access shift metrics.' });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [exits, returns, failures, recentScans] = await Promise.all([
      ScanLog.countDocuments({
        scannerId: req.user._id,
        action: 'EXIT',
        success: true,
        createdAt: { $gte: startOfToday }
      }),
      ScanLog.countDocuments({
        scannerId: req.user._id,
        action: 'RETURN',
        success: true,
        createdAt: { $gte: startOfToday }
      }),
      ScanLog.countDocuments({
        scannerId: req.user._id,
        success: false,
        createdAt: { $gte: startOfToday }
      }),
      ScanLog.find({ scannerId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('studentId', 'fullName admissionNumber')
        .lean()
    ]);

    res.status(200).json({
      success: true,
      stats: {
        exits,
        returns,
        failures,
        total: exits + returns + failures
      },
      recentScans
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSecurityAccounts,
  createSecurityAccount,
  resetSecurityPassword,
  toggleSecurityStatus,
  getSecurityShiftStats
};
