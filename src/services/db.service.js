const mongoose = require('mongoose');

class DbService {
  constructor() {
    this.isConnected = false;
  }

  async connect() {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      console.warn('[DB Service] MONGO_URI missing. Backend operating with memory mapping schemas.');
      return false;
    }

    try {
      await mongoose.connect(mongoUri);
      this.isConnected = true;
      console.log('[DB Service] MongoDB connection established via Mongoose successfully.');
      return true;
    } catch (err) {
      console.error('[DB Service] Connection failure:', err.message);
      return false;
    }
  }
}

module.exports = new DbService();
