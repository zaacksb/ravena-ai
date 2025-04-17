const StreamMonitor = require('./services/StreamMonitor');
const Logger = require('./utils/Logger');
const LLMService = require('./services/LLMService');
const ReturnMessage = require('./models/ReturnMessage');
const path = require('path');
const fs = require('fs').promises;

/**
 * Sistema para gerenciamento de monitoramento de streams
 */
class StreamSystem {
  /**
   * Cria uma instância do sistema de monitoramento de streams
   * @param {WhatsAppBot} bot - Instância do bot
   */
  constructor(bot) {
    this.bot = bot;
    this.logger = new Logger(`stream-system-${bot.id}`);
    this.llmService = new LLMService({});
    this.streamMonitor = null;
    this.dataPath = path.join(__dirname, '../data');
  }

  /**
   * Inicializa o sistema de monitoramento
   */
  async initialize() {
    try {
      this.logger.info('Inicializando sistema de monitoramento de streams');
      
      // Cria o StreamMonitor
      this.streamMonitor = new StreamMonitor();
      
      // Registra manipuladores de eventos
      this.registerEventHandlers();
      
      // Carrega canais para monitorar
      await this.loadChannelsToMonitor();
      
      // Inicia o monitoramento
      this.streamMonitor.startMonitoring();
      
      // Disponibiliza o streamMonitor para o bot
      this.bot.streamMonitor = this.streamMonitor;
      
      this.logger.info('Sistema de monitoramento de streams inicializado com sucesso');
      return true;
    } catch (error) {
      this.logger.error('Erro ao inicializar sistema de monitoramento de streams:', error);
      return false;
    }
  }

  /**
   * Registra manipuladores de eventos
   */
  registerEventHandlers() {
    // Evento de stream online
    this.streamMonitor.on('streamOnline', async (data) => {
      try {
        this.logger.info(`Evento de stream online: ${data.platform}/${data.channelName}`);
        await this.handleStreamOnline(data);
      } catch (error) {
        this.logger.error('Erro ao processar evento de stream online:', error);
      }
    });
    
    // Evento de stream offline
    this.streamMonitor.on('streamOffline', async (data) => {
      try {
        this.logger.info(`Evento de stream offline: ${data.platform}/${data.channelName}`);
        await this.handleStreamOffline(data);
      } catch (error) {
        this.logger.error('Erro ao processar evento de stream offline:', error);
      }
    });
    
    // Evento de novo vídeo
    this.streamMonitor.on('newVideo', async (data) => {
      try {
        this.logger.info(`Evento de novo vídeo: ${data.platform}/${data.channelName}`);
        await this.handleNewVideo(data);
      } catch (error) {
        this.logger.error('Erro ao processar evento de novo vídeo:', error);
      }
    });
  }

  /**
   * Carrega canais para monitorar
   */
  async loadChannelsToMonitor() {
    try {
      // Obtém todos os grupos
      const groups = await this.bot.database.getGroups();
      
      let subscribedChannels = {
        twitch: [],
        kick: [],
        youtube: []
      };
      
      // Processa cada grupo
      for (const group of groups) {
        // Adiciona canais Twitch
        if (group.twitch && Array.isArray(group.twitch)) {
          for (const channel of group.twitch) {
            if (!subscribedChannels.twitch.includes(channel.channel)) {
              this.streamMonitor.subscribe(channel.channel, 'twitch');
              subscribedChannels.twitch.push(channel.channel);
            }
          }
        }
        
        // Adiciona canais Kick
        if (group.kick && Array.isArray(group.kick)) {
          for (const channel of group.kick) {
            if (!subscribedChannels.kick.includes(channel.channel)) {
              this.streamMonitor.subscribe(channel.channel, 'kick');
              subscribedChannels.kick.push(channel.channel);
            }
          }
        }
        
        // Adiciona canais YouTube
        if (group.youtube && Array.isArray(group.youtube)) {
          for (const channel of group.youtube) {
            if (!subscribedChannels.youtube.includes(channel.channel)) {
              this.streamMonitor.subscribe(channel.channel, 'youtube');
              subscribedChannels.youtube.push(channel.channel);
            }
          }
        }
      }
      
      this.logger.info(`Carregados para monitoramento: ${subscribedChannels.twitch.length} canais Twitch, ${subscribedChannels.kick.length} canais Kick e ${subscribedChannels.youtube.length} canais YouTube`);
    } catch (error) {
      this.logger.error('Erro ao carregar canais para monitorar:', error);
    }
  }

  /**
   * Manipula evento de stream online
   * @param {Object} data - Dados do evento
   */
  async handleStreamOnline(data) {
    try {
      // Obtém todos os grupos
      const groups = await this.bot.database.getGroups();
      
      // Encontra grupos que monitoram este canal
      for (const groupData of groups) {
        // Pula se o grupo não monitora esta plataforma
        if (!groupData[data.platform]) continue;
        
        // Encontra a configuração do canal neste grupo
        const channelConfig = groupData[data.platform].find(
          c => c.channel.toLowerCase() === data.channelName.toLowerCase()
        );
        
        if (!channelConfig) continue;
        
        // Processa notificação para este grupo
        await this.processStreamEvent(groupData, channelConfig, data, 'online');
      }
    } catch (error) {
      this.logger.error('Erro ao manipular evento de stream online:', error);
    }
  }

  /**
   * Manipula evento de stream offline
   * @param {Object} data - Dados do evento
   */
  async handleStreamOffline(data) {
    try {
      // Obtém todos os grupos
      const groups = await this.bot.database.getGroups();
      
      // Encontra grupos que monitoram este canal
      for (const groupData of groups) {
        // Pula se o grupo não monitora esta plataforma
        if (!groupData[data.platform]) continue;
        
        // Encontra a configuração do canal neste grupo
        const channelConfig = groupData[data.platform].find(
          c => c.channel.toLowerCase() === data.channelName.toLowerCase()
        );
        
        if (!channelConfig) continue;
        
        // Processa notificação para este grupo
        await this.processStreamEvent(groupData, channelConfig, data, 'offline');
      }
    } catch (error) {
      this.logger.error('Erro ao manipular evento de stream offline:', error);
    }
  }

  /**
   * Manipula evento de novo vídeo
   * @param {Object} data - Dados do evento
   */
  async handleNewVideo(data) {
    try {
      // Obtém todos os grupos
      const groups = await this.bot.database.getGroups();
      
      // Encontra grupos que monitoram este canal
      for (const groupData of groups) {
        // Pula se o grupo não monitora YouTube
        if (!groupData.youtube) continue;
        
        // Encontra a configuração do canal neste grupo
        const channelConfig = groupData.youtube.find(
          c => c.channel.toLowerCase() === data.channelName.toLowerCase()
        );
        
        if (!channelConfig) continue;
        
        // Processa notificação para este grupo (como evento "online" para consistência)
        await this.processStreamEvent(groupData, channelConfig, data, 'online');
      }
    } catch (error) {
      this.logger.error('Erro ao manipular evento de novo vídeo:', error);
    }
  }

  /**
   * Processa notificação de evento de stream para um grupo
   * @param {Object} group - Dados do grupo
   * @param {Object} channelConfig - Configuração do canal
   * @param {Object} eventData - Dados do evento
   * @param {string} eventType - Tipo de evento ('online' ou 'offline')
   */
  async processStreamEvent(group, channelConfig, eventData, eventType) {
    try {
      // Verifica se o grupo está pausado
      if (group.paused) {
        this.logger.info(`Ignorando notificação de stream para grupo pausado: ${group.id}`);
        return;
      }

      // Obtém a configuração apropriada (onConfig para eventos online, offConfig para offline)
      const config = eventType === 'online' ? channelConfig.onConfig : channelConfig.offConfig;
      
      // Pula se não houver configuração
      if (!config || !config.media || config.media.length === 0) {
        return;
      }
      
      // Armazena as ReturnMessages para enviar
      const returnMessages = [];
      
      // Processa alteração de título se habilitada
      if (channelConfig.changeTitleOnEvent) {
        await this.changeGroupTitle(group, channelConfig, eventData, eventType);
      }
      
      // Processa notificações de mídia
      for (const mediaItem of config.media) {
        const returnMessage = await this.createEventNotification(group.id, mediaItem, eventData, channelConfig);
        if (returnMessage) {
          returnMessages.push(returnMessage);
        }
      }
      
      // Gera mensagem de IA se habilitada
      if (channelConfig.useAI && eventType === 'online') {
        const aiMessage = await this.createAINotification(group.id, eventData, channelConfig);
        if (aiMessage) {
          returnMessages.push(aiMessage);
        }
      }
      
      // Envia todas as mensagens
      if (returnMessages.length > 0) {
        await this.bot.sendReturnMessages(returnMessages);
      }
    } catch (error) {
      this.logger.error(`Erro ao processar evento de stream para ${group.id}:`, error);
    }
  }

  /**
   * Altera o título do grupo com base em evento de stream
   * @param {Object} group - Dados do grupo
   * @param {Object} channelConfig - Configuração do canal
   * @param {Object} eventData - Dados do evento
   * @param {string} eventType - Tipo de evento ('online' ou 'offline')
   */
  async changeGroupTitle(group, channelConfig, eventData, eventType) {
    try {
      // Obtém o chat do grupo atual
      const chat = await this.bot.client.getChatById(group.id);
      if (!chat || !chat.isGroup) return;
      
      let newTitle;
      
      // Se título personalizado estiver definido, use-o
      if (eventType === 'online' && channelConfig.onlineTitle) {
        newTitle = channelConfig.onlineTitle;
      } else if (eventType === 'offline' && channelConfig.offlineTitle) {
        newTitle = channelConfig.offlineTitle;
      } else {
        // Caso contrário, modifica o título existente
        newTitle = chat.name;
        
        // Substitui "OFF" por "ON" ou vice-versa
        if (eventType === 'online') {
          newTitle = newTitle.replace(/\bOFF\b/g, 'ON');
        } else {
          newTitle = newTitle.replace(/\bON\b/g, 'OFF');
        }
        
        // Substitui emojis
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
        
        // Se for um evento offline, troca as chaves e valores
        const finalEmojiMap = eventType === 'online' ? emojiMap : 
          Object.fromEntries(Object.entries(emojiMap).map(([k, v]) => [v, k]));
        
        // Substitui emojis
        for (const [from, to] of Object.entries(finalEmojiMap)) {
          newTitle = newTitle.replace(new RegExp(from, 'g'), to);
        }
      }
      
      // Define o novo título
      await chat.setSubject(newTitle);
      
      this.logger.info(`Alterado título do grupo ${group.id} para: ${newTitle}`);
    } catch (error) {
      this.logger.error(`Erro ao alterar título do grupo ${group.id}:`, error);
    }
  }

  /**
   * Cria uma notificação de evento para um grupo
   * @param {string} groupId - ID do grupo
   * @param {Object} mediaItem - Configuração de mídia
   * @param {Object} eventData - Dados do evento
   * @param {Object} channelConfig - Configuração do canal
   * @returns {Promise<ReturnMessage|null>} - A mensagem de retorno
   */
  async createEventNotification(groupId, mediaItem, eventData, channelConfig) {
    try {
      // Trata diferentes tipos de mídia
      if (mediaItem.type === 'text') {
        // Processa variáveis no texto
        let content = mediaItem.content;
        
        // Substitui variáveis específicas da plataforma
        if (eventData.platform === 'twitch' || eventData.platform === 'kick') {
          content = content.replace(/{nomeCanal}/g, eventData.channelName)
                          .replace(/{titulo}/g, eventData.title || '')
                          .replace(/{jogo}/g, eventData.game || 'Unknown');
        } else if (eventData.platform === 'youtube') {
          content = content.replace(/{author}/g, eventData.author || eventData.channelName)
                          .replace(/{title}/g, eventData.title || '')
                          .replace(/{link}/g, eventData.url || '');
        }
        
        // Cria a mensagem de retorno
        return new ReturnMessage({
          chatId: groupId,
          content: content
        });
      } else if (mediaItem.type === 'image' || mediaItem.type === 'video' || 
                mediaItem.type === 'audio' || mediaItem.type === 'sticker') {
        // Carrega arquivo de mídia
        const mediaPath = path.join(this.dataPath, 'media', mediaItem.content);
        
        try {
          const media = await this.bot.createMedia(mediaPath);
          
          // Processa variáveis de legenda
          let caption = mediaItem.caption || '';
          
          // Substitui variáveis específicas da plataforma (igual ao texto)
          if (eventData.platform === 'twitch' || eventData.platform === 'kick') {
            caption = caption.replace(/{nomeCanal}/g, eventData.channelName)
                            .replace(/{titulo}/g, eventData.title || '')
                            .replace(/{jogo}/g, eventData.game || 'Unknown');
          } else if (eventData.platform === 'youtube') {
            caption = caption.replace(/{author}/g, eventData.author || eventData.channelName)
                            .replace(/{title}/g, eventData.title || '')
                            .replace(/{link}/g, eventData.url || '');
          }
          
          // Cria a mensagem de retorno
          return new ReturnMessage({
            chatId: groupId,
            content: media,
            options: {
              caption: caption || undefined,
              sendMediaAsSticker: mediaItem.type === 'sticker'
            }
          });
        } catch (error) {
          this.logger.error(`Erro ao enviar notificação de mídia (${mediaPath}):`, error);
          
          // Fallback para mensagem de texto
          return new ReturnMessage({
            chatId: groupId,
            content: `Erro ao enviar notificação de mídia para evento de ${eventData.platform}/${eventData.channelName}`
          });
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Erro ao criar notificação de evento para ${groupId}:`, error);
      return null;
    }
  }

  /**
   * Cria notificação gerada por IA
   * @param {string} groupId - ID do grupo
   * @param {Object} eventData - Dados do evento
   * @param {Object} channelConfig - Configuração do canal
   * @returns {Promise<ReturnMessage|null>} - A mensagem de retorno gerada por IA
   */
  async createAINotification(groupId, eventData, channelConfig) {
    try {
      // Gera prompt com base no tipo de evento
      let prompt = '';
      
      if (eventData.platform === 'twitch' || eventData.platform === 'kick') {
        prompt = `O canal ${eventData.channelName} ficou online e está jogando ${eventData.game || 'um jogo'} com o título "${eventData.title || ''}". Gere uma mensagem animada para convidar a galera do grupo a participar da stream.`;
      } else if (eventData.platform === 'youtube') {
        prompt = `O canal ${eventData.channelName} acabou de lançar um novo vídeo chamado "${eventData.title || ''}". Gere uma mensagem animada para convidar a galera do grupo a assistir o vídeo.`;
      }
      
      // Obtém resposta da IA
      const aiResponse = await this.llmService.getCompletion({
        prompt: prompt,
        provider: 'openrouter',
        temperature: 0.7,
        maxTokens: 200
      });
      
      // Cria mensagem de retorno com a resposta da IA
      if (aiResponse) {
        return new ReturnMessage({
          chatId: groupId,
          content: aiResponse,
          delay: 500 // Pequeno atraso para enviar após as notificações normais
        });
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Erro ao criar notificação de IA para ${groupId}:`, error);
      return null;
    }
  }

  /**
   * Destrói o sistema de monitoramento
   */
  destroy() {
    if (this.streamMonitor) {
      this.streamMonitor.stopMonitoring();
      this.streamMonitor = null;
    }
  }
}

module.exports = StreamSystem;