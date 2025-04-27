const Logger = require('../utils/Logger');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');
const { MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');

const logger = new Logger('emoji-kitchen-commands');

/**
 * Extrai os primeiros dois emojis de um texto
 * @param {string} text - Texto contendo emojis
 * @returns {Array<string>} - Array com os dois primeiros emojis ou null se não encontrados
 */
function extractFirstTwoEmojis(text) {
  try {
    // Expressão regular para encontrar emojis
    // Esta regex é simplificada e pode não capturar todos os tipos de emoji
    const emojiRegex = /[\p{Emoji}|\p{Emoji_Presentation}|\p{Emoji_Modifier}|\p{Emoji_Modifier_Base}|\p{Emoji_Component}]/gu;
    
    // Encontra todas as ocorrências de emoji no texto
    const matches = text.match(emojiRegex);
    
    if (!matches || matches.length < 2) {
      return null;
    }
    
    // Retorna os dois primeiros emojis
    return [matches[0], matches[1]];
  } catch (error) {
    logger.error('Erro ao extrair emojis:', error);
    return null;
  }
}

/**
 * Gera um sticker combinando dois emojis usando Emoji Kitchen
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com o sticker
 */
async function emojiKitchenCommand(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Extrai emojis dos argumentos
    let emojis;
    
    // Caso 1: Se houver argumentos, extrair emojis deles
    if (args.length > 0) {
      emojis = extractFirstTwoEmojis(args.join(' '));
    }
    
    // Caso 2: Se não houver emojis nos argumentos, usar o conteúdo da mensagem
    if (!emojis && message.content && typeof message.content === 'string') {
      emojis = extractFirstTwoEmojis(message.content);
    }
    
    // Caso 3: Se ainda não tiver emojis, verificar mensagem citada
    if (!emojis && message.origin) {
      try {
        const quotedMsg = await message.origin.getQuotedMessage();
        if (quotedMsg && quotedMsg.body) {
          emojis = extractFirstTwoEmojis(quotedMsg.body);
        }
      } catch (error) {
        logger.error('Erro ao processar mensagem citada:', error);
      }
    }
    
    // Se ainda não encontramos emojis, retorna mensagem de erro
    if (!emojis) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça dois emojis para criar um sticker combinado. Exemplo: !emojik 🥹 😗'
      });
    }
    
    logger.debug(`Processando Emoji Kitchen para: ${emojis[0]} + ${emojis[1]}`);
    
    // Construir URL para o Emoji Kitchen
    const emoji1 = encodeURIComponent(emojis[0]);
    const emoji2 = encodeURIComponent(emojis[1]);
    const imageUrl = `https://emojik.vercel.app/s/${emoji1}_${emoji2}?size=512`;
    
    // Baixar imagem
    try {
      const media = await MessageMedia.fromUrl(imageUrl, { unsafeMime: true });
      
      // Retorna como sticker
      return new ReturnMessage({
        chatId: chatId,
        content: media,
        options: {
          sendMediaAsSticker: true,
          stickerAuthor: "ravena",
          stickerName: `Emojik: ${emojis[0]}+${emojis[1]}`,
          quotedMessageId: message.origin.id._serialized
        }
      });
    } catch (error) {
      logger.error(`Erro ao baixar imagem do Emoji Kitchen: ${error.message}`);
      
      return new ReturnMessage({
        chatId: chatId,
        content: `Não foi possível criar o sticker para ${emojis[0]}+${emojis[1]}. Esta combinação pode não estar disponível.`
      });
    }
  } catch (error) {
    logger.error('Erro ao processar comando emojiKitchen:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Ocorreu um erro ao processar o comando. Por favor, tente novamente.'
    });
  }
}

// Lista de comandos usando a classe Command
const commands = [
  new Command({
    name: 'emojik',
    description: 'Cria um sticker combinando dois emojis',
    category: "midia",
    group: "emojik",
    caseSensitive: false,
    cooldown: 5, // 5 segundos entre usos
    reactions: {
      before: "⏳",
      after: "🧪",
      error: "❌"
    },
    method: emojiKitchenCommand
  }),
  
  new Command({
    name: 'memoji',
    description: 'Alias para o comando emojik',
    category: "midia",
    group: "emojik",
    caseSensitive: false,
    cooldown: 5,
    reactions: {
      before: "⏳",
      after: "🧪",
      error: "❌"
    },
    method: emojiKitchenCommand
  })
];

module.exports = { commands };