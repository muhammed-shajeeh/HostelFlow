# Room & Accommodation Management Snippets 🚪

This document contains key software engineering implementation snippets representing the operations of **HostelFlow Room Allocation & Student Approval**.

---

## 1. Student Registration (Unverified State Initiation)
This snippet creates an unverified account upon registration submission, blocking bypass attempts.

```javascript
const registerStudent = async (req, res) => {
  const { email, password, fullName, hostelId } = req.body;
  try {
    const student = await User.create({
      fullName,
      email,
      password,
      role: 'STUDENT',
      emailVerified: false,
      isApproved: false,
      approvalStatus: 'PENDING',
      hostelId
    });

    await sendVerificationEmail(student.email);
    res.status(201).json({ message: 'Request sent. Check email for verification.' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
```

### 📝 Technical Explanation:
This snippet creates a student account in an unverified state (`emailVerified: false`, `isApproved: false`). By enforcing `emailVerified` to be `false` at creation, the authentication middleware locks the account and forces the student to verify their identity before login access is allowed.

---

## 2. Warden Student Approval & Bed Allocation
This snippet handles warden approvals, updating the student's operational status and allocating their requested bed.

```javascript
const approveStudent = async (req, res) => {
  const { studentId, roomNumber, bedNumber } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Allocate bed
    const room = await Room.findOne({ roomNumber, hostelId: req.user.hostelId }).session(session);
    if (room.occupiedBeds >= room.capacity) throw new Error('Selected room is fully occupied');
    
    room.occupiedBeds += 1;
    await room.save({ session });

    // 2. Approve student
    const student = await User.findByIdAndUpdate(
      studentId,
      { isApproved: true, approvalStatus: 'APPROVED', room: roomNumber, bedNumber },
      { new: true, session }
    );

    await session.commitTransaction();
    session.endSession();
    res.status(200).json({ success: true, data: student });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: err.message });
  }
};
```

### 📝 Technical Explanation:
This endpoint uses a **database transaction** to maintain data integrity. It checks the targeted room's current capacity, increments `occupiedBeds` by 1, and marks the student's status as `'APPROVED'`, linking the student to their designated room and bed number atomically.

---

## 3. Dynamic Room Transfer Execution
This operational controller executes dynamic student transfers, altering bed counts cleanly across both rooms.

```javascript
const transferRoom = async (req, res) => {
  const { studentId, newRoomNumber } = req.body;
  try {
    const student = await User.findById(studentId);
    
    // Decrement occupied bed count in old room
    await Room.findOneAndUpdate(
      { roomNumber: student.room, hostelId: student.hostelId },
      { $inc: { occupiedBeds: -1 } }
    );
    
    // Increment occupied bed count in new room
    await Room.findOneAndUpdate(
      { roomNumber: newRoomNumber, hostelId: student.hostelId },
      { $inc: { occupiedBeds: 1 } }
    );

    student.room = newRoomNumber;
    await student.save();
    
    res.status(200).json({ success: true, message: 'Room transferred successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
```

### 📝 Technical Explanation:
This code handles room reassignments. It uses MongoDB’s atomic `$inc` operator to decrement occupancy in the student's previous room and increment it in the destination room, preventing out-of-sync room balance tallies.
