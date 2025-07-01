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

const runOn = process.env.WHISPER_USE_GPU ? "" : "--device cpu";

const whisperPath = process.env.WHISPER;

// Definição dos personagens para TTS
const ttsCharacters = [
  {"name": "ravena", "emoji": ["🗣","🦇"], "voice": "ravena_sample.wav"},
  {"name": "mulher", "emoji": "👩", "voice": "female_01.wav"},
  {"name": "carioca", "voice": "female_02.wav"},
  {"name": "carioco", "voice": "male_02.wav"},
  {"name": "sensual", "emoji": "💋", "voice": "female_03.wav"},
  {"name": "sensuel", "voice": "male_04.wav"},
  {"name": "homem", "emoji": "👨", "voice": "male_01.wav"},
  {"name": "clint", "voice": "Clint_Eastwood CC3 (enhanced).wav"},
  {"name": "morgan", "voice": "Morgan_Freeman CC3.wav"},
  {"name": "narrador", "emoji": "🎙", "voice": "James_Earl_Jones CC3.wav"}
];

// Cria diretório temporário para arquivos de áudio
const tempDir = path.join(__dirname, '../../temp', 'whatsapp-bot-speech');
fs.mkdir(tempDir, { recursive: true })
  .then(() => {
    logger.info(`Diretório temporário criado: ${tempDir}`);
  })
  .catch(error => {
    logger.error('Erro ao criar diretório temporário:', error);
  });

logger.info(`Módulo SpeechCommands carregado, whisperPath: ${whisperPath} ${runOn}`);

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
 * Remove marcações do WhatsApp do texto
 * @param {string} text - Texto a ser limpo
 * @returns {string} - Texto limpo
 */
function removeWhatsAppMarkup(text) {
  if (!text) return "";
  
  // Remove marcações de negrito
  text = text.replace(/\*/g, '');
  
  // Remove marcações de itálico
  text = text.replace(/\_/g, '');
  
  // Remove marcações de riscado
  text = text.replace(/\~/g, '');
  
  // Remove marcações de monospace
  text = text.replace(/\`/g, '');
  
  // Remove marcações de citação (>)
  text = text.replace(/^\s*>\s*/gm, '');
  
  // Remove qualquer outra marcação especial que possa afetar a síntese de voz
  text = text.replace(/[\[\]\(\)]/g, ' ');
  
  // Remove caracteres de formatação especiais
  text = text.replace(/[\u0000-\u001F\u007F-\u009F\u2000-\u200F\u2028-\u202F]/g, ' ');
  
  // Remove múltiplos espaços em branco
  text = text.replace(/\s+/g, ' ');
  
  // Preserva quebras de linha
  text = text.replace(/\\n/g, '\n');
  
  return text.trim();
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
async function textToSpeech(bot, message, args, group, char = "ravena") {
  try {
    const chatId = message.group || message.author;
      
    const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
    let text = args.join(' ');

    if(quotedMsg){  
      const quotedText = quotedMsg.caption ?? quotedMsg.content ?? quotedMsg.body;
      text += " "+quotedText;
    }

    if (text.length < 1) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça texto para converter em voz.',
        options: {
          quotedMessageId: message.origin.id._serialized,
          evoReply: message.origin
        }
      });
    }
    
    // Limpa as marcações do WhatsApp antes de processar com AllTalk
    text = removeWhatsAppMarkup(text);
    
    const character = ttsCharacters.find(ttsC => ttsC.name === char);
    if(text.length > 150){
      await bot.sendReturnMessages(new ReturnMessage({
        chatId: chatId,
        content: '🔉 Sintetizando áudio, isso pode levar alguns segundos...',
        options: {
          quotedMessageId: message.origin.id._serialized,
          evoReply: message.origin
        }
      }));
    }

    logger.debug(`Convertendo texto para voz (${JSON.stringify(character)}): ${text}`);

    // Nome do arquivo temporário
    const hash = crypto.randomBytes(2).toString('hex');
    const tempFilename = `tts_audio_${hash}.mp3`;
    const tempFilePath = path.join(tempDir, tempFilename);
    
    // Monta a URL para a API do AllTalk
    const apiUrl = `${allTalkAPI}/api/tts-generate`;
    
    // Cria os parâmetros para a requisição usando URLSearchParams
    const params = new URLSearchParams({
      text_input: text,
      text_filtering: "standard",
      character_voice_gen: character.voice,
      narrator_enabled: "false",
      language: "pt",
      output_file_name: `tts_audio_${hash}`,
      output_file_timestamp: "false"
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

    console.log(response.data);
    
    // Obter o arquivo de áudio da API
    const urlResultado = `${allTalkAPI}${response.data.output_file_url}`;
    logger.info(`Baixando mídia de '${urlResultado}'`);

    const audioResponse = await axios({
      method: 'get',
      url: urlResultado,
      responseType: 'arraybuffer'
    });
    
    // Salvar o arquivo localmente (temporariamente)
    await fs.writeFile(tempFilePath, Buffer.from(audioResponse.data));
    
    logger.info(`Criando mídia de '${tempFilePath}'`);
    const media = await bot.createMedia(tempFilePath);
    
    // Retorna a ReturnMessage com o áudio
    const returnMessage = new ReturnMessage({
      chatId: chatId,
      content: media,
      options: {
        sendAudioAsVoice: true,
        quotedMessageId: message.origin.id._serialized,
        evoReply: message.origin
      }
    });
    
    logger.info(`Áudio TTS gerado com sucesso usando personagem ${character.name}`);
    
    // Limpa arquivos temporários
    try {
      await fs.unlink(tempFilePath);
      logger.debug('Arquivos temporários limpos');
    } catch (cleanupError) {
      logger.error('Erro ao limpar arquivos temporários:', cleanupError);
    }
    
    return returnMessage;
  } catch (error) {
    logger.error('Erro na conversão de texto para voz:');
    console.log(error);
    const chatId = message.group || message.author;
    
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao gerar voz. Por favor, tente novamente.',
      options: {
        quotedMessageId: message.origin.id._serialized,
        evoReply: message.origin
      }
    });
  }
}

/**
 * Cleans up a string by removing time formatting in square brackets and trimming whitespace
 * @param {string} text - The input text to clean
 * @returns {string} - The cleaned text
 */
function cleanupString(text) {
  // Split the input into lines
  const lines = text.split('\n');
  
  // Process each line
  const cleanedLines = lines.map(line => {
    // Remove everything inside square brackets at the start of the line
    const cleanedLine = line.replace(/^\s*\[.*?\]\s*/, '');
    // Trim any remaining whitespace
    return `_${cleanedLine.trim()}_`;
  });
  
  // Filter out empty lines and join the result
  return cleanedLines.filter(line => line.length > 2).join('\n');
}

/**
 * Converte voz para texto usando o executável Whisper diretamente ou via API
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @param {boolean} optimizeWithLLM - Se deve otimizar o texto com LLM
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function speechToText(bot, message, args, group, optimizeWithLLM = true) {
  const chatId = message.group || message.author;
  let audioPath = null;
  let wavPath = null;
  let whisperOutputPath = null;

  try {
    // Obtém mídia da mensagem
    const media = await getMediaFromMessage(message);
    if (!media) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça um áudio ou mensagem de voz.',
        options: {
          quotedMessageId: message.origin.id._serialized,
          evoReply: message.origin
        }
      });
    }

    // Verifica se a mídia é áudio
    const isAudio = media.mimetype.startsWith('audio/') ||
                   media.mimetype === 'application/ogg';

    if (!isAudio) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça um áudio ou mensagem de voz.',
        options: {
          quotedMessageId: message.origin.id._serialized,
          evoReply: message.origin
        }
      });
    }

    logger.debug('[speechToText] Convertendo voz para texto');

    // Salva áudio em arquivo temporário
    audioPath = await saveMediaToTemp(media, 'ogg');

    let transcribedText = '';

    if (process.env.WHISPER_API_URL) {
      // Use Whisper API
      const WHISPER_API_URL = process.env.WHISPER_API_URL;
      logger.debug(`[speechToText] Usando Whisper API: ${WHISPER_API_URL}`);

      try {
        const audioBuffer = await fs.readFile(audioPath);
        const requestBody = {
          audioData: audioBuffer.toString('base64'),
          language: 'pt' // Assuming Portuguese as per local execution
        };

        const postResponse = await axios.post(`${WHISPER_API_URL}/transcribe`, requestBody);
        const { executionId, audioDuration, estimatedTranscriptionTime } = postResponse.data;

        if (!executionId) {
          throw new Error('A API não retornou um executionId.');
        }

        logger.info(`🚀 Processo de transcrição iniciado! ID de Execução: ${executionId}`);
        logger.info(`Tempo estimado para a primeira verificação: ${estimatedTranscriptionTime} segundos.`);
        logger.info('Verificando o status...');

        bot.sendReturnMessages(new ReturnMessage({
          chatId: chatId,
          content: `🔉 Transcrevendo áudio com _${audioDuration}s_, estimativa de _${estimatedTranscriptionTime}s_ até concluir.`,
          options: {
            quotedMessageId: message.origin.id._serialized,
            evoReply: message.origin
          }
        }));

        let finalResult = null;
        let firstCheck = true;
        while (!finalResult) {
          const sleepTime = firstCheck ? estimatedTranscriptionTime * 1000 : 3000; // Aguarda o tempo estimado na primeira vez, depois 3 segundos
          await new Promise(resolve => setTimeout(resolve, sleepTime));
          firstCheck = false;

          try {
            const statusResponse = await axios.get(`${WHISPER_API_URL}/status/${executionId}`);
            const result = statusResponse.data;

            logger.debug(`[${new Date().toLocaleTimeString()}] Status atual: ${result.status}`);

            if (result.status === 'complete') {
              finalResult = result;
              transcribedText = result.text;
              logger.info('\n✅ Transcrição Concluída!\n');
            } else if (result.status === 'error') {
              finalResult = result;
              throw new Error(`Ocorreu um erro durante a transcrição: ${result.error}`);
            }
          } catch (error) {
            throw new Error(`Não foi possível obter o status da transcrição: ${error.message}`);
          }
        }
      } catch (apiError) {
        logger.error('[speechToText] Erro ao usar Whisper API:', apiError);
        transcribedText = "Erro ao transcrever áudio via API. Por favor, tente novamente.";
      }
    } else {
      // Envia mensagem de processamento
      bot.sendReturnMessages(new ReturnMessage({
        chatId: chatId,
        content: 'Transcrevendo áudio, isso pode levar alguns segundos...',
        options: {
          quotedMessageId: message.origin.id._serialized,
          evoReply: message.origin
        }
      }));

      // Existing local Whisper execution logic
      wavPath = audioPath.replace(/\.[^/.]+$/, '') + '.wav';
      await execPromise(`"${ffmpegPath}" -i "${audioPath}" -ar 16000 -ac 1 "${wavPath}"`);

      const whisperCommand = `"${whisperPath}" "${wavPath}" --model large-v3-turbo ${runOn} --language pt --output_dir "${tempDir}" --output_format txt`;

      logger.debug(`[speechToText] Executando comando: ${whisperCommand}`);

      await execPromise(whisperCommand);

      whisperOutputPath = wavPath.replace(/\.[^/.]+$/, '') + '.txt';

      logger.debug(`[speechToText] Lendo arquivo de saida: ${whisperOutputPath}`);
      try {
        transcribedText = await fs.readFile(whisperOutputPath, 'utf8');
        transcribedText = transcribedText.trim();
      } catch (readError) {
        logger.error('[speechToText] Erro ao ler arquivo de transcrição:', readError);
      }
    }

    logger.debug(`[speechToText] LIDO arquivo de saida: '${transcribedText}'`);

    if (!transcribedText || transcribedText.includes("Erro ao transcrever áudio")) {
      transcribedText = "Não foi possível transcrever o áudio. O áudio pode estar muito baixo ou pouco claro.";

      const errorMessage = new ReturnMessage({
        chatId: chatId,
        content: transcribedText,
        options: {
          quotedMessageId: message.origin.id._serialized,
          evoReply: message.origin
        }
      });

      return errorMessage;
    }

    const returnMessage = new ReturnMessage({
      chatId: chatId,
      content: cleanupString(transcribedText?.trim() ?? ""),
      options: {
        quotedMessageId: message.origin.id._serialized,
        evoReply: message.origin
      }
    });

    logger.info(`[speechToText] Resultado STT gerado com sucesso: ${transcribedText}`);

    return returnMessage;
  } catch (error) {
    logger.error('Erro na conversão de voz para texto:', error);
    const chatId = message.group || message.author;

    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao transcrever áudio. Por favor, tente novamente.'
    });
  } finally {
    // Clean up temporary files in finally block to ensure they are always removed
    try {
      if (audioPath) await fs.unlink(audioPath);
      if (wavPath) await fs.unlink(wavPath);
      if (whisperOutputPath && await fs.access(whisperOutputPath).then(() => true).catch(() => false)) {
        await fs.unlink(whisperOutputPath);
      }
      logger.debug('Arquivos temporários limpos no finally');
    } catch (cleanupError) {
      logger.error('Erro ao limpar arquivos temporários no finally:', cleanupError);
    }
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
  const chatId = message.group || message.author;
  let audioPath = null;
  let wavPath = null;
  let whisperOutputPath = null;

  try {
    if(!message.group && bot.ignorePV){
       return false;
    }

    // Pula se não for mensagem de voz/áudio
    if (message.type !== 'voice' && message.type !== 'audio' && message.type !== 'ptt') {
      return false;
    }

    // Verifica se o auto-STT está habilitado para este grupo
    if (group && !group.autoStt) {
      return false;
    }

    try{
      await message.origin.react("⌛️");
    } catch(e){
      logger.error(`[processAutoSTT] Erro enviando notificação inicial`);
    }

    logger.debug(`[processAutoSTT] Processamento Auto-STT para mensagem no chat ${chatId}`);

    // Salva áudio em arquivo temporário
    const media = await message.downloadMedia();
    audioPath = await saveMediaToTemp(media, 'ogg');

    let transcribedText = '';

    if (process.env.WHISPER_API_URL) {
      // Use Whisper API
      const WHISPER_API_URL = process.env.WHISPER_API_URL;
      logger.debug(`[processAutoSTT] Usando Whisper API: ${WHISPER_API_URL}`);

      try {
        const audioBuffer = await fs.readFile(audioPath);
        const requestBody = {
          audioData: audioBuffer.toString('base64'),
          language: 'pt' // Assuming Portuguese as per local execution
        };

        const postResponse = await axios.post(`${WHISPER_API_URL}/transcribe`, requestBody);
        const { executionId, audioDuration, estimatedTranscriptionTime } = postResponse.data;

        if (!executionId) {
          throw new Error('A API não retornou um executionId.');
        }

        logger.info(`🚀 Processo de transcrição iniciado! ID de Execução: ${executionId}`);
        logger.info(`Tempo estimado para a primeira verificação: ${estimatedTranscriptionTime} segundos.`);
        logger.info('Verificando o status...');

        bot.sendReturnMessages(new ReturnMessage({
          chatId: chatId,
          content: `🔉 Transcrevendo áudio com _${audioDuration}s_, estimativa de _${estimatedTranscriptionTime}s_ até concluir.`,
          options: {
            quotedMessageId: message.origin.id._serialized,
            evoReply: message.origin
          }
        }));


        let finalResult = null;
        let firstCheck = true;
        while (!finalResult) {
          const sleepTime = firstCheck ? estimatedTranscriptionTime * 1000 : 3000; // Aguarda o tempo estimado na primeira vez, depois 3 segundos
          await new Promise(resolve => setTimeout(resolve, sleepTime));
          firstCheck = false;

          try {
            const statusResponse = await axios.get(`${WHISPER_API_URL}/status/${executionId}`);
            const result = statusResponse.data;

            logger.debug(`[${new Date().toLocaleTimeString()}] Status atual: ${result.status}`);

            if (result.status === 'complete') {
              finalResult = result;
              transcribedText = result.text;
              logger.info('✅ Transcrição Concluída!');
            } else if (result.status === 'error') {
              finalResult = result;
              throw new Error(`Ocorreu um erro durante a transcrição: ${result.error}`);
            }
          } catch (error) {
            throw new Error(`Não foi possível obter o status da transcrição: ${error.message}`);
          }
        }
      } catch (apiError) {
        logger.error('[processAutoSTT] Erro ao usar Whisper API:', apiError);
        transcribedText = "Erro ao transcrever áudio via API.";
      }
    } else {
      // Existing local Whisper execution logic
      wavPath = audioPath.replace(/\.[^/.]+$/, '') + '.wav';
      await execPromise(`"${ffmpegPath}" -i "${audioPath}" -ar 16000 -ac 1 "${wavPath}"`);

      const whisperCommand = `"${whisperPath}" "${wavPath}" --model large-v3-turbo --language pt --output_dir "${tempDir}" --output_format txt`;

      logger.debug(`[processAutoSTT] Executando comando: ${whisperCommand}`);

      await execPromise(whisperCommand);

      whisperOutputPath = wavPath.replace(/\.[^/.]+$/, '') + '.txt';

      logger.debug(`[processAutoSTT] Lendo arquivo de saida: ${whisperOutputPath}`);
      try {
        transcribedText = await fs.readFile(whisperOutputPath, 'utf8');
        transcribedText = transcribedText.trim();
      } catch (readError) {
        logger.error('[processAutoSTT] Erro ao ler arquivo de transcrição:', readError);
      }
    }

    // Se a transcrição for bem-sucedida, envia-a
    if (transcribedText && !transcribedText.includes("Erro ao transcrever áudio")) {
      // Cria ReturnMessage com a transcrição
      const returnMessage = new ReturnMessage({
        chatId: chatId,
        content: cleanupString(transcribedText?.trim() ?? ""),
        options: {
          quotedMessageId: message.origin.id._serialized,
          evoReply: message.origin
        }
      });

      // Envia a mensagem
      await bot.sendReturnMessages(returnMessage);

      logger.info(`[processAutoSTT] Resultado STT enviado com sucesso, processando via LLM uma melhoria para: ${transcribedText}`);

      // Tenta melhorar o texto com LLM (assíncrono)
      /*
      try {
        const improvedText = await llmService.getCompletion({
          prompt: `Vou enviar no final deste prompt a transcrição de um áudio, coloque a pontuação mais adequada e formate corretamente maíusculas e minúsculas. Me retorne APENAS com a mensagem formatada: '${transcribedText}'`,
        });

        logger.info(`[processAutoSTT] Melhoramento via LLM recebido: ${improvedText}`);

        // Nota: Aqui seria necessário um método para editar a mensagem já enviada
      } catch (llmError) {
        logger.error('[processAutoSTT] Melhoramento via LLM deu erro, ignorando.', llmError);
      }*/
    } else {
      logger.warn(`[processAutoSTT] Transcrição vazia ou com erro para o chat ${chatId}`);
    }

    return true;
  } catch (error) {
    logger.error('Erro no auto-STT:', error);
    return false;
  } finally {
    // Clean up temporary files in finally block to ensure they are always removed
    try {
      if (audioPath) await fs.unlink(audioPath);
      if (wavPath) await fs.unlink(wavPath);
      if (whisperOutputPath && await fs.access(whisperOutputPath).then(() => true).catch(() => false)) {
        await fs.unlink(whisperOutputPath);
      }
      logger.debug('Arquivos temporários limpos no finally');
    } catch (cleanupError) {
      logger.error('Erro ao limpar arquivos temporários no finally:', cleanupError);
    }
  }
}

// Define os comandos usando a classe Command
const commands = [
  new Command({
    name: 'stt',
    description: 'Converte voz para texto',
    category: 'utilidades',
    group: "transcr",
    needsMedia: true, // Verificará mídia direta ou mídia de mensagem citada
    reactions: {
      trigger: "👂",
      before: "⌛️",
      after: "👂"
    },
    method: speechToText
  }),
    new Command({
    name: 'transcrever',
    description: 'Converte voz para texto',
    category: 'utilidades',
    group: "transcr",
    needsMedia: true, // Verificará mídia direta ou mídia de mensagem citada
    reactions: {
      trigger: "👂",
      before: "⌛️",
      after: "👂"
    },
    method: speechToText
  }),
  new Command({
    name: "tts",
    description: `Converte texto para voz usando personagem 'ravena'`,
    category: "tts",
    reactions: {
      trigger: ["🗣️","🦇"],
      before: "⌛️",
      after: "🔊"
    },
    method: (bot, message, args, group) => textToSpeech(bot, message, args, group, "ravena")
  }),
  new Command({
    name: "tts-mulher",
    description: `Converte texto para voz usando personagem feminina`,
    group: "ttsMulher",
    category: "tts",
    reactions: {
      trigger: "👩",
      before: "⌛️",
      after: "🔊"
    },
    method: (bot, message, args, group) => textToSpeech(bot, message, args, group, "mulher")
  }),
  new Command({
    name: "tts-carioca",
    description: `Converte texto para voz usando personagem feminina`,
    group: "ttsMulher",
    category: "tts",
    reactions: {
      before: "⌛️",
      after: "🔊"
    },
    method: (bot, message, args, group) => textToSpeech(bot, message, args, group, "carioca")
  }),

  new Command({
    name: "tts-carioco",
    description: `Converte texto para voz usando personagem masculino`,
    group: "ttsHomem",
    category: "tts",
    reactions: {
      before: "⌛️",
      after: "🔊"
    },
    method: (bot, message, args, group) => textToSpeech(bot, message, args, group, "carioco")
  }),

  new Command({
    name: "tts-sensual",
    description: `Converte texto para voz usando personagem feminina`,
    group: "ttsMulher",
    category: "tts",
    reactions: {
      trigger: "💋",
      before: "⌛️",
      after: "🔊"
    },
    method: (bot, message, args, group) => textToSpeech(bot, message, args, group, "sensual")
  }),
  new Command({
    name: "tts-sensuel",
    description: `Converte texto para voz usando personagem masculino`,
    category: "tts",
    group: "ttsHomem",
    reactions: {
      before: "⌛️",
      after: "🔊"
    },
    method: (bot, message, args, group) => textToSpeech(bot, message, args, group, "sensuel")
  }),

  new Command({
    name: "tts-homem",
    description: `Converte texto para voz usando personagem masculino`,
    category: "tts",
    group: "ttsHomem",
    reactions: {
      trigger: "👨",
      before: "⌛️",
      after: "🔊"
    },
    method: (bot, message, args, group) => textToSpeech(bot, message, args, group, "homem")
  }),
  new Command({
    name: "tts-clint",
    description: `Converte texto para voz usando personagem masculino`,
    category: "tts",
    group: "ttsHomem",
    reactions: {
      before: "⌛️",
      after: "🔊"
    },
    method: (bot, message, args, group) => textToSpeech(bot, message, args, group, "clint")
  }),

  new Command({
    name: "tts-morgan",
    description: `Converte texto para voz usando personagem masculino`,
    category: "tts",
    group: "ttsHomem",
    reactions: {
      before: "⌛️",
      after: "🔊"
    },
    method: (bot, message, args, group) => textToSpeech(bot, message, args, group, "morgan")
  }),

  new Command({
    name: "tts-narrador",
    description: `Converte texto para voz usando personagem masculino`,
    group: "ttsHomem",
    category: "tts",
    reactions: {
      trigger: "🎙️",
      before: "⌛️",
      after: "🔊"
    },
    method: (bot, message, args, group) => textToSpeech(bot, message, args, group, "narrador")
  })
];


// Exporta função para ser usada em EventHandler
module.exports.commands = commands;
module.exports.processAutoSTT = processAutoSTT;