import React, { createContext, useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

// Module-level lock to completely eliminate asynchronous racing and cascading logout loops
let isLoggingOut = false;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const cachedUser = localStorage.getItem('user');
      return cachedUser ? JSON.parse(cachedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(() => {
    // If there is an active session in local storage, do not block app startup (loading = false)
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    return !(storedToken && storedUser);
  });

  useEffect(() => {
    const handleUnauthorized = () => {
      logout('expired');
    };
    window.addEventListener('erp:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('erp:unauthorized', handleUnauthorized);
  }, [token]);

  // Fetch current user if token exists (background refresh if session was already hydrated)
  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data.user);
          localStorage.setItem('user', JSON.stringify(res.data.user));
        } catch (error) {
          console.error("Failed to fetch user profile", error);
          
          // Separate Authentication failure from Network/Server failure!
          const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || error.message === 'Network Error';
          const isServerUnavailable = error.response && (error.response.status >= 500);
          
          if (isNetworkError || isServerUnavailable) {
            console.warn("[Auth Context] Operating in offline/cached session mode due to server unreachability.");
          } else {
            // Actual authorization rejection/expiration - trigger logout safely
            logout('expired');
          }
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, [token]);

  useEffect(() => {
    if (user) {
      import('../utils/pushManager')
        .then(({ registerPushNotifications }) => {
          registerPushNotifications(user);
        })
        .catch(err => console.warn('Failed to register push notifications', err));
    }
  }, [user]);

  const login = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = (mode = 'manual') => {
    if (isLoggingOut) return;

    const hasToken = localStorage.getItem('token') || token;
    if (!hasToken) return;

    isLoggingOut = true;

    import('../utils/pushManager')
      .then(({ deregisterPushNotifications }) => {
        deregisterPushNotifications();
      })
      .catch(err => console.warn('Failed to deregister push notifications', err));

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);

    // Standardize all auth-related toast behavior and eliminate duplicate overlays
    if (mode === 'manual') {
      toast.success('Logged out successfully');
    } else if (mode === 'expired') {
      toast.error('Session expired. Please login again.');
    }

    // Release locking mechanism after DOM transitions settle
    setTimeout(() => {
      isLoggingOut = false;
    }, 1000);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
