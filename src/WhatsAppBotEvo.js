const express = require('express');
const axios = require('axios');
const qrcode = require('qrcode-terminal');
const path =require('path');
const fs = require('fs'); // For createMedia, etc.
const mime = require('mime-types'); // For createMedia

const EvolutionApiClient = require('./services/evolutionApiClient'); // Adjust path if needed
const Database = require('./utils/Database');
const Logger = require('./utils/Logger');
const LoadReport = require('./LoadReport');
const ReactionsHandler = require('./ReactionsHandler');
const MentionHandler = require('./MentionHandler');
const InviteSystem = require('./InviteSystem');
const StreamSystem = require('./StreamSystem'); // Will need significant review for Evo API context
const LLMService = require('./services/LLMService');
const AdminUtils = require('./utils/AdminUtils');
const ReturnMessage = require('./models/ReturnMessage'); // Assuming it's in the same directory structure
const { io } = require("socket.io-client");
const { Contact, LocalAuth, MessageMedia, Location, Poll } = require('whatsapp-web.js');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class WhatsAppBotEvo {
  /**
   * @param {Object} options
   * @param {string} options.id - Your internal Bot ID
   * @param {string} options.phoneNumber - Phone number (for reference or if API needs it)
   * @param {Object} options.eventHandler - Instance of your EventHandler
   * @param {string} options.prefix
   * @param {Array} options.otherBots
   * @param {string} options.evolutionApiUrl - Base URL of Evolution API
   * @param {string} options.evolutionApiKey - API Key for Evolution API
   * @param {string} options.instanceName - Name of the Evolution API instance
   * @param {string} options.webhookHost - Publicly accessible host for webhook (e.g., https://your.domain.com)
   * @param {number} options.webhookPort - Local port for Express server to listen on
   * @param {string} options.userAgent - (May not be used directly with Evo API but kept for options consistency)
   */
  constructor(options) {
    this.id = options.id;
    this.phoneNumber = options.phoneNumber;
    this.eventHandler = options.eventHandler;
    this.prefix = options.prefix || process.env.DEFAULT_PREFIX || '!';
    this.logger = new Logger(`bot-evo-${this.id}`);
    
    this.websocket = true;
    this.evolutionApiUrl = options.evolutionApiUrl;
    this.evolutionApiKey = options.evolutionApiKey;
    this.instanceName = options.evoInstanceName;
    this.webhookHost = options.webhookHost; // e.g., from cloudflared tunnel
    this.webhookPort = options.webhookPort || process.env.WEBHOOK_PORT_EVO || 3000;

    this.messageCache = [];
    this.contactCache = [];
    this.sentMessagesCache = [];
    this.maxCacheSize = 3000;

    if (!this.evolutionApiUrl || !this.evolutionApiKey || !this.instanceName || !this.webhookHost) {
        const errMsg = 'WhatsAppBotEvo: evolutionApiUrl, evolutionApiKey, instanceName, and webhookHost are required!';
        this.logger.error(errMsg, {
            evolutionApiUrl: !!this.evolutionApiUrl,
            evolutionApiKey: !!this.evolutionApiKey,
            instanceName: !!this.instanceName,
            webhookHost: !!this.webhookHost
        });
        throw new Error(errMsg);
    }

    this.apiClient = new EvolutionApiClient(
      this.evolutionApiUrl,
      this.evolutionApiKey,
      this.instanceName, // apiClient doesn't need instanceName per method if we pass it in constructor
      this.logger
    );

    this.database = Database.getInstance();
    this.isConnected = true;
    this.safeMode = options.safeMode !== undefined ? options.safeMode : (process.env.SAFE_MODE === 'true');
    this.otherBots = options.otherBots || [];
    
    this.ignorePV = options.ignorePV || false;
    this.whitelist = options.whitelistPV || []; // This should be populated by loadDonationsToWhitelist
    this.ignoreInvites = options.ignoreInvites || false;
    this.grupoLogs = options.grupoLogs || process.env.GRUPO_LOGS;
    this.grupoInvites = options.grupoInvites || process.env.GRUPO_INVITES;
    this.grupoAvisos = options.grupoAvisos || process.env.GRUPO_AVISOS;
    // ... other group IDs ...
    this.userAgent = options.userAgent || process.env.USER_AGENT;


    this.mentionHandler = new MentionHandler();

    this.lastMessageReceived = Date.now();
    this.startupTime = Date.now();
    
    this.loadReport = new LoadReport(this);
    this.inviteSystem = new InviteSystem(this); // Will require Evo API for joining groups
    this.reactionHandler = new ReactionsHandler(); // Will need Evo API for sending/receiving reactions
    
    // StreamSystem and stabilityMonitor might need re-evaluation for Evolution API
    this.streamSystem = null; 
    this.streamMonitor = null;
    this.stabilityMonitor = options.stabilityMonitor ?? false;

    this.llmService = new LLMService({});
    this.adminUtils = AdminUtils.getInstance(); // Will need adaptation for permission checks via API

    this.webhookApp = null; // Express app instance
    this.webhookServer = null; // HTTP server instance

    this.blockedContacts = []; // To be populated via API if possible / needed

    if (!this.streamSystem) {
      this.streamSystem = new StreamSystem(this);
      this.streamSystem.initialize();
      this.streamMonitor = this.streamSystem.streamMonitor;
    }

    // Client Fake
    this.client = {
      getChatById: (arg) => {
        return this.getChatDetails(arg);
      },
      getContactById: (arg) => {
        return this.getContactDetails(arg);
      },
      getInviteInfo: (arg) => {
        return this.inviteInfo(arg);
      },
      getMessageById: (arg) => {
        return this.getMessageFromCache(arg);
      },
      setStatus: (arg) => {
        this.updateProfileStatus(arg);
      },
      leaveGroup: (arg) => {
        this.leaveGroup(arg);
      },
      setProfilePicture: (arg) => {
        this.updateProfilePicture(arg);
      },
      acceptInvite: (arg) => {
        return this.acceptInviteCode(arg);
      },
      sendPresenceUpdate: async (xxx) => {
        // Sem necessidade dessa função
        return true;
      },
      info: {
        wid: {
          _serialized: `${options.phoneNumber}@c.us`
        }
      }
    }
  }

  async initialize() {
    this.logger.info(`Initializing Evolution API bot instance ${this.id} (Evo Instance: ${this.instanceName}@${this.webhookPort})`);
    this.database.registerBotInstance(this);
    this.startupTime = Date.now();

    try {
      // 1. Setup Webhook Server OR Websocket connection
      if(this.websocket){
        this.logger.info(`Usar websocket`);
        const socket = io(`wss://evo-ravena.moothz.win/${this.instanceName}`, {
          transports: ['websocket']
        });

        socket.on('connect', () => {
          this.logger.info('>>> Conectado ao WebSocket da Evolution API <<<');
        });

        // Escutando eventos
        socket.on('messages.upsert', (data) => this.handleWebsocket(data));

        socket.on('group-participants.update', (data) => {
          this.logger.info('group-participants.update', data);

          this.handleWebsocket(data);
        });

        socket.on('connection.update', (data) => {
          this.logger.info('connection.update', data);

          this.handleWebsocket(data);
        });

        socket.on('send.message', (data) => {
          this.handleWebsocket(data);
        });

        // Lidando com desconexão
        socket.on('disconnect', () => {
          this.logger.info('Desconectado do WebSocket da Evolution API');
        });
      } else {
        this.webhookApp = express();
        this.webhookApp.use(express.json());
        const webhookPath = `/webhook/evo/${this.id}`; // Unique path for this bot instance
        this.webhookApp.post(webhookPath, this._handleWebhook.bind(this));

        await new Promise((resolve, reject) => {
          this.webhookServer = this.webhookApp.listen(this.webhookPort, () => {
            this.logger.info(`Webhook listener for bot ${this.id} started on http://localhost:${this.webhookPort}${webhookPath}`);
            resolve();
          }).on('error', (err) => {
            this.logger.error(`Failed to start webhook listener for bot ${this.id}:`, err);
            reject(err);
          });
        });

      }

      // 2. Configure Webhook in Evolution API
      // const fullWebhookUrl = `${this.webhookHost.replace(/\/$/, '')}${webhookPath}`;
      // this.logger.info(`Attempting to set Evolution API webhook for instance ${this.instanceName} to: ${fullWebhookUrl}`);
      
      // // IMPORTANT: Verify the exact event names your Evolution API version uses!
      // const desiredEvents = [
      //   "messages.upsert", 
      //   "messages.update", // For reactions or edits, if applicable
      //   "connection.update",
      //   "group-participants.update", // For join/leave
      //   // "groups.update", // For group subject/description changes
      //   // "message.reaction" // If reactions are a separate event
      // ];

      // await this.apiClient.post(`/instance/webhook/set`, { // Pass instanceName via constructor to apiClient
      //   enabled: true,
      //   url: fullWebhookUrl,
      //   // events: desiredEvents // Some Evolution API versions might not support granular events here, it might be all or none
      // });
      // this.logger.info(`Successfully requested webhook setup for instance ${this.instanceName}.`);

    } catch (error) {
      this.logger.error(`Error during webhook setup for instance ${this.instanceName}:`, error);
      // Decide if we should throw or try to continue without webhooks for sending only
    }

    // 3. Load donations to whitelist (from original bot)
    this._loadDonationsToWhitelist();

    // 4. Check instance status and connect if necessary
    this._checkInstanceStatusAndConnect();
    
    return this;
  }

  async _checkInstanceStatusAndConnect(isRetry = false) {
    this.logger.info(`Checking instance status for ${this.instanceName}...`);
    try {
      /*
      {
        "instance": {
          "instanceName": "teste-docs",
          "state": "open"
        }
      }
      */
      const instanceDetails = await this.apiClient.get(`/instance/connectionState`);
      this.logger.info(`Instance ${this.instanceName} state: ${instanceDetails?.instance?.state}`, instanceDetails?.instance);

      const state = (instanceDetails?.instance?.state ?? "error").toUpperCase();
      if (state === 'CONNECTED') {
        this._onInstanceConnected();
      } else if (state === 'OPEN' || state === 'CONNECTING' || state === 'PAIRING' || !state /* if undefined, try to connect */) {
        this.logger.info(`Instance ${this.instanceName} is not connected (state: ${state}). Attempting to connect...`);
        const connectData = await this.apiClient.get(`/instance/connect`, {number: this.phoneNumber});

        if (connectData.pairingCode) {
           this.logger.info(`[${this.id}] Instance ${this.instanceName} PAIRING CODE: ${connectData.pairingCode.code}. Enter this on your phone in Linked Devices -> Link with phone number.`);
        } else 
        if (connectData.code) {
          this.logger.info(`[${this.id}] QR Code for ${this.instanceName} (Scan with WhatsApp):`);
          qrcode.generate(connectData.code, { small: true });

          // TODO: Save QR to file as in original bot:
          // const qrCodeLocal = path.join(this.database.databasePath, `qrcode_evo_${this.id}.png`);
          // fs.writeFileSync(qrCodeLocal, Buffer.from(connectData.qrcode.base64, 'base64'));
          // this.logger.info(`QR Code saved to ${qrCodeLocal}`);
        } else {
          this.logger.warn(`[${this.id}] Received connection response for ${this.instanceName}, but no QR/Pairing code found. State: ${connectData?.state}. Waiting for webhook confirmation.`, connectData);
        }
        // After attempting to connect, we wait for a 'connection.update' webhook.
      } else if (state === 'TIMEOUT' && !isRetry) {
        this.logger.warn(`Instance ${this.instanceName} timed out. Retrying connection once...`);
        await sleep(5000);
        this._checkInstanceStatusAndConnect(true);
      } else {
        this.logger.error(`Instance ${this.instanceName} is in an unhandled state: ${state}. Manual intervention may be required.`);
        // Consider calling onDisconnected here if it's a definitively disconnected state
      }
    } catch (error) {
      this.logger.error(`Error checking/connecting instance ${this.instanceName}:`, error);
      // Schedule a retry or notify admin?
    }
  }

  async _onInstanceConnected() {
    if (this.isConnected) return; // Prevent multiple calls
    this.isConnected = true;
    this.logger.info(`[${this.id}] Successfully connected to WhatsApp via Evolution API for instance ${this.instanceName}.`);
    
    if (this.eventHandler && typeof this.eventHandler.onConnected === 'function') {
      this.eventHandler.onConnected(this);
    }

    await this._sendStartupNotifications();
    await this.fetchAndPrepareBlockedContacts(); // Fetch initial blocklist
  }

  _onInstanceDisconnected(reason = 'Unknown') {
    if (!this.isConnected && reason !== 'INITIALIZING') return; // Prevent multiple calls if already disconnected
    const wasConnected = this.isConnected;
    this.isConnected = false;
    this.logger.info(`[${this.id}] Disconnected from WhatsApp (Instance: ${this.instanceName}). Reason: ${reason}`);
    
    if (this.eventHandler && typeof this.eventHandler.onDisconnected === 'function' && wasConnected) {
      this.eventHandler.onDisconnected(this, reason);
    }
    // Optionally, attempt to reconnect after a delay
    // setTimeout(() => this._checkInstanceStatusAndConnect(), 30000); // Reconnect after 30s
  }

  async handleWebsocket(data){
    return this._handleWebhook({websocket: true, body: data}, {sendStatus: () => 0 }, true);
  }
  async _handleWebhook(req, res, socket = false) {
    // this.logger.info(req.params);
    // const botIdFromPath = req.params.botId;
    // if (botIdFromPath !== this.id) {
    //   this.logger.warn(`Webhook received for unknown botId ${botIdFromPath}. Ignoring.`);
    //   return res.status(400).send('Unknown botId');
    // }

    const payload = req.body;
    this.logger.debug(`[${this.id}] ${socket ? 'Websocket' : 'Webhook'} received: Event: ${payload.event}, Instance: ${payload.instance}`, payload.data?.key?.id || payload.data?.id);
    this.lastMessageReceived = Date.now();

    if (this.shouldDiscardMessage() && payload.event === 'messages.upsert') { // Only discard messages, not connection events
      this.logger.debug(`[${this.id}] Discarding webhook message during initial ${this.id} startup period.`);
      return res.sendStatus(200);
    }
    
    try {
      switch (payload.event) {
        case 'connection.update':
          const connectionState = payload.data?.state;
          this.logger.info(`[${this.id}] Connection update: ${connectionState}`);
          if (connectionState === 'CONNECTED') {
            this._onInstanceConnected();
          } else if (['CLOSE', 'DISCONNECTED', 'LOGGED_OUT', 'TIMEOUT', 'CONFLICT'].includes(connectionState)) {
            this._onInstanceDisconnected(connectionState);
          }
          break;

        case 'send.message':
/*
{
  event: 'send.message',
  instance: 'ravena-testes',
  data: {
    key: {
      remoteJid: '120363402005217365@g.us',
      fromMe: true,
      id: '3EB0B46BB2D742C4B85CC492153D8CA463DAB035'
    },
    pushName: '',
    status: 'PENDING',
    message: {
      conversation: '🗑 Só posso apagar minhas próprias mensagens ou mensagens de outros se eu for admin do grupo.'
    },
    contextInfo: null,
    messageType: 'conversation',
    messageTimestamp: 1748533669,
    instanceId: 'e1af61d2-4abc-4e85-9efb-b8f19df5eebc',
    source: 'unknown'
  },
  server_url: 'http://localhost:4567',
  date_time: '2025-05-29T12:47:49.381Z',
  sender: '555596424307@s.whatsapp.net', // CUIDAR ISSO PQ MUDA ESSE LIXO???
  apikey: '784C1817525B-4C53-BB49-36FF0887F8BF'
}
*/
          const incomingSentMessageData = Array.isArray(payload.data) ? payload.data[0] : payload.data;
          if (incomingSentMessageData && incomingSentMessageData.key && incomingSentMessageData.key.fromMe) {
            const incomingSentMessageData = Array.isArray(payload.data) ? payload.data[0] : payload.data;
            incomingSentMessageData.event = "send.message";
            incomingSentMessageData.sender = payload.sender;
            this.formatMessageFromEvo(incomingSentMessageData);
          }

          // Marca msg como enviada, não faço ideia qual os status, não tem no doc
          // talvez venha em outro evento...
          if(incomingSentMessageData.status != "PENDING"){
            console.log(`======STATUS====== ${incomingSentMessageData.status} ======STATUS=====`);
          }

          if(incomingSentMessageData.status === "DELIVERY_ACK"){
            this.sentMessagesCache.push(incomingSentMessageData.key);
          }
          break;

        case 'messages.upsert':
          const incomingMessageData = Array.isArray(payload.data) ? payload.data[0] : payload.data;
          if (incomingMessageData && incomingMessageData.key) {
            // Basic filtering (from original bot)
            const chatToFilter = incomingMessageData.key.remoteJid;
            if (chatToFilter === this.grupoLogs || chatToFilter === this.grupoInvites || chatToFilter === this.grupoEstabilidade) {
                this.logger.debug(`[${this.id}] Ignoring message from system group: ${chatToFilter}`);
                break;
            }

            this.formatMessageFromEvo(incomingMessageData).then(formattedMessage => {
              if (formattedMessage && this.eventHandler && typeof this.eventHandler.onMessage === 'function') {
                if(!incomingMessageData.key.fromMe){ // Só rodo o onMessage s enão for msg do bot. preciso chamar o formatMessage pra elas serem formatadas e irem pro cache
                  this.eventHandler.onMessage(this, formattedMessage);
                }
              }
            }).catch(e => {
              this.logger(`[messages.upsert] Erro formatando mensagem`,incomingMessageData, e, "-----");
            })

          }
          break;
        
        case 'group-participants.update':
          /*{
            event: 'group-participants.update',
            instance: 'ravena-testes',
            data: {
              id: '120363402005217365@g.us',
              author: '555596792072@s.whatsapp.net',
              participants: [ '559591146078@s.whatsapp.net' ],
              action: 'remove'
            },
            server_url: 'http://localhost:4567',
            date_time: '2025-05-28T17:14:08.899Z',
            sender: '555596424307@s.whatsapp.net',
            apikey: '784C1817525B-4C53-BB49-36FF0887F8BF'
          }*/
          // And possibly payload.author for who triggered it. THIS NEEDS VERIFICATION FROM EVO DOCS.
          const groupUpdateData = payload.data;
          if (groupUpdateData && groupUpdateData.id && groupUpdateData.action && groupUpdateData.participants) {
             this.logger.info(`[${this.id}] Group participants update:`, groupUpdateData);
             this._handleGroupParticipantsUpdate(groupUpdateData);
          }
          break;

        // Add other event cases: 'groups.update' (for subject changes etc.)
        default:
          this.logger.debug(`[${this.id}] Unhandled webhook event: ${payload.event}`);
      }
    } catch (error) {
      this.logger.error(`[${this.id}] Error processing webhook for event ${payload.event}:`, error);
    }
    res.sendStatus(200);
  }

  putMessageInCache(data){
    this.messageCache.push(data);
    if(this.messageCache.length > this.maxCacheSize){
      this.messageCache.shift();
    }
  }

  getMessageFromCache(id){
    //console.log("buscando msg no cache", id, "----------", this.messageCache, "----------");
    if(id){
      return this.messageCache.find(m => m.key.id == id);
    } else {
      return null;
    }
  }

  putContactInCache(data){
    this.contactCache.push(data);
    if(this.contactCache.length > this.maxCacheSize){
      this.contactCache.shift();
    }
  }

  getContactFromCache(id){
    if(id){
      return this.contactCache.find(m => m.number == id);
    } else {
      return null;
    }
  }

  async formatMessage(data){
    // Usada no ReactionsHandler pq a message que vem lá era do wwebjs
    // Agora o getMessageFromCache já retorna a mensagem formatada, não precisa formatar de novo
    return data;
  }

  formatMessageFromEvo(evoMessageData) {
    // Explicitly return a new Promise
    return new Promise(async (resolve, reject) => { // Executor function is async to use await inside
      //this.logger.info(JSON.stringify(evoMessageData, null, "\t"));
      try {
        const key = evoMessageData.key;
        const waMessage = evoMessageData.message; // The actual message content part
        if (!key || !waMessage) {
          this.logger.warn(`[${this.id}] Incomplete Evolution message data for formatting:`, evoMessageData);
          resolve(null); // Resolve with null
        }

        const chatId = key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        // Added evoMessageData.author as a potential source
        let author = isGroup ? (evoMessageData.author || key.participant || key.remoteJid) : key.remoteJid;

        if(evoMessageData.event === "send.message"){
          author = evoMessageData.sender.split("@")[0]+"@c.us";
        }
        const authorName = evoMessageData.pushName || author.split('@')[0]; // pushName is often sender's name
        
        const messageTimestamp = typeof evoMessageData.messageTimestamp === 'number' 
            ? evoMessageData.messageTimestamp 
            : (typeof evoMessageData.messageTimestamp === 'string' ? parseInt(evoMessageData.messageTimestamp, 10) : Math.floor(Date.now()/1000));
        const responseTime = Math.max(0, this.getCurrentTimestamp() - messageTimestamp);

        this.loadReport.trackReceivedMessage(isGroup, responseTime, chatId); // From original bot

        let type = 'unknown';
        let content = null;
        let caption = null;
        let mediaInfo = null; // To store { url, mimetype, filename, data (base64 if downloaded) }

        // Determine message type and content
        if (waMessage.conversation) {
          type = 'text';
          content = waMessage.conversation;
        } else if (waMessage.extendedTextMessage) {
          type = 'text';
          content = waMessage.extendedTextMessage.text;
        } else if (waMessage.imageMessage) {
          type = 'image';
          caption = waMessage.imageMessage.caption;
          mediaInfo = {
            isMessageMedia: true,
            mimetype: waMessage.imageMessage.mimetype || 'image/jpeg',
            url: waMessage.imageMessage.url, 
            filename: waMessage.imageMessage.fileName || `image-${key.id}.${mime.extension(waMessage.imageMessage.mimetype || 'image/jpeg') || 'jpg'}`,
            _evoMediaDetails: waMessage.imageMessage 
          };
          content = mediaInfo;
        } else if (waMessage.videoMessage) {
          type = 'video';
          caption = waMessage.videoMessage.caption;
          mediaInfo = {
            isMessageMedia: true,
            mimetype: waMessage.videoMessage.mimetype || 'video/mp4',
            url: waMessage.videoMessage.url,
            filename: waMessage.videoMessage.fileName || `video-${key.id}.${mime.extension(waMessage.videoMessage.mimetype || 'video/mp4') || 'mp4'}`,
            seconds: waMessage.videoMessage.seconds,
            _evoMediaDetails: waMessage.videoMessage
          };
          content = mediaInfo;
        } else if (waMessage.audioMessage) {
          type = waMessage.audioMessage.ptt ? 'ptt' : 'audio';
          mediaInfo = {
            isMessageMedia: true,
            mimetype: waMessage.audioMessage.mimetype || (waMessage.audioMessage.ptt ? 'audio/ogg' : 'audio/mpeg'),
            url: waMessage.audioMessage.url,
            filename: `audio-${key.id}.${mime.extension(waMessage.audioMessage.mimetype || (waMessage.audioMessage.ptt ? 'audio/ogg' : 'audio/mpeg')) || (waMessage.audioMessage.ptt ? 'ogg' : 'mp3')}`,
            seconds: waMessage.audioMessage.seconds,
            ptt: waMessage.audioMessage.ptt,
            _evoMediaDetails: waMessage.audioMessage
          };
          content = mediaInfo;
        } else if (waMessage.documentMessage) {
          type = 'document';
          caption = waMessage.documentMessage.title || waMessage.documentMessage.fileName;
          mediaInfo = {
            isMessageMedia: true,
            mimetype: waMessage.documentMessage.mimetype || 'application/octet-stream',
            url: waMessage.documentMessage.url,
            filename: waMessage.documentMessage.fileName || `document-${key.id}${waMessage.documentMessage.mimetype ? '.' + (mime.extension(waMessage.documentMessage.mimetype) || '') : ''}`.replace(/\.$/,''),
            title: waMessage.documentMessage.title,
            _evoMediaDetails: waMessage.documentMessage
          };
          content = mediaInfo;
        } else if (waMessage.stickerMessage) {
          type = 'sticker';
          mediaInfo = {
            isMessageMedia: true,
            mimetype: waMessage.stickerMessage.mimetype || 'image/webp',
            url: waMessage.stickerMessage.url,
            filename: `sticker-${key.id}.webp`,
            _evoMediaDetails: waMessage.stickerMessage
          };
          content = mediaInfo;
        } else if (waMessage.locationMessage) {
          type = 'location';
          content = {
            isLocation: true,
            latitude: waMessage.locationMessage.degreesLatitude,
            longitude: waMessage.locationMessage.degreesLongitude,
            name: waMessage.locationMessage.name,
            address: waMessage.locationMessage.address,
            description: waMessage.locationMessage.name || waMessage.locationMessage.address,
            jpegThumbnail: waMessage.locationMessage.jpegThumbnail,
          };
        } else if (waMessage.contactMessage) {
          type = 'contact';
          content = {
              isContact: true,
              displayName: waMessage.contactMessage.displayName,
              vcard: waMessage.contactMessage.vcard,
              _evoContactDetails: waMessage.contactMessage
          };
        } else if (waMessage.contactsArrayMessage) {
          type = 'contacts_array';
          content = {
              displayName: waMessage.contactsArrayMessage.displayName,
              contacts: waMessage.contactsArrayMessage.contacts.map(contact => ({
                  isContact: true,
                  displayName: contact.displayName, 
                  vcard: contact.vcard
              })),
              _evoContactsArrayDetails: waMessage.contactsArrayMessage
          };
        } 
        else if(waMessage.reactionMessage && evoMessageData.event === "messages.upsert"){ // Pra evitar pegar coisa do send.message
          const reactionData = waMessage.reactionMessage;
          if (reactionData && reactionData.key && !reactionData.key.fromMe) {
              if(reactionData.text !== ""){
                this.logger.debug(`[${this.id}] Received reaction:`, reactionData);
                this.reactionHandler.processReaction(this, { // await is used here
                  reaction: reactionData.text,
                  senderId: reactionData.key?.participant ? reactionData.key.participant.split("@")[0]+"@c.us" : waMessage.sender, // waMessage.sender vem no send.message event
                  msgId: {_serialized: reactionData.key.id}
                });
              }
          }
          resolve(null); // Resolve with null
          return;
        }
        else {
          this.logger.warn(`[${this.id}] Unhandled Evolution message type for ID ${key.id}:`, Object.keys(waMessage).join(', '));
          content = `[Unsupported message type: ${Object.keys(waMessage).join(', ')}]`;
          resolve(null); // Resolve with null
          return;
        }

        const formattedMessage = {
          id: key.id,
          fromMe: evoMessageData.key.fromMe,
          group: isGroup ? chatId : null,
          from: isGroup ? chatId : author,
          author: author.replace("@s.whatsapp.net", "@c.us"),
          authorName: authorName,
          type: type,
          content: content, 
          body: content,
          caption: caption,
          origin: {}, 
          responseTime: responseTime,
          timestamp: messageTimestamp,
          key: key, 
          secret: evoMessageData.message?.messageContextInfo?.messageSecret,
          hasMedia: (mediaInfo && (mediaInfo.url || mediaInfo._evoMediaDetails)),

          getContact: async () => {
              const contactIdToFetch = isGroup ? (key.participant || author) : author;
              return await this.getContactDetails(contactIdToFetch);
          },
          getChat: async () => {
              return await this.getChatDetails(chatId);
          },
          delete: async (forEveryone = true) => { 
              return this.deleteMessageByKey(evoMessageData.key);
          },
          downloadMedia: async () => {
              if (mediaInfo && (mediaInfo.url || mediaInfo._evoMediaDetails)) {
                  const downloadedMedia = await this._downloadMediaAsBase64(mediaInfo, key, evoMessageData);
                  return { mimetype: mediaInfo.mimetype, data: downloadedMedia, filename: mediaInfo.filename, source: 'file', isMessageMedia: true };
              }
              this.logger.warn(`[${this.id}] downloadMedia called for non-media or unfulfillable message:`, type, mediaInfo);
              return null;
          }
        };
        
        if (['image', 'video', 'sticker'].includes(type)) {
            try {
              const media = await formattedMessage.downloadMedia(); // await is used here
              if (media) {
                  formattedMessage.content = media;
              }
            } catch (dlError) {
                this.logger.error(`[${this.id}] Failed to pre-download media for NSFW check:`, dlError);
            }
        }

        formattedMessage.origin = {
          id: { _serialized: `${evoMessageData.key.remoteJid}_${evoMessageData.key.fromMe}_${evoMessageData.key.id}`},
          author: formattedMessage.author,
          from: formattedMessage.from,
          // If this.sendReaction is async, this will correctly return a Promise
          react: (emoji) => this.sendReaction(evoMessageData.key.remoteJid, evoMessageData.key.id, emoji), 
          getContact: formattedMessage.getContact,
          getChat: formattedMessage.getChat,
          getQuotedMessage: async () => {
            const quotedMsgId = evoMessageData.contextInfo?.quotedMessage ? evoMessageData.contextInfo?.stanzaId : null;
            return await this.getMessageFromCache(quotedMsgId);
          },
          delete: async () => {
            return this.deleteMessageByKey(evoMessageData.key);
          },
          body: content,
          ...evoMessageData
        };

        this.putMessageInCache(formattedMessage);
        resolve(formattedMessage); // Resolve with the formatted message

      } catch (error) {
        this.logger.error(`[${this.id}] Error formatting message from Evolution API:`, error, evoMessageData);
        // To match original behavior of returning null on error (which means promise resolves with null)
        resolve(null); 
        // If you'd rather have the promise reject on error, use:
        // reject(error); 
      }
    });
  }
  
  shortJson(json, max = 30){
    return JSON.stringify(json, null, "\t").substring(0,max);
  }

  async _downloadMediaAsBase64(mediaInfo, messageKey, evoMessageData) {
    this.logger.debug(`[${this.id}] Attempting to download media for: ${mediaInfo.filename} using messageKey: ${this.shortJson(messageKey)}`);

    if (!messageKey || !messageKey.id || !messageKey.remoteJid) {
      this.logger.error(`[${this.id}] Crucial messageKey information (id, remoteJid) is missing. Cannot use /chat/getBase64FromMediaMessage.`);
      // Proceed to fallback if messageKey is invalid or essential parts are missing.
    }

    if (messageKey && messageKey.id && messageKey.remoteJid && this.evolutionApiUrl && this.evolutionApiKey && this.instanceName) {
      this.logger.info(`[${this.id}] Attempting media download via Evolution API POST /chat/getBase64FromMediaMessage for: ${mediaInfo.filename}`);
      try {
        const endpoint = `${this.evolutionApiUrl}/chat/getBase64FromMediaMessage/${this.instanceName}`;
        const payload = {message: evoMessageData};
        if(evoMessageData.videoMessage){
          payload.convertToMp4 = true;
        }

        if (messageKey.participant) {
          payload.participant = messageKey.participant;
        }
        this.logger.debug(`[${this.id}] Calling Evolution API POST endpoint: ${endpoint} with payload: ${this.shortJson(payload)}`);

        const response = await axios.post(endpoint, payload, {
          headers: {
            'apikey': this.evolutionApiKey,
            'Content-Type': 'application/json', // Explicitly set Content-Type for POST
          },
          // timeout: 30000, // 30 seconds, for example
        });

        // Process the response (same logic as before):
        if (response.data) {
          if (typeof response.data === 'string' && response.data.length > 100) {
            this.logger.info(`[${this.id}] Media downloaded successfully as direct base64 string via Evolution API for: ${mediaInfo.filename}`);
            return response.data;
          } else if (response.data.base64 && typeof response.data.base64 === 'string') {
            this.logger.info(`[${this.id}] Media downloaded successfully (from base64 field) via Evolution API for: ${mediaInfo.filename}`);
            return response.data.base64;
          } else {
            this.logger.warn(`[${this.id}] Evolution API /chat/getBase64FromMediaMessage did not return expected base64 data for ${mediaInfo.filename}. Response data:`, response.data);
          }
        } else {
          this.logger.warn(`[${this.id}] No data received from Evolution API /chat/getBase64FromMediaMessage for ${mediaInfo.filename}`);
        }

      } catch (apiError) {
        let errorMessage = apiError.message;
        if (apiError.response) {
          errorMessage = `Status: ${apiError.response.status}, Data: ${JSON.stringify(apiError.response.data)}`;
        }
        this.logger.error(`[${this.id}] Error downloading media via Evolution API POST /chat/getBase64FromMediaMessage for ${mediaInfo.filename}: ${errorMessage}`);
      }
    } else {
      this.logger.info(`[${this.id}] Skipping Evolution API POST /chat/getBase64FromMediaMessage download for ${mediaInfo.filename} due to missing messageKey or API configuration.`);
    }

    this.logger.warn(`[${this.id}] Failed to download media for ${mediaInfo.filename} using all available methods.`);
    return null;
  }

  async sendMessage(chatId, content, options = {}) {
    this.logger.debug(`[${this.id}] sendMessage to ${chatId} (Type: ${typeof content})`); // , {content: typeof content === 'string' ? content.substring(0,30) : content, options}
    try {
      const isGroup = chatId.endsWith('@g.us');
      this.loadReport.trackSentMessage(isGroup); // From original bot

      if (this.safeMode) {
        this.logger.info(`[${this.id}] [SAFE MODE] Would send to ${chatId}: ${typeof content === 'string' ? content.substring(0, 70) + '...' : '[Media/Object]'}`);
        return { id: { _serialized: `safe-mode-msg-${this.rndString()}` }, ack: 0, body: content }; // Mimic wwebjs
      }

      
      if (!this.isConnected) {
        this.logger.warn(`[${this.id}] Attempted to send message while disconnected from ${this.instanceName}.`);
        throw new Error('Not connected to WhatsApp via Evolution API');
      }
      

      // Variáveis padrões do payload
      const evoPayload = {
        number: chatId,
        delay: options.delay || 0, //Math.floor(Math.random() * (1500 - 300 + 1)) + 300
        linkPreview: options.linkPreview ?? false
      };

      if(options.evoReply){
        evoPayload.quoted = options.evoReply;
      }
      if(options.mentions && options.mentions.length > 0){
        evoPayload.mentioned = options.mentions.map(s => s.split('@')[0]);
      }


      // Não usar o formato completo: `data:${content.mimetype};base64,${content.data}`
      const formattedContent = (content.data && content.data?.length > 10) ? content.data : content.url;

      // Cada tipo de mensagem tem um endpoint diferente
      let endpoint = null;
      if (typeof content === 'string') {
        endpoint = '/message/sendText';
        evoPayload.text = content;
        evoPayload.presence = "composing";

      } else if (content instanceof MessageMedia || content.isMessageMedia) {
        // Duck-typing for MessageMedia (original wwebjs or compatible like from createMedia)
        endpoint = '/message/sendMedia';
        this.logger.debug(`[sendMessage] ${endpoint}`);
        
        let mediaType = 'document';
        if (content.mimetype.includes('image')) mediaType = 'image';
        else if (content.mimetype.includes('mp4')) mediaType = 'video';
        else if (content.mimetype.includes('audio') || content.mimetype.includes('ogg')) mediaType = 'audio';

        if (options.sendMediaAsDocument){
          mediaType = 'document';
          evoPayload.fileName = content.filename || `media.${mime.extension(content.mimetype) || 'bin'}`;
        }

        if (options.sendMediaAsSticker){
          mediaType = 'sticker';
          endpoint = '/message/sendSticker';
          this.logger.debug(`[sendMessage] ${endpoint}`);
          evoPayload.sticker = formattedContent;

          if ((options.stickerAuthor || options.stickerName || options.stickerCategories)) {
              if(options.stickerName) evoPayload.pack = options.stickerName;
              if(options.stickerAuthor) evoPayload.author = options.stickerAuthor;
              if(options.stickerCategories) evoPayload.categories = options.stickerCategories;
          }
        }

        if (options.sendAudioAsVoice && mediaType === 'audio'){
          endpoint = '/message/sendWhatsAppAudio';
          evoPayload.audio = formattedContent;
          evoPayload.presence = "recording";
        } 

        if (options.sendVideoAsGif && mediaType === 'video') evoPayload.isGif = true;
        if (options.isViewOnce) evoPayload.viewOnce = true;
        evoPayload.mediatype = mediaType;
        //evoPayload.mimetype = content.mimetype;

        if(options.caption && options.caption.length > 0){
          evoPayload.caption = options.caption;
        }
        
        if(!evoPayload.sticker && !evoPayload.audio){ // sticker e audio no endpoint não usam o 'media'
          evoPayload.media = formattedContent;
        }
      } else if (content instanceof Location || content.isLocation) {
        endpoint = '/message/sendLocation';
        this.logger.debug(`[sendMessage] ${endpoint}`);

        evoPayload.latitude = content.latitude;
        evoPayload.longitude = content.longitude;
        evoPayload.name = content.description || content.name || "Localização";
      } else if (content instanceof Contact || content.isContact) {
        endpoint = '/message/sendContact';
        this.logger.debug(`[sendMessage] ${endpoint}`);
        
        evoPayload.contact = [{
            "fullName": content.name ?? content.pushname,
            "wuid": content.number,
            "phoneNumber": content.number
            // "organization": "Company Name",
            // "email": "email",
            // "url": "url page"
        }];
      } else if (content instanceof Poll || content.isPoll) {
        endpoint = '/message/sendPoll';
        this.logger.debug(`[sendMessage] ${endpoint}`);

        evoPayload.name = content.name;
        evoPayload.selectableCount = contet.options.allowMultipleAnswers ? content.pollOptions.length : 1;
        evoPayload.values = content.pollOptions;
      } else {
        this.logger.error(`[${this.id}] sendMessage: Unhandled content type for Evolution API. Content:`, content);
        throw new Error('Unhandled content type for Evolution API');
      }


      //this.logger.info(`EVO- API posting, ${endpoint}`, evoPayload);
      const response = await this.apiClient.post(endpoint, evoPayload);

      // Mimic whatsapp-web.js Message object structure for return (as much as useful)
      return {
        id: {
          _serialized: response.key?.id || `evo-msg-${this.rndString()}`,
          remote: response.key?.remoteJid || chatId,
          fromMe: true, // Sent by us
          participant: response.key?.participant // if sent to group, bot is participant
        },
        ack: this._mapEvoStatusToAck(response.status), // You'll need to map Evo's status
        body: typeof content === 'string' ? content : `[${evoPayload.mediaMessage?.mediaType || 'media'}]`,
        type: typeof content === 'string' ? 'text' : (evoPayload.mediaMessage?.mediaType || 'unknown'),
        timestamp: Math.floor(Date.now() / 1000),
        from: this.phoneNumber ? `${this.phoneNumber.replace(/\D/g, '')}@c.us` : this.instanceName, // Approximate sender
        to: chatId,
        url: (content && content.url) ? content.url : undefined, // if media sent by URL
        _data: response,
        getInfo: () => { // Usado no StreamSystem pra saber se foi enviada
          return { delivery: [1], played: [1],read: [1] };
        }
      };

    } catch (error) {
      this.logger.error(`[${this.id}] Error sending message to ${chatId} via Evolution API:`, error);
      throw error; // Re-throw for the caller (e.g., CommandHandler) to handle
    }
  }
  
  _mapEvoStatusToAck(status) {
    // Based on Evolution API documentation for message status
    // PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, ERROR: -1
    // This is a guess, check Evo docs for actual status strings/numbers
    if (!status) return 0; // Undefined or pending
    status = status.toUpperCase();
    if (status === 'SENT' || status === 'DELIVERED_TO_SERVER') return 1; // Message sent to server
    if (status === 'DELIVERED_TO_USER' || status === 'DELIVERED') return 2; // Delivered to recipient
    if (status === 'READ' || status === 'SEEN') return 3; // Read by recipient
    if (status === 'ERROR' || status === 'FAILED') return -1;
    return 0; // Default for other statuses like "PENDING"
  }

  async sendReturnMessages(returnMessages) {
    if (!Array.isArray(returnMessages)) {
      returnMessages = [returnMessages];
    }
    const validMessages = returnMessages.filter(msg => msg && msg.isValid && msg.isValid());
    if (validMessages.length === 0) {
      this.logger.warn(`[${this.id}] No valid ReturnMessages to send.`);
      return [];
    }
    const results = [];
    for (const message of validMessages) {
      if (message.delay > 0) {
        await sleep(message.delay);
      }
      
      let contentToSend = message.content;
      let options = { ...(message.options || {}) }; // Clone options

      // // If content is a file path, use createMedia to prepare it
      // if (typeof message.content === 'string' && (message.content.startsWith('./') || message.content.startsWith('/') || message.content.startsWith('C:'))) {
      //     try {
      //       // Check if it's likely a file path that exists
      //       if (fs.existsSync(message.content)) {
      //           contentToSend = await this.createMedia(message.content); // Returns { mimetype, data, filename }
      //       } else {
      //           // Treat as plain string if path doesn't exist
      //       }
      //     } catch (e) { /* ignore, treat as string */ }
      // } else if (typeof message.content === 'string' && message.content.startsWith('http')) {
      //     try {
      //       // If options suggest it's media, try to create media from URL
      //       if (options.media || options.sendMediaAsSticker || options.sendAudioAsVoice || options.sendVideoAsGif || options.sendMediaAsDocument) {
      //           contentToSend = await this.createMediaFromURL(message.content); // Returns { mimetype, url, filename }
      //       }
      //     } catch (e) { /* ignore, treat as string */ }
      // }

      try {
        const result = await this.sendMessage(message.chatId, contentToSend, options);
        results.push(result);

        if (message.reaction && result && result.id?._serialized) {
          try {
              await this.sendReaction(message.chatId, result.id._serialized, message.reaction); // Assuming result.id has the ID
          } catch (reactError) {
              this.logger.error(`[${this.id}] Failed to send reaction "${message.reaction}" to ${result.id._serialized}:`, reactError);
          }
        }
      } catch(sendError) {
        this.logger.error(`[${this.id}] Failed to send one of the ReturnMessages to ${message.chatId}:`, sendError);
        results.push({ error: sendError, messageContent: message.content }); // Push error for this message
      }
    }
    return results;
  }

  async createMedia(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
      }
      const data = fs.readFileSync(filePath, { encoding: 'base64' });
      const filename = path.basename(filePath);
      const mimetype = mime.lookup(filePath) || 'application/octet-stream';
      return { mimetype, data, filename, source: 'file', isMessageMedia: true }; // MessageMedia compatible
    } catch (error) {
      this.logger.error(`[${this.id}] Evo: Error creating media from ${filePath}:`, error);
      throw error;
    }
  }

  // Essa ode alterar pra mandar a URL e o Evolution se vira
  async createMediaFromURL(url, options = { unsafeMime: true }) {
    try {
      // For Evolution API, passing URL directly to `sendMessage` is often possible if `content.url` is used.
      const filename = path.basename(new URL(url).pathname) || 'media_from_url';
      let mimetype = mime.lookup(url.split("?")[0]) || (options.unsafeMime ? 'application/octet-stream' : null);
      
      if (!mimetype && options.unsafeMime) {
          // Try to get Content-Type header if it's a direct download
          try {
              const headResponse = await axios.head(url);
              this.logger.info("mimetype do hedaer? ", headResponse);
              mimetype = headResponse.headers['content-type']?.split(';')[0] || 'application/octet-stream';
          } catch(e) { /* ignore */ }
      }
      return { url, mimetype, filename, source: 'url', isMessageMedia: true}; // MessageMedia compatible for URL sending
    } catch (error) {
      this.logger.error(`[${this.id}] Evo: Error creating media from URL ${url}:`, error);
      throw error;
    }
  }
  
  // --- Placeholder/To be implemented based on Evo API specifics ---
  async getContactDetails(contactId) {
    if (!contactId) return null;
    try {
      const number = contactId.split("@")[0];

      let contato = this.getContactFromCache(number);
      if(contato){
        this.logger.debug(`[getContactDetails][${this.id}] Dados do cache para '${number}'`);
      } else {
        this.logger.debug(`[getContactDetails][${this.id}] Fetching contact details for: ${contactId}`);
        const profileData = await this.apiClient.post(`/chat/fetchProfile`, {number});
        if(profileData){
          contato = {
            isContact: false,
            id: { _serialized: contactId },
            name: profileData.name,
            pushname: profileData.name,
            number: number,
            isUser: true,
            status: profileData.status,
            isBusiness: profileData.isBusiness,
            picture: profileData.picture
          };

          this.putContactInCache(contato);
          return contato;
        } else {
          this.logger.debug(`[getContactDetails][${this.id}] Não consegui pegar os dados para '${number}'`);
          contato = {
            isContact: false,
            id: { _serialized: contactId },
            name: `Nome ${contactId}`,
            pushname: `Nome ${contactId}`,
            number: contactId.split('@')[0],
            isUser: true,
            status: "",
            isBusiness: false,
            picture: ""
          };
        }
      }

      return contato;
      /*
      profileData
      {
        wuid: '555596792072@s.whatsapp.net',
        name: 'moothz',
        numberExists: true,
        picture: 'https://pps.whatsapp.net/v/t61.24694-24/366408615_6228517803924212_5681812432108429726_n.jpg?ccb=11-4&oh=01_Q5Aa1gGsIN043_6xCmfA-TTP9uy_1ZSPWtWoZjCiQ1opre47HQ&oe=68458BB2&_nc_sid=5e03e0&_nc_cat=105',
        status: { status: 'mude mesas', setAt: '2019-12-07T23:02:57.000Z' },
        isBusiness: false
      }
      */
      /*
      // Aqui vem um array com todos os contatos do celular...
      this.logger.debug(`[${this.id}] Fetching contact details for: ${contactId}`);
      // Aqui vem um array com todos os contatos do celular...
      const contactsData = await this.apiClient.post(`/chat/findContacts`); // { where: {id: contactId} }
      //this.logger.debug(`[${this.id}] contactsData:`, contactsData);

      const contactData = contactsData.find(c => c.remoteJid == contactId);
      if(contactData){
        return {
          isContact: true,
          id: { _serialized: contactData.jid || contactId },
          name: contactData.pushName || contactData.name || contactData.notify, // 'name' is usually the saved name, 'notify' is pushName
          pushname: contactData.pushName || contactData.name || contactData.notify,
          number: (contactData.remoteJid || contactId).split('@')[0],
          isUser: true, // Assume
          // ... other relevant fields from Evo response
          _rawEvoContact: contactData
        };
      } else {
        return {
          isContact: false,
          id: { _serialized: contactId },
          name: `Nome ${contactId}`,
          pushname: `Nome ${contactId}`,
          number: contactId.split('@')[0],
          isUser: true
        };
      }
      */
    } catch (error) {
      this.logger.error(`[${this.id}] Failed to get contact details for ${contactId}:`, error);
      return { id: { _serialized: contactId }, name: contactId.split('@')[0], pushname: contactId.split('@')[0], number: contactId.split('@')[0], isUser: true, _isPartial: true }; // Basic fallback
    }
  }

  acceptInviteCode(inviteCode){
    return new Promise(async (resolve, reject) => {
      try{
        this.logger.debug(`[acceptInviteCode][${this.instanceName}] '${inviteCode}'`);
        const resp = await this.apiClient.get(`/group/acceptInviteCode`, { inviteCode });

        resolve(resp.accepted);
      } catch(e){
        this.logger.warn(`[acceptInviteCode] Erro pegando invite info para '${inviteCode}'`);
        reject(e);
      }

    });
  }

  inviteInfo(inviteCode){
    return new Promise(async (resolve, reject) => {
      try{
        this.logger.debug(`[inviteInfo][${this.instanceName}] '${inviteCode}'`);
        const inviteInfo = await this.apiClient.get(`/group/inviteInfo`, { inviteCode });
        this.logger.info(`[inviteInfo] '${inviteCode}': ${JSON.stringify(inviteInfo)}`);

        resolve(inviteInfo);
      } catch(e){
        this.logger.warn(`[inviteInfo] Erro pegando invite info para '${inviteCode}'`);
        reject(e);
      }

    });
  }

  leaveGroup(groupJid){
    try{
      this.logger.debug(`[leaveGroup][${this.instanceName}] '${groupJid}'`);
      this.apiClient.delete(`/group/leaveGroup`, { groupJid });
    } catch(e){
      this.logger.warn(`[leaveGroup] Erro saindo do grupo '${groupJid}'`, e);
    }
  }

  updateProfilePicture(url){
    try{
      this.logger.debug(`[updateProfilePicture][${this.instanceName}] '${url}'`);
      this.apiClient.post(`/chat/updateProfilePicture`, { picture: url });
    } catch(e){
      this.logger.warn(`[updateProfilePicture] Erro trocando imagem '${url}'`, e);
    }
  }

  updateProfileStatus(status){
    try{
      this.logger.debug(`[updateProfileStatus][${this.instanceName}] '${status}'`);
      this.apiClient.post(`/chat/updateProfileStatus`, { status });
    } catch(e){
      this.logger.warn(`[updateProfileStatus] Erro definindo status '${status}'`, status);
    }
  }
  async getChatDetails(chatId) {
    /*
{
  "id": "120363295648424210@g.us",
  "subject": "Example Group",
  "subjectOwner": "553198296801@s.whatsapp.net",
  "subjectTime": 1714769954,
  "pictureUrl": null,
  "size": 1,
  "creation": 1714769954,
  "owner": "553198296801@s.whatsapp.net",
  "desc": "optional",
  "descId": "BAE57E16498982ED",
  "restrict": false,
  "announce": false,
  "participants": [
    {
      "id": "553198296801@s.whatsapp.net",
      "admin": "superadmin"
    }
  ]
}
    */
    if (!chatId) return null;
    try {
      this.logger.debug(`[${this.id}] Fetching chat details for: ${chatId}`);
      if (chatId.endsWith('@g.us')) {
        const groupData = await this.apiClient.get(`/group/findGroupInfos`, { groupJid: chatId });
        //this.logger.debug(`[${this.id}] groupInfos:`, groupData);

        return {
          setSubject: async (title) => {
            return await this.apiClient.post(`/group/updateGroupSubject`, { groupJid: chatId, subject: title });
          },
          id: { _serialized: groupData.id || chatId },
          name: groupData.subject,
          isGroup: true,
          participants: groupData.participants.map(p => {
            return {
              id: { _serialized: p.id.split("@")[0]+"@c.us" },
              isAdmin: p.admin?.includes("admin") ?? false
            }
          }), // Structure this as needed
          // ... other group fields like description (subjectOwner, etc.)
          _rawEvoGroup: groupData
        };
      } else { // User chat
        // For user chats, often there isn't a separate "chat" object beyond the contact
        const contact = await this.getContactDetails(chatId);
        return {
          isContact: true,
          id: { _serialized: chatId },
          name: contact.name || contact.pushname,
          isGroup: false,
          // ...
          _rawEvoContactForChat: contact // if needed
        };
      }
    } catch (error) {
      this.logger.error(`[${this.id}] Failed to get chat details for ${chatId}:`, error);
      return { id: { _serialized: chatId }, name: chatId.split('@')[0], isGroup: chatId.endsWith('@g.us'), _isPartial: true }; // Basic fallback
    }
  }

  
  async deleteMessageByKey(key){
      if (!key) {
          this.logger.error(`[${this.id}] Invalid messageKey for deletion. ${key}`);
          return false;
      }

      this.logger.info(`[${this.id}][deleteMessage] Requesting deletion of message ${JSON.stringify(key)}`);
      try {
        return this.apiClient.delete("/chat/deleteMessageForEveryone", { ...key  });
      } catch (error) {
        this.logger.error(`[${this.id}][deleteMessage] Failed to delete message ${JSON.stringify(key)}:`, error);
        return false;
      }
  }

  async sendReaction(chatId, messageId, reaction) {
      // reaction can be an emoji string e.g. "👍" or "" to remove
      if (!this.isConnected) {
          this.logger.warn(`[${this.id}] Cannot send reaction, not connected.`);
          return;
      }
      this.logger.debug(`[${this.id}] Sending reaction '"${reaction}"' to message ${messageId} in chat ${chatId}`);
      try {
          const payload = {
                key: { remoteJid: chatId, id: messageId, fromMe: false }, 
                reaction: reaction
          };
          await this.apiClient.post(`/message/sendReaction`, payload);
          return true;
      } catch (error) {
          this.logger.error(`[${this.id}] Failed to send reaction:`, error);
          return false;
      }
  }

  async _handleGroupParticipantsUpdate(groupUpdateData) {
    const groupId = groupUpdateData.id;
    const action = groupUpdateData.action;
    const participants = groupUpdateData.participants; // Array of JIDs

    try {
        const groupDetails = await this.getChatDetails(groupId); // To get group name
        const responsibleContact = await this.getContactDetails(groupUpdateData.author) ?? {id: groupUpdateData.author.split("@")[0]+"@c.us", name: "Admin do Grupo"};
        for (const userId of participants) {
            const userContact = await this.getContactDetails(userId);
            const eventData = {
                group: { id: groupId, name: groupDetails?.name || groupId },
                user: { id: userId.split('@')[0]+"@c.us", name: userContact?.name || userId.split('@')[0] },
                responsavel: { id: responsibleContact.id?._serialized, name: responsibleContact.name || 'Sistema' },
                origin: { 
                    ...groupUpdateData, // Raw data from webhook related to this specific update
                    getChat: async () => await this.getChatDetails(groupId)
                } 
            };

            if (action === 'add') {
                if (this.eventHandler && typeof this.eventHandler.onGroupJoin === 'function') {
                    this.eventHandler.onGroupJoin(this, eventData);
                }
            } else if (action === 'remove' || action === 'leave') { // 'leave' might be self-leave
                if (this.eventHandler && typeof this.eventHandler.onGroupLeave === 'function') {
                    this.eventHandler.onGroupLeave(this, eventData);
                }
            }
        }
    } catch (error) {
        this.logger.error(`[${this.id}] Error processing group participant update:`, error, groupUpdateData);
    }
  }

  async isUserAdminInGroup(userId, groupId) {
    /*
{
  "participants": [
    {
      "id": "553198296801@s.whatsapp.net",
      "admin": "superadmin"
    }
  ]
}
    */
    if (!userId || !groupId) return false;
    try {
      const response = await this.apiClient.get(`/group/participants`, { groupJid: groupId });
      const member = response.participants.find(m => m.id.split("@")[0] === userId.split("@")[0]);
      if(member){
        const isAdmin = (member.admin ?? "").includes("admin");
        return isAdmin;
      }

      return false;
    } catch (error) {
      this.logger.error(`[${this.id}] Error checking admin status for ${userId} in ${groupId}:`, error);
      return false;
    }
  }

  async fetchAndPrepareBlockedContacts() {
    // Evolution API does not list a direct "get all blocked contacts" endpoint in the provided link.
    // It has /contacts/blockUnblock. This functionality might be limited or require different handling.
    this.blockedContacts = []; // Reset
    this.logger.info(`[${this.id}] Blocked contacts list management needs verification with Evolution API capabilities.`);
    // If an endpoint is found, implement fetching here. Example:
    // try {
    //   const blockedList = await this.apiClient.get(`/contacts/blockedlist`); // Hypothetical
    //   this.blockedContacts = blockedList.map(jid => ({ id: { _serialized: jid } }));
    // } catch (e) { this.logger.warn('Could not fetch blocked contacts.'); }
    this.prepareOtherBotsBlockList(); // From original bot
  }

  async _loadDonationsToWhitelist() {
    // From original bot, should work as is if database methods are stable
    try {
        const donations = await this.database.getDonations();
        for(let don of donations){
            if(don.numero && don.numero?.length > 5){
            this.whitelist.push(don.numero.replace(/\D/g, ''));
            }
        }
        this.logger.info(`[${this.id}] [whitelist] ${this.whitelist.length} números na whitelist do PV.`);
    } catch (error) {
        this.logger.error(`[${this.id}] Error loading donations to whitelist:`, error);
    }
  }

  async _sendStartupNotifications() {
    // From original bot
    if (!this.isConnected) return;
    if (this.grupoLogs) {
      try {
        await this.sendMessage(this.grupoLogs, `🤖 Bot ${this.id} (Evo) inicializado com sucesso em ${new Date().toLocaleString("pt-BR")}`);
      } catch (error) { this.logger.error(`[${this.id}] Error sending startup notification to grupoLogs:`, error); }
    }
    if (this.grupoAvisos) {
      try {
        // const startMessage = `🟢 [${this.phoneNumber.slice(2,4)}] *${this.id}* (Evo) tá _on_! (${new Date().toLocaleString("pt-BR")})`;
        // await this.sendMessage(this.grupoAvisos, startMessage); // Original was commented out
      } catch (error) { this.logger.error(`[${this.id}] Error sending startup notification to grupoAvisos:`, error); }
    }
  }
  
  // --- Utility methods from original bot that should largely remain compatible ---
  notInWhitelist(author){ // author is expected to be a JID string
    const cleanAuthor = author.replace(/\D/g, ''); // Cleans non-digits from JID user part
    return !(this.whitelist.includes(cleanAuthor))
  }

  rndString(){
    return (Math.random() + 1).toString(36).substring(7);
  }
  
  prepareOtherBotsBlockList() {
    if (!this.otherBots || !this.otherBots.length) return;
    if (!this.blockedContacts || !Array.isArray(this.blockedContacts)) {
      this.blockedContacts = [];
    }
    for (const bot of this.otherBots) { // Assuming otherBots is an array of JID-like strings or bot IDs
      const botId = bot.endsWith("@c.us") || bot.endsWith("@s.whatsapp.net") ? bot : `${bot}@c.us`; // Basic normalization
      if (!this.blockedContacts.some(c => c.id._serialized === botId)) {
        this.blockedContacts.push({
          id: { _serialized: botId },
          name: `Other Bot: ${bot}` // Or some identifier
        });
        this.logger.info(`[${this.id}] Added other bot '${botId}' to internal ignore list.`);
      }
    }
    this.logger.info(`[${this.id}] Ignored contacts/bots list size: ${this.blockedContacts.length}`);
  }

  shouldDiscardMessage() {
    const timeSinceStartup = Date.now() - this.startupTime;
    return timeSinceStartup < (parseInt(process.env.DISCARD_MSG_STARTUP_SECONDS) || 5) * 1000; // 5 seconds default
  }

  getCurrentTimestamp(){
    return Math.round(Date.now()/1000);
  }
  
  async destroy() {
    this.logger.info(`[${this.id}] Destroying Evolution API bot instance ${this.id} (Evo Instance: ${this.instanceName})`);
    if (this.webhookServer) {
      this.webhookServer.close(() => this.logger.info(`[${this.id}] Webhook server closed.`));
    }
    this._onInstanceDisconnected('DESTROYED'); // Mark as disconnected internally
    try {
      //await this.apiClient.post(`/instance/logout`); // Logout the instance
      //this.logger.info(`[${this.id}] Instance ${this.instanceName} logout requested.`);
    } catch (error) {
      this.logger.error(`[${this.id}] Error logging out instance ${this.instanceName}:`, error);
    }
    if (this.loadReport) this.loadReport.destroy();
    // Clean up other resources if necessary
  }

  async restartBot(reason = 'Restart requested') {
    this.logger.info(`[${this.id}] Restarting Evo bot ${this.id}. Reason: ${reason}`);
    if (this.grupoAvisos && this.isConnected) {
        try {
            await this.sendMessage(this.grupoAvisos, `🔄 Bot ${this.id} (Evo) reiniciando. Motivo: ${reason}`);
            await sleep(2000);
        } catch (e) { this.logger.warn(`[${this.id}] Could not send restart notification during restart:`, e.message); }
    }
    
    // Simplified destroy for restart (don't fully logout instance if it's a soft restart)
    if (this.webhookServer) {
      this.webhookServer.close();
      this.webhookServer = null;
    }
    this._onInstanceDisconnected('RESTARTING');
    if (this.loadReport) this.loadReport.destroy();
    // if (this.streamSystem) this.streamSystem.destroy(); this.streamSystem = null;

    this.logger.info(`[${this.id}] Bot resources partially cleared, attempting re-initialization...`);
    await sleep(2000);
    
    try {
      await this.initialize(); // Re-run the initialization process
      this.logger.info(`[${this.id}] Bot ${this.id} (Evo) re-initialization process started.`);
      // Success notification will be handled by _onInstanceConnected -> _sendStartupNotifications if grupoAvisos configured
    } catch (error) {
      this.logger.error(`[${this.id}] CRITICAL ERROR during bot restart:`, error);
      if (this.grupoLogs) {
        try {
          // Attempt to send error even if disconnected (might fail)
          await this.apiClient.post(`/message/sendText`, {
            number: this.grupoLogs,
            text: `❌ Falha CRÍTICA ao reiniciar bot ${this.id} (Evo). Erro: ${error.message}`
          }).catch(e => this.logger.error("Failed to send critical restart error to logs:", e.message));
        } catch (e) { /* ignore */ }
      }
    }
  }

  // Mock for createContact for now, as it's complex and depends on how EventHandler uses it
  async createContact(phoneNumber, name, surname) {
    this.logger.warn(`[${this.id}] WhatsAppBotEvo.createContact is a mock. Fetching real contact instead.`);
    const formattedNumber = phoneNumber.endsWith('@c.us') 
        ? phoneNumber 
        : `${phoneNumber.replace(/\D/g, '')}@c.us`;
    return await this.getContactDetails(formattedNumber);
  }

}

module.exports = WhatsAppBotEvo;