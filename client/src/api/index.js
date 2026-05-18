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
let requestCount = 0;
api.interceptors.request.use((config) => {
  requestCount++;
  const timestamp = new Date().toISOString();
  const reqId = `REQ-${requestCount}`;
  const token = localStorage.getItem('token');
  
  console.log(`[${timestamp}] [AXIOS_REQUEST_START] [Id: ${reqId}] URL: ${config.url}, Method: ${config.method?.toUpperCase()}, Token in localStorage: ${token ? "Exists" : "None"}`);
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Inject metadata to trace request latency and lifecycle
  config.metadata = { reqId, startTime: Date.now() };
  return config;
}, (error) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [AXIOS_REQUEST_ERROR] request failed at interceptor initiation phase. Message:`, error.message);
  return Promise.reject(error);
});

// Intercept responses to handle 401 Unauthorized errors and network failures
api.interceptors.response.use(
  (response) => {
    const timestamp = new Date().toISOString();
    const metadata = response.config?.metadata || {};
    const reqId = metadata.reqId || 'UNKNOWN';
    const latency = metadata.startTime ? `${Date.now() - metadata.startTime}ms` : 'N/A';
    
    console.log(`[${timestamp}] [AXIOS_RESPONSE_SUCCESS] [Id: ${reqId}] URL: ${response.config?.url}, Status: ${response.status}, Latency: ${latency}`);
    return response;
  },
  (error) => {
    const timestamp = new Date().toISOString();
    const metadata = error.config?.metadata || {};
    const reqId = metadata.reqId || 'UNKNOWN';
    const latency = metadata.startTime ? `${Date.now() - metadata.startTime}ms` : 'N/A';
    const status = error.response?.status;
    const url = error.config?.url;
    
    console.error(`[${timestamp}] [AXIOS_RESPONSE_FAILURE] [Id: ${reqId}] URL: ${url}, Status: ${status || 'NETWORK_FAILURE'}, Latency: ${latency}, Message: ${error.message}`);

    // Graceful offline detection & network failure indicators
    if (!navigator.onLine || error.message === 'Network Error') {
      console.warn(`[${timestamp}] [AXIOS_OFFLINE_DETECTION] [Id: ${reqId}] Device is offline or network is entirely unreachable.`);
      toast.error('Network failure. Please check your internet connection.');
    }

    if (status === 401) {
      console.warn(`[${timestamp}] [AXIOS_UNAUTHORIZED_INTERCEPTED] [Id: ${reqId}] 401 Unauthorized captured! Dispatching erp:unauthorized custom event to window listeners.`);
      window.dispatchEvent(new CustomEvent('erp:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
