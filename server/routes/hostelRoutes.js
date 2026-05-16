const express = require('express');
const { check } = require('express-validator');
const { createHostel, getAllHostels, getSingleHostel, updateHostel, deleteHostel } = require('../controllers/hostelController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Only Admin can create, update, delete
router.post('/', 
  roleMiddleware('ADMIN'),
  [
    check('name', 'Hostel name is required').notEmpty(),
    check('hostelCode', 'Hostel code is required').notEmpty(),
    check('gender', 'Gender must be BOYS, GIRLS, or MIXED').isIn(['BOYS', 'GIRLS', 'MIXED']),
    check('totalFloors', 'Total floors must be a number greater than 0').isInt({ min: 1 })
  ],
  createHostel
);

router.get('/', getAllHostels);
router.get('/:id', getSingleHostel);

router.put('/:id', 
  roleMiddleware('ADMIN'),
  [
    check('name', 'Hostel name must be provided if passed').optional().notEmpty(),
    check('totalFloors', 'Total floors must be a number greater than 0').optional().isInt({ min: 1 })
  ],
  updateHostel
);

router.delete('/:id', roleMiddleware('ADMIN'), deleteHostel);

module.exports = router;
