const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  reporterPhone: {
    type: String,
    required: true,
    index: true
  },
  reportedPhone: {
    type: String,
    required: true,
    index: true
  },
  reason: {
    type: String,
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'action_taken', 'dismissed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', ReportSchema);
