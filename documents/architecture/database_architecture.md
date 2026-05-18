# Database Schema Design 🗄️

HostelFlow utilizes **MongoDB Atlas** with a highly structured **Mongoose ODM** schema design, optimizing query speeds, referential integrity, and data models.

---

## 🗂️ Mongoose Model Definitions

### 1. User Schema (`User.js`)
Handles students, wardens, parents, administrators, and security personnel:
```javascript
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'WARDEN', 'STUDENT', 'PARENT', 'SECURITY'], required: true },
  emailVerified: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel' },
  room: { type: String },
  bedNumber: { type: String },
  linkedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});
```

### 2. Room Schema (`Room.js`)
Tracks room capacity and beds occupied:
```javascript
const roomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true },
  floor: { type: Number, required: true },
  capacity: { type: Number, required: true },
  occupiedBeds: { type: Number, default: 0 },
  hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true }
});
```

### 3. Leave Schema (`Leave.js`)
Manages outpass requests and QR-code assets:
```javascript
const leaveSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  qrCode: { type: String }
});
```
