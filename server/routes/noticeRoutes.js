const express = require('express');
const { check } = require('express-validator');
const {
  getNotices,
  getNoticeById,
  createNotice,
  updateNotice,
  deleteNotice,
  getNoticeStats
} = require('../controllers/noticeController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const router = express.Router();

// All notice routes require authentication
router.use(authMiddleware);

// ── Read routes (all authenticated roles) ─────────────
// Stats for dashboard widgets — must be before /:id to avoid conflict
router.get('/stats', getNoticeStats);

// Full notices list (filtered by visibility in controller)
router.get('/', getNotices);

// Single notice detail
router.get('/:id', getNoticeById);

// ── Write routes (Admin and Warden only) ──────────────
router.post(
  '/',
  roleMiddleware('ADMIN', 'WARDEN'),
  [
    check('title', 'Title is required').notEmpty(),
    check('content', 'Content is required').notEmpty(),
    check('targetType', 'targetType must be GLOBAL or HOSTEL').isIn(['GLOBAL', 'HOSTEL'])
  ],
  createNotice
);

router.put(
  '/:id',
  roleMiddleware('ADMIN', 'WARDEN'),
  updateNotice
);

router.delete(
  '/:id',
  roleMiddleware('ADMIN', 'WARDEN'),
  deleteNotice
);

module.exports = router;
