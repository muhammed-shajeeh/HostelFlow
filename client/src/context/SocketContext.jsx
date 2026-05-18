import { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import toast from 'react-hot-toast';
import api from '../api';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [badgeSummary, setBadgeSummary] = useState({
    pendingStudents: 0,
    pendingLeaves: 0,
    pendingComplaints: 0,
    unreadNotifications: 0
  });

  // Fetch initial notifications and badge summaries from API when user logs in
  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchBadgeSummary();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setBadgeSummary({
        pendingStudents: 0,
        pendingLeaves: 0,
        pendingComplaints: 0,
        unreadNotifications: 0
      });
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      const unread = (res.data.notifications || []).filter(n => !n.isRead).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Failed to load notifications history', err);
    }
  };

  const fetchBadgeSummary = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications/summary');
      if (res.data.success && res.data.summary) {
        setBadgeSummary(res.data.summary);
      }
    } catch (err) {
      console.warn('[Socket Context] Failed to fetch badge summary', err);
    }
  };

  // ERP custom triggers to auto-update sidebars and badges on operational events
  useEffect(() => {
    if (!user) return;
    
    const handleRefreshEvents = () => {
      fetchBadgeSummary();
    };

    window.addEventListener('erp:refresh', handleRefreshEvents);
    window.addEventListener('erp:leaveUpdated', handleRefreshEvents);
    return () => {
      window.removeEventListener('erp:refresh', handleRefreshEvents);
      window.removeEventListener('erp:leaveUpdated', handleRefreshEvents);
    };
  }, [user]);

  // Socket connection manager
  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    // Connect to backend Socket.IO server
    const getSocketUrl = () => {
      if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL.trim().replace(/\/api\/?$/, '').replace(/\/$/, '');
      }
      
      // For native mobile platform containers (Android/iOS), always route directly to the live production server!
      if (Capacitor.isNativePlatform()) {
        return 'https://hostelflow-mg85.onrender.com';
      }
      
      // Environment-aware resolution for web-only localhost vs production Vercel
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return 'http://localhost:5000';
      }
      
      return 'https://hostelflow-mg85.onrender.com';
    };
    const socketUrl = getSocketUrl();
    const newSocket = io(socketUrl, {
      auth: { token },
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5
    });

    newSocket.on('connect', () => {
      console.log('[Socket.IO Client] Connected successfully with ID:', newSocket.id);
      fetchNotifications();
      fetchBadgeSummary();
    });

    newSocket.on('connect_error', (err) => {
      console.warn('[Socket.IO Client] Connection failed:', err.message);
    });

    // Listen to real-time notifications
    newSocket.on('NEW_NOTIFICATION', (notification) => {
      setNotifications(prev => {
        // Prevent duplicate notifications in active local state
        if (prev.some(n => n._id === notification._id)) return prev;
        return [notification, ...prev];
      });
      setUnreadCount(prev => prev + 1);
      fetchBadgeSummary(); // Sync real-time badge counts

      // Play soft in-app audible sound or show elegant toast message
      toast.success(() => (
        <div className="flex flex-col gap-1">
          <strong className="font-bold text-xs">{notification.title}</strong>
          <span className="text-[10px] text-gray-500 font-medium">{notification.message}</span>
        </div>
      ), { duration: 5000, icon: '🔔' });
    });

    // Universal dashboard refresh trigger
    newSocket.on('REFRESH_DASHBOARD', (event) => {
      console.log('[Socket.IO Client] Broadcast trigger: Dashboard Refresh Requested for', event.type);
      // Dispatch standard browser CustomEvent so page components can reload their local states instantly
      window.dispatchEvent(new CustomEvent('erp:refresh', { detail: event }));
      fetchBadgeSummary(); // Sync real-time badge counts
    });

    newSocket.on('NEW_NOTICE', (notice) => {
      window.dispatchEvent(new CustomEvent('erp:newNotice', { detail: notice }));
      fetchBadgeSummary();
    });

    newSocket.on('NOTICE_DELETED', (notice) => {
      window.dispatchEvent(new CustomEvent('erp:noticeDeleted', { detail: notice }));
      fetchBadgeSummary();
    });

    newSocket.on('NOTICE_UPDATED', (notice) => {
      window.dispatchEvent(new CustomEvent('erp:noticeUpdated', { detail: notice }));
      fetchBadgeSummary();
    });

    newSocket.on('LEAVE_STATUS_UPDATED', (leave) => {
      window.dispatchEvent(new CustomEvent('erp:leaveUpdated', { detail: leave }));
      fetchBadgeSummary();
    });

    newSocket.on('COMPLAINT_UPDATED', (complaint) => {
      window.dispatchEvent(new CustomEvent('erp:complaintUpdated', { detail: complaint }));
      fetchBadgeSummary();
    });

    newSocket.on('ROOM_TRANSFERRED', (roomTransfer) => {
      window.dispatchEvent(new CustomEvent('erp:roomTransferred', { detail: roomTransfer }));
      fetchBadgeSummary();
    });

    newSocket.on('STUDENT_APPROVED', (student) => {
      window.dispatchEvent(new CustomEvent('erp:studentApproved', { detail: student }));
      fetchBadgeSummary();
    });

    // Online transition listener to force reconnect instantly when network returns
    const handleNetworkOnline = () => {
      console.log('[Socket.IO Client] Network status transitioned ONLINE. Forcing socket reconnect...');
      if (newSocket && !newSocket.connected) {
        newSocket.connect();
        fetchNotifications();
        fetchBadgeSummary();
      }
    };
    window.addEventListener('online', handleNetworkOnline);

    // Capacitor Native appStateChange foreground/resume listener
    let appStateListener = null;
    if (Capacitor.isNativePlatform()) {
      try {
        appStateListener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          console.log(`[Socket.IO Client] Capacitor app state changed. isActive: ${isActive}`);
          if (isActive && newSocket && !newSocket.connected) {
            console.log('[Socket.IO Client] Native app resumed to foreground. Forcing reconnect...');
            newSocket.connect();
            fetchNotifications();
            fetchBadgeSummary();
          }
        });
      } catch (err) {
        console.warn('Failed to bind Capacitor App state listener', err);
      }
    }

    setSocket(newSocket);

    return () => {
      window.removeEventListener('online', handleNetworkOnline);
      if (appStateListener) {
        appStateListener.remove();
      }
      newSocket.disconnect();
    };
  }, [user]);

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      fetchBadgeSummary(); // Keep badge summary in sync
    } catch (err) {
      toast.error('Failed to mark notification as read.');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      setBadgeSummary(prev => ({ ...prev, unreadNotifications: 0 }));
      toast.success('All notifications cleared.');
    } catch (err) {
      toast.error('Failed to clear notifications.');
    }
  };

  return (
    <SocketContext.Provider value={{ 
      socket, 
      notifications, 
      unreadCount, 
      badgeSummary, 
      markAsRead, 
      markAllAsRead, 
      refreshNotifications: fetchNotifications,
      refreshBadgeSummary: fetchBadgeSummary
    }}>
      {children}
    </SocketContext.Provider>
  );
};
