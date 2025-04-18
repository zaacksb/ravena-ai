const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');
const LLMService = require('../services/LLMService');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

const execPromise = util.promisify(exec);
const logger = new Logger('speech-commands');
const database = Database.getInstance();
const llmService = new LLMService({});

const espeakPath = process.env.ESPEAK_PATH || 'espeak';
const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

// Cria diretório temporário para arquivos de áudio
const tempDir = path.join(os.tmpdir(), 'whatsapp-bot-speech');
fs.mkdir(tempDir, { recursive: true })
  .then(() => {
    logger.info(`Diretório temporário criado: ${tempDir}`);
  })
  .catch(error => {
    logger.error('Erro ao criar diretório temporário:', error);
  });

logger.info('Módulo SpeechCommands carregado');

/**
 * Obtém mídia da mensagem
 * @param {Object} message - O objeto da mensagem
 * @returns {Promise<MessageMedia|null>} - O objeto de mídia ou null
 */
async function getMediaFromMessage(message) {
  // Se a mensagem tem mídia direta
  if (message.type !== 'text') {
    return message.content;
  }
  
  // Tenta obter mídia da mensagem citada
  try {
    const quotedMsg = await message.origin.getQuotedMessage();
    if (quotedMsg && quotedMsg.hasMedia) {
      return await quotedMsg.downloadMedia();
    }
  } catch (error) {
    logger.error('Erro ao obter mídia da mensagem citada:', error);
  }
  
  return null;
}

/**
 * Salva mídia em arquivo temporário
 * @param {MessageMedia} media - O objeto de mídia
 * @param {string} extension - Extensão do arquivo
 * @returns {Promise<string>} - Caminho para o arquivo salvo
 */
async function saveMediaToTemp(media, extension = 'ogg') {
  const filename = `${uuidv4()}.${extension}`;
  const filepath = path.join(tempDir, filename);
  
  await fs.writeFile(filepath, Buffer.from(media.data, 'base64'));
  logger.debug(`Mídia salva em arquivo temporário: ${filepath}`);
  
  return filepath;
}

/**
 * Converte texto para voz usando espeak
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function textToSpeech(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça texto para converter em voz.'
      });
    }
    
    const text = args.join(' ');
    logger.debug(`Convertendo texto para voz: ${text}`);
    
    // Gera nomes de arquivo únicos
    const outputWav = path.join(tempDir, `${uuidv4()}.wav`);
    const outputMp3 = path.join(tempDir, `${uuidv4()}.mp3`);
    
    // Usa espeak (motor TTS gratuito) para gerar voz
    // -v pt-br seleciona voz em português brasileiro
    await execPromise(`"${espeakPath}" -v pt-br -f - -w "${outputWav}"`, {
      input: text
    });
    
    // Converte para MP3 para melhor compatibilidade com WhatsApp usando ffmpeg
    await execPromise(`"${ffmpegPath}" -i "${outputWav}" -acodec libmp3lame -ab 128k "${outputMp3}"`);
    
    // Lê o arquivo de áudio gerado
    const audio = await fs.readFile(outputMp3);
    
    // Cria mídia a partir do áudio
    const media = {
      mimetype: 'audio/mp3',
      data: audio.toString('base64'),
      filename: 'speech.mp3'
    };
    
    // Retorna a ReturnMessage com o áudio
    const returnMessage = new ReturnMessage({
      chatId: chatId,
      content: media,
      options: {
        sendAudioAsVoice: true,
        quotedMessageId: message.origin.id._serialized
      }
    });
    
    logger.info('Áudio TTS gerado com sucesso');
    
    // Limpa arquivos temporários
    try {
      await fs.unlink(outputWav);
      await fs.unlink(outputMp3);
      logger.debug('Arquivos temporários limpos');
    } catch (cleanupError) {
      logger.error('Erro ao limpar arquivos temporários:', cleanupError);
    }
    
    return returnMessage;
  } catch (error) {
    logger.error('Erro na conversão de texto para voz:', error);
    const chatId = message.group || message.author;
    
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao gerar voz. Por favor, tente novamente.'
    });
  }
}

/**
 * Converte voz para texto usando vosk
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function speechToText(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Obtém mídia da mensagem
    const media = await getMediaFromMessage(message);
    if (!media) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça um áudio ou mensagem de voz.'
      });
    }
    
    // Verifica se a mídia é áudio
    const isAudio = media.mimetype.startsWith('audio/') || 
                   media.mimetype === 'application/ogg';
    
    if (!isAudio) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça um áudio ou mensagem de voz.'
      });
    }
    
    logger.debug('[speechToText] Convertendo voz para texto');
    
    // Primeiro, envia mensagem de processamento
    const processingMessage = new ReturnMessage({
      chatId: chatId,
      content: 'Processando áudio...'
    });
    
    // Salva áudio em arquivo temporário
    const audioPath = await saveMediaToTemp(media, 'ogg');
    
    // Converte para formato WAV para melhor compatibilidade com motores STT
    const wavPath = audioPath.replace(/\.[^/.]+$/, '') + '.wav';
    await execPromise(`ffmpeg -i "${audioPath}" -ar 16000 -ac 1 "${wavPath}"`);
    
    // Usa vosk-transcriber (motor STT gratuito e offline)
    // Isso pressupõe que vosk-transcriber esteja instalado e o modelo baixado
    const { stdout } = await execPromise(
      `vosk-transcriber -i "${wavPath}" -l pt -m ${process.env.VOSK_STT_MODEL}`, { encoding: 'utf8' }
    );
    
    // Extrai o texto transcrito
    let transcribedText = stdout.trim();
    
    // Se a transcrição falhar ou estiver vazia, fornece uma mensagem útil
    if (!transcribedText) {
      transcribedText = "Não foi possível transcrever o áudio. O áudio pode estar muito baixo ou pouco claro.";
      
      // Retorna a mensagem de erro
      const errorMessage = new ReturnMessage({
        chatId: chatId,
        content: transcribedText,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
      
      // Limpa arquivos temporários
      try {
        await fs.unlink(audioPath);
        await fs.unlink(wavPath);
        logger.debug('Arquivos temporários limpos');
      } catch (cleanupError) {
        logger.error('Erro ao limpar arquivos temporários:', cleanupError);
      }
      
      return errorMessage;
    }
    
    // Cria a ReturnMessage com a transcrição
    const returnMessage = new ReturnMessage({
      chatId: chatId,
      content: `_${transcribedText?.trim()}_`,
      options: {
        quotedMessageId: message.origin.id._serialized
      }
    });
    
    logger.info(`[speechToText] Resultado STT gerado com sucesso: ${transcribedText}`);
    
    // Inicia processamento com LLM para melhoria do texto em paralelo
    try {
      const improvedText = await llmService.getCompletion({
        prompt: `Vou enviar no final deste prompt a transcrição de um áudio, coloque a pontuação mais adequada e formate corretamente maíusculas e minúsculas. Me retorne APENAS com a mensagem formatada: '${transcribedText}'`,
        provider: 'openrouter',
        temperature: 0.7,
        maxTokens: 300
      });
      
      // Não vamos aguardar essa melhoria para retornar a mensagem inicial
      // Em vez disso, vamos atualizar a mensagem existente quando a melhoria estiver pronta
      logger.info(`[speechToText] Melhoramento via LLM recebido: ${improvedText}`);
      
      // Nota: Essa atualização da mensagem precisará ser feita no CommandHandler
      // já que ReturnMessage é apenas um objeto de dados e não pode fazer a edição diretamente
    } catch (llmError) {
      logger.error('[speechToText] Melhoramento via LLM deu erro, ignorando.', llmError);
    }
    
    // Limpa arquivos temporários
    try {
      await fs.unlink(audioPath);
      await fs.unlink(wavPath);
      logger.debug('Arquivos temporários limpos');
    } catch (cleanupError) {
      logger.error('Erro ao limpar arquivos temporários:', cleanupError);
    }
    
    // Cria um array com a mensagem de processamento e a mensagem de resultado
    return [processingMessage, returnMessage];
  } catch (error) {
    logger.error('Erro na conversão de voz para texto:', error);
    const chatId = message.group || message.author;
    
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao transcrever áudio. Por favor, tente novamente.'
    });
  }
}

/**
 * Processa STT automático para mensagens de voz
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Object} group - Dados do grupo
 * @returns {Promise<boolean>} - Se a mensagem foi processada
 */
async function processAutoSTT(bot, message, group) {
  try {
    // Pula se não for mensagem de voz ou sem grupo
    if (!message.group || message.type !== 'voice') {
      return false;
    }
    
    // Verifica se o auto-STT está habilitado para este grupo
    if (!group || !group.autoStt) {
      return false;
    }
    
    logger.debug(`[processAutoSTT] Processamento Auto-STT para mensagem no grupo ${message.group}`);
    
    // Salva áudio em arquivo temporário
    const audioPath = await saveMediaToTemp(message.content, 'ogg');
    
    // Converte para formato WAV para melhor compatibilidade com motores STT
    const wavPath = audioPath.replace(/\.[^/.]+$/, '') + '.wav';
    await execPromise(`ffmpeg -i "${audioPath}" -ar 16000 -ac 1 "${wavPath}"`);
    
    // Usa vosk-transcriber (motor STT gratuito e offline)
    const { stdout } = await execPromise(
      `vosk-transcriber -i "${wavPath}" -l pt -m ${process.env.VOSK_STT_MODEL}`, { encoding: 'utf8' }
    );
    
    // Extrai o texto transcrito
    let transcribedText = stdout.trim();
    
    // Se a transcrição for bem-sucedida, envia-a
    if (transcribedText) {
      // Cria ReturnMessage com a transcrição
      const returnMessage = new ReturnMessage({
        chatId: message.group,
        content: `_${transcribedText?.trim()}_`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
      
      // Envia a mensagem
      await bot.sendReturnMessages(returnMessage);
      
      logger.info(`[processAutoSTT] Resultado STT enviado com sucesso, processando via LLM uma melhoria para: ${transcribedText}`);

      // Tenta melhorar o texto com LLM (assíncrono)
      try {
        const improvedText = await llmService.getCompletion({
          prompt: `Vou enviar no final deste prompt a transcrição de um áudio, coloque a pontuação mais adequada e formate corretamente maíusculas e minúsculas. Me retorne APENAS com a mensagem formatada: '${transcribedText}'`,
          provider: 'openrouter',
          temperature: 0.7,
          maxTokens: 300
        });
        
        logger.info(`[processAutoSTT] Melhoramento via LLM recebido: ${improvedText}`);
        
        // Nota: Aqui seria necessário um método para editar a mensagem já enviada
        // O ideal seria criar esse método no bot para atualizar a mensagem
      } catch (llmError) {
        logger.error('[processAutoSTT] Melhoramento via LLM deu erro, ignorando.', llmError);
      }
    }
    
    // Limpa arquivos temporários
    try {
      await fs.unlink(audioPath);
      await fs.unlink(wavPath);
      logger.debug('Arquivos temporários limpos');
    } catch (cleanupError) {
      logger.error('Erro ao limpar arquivos temporários:', cleanupError);
    }
    
    return true;
  } catch (error) {
    logger.error('Erro no auto-STT:', error);
    return false;
  }
}

// Define os comandos usando a classe Command
const commands = [
  new Command({
    name: 'tts',
    description: 'Converte texto para voz',
    category: 'group',
    reactions: {
      before: "⌛️",
      after: "🔊"
    },
    method: textToSpeech
  }),
  
  new Command({
    name: 'stt',
    description: 'Converte voz para texto',
    category: 'group',
    needsMedia: true, // Verificará mídia direta ou mídia de mensagem citada
    reactions: {
      before: "⌛️",
      after: "👂"
    },
    method: speechToText
  })
];

// Exporta função para ser usada em EventHandler
module.exports.commands = commands;
module.exports.processAutoSTT = processAutoSTT;