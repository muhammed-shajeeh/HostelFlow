const User = require('../models/User');
const Leave = require('../models/Leave');
const MealEligibility = require('../models/MealEligibility');
const MessBill = require('../models/MessBill');
const HostelFee = require('../models/HostelFee');
const Payment = require('../models/Payment');
const FeeConfig = require('../models/FeeConfig');
const BillingCycle = require('../models/BillingCycle');
const Invoice = require('../models/Invoice');
const FinancialAuditLog = require('../models/FinancialAuditLog');
const DailyMealRecord = require('../models/DailyMealRecord');
const crypto = require('crypto');
const sendEmail = require('../utils/email');

// Import Razorpay
let Razorpay;
try {
  Razorpay = require('razorpay');
} catch (e) {
  console.log("Razorpay library not loaded, using simulation fallback.");
}

// Helper to get local date normalized to midnight (YYYY-MM-DD)
const getNormalizedDate = (daysAhead = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(0, 0, 0, 0);
  return d;
};

// ======================================================
// CORE ERP FINANCIAL HELPER FUNCTIONS
// ======================================================

// DEFAULT fallback config used when no FeeConfig document exists yet
const DEFAULT_FEE_CONFIG = {
  hostelRent: 3000,
  maintenanceFee: 500,
  electricityFee: 300,
  messMealRate: 50,
  lateFineAmount: 200,
  effectiveFrom: new Date('2000-01-01'),
  _isDefault: true
};

// Resolve the most recently effective FeeConfig for a given date.
// Falls back to DEFAULT_FEE_CONFIG safely — never crashes with null.
const getActiveFeeConfig = async (forDate) => {
  try {
    const targetDate = forDate ? new Date(forDate) : new Date();
    const config = await FeeConfig
      .findOne({ effectiveFrom: { $lte: targetDate } })
      .sort({ effectiveFrom: -1 })
      .lean();

    if (!config) {
      console.warn('[FeeConfig] No active fee configuration found — using safe defaults.');
      return DEFAULT_FEE_CONFIG;
    }
    return config;
  } catch (err) {
    console.error('[FeeConfig] Error fetching fee config, using defaults:', err.message);
    return DEFAULT_FEE_CONFIG;
  }
};

// Calculate total unpaid outstanding balance for a student before a given date
const getOutstandingBalance = async (studentId, beforeDate) => {
  try {
    const unpaidInvoices = await Invoice.find({
      studentId,
      status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      dueDate: { $lt: beforeDate }
    }).lean();

    return unpaidInvoices.reduce((sum, inv) => {
      return sum + Math.max(0, (inv.totalAmount || 0) - (inv.amountPaid || 0));
    }, 0);
  } catch (err) {
    console.error('[Outstanding] Error calculating outstanding balance:', err.message);
    return 0;
  }
};

// Ensure a default FeeConfig exists (called at startup)
const ensureDefaultFeeConfig = async () => {
  try {
    const existing = await FeeConfig.findOne({}).lean();
    if (!existing) {
      console.log('[FeeConfig] No config found — seeding default fee configuration...');
      // Use a dummy ObjectId for the system seed; createdBy is optional in seeds
      const systemId = new (require('mongoose').Types.ObjectId)();
      await FeeConfig.create({
        hostelRent: 3000,
        maintenanceFee: 500,
        electricityFee: 300,
        messMealRate: 50,
        lateFineAmount: 200,
        effectiveFrom: new Date(),
        createdBy: systemId
      });
      console.log('[FeeConfig] Default fee configuration seeded successfully.');
    }
  } catch (err) {
    console.error('[FeeConfig] Could not seed default config:', err.message);
  }
};

// Run the seed once on module load (non-blocking)
ensureDefaultFeeConfig();

// ======================================================
// SMART MEAL ELIGIBILITY ENGINE (HELPERS)
// ======================================================
const syncStudentMealEligibility = async (studentId, hostelId, date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  let eligibility = await MealEligibility.findOne({ studentId, date: startOfDay });

  const student = await User.findById(studentId).lean();
  if (!student || student.approvalStatus !== 'APPROVED') {
    if (eligibility) await eligibility.deleteOne();
    return null;
  }

  const activeLeave = await Leave.findOne({
    studentId,
    status: { $in: ['APPROVED', 'EXITED'] },
    departureDate: { $lte: startOfDay },
    expectedReturnDate: { $gte: startOfDay }
  }).lean();

  const onLeave = !!activeLeave;

  if (!eligibility) {
    eligibility = new MealEligibility({
      studentId,
      hostelId,
      date: startOfDay,
      breakfast: !onLeave,
      lunch: !onLeave,
      dinner: !onLeave,
      skippedByLeave: onLeave,
      leaveReference: onLeave ? activeLeave._id : undefined,
      skippedManually: false
    });
    await eligibility.save();
  } else {
    if (eligibility.skippedByLeave !== onLeave) {
      eligibility.skippedByLeave = onLeave;
      eligibility.leaveReference = onLeave ? activeLeave._id : undefined;
      if (onLeave) {
        eligibility.breakfast = false;
        eligibility.lunch = false;
        eligibility.dinner = false;
      } else if (!eligibility.skippedManually) {
        eligibility.breakfast = true;
        eligibility.lunch = true;
        eligibility.dinner = true;
      }
      await eligibility.save();
    }
  }

  return eligibility;
};

// ======================================================
// PHASE 2 & 10: DAILY MEAL LEDGER FREEZE SYSTEM
// ======================================================
const freezeDailyMealsForDate = async (dateStr, hostelId = null) => {
  const targetDate = dateStr ? new Date(dateStr) : getNormalizedDate(1); // Defaults to Tomorrow!
  targetDate.setHours(0, 0, 0, 0);

  let studentQuery = { role: 'STUDENT', approvalStatus: 'APPROVED', isActive: true };
  if (hostelId) {
    studentQuery.hostelId = hostelId;
  }
  const students = await User.find(studentQuery).populate('roomId').populate('hostelId').lean();
  
  const createdRecords = [];

  for (const student of students) {
    if (!student.roomId) continue;

    // Prevent duplicate entries and race conditions via unique index fallback
    let existing = await DailyMealRecord.findOne({ studentId: student._id, date: targetDate });
    if (existing) continue;

    // 1. Sync meal eligibility preference live first
    const eligibility = await syncStudentMealEligibility(student._id, student.hostelId, targetDate);

    // 2. Compile granular choices
    let breakfast = true;
    let lunch = true;
    let dinner = true;
    let bReason = 'AUTO_INCLUDED_BY_ATTENDANCE';
    let lReason = 'AUTO_INCLUDED_BY_ATTENDANCE';
    let dReason = 'AUTO_INCLUDED_BY_ATTENDANCE';
    let leaveRef = undefined;

    if (eligibility) {
      breakfast = eligibility.breakfast;
      lunch = eligibility.lunch;
      dinner = eligibility.dinner;

      if (eligibility.skippedByLeave) {
        bReason = 'APPROVED_LEAVE';
        lReason = 'APPROVED_LEAVE';
        dReason = 'APPROVED_LEAVE';
        leaveRef = eligibility.leaveReference;
      } else {
        if (!breakfast && eligibility.skippedManually) bReason = 'MANUAL_SKIP';
        if (!lunch && eligibility.skippedManually) lReason = 'MANUAL_SKIP';
        if (!dinner && eligibility.skippedManually) dReason = 'MANUAL_SKIP';
      }
    }

    const record = new DailyMealRecord({
      studentId: student._id,
      hostelId: student.hostelId?._id || student.hostelId,
      roomId: student.roomId?._id || student.roomId,
      date: targetDate,
      breakfastIncluded: breakfast,
      lunchIncluded: lunch,
      dinnerIncluded: dinner,
      breakfastReason: bReason,
      lunchReason: lReason,
      dinnerReason: dReason,
      leaveReference: leaveRef,
      finalized: true,
      generatedAt: new Date()
    });

    await record.save();
    createdRecords.push(record);
  }

  return createdRecords;
};

// @desc    Manually trigger daily freeze execution
// @route   POST /api/mess/freeze-meals
// @access  Private (Warden/Admin)
const freezeMealsManual = async (req, res, next) => {
  try {
    const { date, hostelId } = req.body;
    const targetHostel = req.user.role === 'WARDEN' ? req.user.hostelId : hostelId;

    const records = await freezeDailyMealsForDate(date, targetHostel);

    // Log to Audit system
    await new FinancialAuditLog({
      actorId: req.user._id,
      actorRole: req.user.role,
      hostelId: req.user.hostelId,
      actionType: 'BILL_GENERATED',
      reason: `Manually triggered daily frozen ledger generation for date: ${date || 'tomorrow'}.`,
      newValue: { count: records.length },
      ipAddress: req.ip || req.headers['x-forwarded-for']
    }).save();

    res.status(200).json({
      success: true,
      message: `Daily meal records frozen successfully for ${records.length} students.`,
      recordsCount: records.length
    });
  } catch (error) { next(error); }
};

// @desc    Get Tomorrow Meal Status (Student)
// @route   GET /api/mess/tomorrow-meals
// @access  Private (Student)
const getTomorrowMealStatus = async (req, res, next) => {
  try {
    const student = req.user;
    if (student.role !== 'STUDENT') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const tomorrow = getNormalizedDate(1);
    
    // Check if tomorrow's meal record has already been frozen!
    const frozenRecord = await DailyMealRecord.findOne({ studentId: student._id, date: tomorrow }).lean();
    if (frozenRecord) {
      return res.status(200).json({
        success: true,
        date: tomorrow,
        frozen: true,
        eligibility: {
          breakfast: frozenRecord.breakfastIncluded,
          lunch: frozenRecord.lunchIncluded,
          dinner: frozenRecord.dinnerIncluded,
          skippedManually: frozenRecord.breakfastReason === 'MANUAL_SKIP' || frozenRecord.lunchReason === 'MANUAL_SKIP' || frozenRecord.dinnerReason === 'MANUAL_SKIP'
        }
      });
    }

    const eligibility = await syncStudentMealEligibility(student._id, student.hostelId, tomorrow);

    res.status(200).json({
      success: true,
      date: tomorrow,
      frozen: false,
      eligibility
    });
  } catch (error) { next(error); }
};

// @desc    Toggle Student Tomorrow Meal Choice (Granular & Cutoff checks)
// @route   POST /api/mess/toggle-tomorrow
// @access  Private (Student)
const toggleTomorrowMeals = async (req, res, next) => {
  try {
    const student = req.user;
    if (student.role !== 'STUDENT') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Phase 10: Strict 10:00 PM Cutoff LOCK
    const now = new Date();
    if (now.getHours() >= 22) {
      return res.status(400).json({
        success: false,
        message: 'Mess Cut-Off Locked: You cannot modify tomorrow\'s meal plan after 10:00 PM.'
      });
    }

    const tomorrow = getNormalizedDate(1);

    // Block if tomorrow is already frozen
    const frozen = await DailyMealRecord.findOne({ studentId: student._id, date: tomorrow }).lean();
    if (frozen) {
      return res.status(400).json({ success: false, message: 'Mess Cut-Off Locked: Tomorrow\'s meal ledger has already been frozen.' });
    }

    const { meal } = req.body;
    let eligibility = await syncStudentMealEligibility(student._id, student.hostelId, tomorrow);

    if (!eligibility) {
      return res.status(400).json({ success: false, message: 'Could not sync meal plan.' });
    }

    if (eligibility.skippedByLeave) {
      return res.status(400).json({
        success: false,
        message: 'Meals are locked because you have an approved leave scheduled for tomorrow.'
      });
    }

    if (meal && ['breakfast', 'lunch', 'dinner'].includes(meal)) {
      eligibility[meal] = !eligibility[meal];
      const someSkipped = !eligibility.breakfast || !eligibility.lunch || !eligibility.dinner;
      eligibility.skippedManually = someSkipped;
    } else {
      const newSkipStatus = !eligibility.skippedManually;
      eligibility.skippedManually = newSkipStatus;
      eligibility.breakfast = !newSkipStatus;
      eligibility.lunch = !newSkipStatus;
      eligibility.dinner = !newSkipStatus;
    }

    await eligibility.save();

    res.status(200).json({
      success: true,
      message: 'Tomorrow\'s meal plan updated successfully.',
      eligibility
    });
  } catch (error) { next(error); }
};

// @desc    Warden/Admin override a frozen Daily Meal Record (Phase 7)
// @route   POST /api/mess/override-meals
// @access  Private (Warden/Admin)
const overrideDailyMealRecord = async (req, res, next) => {
  try {
    const { studentId, date, breakfastIncluded, lunchIncluded, dinnerIncluded, reason } = req.body;

    if (!studentId || !date || !reason || reason.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Validation Error: studentId, date, and descriptive override reason are required.' });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    let record = await DailyMealRecord.findOne({ studentId, date: targetDate });
    const studentObj = await User.findById(studentId).lean();

    if (!studentObj) return res.status(404).json({ success: false, message: 'Student not found.' });

    // Isolation check
    if (req.user.role === 'WARDEN' && studentObj.hostelId?.toString() !== req.user.hostelId?.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden: You cannot modify records from other hostels.' });
    }

    const overrideReason = req.user.role === 'ADMIN' ? 'ADMIN_OVERRIDE' : 'WARDEN_OVERRIDE';

    if (!record) {
      // Create a fresh frozen override record
      record = new DailyMealRecord({
        studentId,
        hostelId: studentObj.hostelId,
        roomId: studentObj.roomId,
        date: targetDate,
        breakfastIncluded: !!breakfastIncluded,
        lunchIncluded: !!lunchIncluded,
        dinnerIncluded: !!dinnerIncluded,
        breakfastReason: overrideReason,
        lunchReason: overrideReason,
        dinnerReason: overrideReason,
        manuallyModified: true,
        modifiedBy: req.user._id,
        modifiedAt: new Date(),
        finalized: true
      });
    } else {
      record.breakfastIncluded = breakfastIncluded !== undefined ? !!breakfastIncluded : record.breakfastIncluded;
      record.lunchIncluded = lunchIncluded !== undefined ? !!lunchIncluded : record.lunchIncluded;
      record.dinnerIncluded = dinnerIncluded !== undefined ? !!dinnerIncluded : record.dinnerIncluded;
      
      record.breakfastReason = overrideReason;
      record.lunchReason = overrideReason;
      record.dinnerReason = overrideReason;

      record.manuallyModified = true;
      record.modifiedBy = req.user._id;
      record.modifiedAt = new Date();
    }

    await record.save();

    // Log to audit trail
    await new FinancialAuditLog({
      actorId: req.user._id,
      actorRole: req.user.role,
      hostelId: studentObj.hostelId,
      actionType: 'ADJUSTMENT_APPLIED',
      reason: `Warden Override on ${date}: ${reason}`,
      newValue: record.toObject(),
      ipAddress: req.ip || req.headers['x-forwarded-for']
    }).save();

    res.status(200).json({ success: true, message: 'Frozen daily meal record updated successfully.', record });
  } catch (error) { next(error); }
};

// @desc    Get Tomorrow Kitchen Prep Counts (Phase 9 counts derived from frozen records)
// @route   GET /api/mess/tomorrow-counts
// @access  Private (Warden/Admin)
const getTomorrowCounts = async (req, res, next) => {
  try {
    const tomorrow = getNormalizedDate(1);
    
    // Auto-Trigger freeze first for tomorrow if not yet compiled, ensuring data safety!
    let frozenCount = await DailyMealRecord.countDocuments({ date: tomorrow });
    if (frozenCount === 0) {
      await freezeDailyMealsForDate(tomorrow);
    }

    let query = { date: tomorrow };
    if (req.user.role === 'WARDEN') {
      query.hostelId = req.user.hostelId;
    }

    const counts = await DailyMealRecord.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$hostelId',
          breakfastCount: { $sum: { $cond: ['$breakfastIncluded', 1, 0] } },
          lunchCount: { $sum: { $cond: ['$lunchIncluded', 1, 0] } },
          dinnerCount: { $sum: { $cond: ['$dinnerIncluded', 1, 0] } },
          skippedCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$breakfastReason', 'MANUAL_SKIP'] },
                    { $eq: ['$lunchReason', 'MANUAL_SKIP'] },
                    { $eq: ['$dinnerReason', 'MANUAL_SKIP'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          leaveCount: {
            $sum: {
              $cond: [
                { $eq: ['$breakfastReason', 'APPROVED_LEAVE'] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const populatedCounts = await Promise.all(counts.map(async (c) => {
      const hostel = await User.db.model('Hostel').findById(c._id).select('name hostelCode').lean();
      return {
        ...c,
        hostelName: hostel ? hostel.name : 'Unknown Hostel',
        hostelCode: hostel ? hostel.hostelCode : 'N/A'
      };
    }));

    res.status(200).json({
      success: true,
      date: tomorrow,
      counts: populatedCounts
    });
  } catch (error) { next(error); }
};

// @desc    Get dynamic/active fee configuration
// @route   GET/POST /api/mess/fee-config
// @access  Private (Admin only POST, Warden GET)
const handleFeeConfig = async (req, res, next) => {
  try {
    if (req.method === 'POST') {
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Forbidden: Only Administrators can set dynamic fee configs.' });
      }
      const { hostelRent, maintenanceFee, electricityFee, messMealRate, lateFineAmount, effectiveFrom } = req.body;
      const config = new FeeConfig({
        hostelRent,
        maintenanceFee,
        electricityFee,
        messMealRate,
        lateFineAmount,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        createdBy: req.user._id
      });
      await config.save();

      // Log to Financial Audit system
      await new FinancialAuditLog({
        actorId: req.user._id,
        actorRole: req.user.role,
        actionType: 'FEE_CONFIG_UPDATED',
        reason: 'Updated baseline configuration rates.',
        newValue: config.toObject(),
        ipAddress: req.ip || req.headers['x-forwarded-for']
      }).save();

      return res.status(201).json({ success: true, message: 'Fee configuration posted successfully.', config });
    }

    const config = await getActiveFeeConfig(new Date());
    res.status(200).json({
      success: true,
      config,
      isDefault: !!config._isDefault,
      message: config._isDefault
        ? 'Using system default rates. No custom fee configuration has been saved yet.'
        : undefined
    });
  } catch (error) { next(error); }
};

// @desc    Generate Draft Billing Cycle (Refactored to sum Frozen Ledger!)
// @route   POST /api/mess/billing-cycles
// @access  Private (Warden/Admin)
const createBillingCycleDraft = async (req, res, next) => {
  try {
    const { month } = req.body;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Invalid month. Format: YYYY-MM.' });
    }

    let cycle = await BillingCycle.findOne({ month });
    if (cycle) {
      return res.status(400).json({ success: false, message: `Billing cycle for ${month} already exists.` });
    }

    let studentQuery = { role: 'STUDENT', approvalStatus: 'APPROVED', isActive: true };
    if (req.user.role === 'WARDEN') {
      studentQuery.hostelId = req.user.hostelId;
    }
    const students = await User.find(studentQuery).populate('roomId').populate('hostelId').lean();

    cycle = new BillingCycle({
      month,
      status: 'DRAFT',
      generatedBy: req.user._id,
      notes: req.body.notes || `Draft billing run for ${month}`
    });
    await cycle.save();

    const [year, monthVal] = month.split('-').map(Number);
    const startDate = new Date(year, monthVal - 1, 1);
    const endDate = new Date(year, monthVal, 0);

    // Auto-Freeze any outstanding days for billing month to guarantee daily meal records coverage!
    const today = new Date();
    const freezeLimit = today < endDate ? today : endDate;
    for (let day = new Date(startDate); day <= freezeLimit; day.setDate(day.getDate() + 1)) {
      let count = await DailyMealRecord.countDocuments({ date: day });
      if (count === 0) {
        await freezeDailyMealsForDate(day);
      }
    }

    const feeConfig = await getActiveFeeConfig(endDate);
    let totalCycleAmount = 0;
    let studentCount = 0;

    for (const student of students) {
      if (!student.roomId) continue;

      const previousBalance = await getOutstandingBalance(student._id, startDate);

      // Phase 3 & 4: SUM Granular Frozen Meal Ledger!
      const dailyRecords = await DailyMealRecord.find({
        studentId: student._id,
        date: { $gte: startDate, $lte: endDate }
      }).lean();

      let totalBreakfasts = 0;
      let totalLunches = 0;
      let totalDinners = 0;

      dailyRecords.forEach(rec => {
        if (rec.breakfastIncluded) totalBreakfasts++;
        if (rec.lunchIncluded) totalLunches++;
        if (rec.dinnerIncluded) totalDinners++;
      });

      const totalMealsCount = totalBreakfasts + totalLunches + totalDinners;
      const messCharges = totalMealsCount * feeConfig.messMealRate;
      
      const invoiceAmount = messCharges + feeConfig.hostelRent + feeConfig.maintenanceFee + feeConfig.electricityFee + previousBalance;
      const dueDate = new Date(year, monthVal, 10);

      // Save complete immutable ERP snapshots
      const invoice = new Invoice({
        studentId: student._id,
        hostelId: student.hostelId?._id || student.hostelId,
        billingCycleId: cycle._id,
        month,
        status: 'PENDING',
        dueDate,
        studentSnapshot: {
          fullName: student.fullName,
          admissionNumber: student.admissionNumber,
          email: student.email,
          parentEmail: student.parentEmail,
          parentPhone: student.parentPhone
        },
        roomSnapshot: {
          roomNumber: student.roomId?.roomNumber || 'TBA',
          floor: student.roomId?.floor || 0
        },
        hostelSnapshot: {
          name: student.hostelId?.name || 'Smart Hostel',
          hostelCode: student.hostelId?.hostelCode || 'N/A'
        },
        messMealRate: feeConfig.messMealRate,
        eligibleMeals: dailyRecords.length * 3,
        skippedMeals: (dailyRecords.length * 3) - totalMealsCount,
        messCharges,
        
        // Phase 5: Frozen Granular Meal Snapshots
        totalBreakfasts,
        totalLunches,
        totalDinners,
        breakfastRateUsed: feeConfig.messMealRate,
        lunchRateUsed: feeConfig.messMealRate,
        dinnerRateUsed: feeConfig.messMealRate,
        messTotal: messCharges,

        hostelRent: feeConfig.hostelRent,
        maintenanceFee: feeConfig.maintenanceFee,
        electricityFee: feeConfig.electricityFee,
        previousBalance,
        totalAmount: invoiceAmount,
        paymentTimeline: [{
          event: 'Invoice Draft Compiled',
          details: `Granular mess calculations read from Daily Ledger: Breakfasts: ${totalBreakfasts}, Lunches: ${totalLunches}, Dinners: ${totalDinners}.`,
          actorId: req.user._id,
          actorRole: req.user.role
        }]
      });

      await invoice.save();
      totalCycleAmount += invoiceAmount;
      studentCount++;
    }

    cycle.totalStudents = studentCount;
    cycle.totalAmount = totalCycleAmount;
    await cycle.save();

    // Log to Audit trail
    await new FinancialAuditLog({
      actorId: req.user._id,
      actorRole: req.user.role,
      hostelId: req.user.hostelId,
      actionType: 'BILL_GENERATED',
      billingCycleId: cycle._id,
      reason: `Generated frozen-ledger draft billing run for ${month}`,
      newValue: { totalAmount: totalCycleAmount, totalStudents: studentCount },
      ipAddress: req.ip || req.headers['x-forwarded-for']
    }).save();

    res.status(201).json({
      success: true,
      message: `Draft billing cycle created for ${month} with ${studentCount} frozen-ledger invoices.`,
      cycle
    });
  } catch (error) { next(error); }
};

// @desc    Regenerate Draft Billing Cycle (Frozen Ledger Summing!)
// @route   POST /api/mess/billing-cycles/:id/regenerate
// @access  Private (Warden/Admin)
const regenerateBillingCycleDraft = async (req, res, next) => {
  try {
    const cycle = await BillingCycle.findById(req.params.id);
    if (!cycle) return res.status(404).json({ success: false, message: 'Billing cycle not found.' });
    if (cycle.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Only DRAFT billing cycles can be regenerated.' });
    }

    if (req.user.role === 'WARDEN' && cycle.generatedBy.toString() !== req.user._id.toString()) {
      const count = await Invoice.countDocuments({ billingCycleId: cycle._id, hostelId: req.user.hostelId });
      if (count === 0) {
        return res.status(403).json({ success: false, message: 'Forbidden: You cannot regenerate this cycle.' });
      }
    }

    let deleteQuery = { billingCycleId: cycle._id };
    let studentQuery = { role: 'STUDENT', approvalStatus: 'APPROVED', isActive: true };
    if (req.user.role === 'WARDEN') {
      deleteQuery.hostelId = req.user.hostelId;
      studentQuery.hostelId = req.user.hostelId;
    }
    await Invoice.deleteMany(deleteQuery);

    const students = await User.find(studentQuery).populate('roomId').populate('hostelId').lean();

    const [year, monthVal] = cycle.month.split('-').map(Number);
    const startDate = new Date(year, monthVal - 1, 1);
    const endDate = new Date(year, monthVal, 0);

    const feeConfig = await getActiveFeeConfig(endDate);
    let totalCycleAmount = 0;
    let studentCount = 0;

    for (const student of students) {
      if (!student.roomId) continue;

      const previousBalance = await getOutstandingBalance(student._id, startDate);

      const dailyRecords = await DailyMealRecord.find({
        studentId: student._id,
        date: { $gte: startDate, $lte: endDate }
      }).lean();

      let totalBreakfasts = 0;
      let totalLunches = 0;
      let totalDinners = 0;

      dailyRecords.forEach(rec => {
        if (rec.breakfastIncluded) totalBreakfasts++;
        if (rec.lunchIncluded) totalLunches++;
        if (rec.dinnerIncluded) totalDinners++;
      });

      const totalMealsCount = totalBreakfasts + totalLunches + totalDinners;
      const messCharges = totalMealsCount * feeConfig.messMealRate;
      const invoiceAmount = messCharges + feeConfig.hostelRent + feeConfig.maintenanceFee + feeConfig.electricityFee + previousBalance;
      const dueDate = new Date(year, monthVal, 10);

      const invoice = new Invoice({
        studentId: student._id,
        hostelId: student.hostelId?._id || student.hostelId,
        billingCycleId: cycle._id,
        month: cycle.month,
        status: 'PENDING',
        dueDate,
        studentSnapshot: {
          fullName: student.fullName,
          admissionNumber: student.admissionNumber,
          email: student.email,
          parentEmail: student.parentEmail,
          parentPhone: student.parentPhone
        },
        roomSnapshot: {
          roomNumber: student.roomId?.roomNumber || 'TBA',
          floor: student.roomId?.floor || 0
        },
        hostelSnapshot: {
          name: student.hostelId?.name || 'Smart Hostel',
          hostelCode: student.hostelId?.hostelCode || 'N/A'
        },
        messMealRate: feeConfig.messMealRate,
        eligibleMeals: dailyRecords.length * 3,
        skippedMeals: (dailyRecords.length * 3) - totalMealsCount,
        messCharges,

        totalBreakfasts,
        totalLunches,
        totalDinners,
        breakfastRateUsed: feeConfig.messMealRate,
        lunchRateUsed: feeConfig.messMealRate,
        dinnerRateUsed: feeConfig.messMealRate,
        messTotal: messCharges,

        hostelRent: feeConfig.hostelRent,
        maintenanceFee: feeConfig.maintenanceFee,
        electricityFee: feeConfig.electricityFee,
        previousBalance,
        totalAmount: invoiceAmount,
        paymentTimeline: [{
          event: 'Invoice Draft Recalculated',
          details: `Re-calculated from daily ledger: Breakfasts: ${totalBreakfasts}, Lunches: ${totalLunches}, Dinners: ${totalDinners}.`,
          actorId: req.user._id,
          actorRole: req.user.role
        }]
      });

      await invoice.save();
      totalCycleAmount += invoiceAmount;
      studentCount++;
    }

    if (req.user.role === 'ADMIN') {
      cycle.totalStudents = studentCount;
      cycle.totalAmount = totalCycleAmount;
    } else {
      const allInvoices = await Invoice.find({ billingCycleId: cycle._id }).select('totalAmount').lean();
      cycle.totalStudents = allInvoices.length;
      cycle.totalAmount = allInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    }
    cycle.generatedBy = req.user._id;
    await cycle.save();

    res.status(200).json({
      success: true,
      message: `Draft billing cycle successfully re-calculated and refreshed for ${cycle.month}.`,
      cycle
    });
  } catch (error) { next(error); }
};

// @desc    Finalize Billing Cycle (Admin Only)
// @route   POST /api/mess/billing-cycles/:id/finalize
// @access  Private (Admin Only)
const finalizeBillingCycle = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Only Administrators can finalize and lock monthly billing cycles.' });
    }

    const cycle = await BillingCycle.findById(req.params.id);
    if (!cycle) return res.status(404).json({ success: false, message: 'Billing cycle not found.' });
    if (cycle.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Billing cycle is already finalized or closed.' });
    }

    cycle.status = 'FINALIZED';
    cycle.finalizedBy = req.user._id;
    cycle.finalizedAt = new Date();
    await cycle.save();

    const invoicesToLock = await Invoice.find({ billingCycleId: cycle._id });
    for (const inv of invoicesToLock) {
      inv.finalizedAt = new Date();
      inv.paymentTimeline.push({
        event: 'Invoice Finalized',
        details: 'Invoice locked and frozen. Online payment channel opened.',
        actorId: req.user._id,
        actorRole: req.user.role
      });
      await inv.save();
    }

    // Log to Audit system
    await new FinancialAuditLog({
      actorId: req.user._id,
      actorRole: req.user.role,
      actionType: 'BILL_FINALIZED',
      billingCycleId: cycle._id,
      reason: `Permanently finalized monthly cycle for ${cycle.month}. Invoices locked.`,
      newValue: { status: 'FINALIZED', totalInvoices: invoicesToLock.length },
      ipAddress: req.ip || req.headers['x-forwarded-for']
    }).save();

    res.status(200).json({ success: true, message: 'Billing cycle finalized successfully. Payments are now open.', cycle });
  } catch (error) { next(error); }
};

// @desc    Get Billing Cycles List
// @route   GET /api/mess/billing-cycles
// @access  Private (Warden/Admin)
const getBillingCycles = async (req, res, next) => {
  try {
    const cycles = await BillingCycle.find().sort({ month: -1 }).lean();
    res.status(200).json({ success: true, cycles });
  } catch (error) { next(error); }
};

// @desc    Get Invoices inside a Billing Cycle for Review
// @route   GET /api/mess/billing-cycles/:id/invoices
// @access  Private (Warden/Admin)
const getCycleInvoices = async (req, res, next) => {
  try {
    let query = { billingCycleId: req.params.id };
    if (req.user.role === 'WARDEN') {
      query.hostelId = req.user.hostelId;
    }
    const invoices = await Invoice.find(query).sort({ 'studentSnapshot.fullName': 1 }).lean();
    res.status(200).json({ success: true, invoices });
  } catch (error) { next(error); }
};

// @desc    Edit Draft Invoice Adjustments
// @route   PUT /api/mess/invoices/:id
// @access  Private (Warden/Admin)
const updateInvoiceAdjustments = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    if (req.user.role === 'WARDEN' && invoice.hostelId.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden: You cannot modify invoices from other hostels.' });
    }

    const cycle = await BillingCycle.findById(invoice.billingCycleId).lean();
    if (cycle?.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Forbidden: Invoice is finalized. Post-finalization updates require Admin Correction Invoices.' });
    }

    const { discount, fine, adjustments, adjustmentNotes, reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Validation Error: A meaningful adjustmentReason is mandatory.' });
    }

    if (req.user.role === 'WARDEN') {
      const discVal = Number(discount || 0);
      const fineVal = Number(fine || 0);
      const adjVal = Number(adjustments || 0);
      if (Math.abs(discVal) > 500 || Math.abs(fineVal) > 500 || Math.abs(adjVal) > 500) {
        return res.status(403).json({
          success: false,
          message: 'Governance Limit Violation: Wardens are restricted to a maximum adjustment limit of ₹500.'
        });
      }
    }

    const prevValuesSnapshot = {
      discount: invoice.discount,
      fine: invoice.fine,
      adjustments: invoice.adjustments,
      adjustmentNotes: invoice.adjustmentNotes,
      totalAmount: invoice.totalAmount
    };

    if (discount !== undefined) invoice.discount = Number(discount);
    if (fine !== undefined) invoice.fine = Number(fine);
    if (adjustments !== undefined) invoice.adjustments = Number(adjustments);
    if (adjustmentNotes !== undefined) invoice.adjustmentNotes = adjustmentNotes;

    // Recalculate total amount cleanly
    invoice.totalAmount = (invoice.messCharges + invoice.hostelRent + invoice.maintenanceFee + invoice.electricityFee + invoice.previousBalance + invoice.fine + invoice.adjustments) - invoice.discount;

    invoice.paymentTimeline.push({
      event: 'Adjustment Applied',
      details: `Discount: -₹${invoice.discount}, Fine: +₹${invoice.fine}, Adjustments: +₹${invoice.adjustments}. Reason: ${reason}`,
      actorId: req.user._id,
      actorRole: req.user.role
    });

    await invoice.save();

    // Log to Audit Trail
    await new FinancialAuditLog({
      actorId: req.user._id,
      actorRole: req.user.role,
      hostelId: invoice.hostelId,
      actionType: 'ADJUSTMENT_APPLIED',
      invoiceId: invoice._id,
      previousValue: prevValuesSnapshot,
      newValue: {
        discount: invoice.discount,
        fine: invoice.fine,
        adjustments: invoice.adjustments,
        adjustmentNotes: invoice.adjustmentNotes,
        totalAmount: invoice.totalAmount
      },
      reason: reason,
      ipAddress: req.ip || req.headers['x-forwarded-for']
    }).save();

    res.status(200).json({ success: true, message: 'Draft adjustments saved successfully.', invoice });
  } catch (error) { next(error); }
};

// @desc    Get Student Detailed Frozen Daily Meal Ledger (Phase 8 transparency calendar!)
// @route   GET /api/mess/meal-ledger/:studentId
// @access  Private (Student/Parent/Warden/Admin)
const getStudentMealLedger = async (req, res, next) => {
  try {
    let studentId = req.params.studentId;

    if (req.user.role === 'PARENT') {
      const linked = req.user.linkedStudents || [];
      if (!linked.map(id => id.toString()).includes(studentId.toString())) {
        return res.status(403).json({ success: false, message: 'Access denied: Student not linked.' });
      }
    } else if (req.user.role === 'STUDENT') {
      studentId = req.user._id.toString();
    }

    const { start, end } = req.query; // optional range filters
    let query = { studentId };

    if (start && end) {
      query.date = { $gte: new Date(start), $lte: new Date(end) };
    }

    const records = await DailyMealRecord.find(query).sort({ date: -1 }).lean();
    res.status(200).json({ success: true, records });
  } catch (error) { next(error); }
};

// @desc    Get Mess Dues and Payments (Student & Parent Portal)
// @route   GET /api/mess/dues/:studentId
// @access  Private (Student/Parent/Warden/Admin)
const getMessDues = async (req, res, next) => {
  try {
    let studentId = req.params.studentId;

    if (req.user.role === 'PARENT') {
      const linked = req.user.linkedStudents || [];
      if (!linked.map(id => id.toString()).includes(studentId.toString())) {
        return res.status(403).json({ success: false, message: 'Access denied: Student not linked to your account.' });
      }
    } else if (req.user.role === 'STUDENT') {
      studentId = req.user._id.toString();
    }

    const today = new Date();
    const overdueInvoices = await Invoice.find({
      studentId,
      status: { $in: ['PENDING', 'PARTIAL'] },
      dueDate: { $lt: today },
      lateFineApplied: false
    });

    for (const inv of overdueInvoices) {
      const config = await getActiveFeeConfig(inv.dueDate);
      inv.fine = config.lateFineAmount;
      inv.status = 'OVERDUE';
      inv.totalAmount += config.lateFineAmount;
      inv.lateFineApplied = true;
      inv.lateFineAppliedAt = new Date();
      inv.paymentTimeline.push({
        event: 'Late Fine Applied',
        details: `Automatic overdue penalty fee of ₹${config.lateFineAmount} applied.`,
        actorRole: 'SYSTEM'
      });
      await inv.save();

      // Audit Log
      await new FinancialAuditLog({
        actorId: inv.studentId,
        actorRole: 'STUDENT',
        hostelId: inv.hostelId,
        actionType: 'LATE_FINE_APPLIED',
        invoiceId: inv._id,
        reason: 'Overdue deadline passed. Auto late fee applied.',
        newValue: { fine: inv.fine, status: 'OVERDUE' }
      }).save();
    }

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);

    const oldOutstandingInvoices = await Invoice.find({
      studentId,
      status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      finalizedAt: { $lt: twoMonthsAgo }
    }).lean();

    const currentTotalDues = await getOutstandingBalance(studentId, new Date());
    const isRiskFlagged = oldOutstandingInvoices.length > 0 || currentTotalDues > 10000;

    if (isRiskFlagged) {
      await Invoice.updateMany({ studentId, status: { $ne: 'PAID' } }, { financialHold: true });
    }

    const [invoices, messBills, hostelFees, payments] = await Promise.all([
      Invoice.find({ studentId }).sort({ month: -1 }).lean(),
      MessBill.find({ studentId }).sort({ month: -1 }).lean(),
      HostelFee.find({ studentId }).sort({ month: -1 }).lean(),
      Payment.find({ studentId, status: 'SUCCESS' }).sort({ paidAt: -1 }).lean()
    ]);

    res.status(200).json({
      success: true,
      invoices,
      messBills,
      hostelFees,
      payments,
      financialHold: isRiskFlagged
    });
  } catch (error) { next(error); }
};

// @desc    Initiate payment for an Invoice
// @route   POST /api/mess/pay-invoice
// @access  Private (Student/Parent)
const createInvoicePaymentOrder = async (req, res, next) => {
  try {
    const { invoiceId } = req.body;
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });
    if (invoice.status === 'PAID') return res.status(400).json({ success: false, message: 'This invoice is already fully paid.' });

    const cycle = await BillingCycle.findById(invoice.billingCycleId).lean();
    if (cycle && cycle.status === 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Draft invoices cannot be paid until billing cycle is finalized.' });
    }

    let studentId = invoice.studentId.toString();
    if (req.user.role === 'STUDENT' && req.user._id.toString() !== studentId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (req.user.role === 'PARENT' && !req.user.linkedStudents.includes(studentId)) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const orderAmount = invoice.totalAmount - invoice.amountPaid;
    const orderId = `order_${crypto.randomBytes(8).toString('hex')}`;

    let rpOrder;
    if (process.env.RAZORPAY_KEY_ID && Razorpay) {
      const instance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });

      rpOrder = await instance.orders.create({
        amount: orderAmount * 100,
        currency: 'INR',
        receipt: invoiceId.toString()
      });
    }

    const payment = new Payment({
      studentId,
      hostelId: invoice.hostelId,
      billType: 'COMBINED',
      invoiceId: invoice._id,
      amount: orderAmount,
      razorpayOrderId: rpOrder ? rpOrder.id : orderId,
      status: 'PENDING'
    });
    await payment.save();

    invoice.razorpayOrderId = rpOrder ? rpOrder.id : orderId;
    invoice.paymentTimeline.push({
      event: 'Payment Initiated',
      details: `Generated Order Reference: ${invoice.razorpayOrderId}`,
      actorId: req.user._id,
      actorRole: req.user.role
    });
    await invoice.save();

    res.status(200).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID || 'mock_key_id',
      amount: orderAmount * 100,
      currency: 'INR',
      orderId: rpOrder ? rpOrder.id : orderId,
      invoiceId: invoice._id,
      studentName: req.user.fullName,
      studentEmail: req.user.email
    });
  } catch (error) { next(error); }
};

// @desc    Verify Invoice Payment Signature
// @route   POST /api/mess/verify-invoice
// @access  Private (Student/Parent)
const verifyInvoicePayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) return res.status(404).json({ success: false, message: 'Transaction record not found.' });

    let verified = false;
    if (process.env.RAZORPAY_KEY_SECRET) {
      const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
      hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
      const generatedSignature = hmac.digest('hex');
      verified = generatedSignature === razorpay_signature;
    } else {
      verified = true; 
    }

    if (!verified) {
      payment.status = 'FAILED';
      await payment.save();
      return res.status(400).json({ success: false, message: 'Security Verification failed: Invalid signature.' });
    }

    payment.status = 'SUCCESS';
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.paidAt = new Date();
    payment.paymentMethod = 'Online Transfer Gateway';
    await payment.save();

    const invoice = await Invoice.findById(payment.invoiceId);
    if (invoice) {
      invoice.amountPaid += payment.amount;
      invoice.status = invoice.amountPaid >= invoice.totalAmount ? 'PAID' : 'PARTIAL';
      invoice.paidAt = new Date();
      invoice.paymentTimeline.push({
        event: 'Payment Received',
        details: `Successfully completed transaction. Payment Reference: ${razorpay_payment_id}`,
        actorId: req.user._id,
        actorRole: req.user.role
      });
      await invoice.save();
    }

    // Log to Audit Trail
    await new FinancialAuditLog({
      actorId: req.user._id,
      actorRole: req.user.role,
      hostelId: payment.hostelId,
      actionType: 'PAYMENT_VERIFIED',
      invoiceId: payment.invoiceId,
      reason: 'Secure online payment completed and verified.',
      newValue: { transactionId: razorpay_payment_id, status: 'SUCCESS' },
      ipAddress: req.ip || req.headers['x-forwarded-for']
    }).save();

    res.status(200).json({
      success: true,
      message: 'Payment verified and invoice updated successfully.',
      payment
    });
  } catch (error) { next(error); }
};

// @desc    Get detailed receipt for download/modal
// @route   GET /api/mess/receipts/:paymentId
// @access  Private (Student/Parent/Warden/Admin)
const getReceiptDetails = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.paymentId)
      .populate('studentId', 'fullName admissionNumber email parentEmail parentPhone department year')
      .populate('hostelId', 'name hostelCode')
      .populate('invoiceId')
      .lean();

    if (!payment) return res.status(404).json({ success: false, message: 'Receipt not found.' });

    if (req.user.role === 'WARDEN' && payment.hostelId?._id.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden: Access denied.' });
    }

    res.status(200).json({ success: true, receipt: payment });
  } catch (error) { next(error); }
};

// @desc    Get financial ledger
// @route   GET /api/mess/ledger
// @access  Private (Warden/Admin)
const getLedger = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'WARDEN') {
      query.hostelId = req.user.hostelId;
    }

    const [invoices, payments, auditLogs] = await Promise.all([
      Invoice.find(query).sort({ month: -1 }).lean(),
      Payment.find(query)
        .populate('studentId', 'fullName admissionNumber')
        .populate('hostelId', 'name')
        .populate('invoiceId', 'month status')
        .sort({ createdAt: -1 })
        .lean(),
      FinancialAuditLog.find(query).populate('actorId', 'fullName').sort({ createdAt: -1 }).limit(100).lean()
    ]);

    res.status(200).json({ 
      success: true, 
      invoices, 
      payments, 
      transactions: payments, 
      auditLogs 
    });
  } catch (error) { next(error); }
};

// @desc    Send Payment Reminders (Spam safety cooldowns)
// @route   POST /api/mess/send-reminder
// @access  Private (Warden/Admin)
const sendPaymentReminder = async (req, res, next) => {
  try {
    const { invoiceId, reason } = req.body;
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    if (req.user.role === 'WARDEN' && invoice.hostelId.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const cooldownPeriod = 24 * 60 * 60 * 1000;
    if (invoice.lastReminderSentAt && (new Date() - invoice.lastReminderSentAt < cooldownPeriod)) {
      return res.status(429).json({
        success: false,
        message: 'Spam Prevention Safeguard: An email reminder was already sent recently. Please wait 24 hours between notifications.'
      });
    }

    const outstanding = invoice.totalAmount - invoice.amountPaid;
    const reminderHtml = `
      <div style="font-family: Arial, sans-serif; padding: 25px; border: 2px solid #fbbf24; border-radius: 12px; background: #fffbeb;">
        <h2 style="color: #d97706; margin-top: 0;">⚠️ Smart Hostel Payment Reminder</h2>
        <p>Dear ${invoice.studentSnapshot.fullName},</p>
        <p>This is a formal reminder regarding your outstanding combined invoice for <strong>${invoice.month}</strong>.</p>
        <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #f59e0b; margin: 15px 0;">
          <p><strong>Total Outstanding:</strong> <span style="color: #dc2626; font-weight: bold;">₹${outstanding}</span></p>
        </div>
        <p>Kindly pay outstanding balances immediately through the Student or Parent Portal.</p>
      </div>
    `;

    await sendEmail({
      email: invoice.studentSnapshot.email,
      subject: `[Dues Reminder] Outstanding Invoice - ${invoice.month}`,
      html: reminderHtml
    });

    invoice.remindersCount += 1;
    invoice.lastReminderSentAt = new Date();
    invoice.paymentTimeline.push({
      event: 'Reminder Issued',
      details: `Payment reminder email sent successfully. reason: ${reason || 'Manual reminder'}`,
      actorId: req.user._id,
      actorRole: req.user.role
    });
    await invoice.save();

    await new FinancialAuditLog({
      actorId: req.user._id,
      actorRole: req.user.role,
      hostelId: invoice.hostelId,
      actionType: 'PAYMENT_REMINDER_SENT',
      invoiceId: invoice._id,
      reason: reason || 'Manual Payment Reminder',
      newValue: { remindersCount: invoice.remindersCount },
      ipAddress: req.ip || req.headers['x-forwarded-for']
    }).save();

    res.status(200).json({ success: true, message: 'Outstanding payment reminder sent successfully.' });
  } catch (error) { next(error); }
};

// @desc    Process Credit Refunds (Admin Only)
// @route   POST /api/mess/refund-invoice
// @access  Private (Admin Only)
const refundInvoice = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const { invoiceId, refundAmount, reason } = req.body;
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    if (Number(refundAmount) > invoice.amountPaid) {
      return res.status(400).json({ success: false, message: 'Refund amount cannot exceed amount already paid.' });
    }

    invoice.amountPaid -= Number(refundAmount);
    invoice.status = 'REFUNDED';
    invoice.paymentTimeline.push({
      event: 'Refund Issued',
      details: `Credit Refund processed: ₹${refundAmount}. reason: ${reason}`,
      actorId: req.user._id,
      actorRole: req.user.role
    });
    await invoice.save();

    res.status(200).json({ success: true, message: 'Credit refund processed successfully.', invoice });
  } catch (error) { next(error); }
};

// @desc    Export financial reports
// @route   GET /api/mess/export-report
// @access  Private (Warden/Admin)
const exportFinancialReport = async (req, res, next) => {
  try {
    const { reportType } = req.query;
    let query = {};
    if (req.user.role === 'WARDEN') {
      query.hostelId = req.user.hostelId;
    }

    if (reportType === 'UNPAID') {
      query.status = { $ne: 'PAID' };
    } else if (reportType === 'OVERDUE') {
      query.status = 'OVERDUE';
    } else if (reportType === 'COLLECTIONS') {
      query.amountPaid = { $gt: 0 };
    }

    const invoices = await Invoice.find(query).sort({ month: -1 }).lean();
    const reportData = invoices.map(inv => ({
      Month: inv.month,
      StudentName: inv.studentSnapshot?.fullName,
      AdmissionNo: inv.studentSnapshot?.admissionNumber,
      Breakfasts: inv.totalBreakfasts || 0,
      Lunches: inv.totalLunches || 0,
      Dinners: inv.totalDinners || 0,
      TotalPayable: inv.totalAmount,
      TotalPaid: inv.amountPaid,
      Outstanding: inv.totalAmount - inv.amountPaid,
      Status: inv.status
    }));

    res.status(200).json({ success: true, data: reportData });
  } catch (error) { next(error); }
};

module.exports = {
  getTomorrowMealStatus,
  toggleTomorrowMeals,
  getTomorrowCounts,
  getMessDues,
  handleFeeConfig,
  createBillingCycleDraft,
  regenerateBillingCycleDraft,
  finalizeBillingCycle,
  getBillingCycles,
  getCycleInvoices,
  updateInvoiceAdjustments,
  createInvoicePaymentOrder,
  verifyInvoicePayment,
  getLedger,
  getReceiptDetails,
  sendPaymentReminder,
  refundInvoice,
  exportFinancialReport,
  freezeMealsManual,
  overrideDailyMealRecord,
  getStudentMealLedger
};
