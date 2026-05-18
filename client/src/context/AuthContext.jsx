import React, { createContext, useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export const AuthContext = createContext();

// Module-level lock to completely eliminate asynchronous racing and cascading logout loops
let isLoggingOut = false;
let renderCount = 0;

export const AuthProvider = ({ children }) => {
  renderCount++;
  const renderTimestamp = new Date().toISOString();

  const [user, setUser] = useState(() => {
    try {
      const cachedUser = localStorage.getItem('user');
      console.log(`[${renderTimestamp}] [AUTH_STATE_INIT_USER] user read from localStorage:`, cachedUser ? JSON.parse(cachedUser)?.fullName : 'None');
      return cachedUser ? JSON.parse(cachedUser) : null;
    } catch (err) {
      console.error(`[${renderTimestamp}] [AUTH_STATE_INIT_USER_ERR] failed to parse localStorage user:`, err);
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    const cachedToken = localStorage.getItem('token');
    console.log(`[${renderTimestamp}] [AUTH_STATE_INIT_TOKEN] token read from localStorage:`, cachedToken ? "Exists" : "None");
    return cachedToken || null;
  });

  const [loading, setLoading] = useState(() => {
    // If there is an active session in local storage, do not block app startup (loading = false)
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const initialLoading = !(storedToken && storedUser);
    console.log(`[${renderTimestamp}] [AUTH_STATE_INIT_LOADING] calculated loading state:`, initialLoading);
    return initialLoading;
  });

  console.log(`[${renderTimestamp}] [AUTH_PROVIDER_RENDER] #Count: ${renderCount}, token: ${token ? "Exists" : "None"}, user: ${user ? user.fullName : "None"}, loading: ${loading}`);

  useEffect(() => {
    const handleUnauthorized = () => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [AUTH_EVENT_UNAUTHORIZED_CAPTURED] Custom event erp:unauthorized received in AuthContext. Dispatching expired logout.`);
      logout('expired');
    };
    
    console.log(`[${new Date().toISOString()}] [AUTH_EFFECT_ADD_UNAUTHORIZED_LISTENER] Adding erp:unauthorized event listener.`);
    window.addEventListener('erp:unauthorized', handleUnauthorized);
    
    return () => {
      console.log(`[${new Date().toISOString()}] [AUTH_EFFECT_REMOVE_UNAUTHORIZED_LISTENER] Cleaning up/removing erp:unauthorized event listener.`);
      window.removeEventListener('erp:unauthorized', handleUnauthorized);
    };
  }, [token]);

  // Fetch current user if token exists (background refresh if session was already hydrated)
  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [AUTH_FETCH_USER_START] Token is present. Initializing profile sync via /auth/me API call.`);
        try {
          const res = await api.get('/auth/me');
          console.log(`[${new Date().toISOString()}] [AUTH_FETCH_USER_SUCCESS] /auth/me profile sync successful:`, res.data.user?.fullName);
          setUser(res.data.user);
          localStorage.setItem('user', JSON.stringify(res.data.user));
        } catch (error) {
          const errTimestamp = new Date().toISOString();
          console.error(`[${errTimestamp}] [AUTH_FETCH_USER_FAILURE] Profile fetch failed. Status:`, error.response?.status, "Message:", error.message);
          
          // Separate Authentication failure from Network/Server failure!
          const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || error.message === 'Network Error';
          const isServerUnavailable = error.response && (error.response.status >= 500);
          
          if (isNetworkError || isServerUnavailable) {
            console.warn(`[${errTimestamp}] [AUTH_FETCH_USER_OFFLINE] Server is unreachable or offline. Retaining current cached profile session.`);
          } else {
            console.error(`[${errTimestamp}] [AUTH_FETCH_USER_EXPIRED] Profile fetch returned authentication failure (401/403). Initiating expired session logout.`);
            logout('expired');
          }
        }
      } else {
        console.log(`[${new Date().toISOString()}] [AUTH_FETCH_USER_SKIPPED] Token is null. Skipping /auth/me profile sync.`);
      }
      setLoading(false);
    };

    fetchUser();
  }, [token]);

  useEffect(() => {
    if (user) {
      console.log(`[${new Date().toISOString()}] [AUTH_EFFECT_PUSH_REGISTER] User is present. Starting push notifications setup.`);
      import('../utils/pushManager')
        .then(({ registerPushNotifications }) => {
          registerPushNotifications(user);
        })
        .catch(err => console.warn(`[${new Date().toISOString()}] [AUTH_EFFECT_PUSH_REGISTER_WARN] Failed to register push notifications:`, err));
    }
  }, [user]);

  const login = (newToken, userData) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTH_LOGIN_TRIGGERED] User triggering login. Setting token and profile in state and storage.`);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = (mode = 'manual') => {
    const timestamp = new Date().toISOString();
    const traceId = Math.random().toString(36).substring(2, 9);
    console.log(`[${timestamp}] [AUTH_LOGOUT_TRIGGERED] [TraceId: ${traceId}] mode: ${mode}, isLoggingOut (lock status): ${isLoggingOut}, localStorage token: ${localStorage.getItem('token') ? "Exists" : "None"}, state token: ${token ? "Exists" : "None"}`);

    if (isLoggingOut) {
      console.warn(`[${timestamp}] [AUTH_LOGOUT_BLOCKED] [TraceId: ${traceId}] Logout blocked! Active isLoggingOut mutex lock is engaged.`);
      return;
    }

    const hasToken = localStorage.getItem('token') || token;
    if (!hasToken) {
      console.warn(`[${timestamp}] [AUTH_LOGOUT_SKIPPED] [TraceId: ${traceId}] Logout skipped! Both localStorage and state tokens are already empty.`);
      return;
    }

    isLoggingOut = true;
    console.log(`[${timestamp}] [AUTH_LOGOUT_ACQUIRED_LOCK] [TraceId: ${traceId}] Mutex lock successfully acquired. Starting session cleanup.`);

    import('../utils/pushManager')
      .then(({ deregisterPushNotifications }) => {
        console.log(`[${timestamp}] [AUTH_LOGOUT_PUSH_DEREGISTER] [TraceId: ${traceId}] Push notifications deregistered.`);
        deregisterPushNotifications();
      })
      .catch(err => console.warn(`[${timestamp}] [AUTH_LOGOUT_PUSH_WARN] [TraceId: ${traceId}] Failed to deregister push notifications:`, err));

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    console.log(`[${timestamp}] [AUTH_LOGOUT_STORAGE_CLEARED] [TraceId: ${traceId}] LocalStorage token & user credentials removed.`);
    
    setToken(null);
    setUser(null);
    console.log(`[${timestamp}] [AUTH_LOGOUT_STATE_RESET] [TraceId: ${traceId}] State token and user set to null.`);

    // Standardize all auth-related toast behavior and eliminate duplicate overlays
    if (mode === 'manual') {
      console.log(`[${timestamp}] [AUTH_LOGOUT_TOAST] [TraceId: ${traceId}] Rendering success toast for manual logout.`);
      toast.success('Logged out successfully');
    } else if (mode === 'expired') {
      console.log(`[${timestamp}] [AUTH_LOGOUT_TOAST] [TraceId: ${traceId}] Rendering error toast for expired session.`);
      toast.error('Session expired. Please login again.');
    } else {
      console.log(`[${timestamp}] [AUTH_LOGOUT_TOAST_SILENT] [TraceId: ${traceId}] Silent logout mode selected. Toast suppressed.`);
    }

    // Release locking mechanism after DOM transitions settle
    setTimeout(() => {
      isLoggingOut = false;
      console.log(`[${new Date().toISOString()}] [AUTH_LOGOUT_LOCK_RELEASED] [TraceId: ${traceId}] Mutex lock released. System ready for new authentication events.`);
    }, 1000);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
