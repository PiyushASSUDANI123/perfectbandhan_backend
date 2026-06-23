const mongoose = require('mongoose');

const InterestSchema = new mongoose.Schema({
  from_phone: {
    type: String,
    required: true,
    index: true
  },
  to_phone: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted'],
    default: 'pending',
    index: true
  }
}, {
  timestamps: true
});

// Ensure a single combination of from_phone and to_phone is unique
InterestSchema.index({ from_phone: 1, to_phone: 1 }, { unique: true });

module.exports = mongoose.model('Interest', InterestSchema);
