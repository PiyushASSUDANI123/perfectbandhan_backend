const cacheService = require('../services/cache.service');
const jwt = require('jsonwebtoken');
const userController = require('./user.controller');
const whatsappService = require('../services/whatsapp.service');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('[Warning] JWT_SECRET is not configured in backend environment variables.');
}

// Track hit counts for non-bypass numbers to trigger simulated API errors (429/500)
let requestCount = 0;

exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    // Security validation check
    if (!phone || typeof phone !== 'string' || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        status: 'error',
        message: 'Security check failed. Phone number must be exactly 10 digits.'
      });
    }

    console.log(`[Auth] Received request to send OTP to +91 ${phone}`);

    // If profile exists, block OTP login and direct to password login (unless they are resetting)
    // EXCEPTION: 9413879444 can always login via OTP (direct entry)
    const isProfileComplete = await userController.profileExists(phone);
    if (isProfileComplete && phone !== '9413879444' && !req.body.reset) {
      return res.status(403).json({
        status: 'registered',
        message: 'You are already registered. Please login using your Password.'
      });
    }

    // Trigger mock errors for non-bypass numbers to test robust client handling
    if (phone !== '9413879444') {
      requestCount++;

      // Every 3rd hit on other numbers returns a Rate Limit (429) or Server Error (500)
      if (requestCount % 3 === 0) {
        if (requestCount % 6 === 0) {
          console.log(`[Auth] Simulating 500 Internal Server Crash for +91 ${phone}`);
          return res.status(500).json({
            status: 'error',
            message: 'Internal server error. Database connection timed out.'
          });
        } else {
          console.log(`[Auth] Simulating 429 Too Many Requests (Rate Limit) for +91 ${phone}`);
          return res.status(429).json({
            status: 'error',
            message: 'Rate limit exceeded. Please wait 1 minute before requesting another OTP.'
          });
        }
      }
    }

    // Generate OTP (For the bypass number, force 123456. Else generate a random 6-digit code)
    const otp = phone === '9413879444' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();

    // Cache the OTP code with a 5-minute expiry
    cacheService.set(phone, otp, 300000);

    // Dispatch OTP through isolated WhatsApp Service
    await whatsappService.sendOtp(phone, otp);

    return res.status(200).json({
      status: 'success',
      message: 'OTP sent'
    });
  } catch (error) {
    console.error('[Auth Error]', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server crashed processing request.'
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number and OTP code are required.'
      });
    }

    console.log(`[Auth] Verifying OTP "${otp}" for +91 ${phone}`);

    // Fetch cached OTP code
    const cachedOtp = cacheService.get(phone);

    // Bypass check
    if (phone === '9413879444' && otp === '123456') {
      cacheService.delete(phone); // invalidate
      const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '30d' });
      
      // Always treat developer profile as complete to bypass onboarding
      const isProfileComplete = true; 

      return res.status(200).json({
        status: 'success',
        message: 'OTP verified successfully',
        token,
        isProfileComplete
      });
    }

    // Direct check
    if (cachedOtp && cachedOtp === otp) {
      cacheService.delete(phone); // invalidate
      const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '30d' });
      const isProfileComplete = await userController.profileExists(phone);
      return res.status(200).json({
        status: 'success',
        message: 'OTP verified successfully',
        token,
        isProfileComplete
      });
    }

    return res.status(400).json({
      status: 'error',
      message: 'Invalid OTP code. Please check your WhatsApp messages.'
    });
  } catch (error) {
    console.error('[Auth Error]', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error verifying OTP.'
    });
  }
};

exports.loginWithPassword = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone and Password are required.'
      });
    }

    console.log(`[Auth] Validating password credentials for +91 ${phone}`);

    const adminPhone = process.env.ADMIN_PHONE || '9999999999';
    const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword';

    if (phone === adminPhone && password === adminPassword) {
      console.log(`[Auth] Admin login successful for +91 ${phone}`);
      const token = jwt.sign({ phone, isAdmin: true }, JWT_SECRET, { expiresIn: '30d' });
      return res.status(200).json({
        status: 'success',
        message: 'Admin login successful',
        token,
        isAdmin: true,
        isProfileComplete: true
      });
    }

    if (phone === '9413879444' && password === '123456') {
      const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '30d' });
      const isProfileComplete = await userController.profileExists(phone);
      return res.status(200).json({
        status: 'success',
        message: 'Login successful',
        token,
        isProfileComplete
      });
    }

    // Support password login for any registered profile with custom password (or standard password bypass 123456)
    const userProfile = await userController.getProfile(phone);
    if (userProfile) {
      const dbPassword = userProfile.password || '';
      if (password === '123456' || (dbPassword && password === dbPassword)) {
        const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '30d' });
        const isProfileComplete = true;
        return res.status(200).json({
          status: 'success',
          message: 'Login successful',
          token,
          isProfileComplete
        });
      }
    }

    return res.status(400).json({
      status: 'error',
      message: 'Invalid credentials. Please enter correct credentials.'
    });
  } catch (error) {
    console.error('[Auth Error]', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error validating login credentials.'
    });
  }
};

exports.getFirebaseConfig = (req, res) => {
  try {
    return res.status(200).json({
      apiKey: process.env.FIREBASE_API_KEY || "",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
      projectId: process.env.FIREBASE_PROJECT_ID || "",
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
      appId: process.env.FIREBASE_APP_ID || "",
      measurementId: process.env.FIREBASE_MEASUREMENT_ID || ""
    });
  } catch (error) {
    console.error('[Config Error]', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error retrieving configuration.'
    });
  }
};

exports.setPassword = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ status: 'error', message: 'Phone and Password are required.' });
    }
    const User = require('../models/user.model');
    let user = await User.findOne({ phone });
    if (!user) {
      // Create a skeleton user so password is set
      user = new User({
        phone,
        password,
        profileFor: 'Self',
        gender: 'Male',
        firstName: 'New',
        lastName: 'User',
        email: 'temp@sindhishadi.com',
        dob: new Date('2000-01-01'),
        height: "5'5\"",
        city: 'City',
        state: 'State',
        maritalStatus: 'Never Married',
        education: 'None',
        profession: 'Not Working',
        location: 'City, State',
        incomeBracket: 'Private',
        uploadedPhotos: ['uploaded_photo_0']
      });
      await user.save();
    } else {
      user.password = password;
      await user.save();
    }
    console.log(`[Password Config] Saved custom password for +91 ${phone}`);
    return res.status(200).json({ status: 'success', message: 'Password set successfully.' });
  } catch (err) {
    console.error('[Auth setPassword Error]', err);
    return res.status(500).json({ status: 'error', message: 'Failed to configure account password.' });
  }
};
