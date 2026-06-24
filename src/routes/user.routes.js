const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const auth = require('../middleware/auth.middleware');

router.post('/profile', auth, userController.createProfile);
router.get('/profile/me', auth, userController.getMyProfile);
router.get('/profiles', auth, userController.getProfiles);

// Double Opt-In Interest Routes
router.post('/interest', auth, userController.sendInterest);
router.get('/interests', auth, userController.getInterests);
router.post('/interest/accept', auth, userController.acceptInterest);

// Admin Portal Routes
router.get('/admin/users', auth, userController.getAllUsersAdmin);

// UGC Safety Block and Report Routes
router.post('/report', auth, userController.reportUser);
router.post('/block', auth, userController.blockUser);

// Password Management
router.post('/password', auth, userController.changePassword);

// In-App Chat Routes
router.get('/chat/:targetUserId', auth, userController.getChatMessages);
router.post('/chat/send', auth, userController.sendChatMessage);

// Admin Control Panel Routes
router.post('/admin/push', auth, userController.adminBroadcastPush);
router.put('/admin/user/:userId', auth, userController.adminEditUser);
router.put('/admin/change-password', auth, userController.adminChangePassword);

module.exports = router;
