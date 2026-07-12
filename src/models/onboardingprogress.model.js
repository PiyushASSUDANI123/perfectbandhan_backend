const mongoose = require('mongoose');

const onboardingProgressSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true
  },
  currentStep: {
    type: Number,
    required: true,
    default: 0
  },
  stepName: {
    type: String,
    default: ''
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('OnboardingProgress', onboardingProgressSchema);
