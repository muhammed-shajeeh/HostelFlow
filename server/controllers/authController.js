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
    }).catch(emailError => {
      console.warn(`[MAILER] Verification email failed for ${user.email} — database registration preserved.`);
    });

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

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const inputIdentifier = (email || '').trim().toLowerCase();

    if (!inputIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Please provide credentials.' });
    }

    // Try finding by direct email
    const user = await User.findOne({ email: inputIdentifier }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (user.role === 'SECURITY') {
      return res.status(403).json({ success: false, message: 'Security terminals must log in via the dedicated PIN gate terminal.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ success: false, message: 'This account has been disabled.' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email before logging in.' });
    }

    if (user.role === 'STUDENT' && !user.isApproved) {
      return res.status(403).json({ success: false, message: 'Your account is pending admin approval.' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

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

// @desc    PIN-based Security Gate login
// @route   POST /api/auth/security-login
// @access  Public
const securityLogin = async (req, res, next) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ success: false, message: 'PIN code is required.' });
    }

    // Validate PIN length and numeric constraint: strictly 6 digits
    const pinStr = String(pin).trim();
    if (!/^\d{6}$/.test(pinStr)) {
      return res.status(400).json({ success: false, message: 'Security PIN must be exactly 6 numeric digits.' });
    }

    // Find all active security profiles
    const guards = await User.find({ role: 'SECURITY', isActive: true }).populate('hostelId', 'name');

    let matchedGuard = null;
    for (const g of guards) {
      const isMatch = await g.comparePin(pinStr);
      if (isMatch) {
        matchedGuard = g;
        break;
      }
    }

    if (matchedGuard) {
      // Check lock
      const now = new Date();
      if (matchedGuard.loginLockUntil && now < matchedGuard.loginLockUntil) {
        const remainingMin = Math.ceil((matchedGuard.loginLockUntil - now) / 1000 / 60);
        return res.status(403).json({
          success: false,
          message: `Terminal is locked due to too many failed attempts. Try again in ${remainingMin} minute(s).`
        });
      }

      // Success! Reset lock and failed attempts
      matchedGuard.failedLoginAttempts = 0;
      matchedGuard.loginLockUntil = undefined;
      matchedGuard.securityLoginCount = (matchedGuard.securityLoginCount || 0) + 1;
      matchedGuard.lastSecurityLogin = new Date();
      await matchedGuard.save();

      // Clean token generation
      const token = generateToken(matchedGuard._id, 'SECURITY', matchedGuard.hostelId?._id);

      const userObj = matchedGuard.toObject();
      delete userObj.password;
      delete userObj.securityPinHash;

      return res.status(200).json({
        success: true,
        token,
        user: userObj
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN.'
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Request password reset OTP
// @route   POST /api/auth/forgot-password
// @access  Public
const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide email address.' });
    }

    const emailClean = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: emailClean });
    
    if (!user) {
      // For security / anti-enumeration, we can still return a friendly positive-neutral response,
      // but the user requirement specifies "System validates: account exists, role is eligible"
      // So returning a simple clean error is best.
      return res.status(404).json({ success: false, message: 'No active account found with this email address.' });
    }

    if (user.role === 'SECURITY') {
      return res.status(403).json({ success: false, message: 'Security gate terminals must reset PIN via Warden only.' });
    }

    // Resend cooldown verification
    const COOLDOWN_MS = 60 * 1000;
    if (user.resetOtpLastSent && (Date.now() - new Date(user.resetOtpLastSent).getTime() < COOLDOWN_MS)) {
      const remainingSecs = Math.ceil((COOLDOWN_MS - (Date.now() - new Date(user.resetOtpLastSent).getTime())) / 1000);
      return res.status(429).json({ success: false, message: `Please wait ${remainingSecs} seconds before requesting another OTP.` });
    }

    // Check Lockout
    if (user.resetOtpLockUntil && new Date() < new Date(user.resetOtpLockUntil)) {
      const remainingMin = Math.ceil((new Date(user.resetOtpLockUntil) - Date.now()) / 1000 / 60);
      return res.status(429).json({ success: false, message: `Password recovery is locked. Try again in ${remainingMin} minute(s).` });
    }

    // Generate secure OTP
    const otp = generateOTP();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    // Save recovery details to user
    user.resetOtp = hashedOtp;
    user.resetOtpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
    user.resetOtpAttempts = 0;
    user.resetOtpLastSent = new Date();
    await user.save();

    // Symmetrical, premium email template matching tone rules
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">Hostel<span style="color: #2563eb;">Flow</span></h2>
          <p style="font-size: 11px; font-weight: 700; color: #64748b; margin: 6px 0 0 0; text-transform: uppercase; letter-spacing: 0.05em;">Security Verification</p>
        </div>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 16px;">Hello ${user.fullName},</p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 24px;">We received a request to reset your HostelFlow password. Use the verification code below to complete your recovery:</p>
        <div style="text-align: center; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <strong style="font-size: 32px; font-weight: 800; letter-spacing: 0.15em; color: #2563eb; font-family: monospace; display: block; margin: 0 auto;">${otp}</strong>
        </div>
        <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin-bottom: 24px;">This verification code will expire in <strong>5 minutes</strong>. To preserve account security, please do not share this code with anyone.</p>
        <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 11px; line-height: 1.5; color: #94a3b8;">
          <p style="margin: 0;"><strong>Security Notice:</strong> If you did not make this request, someone may have entered your email address by mistake. Your account remains completely secure, and you can safely ignore this email.</p>
        </div>
      </div>
    `;

    res.status(200).json({ success: true, message: 'OTP verification code has been sent to your email address.' });

    // Send asynchronous recovery email
    sendEmail({
      email: user.email,
      subject: 'Reset your password - HostelFlow',
      html: emailHtml
    }).catch(emailErr => {
      console.warn(`[MAILER] Password reset email failed for ${user.email} — database update preserved.`);
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP for password recovery
// @route   POST /api/auth/verify-reset-otp
// @access  Public
const verifyResetOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Please provide email and verification code.' });
    }

    const emailClean = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: emailClean });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    // Check Lockout
    if (user.resetOtpLockUntil && new Date() < new Date(user.resetOtpLockUntil)) {
      const remainingMin = Math.ceil((new Date(user.resetOtpLockUntil) - Date.now()) / 1000 / 60);
      return res.status(429).json({ success: false, message: `Too many failed attempts. Recovery is temporarily locked. Try again in ${remainingMin} minute(s).` });
    }

    if (!user.resetOtp || !user.resetOtpExpiry) {
      return res.status(400).json({ success: false, message: 'No active reset request found. Please request a new OTP.' });
    }

    if (new Date() > new Date(user.resetOtpExpiry)) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // Increment attempts count
    user.resetOtpAttempts = (user.resetOtpAttempts || 0) + 1;

    if (user.resetOtpAttempts > 5) {
      user.resetOtpLockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
      user.resetOtpAttempts = 0; // reset count for later
      await user.save();

      // Log the security lockout audit event
      const { logAudit } = require('../utils/auditLogger');
      await logAudit({
        actor: user,
        actionType: 'OTP_ABUSE_LOCKOUT',
        entityType: 'SECURITY',
        entityId: user._id,
        title: 'OTP Abuse Lockout',
        description: `Password recovery locked for 15 minutes for user ${user.fullName} (${user.role}) due to repeated verification failures.`,
        severity: 'CRITICAL',
        hostelId: user.hostelId
      });

      return res.status(429).json({ success: false, message: 'Too many wrong attempts. Password recovery has been locked for 15 minutes.' });
    }

    const isMatch = await bcrypt.compare(otp, user.resetOtp);
    if (!isMatch) {
      await user.save();
      const remainingAttempts = 5 - user.resetOtpAttempts;
      return res.status(400).json({ success: false, message: `Incorrect verification code. You have ${remainingAttempts} attempt(s) remaining.` });
    }

    // Success - reset attempts count on success
    user.resetOtpAttempts = 0;
    await user.save();

    res.status(200).json({ success: true, message: 'OTP verified successfully. You can now create your new password.' });

  } catch (error) {
    next(error);
  }
};

// @desc    Reset password using email and OTP
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;
    if (!email || !otp || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const emailClean = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: emailClean });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    // Check Lockout
    if (user.resetOtpLockUntil && new Date() < new Date(user.resetOtpLockUntil)) {
      const remainingMin = Math.ceil((new Date(user.resetOtpLockUntil) - Date.now()) / 1000 / 60);
      return res.status(429).json({ success: false, message: `Recovery is locked. Try again in ${remainingMin} minute(s).` });
    }

    if (!user.resetOtp || !user.resetOtpExpiry) {
      return res.status(400).json({ success: false, message: 'No active reset request found. Please request a new OTP.' });
    }

    if (new Date() > new Date(user.resetOtpExpiry)) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    const isMatch = await bcrypt.compare(otp, user.resetOtp);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Verification failed. Code is invalid.' });
    }

    // Update password
    user.password = password; // Pre-save pre hook hashes this

    // Clear reset OTP fields completely to prevent reuse
    user.resetOtp = undefined;
    user.resetOtpExpiry = undefined;
    user.resetOtpAttempts = 0;
    user.resetOtpLockUntil = undefined;
    user.resetOtpLastSent = undefined;

    await user.save();

    res.status(200).json({ success: true, message: 'Password updated successfully. Please login.' });

  } catch (error) {
    next(error);
  }
};

// @desc    Resend Verification OTP
// @route   POST /api/auth/resend-verification
// @access  Public
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide email address.' });
    }

    const emailClean = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: emailClean });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address.' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ success: false, message: 'This email address is already verified.' });
    }

    // Generate secure OTP
    const otp = generateOTP();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    // Save recovery details to user
    user.emailOtp = hashedOtp;
    user.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    await user.save();

    // Symmetrical, premium email template matching tone rules
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0;">Hostel<span style="color: #2563eb;">Flow</span></h2>
          <p style="font-size: 11px; font-weight: 700; color: #64748b; margin: 6px 0 0 0; text-transform: uppercase; letter-spacing: 0.05em;">Email Verification</p>
        </div>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 16px;">Hello ${user.fullName},</p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 24px;">Here is your requested email verification OTP to activate your HostelFlow account:</p>
        <div style="text-align: center; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <strong style="font-size: 32px; font-weight: 800; letter-spacing: 0.15em; color: #2563eb; font-family: monospace; display: block; margin: 0 auto;">${otp}</strong>
        </div>
        <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin-bottom: 24px;">This verification code will expire in <strong>10 minutes</strong>.</p>
      </div>
    `;

    res.status(200).json({ success: true, message: 'Verification OTP has been resent to your email address.' });

    // Send asynchronous verification email
    sendEmail({
      email: user.email,
      subject: 'Verify your Email - HostelFlow',
      html: emailHtml
    }).catch(emailErr => {
      console.warn(`[MAILER] Resend verification email failed for ${user.email} — database update preserved.`);
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  getMe,
  updateProfile,
  securityLogin,
  requestPasswordReset,
  verifyResetOtp,
  resetPassword
};
