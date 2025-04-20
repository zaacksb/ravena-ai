const path = require('path');
const fs = require('fs').promises;
const ffmpeg = require('fluent-ffmpeg');
const { MessageMedia } = require('whatsapp-web.js');
const Logger = require('../utils/Logger');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

const logger = new Logger('file-conversions');
const tempDir = path.join(__dirname, '../../temp');

//logger.info('Módulo FileConversions carregado');

/**
 * Gera um nome de arquivo temporário único
 * @param {string} extension - Extensão do arquivo
 * @returns {string} - Caminho completo para o arquivo temporário
 */
function generateTempFilePath(extension) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return path.join(tempDir, `temp-${timestamp}-${random}.${extension}`);
}

/**
 * Garante que o diretório temporário exista
 */
async function ensureTempDir() {
  try {
    await fs.access(tempDir);
  } catch (error) {
    await fs.mkdir(tempDir, { recursive: true });
  }
}

/**
 * Salva mídia em um arquivo temporário
 * @param {Object} media - Objeto de mídia da mensagem
 * @param {string} extension - Extensão do arquivo
 * @returns {Promise<string>} - Caminho para o arquivo temporário
 */
async function saveMediaToTemp(media, extension) {
  await ensureTempDir();
  
  const tempFilePath = generateTempFilePath(extension);
  const mediaBuffer = Buffer.from(media.data, 'base64');
  
  await fs.writeFile(tempFilePath, mediaBuffer);
  logger.info(`[saveMediaToTemp] -> ${tempFilePath}`);
  return tempFilePath;
}

/**
 * Converte mídia para MP3
 * @param {string} inputPath - Caminho do arquivo de entrada
 * @returns {Promise<string>} - Caminho do arquivo de saída
 */
async function convertToMp3(inputPath) {
  const outputPath = generateTempFilePath('mp3');
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Converte mídia para OGG (formato de voz)
 * @param {string} inputPath - Caminho do arquivo de entrada
 * @returns {Promise<string>} - Caminho do arquivo de saída
 */
async function convertToOgg(inputPath) {
  const outputPath = generateTempFilePath('ogg');
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .audioCodec('libopus')
      .audioBitrate(128)
      .addOutputOption('-vn')
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Ajusta o volume de uma mídia
 * @param {string} inputPath - Caminho do arquivo de entrada
 * @param {number} volumeLevel - Nível de volume (0-1000)
 * @param {string} extension - Extensão do arquivo de saída
 * @returns {Promise<string>} - Caminho do arquivo de saída
 */
async function adjustVolume(inputPath, volumeLevel, extension) {
  const outputPath = generateTempFilePath(extension);
  
  // Converte o nível de volume (0-1000) para um multiplicador de ffmpeg (0-10)
  const volumeMultiplier = volumeLevel / 100;
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .audioFilters(`volume=${volumeMultiplier}`)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Cria um objeto MessageMedia a partir de um arquivo
 * @param {string} filePath - Caminho do arquivo
 * @param {string} mimetype - Tipo MIME
 * @returns {Promise<MessageMedia>} - Objeto MessageMedia
 */
async function createMediaFromFile(filePath, mimetype) {
  const fileData = await fs.readFile(filePath);
  const base64Data = fileData.toString('base64');
  
  logger.info(`[createMediaFromFile] ${mimetype} -> ${filePath}`);

  return new MessageMedia(
    mimetype,
    base64Data,
    path.basename(filePath)
  );
}

/**
 * Limpa arquivos temporários
 * @param {Array<string>} filePaths - Caminhos de arquivos a serem excluídos
 */
async function cleanupTempFiles(filePaths) {
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      logger.error(`Erro ao excluir arquivo temporário ${filePath}:`, error);
    }
  }
}

/**
 * Implementação do comando getaudio
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function handleGetAudio(bot, message, args, group) {
  const chatId = message.group || message.author;
  const returnMessages = [];
  
  try {
    // Obtém mensagem citada
    const quotedMsg = await message.origin.getQuotedMessage();
    
    // Verifica se a mensagem citada tem mídia
    if (!quotedMsg.hasMedia) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'A mensagem citada não contém mídia.'
      });
    }
    
    // Verifica tipo de mídia
    const quotedMedia = await quotedMsg.downloadMedia();
    const supportedTypes = ['audio', 'voice', 'video'];
    const mediaType = quotedMedia.mimetype.split('/')[0];
    
    if (!supportedTypes.includes(mediaType)) {
      return new ReturnMessage({
        chatId: chatId,
        content: `Tipo de mídia não suportado: ${mediaType}. Use em áudio, voz ou vídeo.`
      });
    }
    
    // Envia indicador de processamento
    returnMessages.push(
      new ReturnMessage({
        chatId: chatId,
        content: '⏳ Processando áudio...'
      })
    );
    
    // Salva mídia em arquivo temporário
    let tempFiles = [];
    
    const inputExt = quotedMedia.mimetype.split('/')[1].split(';')[0];
    const inputPath = await saveMediaToTemp(quotedMedia, inputExt);
    tempFiles.push(inputPath);
    
    // Converte para MP3
    const outputPath = await convertToMp3(inputPath);
    tempFiles.push(outputPath);
    
    // Cria objeto de mídia
    const outputMedia = await createMediaFromFile(outputPath, 'audio/mp3');
    
    // Limpa arquivos temporários
    cleanupTempFiles(tempFiles).catch(error => {
      logger.error('Erro ao limpar arquivos temporários:', error);
    });
    
    // Adiciona a mensagem de mídia ao retorno
    returnMessages.push(
      new ReturnMessage({
        chatId: chatId,
        content: outputMedia,
        options: {
          sendAudioAsVoice: false,
          quotedMessageId: message.origin.id._serialized
        }
      })
    );
    
    // Se só tiver uma mensagem, retorna só ela ao invés do array
    return returnMessages.length === 1 ? returnMessages[0] : returnMessages;
  } catch (error) {
    logger.error('Erro ao processar comando getaudio:', error);
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao processar áudio.'
    });
  }
}

/**
 * Implementação do comando getvoice
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function handleGetVoice(bot, message, args, group) {
  const chatId = message.group || message.author;
  const returnMessages = [];
  
  try {
    // Obtém mensagem citada
    const quotedMsg = await message.origin.getQuotedMessage();
    
    // Verifica se a mensagem citada tem mídia
    if (!quotedMsg.hasMedia) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'A mensagem citada não contém mídia.'
      });
    }
    
    // Verifica tipo de mídia
    const quotedMedia = await quotedMsg.downloadMedia();
    const supportedTypes = ['audio', 'voice', 'video'];
    const mediaType = quotedMedia.mimetype.split('/')[0];
    
    if (!supportedTypes.includes(mediaType)) {
      return new ReturnMessage({
        chatId: chatId,
        content: `Tipo de mídia não suportado: ${mediaType}. Use em áudio, voz ou vídeo.`
      });
    }
    
    // Envia indicador de processamento
    returnMessages.push(
      new ReturnMessage({
        chatId: chatId,
        content: '⏳ Processando áudio...'
      })
    );
    
    // Salva mídia em arquivo temporário
    let tempFiles = [];
    
    const inputExt = quotedMedia.mimetype.split('/')[1].split(';')[0];
    const inputPath = await saveMediaToTemp(quotedMedia, inputExt);
    tempFiles.push(inputPath);
    
    // Converte para OGG (formato de voz)
    const outputPath = await convertToOgg(inputPath);
    tempFiles.push(outputPath);
    
    // Cria objeto de mídia
    const outputMedia = await createMediaFromFile(outputPath, 'audio/ogg; codecs=opus');
    
    // Limpa arquivos temporários
    cleanupTempFiles(tempFiles).catch(error => {
      logger.error('Erro ao limpar arquivos temporários:', error);
    });
    
    // Adiciona a mensagem de mídia ao retorno
    returnMessages.push(
      new ReturnMessage({
        chatId: chatId,
        content: outputMedia,
        options: {
          sendAudioAsVoice: true,
          quotedMessageId: message.origin.id._serialized
        }
      })
    );
    
    // Se só tiver uma mensagem, retorna só ela ao invés do array
    return returnMessages.length === 1 ? returnMessages[0] : returnMessages;
  } catch (error) {
    logger.error('Erro ao processar comando getvoice:', error);
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao processar áudio.'
    });
  }
}

/**
 * Implementação do comando volume
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function handleVolumeAdjust(bot, message, args, group) {
  const chatId = message.group || message.author;
  const returnMessages = [];
  
  try {
    // Verifica argumentos
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, especifique o nível de volume (0-1000). Exemplo: !volume 200'
      });
    }
    
    // Obtém nível de volume
    const volumeLevel = parseInt(args[0]);
    
    if (isNaN(volumeLevel) || volumeLevel < 0 || volumeLevel > 1000) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Nível de volume inválido. Use um valor entre 0 e 1000.'
      });
    }
    
    // Obtém mensagem citada
    const quotedMsg = await message.origin.getQuotedMessage();
    
    // Verifica se a mensagem citada tem mídia
    if (!quotedMsg.hasMedia) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'A mensagem citada não contém mídia.'
      });
    }
    
    // Verifica tipo de mídia
    const quotedMedia = await quotedMsg.downloadMedia();
    const supportedTypes = ['audio', 'voice', 'video'];
    const mediaType = quotedMedia.mimetype.split('/')[0];
    
    if (!supportedTypes.includes(mediaType)) {
      return new ReturnMessage({
        chatId: chatId,
        content: `Tipo de mídia não suportado: ${mediaType}. Use em áudio, voz ou vídeo.`
      });
    }
    
    // Envia indicador de processamento
    returnMessages.push(
      new ReturnMessage({
        chatId: chatId,
        content: `⏳ Ajustando volume para ${volumeLevel}%...`
      })
    );
    
    // Salva mídia em arquivo temporário
    let tempFiles = [];
    
    let inputExt = quotedMedia.mimetype.split('/')[1].split(';')[0];
    const inputPath = await saveMediaToTemp(quotedMedia, inputExt);
    tempFiles.push(inputPath);
    
    // Ajusta volume
    if(quotedMedia.mimetype.includes("audio")){
      inputExt = "mp3"; // Força Mp3 pq mpeg e outros dá bug pra gerar MessageMedia
    }
    const outputPath = await adjustVolume(inputPath, volumeLevel, inputExt);
    tempFiles.push(outputPath);
    
    // Cria objeto de mídia
    const outputMedia = await createMediaFromFile(outputPath, quotedMedia.mimetype);
    
    // Limpa arquivos temporários
    cleanupTempFiles(tempFiles).catch(error => {
      logger.error('Erro ao limpar arquivos temporários:', error);
    });
    
    // Adiciona a mensagem de mídia ao retorno
    returnMessages.push(
      new ReturnMessage({
        chatId: chatId,
        content: outputMedia,
        options: {
          sendAudioAsVoice: mediaType === 'voice',
          quotedMessageId: message.origin.id._serialized
        }
      })
    );
    
    // Se só tiver uma mensagem, retorna só ela ao invés do array
    return returnMessages.length === 1 ? returnMessages[0] : returnMessages;
  } catch (error) {
    logger.error('Erro ao processar comando volume:', error);
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao ajustar volume.'
    });
  }
}

// Comandos usando a classe Command
const commands = [
  new Command({
    name: 'getaudio',
    description: 'Converte mídia para arquivo de áudio MP3',
    category: "áudio",
    reactions: {
      before: "⏳",
      after: "🎵",
      error: "❌"
    },
    needsQuotedMsg: true,
    method: handleGetAudio
  }),
  
  new Command({
    name: 'getvoice',
    description: 'Converte mídia para mensagem de voz',
    category: "áudio",
    reactions: {
      before: "⏳",
      after: "🎤",
      error: "❌"
    },
    needsQuotedMsg: true,
    method: handleGetVoice
  }),
  
  new Command({
    name: 'volume',
    description: 'Ajusta o volume da mídia (0-1000)',
    category: "áudio",
    reactions: {
      before: "⏳",
      after: "🔊",
      error: "❌"
    },
    needsQuotedMsg: true,
    method: handleVolumeAdjust
  })
];

// Registra os comandos sendo exportados
//logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };