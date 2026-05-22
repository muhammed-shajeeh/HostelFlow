const admin = require('firebase-admin');

let messaging = null;

try {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      })
    });
    messaging = admin.messaging();
    console.log('[Firebase Cloud Messaging] SDK Initialized Successfully.');
  } else {
    console.warn('[Firebase Cloud Messaging] Credentials missing in environment variables. FCM pushes will run in simulated mode.');
  }
} catch (error) {
  console.error('[Firebase Cloud Messaging] Failed to initialize Firebase Admin SDK:', error);
}

/**
 * Sends a highly targeted hybrid FCM push notification.
 * @param {string[]} tokens - Target device tokens
 * @param {object} payload - Notification details { title, body, route, entityId }
 */
const sendPushNotification = async (tokens, payload) => {
  if (!messaging || !tokens || tokens.length === 0) {
    return { success: false, reason: 'Firebase Messaging not initialized or no tokens provided' };
  }

  const messagePayload = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      route: payload.route || '/',
      entityId: payload.entityId || '',
      click_action: 'FLUTTER_NOTIFICATION_CLICK'
    },
    android: {
      priority: 'high',
      notification: {
        sound: payload.sound || 'default',
        channelId: payload.channelId || 'default',
        clickAction: 'FCM_PLUGIN_ACTIVITY',
        icon: 'stock_ticker_update'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: payload.sound || 'default',
          badge: 1
        }
      }
    }
  };

  try {
    const sendPromises = tokens.map(token => {
      return messaging.send({ ...messagePayload, token })
        .catch(err => {
          console.warn(`[FCM Engine] Failed to dispatch token ${token}:`, err.message);
          return { error: true, token, reason: err.message };
        });
    });

    const results = await Promise.all(sendPromises);
    const failedTokens = results.filter(r => r && r.error).map(r => r.token);

    if (failedTokens.length > 0) {
      const DeviceToken = require('../models/DeviceToken');
      await DeviceToken.deleteMany({ fcmToken: { $in: failedTokens } });
      console.log(`[FCM Engine] Cleaned up ${failedTokens.length} stale/invalid registration tokens.`);
    }

    return { success: true, dispatchedCount: tokens.length - failedTokens.length };
  } catch (error) {
    console.error('[FCM Engine] Error dispatching push operations:', error);
    return { success: false, error };
  }
};

module.exports = {
  sendPushNotification
};
