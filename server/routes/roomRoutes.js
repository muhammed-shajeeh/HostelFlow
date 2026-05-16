const express = require('express');
const { check } = require('express-validator');
const { 
  createRoom, getHostelRooms, getSingleRoom, updateRoom, deleteRoom, getAvailableRooms 
} = require('../controllers/roomController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const hostelIsolation = require('../middleware/hostelIsolation');

const router = express.Router();

router.use(authMiddleware);
// Only ADMIN and WARDEN can access room management
router.use(roleMiddleware('ADMIN', 'WARDEN'));

// Validation rules
const roomValidation = [
  check('hostelId', 'Hostel ID is required').isMongoId(),
  check('roomNumber', 'Room number is required').notEmpty(),
  check('floor', 'Floor must be a number greater than 0').isInt({ min: 1 }),
  check('capacity', 'Capacity must be between 1 and 10').isInt({ min: 1, max: 10 }),
  check('roomType', 'Invalid room type').isIn(['SINGLE', 'DOUBLE', 'TRIPLE', 'DORMITORY']),
  check('gender', 'Gender must be BOYS, GIRLS, or MIXED').isIn(['BOYS', 'GIRLS', 'MIXED'])
];

router.post('/', hostelIsolation, roomValidation, createRoom);
router.get('/hostel/:hostelId', hostelIsolation, getHostelRooms);
router.get('/available/:hostelId', hostelIsolation, getAvailableRooms);

// For /:id routes, hostelIsolation won't catch hostelId from params directly unless passed, 
// but we handle it inside the controller logic explicitly.
router.get('/:id', getSingleRoom);
router.put('/:id', updateRoom);
router.delete('/:id', deleteRoom);

module.exports = router;
