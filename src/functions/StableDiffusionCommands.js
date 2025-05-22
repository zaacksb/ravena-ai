const path = require('path');
const axios = require('axios');
const fs = require('fs').promises;
const Logger = require('../utils/Logger');
const NSFWPredict = require('../utils/NSFWPredict');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

const logger = new Logger('stable-diffusion-commands');
const nsfwPredict = NSFWPredict.getInstance();

const LLMService = require('../services/LLMService');
const llmService = new LLMService({});

//logger.info('Módulo StableDiffusionCommands carregado');

// Configuração da API SD WebUI
const API_URL = process.env.SDWEBUI_URL || 'http://localhost:7860';
const DEFAULT_PARAMS = {
  width: 832,
  height: 1216,
  steps: 10,
  cfg_scale: 1,
  sampler_name: 'k_euler_a',
  batch_size: 1,
  n_iter: 1,
  negative_prompt: "ass bum poop woman dick nsfw porn boobs tits vagina child kid gore infant"
};


/**
 * Gera uma imagem usando a API do Stable Diffusion
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */

async function generateImage(bot, message, args, group, skipNotify = false) {
  const chatId = message.group || message.author;
  const returnMessages = [];
  
  const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
  let prompt = args.join(' ');
  if(quotedMsg){  
    prompt += " "+quotedMsg.body;
  }

  if (prompt.length < 4) {
    return new ReturnMessage({
      chatId: chatId,
      content: 'Por favor, forneça um prompt para gerar a imagem. Exemplo: !imagine um gato usando chapéu de cowboy'
    });
  }

  logger.info(`Gerando imagem com prompt: ${prompt}`);
  
  try {
  
    const safetyQuestion = `Check if this image generation prompt is safe and appropriate: "${prompt}". 
    Is it requesting explicit sexual content, child safety concerns? 
    Answer only "SAFE" or "UNSAFE" followed by a brief reason.`;
    
    const safetyResponse = await llmService.getCompletion({
      prompt: safetyQuestion
    });
    
    let safetyMsg = "";
    // Check if the response indicates unsafe content
    if (safetyResponse.toLowerCase().includes("unsafe") || 
        prompt.toLowerCase().includes("gore")) {
      
      // Log the inappropriate request
      const reportMessage = `⚠️ INAPPROPRIATE IMAGE REQUEST ⚠️\nUser: ${message.author}\nName: ${message.authorName || "Unknown"}\nPrompt: ${prompt}\nLLM Response: ${safetyResponse}\n\n!sa-block ${message.author}`;
      bot.sendMessage(process.env.GRUPO_LOGS, reportMessage);
      
      safetyMsg = "\n\n> ⚠️ *AVISO*: O conteúdo solicitado é duvidoso. Esta solicitação será revisada pelo administrador e pode resultar em suspensão.";
    }
    
    if(!skipNotify){
      // Envia mensagem de processamento
      await bot.sendReturnMessages(new ReturnMessage({
        chatId: chatId,
        content: '🖼️ Gerando imagem, isso pode levar alguns segundos...'
      }));
    }
    
    // Inicia cronômetro para medir tempo de geração
    const startTime = Date.now();
    
    // Parâmetros para a API
    const payload = {
      prompt: prompt,
      negative_prompt: "bad anatomy, bad hands, text, missing fingers, extra digit, fewer digits, cropped, low-res, worst quality, jpeg artifacts, signature, watermark, username, blurry",
      ...DEFAULT_PARAMS
    };
    
    // Faz a requisição à API
    const response = await axios.post(`${API_URL}/sdapi/v1/txt2img`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000 // 2 minutos de timeout
    });
    
    // Calcula o tempo de geração
    const generationTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Verifica se a resposta contém as imagens
    if (!response.data || !response.data.images || response.data.images.length === 0) {
      throw new Error('A API não retornou imagens');
    }
    
    // Obtém a primeira imagem (base64) e informações
    const imageBase64 = response.data.images[0];
    const info = JSON.parse(response.data.info || '{}');
    const modelName = info.sd_model_name || 'Modelo desconhecido';
    
    // Verificar NSFW antes de enviar
    // Primeiro, salva a imagem temporariamente para análise
    const tempDir = path.join(__dirname, '../../temp');
    
    // Garante que o diretório exista
    try {
      await fs.access(tempDir);
    } catch (error) {
      await fs.mkdir(tempDir, { recursive: true });
    }
    
    const tempImagePath = path.join(tempDir, `sd-${Date.now()}.jpg`);
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    await fs.writeFile(tempImagePath, imageBuffer);
    
    logger.info(`Recebida resposta, savaldno imagem em: ${tempImagePath}`);

    // Verificar NSFW
    let isNSFW = false;
    try {
      const nsfwResult = await nsfwPredict.detectNSFW(tempImagePath);
      isNSFW = nsfwResult.isNSFW;
      logger.info(`Imagem analisada: NSFW = ${isNSFW}, Scores: ${JSON.stringify(nsfwResult.scores)}`);
    } catch (nsfwError) {
      logger.error('Erro ao verificar NSFW:', nsfwError);
    }
    
    // Limpar arquivo temporário após alguns minutos
    setTimeout((tempImg) => {
      try {
        fs.unlink(tempImg);
      } catch (unlinkError) {
        logger.error('Erro ao excluir arquivo temporário:', tempImg, unlinkError);
      }
    }, 30000, tempImagePath);
    
    // Prepara a legenda com informações sobre a geração
    const caption = `🎨 *Prompt:* ${prompt}\n📊 *Modelo:* ${modelName}\n⏱️ *Tempo:* ${generationTime}s${safetyMsg}`;
    
    const media = await bot.createMedia(tempImagePath);
    logger.info(media);
    
    // Se a imagem for NSFW, envia um aviso antes
    if (isNSFW) {
      if(group.filters.nsfw){
        returnMessages.push(new ReturnMessage({
          chatId: chatId,
          content: '🔞 A imagem gerada pode conter conteúdo potencialmente inadequado e este grupo está filtrando conteúdo NSFW, por isso o resultado não foi enviado.'
        }));
      } else {    
        returnMessages.push(new ReturnMessage({
          chatId: chatId,
          content: '🔞 A imagem gerada pode conter conteúdo potencialmente inadequado, abra com cautela.'
        }));
        
        // Envia a imagem como viewOnly
        returnMessages.push(new ReturnMessage({
          chatId: chatId,
          content: media,
          options: {
            caption: caption,
            isViewOnce: true
          }
        }));
      }
    } else {
      // Envia a imagem normalmente se não for NSFW
      returnMessages.push(new ReturnMessage({
        chatId: chatId,
        content: media,
        options: {
          caption: caption
        }
      }));
    }
    
    // Se só tiver um item no array, retorna ele diretamente
    return returnMessages.length === 1 ? returnMessages[0] : returnMessages;
  } catch (error) {
    logger.error('Erro ao gerar imagem:', error);
    
    let errorMessage = 'Erro ao gerar imagem.';
    
    // Detalhes adicionais para erros específicos
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Não foi possível conectar ao servidor Stable Diffusion. Verifique se ele está rodando e acessível.';
    } else if (error.response) {
      // Erro da API
      errorMessage = `Erro da API Stable Diffusion: ${error.response.status} - ${error.response.statusText}`;
    }
    
    return new ReturnMessage({
      chatId: chatId,
      content: errorMessage
    });
  }
}

// Comandos utilizando a classe Command
const commands = [
  new Command({
    name: 'imagine',
    description: 'Gera uma imagem usando Stable Diffusion',
    category: 'ia',
    reactions: {
      trigger: "✨",
      before: "⏳",
      after: "✨"
    },
    cooldown: 30,
    method: generateImage
  })
];

// Registra os comandos sendo exportados
//logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };