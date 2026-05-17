import { Capacitor } from '@capacitor/core';

/**
 * Returns the resolved backend server base URL.
 * Supports:
 * 1. Production (via VITE_API_URL)
 * 2. Hotspot / LAN Wi-Fi testing (auto-resolves laptop LAN IP from window.location)
 * 3. Default local fallback
 */
export const getBaseURL = () => {
  // If production environment variable is set, prioritize it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const hostname = window.location.hostname;

  // In native Android builds, localhost points to the device itself.
  // If window.location.hostname is localhost or 127.0.0.1, fall back to localhost:5000
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }

  // If the developer accesses the app via their laptop's LAN IP (e.g., 192.168.1.15),
  // this dynamically resolves and points to the backend server running on that same LAN IP!
  return `http://${hostname}:5000`;
};
