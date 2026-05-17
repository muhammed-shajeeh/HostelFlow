const express = require('express');
const { 
  getNotifications, 
  markAsRead, 
  markAllAsRead,
  registerDeviceToken,
  deregisterDeviceToken
} = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.post('/register-device', registerDeviceToken);
router.post('/deregister-device', deregisterDeviceToken);
router.put('/:id/read', markAsRead);

module.exports = router;
