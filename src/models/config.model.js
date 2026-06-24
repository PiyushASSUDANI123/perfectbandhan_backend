const mongoose = require('mongoose');

/**
 * AppConfig Model
 * Stores the current app version requirements for update management.
 * Admin can update these values from the Admin Panel.
 */
const AppConfigSchema = new mongoose.Schema({
  latestVersion: {
    type: String,
    default: '1.0.0'
  },
  minVersion: {
    type: String,
    default: '1.0.0'   // Minimum version that can still run the app
  },
  forceUpdate: {
    type: Boolean,
    default: false      // If true, shows un-dismissible update screen
  },
  updateMessage: {
    type: String,
    default: 'A new version of Perfect Bandhan is available. Please update for the best experience.'
  },
  downloadUrl: {
    type: String,
    default: 'https://play.google.com/store/apps/details?id=com.piyush.assudani'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AppConfig', AppConfigSchema);
