const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

class FcmService {
  constructor() {
    this.isInitialized = false;

    // Check for service account credentials
    const credentialsPath = process.env.FIREBASE_CREDENTIALS_PATH || path.join(__dirname, '../../firebase-key.json');

    if (fs.existsSync(credentialsPath)) {
      try {
        const serviceAccount = require(credentialsPath);
        this.app = initializeApp({
          credential: cert(serviceAccount)
        });
        this.isInitialized = true;
        console.log('[FCM Service] Firebase Admin SDK initialized successfully.');
      } catch (err) {
        console.error('[FCM Service] Failed to initialize Firebase Admin cert:', err.message);
      }
    } else {
      console.warn('[FCM Service] Firebase credentials JSON missing. Operating in Fallback Mock Mode.');
    }
  }

  async sendPushNotification(token, title, body, data = {}) {
    if (this.isInitialized && token) {
      try {
        const message = {
          notification: { 
            title, 
            body,
            imageUrl: process.env.APP_LOGO_URL || 'https://cdn-icons-png.flaticon.com/512/3257/3257321.png'
          },
          data,
          token
        };
        const response = await getMessaging(this.app).send(message);
        console.log(`[FCM Notification] Push notification sent successfully. Message ID: ${response}`);
        return true;
      } catch (err) {
        console.error('[FCM Notification] Sending failed:', err.message);
      }
    }

    // Fallback Mock Logger
    console.log(`[FCM Service Fallback] Dispatching push notification:`);
    console.log(`  - Target Token: ${token || 'MOCK_TOKEN_DEVICE'}`);
    console.log(`  - Title: ${title}`);
    console.log(`  - Body: ${body}`);
    console.log(`  - Data: ${JSON.stringify(data)}`);
    return true;
  }
}

module.exports = new FcmService();
