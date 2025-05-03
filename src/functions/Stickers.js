const path = require('path');
const Logger = require('../utils/Logger');
const fs = require('fs').promises;
const Database = require('../utils/Database');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { MessageMedia } = require('whatsapp-web.js');

const logger = new Logger('sticker-commands');
const database = Database.getInstance();
const TEMP_DIR = path.join(__dirname, '../../temp', 'whatsapp-bot-stickers');
//logger.info('Módulo  Commands carregado');

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

// Parte dos quadrados
// Garantir que o diretório temporário exista
async function ensureTempDir() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    logger.error('Erro ao criar diretório temporário:', error);
  }
}

// Limpar arquivos temporários mais antigos que 1 hora
async function cleanupTempFiles() {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = await fs.stat(filePath);
      
      if (stats.mtimeMs < oneHourAgo) {
        await fs.unlink(filePath);
      }
    }
  } catch (error) {
    logger.error('Erro ao limpar arquivos temporários:', error);
  }
}

// Função para determinar se o arquivo é um vídeo ou uma imagem
function isVideo(mimeType) {
  return mimeType.startsWith('video/') || mimeType === 'image/gif';
}

// Função para salvar o buffer de mídia temporariamente
async function saveTempMedia(mediaBuffer, mimeType) {
  await ensureTempDir();
  
  const extension = mimeType.split('/')[1].replace('jpeg', 'jpg');
  const tempFileName = `temp-${Date.now()}.${extension}`;
  const tempFilePath = path.join(TEMP_DIR, tempFileName);
  
  await fs.writeFile(tempFilePath, mediaBuffer);
  return tempFilePath;
}

// Função para converter um buffer de mídia em um buffer de sticker quadrado
async function makeSquareMedia(mediaBuffer, mimeType, cropType = 'center') {
  try {
    // Se for imagem (exceto GIF), use sharp
    if (mimeType.startsWith('image/') && mimeType !== 'image/gif') {
      logger.info(`[makeSquareMedia] Processando imagem ${mimeType}`);
      
      // Carregar a imagem - Converter de base64 para Buffer se necessário
      let imageBuffer = mediaBuffer;
      if (typeof mediaBuffer === 'string') {
        imageBuffer = Buffer.from(mediaBuffer, 'base64');
      } else if (mediaBuffer.data && typeof mediaBuffer.data === 'string') {
        imageBuffer = Buffer.from(mediaBuffer.data, 'base64');
      }
      
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      
      logger.debug(`Metadata da imagem: ${JSON.stringify(metadata)}`);
      
      // Determinar dimensões para corte quadrado
      const size = Math.min(metadata.width, metadata.height);
      let left = 0;
      let top = 0;
      
      if (cropType === 'center') {
        // Centraliza o corte
        left = Math.max(0, (metadata.width - size) / 2);
        top = Math.max(0, (metadata.height - size) / 2);
      } else if (cropType === 'top') {
        // Preserva o topo, corta o fundo
        left = Math.max(0, (metadata.width - size) / 2);
        top = 0;
      } else if (cropType === 'bottom') {
        // Preserva o fundo, corta o topo
        left = Math.max(0, (metadata.width - size) / 2);
        top = Math.max(0, metadata.height - size);
      } else if (cropType === 'stretch') {
        // Para o modo de esticamento, redimensionamos diretamente para 400x400
        return await image.resize(400, 400, { fit: 'fill' }).toBuffer();
      }
      
      // Aplicar o corte e redimensionar para 400x400
      return await image
        .extract({ left: Math.floor(left), top: Math.floor(top), width: size, height: size })
        .resize(400, 400)
        .toBuffer();
    } else if (isVideo(mimeType)) {
      logger.info(`[makeSquareMedia] Processando video ${mimeType}`);
      
      // Converter de base64 para Buffer se necessário
      let videoBuffer = mediaBuffer;
      if (typeof mediaBuffer === 'string') {
        videoBuffer = Buffer.from(mediaBuffer, 'base64');
      } else if (mediaBuffer.data && typeof mediaBuffer.data === 'string') {
        videoBuffer = Buffer.from(mediaBuffer.data, 'base64');
      }
      
      // Para vídeos e GIFs, use ffmpeg
      const inputPath = await saveTempMedia(videoBuffer, mimeType);
      const outputPath = `${inputPath.split('.')[0]}-square.${inputPath.split('.')[1]}`;
      
      logger.debug(`Arquivos temporários: input=${inputPath}, output=${outputPath}`);
      
      // Configurar os filtros baseados no tipo de corte
      let filterCommand = '';
      
      // Estratégia: primeiro determinar a área de corte e depois redimensionar para 400x400
      if (cropType === 'center') {
        // Cortar para quadrado no centro e depois redimensionar
        filterCommand = [
            {
              filter: 'crop',
              options: {
                w: 'min(iw,ih)',
                h: 'min(iw,ih)',
                x: '(iw-min(iw,ih))/2',
                y: '(ih-min(iw,ih))/2'
              },
              outputs: 'cropped'
            },
            {
              filter: 'scale',
              options: {
                w: 400,
                h: 400
              },
              inputs: 'cropped',
              outputs: 'scaled'
            }
          ]
      } else if (cropType === 'top') {
        // Cortar para quadrado preservando o topo e depois redimensionar
        filterCommand = [
          {
            filter: 'crop',
            options: {
              w: 'min(iw,ih)',
              h: 'min(iw,ih)',
              x: '(iw-min(iw,ih))/2',
              y: '0'
            },
            outputs: 'cropped'
          },
          {
            filter: 'scale',
            options: {
              w: 400,
              h: 400
            },
            inputs: 'cropped',
            outputs: 'scaled'
          }
        ];
      } else if (cropType === 'bottom') {
        // Cortar para quadrado preservando o fundo e depois redimensionar
        filterCommand = [
          {
            filter: 'crop',
            options: {
              w: 'min(iw,ih)',
              h: 'min(iw,ih)',
              x: '(iw-min(iw,ih))/2',
              y: '(ih-min(iw,ih))'
            },
            outputs: 'cropped'
          },
          {
            filter: 'scale',
            options: {
              w: 400,
              h: 400
            },
            inputs: 'cropped',
            outputs: 'scaled'
          }
        ];
      } else if (cropType === 'stretch') {
        // Esticar o vídeo para 400x400 sem cortar
        filterCommand = [
          {
            filter: 'scale',
            options: {
              w: 400,
              h: 400,
              force_original_aspect_ratio: 0 // Força o esticamento
            },
            outputs: 'scaled'
          }
        ];
      }
      
      // Usar arquivo intermediário em vez de pipe para evitar problemas de formato
      return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-y',
            '-an',
            '-c:v libx264',
            '-preset medium',
          ])
          .complexFilter(filterCommand, 'scaled')
          .output(outputPath)
          .on('start', (cmdline) => {
            logger.debug(`Comando ffmpeg: ${cmdline}`);
          })
          .on('end', async () => {
            try {
              // Ler o arquivo de saída
              const processedBuffer = await fs.readFile(outputPath);
              // Limpar arquivos temporários
              // await fs.unlink(inputPath).catch(() => {
              //   logger.warn(`Não foi possível excluir ${inputPath}`);
              // });
              // await fs.unlink(outputPath).catch(() => {
              //   logger.warn(`Não foi possível excluir ${outputPath}`);
              // });
              resolve(processedBuffer);
            } catch (error) {
              logger.error(`Erro ao ler arquivo processado: ${error}`);
              reject(error);
            }
          })
          .on('error', (err) => {
            logger.error(`Erro no ffmpeg: ${err.message}`);
            // Tentar limpar os arquivos mesmo em caso de erro
            //fs.unlink(inputPath).catch(() => {});
            //fs.unlink(outputPath).catch(() => {});
            reject(err);
          })
          .run();
      });
    } else {
      throw new Error(`Tipo de mídia não suportado: ${mimeType}`);
    }
  } catch (error) {
    logger.error(`Erro ao processar mídia em quadrado: ${error.message}`);
    logger.error(error.stack);
    throw error;
  }
}

/**
 * Função middleware para processar mídia antes de enviá-la para o comando de sticker
 * @param {Buffer|Object} mediaBuffer - Buffer ou objeto com a mídia
 * @param {string} mimeType - Tipo MIME da mídia
 * @param {string} cropType - Tipo de corte: 'center', 'top', 'bottom' ou 'stretch'
 * @returns {Promise<Buffer>} - Buffer da mídia processada
 */
async function processMediaToSquare(mediaBuffer, mimeType, cropType) {
  try {
    logger.info(`Processando mídia para quadrado: ${mimeType}, tipo de corte: ${cropType}`);
    return await makeSquareMedia(mediaBuffer, mimeType, cropType);
  } catch (error) {
    logger.error(`Erro ao processar mídia em formato quadrado (${cropType}):`, error);
    throw error;
  }
}

/**
 * Cria um sticker quadrado a partir de uma mídia, aplicando diferentes tipos de corte
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @param {string} cropType - Tipo de corte: 'center', 'top', 'bottom' ou 'stretch'
 * @returns {Promise<ReturnMessage>} - ReturnMessage com o sticker
 */
async function squareStickerCommand(bot, message, args, group, cropType) {
  const chatId = message.group || message.author;
  logger.debug(`Executando comando sticker quadrado (${cropType}) para ${chatId}`);
  
  try {
    let mediaBuffer, mimeType, quotedMessageId;
    
    // Extrair mídia e informações necessárias da mensagem direta ou citada
    if (message.type === 'image' || message.type === 'video' || message.type === 'gif') {
      // Mídia na mensagem atual
      logger.debug(`Processando mídia da mensagem atual: ${message.type}`);
      
      // Verifica se content já está no formato correto
      if (message.content && typeof message.content === 'object') {
        // Se content já for um objeto, use-o diretamente
        mediaBuffer = message.content;
        mimeType = message.content.mimetype;
      } else if (message.downloadMedia) {
        // Se tiver o método downloadMedia, use-o
        const media = await message.downloadMedia();
        mediaBuffer = media;
        mimeType = media.mimetype;
      } else {
        throw new Error('Formato de mídia não reconhecido');
      }
      
      quotedMessageId = message.origin.id._serialized;
    } else {
      // Mídia na mensagem citada
      logger.debug('Processando mídia da mensagem citada');
      const quotedMsg = await message.origin.getQuotedMessage();
      
      // Verificar se o tipo de mídia é suportado
      const mediaType = quotedMsg.type.toLowerCase();
      
      if (['image', 'video', 'gif', 'sticker'].includes(mediaType)) {
        const media = await quotedMsg.downloadMedia();
        mediaBuffer = media;
        mimeType = media.mimetype;
        quotedMessageId = message.origin.id._serialized;
      } else {
        await message.origin.react("❌");
        return new ReturnMessage({
          chatId: chatId,
          content: 'Este tipo de mídia não pode ser convertido em sticker quadrado. Apenas imagens, vídeos e stickers são suportados.'
        });
      }
    }
    
    // Log para debug
    logger.debug(`Mídia obtida: tipo=${mimeType}, mediaBuffer=${typeof mediaBuffer}`);
    
    // Processar a mídia para torná-la quadrada
    const processedBuffer = await processMediaToSquare(mediaBuffer, mimeType, cropType);
    
    // Salvar o buffer processado em um arquivo temporário
    await ensureTempDir();
    const extension = mimeType.split('/')[1].replace('jpeg', 'jpg');
    const tempFileName = `processed-${Date.now()}.${extension}`;
    const tempFilePath = path.join(TEMP_DIR, tempFileName);
    
    logger.debug(`Salvando mídia processada em: ${tempFilePath}`);
    await fs.writeFile(tempFilePath, processedBuffer);
    
    // Usar o método do bot para criar a mídia no formato correto
    const processedMedia = await MessageMedia.fromFilePath(tempFilePath);
    
    // Tentar limpar o arquivo temporário (de forma assíncrona, não bloqueia)
    // fs.unlink(tempFilePath).catch(err => {
    //   logger.warn(`Não foi possível excluir o arquivo temporário ${tempFilePath}: ${err.message}`);
    // });
    
    // Extrair nome do sticker dos args ou usa nome do grupo
    const stickerName = args.length > 0 ? args.join(' ') : (group ? group.name : 'sticker');
    
    // Cria ReturnMessage com opções para sticker
    return [
    new ReturnMessage({
      chatId: chatId,
      content: processedMedia,
      options: {
        sendMediaAsSticker: true,
        stickerAuthor: "ravena",
        stickerName: stickerName,
        quotedMessageId: quotedMessageId
      }
    }),
    new ReturnMessage({
      chatId: chatId,
      content: processedMedia
    })
    ];
  } catch (error) {
    logger.error(`Erro ao criar sticker quadrado (${cropType}):`, error);
    
    // Tenta aplicar reação de erro diretamente
    try {
      await message.origin.react("❌");
    } catch (reactError) {
      logger.error('Erro ao aplicar reação de erro:', reactError);
    }
    
    return new ReturnMessage({
      chatId: chatId,
      content: `Erro ao criar sticker quadrado (${cropType}). Por favor, tente novamente com uma imagem ou vídeo válido.`
    });
  }
}

/**
 * Processa automaticamente imagens/vídeos enviados para o PV, convertendo-os em stickers
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Object} group - Dados do grupo (será null para mensagens privadas)
 * @returns {Promise<boolean>} - Se a mensagem foi processada
 */
async function processAutoSticker(bot, message, group) {
  try {
    // Verifica se a mensagem é privada (não é de grupo)
    if (message.group) {
      return false;
    }

    // Verifica se o usuário está gerenciando algum grupo pelo PV
    if (bot.eventHandler.commandHandler.privateManagement && 
        bot.eventHandler.commandHandler.privateManagement[message.author]) {
      // O usuário está gerenciando um grupo pelo PV, não criar sticker automaticamente
      return false;
    }
    
    // Pula se não for mídia de imagem, vídeo ou GIF
    if (!['image', 'video', 'gif'].includes(message.type)) {
      return false;
    }
    
    const logger = require('../utils/Logger');
    const stickerLogger = new logger('auto-sticker');
    
    stickerLogger.debug(`[processAutoSticker] Processando mídia automática para sticker no chat ${message.author}`);
    
    // Criar um nome para o sticker (pode ser o nome de quem enviou ou um padrão)
    const stickerName = message.authorName || 'sticker';
    
    // Usar ReturnMessage para enviar o sticker
    const ReturnMessage = require('../models/ReturnMessage');
    const returnMessage = new ReturnMessage({
      chatId: message.author,
      content: message.content,
      options: {
        sendMediaAsSticker: true,
        stickerAuthor: "ravena",
        stickerName: stickerName,
        quotedMessageId: message.origin.id._serialized
      }
    });
    
    // Envia o sticker
    await bot.sendReturnMessages(returnMessage);
    
    stickerLogger.info(`[processAutoSticker] Sticker automático enviado para ${message.author}`);
    
    return true;
  } catch (error) {
    const logger = require('../utils/Logger');
    const stickerLogger = new logger('auto-sticker');
    stickerLogger.error('Erro no processamento automático de sticker:', error);
    return false;
  }
}

// Criar array de comandos usando a classe Command
const commands = [
  new Command({
    name: 'sticker',
    description: 'Converte mídia em sticker',
    category: "midia",
    group: "ssticker",
    needsMedia: true, // Verificará tanto mídia direta quanto mídia de mensagem citada
    caseSensitive: false,
    cooldown: 0,
    reactions: {
      trigger: "🖼",
      before: "⏳",
      after: "🖼",
      error: "❌"
    },
    method: stickerCommand
  }),
  new Command({
    name: 'figurinha',
    description: 'Converte mídia em sticker',
    category: "midia",
    group: "ssticker",
    needsMedia: true, // Verificará tanto mídia direta quanto mídia de mensagem citada
    caseSensitive: false,
    cooldown: 0,
    reactions: {
      trigger: "🖼",
      before: "⏳",
      after: "🖼",
      error: "❌"
    },
    method: stickerCommand
  }),
  
  new Command({
    name: 's',
    description: 'Alias curto para comando sticker',
    category: "midia",
    group: "ssticker",
    needsMedia: true,
    caseSensitive: false,
    cooldown: 0,
    reactions: {
      trigger: "🖼",
      before: "⏳",
      after: "🖼",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      // Chama o método stickerCommand diretamente
      return await stickerCommand(bot, message, args, group);
    }
  }),
  new Command({
    name: 'fig',
    description: 'Alias curto para comando sticker',
    category: "midia",
    group: "ssticker",
    needsMedia: true,
    caseSensitive: false,
    cooldown: 0,
    reactions: {
      trigger: "🖼",
      before: "⏳",
      after: "🖼",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      // Chama o método stickerCommand diretamente
      return await stickerCommand(bot, message, args, group);
    }
  }),
  new Command({
    name: 'sq',
    description: 'Sticker quadrado, cortado no meio (q), em cima (qc) ou em baixo (qb)',
    category: "midia",
    group: "sstickerqua",
    needsMedia: true,
    caseSensitive: false,
    cooldown: 0,
    reactions: {
      before: "⏳",
      after: "🖼",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      return await squareStickerCommand(bot, message, args, group, 'center');
    }
  }),
  new Command({
    name: 'stickerq',
    description: 'Sticker quadrado, cortado no meio (q), em cima (qc) ou em baixo (qb)',
    category: "midia",
    group: "sstickerqua",
    needsMedia: true,
    caseSensitive: false,
    cooldown: 0,
    reactions: {
      before: "⏳",
      after: "🖼",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      return await squareStickerCommand(bot, message, args, group, 'center');
    }
  }),
  new Command({
    name: 'sqc',
    description: 'Sticker quadrado, cortado no meio (q), em cima (qc) ou em baixo (qb)',
    category: "midia",
    group: "sstickerqua",
    needsMedia: true,
    caseSensitive: false,
    cooldown: 0,
    reactions: {
      before: "⏳",
      after: "🖼",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      return await squareStickerCommand(bot, message, args, group, 'top');
    }
  }),
  new Command({
    name: 'stickerqc',
    description: 'Sticker quadrado, cortado no meio (q), em cima (qc) ou em baixo (qb)',
    category: "midia",
    group: "sstickerqua",
    needsMedia: true,
    caseSensitive: false,
    cooldown: 0,
    reactions: {
      before: "⏳",
      after: "🖼",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      return await squareStickerCommand(bot, message, args, group, 'top');
    }
  }),
  
  new Command({
    name: 'sqb',
    description: 'Sticker quadrado, cortado no meio (q), em cima (qc) ou em baixo (qb)',
    category: "midia",
    group: "sstickerqua",
    needsMedia: true,
    caseSensitive: false,
    cooldown: 0,
    reactions: {
      before: "⏳",
      after: "🖼",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      return await squareStickerCommand(bot, message, args, group, 'bottom');
    }
  }),
  new Command({
    name: 'stickerqb',
    description: 'Sticker quadrado, cortado no meio (q), em cima (qc) ou em baixo (qb)',
    category: "midia",
    group: "sstickerqua",
    needsMedia: true,
    caseSensitive: false,
    cooldown: 0,
    reactions: {
      before: "⏳",
      after: "🖼",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      return await squareStickerCommand(bot, message, args, group, 'bottom');
    }
  }),
  // Comando para sticker esticado (sqe)
  new Command({
    name: 'sqe',
    description: 'Sticker quadrado esticado, sem cortar a imagem',
    category: "midia",
    group: "sstickerqua",
    needsMedia: true,
    caseSensitive: false,
    cooldown: 0,
    reactions: {
      before: "⏳",
      after: "🖼",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      return await squareStickerCommand(bot, message, args, group, 'stretch');
    }
  }),
  new Command({
    name: 'stickerqe',
    description: 'Sticker quadrado esticado, sem cortar a imagem',
    category: "midia",
    group: "sstickerqua",
    needsMedia: true,
    caseSensitive: false,
    cooldown: 0,
    reactions: {
      before: "⏳",
      after: "🖼",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      return await squareStickerCommand(bot, message, args, group, 'stretch');
    }
  })
];

module.exports = { commands, processAutoSticker };