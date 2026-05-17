import axios from 'axios';
import { getBaseURL } from '../utils/config';

const api = axios.create({
  baseURL: `${getBaseURL()}/api`,
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
