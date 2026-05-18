import React, { createContext, useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('erp:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('erp:unauthorized', handleUnauthorized);
  }, []);

  // Fetch current user if token exists
  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          setUser(res.data.user);
        } catch (error) {
          console.error("Failed to fetch user", error);
          logout();
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
