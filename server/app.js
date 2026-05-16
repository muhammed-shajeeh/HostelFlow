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

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
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
app.get('/', (req, res) => res.json({ success: true, message: "Server running" }));

// Error handling middleware
app.use(errorHandler);

module.exports = app;
