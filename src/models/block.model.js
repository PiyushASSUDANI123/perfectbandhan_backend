const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema({
  blockerPhone: {
    type: String,
    required: true,
    index: true
  },
  blockedPhone: {
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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Block', BlockSchema);
