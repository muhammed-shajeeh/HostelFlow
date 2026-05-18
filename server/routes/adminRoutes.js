const express = require('express');
const { check } = require('express-validator');
const { 
  createWarden, getAdminDashboard, getWardensList, updateWarden, deleteWarden, reactivateWarden,
  searchStudentsForTransfer, transferStudent 
} = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// All routes require authentication and ADMIN role
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

router.get('/dashboard', getAdminDashboard);
router.get('/wardens', getWardensList);
router.put('/wardens/:id', updateWarden);
router.delete('/wardens/:id', deleteWarden);
router.post('/wardens/:id/reactivate', reactivateWarden);

// Student transfer management routes
router.get('/students/search', searchStudentsForTransfer);
router.post('/students/:id/transfer', [
  check('newHostelId', 'New Hostel ID is required').isMongoId(),
  check('newRoomId', 'New Room ID is required').isMongoId(),
  check('newBedNumber', 'New Bed Number must be a positive integer').isInt({ min: 1 })
], transferStudent);

router.post('/create-warden',
  [
    check('fullName', 'Full name is required').notEmpty(),
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('hostelId', 'Hostel ID is required').isMongoId()
  ],
  createWarden
);

module.exports = router;
