const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/login-pass', authController.loginWithPassword);
router.post('/set-password', authController.setPassword);
router.get('/firebase-config', authController.getFirebaseConfig);

module.exports = router;
