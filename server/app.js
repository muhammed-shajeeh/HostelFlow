const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorMiddleware');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const hostelRoutes = require('./routes/hostelRoutes');
const adminRoutes = require('./routes/adminRoutes');
const roomRoutes = require('./routes/roomRoutes');
const studentRoutes = require('./routes/studentRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const parentRoutes = require('./routes/parentRoutes');
const messRoutes = require('./routes/messRoutes');
const securityRoutes = require('./routes/securityRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const auditRoutes = require('./routes/auditRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');

const app = express();

// Configure proxy awareness for Render load balancers
app.set('trust proxy', 1);

// Security middleware & CORS configuration
const { corsOptions } = require('./utils/corsConfig');
app.use(helmet());
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit increased to support robust dashboard updates
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes.'
});
app.use('/api/auth/login', loginLimiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static folders
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/hostels', hostelRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/mess', messRoutes);
app.use('/api/security-gate', securityRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/emergency', emergencyRoutes);
// Error handling middleware
app.use(errorHandler);

// Smart auto-scheduler trigger: Runs every 15 minutes to guarantee 10:00 PM cutoff freeze
setInterval(async () => {
  try {
    const now = new Date();
    if (now.getHours() === 22) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const DailyMealRecord = require('./models/DailyMealRecord');
      const count = await DailyMealRecord.countDocuments({ date: tomorrow });
      if (count === 0) {
        console.log(`[Auto-Freeze Engine] Automatically freezing daily meal records for tomorrow: ${tomorrow.toISOString()}`);
        const { freezeDailyMealsForDate } = require('./controllers/messController');
        await freezeDailyMealsForDate(tomorrow);
      }
    }
  } catch (error) {
    console.error('[Auto-Freeze Engine] Error running automatic daily freeze task:', error);
  }
}, 15 * 60 * 1000); // 15 minutes

// Lightweight notice automation scheduler worker trigger (immediate startup run + 1 minute intervals)
const { runNoticeScheduler } = require('./utils/noticeScheduler');
runNoticeScheduler().catch(err => console.error('[Notice Scheduler Startup Error]', err));
setInterval(async () => {
  await runNoticeScheduler();
}, 60 * 1000); // 1 minute

module.exports = app;

