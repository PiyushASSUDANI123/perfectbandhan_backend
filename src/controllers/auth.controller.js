const cacheService = require('../services/cache.service');
const jwt = require('jsonwebtoken');
const userController = require('./user.controller');
const whatsappService = require('../services/whatsapp.service');
const { GoogleGenerativeAI } = require("@google/generative-ai");

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
    const isProfileComplete = await userController.profileExists(phone);
    if (isProfileComplete && !req.body.reset) {
      return res.status(403).json({
        status: 'registered',
        message: 'You are already registered. Please login using your Password.'
      });
    }

    // Check for OTP cooldown to prevent WhatsApp bans
    const cooldownKey = `cooldown_${phone}`;
    const remainingCooldown = cacheService.get(cooldownKey);
    if (remainingCooldown) {
      return res.status(429).json({
        status: 'error',
        message: `Please wait before requesting another OTP to avoid spam.`
      });
    }

    // Generate OTP (For tester numbers, force 1234. Else generate a random 4-digit code)
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Cache the OTP code with a 5-minute expiry
    cacheService.set(phone, otp, 300000);

    // Set 60 second cooldown to prevent WhatsApp spam ban
    cacheService.set(cooldownKey, true, 60000);

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

    // Force dummy OTP 1234 ONLY for review testers if needed, else normal flow
    // No bypass check for profile completeness

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

    const adminPhone = process.env.ADMIN_PHONE || '12347890';
    const adminPassword = process.env.ADMIN_PASSWORD || 'piyushassudani@96';

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

    if (phone === '9413879444' && password === '1234') {
      const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '30d' });
      // Hardcode isProfileComplete to false so it always goes directly to the form
      return res.status(200).json({
        status: 'success',
        message: 'Login successful',
        token,
        isProfileComplete: false
      });
    }

    // Support password login for any registered profile with custom password (or standard password bypass 1234)
    const userProfile = await userController.getProfile(phone);
    if (userProfile) {
      const dbPassword = userProfile.password || '';
      if (password === '1234' || (dbPassword && password === dbPassword)) {
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

// Removed GoogleGenAI import since we are using hardcoded templates

exports.generateBio = async (req, res) => {
  try {
    const data = req.body;
    
    // Check if API key exists, otherwise fallback to templates
    if (process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Write a short, engaging, and professional matrimonial bio for a Sindhi matchmaking profile. 
        Name: ${data.firstName || 'Not specified'}
        Gender: ${data.gender || 'Not specified'}
        City: ${data.city || 'Not specified'}
        Education: ${data.education || 'Not specified'}
        Profession: ${data.profession !== 'Not Working' ? (data.jobPost || data.profession) : 'Not specified'}
        About Family: ${data.aboutFamily || 'Traditional Sindhi family'}
        
        The tone should be polite, respectful, and slightly modern while valuing Sindhi traditions. Do NOT use emojis. Keep it under 60 words. Speak in first-person (e.g. "I am...").`;

        const result = await model.generateContent(prompt);
        let bioText = result.response.text().trim();
        // Remove markdown formatting if any
        bioText = bioText.replace(/\*/g, '');

        return res.status(200).json({
          status: 'success',
          bio: bioText
        });
      } catch (aiError) {
        console.error('[Gemini AI Error] Falling back to templates:', aiError.message);
      }
    }

    // Fallback logic
    const name = data.firstName || 'I';
    const city = data.city || 'a nice city';
    const profession = data.profession !== 'Not Working' ? (data.jobPost || data.profession) : 'a professional';
    const education = data.education || 'well-educated';
    const isFemale = data.gender === 'Female';
    const familyText = data.aboutFamily ? ' We are a traditional yet modern Sindhi family.' : ' Coming from a well-respected Sindhi family with strong cultural roots.';

    const templates = [
      `Jai Jhulelal! I am ${name}, currently working as ${profession} in ${city}. Having completed my education (${education}), I am looking for a partner who values our Sindhi traditions while balancing modern life.${familyText}`,
      `Hello! I'm ${name}, residing in ${city}. Professionally, I am ${profession} and have always valued hard work and family. My educational background is ${education}. I'm searching for a compassionate, understanding ${isFemale ? 'groom' : 'bride'} who shares similar family-oriented Sindhi values.${familyText}`,
      `Jai Jhulelal. Belonging to a decent Sindhi family in ${city}, I am ${name}. I am ${education} qualified and currently occupied as ${profession}. Family is my top priority, and I am looking for someone who will be a great addition to ours.${familyText}`,
      `Hi, I am ${name} from ${city}. I hold a degree in ${education} and am established as ${profession}. I believe in keeping our beautiful Sindhi heritage alive and am seeking a partner who is respectful, well-cultured, and family-oriented.${familyText}`,
      `Warm greetings! I am ${name}, working as ${profession} in ${city}. My academic background is ${education}. I am looking forward to starting a beautiful new chapter of life with an understanding and loving partner who respects our rich Sindhi culture.${familyText}`,
      `Jai Jhulelal! My name is ${name}. Raised with good Sindhi values, I am currently living in ${city} and working as ${profession}. After finishing my ${education}, my goal is to find a compatible companion who believes in mutual respect and strong family bonds.${familyText}`
    ];

    const randomIndex = Math.floor(Math.random() * templates.length);
    const bioText = templates[randomIndex];

    return res.status(200).json({
      status: 'success',
      bio: bioText
    });
  } catch (error) {
    console.error('[Generate Bio Error]', error);
    return res.status(500).json({ status: 'error', message: 'Failed to generate bio.' });
  }
};
