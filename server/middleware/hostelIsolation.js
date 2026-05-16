// Middleware to enforce hostel isolation
// When applied to a route, it checks if the request is trying to access/modify a specific hostel's data.
// - ADMIN can bypass this and access any hostel data.
// - WARDEN can only access data belonging to req.user.hostelId.

const hostelIsolation = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }

  // Admin has full access to all hostels
  if (req.user.role === 'ADMIN') {
    return next();
  }

  // If the user is a Warden, they must have a hostel assigned
  if (req.user.role === 'WARDEN') {
    if (!req.user.hostelId) {
      return res.status(403).json({ success: false, message: 'You are not assigned to any hostel.' });
    }

    // Determine the requested hostelId from params, body, or query
    const targetHostelId = req.params.hostelId || req.body.hostelId || req.query.hostelId;

    if (!targetHostelId) {
      // If no specific hostelId is provided in request, we can auto-attach the warden's hostelId 
      // so the downstream controller automatically filters by it.
      req.body.hostelId = req.user.hostelId;
      req.query.hostelId = req.user.hostelId;
      return next();
    }

    // If they explicitly asked for a hostel, ensure it matches theirs
    if (targetHostelId.toString() !== req.user.hostelId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Hostel Isolation Violation: You can only access data for your assigned hostel.' 
      });
    }

    return next();
  }

  // Students and Parents might have isolation logic later, but for now they can't manage hostels.
  return res.status(403).json({ success: false, message: 'Access denied' });
};

module.exports = hostelIsolation;
