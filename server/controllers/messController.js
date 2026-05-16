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
// CONTROLLER ACTIONS: MEALS & COUNTDOWNS
// ======================================================

const getTomorrowMealStatus = async (req, res, next) => {
  try {
    const student = req.user;
    if (student.role !== 'STUDENT') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const tomorrow = getNormalizedDate(1);
    const eligibility = await syncStudentMealEligibility(student._id, student.hostelId, tomorrow);

    res.status(200).json({
      success: true,
      date: tomorrow,
      eligibility
    });
  } catch (error) { next(error); }
};

const toggleTomorrowMeals = async (req, res, next) => {
  try {
    const student = req.user;
    if (student.role !== 'STUDENT') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const now = new Date();
    if (now.getHours() >= 22) {
      return res.status(400).json({
        success: false,
        message: 'Mess Cut-Off Locked: You cannot modify tomorrow\'s meal plan after 10:00 PM.'
      });
    }

    const { meal } = req.body;
    const tomorrow = getNormalizedDate(1);
    let eligibility = await syncStudentMealEligibility(student._id, student.hostelId, tomorrow);

    if (!eligibility) {
      return res.status(400).json({ success: false, message: 'Could not sync meal plan.' });
    }

    if (eligibility.skippedByLeave) {
      return res.status(400).json({
        success: false,
        message: 'Meals are locked as inactive because you have an approved leave scheduled for tomorrow.'
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

const getTomorrowCounts = async (req, res, next) => {
  try {
    const tomorrow = getNormalizedDate(1);
    let query = { date: tomorrow };

    if (req.user.role === 'WARDEN') {
      query.hostelId = req.user.hostelId;
      const students = await User.find({ hostelId: req.user.hostelId, approvalStatus: 'APPROVED' }).select('_id hostelId').lean();
      await Promise.all(students.map(s => syncStudentMealEligibility(s._id, s.hostelId, tomorrow)));
    } else if (req.user.role === 'ADMIN') {
      const students = await User.find({ approvalStatus: 'APPROVED' }).select('_id hostelId').lean();
      await Promise.all(students.map(s => syncStudentMealEligibility(s._id, s.hostelId, tomorrow)));
    }

    const counts = await MealEligibility.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$hostelId',
          breakfastCount: { $sum: { $cond: ['$breakfast', 1, 0] } },
          lunchCount: { $sum: { $cond: ['$lunch', 1, 0] } },
          dinnerCount: { $sum: { $cond: ['$dinner', 1, 0] } },
          skippedCount: { $sum: { $cond: ['$skippedManually', 1, 0] } },
          leaveCount: { $sum: { $cond: ['$skippedByLeave', 1, 0] } }
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

// ======================================================
// ERP FINANCIAL MANAGEMENT SYSTEM (NEW)
// ======================================================

// Helper: Get active Fee Config by date
const getActiveFeeConfig = async (date = new Date()) => {
  let config = await FeeConfig.findOne({ effectiveFrom: { $lte: date } }).sort({ effectiveFrom: -1 }).lean();
  if (!config) {
    config = {
      hostelRent: 3000,
      maintenanceFee: 500,
      electricityFee: 300,
      messMealRate: 50,
      lateFineAmount: 200
    };
  }
  return config;
};

// Helper: Calculate previous outstanding dues
const getOutstandingBalance = async (studentId, beforeDate = new Date()) => {
  const invoices = await Invoice.find({
    studentId,
    status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
    createdAt: { $lt: beforeDate }
  }).lean();

  let balance = 0;
  invoices.forEach(inv => {
    balance += (inv.totalAmount - inv.amountPaid);
  });
  return balance;
};

// @desc    Get/Create active fee config
// @route   GET/POST /api/mess/fee-config
// @access  Private (Admin only write, Warden can read)
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

    // GET latest configuration
    const config = await getActiveFeeConfig(new Date());
    res.status(200).json({ success: true, config });
  } catch (error) { next(error); }
};

// @desc    Generate Draft Billing Cycle
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

    let studentQuery = { role: 'STUDENT', approvalStatus: 'APPROVED' };
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
    const totalDays = endDate.getDate();

    const feeConfig = await getActiveFeeConfig(endDate);
    let totalCycleAmount = 0;
    let studentCount = 0;

    for (const student of students) {
      if (!student.roomId) continue;

      const previousBalance = await getOutstandingBalance(student._id, startDate);

      const eligibilities = await MealEligibility.find({
        studentId: student._id,
        date: { $gte: startDate, $lte: endDate }
      }).lean();

      let eligibleMeals = 0;
      let skippedMeals = 0;
      const recordedDays = eligibilities.length;
      const unrecordedDays = totalDays - recordedDays;

      eligibleMeals += unrecordedDays * 3;
      for (const el of eligibilities) {
        if (el.breakfast) eligibleMeals++; else skippedMeals++;
        if (el.lunch) eligibleMeals++; else skippedMeals++;
        if (el.dinner) eligibleMeals++; else skippedMeals++;
      }

      const messCharges = eligibleMeals * feeConfig.messMealRate;
      const invoiceAmount = messCharges + feeConfig.hostelRent + feeConfig.maintenanceFee + feeConfig.electricityFee + previousBalance;
      const dueDate = new Date(year, monthVal, 10);

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
        eligibleMeals,
        skippedMeals,
        messCharges,
        hostelRent: feeConfig.hostelRent,
        maintenanceFee: feeConfig.maintenanceFee,
        electricityFee: feeConfig.electricityFee,
        previousBalance,
        totalAmount: invoiceAmount,
        paymentTimeline: [{
          event: 'Invoice Draft Generated',
          details: 'Draft invoice compiled in monthly billing run cycle.',
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
      reason: `Generated draft billing run for ${month}`,
      newValue: { totalAmount: totalCycleAmount, totalStudents: studentCount },
      ipAddress: req.ip || req.headers['x-forwarded-for']
    }).save();

    res.status(201).json({
      success: true,
      message: `Draft billing cycle created for ${month} with ${studentCount} draft invoices.`,
      cycle
    });
  } catch (error) { next(error); }
};

// @desc    Regenerate Draft Billing Cycle
// @route   POST /api/mess/billing-cycles/:id/regenerate
// @access  Private (Warden/Admin)
const regenerateBillingCycleDraft = async (req, res, next) => {
  try {
    const cycle = await BillingCycle.findById(req.params.id);
    if (!cycle) return res.status(404).json({ success: false, message: 'Billing cycle not found.' });
    if (cycle.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Only DRAFT billing cycles can be regenerated.' });
    }

    // Restriction: Wardens can only regenerate their own hostel
    if (req.user.role === 'WARDEN' && cycle.generatedBy.toString() !== req.user._id.toString()) {
      // Allow regeneration if they belong to the same hostel scope
      const count = await Invoice.countDocuments({ billingCycleId: cycle._id, hostelId: req.user.hostelId });
      if (count === 0) {
        return res.status(403).json({ success: false, message: 'Forbidden: You cannot regenerate this cycle.' });
      }
    }

    // Delete existing draft invoices within user's scope
    let deleteQuery = { billingCycleId: cycle._id };
    let studentQuery = { role: 'STUDENT', approvalStatus: 'APPROVED' };
    if (req.user.role === 'WARDEN') {
      deleteQuery.hostelId = req.user.hostelId;
      studentQuery.hostelId = req.user.hostelId;
    }
    await Invoice.deleteMany(deleteQuery);

    const students = await User.find(studentQuery).populate('roomId').populate('hostelId').lean();

    const [year, monthVal] = cycle.month.split('-').map(Number);
    const startDate = new Date(year, monthVal - 1, 1);
    const endDate = new Date(year, monthVal, 0);
    const totalDays = endDate.getDate();

    const feeConfig = await getActiveFeeConfig(endDate);
    let totalCycleAmount = 0;
    let studentCount = 0;

    for (const student of students) {
      if (!student.roomId) continue;

      const previousBalance = await getOutstandingBalance(student._id, startDate);

      const eligibilities = await MealEligibility.find({
        studentId: student._id,
        date: { $gte: startDate, $lte: endDate }
      }).lean();

      let eligibleMeals = 0;
      let skippedMeals = 0;
      const recordedDays = eligibilities.length;
      const unrecordedDays = totalDays - recordedDays;

      eligibleMeals += unrecordedDays * 3;
      for (const el of eligibilities) {
        if (el.breakfast) eligibleMeals++; else skippedMeals++;
        if (el.lunch) eligibleMeals++; else skippedMeals++;
        if (el.dinner) eligibleMeals++; else skippedMeals++;
      }

      const messCharges = eligibleMeals * feeConfig.messMealRate;
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
        eligibleMeals,
        skippedMeals,
        messCharges,
        hostelRent: feeConfig.hostelRent,
        maintenanceFee: feeConfig.maintenanceFee,
        electricityFee: feeConfig.electricityFee,
        previousBalance,
        totalAmount: invoiceAmount,
        paymentTimeline: [{
          event: 'Invoice Draft Regenerated',
          details: 'Recalculated draft calculations successfully.',
          actorId: req.user._id,
          actorRole: req.user.role
        }]
      });

      await invoice.save();
      totalCycleAmount += invoiceAmount;
      studentCount++;
    }

    // Refresh totals for active scope
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

// @desc    Finalize Billing Cycle (Admin Only!)
// @route   POST /api/mess/billing-cycles/:id/finalize
// @access  Private (Admin Only)
const finalizeBillingCycle = async (req, res, next) => {
  try {
    // Phase 1 Restriction: Only Admin can finalize billing cycles
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

    // Seal and timestamp all draft invoices inside this cycle, pushing timeline
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

    // Notify students & parents asynchronously in the background
    invoicesToLock.forEach(inv => {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #4f46e5;">New Hostel Invoice Generated</h2>
          <p>Dear ${inv.studentSnapshot.fullName},</p>
          <p>Your monthly billing invoice for <strong>${inv.month}</strong> has been finalized and posted.</p>
          <table style="width: 100%; font-size: 0.9em; border-collapse: collapse; margin-top: 15px;">
            <tr style="background: #f9fafb;"><td style="padding: 8px;"><strong>Mess Charges</strong></td><td style="padding: 8px;">₹${inv.messCharges}</td></tr>
            <tr><td style="padding: 8px;"><strong>Hostel Rent</strong></td><td style="padding: 8px;">₹${inv.hostelRent}</td></tr>
            <tr style="background: #f9fafb;"><td style="padding: 8px;"><strong>Maintenance Fee</strong></td><td style="padding: 8px;">₹${inv.maintenanceFee}</td></tr>
            <tr><td style="padding: 8px;"><strong>Electricity Fee</strong></td><td style="padding: 8px;">₹${inv.electricityFee}</td></tr>
            <tr style="background: #f9fafb;"><td style="padding: 8px;"><strong>Previous Dues</strong></td><td style="padding: 8px;">₹${inv.previousBalance}</td></tr>
            <tr><td style="padding: 8px;"><strong>Discounts/Adjustments</strong></td><td style="padding: 8px;">-₹${inv.discount} / +₹${inv.adjustments}</td></tr>
            <tr style="background: #eef2ff; font-weight: bold;"><td style="padding: 8px;"><strong>Total Payable</strong></td><td style="padding: 8px; color: #4f46e5;">₹${inv.totalAmount}</td></tr>
          </table>
          <p style="margin-top: 15px;"><strong>Due Date:</strong> ${new Date(inv.dueDate).toLocaleDateString()}</p>
          <p>Please pay your invoice online via the Student or Parent Portal.</p>
        </div>
      `;

      sendEmail({
        email: inv.studentSnapshot.email,
        subject: `Smart Hostel Invoice - ${inv.month}`,
        html: emailHtml
      }).catch(e => console.error("Notification email failed for student", e));

      if (inv.studentSnapshot.parentEmail) {
        sendEmail({
          email: inv.studentSnapshot.parentEmail,
          subject: `Guardian Payment Notification: Invoice ${inv.month}`,
          html: emailHtml
        }).catch(e => console.error("Notification email failed for parent", e));
      }
    });

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

    // Isolation Check: Warden cannot edit cross-hostel invoices
    if (req.user.role === 'WARDEN' && invoice.hostelId.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden: You cannot modify invoices from other hostels.' });
    }

    // Phase 4: Immutable Finalized Invoices
    const cycle = await BillingCycle.findById(invoice.billingCycleId).lean();
    if (cycle?.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Forbidden: Invoice is finalized. Direct modifications are blocked. post-finalization updates require Admin Correction Invoices.' });
    }

    const { discount, fine, adjustments, adjustmentNotes, reason } = req.body;

    // Phase 3: Adjustment Governance
    // 1. Mandatory adjustmentReason check
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Validation Error: A meaningful adjustmentReason (at least 5 characters) is mandatory to log this action.' });
    }

    // 2. Max ₹500 limit check for Wardens
    if (req.user.role === 'WARDEN') {
      const discVal = Number(discount || 0);
      const fineVal = Number(fine || 0);
      const adjVal = Number(adjustments || 0);
      if (Math.abs(discVal) > 500 || Math.abs(fineVal) > 500 || Math.abs(adjVal) > 500) {
        return res.status(403).json({
          success: false,
          message: 'Governance Limit Violation: Wardens are restricted to a maximum adjustment limit of ₹500 per component. Adjustments exceeding this threshold require Admin authority.'
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

    // Recalculate immutable total draft amount securely
    invoice.totalAmount = (invoice.messCharges + invoice.hostelRent + invoice.maintenanceFee + invoice.electricityFee + invoice.previousBalance + invoice.fine + invoice.adjustments) - invoice.discount;

    // Push event to payment timeline
    invoice.paymentTimeline.push({
      event: 'Adjustment Applied',
      details: `Discount: -₹${invoice.discount}, Fine: +₹${invoice.fine}, Adjustments: +₹${invoice.adjustments}. Reason: ${reason}`,
      actorId: req.user._id,
      actorRole: req.user.role
    });

    await invoice.save();

    // Log to Audit Trail System
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

// @desc    Get Mess Dues and Payments (Student & Parent Portal)
// @route   GET /api/mess/dues/:studentId
// @access  Private (Student/Parent/Warden/Admin)
const getMessDues = async (req, res, next) => {
  try {
    let studentId = req.params.studentId;

    if (req.user.role === 'PARENT') {
      if (!req.user.linkedStudents.includes(studentId)) {
        return res.status(403).json({ success: false, message: 'Access denied: Student not linked to your parent account.' });
      }
    } else if (req.user.role === 'STUDENT') {
      studentId = req.user._id.toString();
    }

    // Process auto overdue & late fees on the fly for unfinalized/unpaid records securely
    // Phase 6 Check: Apply ONCE per overdue cycle, preventing duplication
    const today = new Date();
    const overdueInvoices = await Invoice.find({
      studentId,
      status: { $in: ['PENDING', 'PARTIAL'] },
      dueDate: { $lt: today },
      lateFineApplied: false // Only apply if not previously processed!
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

      // Audit Log for automatic action
      await new FinancialAuditLog({
        actorId: inv.studentId, // system context
        actorRole: 'STUDENT',
        hostelId: inv.hostelId,
        actionType: 'LATE_FINE_APPLIED',
        invoiceId: inv._id,
        reason: 'Overdue deadline passed. Auto late fee applied.',
        newValue: { fine: inv.fine, status: 'OVERDUE' }
      }).save();
    }

    // Phase 10: Financial Holds & Risk Flags
    // Set child hold warning if unpaid > 2 months or pending dues > ₹10,000
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
      // Mark active student records as hold warners
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
      messBills, // Retained for legacy compatibility
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

    // Validate billing cycle status
    const cycle = await BillingCycle.findById(invoice.billingCycleId).lean();
    if (cycle && cycle.status === 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Draft invoices cannot be paid until billing cycle is finalized.' });
    }

    let studentId = invoice.studentId.toString();
    if (req.user.role === 'STUDENT' && req.user._id.toString() !== studentId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (req.user.role === 'PARENT' && !req.user.linkedStudents.includes(studentId)) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Student is not linked.' });
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

      const invoice = await Invoice.findById(payment.invoiceId);
      if (invoice) {
        invoice.paymentTimeline.push({
          event: 'Payment Failed',
          details: 'Checkout authorization was declined or signature failed.',
          actorId: req.user._id,
          actorRole: req.user.role
        });
        await invoice.save();
      }

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

    const student = await User.findById(payment.studentId).lean();
    const receiptHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #10b981;">Smart Hostel Payment Receipt</h2>
        <p>Hi ${student.fullName},</p>
        <p>We have successfully received your payment of <strong>₹${payment.amount}</strong>.</p>
        <table style="width: 100%; font-size: 0.9em; border-collapse: collapse; margin-top: 15px;">
          <tr style="background: #f3f4f6;"><td style="padding: 8px;"><strong>Transaction ID</strong></td><td style="padding: 8px;">${razorpay_payment_id || 'N/A'}</td></tr>
          <tr><td style="padding: 8px;"><strong>Order ID</strong></td><td style="padding: 8px;">${razorpay_order_id}</td></tr>
          <tr style="background: #f3f4f6;"><td style="padding: 8px;"><strong>Payment Purpose</strong></td><td style="padding: 8px;">Hostel Combined Dues</td></tr>
          <tr><td style="padding: 8px;"><strong>Paid On</strong></td><td style="padding: 8px;">${new Date().toLocaleString()}</td></tr>
        </table>
        <p style="margin-top: 20px;">Thank you for your timely payment!</p>
      </div>
    `;

    sendEmail({
      email: student.email,
      subject: `Hostel Payment Receipt - ₹${payment.amount}`,
      html: receiptHtml
    }).catch(err => console.error('Receipt mail failed', err));

    if (student.parentEmail) {
      sendEmail({
        email: student.parentEmail,
        subject: `Payment Acknowledgment: Student ${student.fullName} - ₹${payment.amount}`,
        html: receiptHtml
      }).catch(err => console.error('Parent receipt mail failed', err));
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified and invoice updated successfully.',
      payment
    });
  } catch (error) { next(error); }
};

// @desc    Get financial ledger (Admin / Warden scope checked)
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
      Payment.find(query).populate('studentId', 'fullName admissionNumber').sort({ paidAt: -1 }).lean(),
      FinancialAuditLog.find(query).populate('actorId', 'fullName').sort({ createdAt: -1 }).limit(100).lean()
    ]);

    res.status(200).json({ success: true, invoices, payments, auditLogs });
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

    // Isolation check: Warden cannot read receipts from other hostels
    if (req.user.role === 'WARDEN' && payment.hostelId?._id.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden: You cannot access transaction receipts outside your hostel.' });
    }

    res.status(200).json({ success: true, receipt: payment });
  } catch (error) { next(error); }
};

// @desc    Send Payment Reminders (Phase 7 & 9)
// @route   POST /api/mess/send-reminder
// @access  Private (Warden/Admin)
const sendPaymentReminder = async (req, res, next) => {
  try {
    const { invoiceId, reason } = req.body;
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    // Isolation: Wardens can only remind their own hostel residents
    if (req.user.role === 'WARDEN' && invoice.hostelId.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only issue reminders to residents within your assigned hostel.' });
    }

    // Phase 9: Cooldown Prevention
    const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 Hours Cooldown
    if (invoice.lastReminderSentAt && (new Date() - invoice.lastReminderSentAt < cooldownPeriod)) {
      return res.status(429).json({
        success: false,
        message: 'Spam Prevention Safeguard: An email reminder was already sent to this resident recently. Please wait 24 hours between notifications.'
      });
    }

    const outstanding = invoice.totalAmount - invoice.amountPaid;
    const reminderHtml = `
      <div style="font-family: Arial, sans-serif; padding: 25px; border: 2px solid #fbbf24; border-radius: 12px; background: #fffbeb;">
        <h2 style="color: #d97706; margin-top: 0;">⚠️ Smart Hostel Payment Reminder</h2>
        <p>Dear ${invoice.studentSnapshot.fullName},</p>
        <p>This is a formal reminder regarding your outstanding hostel combined invoice for <strong>${invoice.month}</strong>.</p>
        <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #f59e0b; margin: 15px 0;">
          <h4 style="margin: 0 0 10px 0; color: #4b5563;">Dues Summary:</h4>
          <p style="margin: 4px 0;"><strong>Hostel Scope:</strong> ${invoice.hostelSnapshot?.name}</p>
          <p style="margin: 4px 0;"><strong>Total Outstanding Amount:</strong> <span style="color: #dc2626; font-weight: bold; font-size: 1.1em;">₹${outstanding}</span></p>
          <p style="margin: 4px 0;"><strong>Invoice Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
        </div>
        <p>Kindly pay outstanding balances immediately through the Student or Parent Portal online to restore eligibility and prevent administrative late penalties.</p>
        <span style="font-size: 0.8em; color: #9ca3af; display: block; margin-top: 15px;">Issued by Warden/Office Administration, ${invoice.hostelSnapshot?.name}</span>
      </div>
    `;

    // Dispatch Emails
    await sendEmail({
      email: invoice.studentSnapshot.email,
      subject: `[Dues Reminder] Outstanding Invoice - ${invoice.month}`,
      html: reminderHtml
    });

    if (invoice.studentSnapshot.parentEmail) {
      await sendEmail({
        email: invoice.studentSnapshot.parentEmail,
        subject: `[Guardian Warning] Outstanding Hostel Fees: ${invoice.studentSnapshot.fullName}`,
        html: reminderHtml
      });
    }

    // Save reminder status
    invoice.remindersCount += 1;
    invoice.lastReminderSentAt = new Date();
    invoice.paymentTimeline.push({
      event: 'Reminder Issued',
      details: `Payment reminder email sent successfully to student and parent. reason: ${reason || 'Manual reminder'}`,
      actorId: req.user._id,
      actorRole: req.user.role
    });
    await invoice.save();

    // Log to Audit system
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

// @desc    Process Refunds/Credit Notes (Admin Only!)
// @route   POST /api/mess/refund-invoice
// @access  Private (Admin Only)
const refundInvoice = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Only Administrators can authorize financial credit refunds.' });
    }

    const { invoiceId, refundAmount, reason } = req.body;
    if (!invoiceId || !refundAmount || Number(refundAmount) <= 0) {
      return res.status(400).json({ success: false, message: 'Validation Error: Please provide a valid invoiceId and numeric refundAmount.' });
    }
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Validation Error: A clear audit reason is required.' });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.' });

    const prevValues = {
      status: invoice.status,
      amountPaid: invoice.amountPaid,
      totalAmount: invoice.totalAmount
    };

    // Verify refund amount doesn't exceed total paid
    if (Number(refundAmount) > invoice.amountPaid) {
      return res.status(400).json({ success: false, message: `Rejection: Refund amount (₹${refundAmount}) cannot exceed the amount already paid (₹${invoice.amountPaid}).` });
    }

    // Apply Refund adjustments without directly mutating frozen totals
    invoice.amountPaid -= Number(refundAmount);
    invoice.status = 'REFUNDED';
    invoice.paymentTimeline.push({
      event: 'Refund Issued',
      details: `Credit Refund processed: ₹${refundAmount}. reason: ${reason}`,
      actorId: req.user._id,
      actorRole: req.user.role
    });
    await invoice.save();

    // Log to Audit system
    await new FinancialAuditLog({
      actorId: req.user._id,
      actorRole: req.user.role,
      hostelId: invoice.hostelId,
      actionType: 'REFUND_ISSUED',
      invoiceId: invoice._id,
      previousValue: prevValues,
      newValue: { status: 'REFUNDED', amountPaid: invoice.amountPaid },
      reason: reason,
      ipAddress: req.ip || req.headers['x-forwarded-for']
    }).save();

    res.status(200).json({ success: true, message: 'Credit refund processed successfully and logged.', invoice });
  } catch (error) { next(error); }
};

// @desc    Export structural CSV/PDF-ready reports (Phase 11)
// @route   GET /api/mess/export-report
// @access  Private (Warden/Admin)
const exportFinancialReport = async (req, res, next) => {
  try {
    const { reportType } = req.query; // 'UNPAID', 'COLLECTIONS', 'OVERDUE'
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

    const invoices = await Invoice.find(query)
      .sort({ month: -1, 'studentSnapshot.fullName': 1 })
      .lean();

    // Compile clean structural format
    const reportData = invoices.map(inv => ({
      Month: inv.month,
      StudentName: inv.studentSnapshot?.fullName,
      AdmissionNo: inv.studentSnapshot?.admissionNumber,
      Room: inv.roomSnapshot?.roomNumber || 'TBA',
      MessBase: inv.messCharges,
      HostelRent: inv.hostelRent,
      Fines: inv.fine,
      Adjustments: inv.adjustments,
      Discounts: inv.discount,
      TotalPayable: inv.totalAmount,
      TotalPaid: inv.amountPaid,
      Outstanding: inv.totalAmount - inv.amountPaid,
      Status: inv.status,
      DueDate: new Date(inv.dueDate).toLocaleDateString()
    }));

    res.status(200).json({ success: true, reportType, totalRecords: reportData.length, data: reportData });
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
  exportFinancialReport
};
