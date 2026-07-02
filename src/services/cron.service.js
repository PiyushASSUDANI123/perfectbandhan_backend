const cron = require('node-cron');
const User = require('../models/user.model');
const fcmService = require('./fcm.service');

class CronService {
  start() {
    // Run daily at 7:00 PM IST (which is 13:30 UTC).
    cron.schedule('0 19 * * *', async () => {
      console.log('[Cron Service] Running daily retention hooks at 7 PM IST');
      
      try {
        const allUsers = await User.find({ fcmToken: { $exists: true, $ne: '' } });
        
        for (const user of allUsers) {
          // Hook 1: Profile Views (The Curiosity Loop)
          const viewsCount = parseInt(user.profileViews) || Math.floor(Math.random() * 5) + 1; // Fake some views if 0 for retention
          if (viewsCount > 0 && user.isProfileComplete) {
            await fcmService.sendPushNotification(
              user.fcmToken,
              "Profile Views",
              `Aapki profile par aaj ${viewsCount} naye logo ne visit kiya. Dekhein aapko kaun pasand kar raha hai.`,
              { type: 'retention_views' }
            );
          }

          // Hook 2: Daily Dynamic Picks
          if (user.isProfileComplete) {
            await fcmService.sendPushNotification(
              user.fcmToken,
              "Daily Matches",
              "Aapke Nukh aur preferences ke mutabik aaj 3 naye rishte mile hain. Abhi check karein!",
              { type: 'retention_picks' }
            );
          }

          // Hook 3: Incomplete Profile Reminder
          if (!user.isProfileComplete) {
            await fcmService.sendPushNotification(
              user.fcmToken,
              "Incomplete Profile",
              "Aapki profile abhi adhuri hai. Family dossier poora karein aur 5x zyada acche matches payein.",
              { type: 'retention_incomplete' }
            );
          }
        }
        console.log('[Cron Service] Retention hooks successfully dispatched to all active users.');
      } catch (error) {
        console.error('[Cron Service Error] Failed to execute daily hooks:', error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });

    console.log('[Cron Service] Cron jobs initialized (7:00 PM IST hooks).');
  }
}

module.exports = new CronService();
