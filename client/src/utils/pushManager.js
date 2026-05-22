import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import api from '../api';

/**
 * Initializes and registers device push tokens securely with the backend.
 * @param {object} user - Authenticated user details
 */
export const registerPushNotifications = async (user) => {
  if (!user) return;

  // 1. Android Native Capacitor Push Flow
  if (Capacitor.isNativePlatform()) {
    try {
      let permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive !== 'granted') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('[Push Manager] Native push permission denied.');
        return;
      }

      // Create dedicated emergency notification channel with custom wailing sound and maximum priority
      try {
        await PushNotifications.createChannel({
          id: 'emergency_channel',
          name: 'Emergency Alerts',
          description: 'Critical high-priority emergency notifications',
          sound: 'emergency_siren',
          importance: 5, // Max Importance (enables heads-up banner display)
          visibility: 1, // VISIBILITY_PUBLIC (visible on lockscreen)
          vibration: true
        });
        console.log('[Push Manager] Emergency notification channel created/synced successfully.');
      } catch (channelErr) {
        console.warn('[Push Manager] Failed to register emergency notification channel:', channelErr);
      }

      // Register with FCM
      await PushNotifications.register();

      // Listen for FCM token registration success
      await PushNotifications.addListener('registration', async (token) => {
        console.log('[Push Manager] Native device token registered:', token.value);
        localStorage.setItem('native_fcm_token', token.value);
        try {
          await api.post('/notifications/register-device', {
            fcmToken: token.value,
            deviceType: 'android'
          });
        } catch (apiErr) {
          console.error('[Push Manager] Failed to register native token with backend:', apiErr);
        }
      });

      await PushNotifications.addListener('registrationError', (err) => {
        console.error('[Push Manager] Native registration failed:', err);
      });

      // Handle notification clicks (background/foreground) to navigate safely
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data;
        if (data && data.route) {
          console.log('[Push Manager] User tapped native notification, redirecting to:', data.route);
          window.location.href = data.route;
        }
      });

      // Listen for incoming notifications when app is in the foreground
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push Manager] Native push notification received in foreground. Suppression active to avoid duplicate overlays:', notification);
      });

    } catch (err) {
      console.error('[Push Manager] Failed to initialize Capacitor native pushes:', err);
    }
  } 
  // 2. Web PWA Browser Push Flow
  else if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[Push Manager] Web notification permission denied.');
        return;
      }

      let webToken = localStorage.getItem('web_fcm_token');
      if (!webToken) {
        webToken = 'web_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('web_fcm_token', webToken);
      }

      await api.post('/notifications/register-device', {
        fcmToken: webToken,
        deviceType: 'web'
      });
      console.log('[Push Manager] Web push token registered with backend.');

    } catch (err) {
      console.error('[Push Manager] Web push registration failed:', err);
    }
  }
};

/**
 * Removes registered device tokens on user logout.
 */
export const deregisterPushNotifications = async () => {
  const nativeToken = localStorage.getItem('native_fcm_token');
  const webToken = localStorage.getItem('web_fcm_token');
  const activeToken = nativeToken || webToken;

  if (activeToken) {
    try {
      await api.post('/notifications/deregister-device', {
        fcmToken: activeToken
      });
      console.log('[Push Manager] Push token deregistered from backend successfully.');
    } catch (err) {
      console.warn('[Push Manager] Failed to deregister token from backend:', err.message);
    }
  }
};
