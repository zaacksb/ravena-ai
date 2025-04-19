const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const axios = require('axios');
const FormData = require('form-data');
const { URLSearchParams } = require('url');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');
const crypto = require('crypto');
const LLMService = require('../services/LLMService');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

const execPromise = util.promisify(exec);
const logger = new Logger('speech-commands');
const database = Database.getInstance();
const llmService = new LLMService({});

const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
const allTalkAPI = process.env.ALLTALK_API || 'http://localhost:7851/';
const alltalkOutputFolder = path.join(process.env.ALLTALK_FOLDER, "outputs");

const whisperPath = path.join(process.env.ALLTALK_FOLDER, "alltalk_environment", "env", "Scripts", "Whisper.exe");

// Definição dos personagens para TTS
const ttsCharacters = {
  "ravena": "ravena_sample.wav",
  "mulher": "female_01.wav",
  "homem": "male_01.wav",
  "clint": "Clint_Eastwood CC3 (enhanced).wav",
  "morgan": "Morgan_Freeman CC3.wav"
};

// Cria diretório temporário para arquivos de áudio
const tempDir = path.join(os.tmpdir(), 'whatsapp-bot-speech');
fs.mkdir(tempDir, { recursive: true })
  .then(() => {
    logger.info(`Diretório temporário criado: ${tempDir}`);
  })
  .catch(error => {
    logger.error('Erro ao criar diretório temporário:', error);
  });

logger.info(`Módulo SpeechCommands carregado, whisperPath: ${whisperPath}`);

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
 * Converte texto para voz usando AllTalk API (XTTS)
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @param {string} character - Personagem a ser usado (opcional)
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function textToSpeech(bot, message, args, group, character = "ravena") {
  try {
    const chatId = message.group || message.author;
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça texto para converter em voz.'
      });
    }
    
    const text = args.join(' ');
    logger.debug(`Convertendo texto para voz (${character}): ${text}`);
    
    // Nome do arquivo de saída
    const hash = crypto.randomBytes(2).toString('hex');
    const outputFilename = `tts_audio_${hash}`;
    const localArquivo = path.join(alltalkOutputFolder, `${outputFilename}.mp3`);
    
    // Monta a URL para a API do AllTalk
    const apiUrl = `${allTalkAPI}api/tts-generate`;
    
    // Cria os parâmetros para a requisição usando URLSearchParams
    const params = new URLSearchParams({
      text_input: text,
      text_filtering: "standard",
      character_voice_gen: ttsCharacters[character],
      narrator_enabled: "false",
      narrator_voice_gen: "",
      text_not_inside: "character",
      language: "pt",
      output_file_name: outputFilename,
      output_file_timestamp: "false",
      autoplay: "false",
      autoplay_volume: "0.8"
    });
    
    // Faz a requisição para a API
    const response = await axios({
      method: 'post',
      url: apiUrl,
      data: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (response.data.status !== "generate-success") {
      throw new Error(`Falha na geração de voz: ${response.data.status}`);
    }
    
    logger.info(`Criando mídia de '${localArquivo}'`);
    const media = await bot.createMedia(localArquivo);
    
    // Retorna a ReturnMessage com o áudio
    const returnMessage = new ReturnMessage({
      chatId: chatId,
      content: media,
      options: {
        sendAudioAsVoice: true,
        quotedMessageId: message.origin.id._serialized
      }
    });
    
    logger.info(`Áudio TTS gerado com sucesso usando personagem ${character}`);
    
    // Limpa arquivos temporários
    try {
      await fs.unlink(localArquivo);
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
 * Converte voz para texto usando o executável Whisper diretamente
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @param {boolean} optimizeWithLLM - Se deve otimizar o texto com LLM
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function speechToText(bot, message, args, group, optimizeWithLLM = true) {
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
    
    // Converte para formato WAV para melhor compatibilidade
    const wavPath = audioPath.replace(/\.[^/.]+$/, '') + '.wav';
    await execPromise(`"${ffmpegPath}" -i "${audioPath}" -ar 16000 -ac 1 "${wavPath}"`);
    
    // Execute whisper diretamente
    // Usar o modelo large-v3-turbo e definir o idioma para português
    const whisperCommand = `"${whisperPath}" "${wavPath}" --model large-v3-turbo --language pt --output_dir "${tempDir}" --output_format txt`;
    
    logger.debug(`[speechToText] Executando comando: ${whisperCommand}`);
    
    await execPromise(whisperCommand);
    
    // O arquivo de saída vai ter o mesmo nome que o arquivo de entrada mas com extensão .txt
    const whisperOutputPath = wavPath.replace(/\.[^/.]+$/, '') + '.txt';
    
    // Lê o texto transcrito
    let transcribedText = '';
    try {
      transcribedText = await fs.readFile(whisperOutputPath, 'utf8');
      transcribedText = transcribedText.trim();
    } catch (readError) {
      logger.error('[speechToText] Erro ao ler arquivo de transcrição:', readError);
    }
    
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
        if (await fs.access(whisperOutputPath).then(() => true).catch(() => false)) {
          await fs.unlink(whisperOutputPath);
        }
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
    
    // Inicia processamento com LLM para melhoria do texto em paralelo, se habilitado
    if (optimizeWithLLM) {
      try {
        const improvedText = await llmService.getCompletion({
          prompt: `Vou enviar no final deste prompt a transcrição de um áudio, coloque a pontuação mais adequada e formate corretamente maíusculas e minúsculas. Me retorne APENAS com a mensagem formatada: '${transcribedText}'`,
          provider: 'openrouter',
          temperature: 0.7,
          maxTokens: 300
        });
        
        // Não vamos aguardar essa melhoria para retornar a mensagem inicial
        logger.info(`[speechToText] Melhoramento via LLM recebido: ${improvedText}`);
        
        // Nota: Essa atualização da mensagem precisará ser feita no CommandHandler
      } catch (llmError) {
        logger.error('[speechToText] Melhoramento via LLM deu erro, ignorando.', llmError);
      }
    }
    
    // Limpa arquivos temporários
    try {
      await fs.unlink(audioPath);
      await fs.unlink(wavPath);
      if (await fs.access(whisperOutputPath).then(() => true).catch(() => false)) {
        await fs.unlink(whisperOutputPath);
      }
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
    const idChat = message.group ?? message.author;
    // Pula se não for mensagem de voz/áudio
    if (message.type !== 'voice' && message.type !== 'audio') {
      return false;
    }
    
    // Verifica se o auto-STT está habilitado para este grupo
    if (group && !group.autoStt) {
      return false;
    }
    
    logger.debug(`[processAutoSTT] Processamento Auto-STT para mensagem no chat ${idChat}`);
    
    // Salva áudio em arquivo temporário
    const audioPath = await saveMediaToTemp(message.content, 'ogg');
    
    // Converte para formato WAV para melhor compatibilidade
    const wavPath = audioPath.replace(/\.[^/.]+$/, '') + '.wav';
    await execPromise(`"${ffmpegPath}" -i "${audioPath}" -ar 16000 -ac 1 "${wavPath}"`);
    
    // Execute whisper diretamente
    // Usar o modelo large-v3-turbo e definir o idioma para português
    const whisperCommand = `"${whisperPath}" "${wavPath}" --model large-v3-turbo --language pt --output_dir "${tempDir}" --output_format txt`;
    
    logger.debug(`[processAutoSTT] Executando comando: ${whisperCommand}`);
    
    await execPromise(whisperCommand);
    
    // O arquivo de saída vai ter o mesmo nome que o arquivo de entrada mas com extensão .txt
    const whisperOutputPath = wavPath.replace(/\.[^/.]+$/, '') + '.txt';
    
    // Lê o texto transcrito
    let transcribedText = '';
    try {
      transcribedText = await fs.readFile(whisperOutputPath, 'utf8');
      transcribedText = transcribedText.trim();
    } catch (readError) {
      logger.error('[processAutoSTT] Erro ao ler arquivo de transcrição:', readError);
      return false;
    }
    
    // Se a transcrição for bem-sucedida, envia-a
    if (transcribedText) {
      // Cria ReturnMessage com a transcrição
      const returnMessage = new ReturnMessage({
        chatId: idChat,
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
      } catch (llmError) {
        logger.error('[processAutoSTT] Melhoramento via LLM deu erro, ignorando.', llmError);
      }
    }
    
    // Limpa arquivos temporários
    try {
      await fs.unlink(audioPath);
      await fs.unlink(wavPath);
      if (await fs.access(whisperOutputPath).then(() => true).catch(() => false)) {
        await fs.unlink(whisperOutputPath);
      }
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

// Função para criar o comando TTS para um personagem específico
function createTTSCommandForCharacter(character) {
  const commandName = character === 'ravena' ? 'tts' : `tts-${character}`;
  
  return new Command({
    name: commandName,
    description: `Converte texto para voz usando personagem ${character}`,
    category: 'group',
    reactions: {
      before: "⌛️",
      after: "🔊"
    },
    method: (bot, message, args, group) => textToSpeech(bot, message, args, group, character)
  });
}

// Define os comandos usando a classe Command
const commands = [];

// Adiciona comandos TTS para cada personagem
Object.keys(ttsCharacters).forEach(character => {
  commands.push(createTTSCommandForCharacter(character));
});

// Adiciona comando STT
commands.push(
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
);

// Exporta função para ser usada em EventHandler
module.exports.commands = commands;
module.exports.processAutoSTT = processAutoSTT;