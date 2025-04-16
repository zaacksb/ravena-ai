const fs = require('fs').promises;
const path = require('path');

const YT_CACHE_FILE = "youtube-cache.json";

// Helper function to check if a file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

class VideoCacheManager {
  constructor(downloader, databasePath) {
    this.getVideoInfo = downloader;
    this.downloadAudio = downloader;
    this.downloadVideo = downloader;
    this.cachePath = path.join(databasePath, YT_CACHE_FILE);
  }

  /**
   * Read the cache file, creating it if it doesn't exist
   * @returns {Promise<Object>} Parsed cache object
   */
  async _readCache() {
    try {
      const cacheContent = await fs.readFile(this.cachePath, 'utf8');
      return JSON.parse(cacheContent);
    } catch (error) {
      // If file doesn't exist or can't be read, return an empty cache
      console.error(`[_readCache] Error, resetting cache.`);
      await this._writeCache({});

      return {};
      //throw error;
    }
  }

  getTimestamp(){
    var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
      var localISOTime = (new Date(Date.now() - tzoffset)).toISOString().replace(/T/, ' ').replace(/\..+/, '');
    //return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    return localISOTime;
  }


  /**
   * Write the entire cache to file
   * @param {Object} cache - The cache object to write
   */
  async _writeCache(cache) {
    try {
      await fs.writeFile(this.cachePath, JSON.stringify(cache, null, 2), 'utf8');
    } catch (error) {
      console.error('Error writing cache:', error);
      throw error;
    }
  }

  /**
   * Get video info with caching
   * @param {string} id - Video ID
   * @param {Object} options - Options for fetching video info
   * @returns {Promise<Object>} Video information
   */
  async getVideoInfoWithCache(id, options) {
    const cache = await this._readCache();

    // If cached info exists, return it
    if (cache[id] && cache[id].videoInfo) {

      return cache[id].videoInfo;
    }

    // Fetch new video info
    const videoInfo = await this.getVideoInfo(id, options);

    // Update cache
    cache[id] = cache[id] || {};
    cache[id].videoInfo = {id: videoInfo.id, uploader: videoInfo.uploader, title: videoInfo.title, duration: videoInfo.duration, timestamp: this.getTimestamp(), ts: Math.round(+new Date()/1000)};



    // Write updated cache
    await this._writeCache(cache);

    return videoInfo;
  }

  /**
   * Set the last download location for a video/audio
   * @param {string} id - Video ID
   * @param {string} downloadPath - Path where the video/audio was downloaded
   * @param {string} type - Type of download ('video' or 'audio')
   */
  async setLastDownloadLocation(id, downloadPath, type = 'video') {
    const cache = await this._readCache();

    // Ensure the entry for this ID exists
    cache[id] = cache[id] || {};
    
    // Store download location with type
    cache[id].downloads = cache[id].downloads || {};
    cache[id].downloads[type] = {
      path: downloadPath,
      timestamp: Date.now()
    };

    // Write updated cache
    await this._writeCache(cache);
  }

  /**
   * Download video with caching and tracking download location
   * @param {string} id - Video ID
   * @param {Object} options - Options for downloading video
   * @returns {Promise<Object>} Download result with lastDownloadLocation
   */
  async downloadVideoWithCache(id, options) {
    const cache = await this._readCache();
    const type = 'video';

    // Check if there's a cached download location and the file exists
    if (cache[id] && cache[id].downloads && cache[id].downloads[type]) {
      const existingFilePath = cache[id].downloads[type].path;
      const fileStillExists = await fileExists(existingFilePath);
      
      if (fileStillExists) {
        return { 
          lastDownloadLocation: existingFilePath,
          fromCache: true
        };
      }
      
      // If file no longer exists, remove the cached location
      delete cache[id].downloads[type];
      await this._writeCache(cache);
    }

    // Perform the download
    const downloadResult = await this.downloadVideo(id, options);

    // If download was successful, cache the download location
    if (downloadResult && downloadResult.outputPath) {
      await this.setLastDownloadLocation(id, downloadResult.outputPath, type);
      downloadResult.lastDownloadLocation = downloadResult.outputPath;
    }

    return downloadResult;
  }

  /**
   * Download audio with caching and tracking download location
   * @param {string} id - Video ID
   * @param {Object} options - Options for downloading audio
   * @returns {Promise<Object>} Download result with lastDownloadLocation
   */
  async downloadMusicWithCache(id, options) {
    const cache = await this._readCache();
    const type = 'audio';

    // Check if there's a cached download location and the file exists
    if (cache[id] && cache[id].downloads && cache[id].downloads[type]) {
      console.log(`[downloadMusicWithCache] ${id} cached.`);
      const existingFilePath = cache[id].downloads[type].path;
      const fileStillExists = await fileExists(existingFilePath);
      
      if (fileStillExists) {
        return { 
          lastDownloadLocation: existingFilePath,
          fromCache: true
        };
      }
      
      // If file no longer exists, remove the cached location
      delete cache[id].downloads[type];
      await this._writeCache(cache);
    }
    console.log(`[downloadMusicWithCache] No cache for ${id}.`);

    // Perform the download
    const downloadResult = await this.downloadAudio(id, options);

    // If download was successful, cache the download location
    if (downloadResult && downloadResult.outputPath) {
      await this.setLastDownloadLocation(id, downloadResult.outputPath, type);
      downloadResult.lastDownloadLocation = downloadResult.outputPath;
    }

    return downloadResult;
  }
}

// const videoCacheManager = new VideoCacheManager();
// const videoInfo = await videoCacheManager.getVideoInfoWithCache(videoId, options);
// const videoDownload = await videoCacheManager.downloadVideoWithCache(videoId, options);
// const audioDownload = await videoCacheManager.downloadMusicWithCache(videoId, options);

module.exports = VideoCacheManager;