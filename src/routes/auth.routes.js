const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const authController = require('../controllers/auth.controller');

// Rate limiter for sensitive auth actions
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests. Please wait 1 minute before trying again.'
  }
});

// --- Login & Registration ---
router.post('/login-pass', authController.loginWithPassword);
router.post('/set-password', authController.setPassword);
router.post('/check-phone', authController.checkPhone);

// --- Forgot Password (email-based) ---
router.post('/get-email-hint', authLimiter, authController.getEmailHint);
router.post('/reset-password-with-email', authLimiter, authController.resetPasswordWithEmail);

// --- Google Login ---
router.post('/google-login', authController.googleLogin);

// --- Misc ---
router.get('/firebase-config', authController.getFirebaseConfig);
router.post('/generate-bio', authController.generateBio);

// --- Legacy OTP routes (kept for backward compat, effectively disabled via whatsapp service) ---
router.post('/send-otp', authLimiter, authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

module.exports = router;
