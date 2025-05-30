// ./src/services/CacheManager.js
const Redis = require('ioredis');

class CacheManager {
  constructor(redisURL, redisTTL, maxCacheSize) {
    this.redisURL = redisURL;
    this.redisTTL = parseInt(redisTTL, 10) || 3600;
    this.maxCacheSize = parseInt(maxCacheSize, 10) || 100;

    this.messageCache = []; // For in-memory fallback
    this.contactCache = []; // For in-memory fallback

    this.redisClient = null;

    if (this.redisURL) {
      try {
        this.redisClient = new Redis(this.redisURL, { /* ... options ... */ });
        this.redisClient.on('connect', () => console.log('CacheManager: Connected to Redis.'));
        this.redisClient.on('error', (err) => console.error('CacheManager: Redis client error:', err.message));
        // Optional initial ping
        this.redisClient.ping().catch(err => console.warn(`CacheManager: Initial Redis ping failed: ${err.message}.`));
      } catch (error) {
        console.error('CacheManager: Failed to initialize Redis client:', error.message);
        this.redisClient = null;
      }
    } else {
      console.log('CacheManager: No redisURL provided. Using in-memory cache only.');
    }
  }

  async putMessageInCache(data) {
    if (!data || !data.key || typeof data.key.id === 'undefined') {
      console.error('CacheManager (putMessageInCache): Invalid message data.');
      return;
    }
    const messageId = data.key.id;
    const redisKey = `message:${messageId}`;

    if (this.redisClient) {
      try {
        await this.redisClient.set(redisKey, JSON.stringify(data), 'EX', this.redisTTL);
        return;
      } catch (err) {
        console.error(`CacheManager (putMessageInCache): Error caching message ${messageId} in Redis: ${err.message}. Falling back.`);
      }
    }
    this.messageCache.push(data);
    if (this.messageCache.length > this.maxCacheSize) {
      this.messageCache.shift();
    }
  }

  async putSentMessageInCache(key) {
    if (!key || !key.id || typeof key.id === 'undefined') {
      console.error('CacheManager (putSentMessageInCache): Invalid message key data.');
      return;
    }
    const messageId = key.id;
    const redisKey = `message:${messageId}`;

    if (this.redisClient) {
      try {
        await this.redisClient.set(redisKey, JSON.stringify(key), 'EX', this.redisTTL);
        return;
      } catch (err) {
        console.error(`CacheManager (putSentMessageInCache): Error caching message key ${messageId} in Redis: ${err.message}. Falling back.`);
      }
    }
    this.messageCache.push(key);
    if (this.messageCache.length > this.maxCacheSize) {
      this.messageCache.shift();
    }
  }


  async getMessageFromCache(id) {
    if (typeof id === 'undefined' || id === null) return null;
    const redisKey = `message:${id}`;

    if (this.redisClient) {
      try {
        const cachedData = await this.redisClient.get(redisKey);
        if (cachedData) return JSON.parse(cachedData);
      } catch (err) {
        console.error(`CacheManager (getMessageFromCache): Error retrieving message ${id} from Redis: ${err.message}. Falling back.`);
      }
    }
    return this.messageCache.find(m => m.key && m.key.id == id) || null;
  }

  async putContactInCache(data) {
    if (!data || typeof data.number === 'undefined') {
      console.error('CacheManager (putContactInCache): Invalid contact data.');
      return;
    }
    const contactNumber = data.number;
    const redisKey = `contact:${contactNumber}`;

    if (this.redisClient) {
      try {
        await this.redisClient.set(redisKey, JSON.stringify(data), 'EX', this.redisTTL);
        return;
      } catch (err) {
        console.error(`CacheManager (putContactInCache): Error caching contact ${contactNumber} in Redis: ${err.message}. Falling back.`);
      }
    }
    this.contactCache.push(data);
    if (this.contactCache.length > this.maxCacheSize) {
      this.contactCache.shift();
    }
  }

  async getContactFromCache(id) {
    if (typeof id === 'undefined' || id === null) return null;
    const redisKey = `contact:${id}`;

    if (this.redisClient) {
      try {
        const cachedData = await this.redisClient.get(redisKey);
        if (cachedData) return JSON.parse(cachedData);
      } catch (err) {
        console.error(`CacheManager (getContactFromCache): Error retrieving contact ${id} from Redis: ${err.message}. Falling back.`);
      }
    }
    return this.contactCache.find(c => c.number == id) || null;
  }

  async disconnectRedis() {
    if (this.redisClient && (this.redisClient.status === 'ready' || this.redisClient.status === 'connecting' || this.redisClient.status === 'reconnecting')) {
      try {
        await this.redisClient.quit();
        console.log('CacheManager: Redis client disconnected gracefully.');
      } catch (err) {
        console.error('CacheManager: Error disconnecting Redis client:', err.message);
      } finally {
        this.redisClient = null;
      }
    }
  }
}

module.exports = CacheManager;