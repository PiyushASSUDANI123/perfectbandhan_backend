const Redis = require('ioredis');

class RedisService {
  constructor() {
    this.client = null;
    this.subClient = null;
    this.isReady = false;
    this._reconnectTimer = null;
  }

  connect() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 10) return null;
        return Math.min(times * 200, 2000);
      },
      enableReadyCheck: true,
      lazyConnect: true,
      // Connection pool settings
      family: 4,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    this.subClient = this.client.duplicate();

    this.client.on('connect', () => {
      this.isReady = true;
      console.log('[Redis] ✅ Connected');
    });

    this.client.on('ready', () => {
      this.isReady = true;
      console.log('[Redis] ✅ Ready');
    });

    this.client.on('error', (err) => {
      this.isReady = false;
      console.error('[Redis] ❌ Error:', err.message);
    });

    this.client.on('close', () => {
      this.isReady = false;
      console.warn('[Redis] ⚠️ Connection closed');
    });

    this.client.on('reconnecting', () => {
      console.log('[Redis] 🔄 Reconnecting...');
    });

    return this.client.connect().catch(err => {
      console.error('[Redis] Initial connection failed:', err.message);
    });
  }

  // Cache operations with TTL in seconds
  async get(key) {
    if (!this.isReady) return null;
    try {
      const val = await this.client.get(key);
      return val ? JSON.parse(val) : null;
    } catch (err) {
      console.error('[Redis] GET error:', err.message);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 300) {
    if (!this.isReady) return false;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return true;
    } catch (err) {
      console.error('[Redis] SET error:', err.message);
      return false;
    }
  }

  async del(key) {
    if (!this.isReady) return 0;
    try {
      return await this.client.del(key);
    } catch (err) {
      console.error('[Redis] DEL error:', err.message);
      return 0;
    }
  }

  async delPattern(pattern) {
    if (!this.isReady) return 0;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        return await this.client.del(...keys);
      }
      return 0;
    } catch (err) {
      console.error('[Redis] DEL pattern error:', err.message);
      return 0;
    }
  }

  // Rate limiting with sliding window
  async checkRateLimit(key, maxRequests, windowSeconds) {
    if (!this.isReady) return { allowed: true, remaining: maxRequests };
    
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);
    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local windowStart = now - window
      
      -- Remove old entries
      redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
      
      -- Count current requests
      local count = redis.call('ZCARD', key)
      
      if count >= limit then
        return {0, count}
      end
      
      -- Add current request
      redis.call('ZADD', key, now, now .. ':' .. math.random())
      redis.call('EXPIRE', key, window + 1)
      
      return {1, count + 1}
    `;
    
    try {
      const result = await this.client.eval(luaScript, 1, key, now, windowSeconds * 1000, maxRequests);
      return {
        allowed: result[0] === 1,
        remaining: Math.max(0, maxRequests - result[1])
      };
    } catch (err) {
      console.error('[Redis] Rate limit error:', err.message);
      return { allowed: true, remaining: maxRequests };
    }
  }

  // Distributed lock
  async acquireLock(key, ttlSeconds = 10) {
    if (!this.isReady) return false;
    try {
      const result = await this.client.set(`lock:${key}`, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      console.error('[Redis] Lock error:', err.message);
      return false;
    }
  }

  async releaseLock(key) {
    if (!this.isReady) return;
    try {
      await this.client.del(`lock:${key}`);
    } catch (err) {
      console.error('[Redis] Release lock error:', err.message);
    }
  }

  // Pub/Sub for cache invalidation across instances
  async publish(channel, message) {
    if (!this.isReady) return;
    try {
      await this.client.publish(channel, JSON.stringify(message));
    } catch (err) {
      console.error('[Redis] Publish error:', err.message);
    }
  }

  async subscribe(channel, handler) {
    if (!this.isReady) return;
    try {
      await this.subClient.subscribe(channel);
      this.subClient.on('message', (ch, msg) => {
        if (ch === channel) {
          try {
            handler(JSON.parse(msg));
          } catch (err) {
            console.error('[Redis] Subscribe handler error:', err.message);
          }
        }
      });
    } catch (err) {
      console.error('[Redis] Subscribe error:', err.message);
    }
  }

  async healthCheck() {
    if (!this.isReady) return false;
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async close() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this.client) await this.client.quit();
    if (this.subClient) await this.subClient.quit();
    this.isReady = false;
  }
}

module.exports = new RedisService();