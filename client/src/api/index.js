import axios from 'axios';
import { Capacitor } from '@capacitor/core';

// Environment-aware API URL detection
const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  const savedIp = localStorage.getItem('custom_api_ip');
  if (savedIp) {
    return `http://${savedIp}:5000/api`;
  }
  
  if (Capacitor.isNativePlatform()) {
    // Falls back to standard local emulator host loopback interface
    return 'http://10.0.2.2:5000/api';
  }

  return 'http://localhost:5000/api';
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
