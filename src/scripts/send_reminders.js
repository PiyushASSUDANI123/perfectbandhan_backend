require('dotenv').config();
const mongoose = require('mongoose');
const fcmService = require('../services/fcm.service');
const User = require('../models/user.model.js');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Find users who have an FCM token but profile is incomplete
    const users = await User.find({
      fcmToken: { $exists: true, $ne: "" },
      $or: [
        { firstName: { $exists: false } },
        { firstName: null },
        { firstName: "" },
        { email: 'temp@sindhishadi.com' } // skeleton accounts
      ]
    });
    
    console.log(`Found ${users.length} incomplete users with FCM tokens.`);
    
    let sentCount = 0;
    
    for (const user of users) {
      if (user.fcmToken) {
        const success = await fcmService.sendPushNotification(
          user.fcmToken,
          'Complete Your Profile! 💍',
          'You are just a step away from finding your perfect match. Complete your profile now on Perfect Bandhan!'
        );
        if (success) sentCount++;
      }
    }
    
    console.log(`${sentCount} messages were sent successfully`);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
