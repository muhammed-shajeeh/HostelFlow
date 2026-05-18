import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

// Environment-aware API URL detection
const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    const base = import.meta.env.VITE_API_URL.trim().replace(/\/$/, '');
    return base.endsWith('/api') ? base : `${base}/api`;
  }
  
  // For native mobile platform containers (Android/iOS), always route directly to the live production server!
  if (Capacitor.isNativePlatform()) {
    return 'https://hostelflow-mg85.onrender.com/api';
  }
  
  // Environment-aware resolution for web-only localhost vs production Vercel
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:5000/api';
  }

  return 'https://hostelflow-mg85.onrender.com/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
});

// Intercept requests to add token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Intercept responses to handle 401 Unauthorized errors and network failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Graceful offline detection & network failure indicators
    if (!navigator.onLine || error.message === 'Network Error') {
      toast.error('Network failure. Please check your internet connection.');
    }

    if (error.response && error.response.status === 401) {
      // Dispatch custom event to let AuthContext handle central cleanup and state updates
      window.dispatchEvent(new CustomEvent('erp:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
