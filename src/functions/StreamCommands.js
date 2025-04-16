const path = require('path');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');

const logger = new Logger('stream-commands');
const database = Database.getInstance();

logger.info('Módulo StreamCommands carregado');

const commands = [
  {
    name: 'streams',
    description: 'Lista todos os canais configurados para monitoramento',
    category: 'stream',
    reactions: {
      before: "📺",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await listMonitoredChannels(bot, message, args, group);
    }
  },
  {
    name: 'streamstatus',
    description: 'Mostra status dos canais monitorados',
    category: 'stream',
    reactions: {
      before: "📊",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await showStreamStatus(bot, message, args, group);
    }
  }
];

/**
 * Lista todos os canais configurados para monitoramento no grupo
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 */
async function listMonitoredChannels(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    if (!group) {
      await bot.sendMessage(chatId, 'Este comando só pode ser usado em grupos.');
      return;
    }
    
    // Verifica se há canais configurados
    const twitchChannels = Array.isArray(group.twitch) ? group.twitch : [];
    const kickChannels = Array.isArray(group.kick) ? group.kick : [];
    const youtubeChannels = Array.isArray(group.youtube) ? group.youtube : [];
    
    const totalChannels = twitchChannels.length + kickChannels.length + youtubeChannels.length;
    
    if (totalChannels === 0) {
      await bot.sendMessage(chatId, 'Nenhum canal configurado para monitoramento neste grupo.\n\nUse os comandos:\n!g-twitch-canal\n!g-kick-canal\n!g-youtube-canal');
      return;
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
    
    await bot.sendMessage(chatId, response);
  } catch (error) {
    logger.error('Erro ao listar canais monitorados:', error);
    await bot.sendMessage(message.group || message.author, 'Erro ao listar canais monitorados. Por favor, tente novamente.');
  }
}

/**
 * Mostra o status atual dos canais monitorados
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 */
async function showStreamStatus(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    if (!group) {
      await bot.sendMessage(chatId, 'Este comando só pode ser usado em grupos.');
      return;
    }
    
    // Verifica se o StreamMonitor está inicializado
    if (!bot.streamMonitor) {
      await bot.sendMessage(chatId, 'O sistema de monitoramento de streams não está inicializado.');
      return;
    }
    
    // Obtém canais configurados para este grupo
    const twitchChannels = Array.isArray(group.twitch) ? group.twitch.map(c => c.channel.toLowerCase()) : [];
    const kickChannels = Array.isArray(group.kick) ? group.kick.map(c => c.channel.toLowerCase()) : [];
    const youtubeChannels = Array.isArray(group.youtube) ? group.youtube.map(c => c.channel.toLowerCase()) : [];
    
    const totalChannels = twitchChannels.length + kickChannels.length + youtubeChannels.length;
    
    if (totalChannels === 0) {
      await bot.sendMessage(chatId, 'Nenhum canal configurado para monitoramento neste grupo.');
      return;
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
    
    await bot.sendMessage(chatId, response);
  } catch (error) {
    logger.error('Erro ao mostrar status dos streams:', error);
    await bot.sendMessage(message.group || message.author, 'Erro ao mostrar status dos streams. Por favor, tente novamente.');
  }
}

// Registra os comandos sendo exportados
logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };