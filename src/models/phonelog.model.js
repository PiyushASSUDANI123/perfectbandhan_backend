const mongoose = require('mongoose');

const phoneLogSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('PhoneLog', phoneLogSchema);
