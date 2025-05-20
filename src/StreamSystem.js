const StreamMonitor = require('./services/StreamMonitor');
const Logger = require('./utils/Logger');
const LLMService = require('./services/LLMService');
const ReturnMessage = require('./models/ReturnMessage');
const path = require('path');
const fs = require('fs').promises;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sistema para gerenciamento de monitoramento de streams
 */
class StreamSystem {
  /**
   * Cria uma instância do sistema de monitoramento de streams
   * @param {WhatsAppBot} bot - Instância do bot
   */
  constructor(bot) {
    // Controle de depuração para notificações
    const debugNotificacoes = false;
    
    this.debugNotificacoes = debugNotificacoes;
    this.bot = bot;
    this.logger = new Logger(`stream-system-${bot.id}`);
    this.llmService = new LLMService({});
    this.streamMonitor = null; // Não cria uma nova instância aqui
    this.dataPath = bot.database.databasePath;
    this.mediaPath = path.join(this.dataPath, 'media');
  }

  /**
   * Inicializa o sistema de monitoramento
   */
  async initialize() {
    try {
      this.logger.info(`[Bot ${this.bot.id}] Inicializando sistema de monitoramento de streams`);
      
      // Obtém a instância compartilhada do StreamMonitor usando o padrão Singleton
      this.streamMonitor = StreamMonitor.getInstance();
      
      // Registra manipuladores de eventos
      this.registerEventHandlers();
      
      // Carrega canais para monitorar
      await this.loadChannelsToMonitor(false);
      
      // Inicia o monitoramento (apenas se ainda não estiver ativo)
      if (!this.streamMonitor.isMonitoring) {
        this.streamMonitor.startMonitoring();
      } else {
        this.logger.info(`[Bot ${this.bot.id}] Monitoramento de streams já está ativo, usando instância existente`);
      }
      
      // Disponibiliza o streamMonitor para o bot
      this.bot.streamMonitor = this.streamMonitor;
      
      this.logger.info(`[Bot ${this.bot.id}] Sistema de monitoramento de streams inicializado com sucesso`);
      
      // Envia mensagem de depuração se habilitado
      if (this.debugNotificacoes && this.bot.grupoLogs) {
        this.bot.sendMessage(this.bot.grupoLogs, `🔍 Sistema de monitoramento de streams inicializado (usando instância compartilhada)`);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`[Bot ${this.bot.id}] Erro ao inicializar sistema de monitoramento de streams:`, error);
      return false;
    }
  }

  /**
   * Registra manipuladores de eventos
   */
  registerEventHandlers() {
    const botId = this.bot.id; // Identificador para logs
    
    // Evento de stream online
    this.streamMonitor.on('streamOnline', async (data) => {
      try {
        this.logger.info(`[Bot ${botId}] Evento de stream online: ${data.platform}/${data.channelName}`);
        
        // Envia mensagem de depuração para o grupo de logs se configurado
        if (this.debugNotificacoes && this.bot.grupoLogs) {
          await this.bot.sendMessage(
            this.bot.grupoLogs, 
            `🟢 [DEBUG] Stream ONLINE: ${data.platform}/${data.channelName}\nTítulo: ${data.title || 'N/A'}\nJogo: ${data.game || 'N/A'}`
          );
        }
        
        await this.handleStreamOnline(data);
      } catch (error) {
        this.logger.error(`[Bot ${botId}] Erro ao processar evento de stream online:`, error);
      }
    });
    
    // Evento de stream offline
    this.streamMonitor.on('streamOffline', async (data) => {
      try {
        this.logger.info(`[Bot ${botId}] Evento de stream offline: ${data.platform}/${data.channelName}`);
        
        // Envia mensagem de depuração para o grupo de logs se configurado
        if (this.debugNotificacoes && this.bot.grupoLogs) {
          await this.bot.sendMessage(
            this.bot.grupoLogs, 
            `🔴 [DEBUG] Stream OFFLINE: ${data.platform}/${data.channelName}`
          );
        }
        
        await this.handleStreamOffline(data);
      } catch (error) {
        this.logger.error(`[Bot ${botId}] Erro ao processar evento de stream offline:`, error);
      }
    });
    
    // Evento de novo vídeo
    this.streamMonitor.on('newVideo', async (data) => {
      try {
        this.logger.info(`[Bot ${botId}] Evento de novo vídeo: ${data.platform}/${data.channelName}`);
        
        // Envia mensagem de depuração para o grupo de logs se configurado
        if (this.debugNotificacoes && this.bot.grupoLogs) {
          await this.bot.sendMessage(
            this.bot.grupoLogs, 
            `📺 [DEBUG] Novo vídeo: ${data.platform}/${data.channelName}\nTítulo: ${data.title || 'N/A'}\nURL: ${data.url || 'N/A'}`
          );
        }
        
        await this.handleNewVideo(data);
      } catch (error) {
        this.logger.error(`[Bot ${botId}] Erro ao processar evento de novo vídeo:`, error);
      }
    });

    // Evento de canal não encontrado
    this.streamMonitor.on('channelNotFound', async (data) => {
      try {
        this.logger.info(`[Bot ${botId}] Evento de canal não encontrado: ${data.platform}/${data.channelName}`);
        
        // Envia mensagem de depuração para o grupo de logs se configurado
        if (this.debugNotificacoes && this.bot.grupoLogs) {
          await this.bot.sendMessage(
            this.bot.grupoLogs, 
            `❌ [DEBUG] Canal não encontrado: ${data.platform}/${data.channelName}`
          );
        }
        
        // Envia mensagem para o grupo
        if (data.groupId) {
          await this.bot.sendMessage(
            data.groupId,
            `❌ *Canal não encontrado*\n\nO canal do ${data.platform} com o nome *${data.channelName}* não foi encontrado e foi removido do monitoramento. Verifique se o nome está correto e configure-o novamente se necessário.`
          );
        }
      } catch (error) {
        this.logger.error(`[Bot ${botId}] Erro ao processar evento de canal não encontrado:`, error);
      }
    });
  }

  /**
   * Carrega canais para monitorar a partir dos grupos cadastrados
   * @param {boolean} cleanup - Se deve verificar e remover canais inexistentes (default: false)
   */
  async loadChannelsToMonitor(cleanup = false) {
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
          // Array para armazenar canais a serem removidos
          const channelsToRemove = [];
          
          for (const channel of group.twitch) {
            if(!channel.channel.startsWith("xxx_") && !channel.channel.includes("twitch")){
              // Se cleanup estiver ativado, verifica se o canal existe
              if (cleanup && this.streamMonitor) {
                const channelExists = await this.streamMonitor.twitchChannelExists(channel.channel);
                
                if (!channelExists) {
                  this.logger.info(`[loadChannelsToMonitor][Cleanup] Canal Twitch não encontrado: ${channel.channel} - Removendo do grupo ${group.id} (${group.name || 'sem nome'})`);
                  channelsToRemove.push(channel.channel.toLowerCase());
                  continue;
                }
                await sleep(500);
              }
              
              if (!subscribedChannels.twitch.includes(channel.channel)) {
                this.streamMonitor.subscribe(channel.channel, 'twitch');
                subscribedChannels.twitch.push(channel.channel);
              }
            } else {
              this.logger.info(`[loadChannelsToMonitor][${group.name}] ${channel.channel} ignorado por nome estranho`);
            }
          }
          
          // Remove canais inexistentes se cleanup estiver ativado
          if (cleanup && channelsToRemove.length > 0) {
            group.twitch = group.twitch.filter(c => !channelsToRemove.includes(c.channel.toLowerCase()));
            await this.bot.database.saveGroup(group);
            this.logger.info(`[loadChannelsToMonitor][Cleanup] Removidos ${channelsToRemove.length} canais inexistentes do grupo ${group.id}`, channelsToRemove);
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
      
      // Envia mensagem de depuração se habilitado
      if (this.debugNotificacoes && this.bot.grupoLogs) {
        this.bot.sendMessage(
          this.bot.grupoLogs, 
          `📊 [DEBUG] Canais monitorados:\n- Twitch: ${subscribedChannels.twitch.length}\n- Kick: ${subscribedChannels.kick.length}\n- YouTube: ${subscribedChannels.youtube.length}`
        );
      }
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
        
        if (this.debugNotificacoes && this.bot.grupoLogs) {
          await this.bot.sendMessage(
            this.bot.grupoLogs, 
            `🔇 [DEBUG] Ignorando notificação para grupo pausado: ${group.id} (${group.name || 'sem nome'})`
          );
        }
        
        return;
      }

      // Verifica se o bot ainda faz parte do grupo (usando o método da plataforma específica)
      let isMember = true;
      try {
        // Esta verificação deve ser adaptada conforme a plataforma (WhatsApp, Telegram, etc.)
        const chat = await this.bot.client.getChatById(group.id);
        if (!chat || !chat.isGroup) {
          this.logger.info(`Chat ${group.id} não é um grupo ou não foi encontrado`);
          isMember = false;
        }
      } catch (error) {
        this.logger.warn(`Erro ao acessar grupo ${group.id}: ${error.message}`);
        isMember = false;
      }

      // Se não for mais membro, pausa o grupo e salva no banco de dados
      if (!isMember) {
        this.logger.info(`Bot não é mais membro do grupo ${group.id}, definindo como pausado`);
        
        if (this.debugNotificacoes && this.bot.grupoLogs) {
          await this.bot.sendMessage(
            this.bot.grupoLogs, 
            `👋 [DEBUG] Bot não é mais membro do grupo ${group.id} (${group.name || 'sem nome'}), configurando como pausado`
          );
        }
        
        await this.bot.database.saveGroup(group);
        return;
      }

      // Obtém a configuração apropriada (onConfig para eventos online, offConfig para offline)
      const config = eventType === 'online' ? channelConfig.onConfig : channelConfig.offConfig;
      
      // Pula se não houver configuração
      if (!config || !config.media || config.media.length === 0) {
        this.logger.info(`Sem configuração de mídia para evento ${eventType} no grupo ${group.id}`);
        
        if (this.debugNotificacoes && this.bot.grupoLogs) {
          await this.bot.sendMessage(
            this.bot.grupoLogs, 
            `⚠️ [DEBUG] Sem configuração de mídia para evento ${eventType} no grupo ${group.id} (${group.name || 'sem nome'})`
          );
        }
      }
      
      // Armazena as ReturnMessages para enviar para o grupo
      const returnMessages = [];
      
      // Armazena as ReturnMessages para enviar para o grupo de logs (cópias das mensagens originais)
      const logReturnMessages = [];
      
      // Processa alteração de título se habilitada
      if (channelConfig.changeTitleOnEvent) {
        await this.changeGroupTitleForStream(group, channelConfig, eventData, eventType);
      }

      // Obter menções para todos os membros se a funcionalidade estiver ativada
      let mentions = [];
      if (channelConfig.mentionAllMembers && eventType === 'online') {
        mentions = await this.getAllMembersMentions(group.id);
      }
      
      // Processa notificações de mídia
      //if(!config.media.some(m => m.type == "text")){ // Não tem texto definido
        
    
      for (const mediaItem of config.media) {
        const returnMessage = await this.createEventNotification(group.id, mediaItem, eventData, channelConfig, mentions);
        if (returnMessage) {
          returnMessages.push(returnMessage);
          
          // Cria uma cópia da mensagem para o grupo de logs se depuração estiver habilitada
          if (this.debugNotificacoes && this.bot.grupoLogs) {
            // Cria uma cópia profunda da mensagem
            const logMessage = new ReturnMessage({
              chatId: this.bot.grupoLogs,
              content: returnMessage.content,
              options: {...returnMessage.options},
              delay: returnMessage.delay,
              reactions: returnMessage.reactions ? {...returnMessage.reactions} : null,
              metadata: returnMessage.metadata ? {...returnMessage.metadata} : {}
            });
            
            // Adiciona prefixo à legenda, se existir
            if (logMessage.options && logMessage.options.caption) {
              logMessage.options.caption = `[DEBUG-CÓPIA] Grupo: ${group.name || group.id}\n${logMessage.options.caption}`;
            }
            
            // Se for mensagem de texto, adiciona prefixo
            if (typeof logMessage.content === 'string') {
              logMessage.content = `[DEBUG-CÓPIA] Grupo: ${group.name || group.id}\n\n${logMessage.content}`;
            }
            
            logReturnMessages.push(logMessage);
          }
        }
      }
      
      // Gera mensagem de IA se habilitada
      if (channelConfig.useAI && eventType === 'online') {
        const aiMessage = await this.createAINotification(group.id, eventData, channelConfig, mentions);
        if (aiMessage) {
          returnMessages.push(aiMessage);
          
          // Cria uma cópia da mensagem IA para o grupo de logs
          if (this.debugNotificacoes && this.bot.grupoLogs) {
            const logAiMessage = new ReturnMessage({
              chatId: this.bot.grupoLogs,
              content: `[DEBUG-CÓPIA-IA] Grupo: ${group.name || group.id}\n\n${aiMessage.content}`,
              delay: aiMessage.delay,
              reactions: aiMessage.reactions ? {...aiMessage.reactions} : null
            });
            
            logReturnMessages.push(logAiMessage);
          }
        }
      }
      
      for(let r  of returnMessages){
        //r.delay = 300;
      }

      // Envia as mensagens originais para o grupo
      if (returnMessages.length > 0) {
        if(!group.botNotInGroup){
          group.botNotInGroup = [];
        }

        // Verifica se o bot está marcado como fora desse grupo antes de tentar enviar
        if(group.botNotInGroup.includes(this.bot.id)){
          this.logger.info(`[processStreamEvent][${this.bot.id}][${eventData.channelName}][${group.name}] O bot está marcado como não estando neste grupo, ignorando evento.`);
        } else {
          const resultados = await this.bot.sendReturnMessages(returnMessages);
          // Aqui dá pra verificar se foi possível entregar a mensagem
          let nenhumaEnviada = true;

          for(let resultado of resultados){
            const resInfo = await resultado.getInfo();

            if(resInfo.delivery.length == 0 && resInfo.played.length == 0 && resInfo.read.length == 0){
              this.logger.debug(`[processStreamEvent][${this.bot.id}][${eventData.channelName}][${group.name}] Msg notificação NÃO FOI ENVIADA!`, resInfo);
            } else {
              this.logger.debug(`[processStreamEvent][${this.bot.id}][${eventData.channelName}][${group.name}] Msg retorno enviada ok`);
              nenhumaEnviada = false;
            }
          }

          // Se nenhuma enviada, o bot não tá no grupo e ainda não sabia
          if(nenhumaEnviada){
            this.logger.info(`[processStreamEvent] O bot ${this.bot.id} não conseguiu enviar mensagens sobre a live '${eventData.channelName}' para o grupo ${group.name}/${group.id}, ignorando daqui pra frente`);
            group.botNotInGroup.push(this.bot.id);
            await this.bot.database.saveGroup(group);
          }
        }
        
        if (this.debugNotificacoes && this.bot.grupoLogs) {
          await this.bot.sendMessage(
            this.bot.grupoLogs, 
            `✅ [DEBUG] Enviadas ${returnMessages.length} mensagens para o grupo ${group.id} (${group.name || 'sem nome'}) sobre ${eventData.platform}/${eventData.channelName}`
          );
        }
      } else {
        if (this.debugNotificacoes && this.bot.grupoLogs) {
          await this.bot.sendMessage(
            this.bot.grupoLogs, 
            `❌ [DEBUG] Nenhuma mensagem enviada para o grupo ${group.id} (${group.name || 'sem nome'}) sobre ${eventData.platform}/${eventData.channelName}`
          );
        }
      }
      
      // Envia as cópias das mensagens para o grupo de logs
      if (logReturnMessages.length > 0) {
        // Adiciona um pequeno atraso para garantir que as mensagens cheguem em ordem após o log
        await new Promise(resolve => setTimeout(resolve, 500));
        this.bot.sendReturnMessages(logReturnMessages);
      }
    } catch (error) {
      this.logger.error(`Erro ao processar evento de stream para ${group.id}:`, error);
      
      if (this.debugNotificacoes && this.bot.grupoLogs) {
        await this.bot.sendMessage(
          this.bot.grupoLogs, 
          `🔥 [DEBUG] Erro ao processar evento para grupo ${group.id}: ${error.message}`
        );
      }
    }
  }

    /**
   * Obtém as menções para todos os membros do grupo, excluindo os ignorados
   * @param {string} groupId - ID do grupo
   * @returns {Promise<Array<string>>} - Array de strings de menção
   */
  async getAllMembersMentions(groupId) {
    try {
      // Obter o grupo do banco de dados
      const group = await this.bot.database.getGroup(groupId);
      if (!group) return [];
      
      // Obter o chat para acessar participantes
      const chat = await this.bot.client.getChatById(groupId);
      if (!chat || !chat.isGroup) return [];
      
      // Obter usuários ignorados para este grupo
      const ignoredUsers = group.ignoredUsers || [];
      
      // Filtrar usuários ignorados
      const participants = chat.participants.filter(
        participant => !ignoredUsers.includes(participant.id._serialized)
      );
      
      // Criar array de menções
      const mentions = participants.map(p => p.id._serialized);
      
      return mentions;
    } catch (error) {
      this.logger.error(`Erro ao obter menções para grupo ${groupId}:`, error);
      return [];
    }
  }

  /*
    * Altera os emojis de cor vede pra vermelha
  */
  substituirEmojis(str) {
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

    let resultado = '';
    const caracteres = Array.from(str);
    
    for (let i = 0; i < caracteres.length; i++) {
      let emoji = caracteres[i];
      
      // Lidar com emojis que têm modificador de variação
      if (i + 1 < caracteres.length && caracteres[i+1] === '️') {
        emoji = emoji + caracteres[i+1];
        i++; // Pular o modificador
      }
      
      // Substituir se estiver no mapa
      if (emojiMap[emoji]) {
        resultado += emojiMap[emoji];
      } else {
        resultado += emoji;
      }
    }
    
    return resultado;
  }

  /**
   * Altera o título e a foto do grupo com base em evento de stream
   * @param {Object} group - Dados do grupo
   * @param {Object} channelConfig - Configuração do canal
   * @param {Object} eventData - Dados do evento
   * @param {string} eventType - Tipo de evento ('online' ou 'offline')
   */
  async changeGroupTitleForStream(group, channelConfig, eventData, eventType) {
    try {

      console.log("changeGroupTitleForStream", channelConfig, eventData, eventType);

      // Obtém o chat do grupo atual (esta parte é específica da plataforma)
      const chat = await this.bot.client.getChatById(group.id);
      if (!chat || !chat.isGroup) return;
      
      // Mudança de título se configurado
      if (channelConfig.changeTitleOnEvent) {
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
          newTitle = this.substituirEmojis(newTitle);
        }
        
        // Define o novo título
        try {
          await chat.setSubject(newTitle);
          this.logger.info(`Alterado título do grupo ${group.id} para: ${newTitle}`);
          
          if (this.debugNotificacoes && this.bot.grupoLogs) {
            await this.bot.sendMessage(
              this.bot.grupoLogs, 
              `🔄 [DEBUG] Título alterado para grupo ${group.id} (${group.name || 'sem nome'}):\nAntigo: ${chat.name}\nNovo: ${newTitle}`
            );
          }
        } catch (titleError) {
          this.logger.error(`Erro ao alterar título do grupo ${group.id}:`, titleError);
        }
      }
      
      // Mudança de foto do grupo se configurada
      if (eventType === 'online' && channelConfig.groupPhotoOnline) {
        try {
          const photoData = channelConfig.groupPhotoOnline;
          if (photoData && photoData.data && photoData.mimetype) {
            // Cria o objeto de mídia
            const { MessageMedia } = require('whatsapp-web.js');
            const media = new MessageMedia(photoData.mimetype, photoData.data);
            
            // Define a nova foto
            await chat.setPicture(media);
            
            this.logger.info(`Alterada foto do grupo ${group.id} para foto online`);
            
            if (this.debugNotificacoes && this.bot.grupoLogs) {
              await this.bot.sendMessage(
                this.bot.grupoLogs, 
                `🖼️ [DEBUG] Foto alterada (online) para grupo ${group.id} (${group.name || 'sem nome'})`
              );
            }
          }
        } catch (photoError) {
          this.logger.error(`Erro ao alterar foto do grupo ${group.id} (online):`, photoError);
        }
      } else if (eventType === 'offline' && channelConfig.groupPhotoOffline) {
        try {
          const photoData = channelConfig.groupPhotoOffline;
          if (photoData && photoData.data && photoData.mimetype) {
            // Cria o objeto de mídia
            const { MessageMedia } = require('whatsapp-web.js');
            const media = new MessageMedia(photoData.mimetype, photoData.data);
            
            // Define a nova foto
            await chat.setPicture(media);
            
            this.logger.info(`Alterada foto do grupo ${group.id} para foto offline`);
            
            if (this.debugNotificacoes && this.bot.grupoLogs) {
              await this.bot.sendMessage(
                this.bot.grupoLogs, 
                `🖼️ [DEBUG] Foto alterada (offline) para grupo ${group.id} (${group.name || 'sem nome'})`
              );
            }
          }
        } catch (photoError) {
          this.logger.error(`Erro ao alterar foto do grupo ${group.id} (offline):`, photoError);
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao alterar título/foto do grupo ${group.id}:`, error);
      
      if (this.debugNotificacoes && this.bot.grupoLogs) {
        await this.bot.sendMessage(
          this.bot.grupoLogs, 
          `⚠️ [DEBUG] Erro ao alterar título/foto do grupo ${group.id}: ${error.message}`
        );
      }
    }
  }

  /**
   * Cria uma notificação de evento para um grupo
   * @param {string} groupId - ID do grupo
   * @param {Object} mediaItem - Configuração de mídia
   * @param {Object} eventData - Dados do evento
   * @param {Object} channelConfig - Configuração do canal
   * @param {Array<string>} mentions - Menções para incluir na mensagem
   * @returns {Promise<ReturnMessage|null>} - A mensagem de retorno
   */
  async createEventNotification(groupId, mediaItem, eventData, channelConfig, mentions = []) {
    try {

      this.logger.info(`[createEventNotification][${groupId}][${mediaItem}] ${JSON.stringify(eventData)}`);
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
        
        // Cria a mensagem de retorno com opções de menções, se disponíveis
        if (channelConfig.useThumbnail && eventData.thumbnail && eventData.thumbnail?.includes("https")) {
          this.logger.info(`[createEventNotification] Thumbnail: ${eventData.thumbnail}`);
          const media = await this.bot.createMediaFromURL(eventData.thumbnail);

          return new ReturnMessage({
            chatId: groupId,
            content: media,
            options: {
                caption: content,
                mentions: mentions.length > 0 ? mentions : undefined
            }
          });  
        } else {
          return new ReturnMessage({
            chatId: groupId,
            content: content,
            options: {
              mentions: mentions.length > 0 ? mentions : undefined
            }
          });  
        }
        
      } else if (mediaItem.type === 'image' || mediaItem.type === 'video' || 
                mediaItem.type === 'audio' || mediaItem.type === 'sticker') {
        // Carrega arquivo de mídia
        const mediaPath = path.join(this.mediaPath, mediaItem.content);
        
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
          
          // Cria a mensagem de retorno, incluindo menções se fornecidas
          return new ReturnMessage({
            chatId: groupId,
            content: media,
            options: {
              caption: caption || undefined,
              sendMediaAsSticker: mediaItem.type === 'sticker',
              mentions: mentions.length > 0 ? mentions : undefined
            }
          });
        } catch (error) {
          this.logger.error(`Erro ao enviar notificação de mídia (${mediaPath}):`, error);
          
          if (this.debugNotificacoes && this.bot.grupoLogs) {
            await this.bot.sendMessage(
              this.bot.grupoLogs, 
              `⚠️ [DEBUG] Erro ao processar mídia ${mediaPath} para grupo ${groupId}: ${error.message}`
            );
          }
          
          // Fallback para mensagem de texto
          return new ReturnMessage({
            chatId: groupId,
            content: `Erro ao enviar notificação de mídia para evento de ${eventData.platform}/${eventData.channelName}.\nConfigure novamente suas mídias de stream usando o comando *!g-twitch-midia*`
          });
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Erro ao criar notificação de evento para ${groupId}:`, error);
      
      if (this.debugNotificacoes && this.bot.grupoLogs) {
        await this.bot.sendMessage(
          this.bot.grupoLogs, 
          `⚠️ [DEBUG] Erro ao criar notificação para grupo ${groupId}: ${error.message}`
        );
      }
      
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
        prompt = `O canal ${eventData.channelName} ficou online e está jogando ${eventData.game || 'um jogo'} com o título "${eventData.title || ''}". Gere uma mensagem animada para convidar a galera do grupo a participar da stream. Não use placeholders pois a mensagem será enviada da forma que você responder. A mensagem deve estar pronta para uso.`;
      } else if (eventData.platform === 'youtube') {
        prompt = `O canal ${eventData.channelName} acabou de lançar um novo vídeo chamado "${eventData.title || ''}". Gere uma mensagem animada para convidar a galera do grupo a assistir o vídeo.  Não use placeholders pois a mensagem será enviada da forma que você responder. A mensagem deve estar pronta para uso.`;
      }
      
      if (this.debugNotificacoes && this.bot.grupoLogs) {
        await this.bot.sendMessage(
          this.bot.grupoLogs, 
          `🤖 [DEBUG] Gerando mensagem IA para grupo ${groupId}, prompt: "${prompt}"`
        );
      }
      
      // Obtém resposta da IA
      const aiResponse = await this.llmService.getCompletion({prompt: prompt});
      
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
      
      if (this.debugNotificacoes && this.bot.grupoLogs) {
        await this.bot.sendMessage(
          this.bot.grupoLogs, 
          `⚠️ [DEBUG] Erro ao criar notificação IA para grupo ${groupId}: ${error.message}`
        );
      }
      
      return null;
    }
  }

  /**
   * Adiciona canal para monitoramento
   * @param {string} channel - Nome do canal
   * @param {string} platform - Nome da plataforma ('twitch', 'kick', 'youtube')
   * @returns {boolean} - Se a operação foi bem-sucedida
   */
  subscribe(channel, platform) {
    try {
      if (!channel || !platform) return false;
      
      if (!this.streamMonitor) {
        this.logger.error('StreamMonitor não inicializado');
        return false;
      }
      
      this.streamMonitor.subscribe(channel, platform);
      this.logger.info(`Canal adicionado para monitoramento: ${platform}/${channel}`);
      
      if (this.debugNotificacoes && this.bot.grupoLogs) {
        this.bot.sendMessage(
          this.bot.grupoLogs, 
          `➕ [DEBUG] Canal adicionado para monitoramento: ${platform}/${channel}`
        );
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Erro ao adicionar canal para monitoramento: ${platform}/${channel}`, error);
      return false;
    }
  }

  /**
   * Remove canal do monitoramento
   * @param {string} channel - Nome do canal
   * @param {string} platform - Nome da plataforma ('twitch', 'kick', 'youtube')
   * @returns {boolean} - Se a operação foi bem-sucedida
   */
  unsubscribe(channel, platform) {
    try {
      if (!channel || !platform) return false;
      
      if (!this.streamMonitor) {
        this.logger.error('StreamMonitor não inicializado');
        return false;
      }
      
      this.streamMonitor.unsubscribe(channel, platform);
      this.logger.info(`Canal removido do monitoramento: ${platform}/${channel}`);
      
      if (this.debugNotificacoes && this.bot.grupoLogs) {
        this.bot.sendMessage(
          this.bot.grupoLogs, 
          `➖ [DEBUG] Canal removido do monitoramento: ${platform}/${channel}`
        );
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Erro ao remover canal do monitoramento: ${platform}/${channel}`, error);
      return false;
    }
  }

  /**
   * Destrói o sistema de monitoramento
   * Obs: Não para o monitoramento, apenas remove a referência local
   */
  destroy() {
    // Como o StreamMonitor é compartilhado, não devemos parar o monitoramento
    // apenas remover nossa referência e logs
    this.logger.info(`[Bot ${this.bot.id}] Destruindo referência ao sistema de monitoramento de streams`);
    
    if (this.debugNotificacoes && this.bot.grupoLogs) {
      this.bot.sendMessage(
        this.bot.grupoLogs, 
        `🛑 [DEBUG] Referência ao sistema de monitoramento de streams destruída (o monitoramento compartilhado continua ativo)`
      );
    }
    
    // Removemos apenas a referência local
    this.streamMonitor = null;
  }
}

module.exports = StreamSystem;