const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  password: {
    type: String,
    default: ''
  },
  profileFor: {
    type: String,
    required: true
  },
  gender: {
    type: String,
    required: true,
    index: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  caste: {
    type: String
  },
  sindhiType: {
    type: String,
    default: 'Sindhi Hindu'
  },
  dob: {
    type: Date,
    required: true
  },
  height: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true,
    index: true
  },
  state: {
    type: String,
    required: true
  },
  maritalStatus: {
    type: String,
    required: true
  },
  education: {
    type: String,
    required: true
  },
  profession: {
    type: String,
    required: true
  },
  professionSector: {
    type: String,
    default: 'Corporate Job'
  },
  company: {
    type: String,
    default: 'Self'
  },
  location: {
    type: String,
    required: true
  },
  bio: {
    type: String,
    default: ''
  },
  compatibilityScore: {
    type: Number,
    default: 80
  },
  initials: {
    type: String,
    default: ''
  },
  fathersOccupation: {
    type: String,
    default: ''
  },
  weight: {
    type: String,
    default: ''
  },
  fatherStatus: {
    type: String,
    default: 'Alive'
  },
  motherStatus: {
    type: String,
    default: 'Alive'
  },
  mothersOccupation: {
    type: String,
    default: ''
  },
  siblingsCount: {
    type: String,
    default: '0'
  },
  siblingsDetails: {
    type: String,
    default: ''
  },
  manglikStatus: {
    type: String,
    default: 'Not Manglik'
  },
  otherGrah: {
    type: String,
    default: ''
  },
  medicalFit: {
    type: String,
    default: 'Yes'
  },
  medicalIssue: {
    type: String,
    default: ''
  },
  liveWithFamily: {
    type: String,
    default: 'Yes'
  },
  liveWithWhom: {
    type: String,
    default: ''
  },
  aboutFamily: {
    type: String,
    default: ''
  },
  incomeBracket: {
    type: String,
    required: true
  },
  gradientColors: {
    type: [String],
    default: ['#C2E9FB', '#A1C4FD']
  },
  uploadedPhotos: {
    type: [String],
    required: true
  },
  // --- New Advanced Fields ---
  monthlyIncome: {
    type: String,
    default: ''
  },
  yearlyIncome: {
    type: String,
    default: ''
  },
  district: {
    type: String,
    default: ''
  },
  properAddress: {
    type: String,
    default: ''
  },
  jobPost: {
    type: String,
    default: ''
  },
  ownHouse: {
    type: String,
    default: ''
  },
  housePhoto: {
    type: String,
    default: ''
  },
  surname: {
    type: String,
    default: ''
  },
  nukh: {
    type: String,
    default: ''
  },
  requirements: {
    type: String,
    default: ''
  },
  whatWeProvide: {
    type: String,
    default: ''
  },
  physicalDisability: {
    type: String,
    default: ''
  },
  complexion: {
    type: String,
    default: ''
  },
  whatsappNumber: {
    type: String,
    default: ''
  },
  chatConnections: {
    type: [String],
    default: []
  },
  lastResetMonth: {
    type: Number,
    default: new Date().getMonth()
  },
  // --- Profile Settings & Privacy ---
  familyType: {
    type: String,
    default: 'Nuclear'
  },
  cityOfOrigin: {
    type: String,
    default: ''
  },
  profileHidden: {
    type: Boolean,
    default: false
  },
  incomeHidden: {
    type: Boolean,
    default: false
  },
  photosVisibility: {
    type: String,
    default: 'All Matches'
  },
  // --- Premium Feature Counters ---
  connects: {
    type: Number,
    default: 5
  },
  superLikes: {
    type: Number,
    default: 2
  },
  // --- Partner Preferences ---
  partnerPreferences: {
    minAge: { type: Number, default: 22 },
    maxAge: { type: Number, default: 26 },
    minHeight: { type: String, default: "5'0\"" },
    maxHeight: { type: String, default: "5'10\"" },
    country: { type: String, default: 'India' },
    state: { type: String, default: 'Not set' },
    city: { type: String, default: 'Not set' },
    religion: { type: [String], default: ['Hindu'] },
    caste: { type: [String], default: [] },
    motherTongue: { type: [String], default: [] },
    manglikStatus: { type: [String], default: ['Non Manglik'] },
    education: { type: [String], default: [] },
    professionSector: { type: [String], default: [] },
    incomeRupees: { type: String, default: '0 and above' },
    incomeDollars: { type: String, default: '0 and above' }
  },
  hobbies: {
    type: [String],
    default: []
  },
  reportedBy: {
    type: [String],
    default: []
  },
  blockedBy: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  fcmToken: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Compound indexes for optimal matrimony search query execution
UserSchema.index({ gender: 1, profileHidden: 1, maritalStatus: 1 });
UserSchema.index({ gender: 1, city: 1, dob: 1 });
UserSchema.index({ gender: 1, professionSector: 1, incomeBracket: 1 });

module.exports = mongoose.model('User', UserSchema);
