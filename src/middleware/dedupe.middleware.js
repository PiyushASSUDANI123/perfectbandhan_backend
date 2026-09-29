const redisService = require('../services/redis.service');

/**
 * Request Deduplication Middleware
 * Prevents duplicate simultaneous requests for the same resource
 * Uses Redis distributed lock
 */
const inflightRequests = new Map(); // Local cache for same-instance deduplication

function createDedupeMiddleware(keyGenerator, ttlMs = 5000) {
  return async (req, res, next) => {
    const key = keyGenerator(req);
    if (!key) return next();
    
    const lockKey = `dedupe:${key}`;
    
    // Check local in-flight first (fast)
    if (inflightRequests.has(key)) {
      try {
        // Wait for the in-flight request to complete
        const result = await inflightRequests.get(key);
        return res.json(result);
      } catch (err) {
        // If failed, continue to make actual request
        console.warn('[Dedupe] Local wait failed, proceeding:', err.message);
      }
    }
    
    // Try to acquire distributed lock
    const lockAcquired = await redisService.acquireLock(lockKey, Math.ceil(ttlMs / 1000));
    
    if (!lockAcquired) {
      if (!redisService.isReady) {
        console.warn(`[Dedupe] Redis not ready, bypassing lock for ${key}`);
      } else {
        // Another instance is processing - wait and retry
        console.log(`[Dedupe] Lock held for ${key}, waiting...`);
        
        // Wait for lock to be released (poll)
        const maxWait = ttlMs;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
          await new Promise(r => setTimeout(r, 50));
          if (!await redisService.client.exists(`lock:${lockKey}`)) {
            break;
          }
        }
        
        // Try to get cached result after lock released
        const cached = await redisService.get(`cache:${key}`);
        if (cached) {
          return res.json(cached);
        }
      }
    }
    const originalJson = res.json.bind(res);
    let responseData = null;
    
    res.json = (data) => {
      responseData = data;
      return originalJson(data);
    };
    
    // Store promise for local deduplication
    const promise = new Promise((resolve, reject) => {
      const originalEnd = res.end;
      res.end = function(...args) {
        originalEnd.apply(this, args);
        
        if (responseData && res.statusCode === 200) {
          // Cache successful response
          redisService.set(`cache:${key}`, responseData, 300).catch(() => {});
        }
        
        // Release lock
        redisService.releaseLock(lockKey).catch(() => {});
        
        // Clean up local inflight
        inflightRequests.delete(key);
        
        if (responseData) resolve(responseData);
        else reject(new Error('No response data'));
      };
    });
    
    inflightRequests.set(key, promise);
    
    // Cleanup on response finish
    res.on('finish', () => {
      inflightRequests.delete(key);
    });
    
    next();
  };
}

/**
 * Cache invalidation helper
 */
async function invalidateCache(pattern) {
  await redisService.delPattern(pattern);
  // Also publish invalidation event for other instances
  await redisService.publish('cache:invalidate', { pattern });
}

/**
 * Write-behind cache for profile updates
 * Batches profile writes to reduce DB load
 */
const writeBuffer = new Map();
const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 5000; // 5 seconds

async function flushWriteBuffer() {
  if (writeBuffer.size === 0) return;
  
  const operations = Array.from(writeBuffer.values());
  writeBuffer.clear();
  
  try {
    // Bulk write to MongoDB
    const User = require('../models/user.model');
    const bulkOps = operations.map(op => ({
      updateOne: {
        filter: { _id: op.userId },
        update: { $set: op.data },
        upsert: false
      }
    }));
    
    if (bulkOps.length > 0) {
      await User.bulkWrite(bulkOps, { ordered: false });
      console.log(`[WriteBehind] Flushed ${bulkOps.length} profile updates`);
    }
  } catch (err) {
    console.error('[WriteBehind] Flush error:', err.message);
    // Re-queue failed operations
    operations.forEach(op => writeBuffer.set(op.userId, op));
  }
}

// Periodic flush
setInterval(flushWriteBuffer, FLUSH_INTERVAL);

// Graceful flush on shutdown
process.on('SIGTERM', flushWriteBuffer);
process.on('SIGINT', flushWriteBuffer);

function queueProfileWrite(userId, data) {
  writeBuffer.set(userId, { userId, data, timestamp: Date.now() });
  
  // Flush immediately if buffer full
  if (writeBuffer.size >= BATCH_SIZE) {
    flushWriteBuffer();
  }
}

module.exports = {
  createDedupeMiddleware,
  invalidateCache,
  queueProfileWrite,
  flushWriteBuffer
};