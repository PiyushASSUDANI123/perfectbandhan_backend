const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const auth = require('../middleware/auth.middleware');

router.post('/profile', auth, userController.createProfile);
router.get('/profile/me', auth, userController.getMyProfile);
router.get('/profile/:id', auth, userController.getProfileById);
router.get('/profiles', auth, userController.getProfiles);

// Astrology Insight
router.post('/astrology-insight', auth, userController.getAstrologyInsight);

// Double Opt-In Interest Routes
router.post('/interest', auth, userController.sendInterest);
router.get('/interests', auth, userController.getInterests);
router.get('/activity', auth, userController.getActivity);
router.post('/track-activity', auth, userController.trackActivity);
router.post('/interest/accept', auth, userController.acceptInterest);
router.post('/interest/reject', auth, userController.rejectInterest);
router.post('/interest/cancel', auth, userController.cancelInterest);

// Contextual AI Icebreakers Route
router.get('/chat/icebreakers/:targetPhone', auth, userController.getIcebreakers);

// --- MODERATION ---
router.post('/block', auth, userController.blockUser);
router.post('/unblock', auth, userController.unblockUser);
router.get('/blocked', auth, userController.getBlockedUsers);
router.post('/report', auth, userController.reportUser);
router.get('/reports', auth, userController.getReports);
router.get('/blocks', auth, userController.getBlocks);

// Admin Portal Routes
router.get('/admin/users', auth, userController.getAllUsersAdmin);

// Password Management
router.post('/password', auth, userController.changePassword);

// FCM Token Management
router.post('/fcm-token', auth, userController.updateFcmToken);

// Account Deletion
router.delete('/account', auth, userController.deleteAccount);

// Preferences & Hobbies
router.put('/partner-preferences', auth, userController.updatePartnerPreferences);
router.put('/hobbies', auth, userController.updateHobbies);

// In-App Chat Routes
router.get('/chats', auth, userController.getConversations);
router.get('/chat/:targetUserId', auth, userController.getChatMessages);
router.post('/chat/send', auth, userController.sendChatMessage);

// Admin Control Panel Routes
router.post('/admin/push', auth, userController.adminBroadcastPush);
router.put('/admin/user/:userId', auth, userController.adminEditUser);
router.delete('/admin/user/:userId', auth, userController.adminDeleteUser);
router.put('/admin/change-password', auth, userController.adminChangePassword);

// App Version & Update Management
router.get('/app-config', userController.getAppConfig);              // Public: client checks for updates
router.put('/admin/app-config', auth, userController.updateAppConfig); // Admin: set version rules

// WhatsApp Unlock
router.post('/whatsapp/request', auth, userController.requestWhatsappUnlock);
router.post('/whatsapp/approve', auth, userController.approveWhatsappUnlock);

module.exports = router;
