const cron = require('node-cron');
const User = require('../models/user.model');
const fcmService = require('./fcm.service');

class CronService {
  start() {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
      console.log('[Cron Service] Running incomplete profile reminder check...');
      try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        // Find users created more than 1 hour ago who haven't completed their profile
        // A profile is considered incomplete if firstName is missing
        const incompleteUsers = await User.find({
          firstName: { $exists: false },
          createdAt: { $lt: oneHourAgo },
          fcmToken: { $exists: true, $ne: null }
        });

        console.log(`[Cron Service] Found ${incompleteUsers.length} users needing reminders.`);

        for (const user of incompleteUsers) {
          await fcmService.sendPushNotification(
            user.fcmToken,
            'Don\'t Miss Out! 💖',
            'Your perfect match might be waiting. Complete your profile now to connect with them.'
          );
        }
      } catch (err) {
        console.error('[Cron Service] Error running reminder cron:', err.message);
      }
    });

    console.log('[Cron Service] Cron jobs initialized.');
  }
}

module.exports = new CronService();
