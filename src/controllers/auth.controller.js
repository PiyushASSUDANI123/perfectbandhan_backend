const cacheService = require('../services/cache.service');
const jwt = require('jsonwebtoken');
const userController = require('./user.controller');
const whatsappService = require('../services/whatsapp.service');
const { GoogleGenAI } = require("@google/genai");
const AppConfig = require('../models/config.model');
const User = require('../models/user.model');

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

    // Generate OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Store in MongoDB instead of RAM to survive PM2 restarts
    const expiresAt = new Date(Date.now() + 300000); // 5 mins
    await User.findOneAndUpdate(
      { phone },
      { $set: { verificationOtp: otp, otpExpiresAt: expiresAt } },
      { upsert: true, new: true }
    );

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

    // Fetch from MongoDB to survive server restarts
    const userRecord = await User.findOne({ phone });
    if (!userRecord || !userRecord.verificationOtp || !userRecord.otpExpiresAt) {
      return res.status(400).json({ status: 'error', message: 'No OTP requested or OTP has expired.' });
    }

    if (new Date() > userRecord.otpExpiresAt) {
      return res.status(400).json({ status: 'error', message: 'OTP has expired. Please request a new one.' });
    }

    const cleanOtp = String(otp).trim();
    const cleanDbOtp = String(userRecord.verificationOtp).trim();

    // Direct check
    if (cleanDbOtp === cleanOtp) {
      // clear the OTP
      await User.updateOne(
        { _id: userRecord._id },
        { $unset: { verificationOtp: 1, otpExpiresAt: 1 } }
      );
      
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

    const config = await AppConfig.findOne();
    const bypassPassword = config?.developerBypassPassword || '123456';

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

    if (phone === '9413879444' && password === bypassPassword) {
      const token = jwt.sign({ phone, isAdmin: true }, JWT_SECRET, { expiresIn: '30d' });
      return res.status(200).json({
        status: 'success',
        message: 'Login successful',
        token,
        isAdmin: true,
        isProfileComplete: true
      });
    }

    // Support password login for any registered profile with custom password (or dynamic bypass password)
    const userProfile = await userController.getProfile(phone);
    if (userProfile) {
      const dbPassword = userProfile.password || '';
      if (password === bypassPassword || (dbPassword && password === dbPassword)) {
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
      message: 'Incorrect mobile number or password. Please try again.'
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
      await User.updateOne({ phone }, { $set: { password } });
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
    console.log(`[Auth] Received AI bio generation request for name: ${data.firstName || 'Unknown'}`);
    
    // Check if API key exists, otherwise fallback to templates
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `Write a short, engaging, and professional matrimonial bio for a Sindhi matchmaking profile. 
        Name: ${data.firstName || 'Not specified'}
        Gender: ${data.gender || 'Not specified'}
        City: ${data.city || 'Not specified'}
        Education: ${data.education || 'Not specified'}
        Profession: ${data.profession !== 'Not Working' ? (data.jobPost || data.profession) : 'Not specified'}
        About Family: ${data.aboutFamily || 'Traditional Sindhi family'}
        
        The tone should be polite, respectful, and slightly modern while valuing Sindhi traditions. Do NOT use emojis. Keep it under 60 words. Speak in first-person (e.g. "I am...").`;

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        let bioText = result.text.trim();
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
exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ status: 'error', message: 'ID Token is required.' });
    }

    let decodedToken;
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      if (!response.ok) {
        throw new Error('Invalid Google Sign-In token response');
      }
      decodedToken = await response.json();
    } catch (err) {
      console.error('[Google Login] Invalid token:', err);
      return res.status(401).json({ status: 'error', message: 'Invalid Google Sign-In token.' });
    }

    const { email, sub: googleId } = decodedToken;
    if (!email) {
      return res.status(400).json({ status: 'error', message: 'Email not found in Google account.' });
    }

    const User = require('../models/user.model');
    // Check if user already exists by email or googleId
    let user = await User.findOne({ $or: [{ email }, { googleId }] });

    if (user) {
      // User exists, issue normal JWT
      const token = jwt.sign({ phone: user.phone }, JWT_SECRET, { expiresIn: '30d' });
      const isProfileComplete = await userController.profileExists(user.phone);
      return res.status(200).json({
        status: 'success',
        message: 'Google login successful',
        token,
        isProfileComplete
      });
    } else {
      // New user, issue special onboarding JWT
      const token = jwt.sign({ email, googleId, authProvider: 'google' }, JWT_SECRET, { expiresIn: '1d' });
      return res.status(200).json({
        status: 'success',
        message: 'Google auth successful. Proceed to onboarding.',
        token,
        isProfileComplete: false
      });
    }
  } catch (error) {
    console.error('[Auth Error - Google Login]', error);
    return res.status(500).json({ status: 'error', message: 'Server error during Google login.' });
  }
};
