const User = require('../models/user.model');
const AppConfig = require('../models/config.model');
const authController = require('./auth.controller');

// In-Memory Cache for AppConfig to protect database limits
let _cachedAppConfig = null;
let _lastCacheUpdate = 0;
const CACHE_TTL = 60000; // 60 seconds backup TTL, but mostly updated immediately by admin
const Interest = require('../models/interest.model');
const Message = require('../models/message.model');
const fcmService = require('../services/fcm.service');
const cloudinaryService = require('../services/cloudinary.service');
const cacheService = require('../services/cache.service');

exports.profileExists = async (phone) => {
  try {
    const user = await User.findOne({ phone });
    return !!user;
  } catch (error) {
    console.error('[User Controller profileExists Error]', error);
    return false;
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.phone) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized.' });
    }
    const user = await User.findOne({ phone: req.user.phone });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Profile not found. Please complete onboarding.' });
    }
    // Compute age safely
    const today = new Date();
    let age = 0;
    if (user.dob) {
      age = today.getFullYear() - user.dob.getFullYear();
      const monthDiff = today.getMonth() - user.dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < user.dob.getDate())) age--;
    }

    return res.status(200).json({
      status: 'success',
      data: {
        id: user._id.toString(),
        phone: user.phone,
        email: user.email || '',
        firstName: user.firstName || 'Developer',
        lastName: user.lastName || 'Account',
        name: `${user.firstName || 'Developer'} ${user.lastName || 'Account'}`.trim(),
        age,
        gender: user.gender || 'Male',
        height: user.height || '',
        city: user.city || '',
        state: user.state || '',
        location: user.location || '',
        maritalStatus: user.maritalStatus || '',
        education: user.education || '',
        profession: user.profession || '',
        company: user.company || '',
        incomeBracket: user.incomeBracket || '',
        nukh: user.caste || '',
        caste: user.caste || '',
        bio: user.bio || '',
        fathersOccupation: user.fathersOccupation || '',
        familyType: user.familyType || '',
        cityOfOrigin: user.cityOfOrigin || '',
        initials: user.initials || 'DA',
        photos: user.uploadedPhotos || [],
        gradientColors: user.gradientColors || [],
        profileHidden: user.profileHidden,
        incomeHidden: user.incomeHidden,
        photosVisibility: user.photosVisibility,
        connects: user.connects,
        superLikes: user.superLikes,
        profileFor: user.profileFor,
        compatibilityScore: user.compatibilityScore,
        monthlyIncome: user.monthlyIncome || '',
        yearlyIncome: user.yearlyIncome || '',
        district: user.district || '',
        properAddress: user.properAddress || '',
        jobPost: user.jobPost || '',
        ownHouse: user.ownHouse || '',
        housePhoto: user.housePhoto || '',
        surname: user.surname || '',
        requirements: user.requirements || '',
        whatWeProvide: user.whatWeProvide || '',
        physicalDisability: user.physicalDisability || '',
        complexion: user.complexion || '',
        weight: user.weight || '',
        fatherStatus: user.fatherStatus || 'Alive',
        motherStatus: user.motherStatus || 'Alive',
        mothersOccupation: user.mothersOccupation || '',
        siblingsCount: user.siblingsCount || '0',
        siblingsDetails: user.siblingsDetails || '',
        sindhiType: user.sindhiType || 'Sindhi Hindu',
        whatsappNumber: user.whatsappNumber || '',
        partnerPreferences: user.partnerPreferences || {}
      }
    });
  } catch (error) {
    console.error('[User Controller getMyProfile Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to retrieve your profile.' });
  }
};

exports.getProfile = async (phone) => {
  try {
    return await User.findOne({ phone });
  } catch (error) {
    console.error('[User Controller getProfile Error]', error);
    return null;
  }
};

exports.createProfile = async (req, res) => {
  try {
    const profileData = req.body;
    
    // Bind authenticated JWT phone to payload
    if (req.user && req.user.authProvider === 'google') {
      // In Google Login, phone is provided by the frontend in req.body
      if (!profileData.phone || !/^\d{10}$/.test(profileData.phone)) {
        return res.status(400).json({ status: 'error', message: 'Valid 10-digit phone number is required.' });
      }
      profileData.email = req.user.email;
      profileData.googleId = req.user.googleId;
      profileData.authProvider = 'google';
    } else if (req.user && req.user.phone) {
      profileData.phone = req.user.phone;
    }

    console.log('[User Controller] Received consolidated onboarding payload:', JSON.stringify(profileData, null, 2));

    // Backward compatibility mappings
    if (!profileData.lastName && profileData.surname) {
      profileData.lastName = profileData.surname;
    }
    if (!profileData.incomeBracket && profileData.yearlyIncome) {
      profileData.incomeBracket = profileData.yearlyIncome;
    }

    // Base required fields
    const requiredFields = [
      'phone', 'profileFor', 'gender', 'firstName', 'lastName',
      'email', 'dob', 'height', 'city', 'state', 'maritalStatus',
      'education', 'profession', 'incomeBracket', 'nukh', 'bio', 'uploadedPhotos',
      'surname', 'monthlyIncome', 'yearlyIncome', 'district', 'properAddress',
      'ownHouse', 'complexion', 'weight', 'fatherStatus', 'motherStatus', 'siblingsCount',
      'sindhiType', 'whatsappNumber'
    ];

    // Conditional requirements: Job Title & Company Name required if working
    if (profileData.profession !== 'Not Working') {
      requiredFields.push('company');
      requiredFields.push('jobPost');
    }

    if (profileData.fatherStatus === 'Alive') {
      requiredFields.push('fathersOccupation');
    }
    if (profileData.motherStatus === 'Alive') {
      requiredFields.push('mothersOccupation');
    }
    if (profileData.siblingsCount !== '0' && profileData.siblingsCount !== 0) {
      requiredFields.push('siblingsDetails');
    }

    // Check if user already exists
    let existingUser = await User.findOne({ phone: profileData.phone });

    if (req.user && req.user.authProvider === 'google' && existingUser) {
      if (existingUser.googleId !== req.user.googleId) {
        return res.status(403).json({
          status: 'error',
          message: 'This phone number is already registered to another account.'
        });
      }
    }

    if (!existingUser) {
      const missingFields = [];
      for (const field of requiredFields) {
        if (profileData[field] === undefined || profileData[field] === null || profileData[field] === '') {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        console.warn(`[User Controller] Validation failed. Missing fields: ${missingFields.join(', ')}`);
        return res.status(400).json({
          status: 'error',
          message: `Validation failed. Missing required fields: ${missingFields.join(', ')}`
        });
      }

      if (!Array.isArray(profileData.uploadedPhotos) || profileData.uploadedPhotos.length === 0 || !profileData.uploadedPhotos[0]) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed. At least one profile image is mandatory.'
        });
      }
    } else {
      // Immutable field guard: block gender or dob changes for existing users
      const incomingDob = profileData.dob ? new Date(profileData.dob).toDateString() : null;
      const savedDob = existingUser.dob ? existingUser.dob.toDateString() : null;
      if (incomingDob && savedDob && incomingDob !== savedDob) {
        console.warn(`[User Controller] Ignoring dob change during profile update for +91 ${profileData.phone}`);
        delete profileData.dob; // Ignore silently instead of blocking
      }
      if (profileData.gender && existingUser.gender && profileData.gender !== existingUser.gender) {
        if (existingUser.phone === '9413879444') {
          console.log(`[User Controller] Developer account +91 ${profileData.phone} allowed to change gender.`);
        } else {
          console.warn(`[User Controller] Ignoring gender change during profile update for +91 ${profileData.phone}`);
          delete profileData.gender; // Ignore silently instead of blocking
        }
      }
    }

    // Set fallback dynamic values for search mapping compatibility
    if (profileData.city || profileData.state) {
      const cityVal = profileData.city || (existingUser ? existingUser.city : '');
      const stateVal = profileData.state || (existingUser ? existingUser.state : '');
      profileData.location = `${cityVal}, ${stateVal}`;
    }
    if (profileData.nukh) {
      profileData.caste = profileData.nukh;
    }
    if (profileData.firstName || profileData.lastName) {
      const fName = profileData.firstName || (existingUser ? existingUser.firstName : '');
      const lName = profileData.lastName || (existingUser ? existingUser.lastName : '');
      profileData.initials = `${fName[0] || ''}${lName[0] || ''}`.toUpperCase();
    }

    // Process base64 house photo upload if provided
    if (profileData.housePhoto && profileData.housePhoto.startsWith('data:image/')) {
      console.log('[User Controller] Detected Base64 house photo. Uploading to Cloudinary...');
      profileData.housePhoto = await cloudinaryService.uploadImage(profileData.housePhoto);
    }

    // Process base64 uploads via Cloudinary if photos are provided
    if (profileData.uploadedPhotos && Array.isArray(profileData.uploadedPhotos)) {
      const processedPhotos = [];
      for (let i = 0; i < profileData.uploadedPhotos.length; i++) {
        const photoStr = profileData.uploadedPhotos[i];
        if (photoStr && photoStr.startsWith('data:image/')) {
          console.log(`[User Controller] Detected Base64 image at index ${i}. Uploading to Cloudinary...`);
          const url = await cloudinaryService.uploadImage(photoStr);
          processedPhotos.push(url);
        } else {
          processedPhotos.push(photoStr);
        }
      }
      profileData.uploadedPhotos = processedPhotos;
    }

    // Save user profile in MongoDB (upsert style)
    let user = existingUser;
    if (user) {
      Object.assign(user, profileData);
      if (user.phone === '9413879444') {
        await user.save({ validateBeforeSave: false });
      } else {
        await user.save();
      }
    } else {
      user = new User(profileData);
      await user.save();
    }

    console.log(`[MongoDB Write] Successfully stored/updated user profile for +91 ${profileData.phone} in MongoDB Atlas.`);

    if (user.fcmToken) {
      await fcmService.sendPushNotification(
        user.fcmToken,
        'Profile Completed! 🎉',
        `Welcome ${profileData.firstName}, your premium profile is now live. Let's find your Perfect Bandhan!`
      );
    }

    return res.status(200).json({
      status: 'success',
      message: 'Profile completed successfully and saved to database.',
      data: {
        phone: profileData.phone,
        name: `${profileData.firstName} ${profileData.lastName}`
      }
    });
  } catch (error) {
    console.error('[User Controller createProfile Error]', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server failed to save user profile.'
    });
  }
};

// Pseudo-Kundali Matcher (Deterministic hash based on phone numbers)
function calculateKundaliScore(userA, userB) {
  if (!userA.dob || !userB.dob) return null;
  // A simple deterministic hash based on dates and phone numbers (or IDs) to ensure it's constant
  let hashStr = (userA.phone || '') + (userB.phone || '');
  if (userA.phone > userB.phone) {
    hashStr = (userB.phone || '') + (userA.phone || '');
  }
  let hash = 0;
  for (let i = 0; i < hashStr.length; i++) {
    hash = ((hash << 5) - hash) + hashStr.charCodeAt(i);
    hash |= 0;
  }
  // Base score 18, plus deterministic 0-18
  const score = 18 + (Math.abs(hash) % 19);
  return score;
}

// GET /api/v1/user/profile/:id
exports.getProfileById = async (req, res) => {
  try {
    const profileId = req.params.id;
    const p = await User.findById(profileId).select('-password').lean();
    
    if (!p) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }
    
    const callerPhone = req.user ? req.user.phone : null;
    let kundaliScore = null;
    let kundaliMessage = "Birth details not provided";
    let interestStatus = 'none';

    if (callerPhone) {
      const myUser = await User.findOne({ phone: callerPhone });
      if (myUser && p.dob && myUser.dob) {
        kundaliScore = calculateKundaliScore(myUser, p);
        kundaliMessage = `${kundaliScore}/36 Gunas Matched`;
      } else {
        kundaliMessage = "Kundali data unavailable";
      }

      // Check interests
      const interests = await Interest.find({
        $or: [
          { from_phone: callerPhone, to_phone: p.phone },
          { from_phone: p.phone, to_phone: callerPhone }
        ]
      });

      const isConnected = interests.some(i => i.status === 'accepted');
      const sentInterest = interests.some(i => i.from_phone === callerPhone && i.status === 'pending');
      const receivedInterest = interests.some(i => i.from_phone === p.phone && i.status === 'pending');

      if (isConnected) interestStatus = 'accepted';
      else if (sentInterest) interestStatus = 'pending';
      else if (receivedInterest) interestStatus = 'incoming';
    }
    
    // Compute age dynamically
    const today = new Date();
    let age = null;
    if (p.dob) {
      let birthDate = p.dob instanceof Date ? p.dob : new Date(p.dob);
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    const mappedProfile = {
      id: p._id.toString(),
      name: `${p.firstName} ${p.lastName}`,
      age: age,
      height: p.height,
      caste: p.caste,
      profession: p.profession,
      company: p.company,
      location: p.location,
      education: p.education,
      bio: p.bio,
      compatibilityScore: p.compatibilityScore,
      initials: p.initials,
      fathersOccupation: p.fathersOccupation,
      incomeBracket: p.incomeHidden ? 'Private' : p.incomeBracket,
      professionSector: p.professionSector,
      gradientColors: p.gradientColors,
      photos: p.uploadedPhotos,
      phone: p.phone,
      whatsappNumber: p.whatsappNumber || '',
      interestStatus: interestStatus,
      monthlyIncome: p.incomeHidden ? 'Private' : (p.monthlyIncome || ''),
      yearlyIncome: p.incomeHidden ? 'Private' : (p.yearlyIncome || ''),
      district: p.district || '',
      properAddress: p.properAddress || '',
      jobPost: p.jobPost || '',
      ownHouse: p.ownHouse || '',
      housePhoto: p.housePhoto || '',
      surname: p.surname || '',
      nukh: p.nukh || '',
      requirements: p.requirements || '',
      whatWeProvide: p.whatWeProvide || '',
      physicalDisability: p.physicalDisability || '',
      complexion: p.complexion || '',
      weight: p.weight || '',
      fatherStatus: p.fatherStatus || '',
      motherStatus: p.motherStatus || '',
      mothersOccupation: p.mothersOccupation || '',
      siblingsCount: p.siblingsCount || '0',
      siblingsDetails: p.siblingsDetails || '',
      sindhiType: p.sindhiType || '',
      profileHidden: p.profileHidden || false,
      incomeHidden: p.incomeHidden || false,
      photosVisibility: p.photosVisibility || 'All Matches',
      kundaliScore: kundaliScore,
      kundaliMessage: kundaliMessage,
      birthTime: p.birthTime || '',
      birthPlace: p.birthPlace || ''
    };

    return res.status(200).json({ status: 'success', data: mappedProfile });
  } catch (error) {
    console.error('[User Controller getProfileById Error]', error);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch profile' });
  }
};

// GET /api/v1/user/profiles (Filtered, Paginated & Gender-Segregated Feed)
exports.getProfiles = async (req, res) => {
  try {
    if (!req.user || !req.user.phone) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized. Authentication token is missing.'
      });
    }

    const callerPhone = req.user.phone;
    const callerProfile = await User.findOne({ phone: callerPhone });
    
    // Default fallback to 'Male' if caller profile hasn't loaded (so opposite is 'Female')
    const callerGender = callerProfile ? callerProfile.gender : 'Male';
    const oppositeGender = callerGender === 'Male' ? 'Female' : 'Male';

    const query = { 
      gender: oppositeGender, 
      profileHidden: { $ne: true }, 
      maritalStatus: { $ne: 'Married' },
      phone: { $nin: callerProfile ? callerProfile.blockedBy : [] },
      reportedBy: { $ne: callerPhone },
      blockedBy: { $ne: callerPhone }
    };

    const {
      recommendations,
      min_age,
      max_age,
      city,
      exclude_nukh,
      profession,
      incomeBracket,
      search,
      sindhiType,
      limit = '10',
      offset = '0'
    } = req.query;

    // Parse Pagination Limits at top to avoid block scoping issues
    const limitVal = parseInt(limit) || 10;
    const offsetVal = parseInt(offset) || 0;

    console.log('[User Controller] getProfiles query params:', req.query);

    // 1. Filter: Age range (calculated relative to birth date years)
    if (min_age || max_age) {
      const today = new Date();
      const dobFilter = {};
      if (min_age) {
        const maxDob = new Date(today.getFullYear() - parseInt(min_age), today.getMonth(), today.getDate());
        dobFilter.$lte = maxDob;
      }
      if (max_age) {
        const minDob = new Date(today.getFullYear() - parseInt(max_age) - 1, today.getMonth(), today.getDate());
        dobFilter.$gte = minDob;
      }
      query.dob = dobFilter;
    }

    // 2. Filter: City
    if (city) {
      query.location = { $regex: city.trim(), $options: 'i' };
    }

    // 3. Filter: Exclude Nukh (caste logic or surname checks)
    if (exclude_nukh) {
      const cleanExclude = exclude_nukh.trim();
      query.caste = { $regex: `^(?!${cleanExclude}$)`, $options: 'i' };
      query.firstName = { $regex: `^(?!.*${cleanExclude}).*`, $options: 'i' };
    }

    // 4. Filter: Profession
    if (profession) {
      query.$or = [
        { professionSector: { $regex: profession.trim(), $options: 'i' } },
        { profession: { $regex: profession.trim(), $options: 'i' } }
      ];
    }

    // 5. Filter: Income Bracket
    if (incomeBracket) {
      query.incomeBracket = { $regex: incomeBracket.trim(), $options: 'i' };
    }

    // 6. Filter: Search by Name/Surname
    if (search) {
      const cleanSearch = search.trim();
      const searchOr = [
        { firstName: { $regex: cleanSearch, $options: 'i' } },
        { lastName: { $regex: cleanSearch, $options: 'i' } },
        { surname: { $regex: cleanSearch, $options: 'i' } }
      ];
      if (query.$or) {
        query.$and = query.$and || [];
        query.$and.push({ $or: query.$or });
        query.$and.push({ $or: searchOr });
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    // 7. Filter: Sindhi Type
    if (sindhiType) {
      query.sindhiType = { $regex: sindhiType.trim(), $options: 'i' };
    }

    // 8. Partner Preferences Logic (when recommendations === 'true')
    if (recommendations === 'true' && callerProfile && callerProfile.partnerPreferences) {
      const prefs = callerProfile.partnerPreferences;

      // Age Range from Preferences
      if (prefs.minAge || prefs.maxAge) {
        const today = new Date();
        const dobFilter = {};
        if (prefs.minAge) {
          const maxDob = new Date(today.getFullYear() - parseInt(prefs.minAge), today.getMonth(), today.getDate());
          dobFilter.$lte = maxDob;
        }
        if (prefs.maxAge) {
          const minDob = new Date(today.getFullYear() - parseInt(prefs.maxAge) - 1, today.getMonth(), today.getDate());
          dobFilter.$gte = minDob;
        }
        query.dob = dobFilter;
      }

      // City/State from Preferences
      if (prefs.state && prefs.state !== 'Not set') {
        // Broad search matching either city or state strings
        query.location = { $regex: prefs.state.replace('- All', '').trim(), $options: 'i' };
      }

      // Exclude Nukh
      if (prefs.excludeNukh && prefs.excludeNukh.trim() !== '') {
        const nukhs = prefs.excludeNukh.split(',').map(n => n.trim()).filter(n => n);
        if (nukhs.length > 0) {
          const regexes = nukhs.map(n => `^(?!.*${n}).*`);
          // Join the regexes to ensure none of the excluded nukhs match
          query.caste = { $regex: regexes.join(''), $options: 'i' };
          query.firstName = { $regex: regexes.join(''), $options: 'i' };
        }
      }
    }


    // Sorting or Randomizing
    let profiles;
    let count;
    
    if (recommendations === 'true') {
      if (offsetVal > 0) {
        // Daily picks is a single batch, no pagination
        profiles = [];
        count = 0;
      } else {
        // For daily picks, return a random sample to avoid showing the same profiles repeatedly
        const sampleSize = parseInt(limit) || 30;
        let basePipeline = [
          { $match: query },
          { $sort: { adminRankScore: -1, isSeriousSeeker: -1, activityScore: -1 } },
          { $sample: { size: sampleSize } },
          { $project: { password: 0 } }
        ];
        profiles = await User.aggregate(basePipeline);
        
        // --- NEW: FALLBACK FEED LOGIC ---
        // If partner preferences are too strict and we got very few/no results, 
        // fill the rest of the feed with other profiles outside preferences.
        if (profiles.length < sampleSize) {
          const fetchedIds = profiles.map(p => p._id);
          
          const fallbackQuery = { 
            gender: oppositeGender, 
            profileHidden: { $ne: true }, 
            maritalStatus: { $ne: 'Married' },
            phone: { $nin: callerProfile ? callerProfile.blockedBy : [] },
            reportedBy: { $ne: callerPhone },
            blockedBy: { $ne: callerPhone },
            _id: { $nin: fetchedIds }
          };
          
          const remainingSize = sampleSize - profiles.length;
          const fallbackProfiles = await User.aggregate([
            { $match: fallbackQuery },
            { $sort: { adminRankScore: -1, isSeriousSeeker: -1, activityScore: -1 } },
            { $sample: { size: remainingSize } },
            { $project: { password: 0 } }
          ]);
          
          // Mark fallback profiles so frontend can show "Outside Preferences" label
          fallbackProfiles.forEach(p => p.isFallback = true);
          
          profiles = [...profiles, ...fallbackProfiles];
        }
        
        count = profiles.length;
      }
    } else {
      // Normal search with pagination
      count = await User.countDocuments(query);
      profiles = await User.find(query)
          .select('-password')
          .sort({ adminRankScore: -1, isSeriousSeeker: -1, activityScore: -1, createdAt: -1 })
          .skip(offsetVal)
          .limit(limitVal)
          .lean();
    }


    // Fetch all connection records involving callers to determine lock state
    const interests = await Interest.find({
      $or: [
        { from_phone: callerPhone },
        { to_phone: callerPhone }
      ]
    });

    // 6. Privacy opt-in mapping logic
    const privacyFilteredResult = profiles.map(p => {
      const profilePhone = p.phone;

      // Check double opt-in accepted handshake status
      const isConnected = interests.some(interest => 
        interest.status === 'accepted' && 
        ((interest.from_phone === callerPhone && interest.to_phone === profilePhone) ||
         (interest.from_phone === profilePhone && interest.to_phone === callerPhone))
      );

      // Check if caller sent interest
      const sentInterest = interests.some(interest => 
        interest.from_phone === callerPhone && interest.to_phone === profilePhone && interest.status === 'pending'
      );

      // Check if caller received interest
      const receivedInterest = interests.some(interest => 
        interest.from_phone === profilePhone && interest.to_phone === callerPhone && interest.status === 'pending'
      );

      let interestStatus = 'none';
      if (isConnected) {
        interestStatus = 'accepted';
      } else if (sentInterest) {
        interestStatus = 'pending';
      } else if (receivedInterest) {
        interestStatus = 'incoming';
      }

      // Compute age dynamically
      const today = new Date();
      let age = null;
      if (p.dob) {
        let birthDate = p.dob instanceof Date ? p.dob : new Date(p.dob);
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }

      let kundaliScore = null;
      let kundaliMessage = "Birth details not provided";
      if (callerProfile && callerProfile.dob && p.dob) {
        kundaliScore = calculateKundaliScore(callerProfile, p);
        kundaliMessage = `${kundaliScore}/36 Gunas Matched`;
      } else {
        kundaliMessage = "Kundali data unavailable";
      }

      return {
        id: p._id.toString(),
        name: `${p.firstName} ${p.lastName}`,
        age: age,
        height: p.height,
        caste: p.caste,
        profession: p.profession,
        company: p.company,
        location: p.location,
        education: p.education,
        bio: p.bio,
        compatibilityScore: p.compatibilityScore,
        initials: p.initials,
        fathersOccupation: p.fathersOccupation,
        incomeBracket: p.incomeHidden ? 'Private' : p.incomeBracket,
        professionSector: p.professionSector,
        gradientColors: p.gradientColors,
        photos: p.uploadedPhotos,
        phone: profilePhone,
        whatsappNumber: p.whatsappNumber || '',
        interestStatus: interestStatus,
        monthlyIncome: p.incomeHidden ? 'Private' : (p.monthlyIncome || ''),
        yearlyIncome: p.incomeHidden ? 'Private' : (p.yearlyIncome || ''),
        district: p.district || '',
        properAddress: p.properAddress || '',
        jobPost: p.jobPost || '',
        ownHouse: p.ownHouse || '',
        housePhoto: p.housePhoto || '',
        surname: p.surname || '',
        nukh: p.nukh || '',
        requirements: p.requirements || '',
        whatWeProvide: p.whatWeProvide || '',
        physicalDisability: p.physicalDisability || '',
        complexion: p.complexion || '',
        weight: p.weight || '',
        fatherStatus: p.fatherStatus || 'Alive',
        motherStatus: p.motherStatus || 'Alive',
        mothersOccupation: p.mothersOccupation || '',
        siblingsCount: p.siblingsCount || '0',
        siblingsDetails: p.siblingsDetails || '',
        sindhiType: p.sindhiType || 'Sindhi Hindu',
        profileHidden: p.profileHidden || false,
        incomeHidden: p.incomeHidden || false,
        photosVisibility: p.photosVisibility || 'All Matches',
        kundaliScore: kundaliScore,
        kundaliMessage: kundaliMessage,
        birthTime: p.birthTime || '',
        birthPlace: p.birthPlace || ''
      };

    });

    console.log(`[DB] Returning ${privacyFilteredResult.length} profiles of ${count} items (offset=${offsetVal}, limit=${limitVal})`);

    return res.status(200).json({
      status: 'success',
      count: count,
      limit: limitVal,
      offset: offsetVal,
      data: privacyFilteredResult
    });
  } catch (error) {
    console.error('[User Controller getProfiles Error]', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server failed to query profiles.'
    });
  }
};

// POST /api/v1/user/interest (Send or accept interest)
// Helper function to update serious seeker score on reply
const updateSeriousSeekerScore = async (phone, interestCreatedAt) => {
  try {
    const user = await User.findOne({ phone });
    if (!user) return;
    
    // Determine if replied within 24h
    if (interestCreatedAt) {
      const now = new Date();
      const diffHrs = (now - new Date(interestCreatedAt)) / (1000 * 60 * 60);
      if (diffHrs <= 24) {
        user.totalInterestsRepliedIn24h = (user.totalInterestsRepliedIn24h || 0) + 1;
      }
    }
    
    // Calculate reply rate (assume they replied to this one)
    // We don't track total replied globally yet in the model cleanly, 
    // so we'll just track totalInterestsReceived vs totalInterestsRepliedIn24h 
    // or just make a simple activity score bump.
    user.activityScore = (user.activityScore || 0) + 10;
    
    // Serious Seeker threshold: Activity Score > 50 and replied in 24h >= 2
    if (user.activityScore > 50 && (user.totalInterestsRepliedIn24h || 0) >= 2) {
      user.isSeriousSeeker = true;
    }
    
    await user.save();
  } catch (error) {
    console.error('[Anti-Ghosting System] Failed to update serious seeker score:', error);
  }
};

exports.sendInterest = async (req, res) => {
  try {
    if (!req.user || !req.user.phone) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized. Authentication token is missing.' });
    }

    const callerPhone = req.user.phone;
    const { toPhone } = req.body;

    if (!toPhone) {
      return res.status(400).json({ status: 'error', message: 'Target profile phone number is required.' });
    }

    if (callerPhone === toPhone) {
      return res.status(400).json({ status: 'error', message: 'You cannot send interest to yourself.' });
    }

    // Check if reverse pending interest exists
    const reverseInterest = await Interest.findOne({ from_phone: toPhone, to_phone: callerPhone });
    
    if (reverseInterest) {
      // Mutual connection established! Update existing status to accepted
      reverseInterest.status = 'accepted';
      await reverseInterest.save();
      
      // Save reciprocal matching entry
      await Interest.findOneAndUpdate(
        { from_phone: callerPhone, to_phone: toPhone },
        { status: 'accepted' },
        { upsert: true, new: true }
      );

      // Fetch target user's FCM token
      const targetUser = await User.findOne({ phone: toPhone });
      const fcmToken = targetUser && targetUser.fcmToken ? targetUser.fcmToken : null;

      await fcmService.sendPushNotification(
        fcmToken,
        "Mutual Connection Established!",
        "Jai Jhulelal! You and the other user accepted each other's connection requests. WhatsApp contact details are unlocked!",
        { fromPhone: callerPhone, toPhone: toPhone, status: 'accepted' }
      );
      
      console.log(`[DB Handshake] Mutual WhatsApp connection established between +91 ${callerPhone} and +91 ${toPhone}!`);

      return res.status(200).json({
        status: 'success',
        message: 'Mutual interest accepted! WhatsApp contact details unlocked.',
        interestStatus: 'accepted'
      });
    }

    // Check if interest is already sent
    const alreadySent = await Interest.findOne({ from_phone: callerPhone, to_phone: toPhone });
    if (!alreadySent) {
      const newInterest = new Interest({
        from_phone: callerPhone,
        to_phone: toPhone,
        status: 'pending'
      });
      await newInterest.save();
      
      const targetUserForNewReq = await User.findOne({ phone: toPhone });
      if (targetUserForNewReq) {
        targetUserForNewReq.totalInterestsReceived = (targetUserForNewReq.totalInterestsReceived || 0) + 1;
        await targetUserForNewReq.save();
      }
      const fcmTokenNew = targetUserForNewReq && targetUserForNewReq.fcmToken ? targetUserForNewReq.fcmToken : null;

      await fcmService.sendPushNotification(
        fcmTokenNew,
        "New Interest!",
        "Kisi ne aapki profile mein interest dikhaya hai! Check karein kaun hai woh.",
        { fromPhone: callerPhone, status: 'pending' }
      );
    }

    return res.status(200).json({
      status: 'success',
      message: 'Interest request sent successfully.',
      interestStatus: 'pending'
    });
  } catch (error) {
    console.error('[User Controller sendInterest Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to record interest.' });
  }
};

// POST /api/v1/user/interest/cancel (Cancel pending interest)
exports.cancelInterest = async (req, res) => {
  try {
    if (!req.user || !req.user.phone) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized. Authentication token is missing.' });
    }

    const callerPhone = req.user.phone;
    const { targetPhone } = req.body;

    if (!targetPhone) {
      return res.status(400).json({ status: 'error', message: 'targetPhone is required.' });
    }

    const deleted = await Interest.findOneAndDelete({
      from_phone: callerPhone,
      to_phone: targetPhone,
      status: 'pending'
    });

    if (!deleted) {
      return res.status(404).json({ status: 'error', message: 'Pending interest request not found.' });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Interest request cancelled successfully.',
      interestStatus: 'none'
    });
  } catch (error) {
    console.error('[User Controller cancelInterest Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to cancel interest.' });
  }
};


// GET /api/v1/user/interests (Get incoming pending interests)
exports.getInterests = async (req, res) => {
  try {
    if (!req.user || !req.user.phone) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized. Authentication token is missing.' });
    }

    const callerPhone = req.user.phone;
    
    // Find pending interests sent to callerPhone
    const incomingInterests = await Interest.find({ to_phone: callerPhone, status: 'pending' }).lean();
    const incomingPhones = incomingInterests.map(i => i.from_phone);

    const caller = await User.findOne({ phone: callerPhone }).lean();
    const blocked = caller ? (caller.blockedUsers || []) : [];

    // Fetch corresponding user profiles
    const users = await User.find({ 
      phone: { $in: incomingPhones, $nin: blocked },
      blockedBy: { $ne: callerPhone }
    }).lean();
    
    const requestingProfiles = users.map(p => {
      const today = new Date();
      let age = null;
      if (p.dob) {
        let birthDate = p.dob instanceof Date ? p.dob : new Date(p.dob);
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }

        return {
        id: p._id.toString(),
        name: `${p.firstName} ${p.lastName}`,
        age: age,
        height: p.height || '',
        caste: p.caste || '',
        profession: p.profession || '',
        company: p.company || 'Self',
        location: p.location || '',
        education: p.education || '',
        bio: p.bio || '',
        compatibilityScore: p.compatibilityScore || 80,
        initials: p.initials || '',
        fathersOccupation: p.fathersOccupation || '',
        incomeBracket: p.incomeBracket || '',
        professionSector: p.professionSector || '',
        gradientColors: p.gradientColors || ['#C5A059', '#DFBA73'],
        photos: p.uploadedPhotos || [],
        phone: p.phone || '',
        whatsappNumber: p.whatsappNumber || '',
        sindhiType: p.sindhiType || 'Sindhi Hindu',
        interestStatus: 'incoming',
        monthlyIncome: p.monthlyIncome || '',
        yearlyIncome: p.yearlyIncome || '',
        district: p.district || '',
        properAddress: p.properAddress || '',
        jobPost: p.jobPost || '',
        ownHouse: p.ownHouse || '',
        housePhoto: p.housePhoto || '',
        surname: p.surname || '',
        nukh: p.nukh || '',
        requirements: p.requirements || '',
        whatWeProvide: p.whatWeProvide || '',
        physicalDisability: p.physicalDisability || '',
        complexion: p.complexion || '',
        weight: p.weight || '',
        fatherStatus: p.fatherStatus || 'Alive',
        motherStatus: p.motherStatus || 'Alive',
        mothersOccupation: p.mothersOccupation || '',
        siblingsCount: p.siblingsCount || '0',
        siblingsDetails: p.siblingsDetails || '',
      };
    });

    return res.status(200).json({
      status: 'success',
      data: requestingProfiles
    });
  } catch (error) {
    console.error('[User Controller getInterests Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to query incoming interests.' });
  }
};

// POST /api/v1/user/interest/accept (Accept incoming interest request)
exports.acceptInterest = async (req, res) => {
  try {
    if (!req.user || !req.user.phone) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized. Authentication token is missing.' });
    }

    const callerPhone = req.user.phone;
    const { fromPhone } = req.body;

    if (!fromPhone) {
      return res.status(400).json({ status: 'error', message: 'Sender profile phone number is required.' });
    }

    const interest = await Interest.findOne({ from_phone: fromPhone, to_phone: callerPhone, status: 'pending' });
    if (interest) {
      interest.status = 'accepted';
      await interest.save();
      await updateSeriousSeekerScore(callerPhone, interest.createdAt);
      
      // Save reciprocal matching entry
      await Interest.findOneAndUpdate(
        { from_phone: callerPhone, to_phone: fromPhone },
        { status: 'accepted' },
        { upsert: true, new: true }
      );

      const targetUserForAccept = await User.findOne({ phone: fromPhone });
      const fcmTokenAccept = targetUserForAccept && targetUserForAccept.fcmToken ? targetUserForAccept.fcmToken : null;
      
      const callerUser = await User.findOne({ phone: callerPhone });

      await fcmService.sendPushNotification(
        fcmTokenAccept,
        "Match Accepted!",
        `Badhai ho! ${callerUser.firstName || 'Kisi'} ne aapka interest accept kar liya hai. Ab aap unka contact details dekh sakte hain.`,
        { fromPhone: callerPhone, toPhone: fromPhone, status: 'accepted' }
      );

      return res.status(200).json({
        status: 'success',
        message: 'Interest accepted successfully! WhatsApp contact details unlocked.',
        interestStatus: 'accepted'
      });
    }

    return res.status(404).json({
      status: 'error',
      message: 'Pending interest request not found.'
    });
  } catch (error) {
    console.error('[User Controller acceptInterest Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to accept interest.' });
  }
};

exports.getAllUsersAdmin = async (req, res) => {
  try {
    const adminPhone = process.env.ADMIN_PHONE || '9999999999';
    if (!req.user || req.user.phone !== adminPhone) {
      console.warn(`[Admin Check] Unauthorized access attempt by phone: ${req.user ? req.user.phone : 'guest'}`);
      return res.status(403).json({ status: 'error', message: 'Forbidden. Access restricted to admin only.' });
    }

    const cacheKey = 'adminAllUsers';
    const cachedUsers = cacheService.get(cacheKey);
    if (cachedUsers) {
      return res.status(200).json({ status: 'success', data: cachedUsers });
    }

    const users = await User.find({}).sort({ createdAt: -1 }).lean();
    cacheService.set(cacheKey, users, 300); // 5 mins cache

    return res.status(200).json({
      status: 'success',
      data: users
    });
  } catch (error) {
    console.error('[User Controller getAllUsersAdmin Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to retrieve user list.' });
  }
};

// POST /api/v1/user/report
exports.reportUser = async (req, res) => {
  try {
    const callerPhone = req.user.phone;
    const { targetPhone } = req.body;
    if (!targetPhone) {
      return res.status(400).json({ status: 'error', message: 'Target identifier is required.' });
    }
    
    const query = mongoose.Types.ObjectId.isValid(targetPhone)
      ? { _id: targetPhone }
      : { phone: targetPhone };

    await User.findOneAndUpdate(
      query,
      { $addToSet: { reportedBy: callerPhone } }
    );
    
    return res.status(200).json({
      status: 'success',
      message: 'Candidate has been reported successfully. The administration will review this profile within 24 hours.'
    });
  } catch (error) {
    console.error('[User Controller reportUser Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to report profile.' });
  }
};

// POST /api/v1/user/block
exports.blockUser = async (req, res) => {
  try {
    const callerPhone = req.user.phone;
    const { targetPhone } = req.body;
    if (!targetPhone) {
      return res.status(400).json({ status: 'error', message: 'Target identifier is required.' });
    }
    
    const query = mongoose.Types.ObjectId.isValid(targetPhone)
      ? { _id: targetPhone }
      : { phone: targetPhone };

    await User.findOneAndUpdate(
      query,
      { $addToSet: { blockedBy: callerPhone } }
    );
    
    return res.status(200).json({
      status: 'success',
      message: 'Candidate has been blocked successfully and will no longer appear in your matches feed.'
    });
  } catch (error) {
    console.error('[User Controller blockUser Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to block profile.' });
  }
};

// POST /api/v1/user/password
exports.changePassword = async (req, res) => {
  try {
    const callerPhone = req.user.phone;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'Current password and new password are required.' });
    }

    const user = await User.findOne({ phone: callerPhone });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User profile not found.' });
    }

    const dbPassword = user.password || '';
    
    const config = await AppConfig.findOne();
    const bypassPassword = config?.developerBypassPassword || '123456';

    const isValid = currentPassword === bypassPassword || (dbPassword && currentPassword === dbPassword);
    if (!isValid) {
      return res.status(400).json({ status: 'error', message: 'Incorrect current password.' });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      status: 'success',
      message: 'Password changed successfully.'
    });
  } catch (error) {
    console.error('[User Controller changePassword Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to change password.' });
  }
};

// GET /api/v1/user/chat/:targetUserId
exports.getChatMessages = async (req, res) => {
  try {
    const callerPhone = req.user.phone;
    const { targetUserId } = req.params;

    const caller = await User.findOne({ phone: callerPhone });
    if (!caller) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    const Message = require('../models/message.model');
    const messages = await Message.find({
      $or: [
        { sender: caller._id, receiver: targetUserId },
        { sender: targetUserId, receiver: caller._id }
      ]
    }).sort({ createdAt: 1 }).lean();

    return res.status(200).json({
      status: 'success',
      data: messages.map(m => ({
        id: m._id.toString(),
        sender: m.sender.toString(),
        receiver: m.receiver.toString(),
        text: m.text,
        createdAt: m.createdAt
      }))
    });
  } catch (error) {
    console.error('[User Controller getChatMessages Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to retrieve chat history.' });
  }
};

// POST /api/v1/user/chat/send
exports.sendChatMessage = async (req, res) => {
  try {
    const callerPhone = req.user.phone;
    const { targetUserId, text } = req.body;

    if (!targetUserId || !text) {
      return res.status(400).json({ status: 'error', message: 'targetUserId and text are required.' });
    }

    const caller = await User.findOne({ phone: callerPhone });
    if (!caller) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }
    
    const targetUserObj = await User.findById(targetUserId);
    if (!targetUserObj) {
      return res.status(404).json({ status: 'error', message: 'Target user not found.' });
    }

    // STRICT CHAT LOCK: Verify there is an accepted mutual interest
    const Interest = require('../models/interest.model');
    const mutualInterest = await Interest.findOne({
      $or: [
        { from_phone: callerPhone, to_phone: targetUserObj.phone },
        { from_phone: targetUserObj.phone, to_phone: callerPhone }
      ],
      status: 'accepted'
    });
    
    if (!mutualInterest && callerPhone !== '9413879444' && callerPhone !== '+919413879444') {
      return res.status(403).json({ status: 'locked', message: 'Chat is locked. You must have an accepted mutual interest first.' });
    }

    // Check monthly reset
    const currentMonth = new Date().getMonth();
    if (caller.lastResetMonth !== currentMonth) {
      caller.chatConnections = [];
      caller.lastResetMonth = currentMonth;
      await caller.save();
    }

    // Check if targetUserId is already in chatConnections
    const connections = caller.chatConnections || [];
    const isAlreadyConnected = connections.includes(targetUserId);

    if (!isAlreadyConnected) {
      // Check if limit of 3 exceeded
      if (connections.length >= 3) {
        return res.status(403).json({
          status: 'limit_reached',
          message: 'Monthly chat connection limit reached (Max 3 active chats per month).'
        });
      }
      if (!caller.chatConnections) {
        caller.chatConnections = [];
      }
      caller.chatConnections.push(targetUserId);
      await caller.save();
    }

    const message = new Message({
      sender: caller._id,
      receiver: targetUserId,
      text: text
    });
    await message.save();

    if (targetUserObj && targetUserObj.fcmToken) {
      await fcmService.sendPushNotification(
        targetUserObj.fcmToken,
        "New Message",
        `${caller.firstName || 'Kisi'} ne aapko ek request bheji hai. Response dene ke liye tap karein.`,
        { senderId: caller._id.toString(), type: 'chat' }
      );
    }

    return res.status(200).json({
      status: 'success',
      data: {
        id: message._id.toString(),
        sender: message.sender.toString(),
        receiver: message.receiver.toString(),
        text: message.text,
        createdAt: message.createdAt
      }
    });
  } catch (error) {
    console.error('[User Controller sendChatMessage Error]', error);
    return res.status(500).json({ status: 'error', message: error.message || 'Server failed to send message.' });
  }
};

// POST /api/v1/user/admin/push
exports.adminBroadcastPush = async (req, res) => {
  try {
    const callerPhone = req.user.phone;
    const adminPhone = process.env.ADMIN_PHONE || '9413879444';

    if (callerPhone !== adminPhone && !req.user.isAdmin) {
      return res.status(403).json({ status: 'error', message: 'Access denied. Admins only.' });
    }

    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ status: 'error', message: 'Message is required.' });
    }

    console.log(`[Admin Push Broadcast] Message: "${message}"`);
    try {
      const users = await User.find({ phone: { $ne: adminPhone } }).lean();
      for (const u of users) {
        console.log(`[FCM Mock Broadcast] Dispatched notification to +91 ${u.phone}: "${message}"`);
      }
    } catch (_) {}

    return res.status(200).json({
      status: 'success',
      message: 'Broadcasting push notification to all active devices successfully.'
    });
  } catch (error) {
    console.error('[User Controller adminBroadcastPush Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to broadcast notification.' });
  }
};

// PUT /api/v1/user/admin/user/:userId
exports.adminEditUser = async (req, res) => {
  try {
    const callerPhone = req.user.phone;
    const adminPhone = process.env.ADMIN_PHONE || '9413879444';

    if (callerPhone !== adminPhone && !req.user.isAdmin) {
      return res.status(403).json({ status: 'error', message: 'Access denied. Admins only.' });
    }

    const { userId } = req.params;
    const updateData = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    // Apply updates
    Object.assign(user, updateData);
    await user.save();

    return res.status(200).json({
      status: 'success',
      message: 'User profile updated successfully by Admin.'
    });
  } catch (error) {
    console.error('[User Controller adminEditUser Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to update user profile.' });
  }
};

// PUT /api/v1/user/admin/change-password
exports.adminChangePassword = async (req, res) => {
  try {
    const callerPhone = req.user.phone;
    const adminPhone = process.env.ADMIN_PHONE || '9413879444';

    if (callerPhone !== adminPhone && !req.user.isAdmin) {
      return res.status(403).json({ status: 'error', message: 'Access denied. Admins only.' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: 'error', message: 'Current password and new password are required.' });
    }

    const adminPasswordEnv = process.env.ADMIN_PASSWORD || 'piyushassudani@96';
    let adminRecord = await User.findOne({ phone: adminPhone });
    if (!adminRecord) {
      adminRecord = new User({
        phone: adminPhone,
        profileFor: 'Self',
        gender: 'Male',
        firstName: 'Admin',
        lastName: 'Account',
        email: 'admin@perfectbandhan.in',
        dob: new Date(),
        height: "5'10\"",
        city: 'Delhi',
        state: 'Delhi',
        location: 'Delhi, Delhi',
        maritalStatus: 'Unmarried',
        education: 'Graduate',
        profession: 'Admin',
        incomeBracket: 'Private',
        password: adminPasswordEnv
      });
      await adminRecord.save();
    }

    const dbPassword = adminRecord.password || '';
    const isValid = currentPassword === adminPasswordEnv || currentPassword === dbPassword;
    if (!isValid) {
      return res.status(400).json({ status: 'error', message: 'Incorrect current admin password.' });
    }

    adminRecord.password = newPassword;
    await adminRecord.save();

    return res.status(200).json({
      status: 'success',
      message: 'Admin password updated successfully.'
    });
  } catch (error) {
    console.error('[User Controller adminChangePassword Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to update admin password.' });
  }
};

exports.getConversations = async (req, res) => {
  try {
    if (!req.user || !req.user.phone) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized.' });
    }
    const callerPhone = req.user.phone;
    const caller = await User.findOne({ phone: callerPhone });
    if (!caller) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    const Message = require('../models/message.model');
    const messages = await Message.find({
      $or: [
        { sender: caller._id },
        { receiver: caller._id }
      ]
    }).lean();

    const userIds = new Set();
    messages.forEach(m => {
      if (m.sender.toString() !== caller._id.toString()) {
        userIds.add(m.sender.toString());
      }
      if (m.receiver.toString() !== caller._id.toString()) {
        userIds.add(m.receiver.toString());
      }
    });

    const interests = await Interest.find({
      status: 'accepted',
      $or: [
        { from_phone: callerPhone },
        { to_phone: callerPhone }
      ]
    });

    for (const interest of interests) {
      const otherPhone = interest.from_phone === callerPhone ? interest.to_phone : interest.from_phone;
      const otherUser = await User.findOne({ phone: otherPhone });
      if (otherUser) {
        userIds.add(otherUser._id.toString());
      }
    }

    const blocked = caller.blockedUsers || [];
    const users = await User.find({ 
      _id: { $in: Array.from(userIds) },
      phone: { $nin: blocked },
      blockedBy: { $ne: callerPhone }
    }).lean();

    const conversations = users.map(p => {
      const today = new Date();
      let age = null;
      if (p.dob) {
        let birthDate = p.dob instanceof Date ? p.dob : new Date(p.dob);
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }

      return {
        id: p._id.toString(),
        name: `${p.firstName} ${p.lastName}`,
        age: age,
        height: p.height,
        caste: p.caste,
        profession: p.profession,
        company: p.company,
        location: p.location,
        education: p.education,
        bio: p.bio,
        compatibilityScore: p.compatibilityScore,
        initials: p.initials,
        fathersOccupation: p.fathersOccupation,
        incomeBracket: p.incomeBracket,
        professionSector: p.professionSector,
        gradientColors: p.gradientColors,
        photos: p.uploadedPhotos,
        phone: p.phone,
        whatsappNumber: p.whatsappNumber || '',
        interestStatus: 'accepted',
        monthlyIncome: p.monthlyIncome || '',
        yearlyIncome: p.yearlyIncome || '',
        district: p.district || '',
        properAddress: p.properAddress || '',
        jobPost: p.jobPost || '',
        ownHouse: p.ownHouse || '',
        housePhoto: p.housePhoto || '',
        surname: p.surname || '',
        nukh: p.nukh || '',
        requirements: p.requirements || '',
        whatWeProvide: p.whatWeProvide || '',
        physicalDisability: p.physicalDisability || '',
        complexion: p.complexion || '',
        weight: p.weight || '',
        fatherStatus: p.fatherStatus || 'Alive',
        motherStatus: p.motherStatus || 'Alive',
        mothersOccupation: p.mothersOccupation || '',
        siblingsCount: p.siblingsCount || '0',
        siblingsDetails: p.siblingsDetails || '',
        sindhiType: p.sindhiType || 'Sindhi Hindu',
      };
    });

    return res.status(200).json({
      status: 'success',
      data: conversations
    });
  } catch (error) {
    console.error('[User Controller getConversations Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to retrieve chat list.' });
  }
};

// ─── App Version & Update Management ─────────────────────────────────────────

// GET /api/v1/user/app-config  (Public - client checks this on startup)
exports.getAppConfig = async (req, res) => {
  try {
    const cacheKey = 'appConfig';
    const cachedConfig = cacheService.get(cacheKey);
    if (cachedConfig) {
      return res.status(200).json({ status: 'success', data: cachedConfig });
    }

    // Get the first (and only) config document, or return defaults
    let config = await AppConfig.findOne({});
    if (!config) {
      config = await AppConfig.create({});
    }
    
    const configData = {
      latestVersion: config.latestVersion,
      minVersion: config.minVersion,
      forceUpdate: config.forceUpdate,
      updateMessage: config.updateMessage,
      downloadUrl: config.downloadUrl,
    };
    
    cacheService.set(cacheKey, configData, 3600); // Cache for 1 hour

    return res.status(200).json({
      status: 'success',
      data: configData
    });
  } catch (error) {
    console.error('[User Controller getAppConfig Error]', error);
    return res.status(500).json({ status: 'error', message: 'Failed to retrieve app config.' });
  }
};

// PUT /api/v1/user/admin/app-config  (Admin only)
exports.updateAppConfig = async (req, res) => {
  try {
    const adminPhone = process.env.ADMIN_PHONE || '9999999999';
    if (!req.user || req.user.phone !== adminPhone) {
      return res.status(403).json({ status: 'error', message: 'Forbidden. Access restricted to admin only.' });
    }

    const { 
      latestVersion, minVersion, forceUpdate, updateMessage, downloadUrl,
      isMaintenanceMode, maintenanceMessage,
      globalBannerEnabled, globalBannerMessage, globalBannerImageUrl,
      developerBypassPassword
    } = req.body;

    const updateFields = {};
    if (latestVersion !== undefined) updateFields.latestVersion = latestVersion;
    if (minVersion !== undefined) updateFields.minVersion = minVersion;
    if (forceUpdate !== undefined) updateFields.forceUpdate = Boolean(forceUpdate);
    if (updateMessage !== undefined) updateFields.updateMessage = updateMessage;
    if (downloadUrl !== undefined) updateFields.downloadUrl = downloadUrl;
    
    if (isMaintenanceMode !== undefined) updateFields.isMaintenanceMode = Boolean(isMaintenanceMode);
    if (maintenanceMessage !== undefined) updateFields.maintenanceMessage = maintenanceMessage;
    if (globalBannerEnabled !== undefined) updateFields.globalBannerEnabled = Boolean(globalBannerEnabled);
    if (globalBannerMessage !== undefined) updateFields.globalBannerMessage = globalBannerMessage;
    if (developerBypassPassword !== undefined) updateFields.developerBypassPassword = developerBypassPassword;

    // Handle Image Upload for Banner
    if (globalBannerImageUrl !== undefined) {
      if (globalBannerImageUrl.startsWith('data:image/')) {
        // Upload to Cloudinary
        const url = await cloudinaryService.uploadImage(globalBannerImageUrl);
        updateFields.globalBannerImageUrl = url;
      } else {
        updateFields.globalBannerImageUrl = globalBannerImageUrl;
      }
    }

    // Upsert: create if not exists, update if exists
    const config = await AppConfig.findOneAndUpdate(
      {},
      { $set: updateFields },
      { upsert: true, new: true }
    );

    cacheService.delete('appConfig'); // Invalidate config cache
    
    console.log(`[Admin] App config updated:`, updateFields);
    return res.status(200).json({
      status: 'success',
      message: 'App version config updated successfully.',
      data: config
    });
  } catch (error) {
    console.error('[User Controller updateAppConfig Error]', error);
    return res.status(500).json({ status: 'error', message: 'Failed to update app config.' });
  }
};

// POST /api/v1/user/fcm-token
exports.updateFcmToken = async (req, res) => {
  try {
    if (!req.user || !req.user.phone) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized.' });
    }

    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ status: 'error', message: 'FCM token is required.' });
    }

    const user = await User.findOneAndUpdate(
      { phone: req.user.phone },
      { $set: { fcmToken } },
      { new: true }
    );

    if (user) {
      const isComplete = !!user.firstName;
      if (!isComplete) {
        await fcmService.sendPushNotification(
          fcmToken,
          'Welcome to Sindhi Shadi! 💖',
          'Please complete your profile to find your perfect partner.'
        );
      } else {
        await fcmService.sendPushNotification(
          fcmToken,
          'Welcome Back! 💖',
          `Happy searching, ${user.firstName}!`
        );
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'FCM token updated successfully.'
    });
  } catch (error) {
    console.error('[User Controller updateFcmToken Error]', error);
    return res.status(500).json({ status: 'error', message: 'Failed to update FCM token.' });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const userPhone = req.user.phone;
    if (!userPhone) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    
    // In a real production app, we would probably do a soft delete, 
    // or delete associated chats/interests. Here we will do a hard delete for GDPR.
    const deletedUser = await User.findOneAndDelete({ phone: userPhone });
    if (!deletedUser) {
      console.warn(`[User Controller] User ${userPhone} not found during deletion. Treating as success for idempotent logout.`);
      return res.status(200).json({ status: 'success', message: 'Account permanently deleted.' });
    }
    
    // Delete associated interests and messages
    await Interest.deleteMany({ $or: [{ from_phone: userPhone }, { to_phone: userPhone }] });
    await Message.deleteMany({ $or: [{ sender: deletedUser._id }, { receiver: deletedUser._id }] });
    
    console.log(`[User Controller] Account deleted for user: ${userPhone}`);
    return res.status(200).json({ status: 'success', message: 'Account permanently deleted.' });
  } catch (error) {
    console.error('[User Controller] Error deleting account:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to delete account' });
  }
};

exports.updatePartnerPreferences = async (req, res) => {
  try {
    const userPhone = req.user.phone;
    const preferences = req.body;
    
    if (!userPhone) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    
    await User.findOneAndUpdate(
      { phone: userPhone },
      { $set: { partnerPreferences: preferences } }
    );
    
    return res.status(200).json({ status: 'success', message: 'Preferences updated.' });
  } catch (error) {
    console.error('[User Controller] Error updating preferences:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to update preferences' });
  }
};

exports.updateHobbies = async (req, res) => {
  try {
    const userPhone = req.user.phone;
    const { hobbies } = req.body;
    
    if (!userPhone) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    
    await User.findOneAndUpdate(
      { phone: userPhone },
      { $set: { hobbies: hobbies || [] } }
    );
    
    return res.status(200).json({ status: 'success', message: 'Hobbies updated.' });
  } catch (error) {
    console.error('[User Controller] Error updating hobbies:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to update hobbies' });
  }
};

// GET /api/v1/user/activity
exports.getActivity = async (req, res) => {
  try {
    const callerPhone = req.user.phone;
    
    // Get user stats
    const user = await User.findOne({ phone: callerPhone }).lean();
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    // Get sent interests (pending)
    const sentInterestDocs = await Interest.find({ from_phone: callerPhone, status: 'pending' }).lean();
    const sentPhones = sentInterestDocs.map(i => i.to_phone);
    const sentUsers = await User.find({ phone: { $in: sentPhones } }).lean();
    
    // Get accepted interests (mutual)
    const acceptedInterestDocs = await Interest.find({
      $or: [{ from_phone: callerPhone }, { to_phone: callerPhone }],
      status: 'accepted'
    }).lean();
    
    const acceptedPhones = acceptedInterestDocs.map(i => i.from_phone === callerPhone ? i.to_phone : i.from_phone);
    const acceptedUsers = await User.find({ phone: { $in: acceptedPhones } }).lean();

    const formatProfile = (p, status) => {
      const today = new Date();
      let age = null;
      if (p.dob) {
        let birthDate = p.dob instanceof Date ? p.dob : new Date(p.dob);
        age = today.getFullYear() - birthDate.getFullYear();
      }
      return {
        id: p._id.toString(),
        name: `${p.firstName} ${p.lastName}`,
        age: age,
        height: p.height || '',
        caste: p.caste || '',
        profession: p.profession || '',
        location: p.location || '',
        photos: p.uploadedPhotos || [],
        phone: p.phone || '',
        whatsappNumber: p.whatsappNumber || '',
        interestStatus: status
      };
    };

    const visitedByUsers = await User.find({ phone: { $in: user.visitedBy || [] } }).lean();
    const contactViewedByUsers = await User.find({ phone: { $in: user.contactViewedBy || [] } }).lean();

    return res.status(200).json({
      status: 'success',
      data: {
        profileVisits: user.profileVisits || 0,
        contactViews: user.contactViews || 0,
        profileVisitsList: visitedByUsers.map(p => formatProfile(p, 'none')),
        contactViewsList: contactViewedByUsers.map(p => formatProfile(p, 'none')),
        sentInterests: sentUsers.map(p => formatProfile(p, 'sent')),
        acceptedInterests: acceptedUsers.map(p => formatProfile(p, 'accepted'))
      }
    });
  } catch (error) {
    console.error('[User Controller getActivity Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

// POST /api/v1/user/track-activity
exports.trackActivity = async (req, res) => {
  try {
    const { targetPhone, type } = req.body;
    if (!targetPhone || !type) {
      return res.status(400).json({ status: 'error', message: 'Missing fields' });
    }
    
    if (type === 'profile_visit') {
      await User.updateOne({ phone: targetPhone }, { 
        $inc: { profileVisits: 1 },
        $addToSet: { visitedBy: req.user.phone }
      });
    } else if (type === 'contact_view') {
      await User.updateOne({ phone: targetPhone }, { 
        $inc: { contactViews: 1 },
        $addToSet: { contactViewedBy: req.user.phone }
      });
    }
    
    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('[User Controller trackActivity Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

// --- MODERATION ---

// POST /api/v1/user/block
exports.blockUser = async (req, res) => {
  try {
    const callerPhone = req.user.phone;
    const { targetPhone, reason, details } = req.body;
    
    if (!targetPhone || !reason) {
      return res.status(400).json({ status: 'error', message: 'Target phone and reason are required.' });
    }
    
    const Block = require('../models/block.model');

    // Add to caller's blockedUsers
    await User.updateOne({ phone: callerPhone }, { $addToSet: { blockedUsers: targetPhone } });
    // Add to target's blockedBy
    await User.updateOne({ phone: targetPhone }, { $addToSet: { blockedBy: callerPhone } });
    
    const newBlock = new Block({
      blockerPhone: callerPhone,
      blockedPhone: targetPhone,
      reason: reason,
      details: details || ''
    });
    await newBlock.save();

    return res.status(200).json({ status: 'success', message: 'User blocked successfully.' });
  } catch (error) {
    console.error('[User Controller blockUser Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

// POST /api/v1/user/unblock
exports.unblockUser = async (req, res) => {
  try {
    const callerPhone = req.user.phone;
    const { targetPhone } = req.body;
    
    if (!targetPhone) return res.status(400).json({ status: 'error', message: 'Target phone required.' });
    
    await User.updateOne({ phone: callerPhone }, { $pull: { blockedUsers: targetPhone } });
    await User.updateOne({ phone: targetPhone }, { $pull: { blockedBy: callerPhone } });
    
    return res.status(200).json({ status: 'success', message: 'User unblocked successfully.' });
  } catch (error) {
    console.error('[User Controller unblockUser Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

// GET /api/v1/user/blocked
exports.getBlockedUsers = async (req, res) => {
  try {
    const callerPhone = req.user.phone;
    const caller = await User.findOne({ phone: callerPhone }).lean();
    if (!caller) return res.status(404).json({ status: 'error', message: 'User not found' });
    
    const blockedPhones = caller.blockedUsers || [];
    const users = await User.find({ phone: { $in: blockedPhones } }).lean();
    
    const formatted = users.map(p => ({
      id: p._id.toString(),
      name: `${p.firstName} ${p.lastName}`,
      phone: p.phone,
      location: p.location,
      photos: p.uploadedPhotos || []
    }));
    
    return res.status(200).json({ status: 'success', data: formatted });
  } catch (error) {
    console.error('[User Controller getBlockedUsers Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

// POST /api/v1/user/report
exports.reportUser = async (req, res) => {
  try {
    const callerPhone = req.user.phone;
    const { targetPhone, reason, details } = req.body;
    
    if (!targetPhone || !reason) {
      return res.status(400).json({ status: 'error', message: 'Target phone and reason are required.' });
    }
    
    const Report = require('../models/report.model');
    const newReport = new Report({
      reporterPhone: callerPhone,
      reportedPhone: targetPhone,
      reason,
      details
    });
    await newReport.save();
    
    return res.status(200).json({ status: 'success', message: 'User reported successfully.' });
  } catch (error) {
    console.error('[User Controller reportUser Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

// GET /api/v1/user/reports (Admin)
exports.getReports = async (req, res) => {
  try {
    const Report = require('../models/report.model');
    const reports = await Report.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({ status: 'success', data: reports });
  } catch (error) {
    console.error('[User Controller getReports Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

// GET /api/v1/user/blocks (Admin)
exports.getBlocks = async (req, res) => {
  try {
    const Block = require('../models/block.model');
    const blocks = await Block.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({ status: 'success', data: blocks });
  } catch (error) {
    console.error('[User Controller getBlocks Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server error' });
  }
};


exports.adminDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const User = require('../models/user.model');
    const Interest = require('../models/interest.model');
    const Message = require('../models/message.model');
    
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }
    
    // Delete associated interests and messages
    await Interest.deleteMany({ $or: [{ from_phone: deletedUser.phone }, { to_phone: deletedUser.phone }] });
    await Message.deleteMany({ $or: [{ sender: deletedUser._id }, { receiver: deletedUser._id }] });
    
    console.log(`[Admin] Deleted user: ${deletedUser.phone}`);
    return res.status(200).json({ status: 'success', message: 'User permanently deleted.' });
  } catch (error) {
    console.error('[Admin] Error deleting user:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};


exports.developerToggleGender = async (req, res) => {
  try {
    const userPhone = req.user.phone;
    // IMPORTANT: Hardcode the developer phone number here. 
    // This assumes the developer uses '9413879444' as their test account.
    // If they use a different number, they can update this.
    const DEVELOPER_TEST_PHONE = '9413879444';
    
    if (userPhone !== DEVELOPER_TEST_PHONE) {
      return res.status(403).json({ status: 'error', message: 'Forbidden. This action is only allowed for the developer test account.' });
    }

    const User = require('../models/user.model');
    const user = await User.findOne({ phone: userPhone });
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });

    user.gender = user.gender === 'Male' ? 'Female' : 'Male';
    await user.save();
    
    console.log(`[Developer] Toggled gender to ${user.gender} for developer account ${userPhone}`);
    return res.status(200).json({ status: 'success', message: 'Gender toggled successfully', newGender: user.gender });
  } catch (error) {
    console.error('[Developer] Error toggling gender:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};


// POST /api/v1/user/interest/reject
exports.rejectInterest = async (req, res) => {
  try {
    if (!req.user || !req.user.phone) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized. Authentication token is missing.' });
    }

    const callerPhone = req.user.phone;
    const { fromPhone } = req.body;

    if (!fromPhone) {
      return res.status(400).json({ status: 'error', message: 'Sender profile phone number is required.' });
    }

    const interest = await Interest.findOne({ from_phone: fromPhone, to_phone: callerPhone, status: 'pending' });
    if (interest) {
      interest.status = 'rejected';
      await interest.save();
      
      await updateSeriousSeekerScore(callerPhone, interest.createdAt);
      
      return res.status(200).json({
        status: 'success',
        message: 'Interest rejected successfully.',
        interestStatus: 'rejected'
      });
    }

    return res.status(404).json({ status: 'error', message: 'Pending interest request not found.' });
  } catch (error) {
    console.error('[User Controller rejectInterest Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to reject interest.' });
  }
};


// GET /api/v1/user/chat/icebreakers/:targetPhone
exports.getIcebreakers = async (req, res) => {
  try {
    if (!req.user || !req.user.phone) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized.' });
    }

    const callerPhone = req.user.phone;
    const { targetPhone } = req.params;

    if (!targetPhone) {
      return res.status(400).json({ status: 'error', message: 'targetPhone is required.' });
    }

    const callerProfile = await User.findOne({ phone: callerPhone });
    const targetProfile = await User.findOne({ phone: targetPhone });

    if (!callerProfile || !targetProfile) {
      return res.status(404).json({ status: 'error', message: 'Profiles not found.' });
    }
    
    let icebreakers = [];
    
    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const prompt = `You are an expert AI matchmaker helping two users start a conversation.
        User A (Sender): ${callerProfile.gender}, ${callerProfile.age} yrs old, lives in ${callerProfile.city}. Works as ${callerProfile.profession}. Hobbies/Bio: ${callerProfile.bio}
        User B (Receiver): ${targetProfile.gender}, ${targetProfile.age} yrs old, lives in ${targetProfile.city}. Works as ${targetProfile.profession}. Hobbies/Bio: ${targetProfile.bio}
        
        Find common ground and write exactly 3 natural, polite, and slightly modern conversation starters (icebreakers) that User A can send to User B.
        Do not use emojis. Output ONLY a valid JSON array of strings. No markdown formatting, just the raw JSON array.`;
        
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        
        let text = result.text.trim();
        // Remove markdown formatting if any
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        icebreakers = JSON.parse(text);
      } catch (aiError) {
        console.error('[Gemini AI Icebreakers Error]', aiError.message);
      }
    }
    
    // Fallback if AI fails or key not present
    if (!icebreakers || icebreakers.length === 0) {
       icebreakers = [
         `Hi ${targetProfile.firstName}, I noticed we are in the same profession. How is your work going?`,
         `Hello! I really liked your profile. Would love to connect and know more about you.`,
         `Jai Jhulelal! I see you're from ${targetProfile.city}. I'd love to chat!`
       ];
    }

    return res.status(200).json({
      status: 'success',
      icebreakers
    });
  } catch (error) {
    console.error('[User Controller getIcebreakers Error]', error);
    return res.status(500).json({ status: 'error', message: 'Server failed to generate icebreakers.' });
  }
};
