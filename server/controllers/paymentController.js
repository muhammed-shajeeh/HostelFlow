const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const FinancialAuditLog = require('../models/FinancialAuditLog');
const razorpayInstance = require('../config/razorpay');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { createAndEmitNotification, emitToRoom } = require('../utils/socket');

// @desc    Create a Razorpay order for an invoice (supports partial payments)
// @route   POST /api/payments/create-order
// @access  Private (Student/Parent)
const createOrder = async (req, res, next) => {
  try {
    const { invoiceId, amount } = req.body;

    if (!invoiceId || !amount) {
      return res.status(400).json({ success: false, message: 'invoiceId and payment amount are required.' });
    }

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be a positive number.' });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    // Check payment validity
    if (invoice.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'This invoice is already fully paid.' });
    }
    if (invoice.status === 'REFUNDED') {
      return res.status(400).json({ success: false, message: 'Refunding has been finalized for this invoice; no more payments allowed.' });
    }

    // Prevent overpayment
    const outstanding = invoice.totalAmount - invoice.amountPaid;
    if (payAmount > outstanding) {
      return res.status(400).json({
        success: false,
        message: `Overpayment blocked. The remaining balance is ₹${outstanding.toFixed(2)}, but you requested ₹${payAmount.toFixed(2)}.`
      });
    }

    // Role-based security checks
    let studentId = invoice.studentId.toString();
    if (req.user.role === 'STUDENT' && req.user._id.toString() !== studentId) {
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only pay your own invoices.' });
    }
    if (req.user.role === 'PARENT') {
      const linked = req.user.linkedStudents || [];
      if (!linked.map(id => id.toString()).includes(studentId)) {
        return res.status(403).json({ success: false, message: 'Unauthorized: You can only pay linked child invoices.' });
      }
    }
    if (req.user.role === 'WARDEN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Wardens are restricted from completing payments.' });
    }

    // Generate Order ID (Use real Razorpay SDK order creation if credentials exist, else mock fallback)
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    let orderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    let rpOrder = null;

    if (razorpayKeyId && razorpayKeyId !== 'mock_key_id' && razorpayKeySecret && razorpayKeySecret !== 'mock_key_secret') {
      try {
        rpOrder = await razorpayInstance.orders.create({
          amount: Math.round(payAmount * 100), // Razorpay accepts in Paise
          currency: 'INR',
          receipt: invoiceId.toString()
        });
        orderId = rpOrder.id;
      } catch (err) {
        console.error('[Razorpay Order Creation Failed]', err);
        return res.status(500).json({ success: false, message: 'Razorpay order creation failed. Please try again.' });
      }
    }

    // Create pending payment record
    const payment = new Payment({
      studentId: invoice.studentId,
      hostelId: invoice.hostelId,
      billType: 'COMBINED',
      invoiceId: invoice._id,
      amount: payAmount,
      razorpayOrderId: orderId,
      status: 'PENDING'
    });
    await payment.save();

    // Link Razorpay Order ID on invoice and track timeline
    invoice.razorpayOrderId = orderId;
    invoice.paymentTimeline.push({
      event: 'Payment Initiated',
      details: `Generated Order Reference: ${orderId} for ₹${payAmount.toFixed(2)}`,
      actorId: req.user._id,
      actorRole: req.user.role
    });
    await invoice.save();

    res.status(200).json({
      success: true,
      keyId: razorpayKeyId || 'mock_key_id',
      amount: Math.round(payAmount * 100),
      currency: 'INR',
      orderId,
      invoiceId: invoice._id,
      studentName: invoice.studentSnapshot?.fullName || req.user.fullName,
      studentEmail: invoice.studentSnapshot?.email || req.user.email,
      invoiceSnapshot: {
        month: invoice.month,
        outstandingBalance: outstanding
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Razorpay secure checkout response
// @route   POST /api/payments/verify
// @access  Private (Student/Parent)
const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.'
      });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Transaction record not found.' });
    }

    // Prevent duplicate validation / replay attacks
    if (payment.status === 'SUCCESS') {
      return res.status(200).json({
        success: true,
        message: 'This payment has already been verified successfully.',
        payment
      });
    }

    let verified = false;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (razorpayKeySecret && razorpayKeySecret !== 'mock_key_secret') {
      const hmac = crypto.createHmac('sha256', razorpayKeySecret);
      hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      const generatedSignature = hmac.digest('hex');
      verified = generatedSignature === razorpay_signature;
    } else {
      // Dev / Mock verification fallback
      verified = razorpay_payment_id.startsWith('pay_');
    }

    if (!verified) {
      payment.status = 'FAILED';
      await payment.save();

      // Log FAILED audit entry
      await new FinancialAuditLog({
        actorId: req.user._id,
        actorRole: req.user.role,
        hostelId: payment.hostelId,
        actionType: 'PAYMENT_VERIFIED',
        invoiceId: payment.invoiceId,
        reason: 'Signature verification mismatch.',
        newValue: { status: 'FAILED' }
      }).save();

      return res.status(400).json({ success: false, message: 'Cryptographic Signature Verification failed.' });
    }

    // Success! Update payment ledger
    payment.status = 'SUCCESS';
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.paidAt = new Date();
    payment.paymentMethod = 'Online Transfer Gateway';
    await payment.save();

    // Update invoice outstanding values
    const invoice = await Invoice.findById(payment.invoiceId);
    if (invoice) {
      invoice.amountPaid += payment.amount;
      // If fully paid, change status to PAID, else mark it PARTIAL
      invoice.status = invoice.amountPaid >= invoice.totalAmount ? 'PAID' : 'PARTIAL';
      if (invoice.status === 'PAID') {
        invoice.paidAt = new Date();
      }
      
      invoice.paymentTimeline.push({
        event: invoice.status === 'PAID' ? 'Final Payment Received' : 'Partial Payment Received',
        details: `Online transfer cleared: ₹${payment.amount.toFixed(2)}. Gateway ID: ${razorpay_payment_id}`,
        actorId: req.user._id,
        actorRole: req.user.role
      });
      await invoice.save();
    }

    // Create persistent Audit Log entry
    await new FinancialAuditLog({
      actorId: req.user._id,
      actorRole: req.user.role,
      hostelId: payment.hostelId,
      actionType: 'PAYMENT_VERIFIED',
      invoiceId: payment.invoiceId,
      reason: `Secure signature verification passed. Cleared ₹${payment.amount.toFixed(2)}.`,
      newValue: { transactionId: razorpay_payment_id, status: 'SUCCESS' },
      ipAddress: req.ip || req.headers['x-forwarded-for']
    }).save();

    // Centrally log the operational audit timeline event
    const { logAudit } = require('../utils/auditLogger');
    await logAudit({
      req,
      actionType: 'PAYMENT_VERIFIED',
      entityType: 'PAYMENT',
      entityId: payment._id,
      title: 'Payment Verified',
      description: `Payment of ₹${payment.amount.toFixed(2)} verified successfully for invoice #${invoice?.invoiceCode || invoice?._id}`,
      severity: 'IMPORTANT',
      hostelId: payment.hostelId
    });

    // Trigger Real-Time Notification Alerts
    await createAndEmitNotification({
      recipientId: payment.studentId,
      title: 'Payment Successful',
      message: `Your payment of ₹${payment.amount.toFixed(2)} was verified successfully.`,
      type: 'PAYMENT_SUCCESSFUL',
      actionUrl: '/student/billing',
      hostelId: payment.hostelId
    });

    const parents = await mongoose.model('User').find({ role: 'PARENT', students: payment.studentId }).select('_id').lean();
    for (const parent of parents) {
      await createAndEmitNotification({
        recipientId: parent._id,
        title: 'Child Fee Payment Confirmed',
        message: `A payment of ₹${payment.amount.toFixed(2)} has been processed for your child's combined dues.`,
        type: 'PAYMENT_SUCCESSFUL',
        actionUrl: '/parent/dashboard',
        hostelId: payment.hostelId
      });
    }

    emitToRoom(`HOSTEL_${payment.hostelId}`, 'REFRESH_DASHBOARD', { type: 'PAYMENT_SUCCESSFUL' });
    emitToRoom('ADMIN_GLOBAL', 'REFRESH_DASHBOARD', { type: 'PAYMENT_SUCCESSFUL' });

    res.status(200).json({
      success: true,
      message: invoice?.status === 'PAID' ? 'Payment fully processed and invoice completed!' : 'Partial payment recorded successfully!',
      payment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Process manual Credit Refunds (Admin Only)
// @route   POST /api/payments/refund
// @access  Private (Admin Only)
const issueRefund = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied: Administrators only.' });
    }

    const { invoiceId, refundAmount, reason } = req.body;

    if (!invoiceId || !refundAmount || !reason || reason.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Validation error: invoiceId, refundAmount, and a descriptive reason are required.' });
    }

    const refVal = Number(refundAmount);
    if (isNaN(refVal) || refVal <= 0) {
      return res.status(400).json({ success: false, message: 'Refund amount must be a positive value.' });
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (refVal > invoice.amountPaid) {
      return res.status(400).json({
        success: false,
        message: `Refund exceeds collections. Total paid is ₹${invoice.amountPaid.toFixed(2)}, but refund requested is ₹${refVal.toFixed(2)}.`
      });
    }

    const oldAmountPaid = invoice.amountPaid;
    invoice.amountPaid -= refVal;
    
    // Update invoice status
    invoice.status = invoice.amountPaid <= 0 ? 'REFUNDED' : 'PARTIAL';
    invoice.paymentTimeline.push({
      event: 'Refund Processed',
      details: `Credit Refund: -₹${refVal.toFixed(2)}. Reason: ${reason}`,
      actorId: req.user._id,
      actorRole: req.user.role
    });
    await invoice.save();

    // Create a new REFUNDED record inside payments for ledger logs
    const refundPayment = new Payment({
      studentId: invoice.studentId,
      hostelId: invoice.hostelId,
      billType: 'COMBINED',
      invoiceId: invoice._id,
      amount: -refVal, // negative represents refund
      razorpayOrderId: `refund_order_${crypto.randomBytes(6).toString('hex')}`,
      razorpayPaymentId: `ref_${crypto.randomBytes(8).toString('hex')}`,
      status: 'SUCCESS', // Already successful since processed manually
      paymentMethod: 'Warden/Admin Cashier Refund',
      paidAt: new Date()
    });
    await refundPayment.save();

    // Create persistable Financial Audit Entry
    await new FinancialAuditLog({
      actorId: req.user._id,
      actorRole: req.user.role,
      hostelId: invoice.hostelId,
      actionType: 'REFUND_ISSUED',
      invoiceId: invoice._id,
      previousValue: { amountPaid: oldAmountPaid },
      newValue: { amountPaid: invoice.amountPaid, status: invoice.status },
      reason: reason,
      ipAddress: req.ip || req.headers['x-forwarded-for']
    }).save();

    // Centrally log the operational audit timeline event
    const { logAudit } = require('../utils/auditLogger');
    await logAudit({
      req,
      actionType: 'REFUND_ISSUED',
      entityType: 'PAYMENT',
      entityId: refundPayment._id,
      title: 'Refund Issued',
      description: `Manual cashier refund of ₹${refVal.toFixed(2)} processed for invoice #${invoice?.invoiceCode || invoice?._id}. Reason: ${reason}`,
      severity: 'WARNING',
      hostelId: invoice.hostelId
    });

    res.status(200).json({
      success: true,
      message: `Successfully processed a refund of ₹${refVal.toFixed(2)}. Invoice ledger is synchronized.`,
      invoice
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin & Warden payment transaction analytics
// @route   GET /api/payments/analytics
// @access  Private (Admin/Warden)
const getAdminPaymentAnalytics = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'WARDEN') {
      query.hostelId = req.user.hostelId;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Calculate aggregated metrics
    const [totalSuccessPayments, todaySuccessPayments, failedCount, overdueSuccessPayments] = await Promise.all([
      // 1. Total Collections
      Payment.find({ ...query, status: 'SUCCESS' }).select('amount').lean(),
      // 2. Today's Collections
      Payment.find({
        ...query,
        status: 'SUCCESS',
        paidAt: { $gte: startOfToday }
      }).select('amount').lean(),
      // 3. Failed Count
      Payment.countDocuments({ ...query, status: 'FAILED' }),
      // 4. Overdue recovery payments
      Payment.find({ ...query, status: 'SUCCESS' })
        .populate('invoiceId', 'status')
        .lean()
    ]);

    const totalCollections = totalSuccessPayments.reduce((sum, p) => sum + p.amount, 0);
    const todayCollections = todaySuccessPayments.reduce((sum, p) => sum + p.amount, 0);

    // Calculate overdue recovery (amount paid on invoices marked OVERDUE)
    const overdueRecovery = overdueSuccessPayments
      .filter(p => p.invoiceId && p.invoiceId.status === 'OVERDUE')
      .reduce((sum, p) => sum + p.amount, 0);

    // 5. Hostel-wise revenue aggregation
    let hostelRevenue = [];
    if (req.user.role === 'ADMIN') {
      const aggregates = await Payment.aggregate([
        { $match: { status: 'SUCCESS' } },
        {
          $group: {
            _id: '$hostelId',
            totalCollected: { $sum: '$amount' }
          }
        }
      ]);

      hostelRevenue = await Promise.all(aggregates.map(async (agg) => {
        const hostelId = agg._id;
        const hostel = await mongoose.model('Hostel').findById(hostelId).select('name hostelCode').lean();
        
        // Count active residents in this hostel
        const activeResidents = await mongoose.model('User').countDocuments({
          role: 'STUDENT',
          hostelId: hostelId
        });

        // Sum outstanding invoices balance in this hostel
        const invoices = await Invoice.find({ hostelId: hostelId }).select('totalAmount amountPaid').lean();
        const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.totalAmount - inv.amountPaid), 0);

        return {
          hostelId: hostelId,
          hostelName: hostel ? hostel.name : 'Unspecified',
          hostelCode: hostel ? hostel.hostelCode : 'N/A',
          totalCollected: agg.totalCollected,
          activeResidents,
          totalOutstanding
        };
      }));
    } else {
      // Wardens see only their own hostel
      const hostelId = req.user.hostelId;
      const hostel = await mongoose.model('Hostel').findById(hostelId).select('name hostelCode').lean();
      
      const activeResidents = await mongoose.model('User').countDocuments({
        role: 'STUDENT',
        hostelId: hostelId
      });

      const invoices = await Invoice.find({ hostelId: hostelId }).select('totalAmount amountPaid').lean();
      const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.totalAmount - inv.amountPaid), 0);

      hostelRevenue = [{
        hostelId: hostelId,
        hostelName: hostel ? hostel.name : 'Your Hostel',
        hostelCode: hostel ? hostel.hostelCode : 'N/A',
        totalCollected: totalCollections,
        activeResidents,
        totalOutstanding
      }];
    }

    // 6. Fetch all recent payments populated for display (success, failed, partial, refunds)
    const recentPayments = await Payment.find(query)
      .populate('studentId', 'fullName admissionNumber')
      .populate('hostelId', 'name')
      .populate('invoiceId', 'month status')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      analytics: {
        totalCollections,
        todayCollections,
        failedPaymentsCount: failedCount,
        overdueRecovery,
        hostelRevenue,
        hostelCollections: hostelRevenue,
        recentPayments,
        transactions: recentPayments
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Razorpay Webhook for Asynchronous Payment Reconciliation
// @route   POST /api/payments/webhook
// @access  Public
const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const shasum = crypto.createHmac('sha256', webhookSecret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest('hex');

      if (digest !== signature) {
        console.warn('[Razorpay Webhook Signature Mismatch]');
        return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === 'payment.captured') {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (payment && payment.status !== 'SUCCESS') {
        payment.status = 'SUCCESS';
        payment.razorpayPaymentId = paymentId;
        payment.paidAt = new Date();
        payment.paymentMethod = paymentEntity.method || 'Webhook Reconciled';
        await payment.save();

        const invoice = await Invoice.findById(payment.invoiceId);
        if (invoice) {
          invoice.amountPaid += payment.amount;
          invoice.status = invoice.amountPaid >= invoice.totalAmount ? 'PAID' : 'PARTIAL';
          if (invoice.status === 'PAID') {
            invoice.paidAt = new Date();
          }
          invoice.paymentTimeline.push({
            event: 'Reconciled via Webhook',
            details: `Asynchronous gateway capture cleared: ₹${payment.amount.toFixed(2)}. ID: ${paymentId}`,
            actorRole: 'SYSTEM'
          });
          await invoice.save();
        }

        // Log persistent system audit
        await new FinancialAuditLog({
          actorRole: 'SYSTEM',
          hostelId: payment.hostelId,
          actionType: 'PAYMENT_VERIFIED',
          invoiceId: payment.invoiceId,
          reason: `Asynchronous reconciliation verified for Order: ${orderId}.`,
          newValue: { transactionId: paymentId, status: 'SUCCESS' }
        }).save();

        // Centrally log the operational audit timeline event
        const { logAudit } = require('../utils/auditLogger');
        await logAudit({
          actionType: 'PAYMENT_VERIFIED',
          entityType: 'PAYMENT',
          entityId: payment._id,
          title: 'Payment Reconciled (Webhook)',
          description: `Asynchronous payment capture of ₹${payment.amount.toFixed(2)} verified successfully for order ${orderId}`,
          severity: 'IMPORTANT',
          hostelId: payment.hostelId
        });

        // Trigger Real-Time webhook notification reconciled events
        await createAndEmitNotification({
          recipientId: payment.studentId,
          title: 'Payment Confirmed',
          message: `Your payment of ₹${payment.amount.toFixed(2)} was asynchronously reconciled.`,
          type: 'PAYMENT_SUCCESSFUL',
          actionUrl: '/student/billing',
          hostelId: payment.hostelId
        });

        const parents = await mongoose.model('User').find({ role: 'PARENT', students: payment.studentId }).select('_id').lean();
        for (const parent of parents) {
          await createAndEmitNotification({
            recipientId: parent._id,
            title: 'Child Fee Payment Reconciled',
            message: `A payment of ₹${payment.amount.toFixed(2)} was verified via gateway reconciliation.`,
            type: 'PAYMENT_SUCCESSFUL',
            actionUrl: '/parent/dashboard',
            hostelId: payment.hostelId
          });
        }

        emitToRoom(`HOSTEL_${payment.hostelId}`, 'REFRESH_DASHBOARD', { type: 'PAYMENT_SUCCESSFUL' });
        emitToRoom('ADMIN_GLOBAL', 'REFRESH_DASHBOARD', { type: 'PAYMENT_SUCCESSFUL' });
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;

      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (payment && payment.status === 'PENDING') {
        payment.status = 'FAILED';
        await payment.save();
      }
    }

    // Acknowledge receipt back to Razorpay
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  issueRefund,
  getAdminPaymentAnalytics,
  handleWebhook
};
