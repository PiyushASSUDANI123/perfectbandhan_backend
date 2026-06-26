const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const authController = require('../controllers/auth.controller');

// Anti-spam: max 5 OTP requests per IP per 60 seconds
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many OTP requests. Please wait 1 minute before requesting again.'
  }
});

router.post('/send-otp', otpLimiter, authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/login-pass', authController.loginWithPassword);
router.post('/set-password', authController.setPassword);
router.get('/firebase-config', authController.getFirebaseConfig);
router.post('/generate-bio', authController.generateBio);

module.exports = router;
