class CacheService {
  constructor() {
    this.store = new Map();
    this.timeouts = new Map();
  }

  // Set a key-value pair with a TTL (Time-To-Live) in milliseconds
  set(key, value, ttlMs = 300000) {
    // Clear any existing timeout for this key
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
    }

    this.store.set(key, value);

    // Auto-expiry timeout
    const timeout = setTimeout(() => {
      this.delete(key);
      console.log(`[CacheService] Key "${key}" expired and deleted.`);
    }, ttlMs);

    this.timeouts.set(key, timeout);
  }

  // Get key value
  get(key) {
    return this.store.get(key);
  }

  // Delete key
  delete(key) {
    if (this.timeouts.has(key)) {
      clearTimeout(this.timeouts.get(key));
      this.timeouts.delete(key);
    }
    return this.store.delete(key);
  }

  // Clear everything
  clear() {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.store.clear();
    this.timeouts.clear();
  }
}

// Export singleton instance
module.exports = new CacheService();
