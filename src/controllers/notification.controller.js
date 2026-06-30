const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const fcmService = require('../services/fcm.service');

// --- User Methods ---

// Get notifications for a user (both global and specific to them)
exports.getUserNotifications = async (req, res) => {
  try {
    const userPhone = req.user.phone;
    
    // Fetch notifications where targetPhone is null (global) or matches the user's phone
    // And filter out notifications deleted by this user
    const notifications = await Notification.find({
      $and: [
        {
          $or: [
            { targetPhone: null },
            { targetPhone: userPhone }
          ]
        },
        { deletedBy: { $ne: userPhone } }
      ]
    }).sort({ createdAt: -1 });
    
    res.json(notifications);
  } catch (error) {
    console.error('[Notification Controller] getUserNotifications Error:', error);
    res.status(500).json({ message: 'Server error fetching notifications' });
  }
};

// Mark all notifications as read for a user
exports.markAllRead = async (req, res) => {
  try {
    const userPhone = req.user.phone;
    await Notification.updateMany(
      { 
        $or: [{ targetPhone: null }, { targetPhone: userPhone }],
        readBy: { $ne: userPhone }
      },
      { $push: { readBy: userPhone } }
    );
    res.json({ message: 'All marked as read' });
  } catch (error) {
    console.error('[Notification Controller] markAllRead Error:', error);
    res.status(500).json({ message: 'Server error marking read' });
  }
};

// User soft-deletes a notification
exports.deleteUserNotification = async (req, res) => {
  try {
    const userPhone = req.user.phone;
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, {
      $addToSet: { deletedBy: userPhone }
    });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('[Notification Controller] deleteUserNotification Error:', error);
    res.status(500).json({ message: 'Server error deleting user notification' });
  }
};

// --- Admin Methods ---

// Get all notifications (Admin only)
exports.getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    console.error('[Notification Controller] getAllNotifications Error:', error);
    res.status(500).json({ message: 'Server error fetching all notifications' });
  }
};

// Create a new notification (Admin only)
exports.createNotification = async (req, res) => {
  try {
    const { title, body, targetPhone, type } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({ message: 'Title and body are required' });
    }
    
    const newNotification = new Notification({
      title,
      body,
      targetPhone: targetPhone || null,
      type: type || 'info'
    });
    
    await newNotification.save();
    
    // Send Push Notification asynchronously
    try {
      if (targetPhone) {
        const user = await User.findOne({ phone: targetPhone });
        if (user && user.fcmToken) {
          fcmService.sendPushNotification(user.fcmToken, title, body);
        }
      } else {
        const users = await User.find({ fcmToken: { $exists: true, $ne: '' } });
        for (const user of users) {
          fcmService.sendPushNotification(user.fcmToken, title, body);
        }
      }
    } catch (pushErr) {
      console.error('[Notification Controller] Push error:', pushErr);
    }
    
    res.status(201).json(newNotification);
  } catch (error) {
    console.error('[Notification Controller] createNotification Error:', error);
    res.status(500).json({ message: 'Server error creating notification' });
  }
};

// Update a notification (Admin only)
exports.updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, targetPhone, type } = req.body;
    
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    notification.title = title || notification.title;
    notification.body = body || notification.body;
    if (targetPhone !== undefined) {
      notification.targetPhone = targetPhone === '' ? null : targetPhone;
    }
    notification.type = type || notification.type;
    
    await notification.save();
    res.json(notification);
  } catch (error) {
    console.error('[Notification Controller] updateNotification Error:', error);
    res.status(500).json({ message: 'Server error updating notification' });
  }
};

// Delete a notification (Admin only)
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedNotification = await Notification.findByIdAndDelete(id);
    
    if (!deletedNotification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('[Notification Controller] deleteNotification Error:', error);
    res.status(500).json({ message: 'Server error deleting notification' });
  }
};
