const axios = require('axios');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { parse } = require('node-html-parser');
const Database = require('../utils/Database');
const Logger = require('../utils/Logger');


class StreamMonitor extends EventEmitter {
  constructor(channels = []) {
    super();
    this.database = Database.getInstance();
    this.monitoringDbPath = path.join(this.database.databasePath, "monitoramento.json");
    this.channels = [];
    this.streamStatuses = {};
    this.twitchToken = null;
    this.twitchClientId = process.env.TWITCH_CLIENT_ID;
    this.twitchClientSecret = process.env.TWITCH_CLIENT_SECRET;
    this.pollingInterval = 60000; // 1 minute default polling interval
    this.pollingTimers = {
      twitch: null,
      kick: null,
      youtube: null
    };
    
    // Initialize database file if it doesn't exist
    this._initDatabase();

    this.logger = new Logger('stream-monitor');
    this.logger.info('Service StreamMonitor carregado');
    
    // Subscribe to initial channels if provided
    if (channels.length > 0) {
      channels.forEach(channel => {
        this.subscribe(channel.name, channel.source);
      });
    }
  }

  /**
   * Initialize the monitoring database
   * @private
   */
  _initDatabase() {
    if (!fs.existsSync(this.monitoringDbPath)) {
      fs.writeFileSync(this.monitoringDbPath, JSON.stringify({
        channels: [],
        lastKnownStatuses: {}
      }, null, 2));
    } else {
      try {
        const data = JSON.parse(fs.readFileSync(this.monitoringDbPath, 'utf8'));
        this.channels = data.channels || [];
        this.streamStatuses = data.lastKnownStatuses || {};
      } catch (error) {
        console.error('Error reading monitoring database:', error);
        // Create a new file if the existing one is corrupted
        fs.writeFileSync(this.monitoringDbPath, JSON.stringify({
          channels: [],
          lastKnownStatuses: {}
        }, null, 2));
      }
    }
  }

  /**
   * Save the current state to the database
   * @private
   */
  _saveDatabase() {
    fs.writeFileSync(this.monitoringDbPath, JSON.stringify({
      channels: this.channels,
      lastKnownStatuses: this.streamStatuses
    }, null, 2));
  }

  /**
   * Start monitoring all channels
   */
  startMonitoring() {
    // Stop any existing polling
    this.stopMonitoring();
    
    // Start new polling for each platform
    this.pollingTimers.twitch = setInterval(() => this._pollTwitchChannels(), this.pollingInterval);
    this.pollingTimers.kick = setInterval(() => this._pollKickChannels(), this.pollingInterval);
    this.pollingTimers.youtube = setInterval(() => this._pollYoutubeChannels(), this.pollingInterval);
    
    // Do an initial poll
    this._pollTwitchChannels();
    this._pollKickChannels();
    this._pollYoutubeChannels();
  }

  /**
   * Stop monitoring all channels
   */
  stopMonitoring() {
    Object.keys(this.pollingTimers).forEach(platform => {
      if (this.pollingTimers[platform]) {
        clearInterval(this.pollingTimers[platform]);
        this.pollingTimers[platform] = null;
      }
    });
  }

  /**
   * Set the polling interval for all platforms
   * @param {number} interval - Polling interval in milliseconds
   */
  setPollingInterval(interval) {
    this.pollingInterval = interval;
    // Restart monitoring with new interval
    if (Object.values(this.pollingTimers).some(timer => timer !== null)) {
      this.startMonitoring();
    }
  }

  /**
   * Subscribe to a channel
   * @param {string} channelName - The name of the channel
   * @param {string} source - The source platform (twitch, kick, youtube)
   * @returns {boolean} - Success status
   */
  subscribe(channelName, source) {
    if (!['twitch', 'kick', 'youtube'].includes(source.toLowerCase())) {
      console.error(`Invalid source: ${source}. Must be 'twitch', 'kick', or 'youtube'`);
      return false;
    }

    const normalizedSource = source.toLowerCase();
    const existingChannel = this.channels.find(
      c => c.name.toLowerCase() === channelName.toLowerCase() && 
           c.source.toLowerCase() === normalizedSource
    );

    if (!existingChannel) {
      this.channels.push({
        name: channelName,
        source: normalizedSource,
        subscribedAt: new Date().toISOString()
      });
      
      // Initialize status for this channel
      const channelKey = `${normalizedSource}:${channelName.toLowerCase()}`;
      if (!this.streamStatuses[channelKey]) {
        this.streamStatuses[channelKey] = {
          isLive: false,
          lastVideo: null,
          lastChecked: null
        };
      }
      
      this._saveDatabase();
      return true;
    }
    
    return false; // Already subscribed
  }

  /**
   * Unsubscribe from a channel
   * @param {string} channelName - The name of the channel
   * @param {string} source - The source platform
   * @returns {boolean} - Success status
   */
  unsubscribe(channelName, source) {
    const normalizedSource = source.toLowerCase();
    const initialLength = this.channels.length;
    
    this.channels = this.channels.filter(
      c => !(c.name.toLowerCase() === channelName.toLowerCase() && 
             c.source.toLowerCase() === normalizedSource)
    );
    
    // Remove status for this channel
    const channelKey = `${normalizedSource}:${channelName.toLowerCase()}`;
    if (this.streamStatuses[channelKey]) {
      delete this.streamStatuses[channelKey];
    }
    
    this._saveDatabase();
    return this.channels.length < initialLength;
  }

  /**
   * Get the status of all monitored streams
   * @returns {Object} - Status object
   */
  getStreamStatus() {
    return this.streamStatuses;
  }

  /**
   * Get the status of a specific channel
   * @param {string} channelName - The name of the channel
   * @param {string} source - The source platform
   * @returns {Object|null} - Channel status or null if not found
   */
  getChannelStatus(channelName, source) {
    const channelKey = `${source.toLowerCase()}:${channelName.toLowerCase()}`;
    return this.streamStatuses[channelKey] || null;
  }

  /**
   * Get list of all subscribed channels
   * @returns {Array} - List of channel objects
   */
  getSubscribedChannels() {
    return this.channels;
  }

   /**
   * Refresh the Twitch API token or load existing token if still valid
   * @private
   * @returns {Promise<string|null>} - The valid token or null on error
   */
  async _refreshTwitchToken() {
    try {
      const tokenFilePath = path.join(this.database.databasePath, "twitch-token.json");
      
      // Check if we have a saved token that's still valid
      try {
        // Check if token file exists
        await fs.access(tokenFilePath);
        
        // Read token file
        const tokenData = JSON.parse(await fs.readFile(tokenFilePath, 'utf8'));
        
        // If token is less than 15 days old, reuse it
        const now = Date.now();
        const tokenAge = now - tokenData.timestamp;
        const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
        
        if (tokenAge < fifteenDaysMs && tokenData.access_token) {
          this.logger.info('Using existing Twitch token (less than 15 days old)');
          this.twitchToken = tokenData.access_token;
          return this.twitchToken;
        }
      } catch (err) {
        // File doesn't exist or can't be read/parsed - we'll get a new token
        this.logger.debug('No valid token file found, requesting new Twitch token');
      }
      
      // Request a new token
      this.logger.info(`Requesting new Twitch API token`);
      
      // Using the correct format - put credentials in request body
      const response = await axios.post('https://id.twitch.tv/oauth2/token', {
        client_id: this.twitchClientId,
        client_secret: this.twitchClientSecret,
        grant_type: 'client_credentials',
      });
      
      if (response.status !== 200 && response.data){
        this.logger.error(`Twitch Token response ${JSON.stringify(response.data)}`);
      }
      if (response.status === 200 && response.data && response.data.access_token) {
        // Save the token with timestamp
        const tokenData = {
          ...response.data,
          timestamp: Date.now()
        };
        
        // Make sure directory exists
        const tokenDir = path.dirname(tokenFilePath);
        await fs.mkdirSync(tokenDir, { recursive: true });
        
        // Save token to file
        await fs.writeFileSync(tokenFilePath, JSON.stringify(tokenData, null, 2), 'utf8');
        
        this.twitchToken = response.data.access_token;
        this.logger.info('Successfully obtained and saved new Twitch token');
        return this.twitchToken;
      } else {
        throw new Error(`Unexpected response: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      this.logger.error(`Error refreshing Twitch token (${this.twitchClientId}, ${this.twitchClientSecret}):`, error.message);
      return null;
    }
  }

  /**
   * Poll Twitch channels for status updates
   * @private
   */
  async _pollTwitchChannels() {
    const twitchChannels = this.channels.filter(c => c.source.toLowerCase() === 'twitch');
    if (twitchChannels.length === 0) return;
    
    // Ensure we have a valid token
    if (!this.twitchToken) {
      //const token = await this._refreshTwitchToken();
      const token = "12345";
      if (!token) return; // Can't proceed without token
    }
    
    // Split channels into batches of 100 (Twitch API limit)
    const channelBatches = [];
    for (let i = 0; i < twitchChannels.length; i += 100) {
      channelBatches.push(twitchChannels.slice(i, i + 100));
    }
    
    for (const batch of channelBatches) {
      try {
        // First get user IDs from login names
        const userResponse = await axios.get(
          `https://api.twitch.tv/helix/users`,
          {
            headers: {
              'Client-ID': this.twitchClientId,
              'Authorization': `Bearer ${this.twitchToken}`
            },
            params: {
              login: batch.map(c => c.name.toLowerCase())
            }
          }
        );
        
        const userIds = userResponse.data.data.map(user => user.id);
        
        // Then get stream status for these users
        const streamResponse = await axios.get(
          `https://api.twitch.tv/helix/streams`,
          {
            headers: {
              'Client-ID': this.twitchClientId,
              'Authorization': `Bearer ${this.twitchToken}`
            },
            params: {
              user_id: userIds
            }
          }
        );
        
        // Process the results
        const liveStreams = streamResponse.data.data;
        const liveStreamUserIds = liveStreams.map(stream => stream.user_id);
        
        // Update status for each channel and emit events for changes
        userResponse.data.data.forEach(user => {
          const channelName = user.login;
          const channelKey = `twitch:${channelName.toLowerCase()}`;
          const isLiveNow = liveStreamUserIds.includes(user.id);
          const wasLive = this.streamStatuses[channelKey]?.isLive || false;
          const liveStream = liveStreams.find(stream => stream.user_id === user.id);
          
          // Create or update status
          if (!this.streamStatuses[channelKey]) {
            this.streamStatuses[channelKey] = {
              isLive: isLiveNow,
              lastChecked: new Date().toISOString()
            };
          } else {
            this.streamStatuses[channelKey].isLive = isLiveNow;
            this.streamStatuses[channelKey].lastChecked = new Date().toISOString();
          }
          
          // Add stream details if live
          if (isLiveNow && liveStream) {
            this.streamStatuses[channelKey].title = liveStream.title;
            this.streamStatuses[channelKey].thumbnail = liveStream.thumbnail_url
              .replace('{width}', '640')
              .replace('{height}', '360');
            this.streamStatuses[channelKey].viewerCount = liveStream.viewer_count;
            this.streamStatuses[channelKey].startedAt = liveStream.started_at;
          }
          
          // Emit events for status changes
          if (isLiveNow && !wasLive) {
            this.emit('streamOnline', {
              platform: 'twitch',
              channelName: channelName,
              title: liveStream.title,
              game: liveStream.game_name,
              thumbnail: liveStream.thumbnail_url
                .replace('{width}', '640')
                .replace('{height}', '360'),
              viewerCount: liveStream.viewer_count,
              startedAt: liveStream.started_at
            });
          } else if (!isLiveNow && wasLive) {
            this.emit('streamOffline', {
              platform: 'twitch',
              channelName: channelName
            });
          }
        });
        
      } catch (error) {
        // If unauthorized, try to refresh token
        if (error.response && error.response.status === 401) {
          await this._refreshTwitchToken();
        } else {
          console.error('Error polling Twitch channels:', error.message);
        }
      }
    }
    
    this._saveDatabase();
  }

  /**
   * Poll Kick channels for status updates
   * @private
   */
  async _pollKickChannels() {
    const kickChannels = this.channels.filter(c => c.source.toLowerCase() === 'kick');
    if (kickChannels.length === 0) return;
    
    for (const channel of kickChannels) {
      try {
        // Kick doesn't have an official API, so we'll scrape the channel page
        const response = await axios.get(`https://kick.com/api/v1/channels/${channel.name}`);
        const channelData = response.data;
        const channelKey = `kick:${channel.name.toLowerCase()}`;
        const isLiveNow = channelData.livestream !== null;
        const wasLive = this.streamStatuses[channelKey]?.isLive || false;
        
        // Create or update status
        if (!this.streamStatuses[channelKey]) {
          this.streamStatuses[channelKey] = {
            isLive: isLiveNow,
            lastChecked: new Date().toISOString()
          };
        } else {
          this.streamStatuses[channelKey].isLive = isLiveNow;
          this.streamStatuses[channelKey].lastChecked = new Date().toISOString();
        }
        
        // Add stream details if live
        if (isLiveNow && channelData.livestream) {
          this.streamStatuses[channelKey].title = channelData.livestream.session_title;
          this.streamStatuses[channelKey].thumbnail = channelData.livestream.thumbnail?.url || 
                                                     channelData.user?.profile_pic || '';
          this.streamStatuses[channelKey].viewerCount = channelData.livestream.viewer_count;
          this.streamStatuses[channelKey].startedAt = channelData.livestream.created_at;
        }
        
        // Emit events for status changes
        if (isLiveNow && !wasLive) {
          this.emit('streamOnline', {
            platform: 'kick',
            channelName: channel.name,
            title: channelData.livestream.session_title,
            game: channelData.livestream.categories[0].name,
            thumbnail: channelData.livestream.thumbnail?.url || 
                      channelData.user?.profile_pic || '',
            viewerCount: channelData.livestream.viewer_count,
            startedAt: channelData.livestream.created_at
          });
        } else if (!isLiveNow && wasLive) {
          this.emit('streamOffline', {
            platform: 'kick',
            channelName: channel.name
          });
        }
      } catch (error) {
        console.error(`Error polling Kick channel ${channel.name}:`, error.message);
      }
    }
    
    this._saveDatabase();
  }

  /**
   * Poll YouTube channels for status updates and new videos
   * @private
   */
  async _pollYoutubeChannels() {
    const youtubeChannels = this.channels.filter(c => c.source.toLowerCase() === 'youtube');
    if (youtubeChannels.length === 0) return;
    
    for (const channel of youtubeChannels) {
      try {
        // First, resolve channel name to channel ID if needed
        let channelId = channel.name;
        
        // If it's not a channel ID format, try to resolve it
        if (!channelId.startsWith('UC')) {
          try {
            const resolveResponse = await axios.get(`https://www.youtube.com/c/${channel.name}`);
            const html = resolveResponse.data;
            const root = parse(html);
            const metaTag = root.querySelector('meta[itemprop="channelId"]');
            if (metaTag) {
              channelId = metaTag.getAttribute('content');
            } else {
              // Try alternative method - find in page source
              const match = html.match(/"channelId":"([^"]+)"/);
              if (match && match[1]) {
                channelId = match[1];
              }
            }
          } catch (error) {
            // If we can't resolve, just continue with the name
            console.error(`Error resolving YouTube channel ID for ${channel.name}:`, error.message);
          }
        }
        
        // Get channel info and latest videos using RSS feed
        const response = await axios.get(
          `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
        );
        
        const channelKey = `youtube:${channel.name.toLowerCase()}`;
        
        // Parse the XML
        const parser = new (require('xml2js')).Parser({ explicitArray: false });
        const feed = await parser.parseStringPromise(response.data);
        
        if (!feed.feed || !feed.feed.entry || !Array.isArray(feed.feed.entry)) {
          // No videos or invalid response
          continue;
        }
        
        // Get the latest video/stream
        const entries = Array.isArray(feed.feed.entry) ? feed.feed.entry : [feed.feed.entry];
        
        if (entries.length === 0) continue;
        
        const latestEntry = entries[0];
        const videoId = latestEntry['yt:videoId'];
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        // Initialize channel status if needed
        if (!this.streamStatuses[channelKey]) {
          this.streamStatuses[channelKey] = {
            isLive: false,
            lastVideo: null,
            lastChecked: new Date().toISOString()
          };
        }
        
        // Check if this is a new video
        const lastVideoId = this.streamStatuses[channelKey]?.lastVideo?.id || '';
        if (videoId !== lastVideoId) {
          // Get more details about the video to determine if it's a livestream
          const videoResponse = await axios.get(`https://www.youtube.com/watch?v=${videoId}`);
          const html = videoResponse.data;
          
          // Look for live indicators in page source
          const isLiveNow = html.includes('"isLiveNow":true') || 
                            html.includes('"isLive":true') ||
                            html.includes('"liveBroadcastDetails"');
                            
          // Update status
          this.streamStatuses[channelKey].lastChecked = new Date().toISOString();
          this.streamStatuses[channelKey].lastVideo = {
            id: videoId,
            title: latestEntry.title,
            url: videoUrl,
            publishedAt: latestEntry.published,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`  // Best quality thumbnail
          };
          
          // If it's a livestream, update live status
          const wasLive = this.streamStatuses[channelKey].isLive;
          if (isLiveNow) {
            this.streamStatuses[channelKey].isLive = true;
            
            if (!wasLive) {
              // Emit streamOnline event
              this.emit('streamOnline', {
                platform: 'youtube',
                channelName: channel.name,
                title: latestEntry.title,
                thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                url: videoUrl,
                videoId: videoId
              });
            }
          } else {
            // If it was live before but not now, emit offline event
            if (wasLive) {
              this.streamStatuses[channelKey].isLive = false;
              this.emit('streamOffline', {
                platform: 'youtube',
                channelName: channel.name
              });
            }
            
            // Emit new video event
            this.emit('newVideo', {
              platform: 'youtube',
              channelName: channel.name,
              title: latestEntry.title,
              thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
              url: videoUrl,
              videoId: videoId,
              publishedAt: latestEntry.published
            });
          }
        } else {
          // Check if an existing livestream ended
          if (this.streamStatuses[channelKey].isLive) {
            try {
              const videoResponse = await axios.get(`https://www.youtube.com/watch?v=${videoId}`);
              const html = videoResponse.data;
              const isStillLive = html.includes('"isLiveNow":true') || 
                                 html.includes('"isLive":true');
              
              if (!isStillLive) {
                this.streamStatuses[channelKey].isLive = false;
                this.emit('streamOffline', {
                  platform: 'youtube',
                  channelName: channel.name
                });
              }
            } catch (error) {
              console.error(`Error checking YouTube live status for ${channel.name}:`, error.message);
            }
          }
        }
      } catch (error) {
        console.error(`Error polling YouTube channel ${channel.name}:`, error.message);
      }
    }
    
    this._saveDatabase();
  }
}

module.exports = StreamMonitor;