const path = require('path');
const Logger = require('../utils/Logger');
const fs = require('fs').promises;
const Database = require('../utils/Database');

const logger = new Logger('sticker-commands');
const database = Database.getInstance();

logger.info('Módulo StickerCommands carregado');

const commands = [
  {
    name: 'sticker',
    description: 'Converte mídia em sticker',
    needsMedia: true, // Verificará tanto mídia direta quanto mídia de mensagem citada
    reactions: {
      before: "🖼",
      after: "✅",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      const chatId = message.group || message.author;
      logger.debug(`Executando comando sticker para ${chatId}`);
      
      // Manipula mídia direta
      if (message.type === 'image' || message.type === 'video' || message.type === 'gif') {
        try {
          // Extrai nome do sticker dos args ou usa nome do grupo
          const stickerName = args.length > 0 ? args.join(' ') : (group ? group.name : 'sticker');
          
          // Envia como sticker
          await bot.sendMessage(chatId, message.content, { 
            sendMediaAsSticker: true,
            stickerAuthor: "ravena",
            stickerName: stickerName,
            quotedMessageId: message.origin.id._serialized
          });
          
          logger.debug('Sticker enviado com sucesso');
        } catch (error) {
          logger.error('Erro ao criar sticker:', error);
          await bot.sendMessage(chatId, 'Erro ao criar sticker. Por favor, tente novamente com uma imagem ou vídeo válido.');
          
          // Aplica reação de erro
          try {
            await message.origin.react("❌");
          } catch (reactError) {
            logger.error('Erro ao aplicar reação de erro:', reactError);
          }
        }
        return;
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
          
          // Envia a mídia original (não como sticker)
          await bot.sendMessage(chatId, stickerMedia, {
            sendMediaAsSticker: false,
            caption: "Mídia original do sticker",
            quotedMessageId: message.origin.id._serialized
          });
          
          logger.debug('Mídia original do sticker enviada com sucesso');
          return;
        }
        
        // Processamento normal para imagens e vídeos
        if (['image', 'video', 'gif'].includes(mediaType)) {
          // Baixa mídia
          const media = await quotedMsg.downloadMedia();
          
          // Extrai nome do sticker dos args ou usa nome do grupo
          const stickerName = args.length > 0 ? args.join(' ') : (group ? group.name : 'sticker');
          
          // Envia como sticker
          await bot.sendMessage(chatId, media, { 
            sendMediaAsSticker: true,
            stickerAuthor: "ravena",
            stickerName: stickerName,
            quotedMessageId: message.origin.id._serialized
          });
          
          logger.debug('Sticker de resposta enviado com sucesso');
        } else {
          await bot.sendMessage(chatId, 'Este tipo de mídia não pode ser convertido em sticker. Apenas imagens e vídeos são suportados.');
          
          // Aplica reação de erro
          try {
            await message.origin.react("❌");
          } catch (reactError) {
            logger.error('Erro ao aplicar reação de erro:', reactError);
          }
        }
      } catch (error) {
        logger.error('Erro ao criar sticker de resposta:', error);
        await bot.sendMessage(chatId, 'Erro ao criar sticker. Por favor, tente novamente com uma imagem ou vídeo válido.');
        
        // Aplica reação de erro
        try {
          await message.origin.react("❌");
        } catch (reactError) {
          logger.error('Erro ao aplicar reação de erro:', reactError);
        }
      }
    }
  },
  {
    name: 's',
    description: 'Alias curto para comando sticker',
    needsMedia: true,
    reactions: {
      before: "🖼",
      after: "✅",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      // Chama o comando sticker
      const stickerCommand = commands.find(cmd => cmd.name === 'sticker');
      if (stickerCommand) {
        await stickerCommand.method(bot, message, args, group);
      }
    }
  }
];
// Registra os comandos sendo exportados
logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };