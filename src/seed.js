require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user.model');
const Interest = require('./models/interest.model');

const seedProfiles = [
  {
    phone: '9820011223',
    profileFor: 'Self',
    gender: 'Female',
    firstName: 'Kritika',
    lastName: 'Wadhwani',
    dob: new Date('1998-08-22'),
    height: "5'5\"",
    city: 'Mumbai',
    state: 'Maharashtra',
    maritalStatus: 'Never Married',
    education: 'MBA, NMIMS Mumbai',
    profession: 'Marketing Manager',
    professionSector: 'Corporate Job',
    company: 'Unilever India',
    location: 'Mumbai, Maharashtra',
    bio: 'Jai Jhulelal. Born and raised in a traditional yet modern Sindhi family in Bandra. I enjoy reading, exploring new cafes, and traveling. Looking for an educated and well-settled partner with good family values.',
    compatibilityScore: 95,
    initials: 'KW',
    fathersOccupation: 'Textile Business Owner',
    incomeBracket: '10-20 Lakhs',
    gradientColors: ['#FF9A9E', '#FECFEF'],
    uploadedPhotos: ['https://i.pravatar.cc/500?img=47', 'https://i.pravatar.cc/500?img=48'],
    monthlyIncome: '1.2 Lakhs',
    yearlyIncome: '15 Lakhs',
    district: 'Mumbai Suburban',
    properAddress: 'Carter Road, Bandra West',
    ownHouse: 'Yes',
    complexion: 'Fair',
    weight: '58 kg',
    fatherStatus: 'Alive',
    motherStatus: 'Alive',
    mothersOccupation: 'Homemaker',
    siblingsCount: '1',
    siblingsDetails: '1 younger brother, studying abroad',
    sindhiType: 'Amil Sindhi'
  },
  {
    phone: '9833055441',
    profileFor: 'Self',
    gender: 'Male',
    firstName: 'Rahul',
    lastName: 'Hinduja',
    dob: new Date('1995-11-14'),
    height: "5'11\"",
    city: 'Pune',
    state: 'Maharashtra',
    maritalStatus: 'Never Married',
    education: 'B.Tech CS, VJTI',
    profession: 'Software Engineer',
    professionSector: 'Corporate Job',
    company: 'Amazon',
    location: 'Pune, Maharashtra',
    bio: 'Software engineer by profession, foodie by heart. I love weekend getaways, playing cricket, and spending time with my family. Seeking a progressive and caring life partner.',
    compatibilityScore: 92,
    initials: 'RH',
    fathersOccupation: 'Retired Bank Manager',
    incomeBracket: '20+ Lakhs',
    gradientColors: ['#84FAB0', '#8FD3F4'],
    uploadedPhotos: ['https://i.pravatar.cc/500?img=11', 'https://i.pravatar.cc/500?img=12'],
    monthlyIncome: '2.5 Lakhs',
    yearlyIncome: '30 Lakhs',
    district: 'Pune',
    properAddress: 'Koregaon Park, Pune',
    ownHouse: 'Yes',
    complexion: 'Wheatish',
    weight: '75 kg',
    fatherStatus: 'Alive',
    motherStatus: 'Alive',
    mothersOccupation: 'Teacher',
    siblingsCount: '1',
    siblingsDetails: '1 elder sister, married',
    sindhiType: 'Bhaiband Sindhi'
  },
  {
    phone: '9811223344',
    profileFor: 'Daughter',
    gender: 'Female',
    firstName: 'Simran',
    lastName: 'Makhija',
    dob: new Date('2000-02-10'),
    height: "5'3\"",
    city: 'Jaipur',
    state: 'Rajasthan',
    maritalStatus: 'Never Married',
    education: 'B.Com Honors',
    profession: 'Not Working',
    professionSector: 'Not Working',
    company: 'None',
    location: 'Jaipur, Rajasthan',
    bio: 'Simran is our lovely daughter. She is family-oriented, respects elders, and has a deep root in our Sindhi traditions. She loves cooking and interior decoration. Looking for a respectful boy from a good business family.',
    compatibilityScore: 88,
    initials: 'SM',
    fathersOccupation: 'Jewellery Shop Owner',
    incomeBracket: 'Under 5 Lakh',
    gradientColors: ['#A1C4FD', '#C2E9FB'],
    uploadedPhotos: ['https://i.pravatar.cc/500?img=34'],
    monthlyIncome: '',
    yearlyIncome: '',
    district: 'Jaipur',
    properAddress: 'Malviya Nagar, Jaipur',
    ownHouse: 'Yes',
    complexion: 'Very Fair',
    weight: '54 kg',
    fatherStatus: 'Alive',
    motherStatus: 'Alive',
    mothersOccupation: 'Housewife',
    siblingsCount: '2',
    siblingsDetails: 'Both brothers managing family business',
    sindhiType: 'Sindhi Hindu'
  },
  {
    phone: '9920112255',
    profileFor: 'Self',
    gender: 'Male',
    firstName: 'Varun',
    lastName: 'Chhabria',
    dob: new Date('1994-05-30'),
    height: "6'0\"",
    city: 'Ahmedabad',
    state: 'Gujarat',
    maritalStatus: 'Never Married',
    education: 'BBA, FLAME University',
    profession: 'Business Owner',
    professionSector: 'Business',
    company: 'Chhabria Enterprises',
    location: 'Ahmedabad, Gujarat',
    bio: 'Managing our family’s FMCG distribution business in Gujarat. I believe in a balanced life of hard work and family time. I am looking for a partner who is friendly, educated, and willing to settle in Ahmedabad.',
    compatibilityScore: 90,
    initials: 'VC',
    fathersOccupation: 'Businessman',
    incomeBracket: '20+ Lakhs',
    gradientColors: ['#F6D365', '#FDA085'],
    uploadedPhotos: ['https://i.pravatar.cc/500?img=51', 'https://i.pravatar.cc/500?img=52'],
    monthlyIncome: '3 Lakhs',
    yearlyIncome: '35 Lakhs',
    district: 'Ahmedabad',
    properAddress: 'Bodakdev, Ahmedabad',
    ownHouse: 'Yes',
    complexion: 'Fair',
    weight: '82 kg',
    fatherStatus: 'Alive',
    motherStatus: 'Alive',
    mothersOccupation: 'Homemaker',
    siblingsCount: '0',
    siblingsDetails: 'None',
    sindhiType: 'Shikarpuri Sindhi'
  },
  {
    phone: '9899001122',
    profileFor: 'Self',
    gender: 'Female',
    firstName: 'Pooja',
    lastName: 'Lalwani',
    dob: new Date('1997-09-05'),
    height: "5'6\"",
    city: 'Delhi',
    state: 'Delhi',
    maritalStatus: 'Never Married',
    education: 'CA Finalist',
    profession: 'Financial Analyst',
    professionSector: 'Corporate Job',
    company: 'KPMG',
    location: 'Delhi',
    bio: 'Ambitious yet deeply rooted in cultural values. I work as an analyst in a Big4 firm. I appreciate honesty, good humor, and spiritual grounding. Seeking a partner who is supportive of my career and shares similar values.',
    compatibilityScore: 97,
    initials: 'PL',
    fathersOccupation: 'Senior Government Official',
    incomeBracket: '10-20 Lakhs',
    gradientColors: ['#D4FC79', '#96E6A1'],
    uploadedPhotos: ['https://i.pravatar.cc/500?img=42'],
    monthlyIncome: '1 Lakh',
    yearlyIncome: '12 Lakhs',
    district: 'South Delhi',
    properAddress: 'Lajpat Nagar, New Delhi',
    ownHouse: 'Yes',
    complexion: 'Fair',
    weight: '60 kg',
    fatherStatus: 'Alive',
    motherStatus: 'Alive',
    mothersOccupation: 'Homemaker',
    siblingsCount: '1',
    siblingsDetails: '1 elder sister, married in Mumbai',
    sindhiType: 'Sindhi Hindu'
  }
];

async function seedDatabase() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is missing from backend environment variables.');
    }
    
    console.log('[Seeding] Connecting to MongoDB Atlas cluster...');
    await mongoose.connect(mongoUri);
    console.log('[Seeding] Connected successfully.');

    // 1. Delete existing collection data
    console.log('[Seeding] Clearing existing User and Interest collections...');
    await User.deleteMany({});
    await Interest.deleteMany({});
    console.log('[Seeding] Collections cleared.');

    // 2. Filter and enrich profiles
    const finalProfilesToSeed = seedProfiles.map(p => ({
        ...p,
        email: `${p.firstName.toLowerCase()}.${p.lastName.toLowerCase()}@example.com`,
        caste: p.lastName,
        nukh: p.lastName
      }));

    console.log(`[Seeding] Seeding ${finalProfilesToSeed.length} profiles...`);
    const createdUsers = await User.insertMany(finalProfilesToSeed);
    console.log(`[Seeding] Successfully seeded ${createdUsers.length} profiles.`);

    await mongoose.disconnect();
    console.log('[Seeding] Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('[Seeding Error] Seeding process failed:', error.message);
    process.exit(1);
  }
}

seedDatabase();
