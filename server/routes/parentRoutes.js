const express = require('express');
const router = express.Router();
const {
  getLinkedStudents,
  getStudentDetails,
  changeInitialPassword
} = require('../controllers/parentController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Protect all routes
router.use(authMiddleware);
router.use(roleMiddleware('PARENT'));

router.get('/students', getLinkedStudents);
router.get('/student/:id', getStudentDetails);
router.put('/change-password', changeInitialPassword);

module.exports = router;
