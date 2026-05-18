import React, { createContext, useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

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
      logout();
    };
    window.addEventListener('erp:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('erp:unauthorized', handleUnauthorized);
  }, []);

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
            logout();
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

  const logout = () => {
    import('../utils/pushManager')
      .then(({ deregisterPushNotifications }) => {
        deregisterPushNotifications();
      })
      .catch(err => console.warn('Failed to deregister push notifications', err));

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    toast.success('Logged out successfully');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
