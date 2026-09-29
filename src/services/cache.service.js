const NodeCache = require('node-cache');

// Standard TTL of 5 minutes (300 seconds), check for expired keys every 320s
const nodeCache = new NodeCache({ stdTTL: 300, checkperiod: 320 });

class CacheService {
  /**
   * Get a cached value
   */
  get(key) {
    return nodeCache.get(key);
  }

  /**
   * Set a cached value
   * @param {string} key 
   * @param {any} value 
   * @param {number} [ttlSeconds] - TTL in seconds (default: 300)
   */
  set(key, value, ttlSeconds = 300) {
    nodeCache.set(key, value, ttlSeconds);
  }

  /**
   * Delete a cached value
   */
  delete(key) {
    return nodeCache.del(key);
  }

  /**
   * Clear everything
   */
  clear() {
    nodeCache.flushAll();
  }
}

// Export singleton instance
module.exports = new CacheService();
