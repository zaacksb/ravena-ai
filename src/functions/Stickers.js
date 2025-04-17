const path = require('path');
const Logger = require('../utils/Logger');
const fs = require('fs').promises;
const Database = require('../utils/Database');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');

const logger = new Logger('sticker-commands');
const database = Database.getInstance();

logger.info('Módulo StickerCommands carregado');

/**
 * Processa comando para converter mídia em sticker
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com o sticker
 */
async function stickerCommand(bot, message, args, group) {
  const chatId = message.group || message.author;
  logger.debug(`Executando comando sticker para ${chatId}`);
  
  // Manipula mídia direta
  if (message.type === 'image' || message.type === 'video' || message.type === 'gif') {
    try {
      // Extrai nome do sticker dos args ou usa nome do grupo
      const stickerName = args.length > 0 ? args.join(' ') : (group ? group.name : 'sticker');
      
      // Cria ReturnMessage com opções para sticker
      return new ReturnMessage({
        chatId: chatId,
        content: message.content,
        options: {
          sendMediaAsSticker: true,
          stickerAuthor: "ravena",
          stickerName: stickerName,
          quotedMessageId: message.origin.id._serialized
        }
      });
    } catch (error) {
      logger.error('Erro ao criar sticker:', error);
      
      // Tenta aplicar reação de erro diretamente
      try {
        await message.origin.react("❌");
      } catch (reactError) {
        logger.error('Erro ao aplicar reação de erro:', reactError);
      }
      
      return new ReturnMessage({
        chatId: chatId,
        content: 'Erro ao criar sticker. Por favor, tente novamente com uma imagem ou vídeo válido.'
      });
    }
  }
  
  // Manipula resposta a mensagem (sabemos que existe e tem mídia devido à validação needsMedia)
  try {
    const quotedMsg = await message.origin.getQuotedMessage();
    
    // Verifica se o tipo de mídia é suportado
    const mediaType = quotedMsg.type.toLowerCase();
    
    // ATUALIZAÇÃO: Manipula caso onde a mensagem citada já é um sticker
    if (mediaType === 'sticker') {
      // Baixa o sticker original para extrair a mídia
      const stickerMedia = await quotedMsg.downloadMedia();
      
      // Retorna a mídia original (não como sticker)
      return new ReturnMessage({
        chatId: chatId,
        content: stickerMedia,
        options: {
          sendMediaAsSticker: false,
          caption: "Mídia original do sticker",
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    // Processamento normal para imagens e vídeos
    if (['image', 'video', 'gif'].includes(mediaType)) {
      // Baixa mídia
      const media = await quotedMsg.downloadMedia();
      
      // Extrai nome do sticker dos args ou usa nome do grupo
      const stickerName = args.length > 0 ? args.join(' ') : (group ? group.name : 'sticker');
      
      // Retorna como sticker
      return new ReturnMessage({
        chatId: chatId,
        content: media,
        options: {
          sendMediaAsSticker: true,
          stickerAuthor: "ravena",
          stickerName: stickerName,
          quotedMessageId: message.origin.id._serialized
        }
      });
    } else {
      // Tenta aplicar reação de erro diretamente
      try {
        await message.origin.react("❌");
      } catch (reactError) {
        logger.error('Erro ao aplicar reação de erro:', reactError);
      }
      
      return new ReturnMessage({
        chatId: chatId,
        content: 'Este tipo de mídia não pode ser convertido em sticker. Apenas imagens e vídeos são suportados.'
      });
    }
  } catch (error) {
    logger.error('Erro ao criar sticker de resposta:', error);
    
    // Tenta aplicar reação de erro diretamente
    try {
      await message.origin.react("❌");
    } catch (reactError) {
      logger.error('Erro ao aplicar reação de erro:', reactError);
    }
    
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao criar sticker. Por favor, tente novamente com uma imagem ou vídeo válido.'
    });
  }
}

// Criar array de comandos usando a classe Command
const commands = [
  new Command({
    name: 'sticker',
    description: 'Converte mídia em sticker',
    needsMedia: true, // Verificará tanto mídia direta quanto mídia de mensagem citada
    reactions: {
      before: "🖼",
      after: "✅",
      error: "❌"
    },
    method: stickerCommand
  }),
  
  new Command({
    name: 's',
    description: 'Alias curto para comando sticker',
    needsMedia: true,
    reactions: {
      before: "🖼",
      after: "✅",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      // Chama o método stickerCommand diretamente
      return await stickerCommand(bot, message, args, group);
    }
  })
];

// Registra os comandos sendo exportados
logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };