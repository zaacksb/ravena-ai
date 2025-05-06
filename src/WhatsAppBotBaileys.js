// Import required libraries
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeInMemoryStore } = require('@whiskeysockets/baileys');
const { MessageMedia } = require('whatsapp-web.js'); // Reusing MessageMedia class
const Database = require('./utils/Database');
const Logger = require('./utils/Logger');
const path = require('path');
const fs = require('fs').promises;
const LoadReport = require('./LoadReport');
const ReactionsHandler = require('./ReactionsHandler');
const MentionHandler = require('./MentionHandler');
const InviteSystem = require('./InviteSystem');
const StreamSystem = require('./StreamSystem');
const LLMService = require('./services/LLMService');
const AdminUtils = require('./utils/AdminUtils');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class WhatsAppBotBaileys {
  /**
   * Creates a new instance of the WhatsApp bot using Baileys
   * @param {Object} options - Configuration options
   * @param {string} options.id - Unique identifier for this bot instance
   * @param {string} options.phoneNumber - Phone number for pairing code request
   * @param {Object} options.eventHandler - Event handler instance
   * @param {string} options.prefix - Command prefix (default: '!')
   * @param {Object} options.baileyOptions - Baileys options
   * @param {Array} options.otherBots - Other bot instances to be ignored
   */
  constructor(options) {
    this.id = options.id;
    this.phoneNumber = options.phoneNumber;
    this.eventHandler = options.eventHandler;
    this.prefix = options.prefix || process.env.DEFAULT_PREFIX || '!';
    this.logger = new Logger(`bot-${this.id}`);
    this.client = null;
    this.database = Database.getInstance(); // Shared database instance
    this.isConnected = false;
    this.safeMode = options.safeMode !== undefined ? options.safeMode : (process.env.SAFE_MODE === 'true');
    this.baileyOptions = options.baileyOptions || {};
    this.otherBots = options.otherBots || [];
    
    // Community group notification properties
    this.grupoLogs = options.grupoLogs || process.env.GRUPO_LOGS;
    this.grupoInvites = options.grupoInvites || process.env.GRUPO_INVITES;
    this.grupoAvisos = options.grupoAvisos || process.env.GRUPO_AVISOS;
    this.grupoInteracao = options.grupoInteracao || process.env.GRUPO_INTERACAO;
    this.linkGrupao = options.linkGrupao || process.env.LINK_GRUPO_INTERACAO;
    this.linkAvisos = options.linkAvisos || process.env.LINK_GRUPO_AVISOS;

    this.lastMessageReceived = Date.now();
    this.lastRestartForDelay = 0;

    // Property to control messages after initialization
    this.startupTime = Date.now();
    
    // Initialize load report tracker
    this.loadReport = new LoadReport(this);
    
    // Initialize invite system
    this.inviteSystem = new InviteSystem(this);
    
    // Initialize mention handler
    this.mentionHandler = new MentionHandler();

    // Initialize reactions handler
    this.reactionHandler = new ReactionsHandler();

    // Initialize StreamSystem (will be defined in initialize())
    this.streamSystem = null;
    this.streamMonitor = null;
    
    this.llmService = new LLMService({});
    this.adminUtils = AdminUtils.getInstance();

    this.sessionDir = path.join(__dirname, '..', '.baileys_auth_info', this.id);
    
    // Baileys-specific properties
    this.store = makeInMemoryStore({});
    this.blockedContacts = [];
    this.socketEvents = {};
    this.clientInfo = {
      wid: { _serialized: '' }
    };
  }

  /**
   * Initializes the WhatsApp client
   */
  async initialize() {
    this.logger.info(`Initializing bot instance ${this.id}`);

    // Update initialization time
    this.startupTime = Date.now();

    try {
      // Ensure auth directory exists
      await fs.mkdir(this.sessionDir, { recursive: true });
      
      // Get authentication state
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
      
      // Create the socket
      this.client = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        useBaileysLegacyMode: true,
        // browser: ['RavenaBot', 'Chrome', '10.0'],
        connectTimeoutMs: 60000, 
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        emitOwnEvents: false,
        syncFullHistory: false,
        ...this.baileyOptions
      });
      
      // Store handler for saving credentials
      this.saveCreds = saveCreds;
      
      // Set up store for message/chat caching
      this.store.bind(this.client.ev);
      
      // Register event handlers
      this.registerEventHandlers();
      
      this.logger.info(`Bot ${this.id} initialized`);
      
      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 60000); // 60 seconds timeout
        
        this.socketEvents.connection = (update) => {
          if (update.connection === 'open') {
            clearTimeout(timeout);
            
            // Set the client info once connected
            this.clientInfo.wid = { 
              _serialized: this.client.user.id 
            };
            
            this.isConnected = true;
            resolve();
          }
        };
        
        // Add connection listener
        this.client.ev.on('connection.update', this.socketEvents.connection);
      });
      
      // Try to get blocked contacts
      try {
        // In Baileys, we'll use an empty array since the feature works differently
        this.blockedContacts = [];
        this.logger.info(`Loaded ${this.blockedContacts.length} blocked contacts`);
        
        if (this.isConnected && this.otherBots.length > 0) {
          this.prepareOtherBotsBlockList();
        }
      } catch (error) {
        this.logger.error('Error loading blocked contacts:', error);
        this.blockedContacts = [];
      }

      // Send initialization notification to logs group
      if (this.grupoLogs && this.isConnected) {
        await sleep(10000);
        try {
          const startMessage = `🤖 Bot ${this.id} successfully initialized at ${new Date().toLocaleString("pt-BR")}`;
          await this.sendMessage(this.grupoLogs, startMessage);
        } catch (error) {
          this.logger.error('Error sending initialization notification:', error);
        }
      }

      if (this.grupoAvisos && this.isConnected) {
        try {
          const startMessage = `🟢 [${this.phoneNumber.slice(2,4)}] *${this.id}* is _on_! (${new Date().toLocaleString("pt-BR")})`;
          this.logger.debug(`Sending startMessage to grupoAvisos: `, startMessage, this.grupoAvisos);
          await this.sendMessage(this.grupoAvisos, startMessage);
        } catch (error) {
          this.logger.error('Error sending initialization notification:', error);
        }
      }

      // Setup shutdown handlers
      process.on('SIGINT', async () => {
        this.logger.info(`[SIGINT] Shutting down...`);
      });
      process.on('SIGTERM', async () => {
        this.logger.info(`[SIGTERM] Shutting down...`);
      });
      
      return this;
    } catch (error) {
      this.logger.error(`Error initializing bot ${this.id}:`, error);
      throw error;
    }
  }

  /**
   * Prepares other bots ID list to be ignored
   */
  prepareOtherBotsBlockList() {
    if (!this.otherBots || !this.otherBots.length) return;
    
    // Ensure blockedContacts is an array
    if (!this.blockedContacts || !Array.isArray(this.blockedContacts)) {
      this.blockedContacts = [];
    }

    // Add other bot IDs to the blocked list
    for (const bot of this.otherBots) {
      const botId = bot.endsWith("@c.us") ? bot : `${bot}@c.us`;
      this.blockedContacts.push({
        id: {
          _serialized: botId
        },
        name: `Bot: ${bot.id || 'unknown'}`
      });
      
      this.logger.info(`Added bot '${bot.id}' (${botId}) to ignore list`);
    }
    
    this.logger.info(`Updated ignore list: ${this.blockedContacts.length} contacts/bots`);
  }

  /**
   * Checks if a message should be discarded during initial startup period
   * @returns {boolean} - True if message should be discarded
   */
  shouldDiscardMessage() {
    const timeSinceStartup = Date.now() - this.startupTime;
    return timeSinceStartup < 5000; // 5 seconds
  }

  /**
   * Registers event handlers for the WhatsApp client
   */
  registerEventHandlers() {
    // Connection update handler (already set in initialize())
    
    // Message handler
    this.socketEvents.messages = async (messages) => {
      if (!Array.isArray(messages.messages)) return;
      
      for (const baileysMessage of messages.messages) {
        // Skip if there's no message content
        if (!baileysMessage.message) continue;
        
        // Skip messages during initial startup period
        if (this.shouldDiscardMessage()) {
          this.logger.debug(`Discarding message received during initial period for ${this.id}`);
          continue;
        }

        this.lastMessageReceived = Date.now();

        // Calculate response time
        const currentTimestamp = this.getCurrentTimestamp();
        const messageTimestamp = Math.floor(baileysMessage.messageTimestamp);
        const responseTime = Math.max(0, currentTimestamp - messageTimestamp);
        
        // Check if response time is very high and we need to restart the bot
        if (responseTime > 60) {
          // Check if the bot wasn't recently restarted for the same reason
          const currentTime = Math.floor(Date.now() / 1000);
          const timeSinceLastRestart = currentTime - this.lastRestartForDelay;
          
          if (timeSinceLastRestart > 1800) { // 30 minutes
            this.lastRestartForDelay = currentTime;
            this.logger.warn(`High response delay (${responseTime}s), initiating automatic restart`);
            
            // Start restart in background
            setTimeout(() => {
              this.restartBot(`The delay is high (${responseTime}s), so the bot will be restarted.`)
                .catch(err => this.logger.error('Error restarting bot due to high delay:', err));
            }, 100);
            
            return; // Don't process this message
          } else {
            this.logger.warn(`High response delay (${responseTime}s), but bot was recently restarted. Waiting.`);
          }
        }

        try {
          // Skip if it's a message from logs/invites group
          const chatId = this.getChatId(baileysMessage);
          if (chatId === this.grupoLogs || chatId === this.grupoInvites) {
            this.logger.debug(`Ignoring message from logs/invites group: ${chatId}`);
            continue;
          }

          // Check if author is blocked
          if (this.blockedContacts && Array.isArray(this.blockedContacts)) {
            const authorId = this.getMessageAuthor(baileysMessage);
            const isBlocked = this.blockedContacts.some(contact => 
              contact.id._serialized === authorId
            );
            
            if (isBlocked) {
              this.logger.debug(`Ignoring message from blocked contact: ${authorId}`);
              continue;
            }
          }

          // Format message for event handler
          const formattedMessage = await this.formatMessage(baileysMessage, responseTime);
          this.eventHandler.onMessage(this, formattedMessage);
        } catch (error) {
          this.logger.error('Error processing message:', error);
        }
      }
    };
    
    // Add the messages handler
    this.client.ev.on('messages.upsert', this.socketEvents.messages);
    
    // Handle group participant events (join/leave)
    this.socketEvents.groupParticipants = async (update) => {
      const { id, participants, action } = update;
      
      if (action === 'add') {
        // Group join event
        for (const participant of participants) {
          try {
            // Get group info
            const group = await this.getGroupInfo(id);
            
            // Get user info
            const user = await this.getUserInfo(participant);
            
            // Get who added the user (not directly available in Baileys)
            const responsavel = { id: 'unknown@c.us', name: 'Unknown' };
            
            this.eventHandler.onGroupJoin(this, {
              group: {
                id: id,
                name: group.name || 'Unknown Group'
              },
              user: {
                id: participant,
                name: user.name || 'Unknown User'
              },
              responsavel: responsavel,
              origin: update
            });
          } catch (error) {
            this.logger.error(`Error processing group join for ${participant}:`, error);
          }
        }
      } else if (action === 'remove') {
        // Group leave event
        for (const participant of participants) {
          try {
            // Get group info
            const group = await this.getGroupInfo(id);
            
            // Get user info
            const user = await this.getUserInfo(participant);
            
            // Get who removed the user (not directly available in Baileys)
            const responsavel = { id: 'unknown@c.us', name: 'Unknown' };
            
            this.eventHandler.onGroupLeave(this, {
              group: {
                id: id,
                name: group.name || 'Unknown Group'
              },
              user: {
                id: participant,
                name: user.name || 'Unknown User'
              },
              responsavel: responsavel,
              origin: update
            });
          } catch (error) {
            this.logger.error(`Error processing group leave for ${participant}:`, error);
          }
        }
      }
    };
    
    // Add group participants handler
    this.client.ev.on('group-participants.update', this.socketEvents.groupParticipants);
    
    // Handle credentials updates
    this.socketEvents.creds = (auth) => {
      this.saveCreds();
    };
    
    // Add creds handler
    this.client.ev.on('creds.update', this.socketEvents.creds);
    
    // Handle incoming calls
    this.socketEvents.call = async (call) => {
      this.logger.info(`[Call] Rejecting call: ${JSON.stringify(call)}`);
      // In Baileys, reject calls differently
      for (const callData of call) {
        if (callData.status === 'offer') {
          try {
            await this.client.rejectCall(callData.id, callData.from);
          } catch (error) {
            this.logger.error('Error rejecting call:', error);
          }
        }
      }
    };
    
    // Add call handler
    this.client.ev.on('call', this.socketEvents.call);
    
    // Handle message reactions
    this.socketEvents.reactions = async (reactions) => {
      try {
        for (const reaction of reactions) {
          // Process reaction in a format compatible with the original code
          const formattedReaction = {
            msgId: { 
              _serialized: reaction.key.id
            },
            reaction: reaction.text || '',
            senderId: reaction.key.participant || reaction.key.remoteJid
          };
          
          // Only process reactions from others, not from the bot itself
          if (formattedReaction.senderId !== this.clientInfo.wid._serialized) {
            await this.reactionHandler.processReaction(this, formattedReaction);
          }
        }
      } catch (error) {
        this.logger.error('Error processing message reaction:', error);
      }
    };
    
    // Add reactions handler
    this.client.ev.on('messages.reaction', this.socketEvents.reactions);
  }

  /**
   * Gets information about a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - User information
   */
  async getUserInfo(userId) {
    try {
      // For Baileys we need to implement this differently
      const onWhatsAppResult = await this.client.onWhatsApp(userId);
      if (onWhatsAppResult && onWhatsAppResult.length > 0 && onWhatsAppResult[0].exists) {
        try {
          // Try to get user profile
          const contact = await this.client.getContactById(userId);
          return {
            id: userId,
            name: contact?.name || contact?.pushname || 'Unknown',
            exists: true
          };
        } catch (error) {
          // Fallback to basic info
          return {
            id: userId,
            name: onWhatsAppResult[0].pushname || 'Unknown',
            exists: true
          };
        }
      }
      return { id: userId, name: 'Unknown', exists: false };
    } catch (error) {
      this.logger.error(`Error getting user info for ${userId}:`, error);
      return { id: userId, name: 'Unknown', exists: false };
    }
  }

  /**
   * Gets information about a group
   * @param {string} groupId - Group ID
   * @returns {Promise<Object>} - Group information
   */
  async getGroupInfo(groupId) {
    try {
      // In Baileys, get group metadata
      const groupInfo = await this.client.groupMetadata(groupId);
      return {
        id: groupId,
        name: groupInfo.subject || 'Unknown Group',
        participants: groupInfo.participants || []
      };
    } catch (error) {
      this.logger.error(`Error getting group info for ${groupId}:`, error);
      return { id: groupId, name: 'Unknown Group', participants: [] };
    }
  }

  /**
   * Gets the chat ID from a Baileys message
   * @param {Object} baileysMessage - Baileys message object
   * @returns {string} - Chat ID
   */
  getChatId(baileysMessage) {
    return baileysMessage.key.remoteJid;
  }

  /**
   * Gets the message author from a Baileys message
   * @param {Object} baileysMessage - Baileys message object
   * @returns {string} - Author ID
   */
  getMessageAuthor(baileysMessage) {
    return baileysMessage.key.participant || baileysMessage.key.remoteJid;
  }

  /**
   * Formats a Baileys message to our standard format
   * @param {Object} baileysMessage - The raw Baileys message
   * @param {number} responseTime - Response time in seconds
   * @returns {Promise<Object>} - Formatted message object
   */
  async formatMessage(baileysMessage, responseTime) {
    try {
      const chatId = this.getChatId(baileysMessage);
      const isGroup = chatId.endsWith('@g.us');
      const authorId = this.getMessageAuthor(baileysMessage);
      
      // Track received message with response time
      this.loadReport.trackReceivedMessage(isGroup, responseTime);
      
      // Get the message content based on type
      let type = 'text';
      let content = '';
      let caption = null;
      
      const msgContent = baileysMessage.message;
      
      if (msgContent.conversation) {
        // Plain text message
        type = 'text';
        content = msgContent.conversation;
      } else if (msgContent.extendedTextMessage) {
        // Extended text message
        type = 'text';
        content = msgContent.extendedTextMessage.text;
      } else if (msgContent.imageMessage) {
        // Image message
        type = 'image';
        content = await this.downloadMedia(baileysMessage);
        caption = msgContent.imageMessage.caption;
      } else if (msgContent.videoMessage) {
        // Video message
        type = 'video';
        content = await this.downloadMedia(baileysMessage);
        caption = msgContent.videoMessage.caption;
      } else if (msgContent.audioMessage) {
        // Audio message
        type = msgContent.audioMessage.ptt ? 'voice' : 'audio';
        content = await this.downloadMedia(baileysMessage);
      } else if (msgContent.stickerMessage) {
        // Sticker message
        type = 'sticker';
        content = await this.downloadMedia(baileysMessage);
      } else if (msgContent.documentMessage) {
        // Document message
        type = 'document';
        content = await this.downloadMedia(baileysMessage);
        caption = msgContent.documentMessage.caption;
      }
      
      // Get author name
      let authorName = 'Unknown';
      try {
        const contact = await this.getContactById(authorId);
        authorName = contact.name || contact.pushname || 'Unknown';
      } catch (error) {
        this.logger.error(`Error getting contact info for ${authorId}:`, error);
      }
      
      // Create origin property to match whatsapp-web.js Message
      const origin = this.createMessageCompatibilityLayer(baileysMessage);
      
      return {
        group: isGroup ? chatId : null,
        author: authorId,
        authorName: authorName,
        type,
        content,
        caption,
        origin,
        responseTime
      };
    } catch (error) {
      this.logger.error('Error formatting message:', error);
      throw error;
    }
  }

  /**
   * Creates a compatibility layer for a Baileys message to mimic whatsapp-web.js Message
   * @param {Object} baileysMessage - The Baileys message
   * @returns {Object} - Compatibility layer object
   */
  createMessageCompatibilityLayer(baileysMessage) {
    return {
      id: {
        _serialized: `${baileysMessage.key.id}`
      },
      from: baileysMessage.key.remoteJid,
      to: this.client.user?.id || '',
      author: baileysMessage.key.participant || baileysMessage.key.remoteJid,
      fromMe: baileysMessage.key.fromMe,
      timestamp: baileysMessage.messageTimestamp,
      hasMedia: this.messageHasMedia(baileysMessage),
      body: this.getMessageBody(baileysMessage),
      type: this.getMessageType(baileysMessage),
      
      // Methods
      getChat: async () => {
        return await this.getChatById(baileysMessage.key.remoteJid);
      },
      getContact: async () => {
        const authorId = baileysMessage.key.participant || baileysMessage.key.remoteJid;
        return await this.getContactById(authorId);
      },
      getQuotedMessage: async () => {
        return await this.getQuotedMessage(baileysMessage);
      },
      downloadMedia: async () => {
        return await this.downloadMedia(baileysMessage);
      },
      delete: async (everyone = false) => {
        return await this.deleteMessage(baileysMessage, everyone);
      },
      react: async (emoji) => {
        return await this.reactToMessage(baileysMessage, emoji);
      }
    };
  }

  /**
   * Gets message type from a Baileys message
   * @param {Object} baileysMessage - The Baileys message
   * @returns {string} - Message type
   */
  getMessageType(baileysMessage) {
    const msgContent = baileysMessage.message;
    if (!msgContent) return 'unknown';
    
    if (msgContent.conversation || msgContent.extendedTextMessage) {
      return 'text';
    } else if (msgContent.imageMessage) {
      return 'image';
    } else if (msgContent.videoMessage) {
      return 'video';
    } else if (msgContent.audioMessage) {
      return msgContent.audioMessage.ptt ? 'voice' : 'audio';
    } else if (msgContent.stickerMessage) {
      return 'sticker';
    } else if (msgContent.documentMessage) {
      return 'document';
    }
    
    return 'unknown';
  }

  /**
   * Checks if a Baileys message has media
   * @param {Object} baileysMessage - The Baileys message
   * @returns {boolean} - True if message has media
   */
  messageHasMedia(baileysMessage) {
    const msgContent = baileysMessage.message;
    if (!msgContent) return false;
    
    return !!(msgContent.imageMessage || 
              msgContent.videoMessage || 
              msgContent.audioMessage || 
              msgContent.stickerMessage || 
              msgContent.documentMessage);
  }

  /**
   * Gets the message body from a Baileys message
   * @param {Object} baileysMessage - The Baileys message
   * @returns {string} - Message body text
   */
  getMessageBody(baileysMessage) {
    const msgContent = baileysMessage.message;
    if (!msgContent) return '';
    
    if (msgContent.conversation) {
      return msgContent.conversation;
    } else if (msgContent.extendedTextMessage?.text) {
      return msgContent.extendedTextMessage.text;
    } else if (msgContent.imageMessage?.caption) {
      return msgContent.imageMessage.caption;
    } else if (msgContent.videoMessage?.caption) {
      return msgContent.videoMessage.caption;
    } else if (msgContent.documentMessage?.caption) {
      return msgContent.documentMessage.caption;
    }
    
    return '';
  }

  /**
   * Gets a quoted message from a Baileys message
   * @param {Object} baileysMessage - The Baileys message
   * @returns {Promise<Object|null>} - Quoted message or null
   */
  async getQuotedMessage(baileysMessage) {
    try {
      // Get quoted message context info
      let contextInfo;
      
      const msgContent = baileysMessage.message;
      if (!msgContent) return null;
      
      // Extract context info based on message type
      if (msgContent.extendedTextMessage?.contextInfo) {
        contextInfo = msgContent.extendedTextMessage.contextInfo;
      } else if (msgContent.imageMessage?.contextInfo) {
        contextInfo = msgContent.imageMessage.contextInfo;
      } else if (msgContent.videoMessage?.contextInfo) {
        contextInfo = msgContent.videoMessage.contextInfo;
      } else if (msgContent.audioMessage?.contextInfo) {
        contextInfo = msgContent.audioMessage.contextInfo;
      } else if (msgContent.stickerMessage?.contextInfo) {
        contextInfo = msgContent.stickerMessage.contextInfo;
      } else if (msgContent.documentMessage?.contextInfo) {
        contextInfo = msgContent.documentMessage.contextInfo;
      } else {
        return null;
      }
      
      // Check if there's a quoted message
      if (!contextInfo || !contextInfo.quotedMessage) {
        return null;
      }
      
      // Construct a quoted message object
      const quotedMsg = {
        key: {
          remoteJid: baileysMessage.key.remoteJid,
          id: contextInfo.stanzaId,
          participant: contextInfo.participant
        },
        message: contextInfo.quotedMessage,
        messageTimestamp: contextInfo.quotedMessageTimestamp || baileysMessage.messageTimestamp
      };
      
      // Create compatibility layer
      return this.createMessageCompatibilityLayer(quotedMsg);
    } catch (error) {
      this.logger.error('Error getting quoted message:', error);
      return null;
    }
  }

  /**
   * Downloads media from a Baileys message
   * @param {Object} baileysMessage - The Baileys message
   * @returns {Promise<MessageMedia|null>} - Downloaded media or null
   */
  async downloadMedia(baileysMessage) {
    try {
      const msgContent = baileysMessage.message;
      if (!msgContent) return null;
      
      let mediaType, mediaContent;
      
      if (msgContent.imageMessage) {
        mediaType = 'image';
        mediaContent = msgContent.imageMessage;
      } else if (msgContent.videoMessage) {
        mediaType = 'video';
        mediaContent = msgContent.videoMessage;
      } else if (msgContent.audioMessage) {
        mediaType = msgContent.audioMessage.ptt ? 'voice' : 'audio';
        mediaContent = msgContent.audioMessage;
      } else if (msgContent.stickerMessage) {
        mediaType = 'sticker';
        mediaContent = msgContent.stickerMessage;
      } else if (msgContent.documentMessage) {
        mediaType = 'document';
        mediaContent = msgContent.documentMessage;
      } else {
        return null;
      }
      
      // Download the media using Baileys
      const buffer = await this.client.downloadMediaMessage(
        baileysMessage,
        'buffer',
        {}
      );
      
      // Convert to base64
      const base64Data = buffer.toString('base64');
      
      // Get mimetype
      let mimetype = '';
      if (mediaContent.mimetype) {
        mimetype = mediaContent.mimetype;
      } else {
        // Fallback mimetypes based on media type
        const mimetypes = {
          image: 'image/jpeg',
          video: 'video/mp4',
          audio: 'audio/mp4',
          voice: 'audio/ogg; codecs=opus',
          sticker: 'image/webp',
          document: 'application/octet-stream'
        };
        mimetype = mimetypes[mediaType] || 'application/octet-stream';
      }
      
      // Get filename
      let filename = '';
      if (mediaContent.fileName) {
        filename = mediaContent.fileName;
      } else {
        // Generate filename
        const ext = mimetype.split('/')[1].split(';')[0];
        filename = `${mediaType}-${Date.now()}.${ext}`;
      }
      
      // Create MessageMedia object
      return new MessageMedia(mimetype, base64Data, filename);
    } catch (error) {
      this.logger.error('Error downloading media:', error);
      return null;
    }
  }

  /**
   * Deletes a message
   * @param {Object} baileysMessage - The Baileys message
   * @param {boolean} everyone - Whether to delete for everyone
   * @returns {Promise<boolean>} - Success status
   */
  async deleteMessage(baileysMessage, everyone = false) {
    try {
      // In Baileys, delete message
      await this.client.sendMessage(baileysMessage.key.remoteJid, {
        delete: baileysMessage.key
      });
      
      return true;
    } catch (error) {
      this.logger.error('Error deleting message:', error);
      return false;
    }
  }

  /**
   * Reacts to a message with an emoji
   * @param {Object} baileysMessage - The Baileys message
   * @param {string} emoji - Emoji to react with
   * @returns {Promise<boolean>} - Success status
   */
  async reactToMessage(baileysMessage, emoji) {
    try {
      // In Baileys, send reaction
      await this.client.sendMessage(baileysMessage.key.remoteJid, {
        react: {
          text: emoji,
          key: baileysMessage.key
        }
      });
      
      return true;
    } catch (error) {
      this.logger.error('Error reacting to message:', error);
      return false;
    }
  }

  /**
   * Sends a message to a chat
   * @param {string} chatId - The chat ID
   * @param {string|Object} content - Content to send (text or media)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - The sent message
   */
  async sendMessage(chatId, content, options = {}) {
    try {
      // Track sent message
      const isGroup = chatId.endsWith('@g.us');
      this.loadReport.trackSentMessage(isGroup);

      // Default options
      if (options.linkPreview === undefined) {
        options.linkPreview = false;
      }
      
      // Check if in safe mode
      if (this.safeMode) {
        this.logger.info(`[SAFE MODE] Would send to ${chatId}: ${typeof content === 'string' ? content : '[Media]'}`);
        return { key: { id: 'safe-mode-msg-id' } };
      }

      let baileysMessage;
      
      // Handle quoted message ID if provided
      let quoted = undefined;
      if (options.quotedMessageId) {
        const parts = options.quotedMessageId.split('_');
        quoted = {
          key: {
            remoteJid: chatId,
            id: parts[parts.length - 1], // Extract ID part
            fromMe: options.quotedMessageId.includes('true_')
          }
        };
      }
      
      if (typeof content === 'string') {
        // Text message
        baileysMessage = await this.client.sendMessage(chatId, {
          text: content
        }, { quoted });
      } else if (content instanceof MessageMedia) {
        // Media message
        const mediaOptions = {
          caption: options.caption,
          mimetype: content.mimetype,
          quoted
        };
        
        const mediaData = Buffer.from(content.data, 'base64');
        
        if (options.sendMediaAsSticker) {
          // Send as sticker
          baileysMessage = await this.client.sendMessage(chatId, {
            sticker: mediaData,
            mimetype: 'image/webp',
            ...mediaOptions
          });
        } else if (content.mimetype.startsWith('image/')) {
          // Image
          baileysMessage = await this.client.sendMessage(chatId, {
            image: mediaData,
            ...mediaOptions
          });
        } else if (content.mimetype.startsWith('video/')) {
          // Video
          baileysMessage = await this.client.sendMessage(chatId, {
            video: mediaData,
            ...mediaOptions
          });
        } else if (content.mimetype.startsWith('audio/')) {
          // Audio
          const isPtt = content.mimetype.includes('ogg') || options.sendAudioAsPtt;
          baileysMessage = await this.client.sendMessage(chatId, {
            audio: mediaData,
            mimetype: content.mimetype,
            ptt: isPtt,
            ...mediaOptions
          });
        } else {
          // Document
          baileysMessage = await this.client.sendMessage(chatId, {
            document: mediaData,
            mimetype: content.mimetype,
            fileName: content.filename || 'file',
            ...mediaOptions
          });
        }
      }
      
      // Convert Baileys message to compatibility format if available
      if (baileysMessage) {
        return this.createMessageCompatibilityLayer(baileysMessage);
      } else {
        // Return minimal compatible object if message sending failed
        return { 
          id: { _serialized: `error_${Date.now()}` },
          from: chatId,
          to: this.client.user?.id || '',
          timestamp: Math.floor(Date.now() / 1000)
        };
      }
    } catch (error) {
      this.logger.error(`Error sending message to ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Sends one or more ReturnMessage objects
   * @param {ReturnMessage|Array<ReturnMessage>} returnMessages - ReturnMessage or array of ReturnMessages to send
   * @returns {Promise<Array>} - Array of results from sending each message
   */
  async sendReturnMessages(returnMessages) {
    try {
      // Ensure returnMessages is an array
      if (!Array.isArray(returnMessages)) {
        returnMessages = [returnMessages];
      }

      // Filter out invalid messages
      const validMessages = returnMessages.filter(msg => 
        msg && msg.isValid && msg.isValid()
      );

      if (validMessages.length === 0) {
        this.logger.warn('No valid ReturnMessages to send');
        return [];
      }

      const results = [];
      
      // Process each message
      for (const message of validMessages) {
        // Apply any delay if specified
        if (message.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, message.delay));
        }

        // Send the message
        const result = await this.sendMessage(
          message.chatId, 
          message.content, 
          message.options
        );

        // Store message ID for potential future reactions
        if (message.metadata) {
          message.metadata.messageId = result.id._serialized;
        }

        results.push(result);
      }

      return results;
    } catch (error) {
      this.logger.error('Error sending ReturnMessages:', error);
      throw error;
    }
  }

  /**
   * Creates a media object from a file path
   * @param {string} filePath - Path to the media file
   * @returns {Promise<MessageMedia>} - The media object
   */
  async createMedia(filePath) {
    try {
      return MessageMedia.fromFilePath(filePath);
    } catch (error) {
      this.logger.error(`Error creating media from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Creates a media object from a URL
   * @param {string} url - URL to the media
   * @returns {Promise<MessageMedia>} - The media object
   */
  async createMediaFromURL(url) {
    try {
      return await MessageMedia.fromUrl(url, { unsafeMime: true });
    } catch (error) {
      this.logger.error(`Error creating media from URL ${url}:`, error);
      throw error;
    }
  }

  /**
   * Gets a chat by ID
   * @param {string} chatId - Chat ID
   * @returns {Promise<Object>} - Chat object
   */
  async getChatById(chatId) {
    try {
      // Check if it's a group
      const isGroup = chatId.endsWith('@g.us');
      
      if (isGroup) {
        // Get group metadata
        const metadata = await this.client.groupMetadata(chatId);
        
        // Create chat object similar to whatsapp-web.js Chat
        return {
          id: {
            _serialized: chatId
          },
          name: metadata.subject,
          isGroup: true,
          groupMetadata: metadata,
          participants: metadata.participants.map(p => ({
            id: {
              _serialized: p.id
            },
            isAdmin: p.admin === 'admin' || p.admin === 'superadmin'
          }))
        };
      } else {
        // Create chat object for private chat
        return {
          id: {
            _serialized: chatId
          },
          name: 'Private Chat',
          isGroup: false
        };
      }
    } catch (error) {
      this.logger.error(`Error getting chat by ID ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Gets a contact by ID
   * @param {string} contactId - Contact ID
   * @returns {Promise<Object>} - Contact object
   */
  async getContactById(contactId) {
    try {
      // In Baileys, getting contact info works differently
      const onWhatsAppResult = await this.client.onWhatsApp(contactId);
      
      if (onWhatsAppResult && onWhatsAppResult.length > 0 && onWhatsAppResult[0].exists) {
        // Create contact object similar to whatsapp-web.js Contact
        return {
          id: {
            _serialized: contactId
          },
          pushname: onWhatsAppResult[0].pushname || 'Unknown',
          name: onWhatsAppResult[0].pushname || 'Unknown'
        };
      }
      
      // Return a default contact object if not found
      return {
        id: {
          _serialized: contactId
        },
        pushname: 'Unknown',
        name: 'Unknown'
      };
    } catch (error) {
      this.logger.error(`Error getting contact by ID ${contactId}:`, error);
      
      // Return a default contact object on error
      return {
        id: {
          _serialized: contactId
        },
        pushname: 'Unknown',
        name: 'Unknown'
      };
    }
  }

  /**
   * Gets message by ID
   * @param {string} messageId - Message ID
   * @returns {Promise<Object|null>} - Message object or null
   */
  async getMessageById(messageId) {
    try {
      // In Baileys, getting message by ID is more complex
      // This is a simplified implementation
      this.logger.warn('getMessageById has limited functionality in Baileys');
      
      // Try to find message in store
      if (this.store) {
        for (const [jid, chat] of Object.entries(this.store.messages)) {
          for (const msg of chat) {
            if (msg.key && msg.key.id === messageId) {
              return this.createMessageCompatibilityLayer(msg);
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Error getting message by ID ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Checks if a user is admin in a group
   * @param {string} userId - User ID
   * @param {string} groupId - Group ID
   * @returns {Promise<boolean>} - True if user is admin
   */
  async isUserAdminInGroup(userId, groupId) {
    try {
      // Get group from database
      const group = await this.database.getGroup(groupId);
      if (!group) return false;
      
      // Get chat object
      let chat = null;
      try {
        chat = await this.getChatById(groupId);
      } catch (chatError) {
        this.logger.error(`Error getting chat for admin verification: ${chatError.message}`);
      }
      
      // Use AdminUtils to verify
      return await this.adminUtils.isAdmin(userId, group, chat, this);
    } catch (error) {
      this.logger.error(`Error checking if user ${userId} is admin in group ${groupId}:`, error);
      return false;
    }
  }

  /**
   * Destroys the WhatsApp client
   */
  async destroy() {
    this.logger.info(`Destroying bot instance ${this.id}`);
    
    // Clean up loadReport
    if (this.loadReport) {
      this.loadReport.destroy();
    }
    
    // Clean up invite system
    if (this.inviteSystem) {
      this.inviteSystem.destroy();
    }

    // Clean up StreamSystem
    if (this.streamSystem) {
      this.streamSystem.destroy();
      this.streamSystem = null;
      this.streamMonitor = null;
    }
    
    // Send shutdown notification to logs group
    if (this.grupoLogs && this.isConnected) {
      try {
        const shutdownMessage = `🔌 Bot ${this.id} shutting down at ${new Date().toLocaleString("pt-BR")}`;
        await this.sendMessage(this.grupoLogs, shutdownMessage);
      } catch (error) {
        this.logger.error('Error sending shutdown notification:', error);
      }
    }
    
    // Remove all event listeners
    for (const [event, handler] of Object.entries(this.socketEvents)) {
      this.client.ev.off(event, handler);
    }
    
    // Close the connection
    this.client.end();
    this.client = null;
    this.isConnected = false;
  }

   /**
   * Restarts the WhatsApp client
   * @param {string} reason - Reason for restart (optional)
   * @returns {Promise<void>}
   */
  async restartBot(reason = 'Restart requested') {
    try {
      this.logger.info(`Restarting bot instance ${this.id}. Reason: ${reason}`);
      
      // Notify the warnings group about the restart
      if (this.grupoAvisos && this.isConnected) {
        try {
          const restartMessage = `🔄 Bot ${this.id} restarting at ${new Date().toLocaleString("pt-BR")}\nReason: ${reason}`;
          await this.sendMessage(this.grupoAvisos, restartMessage);
          // Wait 5 seconds for the message to be delivered
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (error) {
          this.logger.error('Error sending restart notification:', error);
        }
      }
      
      // Clean up current resources
      if (this.loadReport) {
        this.loadReport.destroy();
      }
      
      if (this.inviteSystem) {
        this.inviteSystem.destroy();
      }
      
      if (this.streamSystem) {
        this.streamSystem.destroy();
        this.streamSystem = null;
        this.streamMonitor = null;
      }
      
      // Remove all event listeners
      for (const [event, handler] of Object.entries(this.socketEvents)) {
        this.client.ev.off(event, handler);
      }
      
      // Destroy the client
      this.client.end();
      this.client = null;
      this.isConnected = false;
      
      this.logger.info(`Bot ${this.id} disconnected, starting restart...`);
      
      // Wait a short period before restarting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create a new client
      try {
        // Get authentication state
        const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
        
        // Create the socket
        this.client = makeWASocket({
          auth: state,
          printQRInTerminal: true,
          // browser: ['RavenaBot', 'Chrome', '10.0'],
          connectTimeoutMs: 60000, 
          defaultQueryTimeoutMs: 60000,
          keepAliveIntervalMs: 25000,
          emitOwnEvents: false,
          syncFullHistory: false,
          ...this.baileyOptions
        });
        
        // Store handler for saving credentials
        this.saveCreds = saveCreds;
        
        // Set up store for message/chat caching
        this.store.bind(this.client.ev);
        
        // Register event handlers
        this.registerEventHandlers();
        
        this.logger.info(`Bot ${this.id} restarted successfully`);
        
        // Wait for connection
        let waitTime = 0;
        const maxWaitTime = 60000; // 60 seconds timeout
        const checkInterval = 2000; // Check every 2 seconds
        
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout during restart'));
          }, maxWaitTime);
          
          const connectionHandler = (update) => {
            if (update.connection === 'open') {
              clearTimeout(timeout);
              
              // Set the client info once connected
              this.clientInfo.wid = { 
                _serialized: this.client.user.id 
              };
              
              this.isConnected = true;
              
              // Remove this temporary handler
              this.client.ev.off('connection.update', connectionHandler);
              
              resolve();
            }
          };
          
          // Add temporary connection listener
          this.client.ev.on('connection.update', connectionHandler);
        });
        
        this.logger.info(`Bot ${this.id} reconnected after restart`);
        
        // Reload blocked contacts
        try {
          // In Baileys, we'll use an empty array since the feature works differently
          this.blockedContacts = [];
          this.logger.info(`Reloaded ${this.blockedContacts.length} blocked contacts`);
          
          if (this.otherBots.length > 0) {
            this.prepareOtherBotsBlockList();
          }
        } catch (error) {
          this.logger.error('Error reloading blocked contacts:', error);
          this.blockedContacts = [];
        }
        
        // Initialize the streaming system
        this.streamSystem = new StreamSystem(this);
        await this.streamSystem.initialize();
        this.streamMonitor = this.streamSystem.streamMonitor;
        
        // Send successful restart notification
        if (this.grupoAvisos) {
          try {
            const successMessage = `✅ Bot ${this.id} restarted successfully!\nPrevious reason: ${reason}`;
            await this.sendMessage(this.grupoAvisos, successMessage);
          } catch (error) {
            this.logger.error('Error sending success notification:', error);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to restart bot ${this.id}:`, error);
        
        // Notify about restart failure
        if (this.grupoLogs) {
          try {
            const errorMessage = `❌ Failed to restart bot ${this.id}\nRestart reason: ${reason}`;
            // Try to send the error message, but it may fail if the bot is not connected
            await this.sendMessage(this.grupoLogs, errorMessage).catch(() => {});
          } catch (error) {
            this.logger.error('Error sending failure notification:', error);
          }
        }
        
        throw error;
      }
    } catch (error) {
      this.logger.error(`Error during bot ${this.id} restart:`, error);
      throw error;
    }
  }

  /**
   * Gets the current timestamp
   * @returns {number} - Current timestamp in seconds
   */
  getCurrentTimestamp() {
    return Math.round(+new Date()/1000);
  }
  
  /**
   * Gets information about a group invite
   * @param {string} inviteCode - The invite code
   * @returns {Promise<Object>} - Invite information
   */
  async getInviteInfo(inviteCode) {
    try {
      // Extract group ID from invite code if it's a full URL
      let code = inviteCode;
      if (inviteCode.includes('/')) {
        code = inviteCode.split('/').pop();
      }
      
      // Get invite info using Baileys
      const info = await this.client.groupGetInviteInfo(code);
      
      // Return in a compatible format
      return {
        id: info.id,
        subject: info.subject,
        creation: info.creation,
        owner: info.creator?.id || 'Unknown',
        desc: info.desc || '',
        participants: info.participants || []
      };
    } catch (error) {
      this.logger.error(`Error getting invite info for ${inviteCode}:`, error);
      throw error;
    }
  }
  
  /**
   * Accepts a group invite
   * @param {string} inviteCode - The invite code
   * @returns {Promise<Object>} - Group information
   */
  async acceptInvite(inviteCode) {
    try {
      // Extract group ID from invite code if it's a full URL
      let code = inviteCode;
      if (inviteCode.includes('/')) {
        code = inviteCode.split('/').pop();
      }
      
      // Accept the invite
      const groupId = await this.client.groupAcceptInvite(code);
      
      // Get group info
      const group = await this.getGroupInfo(groupId);
      
      return group;
    } catch (error) {
      this.logger.error(`Error accepting invite ${inviteCode}:`, error);
      throw error;
    }
  }
  
  /**
   * Leaves a group
   * @param {string} groupId - The group ID
   * @returns {Promise<boolean>} - Success status
   */
  async leaveGroup(groupId) {
    try {
      // Leave the group
      await this.client.groupLeave(groupId);
      return true;
    } catch (error) {
      this.logger.error(`Error leaving group ${groupId}:`, error);
      return false;
    }
  }
  
  /**
   * Sets the bot's profile picture
   * @param {MessageMedia} media - The image to set as profile picture
   * @returns {Promise<boolean>} - Success status
   */
  async setProfilePicture(media) {
    try {
      if (!media || !media.data) {
        throw new Error('Invalid media data');
      }
      
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(media.data, 'base64');
      
      // Set profile picture
      await this.client.updateProfilePicture(this.client.user.id, imageBuffer);
      
      return true;
    } catch (error) {
      this.logger.error('Error setting profile picture:', error);
      return false;
    }
  }
  
  /**
   * Sets the bot's status
   * @param {string} status - The status text
   * @returns {Promise<boolean>} - Success status
   */
  async setStatus(status) {
    try {
      // Set status
      await this.client.updateProfileStatus(status);
      return true;
    } catch (error) {
      this.logger.error(`Error setting status to "${status}":`, error);
      return false;
    }
  }
  
  /**
   * Changes a group's settings
   * @param {string} groupId - The group ID
   * @param {boolean} adminsOnly - Whether only admins can send messages
   * @returns {Promise<boolean>} - Success status
   */
  async setGroupMessagesAdminsOnly(groupId, adminsOnly) {
    try {
      // In Baileys, set group property
      await this.client.groupSettingUpdate(groupId, adminsOnly ? 'announcement' : 'not_announcement');
      return true;
    } catch (error) {
      this.logger.error(`Error setting group ${groupId} to ${adminsOnly ? 'admins only' : 'everyone can send'}:`, error);
      return false;
    }
  }
  
  /**
   * Changes a group's name
   * @param {string} groupId - The group ID
   * @param {string} name - The new group name
   * @returns {Promise<boolean>} - Success status
   */
  async setGroupName(groupId, name) {
    try {
      // In Baileys, set group subject
      await this.client.groupUpdateSubject(groupId, name);
      return true;
    } catch (error) {
      this.logger.error(`Error setting group ${groupId} name to "${name}":`, error);
      return false;
    }
  }
  
  /**
   * Changes a group's description
   * @param {string} groupId - The group ID
   * @param {string} description - The new group description
   * @returns {Promise<boolean>} - Success status
   */
  async setGroupDescription(groupId, description) {
    try {
      // In Baileys, set group description
      await this.client.groupUpdateDescription(groupId, description);
      return true;
    } catch (error) {
      this.logger.error(`Error setting group ${groupId} description:`, error);
      return false;
    }
  }
  
  /**
   * Changes a group's picture
   * @param {string} groupId - The group ID
   * @param {MessageMedia} media - The image to set as group picture
   * @returns {Promise<boolean>} - Success status
   */
  async setGroupPicture(groupId, media) {
    try {
      if (!media || !media.data) {
        throw new Error('Invalid media data');
      }
      
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(media.data, 'base64');
      
      // Set group picture
      await this.client.updateProfilePicture(groupId, imageBuffer);
      
      return true;
    } catch (error) {
      this.logger.error(`Error setting group ${groupId} picture:`, error);
      return false;
    }
  }
}

module.exports = WhatsAppBotBaileys;