# StreamMonitor API Documentation

## Class Overview

```javascript
const StreamMonitor = require('./path/to/StreamMonitor');
```

The `StreamMonitor` class is an EventEmitter that monitors livestream platforms (Twitch, Kick, YouTube) for channel status changes and new content.

## Constructor

```javascript
// Initialize with no channels
const monitor = new StreamMonitor();

// Initialize with channels
const monitor = new StreamMonitor([
  { name: 'shroud', source: 'twitch' },
  { name: 'nickmercs', source: 'kick' },
  { name: 'mkbhd', source: 'youtube' }
]);
```

### Parameters:
- `channels` (optional): Array of objects with the structure:
  ```javascript
  {
    name: 'channelName',   // String: channel username
    source: 'platform'     // String: 'twitch', 'kick', or 'youtube'
  }
  ```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `channels` | Array | List of subscribed channels |
| `streamStatuses` | Object | Current status of all channels |
| `pollingInterval` | Number | Milliseconds between status checks (default: 60000) |
| `twitchToken` | String | Current Twitch API token |
| `twitchClientId` | String | Twitch API client ID from env |
| `twitchClientSecret` | String | Twitch API client secret from env |

## Methods

### `subscribe(channelName, source)`

Subscribe to a new channel for monitoring.

```javascript
// Subscribe to a Twitch channel
monitor.subscribe('pokimane', 'twitch');

// Subscribe to a Kick channel
monitor.subscribe('xqc', 'kick');

// Subscribe to a YouTube channel
monitor.subscribe('linus', 'youtube');
```

#### Parameters:
- `channelName` (String): The channel username to monitor
- `source` (String): Platform to monitor ('twitch', 'kick', or 'youtube')

#### Returns:
- `Boolean`: True if subscription was successful, false if already subscribed

### `unsubscribe(channelName, source)`

Unsubscribe from a channel.

```javascript
// Unsubscribe from a Twitch channel
monitor.unsubscribe('pokimane', 'twitch');
```

#### Parameters:
- `channelName` (String): The channel username to unsubscribe
- `source` (String): Platform ('twitch', 'kick', or 'youtube')

#### Returns:
- `Boolean`: True if unsubscribe was successful, false if not found

### `startMonitoring()`

Start polling all platforms for updates.

```javascript
// Begin status checks on all subscribed channels
monitor.startMonitoring();
```

### `stopMonitoring()`

Stop all polling timers.

```javascript
// Stop all status checks
monitor.stopMonitoring();
```

### `setPollingInterval(interval)`

Adjust how frequently channels are checked.

```javascript
// Check every 2 minutes
monitor.setPollingInterval(120000);

// Check every 30 seconds
monitor.setPollingInterval(30000);
```

#### Parameters:
- `interval` (Number): Milliseconds between checks

### `getStreamStatus()`

Get the current status of all monitored channels.

```javascript
// Get all statuses
const allStatuses = monitor.getStreamStatus();
console.log(allStatuses);

/* Example output:
{
  'twitch:xqc': {
    isLive: true,
    title: 'GAMING WARLORD',
    thumbnail: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_xqc-640x360.jpg',
    viewerCount: 45000,
    startedAt: '2023-10-15T18:30:00Z',
    lastChecked: '2023-10-15T20:45:12Z'
  },
  'youtube:mkbhd': {
    isLive: false,
    lastVideo: {
      id: 'AbCdEfGh123',
      title: 'iPhone 16 Pro Review!',
      url: 'https://www.youtube.com/watch?v=AbCdEfGh123',
      publishedAt: '2023-10-14T16:00:00Z',
      thumbnail: 'https://i.ytimg.com/vi/AbCdEfGh123/maxresdefault.jpg'
    },
    lastChecked: '2023-10-15T20:45:15Z'
  }
}
*/
```

#### Returns:
- `Object`: Status information for all channels

### `getChannelStatus(channelName, source)`

Get status for a specific channel.

```javascript
// Get Twitch channel status
const twitchStatus = monitor.getChannelStatus('ninja', 'twitch');

// Get YouTube channel status
const youtubeStatus = monitor.getChannelStatus('pewdiepie', 'youtube');
```

#### Parameters:
- `channelName` (String): Channel name to check
- `source` (String): Platform ('twitch', 'kick', or 'youtube')

#### Returns:
- `Object`: Status information or null if not found

### `getSubscribedChannels()`

Get a list of all channels being monitored.

```javascript
const channels = monitor.getSubscribedChannels();
console.log(channels);

/* Example output:
[
  { name: 'shroud', source: 'twitch', subscribedAt: '2023-10-15T12:30:45Z' },
  { name: 'xqc', source: 'kick', subscribedAt: '2023-10-15T12:31:20Z' },
  { name: 'mkbhd', source: 'youtube', subscribedAt: '2023-10-15T12:32:10Z' }
]
*/
```

#### Returns:
- `Array`: All subscribed channels

## Events

### `streamOnline`

Emitted when a channel goes live.

```javascript
monitor.on('streamOnline', (data) => {
  console.log(`${data.channelName} is now live on ${data.platform}!`);
  console.log(`Title: ${data.title}`);
  console.log(`Thumbnail: ${data.thumbnail}`);
  // For Twitch and Kick: viewerCount, startedAt are also available
  // For YouTube: videoId, url are also available
});
```

#### Event Data Properties:
- `platform` (String): 'twitch', 'kick', or 'youtube'
- `channelName` (String): Channel name
- `title` (String): Stream/video title
- `thumbnail` (String): URL to thumbnail image
- `viewerCount` (Number): Current viewers (Twitch & Kick only)
- `startedAt` (String): ISO timestamp of when stream started
- `videoId` (String): YouTube video ID (YouTube only)
- `url` (String): Full URL to stream (YouTube only)

### `streamOffline`

Emitted when a channel stops streaming.

```javascript
monitor.on('streamOffline', (data) => {
  console.log(`${data.channelName} ended their ${data.platform} stream`);
});
```

#### Event Data Properties:
- `platform` (String): 'twitch', 'kick', or 'youtube'
- `channelName` (String): Channel name

### `newVideo`

Emitted when a YouTube channel uploads a new video (non-livestream).

```javascript
monitor.on('newVideo', (data) => {
  console.log(`${data.channelName} uploaded a new video: ${data.title}`);
  console.log(`Thumbnail: ${data.thumbnail}`);
  console.log(`Watch at: ${data.url}`);
});
```

#### Event Data Properties:
- `platform` (String): Always 'youtube'
- `channelName` (String): Channel name
- `title` (String): Video title
- `thumbnail` (String): URL to thumbnail image
- `url` (String): Full URL to video
- `videoId` (String): YouTube video ID
- `publishedAt` (String): ISO timestamp of publication

## Integration Example

```javascript
const StreamMonitor = require('./path/to/StreamMonitor');

// Create monitor instance
const streamMonitor = new StreamMonitor();

// Setup event handlers
streamMonitor.on('streamOnline', (data) => {
  // Handle new stream
  sendNotification(`${data.channelName} is now live on ${data.platform}!`, {
    title: data.title,
    image: data.thumbnail
  });
});

streamMonitor.on('streamOffline', (data) => {
  // Handle stream ending
  updateStatus(`${data.channelName} is no longer live`);
});

streamMonitor.on('newVideo', (data) => {
  // Handle new YouTube video
  sendNotification(`New video from ${data.channelName}`, {
    title: data.title,
    image: data.thumbnail,
    url: data.url
  });
});

// Subscribe to channels
streamMonitor.subscribe('shroud', 'twitch');
streamMonitor.subscribe('mixer', 'kick');
streamMonitor.subscribe('mkbhd', 'youtube');

// Set polling interval (optional)
streamMonitor.setPollingInterval(30000); // Check every 30 seconds

// Start monitoring
streamMonitor.startMonitoring();

// Later, to check status programmatically
function checkIfChannelIsLive(channelName, platform) {
  const status = streamMonitor.getChannelStatus(channelName, platform);
  return status?.isLive || false;
}

// Graceful shutdown
process.on('SIGINT', () => {
  streamMonitor.stopMonitoring();
  process.exit(0);
});
```