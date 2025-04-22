const path = require('path');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

const logger = new Logger('stream-commands');
const database = Database.getInstance();

//logger.info('Módulo StreamCommands carregado');

/**
 * Lista todos os canais configurados para monitoramento no grupo
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com a lista de canais
 */
async function listMonitoredChannels(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    if (!group) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Verifica se há canais configurados
    const twitchChannels = Array.isArray(group.twitch) ? group.twitch : [];
    const kickChannels = Array.isArray(group.kick) ? group.kick : [];
    const youtubeChannels = Array.isArray(group.youtube) ? group.youtube : [];
    
    const totalChannels = twitchChannels.length + kickChannels.length + youtubeChannels.length;
    
    if (totalChannels === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Nenhum canal configurado para monitoramento neste grupo.\n\nUse os comandos:\n!g-twitch-canal\n!g-kick-canal\n!g-youtube-canal'
      });
    }
    
    // Constrói mensagem
    let response = `*Canais Monitorados neste Grupo*\n\n`;
    
    // Lista canais Twitch
    if (twitchChannels.length > 0) {
      response += `*Twitch:*\n`;
      for (const channel of twitchChannels) {
        const titleChange = channel.changeTitleOnEvent ? '✅' : '❌';
        const useAI = channel.useAI ? '✅' : '❌';
        
        response += `• ${channel.channel}\n`;
        response += `  - Notificação online: ${channel.onConfig?.media?.length || 0} item(s)\n`;
        response += `  - Notificação offline: ${channel.offConfig?.media?.length || 0} item(s)\n`;
        response += `  - Alterar título: ${titleChange}\n`;
        response += `  - Usar IA: ${useAI}\n\n`;
      }
    }
    
    // Lista canais Kick
    if (kickChannels.length > 0) {
      response += `*Kick:*\n`;
      for (const channel of kickChannels) {
        const titleChange = channel.changeTitleOnEvent ? '✅' : '❌';
        const useAI = channel.useAI ? '✅' : '❌';
        
        response += `• ${channel.channel}\n`;
        response += `  - Notificação online: ${channel.onConfig?.media?.length || 0} item(s)\n`;
        response += `  - Notificação offline: ${channel.offConfig?.media?.length || 0} item(s)\n`;
        response += `  - Alterar título: ${titleChange}\n`;
        response += `  - Usar IA: ${useAI}\n\n`;
      }
    }
    
    // Lista canais YouTube
    if (youtubeChannels.length > 0) {
      response += `*YouTube:*\n`;
      for (const channel of youtubeChannels) {
        const titleChange = channel.changeTitleOnEvent ? '✅' : '❌';
        const useAI = channel.useAI ? '✅' : '❌';
        
        response += `• ${channel.channel}\n`;
        response += `  - Notificação de vídeo: ${channel.onConfig?.media?.length || 0} item(s)\n`;
        response += `  - Alterar título: ${titleChange}\n`;
        response += `  - Usar IA: ${useAI}\n\n`;
      }
    }
    
    return new ReturnMessage({
      chatId: chatId,
      content: response
    });
  } catch (error) {
    logger.error('Erro ao listar canais monitorados:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao listar canais monitorados. Por favor, tente novamente.'
    });
  }
}

/**
 * Mostra o status atual dos canais monitorados
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com status dos canais
 */
async function showStreamStatus(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    if (!group) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Verifica se o StreamMonitor está inicializado
    if (!bot.streamMonitor) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'O sistema de monitoramento de streams não está inicializado.'
      });
    }
    
    // Obtém canais configurados para este grupo
    const twitchChannels = Array.isArray(group.twitch) ? group.twitch.map(c => c.channel.toLowerCase()) : [];
    const kickChannels = Array.isArray(group.kick) ? group.kick.map(c => c.channel.toLowerCase()) : [];
    const youtubeChannels = Array.isArray(group.youtube) ? group.youtube.map(c => c.channel.toLowerCase()) : [];
    
    const totalChannels = twitchChannels.length + kickChannels.length + youtubeChannels.length;
    
    if (totalChannels === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Nenhum canal configurado para monitoramento neste grupo.'
      });
    }
    
    // Obtém status atual dos streams
    const streamStatus = bot.streamMonitor.getStreamStatus();
    
    // Constrói mensagem
    let response = `*Status dos Canais Monitorados*\n\n`;
    
    // Status canais Twitch
    if (twitchChannels.length > 0) {
      response += `*Twitch:*\n`;
      for (const channelName of twitchChannels) {
        const channelKey = `twitch:${channelName}`;
        const status = streamStatus[channelKey];
        
        if (status && status.isLive) {
          response += `• ${channelName}: 🟢 *ONLINE*\n`;
          response += `  - Título: ${status.title || 'N/A'}\n`;
          response += `  - Viewers: ${status.viewerCount || 'N/A'}\n`;
          response += `  - Online desde: ${new Date(status.startedAt || Date.now()).toLocaleString()}\n\n`;
        } else {
          response += `• ${channelName}: 🔴 *OFFLINE*\n\n`;
        }
      }
    }
    
    // Status canais Kick
    if (kickChannels.length > 0) {
      response += `*Kick:*\n`;
      for (const channelName of kickChannels) {
        const channelKey = `kick:${channelName}`;
        const status = streamStatus[channelKey];
        
        if (status && status.isLive) {
          response += `• ${channelName}: 🟢 *ONLINE*\n`;
          response += `  - Título: ${status.title || 'N/A'}\n`;
          response += `  - Viewers: ${status.viewerCount || 'N/A'}\n`;
          response += `  - Online desde: ${new Date(status.startedAt || Date.now()).toLocaleString()}\n\n`;
        } else {
          response += `• ${channelName}: 🔴 *OFFLINE*\n\n`;
        }
      }
    }
    
    // Status canais YouTube
    if (youtubeChannels.length > 0) {
      response += `*YouTube:*\n`;
      for (const channelName of youtubeChannels) {
        const channelKey = `youtube:${channelName}`;
        const status = streamStatus[channelKey];
        
        if (status) {
          if (status.isLive) {
            response += `• ${channelName}: 🟢 *LIVE*\n`;
            if (status.lastVideo) {
              response += `  - Título: ${status.lastVideo.title || 'N/A'}\n`;
              response += `  - Link: ${status.lastVideo.url || 'N/A'}\n\n`;
            }
          } else if (status.lastVideo) {
            response += `• ${channelName}: 📹 *Último vídeo*\n`;
            response += `  - Título: ${status.lastVideo.title || 'N/A'}\n`;
            response += `  - Publicado: ${new Date(status.lastVideo.publishedAt || Date.now()).toLocaleString()}\n`;
            response += `  - Link: ${status.lastVideo.url || 'N/A'}\n\n`;
          } else {
            response += `• ${channelName}: ❓ *Status desconhecido*\n\n`;
          }
        } else {
          response += `• ${channelName}: ❓ *Status desconhecido*\n\n`;
        }
      }
    }
    
    return new ReturnMessage({
      chatId: chatId,
      content: response
    });
  } catch (error) {
    logger.error('Erro ao mostrar status dos streams:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao mostrar status dos streams. Por favor, tente novamente.'
    });
  }
}

/**
 * Lista todos os streamers online que usam o bot
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com a lista de streamers online
 */
async function listOnlineStreamers(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Verifica se o StreamMonitor está inicializado
    if (!bot.streamMonitor) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'O sistema de monitoramento de streams não está inicializado.'
      });
    }
    
    // Obtém o status atual de todos os streams
    const streamStatus = bot.streamMonitor.getStreamStatus();
    
    // Filtra apenas os streams online
    const onlineStreams = Object.entries(streamStatus).filter(([key, status]) => 
      status && status.isLive
    ).map(([key, status]) => {
      // Extrai plataforma e nome do canal da chave (formato: "plataforma:nomeCanal")
      const [platform, ...channelParts] = key.split(':');
      const channelName = channelParts.join(':'); // Reconstitui o nome do canal caso tenha ':' no nome
      
      return {
        platform,
        channelName,
        title: status.title || 'Sem título',
        game: status.game || status.category || 'Jogo desconhecido',
        viewerCount: status.viewerCount || 0,
        startedAt: status.startedAt || null
      };
    });
    
    if (onlineStreams.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Nenhum streamer monitorado está online no momento.'
      });
    }
    
    // Agrupa por plataforma
    const streamsByPlatform = onlineStreams.reduce((acc, stream) => {
      if (!acc[stream.platform]) {
        acc[stream.platform] = [];
      }
      acc[stream.platform].push(stream);
      return acc;
    }, {});
    
    // Constrói a mensagem de resposta
    let response = `🎮 *Streamers que usam a ravenabot*:\n\n`;
    
    // Adiciona streamers da Twitch
    if (streamsByPlatform.twitch && streamsByPlatform.twitch.length > 0) {
      response += `💜 *Twitch*:\n`;
      for (const stream of streamsByPlatform.twitch) {
        response += `   - *${stream.channelName}*: ${stream.game} _(${stream.viewerCount} viewers)_\n`;
      }
      response += '\n';
    }
    
    // Adiciona streamers do Kick
    if (streamsByPlatform.kick && streamsByPlatform.kick.length > 0) {
      response += `💚 *Kick*:\n`;
      for (const stream of streamsByPlatform.kick) {
        response += `   - *${stream.channelName}*: ${stream.game} _(${stream.viewerCount} viewers)_\n`;
      }
      response += '\n';
    }
    
    // Adiciona canais do YouTube em live
    if (streamsByPlatform.youtube && streamsByPlatform.youtube.length > 0) {
      response += `❤️ *YouTube*:\n`;
      for (const stream of streamsByPlatform.youtube) {
        response += `   - *${stream.channelName}*: ${stream.title} _(${stream.viewerCount} viewers)_\n`;
      }
      response += '\n';
    }
    
    return new ReturnMessage({
      chatId: chatId,
      content: response
    });
  } catch (error) {
    logger.error('Erro ao listar streamers online:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao listar streamers online. Por favor, tente novamente.'
    });
  }
}

/**
 * Exibe informações de uma stream da Twitch
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage com informações da stream
 */
async function showLiveInfo(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Verifica se o StreamMonitor está inicializado
    if (!bot.streamMonitor) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'O sistema de monitoramento de streams não está inicializado.'
      });
    }
    
    // Se não foram fornecidos argumentos, busca todas as streams configuradas no grupo
    if (args.length === 0 && group) {
      const twitchChannels = Array.isArray(group.twitch) ? group.twitch.map(c => c.channel.toLowerCase()) : [];
      
      if (twitchChannels.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Nenhum canal Twitch configurado neste grupo. Use !g-twitch-canal [nomeCanal] para configurar.'
        });
      }
      
      // Gera uma mensagem para cada canal configurado
      const returnMessages = [];
      for (const channelName of twitchChannels) {
        const streamInfo = await getStreamInformation(bot, 'twitch', channelName);
        returnMessages.push(streamInfo);
      }
      
      return returnMessages;
    }
    
    // Se foi fornecido um nome de canal, busca informações apenas dele
    const channelName = args[0].toLowerCase();
    return await getStreamInformation(bot, 'twitch', channelName);
  } catch (error) {
    logger.error('Erro ao exibir informações de stream Twitch:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao obter informações da stream. Por favor, tente novamente.'
    });
  }
}

/**
 * Exibe informações de uma stream do Kick
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage com informações da stream
 */
async function showLiveKick(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Verifica se o StreamMonitor está inicializado
    if (!bot.streamMonitor) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'O sistema de monitoramento de streams não está inicializado.'
      });
    }
    
    // Se não foram fornecidos argumentos, busca todas as streams configuradas no grupo
    if (args.length === 0 && group) {
      const kickChannels = Array.isArray(group.kick) ? group.kick.map(c => c.channel.toLowerCase()) : [];
      
      if (kickChannels.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Nenhum canal Kick configurado neste grupo. Use !g-kick-canal [nomeCanal] para configurar.'
        });
      }
      
      // Gera uma mensagem para cada canal configurado
      const returnMessages = [];
      for (const channelName of kickChannels) {
        const streamInfo = await getStreamInformation(bot, 'kick', channelName);
        returnMessages.push(streamInfo);
      }
      
      return returnMessages;
    }
    
    // Se foi fornecido um nome de canal, busca informações apenas dele
    const channelName = args[0].toLowerCase();
    return await getStreamInformation(bot, 'kick', channelName);
  } catch (error) {
    logger.error('Erro ao exibir informações de stream Kick:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao obter informações da stream. Por favor, tente novamente.'
    });
  }
}

/**
 * Função auxiliar para obter informações detalhadas de uma stream
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {string} platform - Plataforma (twitch, kick, youtube)
 * @param {string} channelName - Nome do canal
 * @returns {Promise<ReturnMessage>} - ReturnMessage com informações da stream
 */
async function getStreamInformation(bot, platform, channelName) {
  try {
    const streamStatus = bot.streamMonitor.getStreamStatus();
    const channelKey = `${platform}:${channelName.toLowerCase()}`;
    const status = streamStatus[channelKey];
    
    // Verifica se o canal está sendo monitorado
    if (!status) {
      return new ReturnMessage({
        chatId: bot.client.info.wid._serialized, // Valor temporário, será substituído
        content: `O canal ${channelName} (${platform}) não está sendo monitorado.`
      });
    }
    
    // Prepara a mensagem com base no status
    if (status.isLive) {
      // Canal está online
      let streamDuration = '';
      if (status.startedAt) {
        const startTime = new Date(status.startedAt);
        const now = new Date();
        const durationMs = now - startTime;
        
        // Calcula a duração formatada
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        streamDuration = `${hours}h ${minutes}m`;
      }
      
      // Prepara a mensagem textual
      const content = `🔴 *LIVE: ${channelName}* (${platform})\n\n` +
                     `📝 *Título:* ${status.title || 'Sem título'}\n` +
                     `🎮 *Jogo:* ${status.game || status.category || 'Não informado'}\n` +
                     `👁️ *Viewers:* ${status.viewerCount || 'Não informado'}\n` +
                     `⏱️ *Duração:* ${streamDuration || 'Não informado'}\n\n` +
                     `🔗 *Link:* https://${platform}.${platform === 'youtube' ? 'com/watch?v=' + status.lastVideo?.id : 'tv/' + channelName}`;
      
      // Se o canal tem thumbnail, tenta baixá-la e enviar como imagem
      if (status.thumbnail) {
        try {
          // Tenta baixar a thumbnail
          const { default: axios } = require('axios');
          const response = await axios.get(status.thumbnail, { responseType: 'arraybuffer' });
          const thumbnailBuffer = Buffer.from(response.data);
          
          // Cria o objeto MessageMedia
          const { MessageMedia } = require('whatsapp-web.js');
          const media = new MessageMedia('image/jpeg', thumbnailBuffer.toString('base64'));
          
          // Retorna uma mensagem com mídia
          return new ReturnMessage({
            chatId: bot.client.info.wid._serialized, // Valor temporário, será substituído
            content: media,
            options: {
              caption: content
            }
          });
        } catch (mediaError) {
          logger.error(`Erro ao obter thumbnail para ${channelName}:`, mediaError);
          // Fallback para mensagem de texto
          return new ReturnMessage({
            chatId: bot.client.info.wid._serialized, // Valor temporário, será substituído
            content: content
          });
        }
      } else {
        // Sem thumbnail, envia apenas a mensagem de texto
        return new ReturnMessage({
          chatId: bot.client.info.wid._serialized, // Valor temporário, será substituído
          content: content
        });
      }
    } else {
      // Canal está offline
      let lastVideoInfo = '';
      if (platform === 'youtube' && status.lastVideo) {
        lastVideoInfo = `\n\n📹 *Último vídeo:* ${status.lastVideo.title}\n` +
                       `📅 *Publicado:* ${new Date(status.lastVideo.publishedAt).toLocaleString()}`;
      }
      
      return new ReturnMessage({
        chatId: bot.client.info.wid._serialized, // Valor temporário, será substituído
        content: `📴 O canal ${channelName} (${platform}) está offline no momento.${lastVideoInfo}`
      });
    }
  } catch (error) {
    logger.error(`Erro ao obter informações para ${platform}/${channelName}:`, error);
    
    return new ReturnMessage({
      chatId: bot.client.info.wid._serialized, // Valor temporário, será substituído
      content: `Erro ao obter informações para ${channelName} (${platform}). Por favor, tente novamente.`
    });
  }
}



// Lista de comandos utilizando a classe Command
const commands = [
  new Command({
    name: 'streams',
    description: 'Lista todos os canais configurados para monitoramento',
    category: 'streams',
    reactions: {
      before: "⏳",
      after: "📺"
    },
    method: listMonitoredChannels
  }),
  
  new Command({
    name: 'streamstatus',
    description: 'Mostra status dos canais monitorados',
    category: 'streams',
    reactions: {
      before: "⏳",
      after: "📊"
    },
    method: showStreamStatus
  }),

    // Novos comandos para listar streamers online
  new Command({
    name: 'streamers',
    description: 'Lista todos os streamers atualmente online',
    category: 'streams',
    reactions: {
      before: "⏳",
      after: "🎮"
    },
    method: listOnlineStreamers
  }),
  new Command({
    name: 'live',
    description: 'Mostra informações de uma stream da Twitch',
    category: 'streams',
    reactions: {
      before: "⏳",
      after: "💜"
    },
    method: showLiveInfo
  }),
  
  new Command({
    name: 'live-kick',
    description: 'Mostra informações de uma stream do Kick',
    category: 'streams',
    reactions: {
      before: "⏳",
      after: "💚"
    },
    method: showLiveKick
  })
];

// Registra os comandos sendo exportados
//logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };