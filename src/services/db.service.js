const mongoose = require('mongoose');

class DbService {
  constructor() {
    this.isConnected = false;
    this._reconnectTimer = null;
    this._reconnectDelay = 5000;   // start at 5s
    this._maxReconnectDelay = 60000; // cap at 60s
  }

  async connect() {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      console.warn('[DB Service] MONGO_URI missing. Backend operating with memory mapping schemas.');
      return false;
    }

    try {
      await mongoose.connect(mongoUri, {
        // Keep connection alive
        serverSelectionTimeoutMS: 10000,   // 10s to pick a server
        heartbeatFrequencyMS: 10000,        // ping Atlas every 10s
        socketTimeoutMS: 45000,             // socket idle timeout
        connectTimeoutMS: 15000,            // initial TCP connect timeout
        // Auto reconnect handled by mongoose 6+ internally,
        // but we also add our own listeners for safety
      });

      this.isConnected = true;
      this._reconnectDelay = 5000; // reset backoff on success
      console.log('[DB Service] ✅ MongoDB connection established via Mongoose successfully.');
      this._attachEventListeners();
      return true;
    } catch (err) {
      console.error('[DB Service] ❌ Connection failure:', err.message);
      this._scheduleReconnect();
      return false;
    }
  }

  _attachEventListeners() {
    const conn = mongoose.connection;

    // Remove old listeners to avoid duplicates on re-attach
    conn.removeAllListeners('disconnected');
    conn.removeAllListeners('error');
    conn.removeAllListeners('reconnected');
    conn.removeAllListeners('connected');

    conn.on('connected', () => {
      this.isConnected = true;
      this._reconnectDelay = 5000;
      console.log('[DB Service] ✅ Mongoose connected to MongoDB.');
    });

    conn.on('reconnected', () => {
      this.isConnected = true;
      this._reconnectDelay = 5000;
      console.log('[DB Service] 🔄 Mongoose reconnected to MongoDB.');
    });

    conn.on('disconnected', () => {
      this.isConnected = false;
      console.warn('[DB Service] ⚠️  Mongoose disconnected from MongoDB. Attempting reconnect...');
      this._scheduleReconnect();
    });

    conn.on('error', (err) => {
      this.isConnected = false;
      console.error('[DB Service] ❌ Mongoose connection error:', err.message);
      // disconnected event will follow, which triggers reconnect
    });
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return; // already scheduled

    console.log(`[DB Service] 🕐 Reconnecting in ${this._reconnectDelay / 1000}s...`);
    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      await this.connect();
    }, this._reconnectDelay);

    // Exponential backoff — double the delay, cap at max
    this._reconnectDelay = Math.min(this._reconnectDelay * 2, this._maxReconnectDelay);
  }

  /** Utility: Check if DB is live before running a query */
  get ready() {
    return mongoose.connection.readyState === 1;
  }
}

module.exports = new DbService();
