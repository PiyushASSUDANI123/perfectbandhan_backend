const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  targetPhone: {
    type: String,
    default: null, // If null, this is a global notification
    index: true,
  },
  type: {
    type: String,
    default: 'info',
  },
  readBy: [{
    type: String
  }],
  deletedBy: [{
    type: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
