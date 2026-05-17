const AuditLog = require('../models/AuditLog');

// @desc    Get operational audit logs timeline
// @route   GET /api/audit-logs
// @access  Private (Main Admin only)
const getAuditLogs = async (req, res, next) => {
  try {
    // 1. Enforce strict Admin-only check
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden: Operational audit timeline is restricted to main administrators only.' });
    }

    const { 
      entityType, 
      severity, 
      hostelId, 
      actor, 
      search, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 20 
    } = req.query;

    // 2. Build the query criteria dynamic object
    const query = {};

    if (entityType) {
      query.entityType = entityType;
    }

    if (severity) {
      query.severity = severity;
    }

    if (hostelId) {
      query.hostelId = hostelId;
    }

    // Filter by actor name (regex search)
    if (actor) {
      query.actorName = { $regex: actor, $options: 'i' };
    }

    // Simple search across title or description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Enforce full day coverage
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // 3. Pagination limits and indices
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // 4. Run parallel query and count aggregation using compound indexes
    const [logs, totalCount] = await Promise.all([
      AuditLog.find(query)
        .populate('actorId', 'fullName email role')
        .populate('hostelId', 'name hostelCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      count: logs.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      logs
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs
};
