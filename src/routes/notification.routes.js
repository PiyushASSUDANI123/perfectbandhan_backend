const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const auth = require('../middleware/auth.middleware');
const admin = require('../middleware/admin.middleware');

// User routes
router.get('/', auth, notificationController.getUserNotifications);
router.post('/read-all', auth, notificationController.markAllRead);
router.delete('/:id', auth, notificationController.deleteUserNotification);

// Admin routes
router.get('/admin', auth, admin, notificationController.getAllNotifications);
router.post('/admin', auth, admin, notificationController.createNotification);
router.put('/admin/:id', auth, admin, notificationController.updateNotification);
router.delete('/admin/:id', auth, admin, notificationController.deleteNotification);

module.exports = router;
