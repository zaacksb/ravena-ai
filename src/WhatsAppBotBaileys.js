const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore, downloadContentFromMessage } = require('baileys');
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
const { Boom } = require('@hapi/boom');
const pino = require('pino');

class WhatsAppBot {
  /**
   * Cria uma nova instância de bot WhatsApp
   * @param {Object} options - Opções de configuração
   * @param {string} options.id - Identificador único para esta instância de bot
   * @param {string} options.phoneNumber - Número de telefone para solicitar código de pareamento
   * @param {Object} options.eventHandler - Instância do manipulador de eventos
   * @param {string} options.prefix - Prefixo de comando (padrão: '!')
   * @param {Object} options.baileysOptions - Opções para o Baileys
   */
  constructor(options) {
    this.id = options.id;
    this.phoneNumber = options.phoneNumber;
    this.eventHandler = options.eventHandler;
    this.prefix = options.prefix || process.env.DEFAULT_PREFIX || '!';
    this.logger = new Logger(`bot-${this.id}`);
    this.socket = null;
    this.store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
    this.database = Database.getInstance(); // Instância de banco de dados compartilhada
    this.isConnected = false;
    this.safeMode = options.safeMode !== undefined ? options.safeMode : (process.env.SAFE_MODE === 'true');
    this.baileysOptions = options.baileysOptions || {};
    
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

    this.sessionDir = path.join(__dirname, '..', '.baileys_auth_info', this.id);
  }

  /**
   * Inicializa o cliente WhatsApp
   */
  async initialize() {
    this.logger.info(`Inicializando instância de bot ${this.id}`);

    // Certifica que o diretório de sessão existe
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }

    // Obtém o estado de autenticação
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
    
    // Obtém a versão mais recente do Baileys
    const { version, isLatest } = await fetchLatestBaileysVersion();
    this.logger.info(`Usando WA v${version.join('.')}, isLatest: ${isLatest}`);
    
    // Cria o socket WhatsApp
    this.socket = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
      auth: state,
      ...this.baileysOptions
    });
    
    // Bind do store ao socket
    this.store.bind(this.socket.ev);
    
    // Registra manipuladores de eventos
    this.registerEventHandlers(saveCreds);

    this.logger.info(`Bot ${this.id} inicializado`);
    
    return this;
  }

  /**
   * Registra manipuladores de eventos para o cliente WhatsApp
   * @param {Function} saveCreds - Função para salvar credenciais de autenticação
   */
  registerEventHandlers(saveCreds) {
    // Evento de conexão
    this.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        this.logger.info('QR Code recebido, escaneie para autenticar');
        qrcode.generate(qr, { small: true });
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error instanceof Boom) && 
          lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
        
        this.logger.info(`Conexão fechada devido a ${lastDisconnect.error}, reconnect: ${shouldReconnect}`);
        this.isConnected = false;
        this.eventHandler.onDisconnected(this, lastDisconnect.error?.message || 'Unknown reason');
        
        // Reconecta se não foi logout
        if (shouldReconnect) {
          await this.initialize();
        }
      } else if (connection === 'open') {
        this.isConnected = true;
        this.logger.info('Cliente está pronto');
        this.eventHandler.onConnected(this);
        
        // Inicializa StreamSystem
        this.streamSystem = new StreamSystem(this);
        await this.streamSystem.initialize();
        this.streamMonitor = this.streamSystem.streamMonitor;
        
        // Envia notificação de inicialização para o grupo de logs
        if (this.grupoLogs) {
          try {
            const startMessage = `🤖 Bot ${this.id} inicializado com sucesso em ${new Date().toLocaleString()}`;
            await this.sendMessage(this.grupoLogs, startMessage);
          } catch (error) {
            this.logger.error('Erro ao enviar notificação de inicialização:', error);
          }
        }
      }
    });
    
    // Evento de credenciais atualizadas
    this.socket.ev.on('creds.update', saveCreds);
    
    // Evento de mensagem
    this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
      // Processa apenas novas mensagens
      if (type !== 'notify') return;
      
      for (const message of messages) {
        // Ignora mensagens do próprio bot
        if (message.key.fromMe) continue;
        
        try {
          // Formata mensagem para o manipulador de eventos
          const formattedMessage = await this.formatMessage(message);
          this.eventHandler.onMessage(this, formattedMessage);
        } catch (error) {
          this.logger.error('Erro ao processar mensagem:', error);
        }
      }
    });
    
    // Evento de reação
    this.socket.ev.on('messages.reaction', async (reactions) => {
      for (const reaction of reactions) {
        try {
          // Processa apenas reações de outros usuários, não do próprio bot
          if (reaction.key.fromMe) continue;
          
          // Será que é uma reaction de lista?
          const isListReaction = await processListReaction(this, reaction);
          
          // Se não for de lista, processa o normal
          if (!isListReaction) {
            await this.reactionHandler.processReaction(this, reaction);
          }
        } catch (error) {
          this.logger.error('Erro ao tratar reação de mensagem:', error);
        }
      }
    });
    
    // Evento de alterações no grupo
    this.socket.ev.on('group-participants.update', async (update) => {
      try {
        const { id, participants, action } = update;
        
        // Obtém dados do grupo
        const groupMetadata = await this.socket.groupMetadata(id);
        
        if (action === 'add') {
          // Evento de entrada no grupo
          for (const participant of participants) {
            // Obtém dados do contato
            const contactInfo = await this.getContactInfo(participant);
            
            // Determina o responsável (para convites)
            // Nota: Baileys não fornece diretamente quem convidou, usando o admin do grupo como padrão
            const responsavelId = this.findGroupAdmin(groupMetadata);
            const responsavelInfo = await this.getContactInfo(responsavelId);
            
            this.eventHandler.onGroupJoin(this, {
              group: {
                id: id,
                name: groupMetadata.subject
              },
              user: {
                id: participant,
                name: contactInfo.name
              },
              responsavel: {
                id: responsavelId,
                name: responsavelInfo.name
              },
              origin: update
            });
          }
        } else if (action === 'remove') {
          // Evento de saída do grupo
          for (const participant of participants) {
            // Obtém dados do contato
            const contactInfo = await this.getContactInfo(participant);
            
            // Determina o responsável (para remoções)
            const responsavelId = this.findGroupAdmin(groupMetadata);
            const responsavelInfo = await this.getContactInfo(responsavelId);
            
            this.eventHandler.onGroupLeave(this, {
              group: {
                id: id,
                name: groupMetadata.subject
              },
              user: {
                id: participant,
                name: contactInfo.name
              },
              responsavel: {
                id: responsavelId,
                name: responsavelInfo.name
              },
              origin: update
            });
          }
        }
      } catch (error) {
        this.logger.error('Erro ao processar evento de grupo:', error);
      }
    });
    
    // Evento de atualizações de grupo
    this.socket.ev.on('groups.update', (updates) => {
      for (const update of updates) {
        this.eventHandler.onNotification(this, update);
      }
    });
  }

  /**
   * Encontra um administrador do grupo para atribuir como responsável por uma ação
   * @param {Object} groupMetadata - Metadados do grupo
   * @returns {string} - ID do administrador ou ID do grupo se nenhum admin for encontrado
   */
  findGroupAdmin(groupMetadata) {
    if (!groupMetadata || !groupMetadata.participants) {
      return groupMetadata.id;
    }

    // Tenta encontrar um super admin primeiro
    const superAdmin = groupMetadata.participants.find(p => p.admin === 'superadmin');
    if (superAdmin) return superAdmin.id;

    // Depois tenta qualquer admin
    const admin = groupMetadata.participants.find(p => p.admin === 'admin');
    if (admin) return admin.id;

    // Se não houver admin, retorna o ID do grupo
    return groupMetadata.id;
  }

  /**
   * Obtém informações de contato
   * @param {string} id - ID do contato
   * @returns {Promise<Object>} - Informações do contato
   */
  async getContactInfo(id) {
    try {
      const contact = await this.socket.contactDB?.get(id);
      return {
        id,
        name: contact?.name || contact?.notify || contact?.verifiedName || 'Desconhecido'
      };
    } catch (error) {
      this.logger.error('Erro ao obter informações de contato:', error);
      return { id, name: 'Desconhecido' };
    }
  }

  /**
   * Formata uma mensagem do Baileys para nosso formato padrão
   * @param {Object} message - A mensagem bruta do Baileys
   * @returns {Promise<Object>} - Objeto de mensagem formatado
   */
  async formatMessage(message) {
    try {
      const chatId = message.key.remoteJid;
      const isGroup = chatId.endsWith('@g.us');
      const senderId = message.key.participant || message.key.remoteJid;
      
      // Rastreia mensagem recebida
      this.loadReport.trackReceivedMessage(isGroup);
      
      let type = 'text';
      let content = message.message?.conversation || '';
      let caption = null;
      
      // Determina tipo de mensagem e conteúdo
      if (message.message?.imageMessage) {
        type = 'image';
        content = await this.downloadMedia(message);
        caption = message.message.imageMessage.caption || '';
      } else if (message.message?.videoMessage) {
        type = 'video';
        content = await this.downloadMedia(message);
        caption = message.message.videoMessage.caption || '';
      } else if (message.message?.audioMessage) {
        type = 'audio';
        content = await this.downloadMedia(message);
      } else if (message.message?.documentMessage) {
        type = 'document';
        content = await this.downloadMedia(message);
        caption = message.message.documentMessage.caption || '';
      } else if (message.message?.stickerMessage) {
        type = 'sticker';
        content = await this.downloadMedia(message);
      } else if (message.message?.extendedTextMessage) {
        type = 'text';
        content = message.message.extendedTextMessage.text || '';
      }
      
      // Obtém informações do autor
      const contactInfo = await this.getContactInfo(senderId);
      
      // Cria um objeto de mensagem compatível com whatsapp-web.js
      const compatMessage = this.createCompatibilityLayer(message);
      
      return {
        group: isGroup ? chatId : null,
        author: senderId,
        authorName: contactInfo.name,
        type,
        content,
        caption,
        origin: compatMessage // Objeto com compatibilidade para whatsapp-web.js
      };
    } catch (error) {
      this.logger.error('Erro ao formatar mensagem:', error);
      throw error;
    }
  }
  
  /**
   * Cria uma camada de compatibilidade para mensagens do Baileys
   * @param {Object} baileysMessage - Mensagem original do Baileys
   * @returns {Object} - Objeto com métodos compatíveis com whatsapp-web.js
   */
  createCompatibilityLayer(baileysMessage) {
    const self = this;
    const msgId = baileysMessage.key.id;
    const remoteJid = baileysMessage.key.remoteJid;
    const participant = baileysMessage.key.participant;
    const fromMe = baileysMessage.key.fromMe;
    
    // Métodos compatíveis com whatsapp-web.js
    return {
      id: { _serialized: msgId },
      body: this.getMessageText(baileysMessage),
      from: remoteJid,
      author: participant || remoteJid,
      hasMedia: this.hasMedia(baileysMessage),
      timestamp: baileysMessage.messageTimestamp,
      
      // Método para reagir a mensagens
      react: async function(emoji) {
        return await self.socket.sendMessage(remoteJid, {
          react: {
            text: emoji,
            key: baileysMessage.key
          }
        });
      },
      
      // Método para obter informações do contato
      getContact: async function() {
        const id = participant || remoteJid;
        const contactInfo = await self.getContactInfo(id);
        return {
          id: { _serialized: id },
          pushname: contactInfo.name,
          name: contactInfo.name,
          number: id.split('@')[0]
        };
      },
      
      // Método para obter mensagem citada
      getQuotedMessage: async function() {
        try {
          // Verifica se a mensagem tem uma citação
          const quotedInfo = self.getQuotedMessageInfo(baileysMessage);
          if (!quotedInfo) return null;
          
          // Tenta obter a mensagem citada do histórico
          const quotedMsg = await self.retrieveQuotedMessage(quotedInfo, remoteJid);
          if (!quotedMsg) return null;
          
          // Retorna com a mesma camada de compatibilidade
          return self.createCompatibilityLayer(quotedMsg);
        } catch (error) {
          self.logger.error('Erro ao obter mensagem citada:', error);
          return null;
        }
      },
      
      // Método para fazer download de mídia
      downloadMedia: async function() {
        try {
          const media = await self.downloadMedia(baileysMessage);
          if (!media) return null;
          
          return {
            mimetype: media.mimetype,
            data: media.data,
            filename: media.filename
          };
        } catch (error) {
          self.logger.error('Erro ao baixar mídia:', error);
          return null;
        }
      },
      
      // Método para obter chat
      getChat: async function() {
        try {
          const isGroup = remoteJid.endsWith('@g.us');
          if (isGroup) {
            const metadata = await self.socket.groupMetadata(remoteJid);
            return {
              id: { _serialized: remoteJid },
              name: metadata.subject,
              isGroup: true,
              participants: metadata.participants.map(p => ({
                id: { _serialized: p.id },
                isAdmin: p.admin === 'admin' || p.admin === 'superadmin'
              })),
              groupMetadata: metadata
            };
          } else {
            return {
              id: { _serialized: remoteJid },
              name: (await self.getContactInfo(remoteJid)).name,
              isGroup: false
            };
          }
        } catch (error) {
          self.logger.error('Erro ao obter chat:', error);
          return {
            id: { _serialized: remoteJid },
            isGroup: remoteJid.endsWith('@g.us')
          };
        }
      }
    };
  }
  
  /**
   * Extrai o texto de uma mensagem do Baileys
   * @param {Object} message - Mensagem do Baileys
   * @returns {string} - Texto da mensagem
   */
  getMessageText(message) {
    if (!message.message) return '';
    
    // Verifica diferentes tipos de mensagem
    if (message.message.conversation) {
      return message.message.conversation;
    } else if (message.message.extendedTextMessage) {
      return message.message.extendedTextMessage.text || '';
    } else if (message.message.imageMessage) {
      return message.message.imageMessage.caption || '';
    } else if (message.message.videoMessage) {
      return message.message.videoMessage.caption || '';
    } else if (message.message.documentMessage) {
      return message.message.documentMessage.caption || '';
    }
    
    return '';
  }
  
  /**
   * Verifica se uma mensagem contém mídia
   * @param {Object} message - Mensagem do Baileys
   * @returns {boolean} - Se a mensagem contém mídia
   */
  hasMedia(message) {
    if (!message.message) return false;
    
    return !!(
      message.message.imageMessage ||
      message.message.videoMessage ||
      message.message.audioMessage ||
      message.message.documentMessage ||
      message.message.stickerMessage
    );
  }
  
  /**
   * Obtém informações da mensagem citada
   * @param {Object} message - Mensagem do Baileys
   * @returns {Object|null} - Informações da mensagem citada ou null
   */
  getQuotedMessageInfo(message) {
    if (!message.message) return null;
    
    // Verifica se há citação em diferentes tipos de mensagem
    if (message.message.extendedTextMessage?.contextInfo?.quotedMessage) {
      return {
        id: message.message.extendedTextMessage.contextInfo.stanzaId,
        participant: message.message.extendedTextMessage.contextInfo.participant,
        message: message.message.extendedTextMessage.contextInfo.quotedMessage
      };
    } else if (message.message.imageMessage?.contextInfo?.quotedMessage) {
      return {
        id: message.message.imageMessage.contextInfo.stanzaId,
        participant: message.message.imageMessage.contextInfo.participant,
        message: message.message.imageMessage.contextInfo.quotedMessage
      };
    } else if (message.message.videoMessage?.contextInfo?.quotedMessage) {
      return {
        id: message.message.videoMessage.contextInfo.stanzaId,
        participant: message.message.videoMessage.contextInfo.participant,
        message: message.message.videoMessage.contextInfo.quotedMessage
      };
    }
    
    return null;
  }
  
  /**
   * Tenta recuperar uma mensagem citada do histórico
   * @param {Object} quotedInfo - Informações da mensagem citada
   * @param {string} chatId - ID do chat
   * @returns {Object|null} - Mensagem citada ou null
   */
  async retrieveQuotedMessage(quotedInfo, chatId) {
    try {
      // Tenta obter do histórico da store
      const msg = this.store.messages[chatId]?.get(quotedInfo.id);
      if (msg) return msg;
      
      // Se não encontrou, cria um objeto básico
      return {
        key: {
          remoteJid: chatId,
          fromMe: false,
          id: quotedInfo.id,
          participant: quotedInfo.participant
        },
        message: quotedInfo.message,
        messageTimestamp: 0
      };
    } catch (error) {
      this.logger.error('Erro ao recuperar mensagem citada:', error);
      return null;
    }
  }

  /**
   * Baixa mídia de uma mensagem
   * @param {Object} message - A mensagem com mídia
   * @returns {Promise<Object>} - Objeto contendo a mídia
   */
  async downloadMedia(message) {
    try {
      let buffer, mimetype, filename = 'file';
      
      // Determinar stream e mimetype com base no tipo de mensagem
      let stream, messagePart;
      if (message.message?.imageMessage) {
        messagePart = message.message.imageMessage;
        mimetype = messagePart.mimetype;
        stream = await downloadContentFromMessage(messagePart, 'image');
      } else if (message.message?.videoMessage) {
        messagePart = message.message.videoMessage;
        mimetype = messagePart.mimetype;
        stream = await downloadContentFromMessage(messagePart, 'video');
      } else if (message.message?.audioMessage) {
        messagePart = message.message.audioMessage;
        mimetype = messagePart.mimetype;
        stream = await downloadContentFromMessage(messagePart, 'audio');
      } else if (message.message?.documentMessage) {
        messagePart = message.message.documentMessage;
        mimetype = messagePart.mimetype;
        filename = messagePart.fileName || 'file';
        stream = await downloadContentFromMessage(messagePart, 'document');
      } else if (message.message?.stickerMessage) {
        messagePart = message.message.stickerMessage;
        mimetype = messagePart.mimetype;
        stream = await downloadContentFromMessage(messagePart, 'sticker');
      } else {
        throw new Error('Tipo de mídia não suportado');
      }
      
      // Ler stream para buffer
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
      
      return {
        data: buffer.toString('base64'),
        mimetype,
        filename
      };
    } catch (error) {
      this.logger.error('Erro ao baixar mídia:', error);
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

      // Verifica se está em modo seguro
      if (this.safeMode) {
        this.logger.info(`[MODO SEGURO] Enviaria para ${chatId}: ${typeof content === 'string' ? content : '[Mídia]'}`);
        return { key: { id: 'safe-mode-msg-id', remoteJid: chatId } };
      }

      // Envia mensagem de texto
      if (typeof content === 'string') {
        return await this.socket.sendMessage(chatId, { text: content }, options);
      } 
      // Envia mídia
      else if (content && content.mimetype) {
        const mediaType = content.mimetype.split('/')[0]; // imagem, vídeo, áudio, etc.
        
        if (mediaType === 'image') {
          return await this.socket.sendMessage(chatId, {
            image: Buffer.from(content.data, 'base64'),
            caption: options.caption,
            ...options
          });
        } else if (mediaType === 'video') {
          return await this.socket.sendMessage(chatId, {
            video: Buffer.from(content.data, 'base64'),
            caption: options.caption,
            ...options
          });
        } else if (mediaType === 'audio') {
          return await this.socket.sendMessage(chatId, {
            audio: Buffer.from(content.data, 'base64'),
            ptt: options.ptt || false,
            ...options
          });
        } else if (mediaType === 'application') {
          return await this.socket.sendMessage(chatId, {
            document: Buffer.from(content.data, 'base64'),
            mimetype: content.mimetype,
            fileName: content.filename || 'file',
            caption: options.caption,
            ...options
          });
        } else if (options.asSticker || content.mimetype.includes('sticker')) {
          return await this.socket.sendMessage(chatId, {
            sticker: Buffer.from(content.data, 'base64'),
            ...options
          });
        }
      }
      
      throw new Error('Tipo de conteúdo não suportado');
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
              await this.socket.sendMessage(
                result.key.remoteJid, 
                { react: { text: message.reactions.before, key: result.key } }
              );
            }

            // Store message ID for potential future reactions
            if (message.metadata) {
              message.metadata.messageId = result.key.id;
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
   * @returns {Promise<Object>} - O objeto de mídia
   */
  async createMedia(filePath) {
    try {
      const data = fs.readFileSync(filePath);
      const base64Data = data.toString('base64');
      const mimetype = this.getMimeType(filePath);
      const filename = path.basename(filePath);
      
      return {
        data: base64Data,
        mimetype,
        filename
      };
    } catch (error) {
      this.logger.error(`Erro ao criar mídia de ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Determina o tipo MIME com base na extensão do arquivo
   * @param {string} filePath - Caminho do arquivo
   * @returns {string} - Tipo MIME
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
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
      let newTitle;
      
      // Obtém dados do grupo
      const groupMetadata = await this.socket.groupMetadata(group.id);
      if (!groupMetadata) return;
      
      // If custom title is defined, use it
      if (eventType === 'online' && channelConfig.onlineTitle) {
        newTitle = channelConfig.onlineTitle;
      } else if (eventType === 'offline' && channelConfig.offlineTitle) {
        newTitle = channelConfig.offlineTitle;
      } else {
        // Otherwise, modify the existing title
        newTitle = groupMetadata.subject;
        
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
      await this.socket.groupUpdateSubject(group.id, newTitle);
      
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
            asSticker: mediaItem.type === 'sticker'
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
    
    // Desconecta o socket
    if (this.socket) {
      this.socket.ev.removeAllListeners();
      this.socket.end(undefined);
      this.socket = null;
      this.isConnected = false;
    }
  }
}

module.exports = WhatsAppBot;