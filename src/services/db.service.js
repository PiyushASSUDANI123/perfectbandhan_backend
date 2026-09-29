const mongoose = require('mongoose');
const redisService = require('./redis.service');

class DbService {
  constructor() {
    this.isConnected = false;
    this._reconnectTimer = null;
    this._reconnectDelay = 5000;
    this._maxReconnectDelay = 60000;
    
    // Circuit breaker state
    this._circuitBreaker = {
      failures: 0,
      lastFailure: 0,
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      threshold: 5,
      timeout: 30000, // 30 seconds
    };
  }

  async connect() {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      console.warn('[DB Service] MONGO_URI missing. Backend operating with memory mapping schemas.');
      return false;
    }

    try {
      // Connection pool optimized for high concurrency (1000+ users)
      await mongoose.connect(mongoUri, {
        // Connection pool settings
        maxPoolSize: 50,           // Maintain up to 50 socket connections
        minPoolSize: 10,           // Keep at least 10 connections open
        maxIdleTimeMS: 60000,      // Close connections after 60s idle
        waitQueueTimeoutMS: 10000, // Wait up to 10s for a connection
        
        // Timeouts
        serverSelectionTimeoutMS: 10000,
        heartbeatFrequencyMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
        
        // Retry
        retryWrites: true,
        retryReads: true,
        
        // Compression
        compressors: ['zlib'],
        zlibCompressionLevel: 6,
      });

      this.isConnected = true;
      this._reconnectDelay = 5000;
      this._resetCircuitBreaker();
      console.log('[DB Service] ✅ MongoDB connection established (pool: 50)');
      this._attachEventListeners();
      
      // Connect Redis for distributed caching
      if (process.env.REDIS_URL) {
        await redisService.connect();
      }
      
      return true;
    } catch (err) {
      console.error('[DB Service] ❌ Connection failure:', err.message);
      this._scheduleReconnect();
      return false;
    }
  }

  _resetCircuitBreaker() {
    this._circuitBreaker = {
      failures: 0,
      lastFailure: 0,
      state: 'CLOSED',
      threshold: 5,
      timeout: 30000,
    };
  }

  _recordFailure() {
    this._circuitBreaker.failures++;
    this._circuitBreaker.lastFailure = Date.now();
    
    if (this._circuitBreaker.failures >= this._circuitBreaker.threshold) {
      this._circuitBreaker.state = 'OPEN';
      console.warn('[DB Service] ⚠️ Circuit breaker OPEN - too many failures');
      
      // Auto-transition to HALF_OPEN after timeout
      setTimeout(() => {
        if (this._circuitBreaker.state === 'OPEN') {
          this._circuitBreaker.state = 'HALF_OPEN';
          console.log('[DB Service] 🔄 Circuit breaker HALF_OPEN - testing connection');
        }
      }, this._circuitBreaker.timeout);
    }
  }

  _recordSuccess() {
    if (this._circuitBreaker.state === 'HALF_OPEN') {
      this._resetCircuitBreaker();
      console.log('[DB Service] ✅ Circuit breaker CLOSED - connection recovered');
    } else if (this._circuitBreaker.failures > 0) {
      this._circuitBreaker.failures = Math.max(0, this._circuitBreaker.failures - 1);
    }
  }

  isCircuitOpen() {
    return this._circuitBreaker.state === 'OPEN';
  }

  _attachEventListeners() {
    const conn = mongoose.connection;

    conn.removeAllListeners('disconnected');
    conn.removeAllListeners('error');
    conn.removeAllListeners('reconnected');
    conn.removeAllListeners('connected');

    conn.on('connected', () => {
      this.isConnected = true;
      this._reconnectDelay = 5000;
      this._recordSuccess();
      console.log('[DB Service] ✅ Mongoose connected to MongoDB.');
    });

    conn.on('reconnected', () => {
      this.isConnected = true;
      this._reconnectDelay = 5000;
      this._recordSuccess();
      console.log('[DB Service] 🔄 Mongoose reconnected to MongoDB.');
    });

    conn.on('disconnected', () => {
      this.isConnected = false;
      this._recordFailure();
      console.warn('[DB Service] ⚠️  Mongoose disconnected from MongoDB. Attempting reconnect...');
      this._scheduleReconnect();
    });

    conn.on('error', (err) => {
      this.isConnected = false;
      this._recordFailure();
      console.error('[DB Service] ❌ Mongoose connection error:', err.message);
    });
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;

    console.log(`[DB Service] 🕐 Reconnecting in ${this._reconnectDelay / 1000}s...`);
    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      await this.connect();
    }, this._reconnectDelay);

    this._reconnectDelay = Math.min(this._reconnectDelay * 2, this._maxReconnectDelay);
  }

  /** Utility: Check if DB is live before running a query */
  get ready() {
    return mongoose.connection.readyState === 1 && !this.isCircuitOpen();
  }

  /** Get connection pool stats */
  getPoolStats() {
    const conn = mongoose.connection;
    if (!conn.readyState) return null;
    
    return {
      readyState: conn.readyState,
      host: conn.host,
      port: conn.port,
      name: conn.name,
      // These are available in newer mongoose versions
      // poolSize: conn.client?.topology?.s?.pool?.size,
      // available: conn.client?.topology?.s?.pool?.available?.length,
    };
  }
}

module.exports = new DbService();
