const express = require('express');
const { check } = require('express-validator');
const { 
  registerStudent, approveStudent, rejectStudent, changeRoom, 
  getStudents, getPendingStudents, getSingleStudent 
} = require('../controllers/studentController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// Public route for registration
router.post('/register', 
  [
    check('fullName', 'Full name is required').notEmpty(),
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('password', 'Password must be 6 or more characters').isLength({ min: 6 }),
    check('admissionNumber', 'Admission number is required').notEmpty(),
    check('hostelId', 'Hostel selection is required').isMongoId()
  ],
  registerStudent
);

// Protected routes
router.use(authMiddleware);

// Only ADMIN and WARDEN can manage students
router.use(roleMiddleware('ADMIN', 'WARDEN'));

router.get('/', getStudents);
router.get('/pending', getPendingStudents);
router.get('/:id', getSingleStudent);

router.post('/:id/approve', approveStudent);
router.post('/:id/reject', rejectStudent);
router.post('/:id/change-room', 
  [
    check('newRoomId', 'New Room ID is required').isMongoId()
  ],
  changeRoom
);

module.exports = router;
