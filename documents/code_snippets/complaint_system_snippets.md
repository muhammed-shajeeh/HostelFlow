# Complaint System Implementation Snippets 🛠️

This document contains key software engineering implementation snippets representing the operations of the **HostelFlow Complaint Resolution Lifecycle**.

---

## 1. Complaint Submission
This backend controller handler receives new complaints lodged by students, saves them, and dispatches live notification cues.

```javascript
const createComplaint = async (req, res) => {
  const { title, description, category } = req.body;
  try {
    const complaint = await Complaint.create({
      studentId: req.user._id,
      title,
      description,
      category,
      status: 'PENDING'
    });

    // Realtime broadcast and notification triggers go here...
    res.status(201).json({ success: true, data: complaint });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
```

### 📝 Technical Explanation:
This controller validates and instantiates a new complaint entity inside the MongoDB database. The complaint is automatically bound to the authenticated student's user ID (`req.user._id`) and initialized in the `'PENDING'` state, making it instantly visible on the warden's triage dashboard.

---

## 2. Complaint Assigning & Resolution
This controller handles state updates, allowing wardens to assign maintenance staff or flag issues as resolved.

```javascript
const updateComplaintStatus = async (req, res) => {
  const { status, remarks } = req.body;
  try {
    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { status, remarks, resolvedAt: Date.now() },
      { new: true }
    );
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    // Triggers notification tracking
    await createNotification({
      recipient: complaint.studentId,
      title: 'Complaint Resolved',
      message: `Your complaint "${complaint.title}" is now marked as: ${status}`
    });

    res.status(200).json({ success: true, data: complaint });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
```

### 📝 Technical Explanation:
This endpoint transitions the status of a specific complaint (e.g., from `PENDING` to `RESOLVED`). It logs resolution remarks, tracks timestamps, and dynamically invokes `createNotification` to alert the student immediately of the status change.

---

## 3. Dynamic Notification Generator
This backend helper records persistent in-app alerts for users when actions occur across the ERP.

```javascript
const createNotification = async ({ recipient, title, message }) => {
  try {
    const notification = await Notification.create({
      recipient,
      title,
      message,
      isRead: false
    });
    
    // Emit dynamic event on WebSockets channel
    io.to(`STUDENT_${recipient}`).emit('NEW_NOTIFICATION', notification);
    return notification;
  } catch (err) {
    console.error('Error generating notification ledger:', err);
  }
};
```

### 📝 Technical Explanation:
This helper writes a persistent alert record to the database. It then maps the recipient's private user channel (`STUDENT_${recipient}`) and emits a real-time WebSocket event (`NEW_NOTIFICATION`) so that notification badge counts update dynamically on the client dashboard without page refreshes.
