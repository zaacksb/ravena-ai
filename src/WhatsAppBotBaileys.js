const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore, downloadContentFromMessage } = require('baileys');
const qrcode = require('qrcode-terminal');
const Database = require('./utils/Database');
const Logger = require('./utils/Logger');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const LoadReport = require('./LoadReport');
const ReactionsHandler = require('./ReactionsHandler');
const MentionHandler = require('./MentionHandler');
const InviteSystem = require('./InviteSystem');
const StreamSystem = require('./StreamSystem');
const LLMService = require('./services/LLMService');
const AdminUtils = require('./utils/AdminUtils');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class WhatsAppBotBaileys {
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
    this.client = null; // Para compatibilidade com whatsapp-web.js
    this.socket = null;
    this.store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
    this.database = Database.getInstance(); // Instância de banco de dados compartilhada
    this.isConnected = false;
    this.safeMode = options.safeMode !== undefined ? options.safeMode : (process.env.SAFE_MODE === 'true');
    this.baileysOptions = options.baileysOptions || {};
    this.blockedContacts = [];
    
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

    // Inicializa StreamSystem (será definido em initialize())
    this.streamSystem = null;
    this.streamMonitor = null;
    
    this.llmService = new LLMService({});
    this.adminUtils = AdminUtils.getInstance();

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
    
    // Para compatibilidade com whatsapp-web.js
    this.client = this.socket;
    
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
        this.socket.info = {
          wid: {
            _serialized: this.socket.user.id
          }
        };

        this.client = this.socket;

        this.logger.info('Cliente está pronto');
        this.eventHandler.onConnected(this);
        
        // Inicializa o sistema de streaming agora que estamos conectados
        this.streamSystem = new StreamSystem(this);
        await this.streamSystem.initialize();
        this.streamMonitor = this.streamSystem.streamMonitor;
        
        // Envia notificação de inicialização para o grupo de logs
        if (this.grupoLogs) {
          try {
            const startMessage = `🤖 Bot ${this.id} inicializado com sucesso em ${new Date().toLocaleString("pt-BR")}`;
            await this.sendMessage(this.grupoLogs, startMessage);
          } catch (error) {
            this.logger.error('Erro ao enviar notificação de inicialização:', error);
          }
        }
      }
    });
    
    // Evento de credenciais atualizadas
    this.socket.ev.on('creds.update', saveCreds);
    
    // Evento de mensagem - Versão com logs aprimorados
    this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
      // Log completo para debug
      this.logger.debug(`[messages.upsert] Recebido evento tipo: ${type}, mensagens: ${messages ? messages.length : 0}`);
      
      // Processa apenas novas mensagens
      if (type !== 'notify') {
        this.logger.debug(`[messages.upsert] Ignorando mensagem de tipo: ${type}`);
        return;
      }
      
      for (const message of messages) {
        try {
          // Log de estrutura da mensagem
          this.logger.debug(`[messages.upsert] Processando mensagem de ${message.key.remoteJid} via ${message.key.participant || 'direto'}`);
          
          // Ignora mensagens do próprio bot
          if (message.key.fromMe) {
            this.logger.debug(`[messages.upsert] Ignorando mensagem própria`);
            continue;
          }
          
          // Formata mensagem para o manipulador de eventos
          const formattedMessage = await this.formatMessage(message);
          
          // Log após formatação
          this.logger.debug(`[messages.upsert] Mensagem formatada com sucesso: ${formattedMessage.type}`);
          
          // Passa para o handler de eventos
          this.logger.debug(`[messages.upsert] Enviando para eventHandler.onMessage`);
          this.eventHandler.onMessage(this, formattedMessage);
        } catch (error) {
          this.logger.error(`[messages.upsert] Erro ao processar mensagem:`, error);
        }
      }
    });
    
    // Evento de reação
    this.socket.ev.on('messages.reaction', async (reactions) => {
      for (const reaction of reactions) {
        try {
          // Processa apenas reações de outros usuários, não do próprio bot
          if (reaction.key.fromMe) continue;
                  
          await this.reactionHandler.processReaction(this, reaction);
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
    
    // Evento de chamada
    this.socket.ev.on('call', async (calls) => {
      for (const call of calls) {
        if (call.status === 'offer') {
          this.logger.info(`[Call] Rejeitando chamada: ${JSON.stringify(call)}`);
          try {
            await this.socket.rejectCall(call.id, call.from);
          } catch (error) {
            this.logger.error('Erro ao rejeitar chamada:', error);
          }
        }
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
        name: contact?.name || contact?.notify || contact?.verifiedName || id.split('@')[0] || 'Desconhecido'
      };
    } catch (error) {
      this.logger.error('Erro ao obter informações de contato:', error);
      return { id, name: id.split('@')[0] || 'Desconhecido' };
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
      
      // Detectar o tipo de mensagem e extrair conteúdo
      let type = 'text';
      let content = '';
      let caption = null;
      
      // Determina tipo de mensagem e conteúdo
      if (message.message?.imageMessage) {
        type = 'image';
        // Em vez de baixar a imagem, usamos texto (para simplificar)
        // Em produção você poderia descomentar a linha abaixo para baixar a mídia
        // content = await this.downloadMedia(message, 'image');
        content = message.message.imageMessage?.caption || 'Imagem recebida';
        caption = message.message.imageMessage?.caption || '';
      } else if (message.message?.videoMessage) {
        type = 'video';
        // content = await this.downloadMedia(message, 'video');
        content = message.message.videoMessage?.caption || 'Vídeo recebido';
        caption = message.message.videoMessage?.caption || '';
      } else if (message.message?.audioMessage) {
        type = 'audio';
        // content = await this.downloadMedia(message, 'audio');
        content = 'Áudio recebido';
      } else if (message.message?.documentMessage) {
        type = 'document';
        // content = await this.downloadMedia(message, 'document');
        content = message.message.documentMessage?.caption || 'Documento recebido';
        caption = message.message.documentMessage?.caption || '';
      } else if (message.message?.stickerMessage) {
        type = 'sticker';
        // content = await this.downloadMedia(message, 'sticker');
        content = 'Sticker recebido';
      } else if (message.message?.extendedTextMessage) {
        type = 'text';
        content = message.message.extendedTextMessage.text || '';
      } else if (message.message?.conversation) {
        type = 'text';
        content = message.message.conversation || '';
      } else {
        // Fallback para qualquer outro tipo
        type = 'text';
        content = JSON.stringify(message.message) || 'Mensagem recebida';
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
        try {
          return await self.socket.sendMessage(remoteJid, {
            react: {
              text: emoji,
              key: baileysMessage.key
            }
          });
        } catch (error) {
          self.logger.error('Erro ao reagir à mensagem:', error);
        }
      },
      
      // Método para excluir mensagem
      delete: async function(forEveryone = true) {
        try {
          return await self.socket.sendMessage(remoteJid, { 
            delete: baileysMessage.key 
          });
        } catch (error) {
          self.logger.error('Erro ao deletar mensagem:', error);
        }
      },
      
      // Método para obter informações do contato
      getContact: async function() {
        try {
          const id = participant || remoteJid;
          const contactInfo = await self.getContactInfo(id);
          return {
            id: { _serialized: id },
            pushname: contactInfo.name,
            name: contactInfo.name,
            number: id.split('@')[0]
          };
        } catch (error) {
          self.logger.error('Erro ao obter contato:', error);
          return {
            id: { _serialized: participant || remoteJid },
            pushname: 'Desconhecido',
            name: 'Desconhecido',
            number: (participant || remoteJid).split('@')[0]
          };
        }
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
              groupMetadata: metadata,
              setSubject: async (subject) => {
                return await self.socket.groupUpdateSubject(remoteJid, subject);
              },
              setPicture: async (media) => {
                const buffer = Buffer.from(media.data, 'base64');
                return await self.socket.updateProfilePicture(remoteJid, buffer);
              }
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
   * @param {string} type - Tipo de mídia a baixar (opcional)
   * @returns {Promise<Object>} - Objeto contendo a mídia
   */
  async downloadMedia(message, type = null) {
    try {
      let buffer, mimetype, filename = 'file';
      
      // Determinar stream e mimetype com base no tipo de mensagem
      let stream, messagePart;
      
      // Se o tipo for especificado, usa-o. Caso contrário, detecta automaticamente
      if (!type) {
        if (message.message?.imageMessage) {
          type = 'image';
        } else if (message.message?.videoMessage) {
          type = 'video';
        } else if (message.message?.audioMessage) {
          type = 'audio';
        } else if (message.message?.documentMessage) {
          type = 'document';
        } else if (message.message?.stickerMessage) {
          type = 'sticker';
        } else {
          throw new Error('Tipo de mídia não suportado');
        }
      }
      
      // Obtém a parte da mensagem apropriada com base no tipo
      if (type === 'image') {
        messagePart = message.message?.imageMessage;
      } else if (type === 'video') {
        messagePart = message.message?.videoMessage;
      } else if (type === 'audio') {
        messagePart = message.message?.audioMessage;
      } else if (type === 'document') {
        messagePart = message.message?.documentMessage;
      } else if (type === 'sticker') {
        messagePart = message.message?.stickerMessage;
      }
      
      if (!messagePart) {
        throw new Error(`Não foi possível encontrar ${type} na mensagem`);
      }
      
      mimetype = messagePart.mimetype;
      if (type === 'document') {
        filename = messagePart.fileName || 'file';
      }
      
      // Baixa o conteúdo
      stream = await downloadContentFromMessage(messagePart, type);
      
      // Lê stream para buffer
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
      this.logger.error(`Erro ao baixar mídia (${type || 'desconhecido'}):`, error);
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
      if(options.linkPreview === undefined){
        options.linkPreview = false;
      }
      
      // Verifica se está em modo seguro
      if (this.safeMode) {
        this.logger.info(`[MODO SEGURO] Enviaria para ${chatId}: ${typeof content === 'string' ? content : '[Mídia]'}`);
        return { key: { id: 'safe-mode-msg-id', remoteJid: chatId } };
      }

      // Adiciona quoted message se fornecido
      let quoted = undefined;
      if (options.quotedMessageId) {
        quoted = {
          quoted: {
            key: {
              remoteJid: chatId,
              id: options.quotedMessageId,
              fromMe: false
            }
          }
        };
      }

      // Envia mensagem de texto
      if (typeof content === 'string') {
        const messageContent = {
          text: content
        };
        
        // Adiciona menções se fornecidas
        if (options.mentions && options.mentions.length > 0) {
          messageContent.mentions = options.mentions;
        }
        
        return await this.socket.sendMessage(chatId, messageContent, quoted);
      } 
      // Envia mídia
      else if (content && content.mimetype) {
        const mediaType = content.mimetype.split('/')[0]; // imagem, vídeo, áudio, etc.
        const buffer = Buffer.from(content.data, 'base64');
        
        if (mediaType === 'image') {
          return await this.socket.sendMessage(chatId, {
            image: buffer,
            caption: options.caption,
            mentions: options.mentions
          }, quoted);
        } else if (mediaType === 'video') {
          return await this.socket.sendMessage(chatId, {
            video: buffer,
            caption: options.caption,
            mentions: options.mentions,
            gifPlayback: options.sendVideoAsGif || false
          }, quoted);
        } else if (mediaType === 'audio') {
          return await this.socket.sendMessage(chatId, {
            audio: buffer,
            ptt: options.sendAudioAsVoice || false,
            mimetype: content.mimetype
          }, quoted);
        } else if (mediaType === 'application') {
          return await this.socket.sendMessage(chatId, {
            document: buffer,
            mimetype: content.mimetype,
            fileName: content.filename || options.filename || 'file',
            caption: options.caption,
            mentions: options.mentions
          }, quoted);
        } else if (options.sendMediaAsSticker || content.mimetype.includes('sticker')) {
          return await this.socket.sendMessage(chatId, {
            sticker: buffer
          }, quoted);
        }
      }
      
      throw new Error('Tipo de conteúdo não suportado');
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem para ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Envia indicador de digitação
   * @param {string} status - Status a enviar ('composing', 'recording', 'paused')
   * @param {string} chatId - ID do chat
   */
  async sendPresenceUpdate(status, chatId) {
    try {
      await this.socket.sendPresenceUpdate(status, chatId);
    } catch (error) {
      this.logger.error(`Erro ao enviar presence update ${status} para ${chatId}:`, error);
    }
  }

  /**
   * Verifica se um usuário é administrador em um grupo
   * @param {string} userId - ID do usuário a verificar
   * @param {string} groupId - ID do grupo
   * @returns {Promise<boolean>} - True se o usuário for admin
   */
  async isUserAdminInGroup(userId, groupId) {
    try {
      // Obtém o objeto de grupo do banco de dados
      const group = await this.database.getGroup(groupId);
      if (!group) return false;
      
      // Utiliza o AdminUtils para verificar
      return await this.adminUtils.isAdmin(userId, group, null, this);
    } catch (error) {
      this.logger.error(`Erro ao verificar se usuário ${userId} é admin no grupo ${groupId}:`, error);
      return false;
    }
  }

  /**
   * Envia uma ou mais ReturnMessages
   * @param {ReturnMessage|Array<ReturnMessage>} returnMessages - ReturnMessage ou array de ReturnMessages
   * @returns {Promise<Array>} - Array de resultados de envio de mensagens
   */
  async sendReturnMessages(returnMessages) {
    try {
      // Garante que returnMessages seja um array
      if (!Array.isArray(returnMessages)) {
        returnMessages = [returnMessages];
      }

      // Filtra mensagens inválidas
      const validMessages = returnMessages.filter(msg => 
        msg && msg.isValid && msg.isValid()
      );

      if (validMessages.length === 0) {
        this.logger.warn('No valid ReturnMessages to send');
        return [];
      }

      const results = [];
      
      // Processa cada mensagem
      for (const message of validMessages) {
        // Aplica delay se especificado
        if (message.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, message.delay));
        }

        // Envia a mensagem
        const result = await this.sendMessage(
          message.chatId, 
          message.content, 
          message.options
        );

        // Aplica reações se especificado
        if (message.reactions && result) {
          try {
            // Reage com emoji 'after' se especificado
            if (message.reactions.after) {
              setTimeout(async () => {
                try {
                  await this.socket.sendMessage(
                    result.key.remoteJid, 
                    { react: { text: message.reactions.after, key: result.key } }
                  );
                } catch (error) {
                  this.logger.error('Error applying delayed reaction to message:', error);
                }
              }, 1000);
            }

            // Armazena ID da mensagem para reações futuras
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
      const data = await fsPromises.readFile(filePath);
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
   * Obtém contatos bloqueados
   * @returns {Promise<Array<string>>} - Lista de IDs de contatos bloqueados
   */
  async getBlockedContacts() {
    try {
      // Para Baileys, essa funcionalidade pode não existir diretamente
      // Retorna array vazio como fallback
      return [];
    } catch (error) {
      this.logger.error('Erro ao obter contatos bloqueados:', error);
      return [];
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

    // Limpa StreamSystem
    if (this.streamSystem) {
      this.streamSystem.destroy();
      this.streamSystem = null;
      this.streamMonitor = null;
    }
    
    // Envia notificação de desligamento para o grupo de logs
    if (this.grupoLogs && this.isConnected) {
      try {
        const shutdownMessage = `🔌 Bot ${this.id} desligando em ${new Date().toLocaleString("pt-BR")}`;
        await this.sendMessage(this.grupoLogs, shutdownMessage);
        // Aguarda mensagem ser enviada
        await sleep(5000);
      } catch (error) {
        this.logger.error('Erro ao enviar notificação de desligamento:', error);
      }
    }
    
    // Desconecta o socket
    if (this.socket) {
      this.socket.ev.removeAllListeners();
      try {
        if (this.isConnected) {
          await this.socket.logout();
        }
      } catch (error) {
        this.logger.error('Erro ao fazer logout:', error);
      }
      this.socket.end(undefined);
      this.socket = null;
      this.client = null;
      this.isConnected = false;
    }
  }
}

module.exports = WhatsAppBotBaileys;