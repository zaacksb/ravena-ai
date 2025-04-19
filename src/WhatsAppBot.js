const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Database = require('./utils/Database');
const Logger = require('./utils/Logger');
const path = require('path');
const fs = require('fs');
const LoadReport = require('./LoadReport');
const ReactionsHandler = require('./ReactionsHandler');
const MentionHandler = require('./MentionHandler');
const InviteSystem = require('./InviteSystem');
const StreamSystem = require('./StreamSystem');
const LLMService = require('./services/LLMService');
const { processListReaction } = require('./functions/ListCommands');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

class WhatsAppBot {
  /**
   * Cria uma nova instância de bot WhatsApp
   * @param {Object} options - Opções de configuração
   * @param {string} options.id - Identificador único para esta instância de bot
   * @param {string} options.phoneNumber - Número de telefone para solicitar código de pareamento
   * @param {Object} options.eventHandler - Instância do manipulador de eventos
   * @param {string} options.prefix - Prefixo de comando (padrão: '!')
   * @param {Object} options.puppeteerOptions - Opções para o puppeteer
   */
  constructor(options) {
    this.id = options.id;
    this.phoneNumber = options.phoneNumber;
    this.eventHandler = options.eventHandler;
    this.prefix = options.prefix || process.env.DEFAULT_PREFIX || '!';
    this.logger = new Logger(`bot-${this.id}`);
    this.client = null;
    this.database = Database.getInstance(); // Instância de banco de dados compartilhada
    this.isConnected = false;
    this.safeMode = options.safeMode !== undefined ? options.safeMode : (process.env.SAFE_MODE === 'true');
    this.puppeteerOptions = options.puppeteerOptions || {};
    
    // Novas propriedades para notificações de grupos da comunidade
    this.grupoLogs = options.grupoLogs || process.env.GRUPO_LOGS;
    this.grupoInvites = options.grupoInvites || process.env.GRUPO_INVITES;
    this.grupoAvisos = options.grupoAvisos || process.env.GRUPO_AVISOS;
    this.grupoInteracao = options.grupoInteracao || process.env.GRUPO_INTERACAO;
    
    // Inicializa rastreador de relatórios de carga
    this.loadReport = new LoadReport(this);
    
    // Inicializa sistema de convites
    this.inviteSystem = new InviteSystem(this);
    
    // Inicializa manipulador de menções
    this.mentionHandler = new MentionHandler();

    // Inicializa manipulador de reações
    this.reactionHandler = new ReactionsHandler();

    // Inicializa StreamSystem
    this.streamSystem = null;
    
    this.llmService = new LLMService({});

    this.sessionDir = path.join(__dirname, '..', '.wwebjs_auth', this.id);
  }

  /**
   * Inicializa o cliente WhatsApp
   */
  async initialize() {
    this.logger.info(`Inicializando instância de bot ${this.id}`);

    // Cria cliente com dados de sessão
    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: this.id }),
      puppeteer: this.puppeteerOptions
    });

    // Registra manipuladores de eventos
    this.registerEventHandlers();

    // Inicializa cliente
    await this.client.initialize();
    
    this.logger.info(`Bot ${this.id} inicializado`);
    await sleep(5000);

    // Envia notificação de inicialização para o grupo de logs
    if (this.grupoLogs && this.isConnected) {
      try {
        const startMessage = `🤖 Bot ${this.id} inicializado com sucesso em ${new Date().toLocaleString()}`;
        await this.sendMessage(this.grupoLogs, startMessage);
      } catch (error) {
        this.logger.error('Erro ao enviar notificação de inicialização:', error);
      }
    }
    
    return this;
  }

  /**
   * Registra manipuladores de eventos para o cliente WhatsApp
   */
  registerEventHandlers() {
    // Evento de QR Code
    this.client.on('qr', (qr) => {
      this.logger.info('QR Code recebido, escaneie para autenticar');
      qrcode.generate(qr, { small: true });
    });

    // Evento de pronto
    this.client.on('ready', async () => {
      this.isConnected = true;
      this.logger.info('Cliente está pronto');
      this.eventHandler.onConnected(this);

      this.streamSystem = new StreamSystem(this);
      await this.streamSystem.initialize();
      this.streamMonitor = this.streamSystem.streamMonitor;

    });

    // Evento de autenticado
    this.client.on('authenticated', () => {
      this.logger.info('Cliente autenticado');
    });

    // Evento de falha de autenticação
    this.client.on('auth_failure', (msg) => {
      this.isConnected = false;
      this.logger.error('Falha de autenticação:', msg);
    });

    // Evento de desconectado
    this.client.on('disconnected', (reason) => {
      this.isConnected = false;
      this.logger.info('Cliente desconectado:', reason);
      this.eventHandler.onDisconnected(this, reason);
    });

    // Evento de mensagem
    this.client.on('message', async (message) => {
      try {
        // Formata mensagem para o manipulador de eventos
        const formattedMessage = await this.formatMessage(message);
        this.eventHandler.onMessage(this, formattedMessage);
      } catch (error) {
        this.logger.error('Erro ao processar mensagem:', error);
      }
    });

    // Evento de reação
    this.client.on('message_reaction', async (reaction) => {
      try {
        // Processa apenas reações de outros usuários, não do próprio bot
        if (reaction.senderId !== this.client.info.wid._serialized) {
          // Será que é uma reaction de lista?
          const isListReaction = await processListReaction(this, reaction);
          
          // Se não for de lista, processa o normal
          if (!isListReaction) {
            await this.reactionHandler.processReaction(this, reaction);
          }
        }
      } catch (error) {
        this.logger.error('Erro ao tratar reação de mensagem:', error);
      }
    });

    // Evento de entrada no grupo
    this.client.on('group_join', async (notification) => {
      try {
        const group = await notification.getChat();
        const users = await notification.getRecipients();
        const responsavel = await notification.getContact();

        if(users){
          for(let user of users){
            this.eventHandler.onGroupJoin(this, {
              group: {
                id: group.id._serialized,
                name: group.name
              },
              user: {
                id: user.id._serialized,
                name: user.pushname || 'Desconhecido'
              },
              responsavel: {
                id: responsavel.id._serialized,
                name: responsavel.pushname || 'Desconhecido'
              },
              origin: notification
            });
          }
        }
      } catch (error) {
        this.logger.error('Erro ao processar entrada no grupo:', error);
      }
    });

    // Evento de saída do grupo
    this.client.on('group_leave', async (notification) => {
      try {
        const group = await notification.getChat();
        const users = await notification.getRecipients();
        const responsavel = await notification.getContact();

        if(users){
          for(let user of users){
            this.eventHandler.onGroupLeave(this, {
              group: {
                id: group.id._serialized,
                name: group.name
              },
              user: {
                id: user.id._serialized,
                name: user.pushname || 'Desconhecido'
              },
              responsavel: {
                id: responsavel.id._serialized,
                name: responsavel.pushname || 'Desconhecido'
              },
              origin: notification
            });
          }
        }
      } catch (error) {
        this.logger.error('Erro ao processar saída do grupo:', error);
      }
    });

    // Evento de notificação geral
    this.client.on('notification', (notification) => {
      this.eventHandler.onNotification(this, notification);
    });
  }

  /**
   * Formata uma mensagem do WhatsApp para nosso formato padrão
   * @param {Object} message - A mensagem bruta do whatsapp-web.js
   * @returns {Promise<Object>} - Objeto de mensagem formatado
   */
  async formatMessage(message) {
    try {
      const chat = await message.getChat();
      const sender = await message.getContact();
      const isGroup = chat.isGroup;
      
      // Rastreia mensagem recebida
      this.loadReport.trackReceivedMessage(isGroup);
      
      let type = 'text';
      let content = message.body;
      let caption = null;
      
      // Determina tipo de mensagem e conteúdo
      if (message.hasMedia) {
        const media = await message.downloadMedia();
        type = media.mimetype.split('/')[0]; // imagem, vídeo, áudio, etc.
        content = media;
        caption = message.body;
      } else if (message.type === 'sticker') {
        type = 'sticker';
        content = await message.downloadMedia();
      }
      
      return {
        group: isGroup ? chat.id._serialized : null,
        author: sender.id._serialized,
        type,
        content,
        caption,
        origin: message
      };
    } catch (error) {
      this.logger.error('Erro ao formatar mensagem:', error);
      throw error;
    }
  }

  /**
   * Envia uma mensagem para um chat
   * @param {string} chatId - O ID do chat para enviar a mensagem
   * @param {string|Object} content - O conteúdo a enviar (texto ou mídia)
   * @param {Object} options - Opções adicionais
   * @returns {Promise<Object>} - A mensagem enviada
   */
  async sendMessage(chatId, content, options = {}) {
    try {
      // Rastreia mensagem enviada
      const isGroup = chatId.endsWith('@g.us');
      this.loadReport.trackSentMessage(isGroup);

      // Opções padrão
      if(!options.linkPreview){
        options.linkPreview = false;
      }
      
      // Verifica se está em modo seguro
      if (this.safeMode) {
        this.logger.info(`[MODO SEGURO] Enviaria para ${chatId}: ${typeof content === 'string' ? content : '[Mídia]'}`);
        return { id: { _serialized: 'safe-mode-msg-id' } };
      }

      if (typeof content === 'string') {
        return await this.client.sendMessage(chatId, content, options);
      } else if (content instanceof MessageMedia) {
        return await this.client.sendMessage(chatId, content, {
          caption: options.caption,
          sendMediaAsSticker: options.asSticker || false,
          ...options
        });
      }
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem para ${chatId}:`, error);
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

        // Apply reactions if specified
        if (message.reactions && result) {
          try {
            // React with 'before' emoji if specified
            if (message.reactions.before) {
              await result.react(message.reactions.before);
            }

            // Store message ID for potential future reactions
            if (message.metadata) {
              message.metadata.messageId = result.id._serialized;
            }
          } catch (reactError) {
            this.logger.error('Error applying reaction to message:', reactError);
          }
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
   * Cria um objeto de mídia a partir de um caminho de arquivo
   * @param {string} filePath - Caminho para o arquivo de mídia
   * @returns {Promise<MessageMedia>} - O objeto de mídia
   */
  async createMedia(filePath) {
    try {
      return MessageMedia.fromFilePath(filePath);
    } catch (error) {
      this.logger.error(`Erro ao criar mídia de ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Loads channels from all groups to the StreamMonitor
   */
  async loadChannelsToMonitor() {
    try {
      // Get all groups
      const groups = await this.database.getGroups();
      
      let subscribedChannels = {
        twitch: [],
        kick: [],
        youtube: []
      };
      
      // Process each group
      for (const group of groups) {
        // Add Twitch channels
        if (group.twitch && Array.isArray(group.twitch)) {
          for (const channel of group.twitch) {
            if (!subscribedChannels.twitch.includes(channel.channel)) {
              this.streamMonitor.subscribe(channel.channel, 'twitch');
              subscribedChannels.twitch.push(channel.channel);
            }
          }
        }
        
        // Add Kick channels
        if (group.kick && Array.isArray(group.kick)) {
          for (const channel of group.kick) {
            if (!subscribedChannels.kick.includes(channel.channel)) {
              this.streamMonitor.subscribe(channel.channel, 'kick');
              subscribedChannels.kick.push(channel.channel);
            }
          }
        }
        
        // Add YouTube channels
        if (group.youtube && Array.isArray(group.youtube)) {
          for (const channel of group.youtube) {
            if (!subscribedChannels.youtube.includes(channel.channel)) {
              this.streamMonitor.subscribe(channel.channel, 'youtube');
              subscribedChannels.youtube.push(channel.channel);
            }
          }
        }
      }
      
      this.logger.info(`Loaded ${subscribedChannels.twitch.length} Twitch, ${subscribedChannels.kick.length} Kick, and ${subscribedChannels.youtube.length} YouTube channels to monitor`);
    } catch (error) {
      this.logger.error('Error loading channels to monitor:', error);
    }
  }

  /**
   * Handles a stream going online
   * @param {Object} data - Event data
   */
  async handleStreamOnline(data) {
    try {
      this.logger.info(`Stream online event: ${data.platform}/${data.channelName}`);
      
      // Get all groups
      const groups = await this.database.getGroups();
      
      // Find groups that monitor this channel
      for (const groupData of groups) {
        // Skip if group doesn't monitor this platform
        if (!groupData[data.platform]) continue;
        
        // Find the channel configuration in this group
        const channelConfig = groupData[data.platform].find(
          c => c.channel.toLowerCase() === data.channelName.toLowerCase()
        );
        
        if (!channelConfig) continue;
        
        // Process notification for this group
        await this.processStreamEvent(groupData, channelConfig, data, 'online');
      }
    } catch (error) {
      this.logger.error('Error handling stream online event:', error);
    }
  }

  /**
   * Handles a stream going offline
   * @param {Object} data - Event data
   */
  async handleStreamOffline(data) {
    try {
      this.logger.info(`Stream offline event: ${data.platform}/${data.channelName}`);
      
      // Get all groups
      const groups = await this.database.getGroups();
      
      // Find groups that monitor this channel
      for (const groupData of groups) {
        // Skip if group doesn't monitor this platform
        if (!groupData[data.platform]) continue;
        
        // Find the channel configuration in this group
        const channelConfig = groupData[data.platform].find(
          c => c.channel.toLowerCase() === data.channelName.toLowerCase()
        );
        
        if (!channelConfig) continue;
        
        // Process notification for this group
        await this.processStreamEvent(groupData, channelConfig, data, 'offline');
      }
    } catch (error) {
      this.logger.error('Error handling stream offline event:', error);
    }
  }

  /**
   * Handles a new YouTube video
   * @param {Object} data - Event data
   */
  async handleNewVideo(data) {
    try {
      this.logger.info(`New video event: ${data.channelName}, title: ${data.title}`);
      
      // Get all groups
      const groups = await this.database.getGroups();
      
      // Find groups that monitor this channel
      for (const groupData of groups) {
        // Skip if group doesn't monitor YouTube
        if (!groupData.youtube) continue;
        
        // Find the channel configuration in this group
        const channelConfig = groupData.youtube.find(
          c => c.channel.toLowerCase() === data.channelName.toLowerCase()
        );
        
        if (!channelConfig) continue;
        
        // Process notification for this group (as "online" event for consistency)
        await this.processStreamEvent(groupData, channelConfig, data, 'online');
      }
    } catch (error) {
      this.logger.error('Error handling new video event:', error);
    }
  }

  /**
   * Processes a stream event notification for a group
   * @param {Object} group - Group data
   * @param {Object} channelConfig - Channel configuration
   * @param {Object} eventData - Event data
   * @param {string} eventType - Event type ('online' or 'offline')
   */
  async processStreamEvent(group, channelConfig, eventData, eventType) {
    try {
      // Get the appropriate config (onConfig for online events, offConfig for offline)
      const config = eventType === 'online' ? channelConfig.onConfig : channelConfig.offConfig;
      
      // Skip if no configuration
      if (!config || !config.media || config.media.length === 0) {
        return;
      }
      
      // Process title change if enabled
      if (channelConfig.changeTitleOnEvent) {
        await this.changeGroupTitle(group, channelConfig, eventData, eventType);
      }
      
      // Process media notifications
      for (const mediaItem of config.media) {
        await this.sendEventNotification(group.id, mediaItem, eventData, channelConfig);
      }
      
      // Generate AI message if enabled
      if (channelConfig.useAI && eventType === 'online') {
        await this.sendAINotification(group.id, eventData, channelConfig);
      }
    } catch (error) {
      this.logger.error(`Error processing stream event for ${group.id}:`, error);
    }
  }

  /**
   * Changes the group title based on stream event
   * @param {Object} group - Group data
   * @param {Object} channelConfig - Channel configuration
   * @param {Object} eventData - Event data
   * @param {string} eventType - Event type ('online' or 'offline')
   */
  async changeGroupTitle(group, channelConfig, eventData, eventType) {
    try {
      // Get the current group chat
      const chat = await this.client.getChatById(group.id);
      if (!chat || !chat.isGroup) return;
      
      let newTitle;
      
      // If custom title is defined, use it
      if (eventType === 'online' && channelConfig.onlineTitle) {
        newTitle = channelConfig.onlineTitle;
      } else if (eventType === 'offline' && channelConfig.offlineTitle) {
        newTitle = channelConfig.offlineTitle;
      } else {
        // Otherwise, modify the existing title
        newTitle = chat.name;
        
        // Replace "OFF" with "ON" or vice versa
        if (eventType === 'online') {
          newTitle = newTitle.replace(/\bOFF\b/g, 'ON');
        } else {
          newTitle = newTitle.replace(/\bON\b/g, 'OFF');
        }
        
        // Replace emojis
        const emojiMap = {
          '🔴': '🟢',
          '🟢': '🔴',
          '❤️': '💚',
          '💚': '❤️',
          '🌹': '🍏',
          '🍏': '🌹',
          '🟥': '🟩',
          '🟩': '🟥'
        };
        
        // If it's an offline event, swap the keys and values
        const finalEmojiMap = eventType === 'online' ? emojiMap : 
          Object.fromEntries(Object.entries(emojiMap).map(([k, v]) => [v, k]));
        
        // Replace emojis
        for (const [from, to] of Object.entries(finalEmojiMap)) {
          newTitle = newTitle.replace(new RegExp(from, 'g'), to);
        }
      }
      
      // Set the new title
      await chat.setSubject(newTitle);
      
      this.logger.info(`Changed group ${group.id} title to: ${newTitle}`);
    } catch (error) {
      this.logger.error(`Error changing group title for ${group.id}:`, error);
    }
  }

  /**
   * Sends event notification to a group
   * @param {string} groupId - Group ID
   * @param {Object} mediaItem - Media configuration
   * @param {Object} eventData - Event data
   * @param {Object} channelConfig - Channel configuration
   */
  async sendEventNotification(groupId, mediaItem, eventData, channelConfig) {
    try {
      // Handle different media types
      if (mediaItem.type === 'text') {
        // Process variables in the text
        let content = mediaItem.content;
        
        // Replace platform-specific variables
        if (eventData.platform === 'twitch' || eventData.platform === 'kick') {
          content = content.replace(/{nomeCanal}/g, eventData.channelName)
                          .replace(/{titulo}/g, eventData.title || '')
                          .replace(/{jogo}/g, eventData.game || 'Unknown');
        } else if (eventData.platform === 'youtube') {
          content = content.replace(/{author}/g, eventData.author || eventData.channelName)
                          .replace(/{title}/g, eventData.title || '')
                          .replace(/{link}/g, eventData.url || '');
        }
        
        // Send the message
        await this.sendMessage(groupId, content);
      } else if (mediaItem.type === 'image' || mediaItem.type === 'video' || 
                mediaItem.type === 'audio' || mediaItem.type === 'sticker') {
        // Load media file
        const mediaPath = path.join(this.dataPath, 'media', mediaItem.content);
        
        try {
          const media = await this.createMedia(mediaPath);
          
          // Process caption variables
          let caption = mediaItem.caption || '';
          
          // Replace platform-specific variables (same as text)
          if (eventData.platform === 'twitch' || eventData.platform === 'kick') {
            caption = caption.replace(/{nomeCanal}/g, eventData.channelName)
                            .replace(/{titulo}/g, eventData.title || '')
                            .replace(/{jogo}/g, eventData.game || 'Unknown');
          } else if (eventData.platform === 'youtube') {
            caption = caption.replace(/{author}/g, eventData.author || eventData.channelName)
                            .replace(/{title}/g, eventData.title || '')
                            .replace(/{link}/g, eventData.url || '');
          }
          
          // Send the media
          await this.sendMessage(groupId, media, {
            caption: caption || undefined,
            sendMediaAsSticker: mediaItem.type === 'sticker'
          });
        } catch (error) {
          this.logger.error(`Error sending media notification (${mediaPath}):`, error);
          
          // Fallback to text message
          await this.sendMessage(groupId, `Erro ao enviar notificação de mídia para evento de ${eventData.platform}/${eventData.channelName}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error sending event notification to ${groupId}:`, error);
    }
  }

  /**
   * Sends AI generated notification
   * @param {string} groupId - Group ID
   * @param {Object} eventData - Event data
   * @param {Object} channelConfig - Channel configuration
   */
  async sendAINotification(groupId, eventData, channelConfig) {
    try {
      // Generate prompt based on event type
      let prompt = '';
      
      if (eventData.platform === 'twitch' || eventData.platform === 'kick') {
        prompt = `O canal ${eventData.channelName} ficou online e está jogando ${eventData.game || 'um jogo'} com o título "${eventData.title || ''}". Gere uma mensagem animada para convidar a galera do grupo a participar da stream.`;
      } else if (eventData.platform === 'youtube') {
        prompt = `O canal ${eventData.channelName} acabou de lançar um novo vídeo chamado "${eventData.title || ''}". Gere uma mensagem animada para convidar a galera do grupo a assistir o vídeo.`;
      }
      
      // Get AI response
      const aiResponse = await this.llmService.getCompletion({
        prompt: prompt,
        provider: 'openrouter',
        temperature: 0.7,
        maxTokens: 200
      });
      
      // Send the AI-generated message
      if (aiResponse) {
        await this.sendMessage(groupId, aiResponse);
      }
    } catch (error) {
      this.logger.error(`Error sending AI notification to ${groupId}:`, error);
    }
  }

  /**
   * Destrói o cliente WhatsApp
   */
  async destroy() {
    this.logger.info(`Destruindo instância de bot ${this.id}`);
    
    // Limpa loadReport
    if (this.loadReport) {
      this.loadReport.destroy();
    }
    
    // Limpa sistema de convites
    if (this.inviteSystem) {
      this.inviteSystem.destroy();
    }

    // Limpa StreamMonitor
    if (this.streamMonitor) {
      this.streamMonitor.stopMonitoring();
      this.streamMonitor = null;
    }
    
    // Envia notificação de desligamento para o grupo de logs
    if (this.grupoLogs && this.isConnected) {
      try {
        const shutdownMessage = `🔌 Bot ${this.id} desligando em ${new Date().toLocaleString()}`;
        await this.sendMessage(this.grupoLogs, shutdownMessage);
      } catch (error) {
        this.logger.error('Erro ao enviar notificação de desligamento:', error);
      }
    }

    await sleep(5000);
    
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.isConnected = false;
    }
  }


}

module.exports = WhatsAppBot;