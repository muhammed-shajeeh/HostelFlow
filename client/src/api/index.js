import axios from 'axios';
import { Capacitor } from '@capacitor/core';

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

export default api;
