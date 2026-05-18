# Real-Time WebSocket Synchronization Snippets ⚡

This document contains key software engineering implementation snippets representing the operations of the **HostelFlow Zero-Refresh Decoupled Realtime Engine**.

---

## 1. Backend Socket.IO Room Emitter
This backend snippet broadcasts events to a specific room when a notice is created or edited.

```javascript
const publishNotice = async (req, res) => {
  try {
    const notice = await Notice.create(req.body);
    
    // Broadcast exclusively to the designated hostel channel
    req.io.to(`HOSTEL_${req.body.hostelId}`).emit('NOTICE_UPDATED', {
      type: 'CREATE',
      noticeId: notice._id
    });
    
    res.status(201).json({ success: true, data: notice });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
```

### 📝 Technical Explanation:
The backend gains access to the `io` instance through custom middleware (`req.io`). Instead of doing a global broadcast, it targets the specific hostel ID room (`HOSTEL_${hostelId}`). Only clients active in that hostel receive this real-time notification update payload.

---

## 2. Decoupled CustomEvent Native Dispatch
Inside our `SocketContext.jsx` file, standard socket events are decoupled and translated into native browser events.

```javascript
socket.on('NOTICE_UPDATED', (payload) => {
  // Translate Socket event to Native Browser custom event
  const erpEvent = new CustomEvent('erp:noticeUpdated', { detail: payload });
  window.dispatchEvent(erpEvent);
});
```

### 📝 Technical Explanation:
To prevent having to connect and clean up deep nested Socket.IO listeners inside dozens of leaf React components, our top-level `SocketContext` acts as the single listener. When an update arrives via the socket connection, it instantiates a standard browser `CustomEvent` (`erp:noticeUpdated`) and dispatches it globally to the `window` context.

---

## 3. Client Component Event Listener & API Refetch
Inside page components (such as `Notices.jsx` or `NoticeManagement.jsx`), pages subscribe to these browser event cues to refetch their state.

```javascript
useEffect(() => {
  const handleLiveSync = () => {
    fetchNoticesList(); // Re-trigger REST fetch API to sync state
  };

  window.addEventListener('erp:noticeUpdated', handleLiveSync);
  
  return () => {
    window.removeEventListener('erp:noticeUpdated', handleLiveSync);
  };
}, []);
```

### 📝 Technical Explanation:
This `useEffect` hook registers a standard browser event listener on mount. When the `window` object dispatches `'erp:noticeUpdated'`, the `handleLiveSync` callback is fired, executing an optimized API refetch. The component's clean-up function automatically unsubscribes on unmount, preventing memory leaks. This decouples socket connection management entirely from React UI rendering states!
