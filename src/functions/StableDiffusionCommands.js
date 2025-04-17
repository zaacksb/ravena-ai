const path = require('path');
const axios = require('axios');
const fs = require('fs').promises;
const Logger = require('../utils/Logger');
const NSFWPredict = require('../utils/NSFWPredict');

const logger = new Logger('stable-diffusion-commands');
const nsfwPredict = NSFWPredict.getInstance();

logger.info('Módulo StableDiffusionCommands carregado');

// Configuração da API SD WebUI
const API_URL = process.env.SDWEBUI_URL || 'http://localhost:7860';
const DEFAULT_PARAMS = {
  width: 512,
  height: 768,
  steps: 30,
  cfg_scale: 7,
  sampler_name: 'DPM++ 2M Karras',
  batch_size: 1,
  n_iter: 1
};

const commands = [
  {
    name: 'imagine',
    description: 'Gera uma imagem usando Stable Diffusion',
    reactions: {
      before: "🎨",
      after: "✨"
    },
    method: async (bot, message, args, group) => {
      await generateImage(bot, message, args, group);
    }
  }
];

/**
 * Gera uma imagem usando a API do Stable Diffusion
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 */
async function generateImage(bot, message, args, group) {
  const chatId = message.group || message.author;
  
  if (args.length === 0) {
    await bot.sendMessage(chatId, 'Por favor, forneça um prompt para gerar a imagem. Exemplo: !imagine um gato usando chapéu de cowboy');
    return;
  }
  
  // Obtém o prompt do usuário
  const prompt = args.join(' ');
  logger.info(`Gerando imagem com prompt: ${prompt}`);
  
  try {
    // Envia mensagem de processamento
    await bot.sendMessage(chatId, '🖼️ Gerando imagem, isso pode levar alguns segundos...');
    
    // Inicia cronômetro para medir tempo de geração
    const startTime = Date.now();
    
    // Parâmetros para a API
    const payload = {
      prompt: prompt,
      negative_prompt: "nsfw, nudity, pornography, (worst quality:1.2), (low quality:1.2), (lowres:1.1), bad anatomy, bad hands, text, missing fingers, extra digit, fewer digits, cropped, low-res, worst quality, jpeg artifacts, signature, watermark, username, blurry",
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
    
    // Verificar NSFW
    let isNSFW = false;
    try {
      const nsfwResult = await nsfwPredict.detectNSFW(tempImagePath);
      isNSFW = nsfwResult.isNSFW;
      logger.info(`Imagem analisada: NSFW = ${isNSFW}, Scores: ${JSON.stringify(nsfwResult.scores)}`);
    } catch (nsfwError) {
      logger.error('Erro ao verificar NSFW:', nsfwError);
    }
    
    // Limpar arquivo temporário após análise
    try {
      await fs.unlink(tempImagePath);
    } catch (unlinkError) {
      logger.error('Erro ao excluir arquivo temporário:', unlinkError);
    }
    
    // Prepara a legenda com informações sobre a geração
    const caption = `🎨 *Prompt:* ${prompt}\n📊 *Modelo:* ${modelName}\n⏱️ *Tempo:* ${generationTime}s`;
    
    // Cria objeto de mídia a partir do base64
    const media = {
      mimetype: 'image/jpeg',
      data: imageBase64,
      filename: 'stable-diffusion.jpg'
    };
    
    // Se a imagem for NSFW, envia um aviso antes
    if (isNSFW) {
      await bot.sendMessage(chatId, '🔞 A imagem gerada pode conter conteúdo potencialmente inadequado, abra com cautela.');
      
      // Envia a imagem como viewOnly
      await bot.sendMessage(chatId, media, {
        caption: caption,
        viewOnce: true
      });
    } else {
      // Envia a imagem normalmente se não for NSFW
      await bot.sendMessage(chatId, media, {
        caption: caption
      });
    }
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
    
    await bot.sendMessage(chatId, errorMessage);
  }
}

// Registra os comandos sendo exportados
logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };