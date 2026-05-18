import { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';
import toast from 'react-hot-toast';
import api from '../api';
import { Capacitor } from '@capacitor/core';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch initial notifications from API when user logs in
  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
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
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    newSocket.on('connect', () => {
      console.log('[Socket.IO Client] Connected successfully with ID:', newSocket.id);
    });

    newSocket.on('connect_error', (err) => {
      console.warn('[Socket.IO Client] Connection failed:', err.message);
    });

    // Listen to real-time notifications
    newSocket.on('NEW_NOTIFICATION', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

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
    });

    newSocket.on('NEW_NOTICE', (notice) => {
      window.dispatchEvent(new CustomEvent('erp:newNotice', { detail: notice }));
    });

    newSocket.on('LEAVE_STATUS_UPDATED', (leave) => {
      window.dispatchEvent(new CustomEvent('erp:leaveUpdated', { detail: leave }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      toast.error('Failed to mark notification as read.');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications cleared.');
    } catch (err) {
      toast.error('Failed to clear notifications.');
    }
  };

  return (
    <SocketContext.Provider value={{ socket, notifications, unreadCount, markAsRead, markAllAsRead, refreshNotifications: fetchNotifications }}>
      {children}
    </SocketContext.Provider>
  );
};
