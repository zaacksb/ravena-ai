const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');
const Logger = require('../utils/Logger');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');
const ffmpeg = require('fluent-ffmpeg');
const { generateTempFilePath } = require('./FileConversions');
const fs = require('fs').promises;

const logger = new Logger('giphy-commands');

//logger.info('Módulo GiphyCommands carregado');

// Chave da API do Giphy
const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

// URLs da API Giphy
const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search';
const GIPHY_TRENDING_URL = 'https://api.giphy.com/v1/gifs/trending';

/**
 * Busca e envia um GIF do Giphy
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function enviarGif(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    const returnMessages = [];
    
    // Se não tiver API key configurada
    if (!GIPHY_API_KEY) {
      return new ReturnMessage({
        chatId: chatId,
        content: '⚠️ API do Giphy não configurada. Defina GIPHY_API_KEY no arquivo .env'
      });
    }
  
    
    let gifUrl, gifTitle, gifRating, gifSource, gifTrending;
    let gifData;
    
    if (args.length === 0) {
      // Se não tiver argumentos, busca GIFs populares/trending
      logger.info('Buscando GIFs trending');
      
      const response = await axios.get(GIPHY_TRENDING_URL, {
        params: {
          api_key: GIPHY_API_KEY,
          limit: 25,
          rating: 'pg-13'
        }
      });
      
      // Verifica se tem resultados
      if (!response.data || !response.data.data || response.data.data.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: '❌ Não foi possível encontrar GIFs populares. Tente novamente mais tarde.',
          options: {
            quotedMessageId: message.origin.id._serialized
          }
        });
      }
      
      // Seleciona um GIF aleatório da lista de trending
      const randomIndex = Math.floor(Math.random() * response.data.data.length);
      gifData = response.data.data[randomIndex];
      gifTrending = true;
    } else {
      // Busca por termo
      const searchTerm = args.join(' ');
      logger.info(`Buscando GIFs para: ${searchTerm}`);
      
      const response = await axios.get(GIPHY_SEARCH_URL, {
        params: {
          api_key: GIPHY_API_KEY,
          q: searchTerm,
          limit: 15,
          rating: 'pg-13',
          lang: 'pt'
        }
      });
      
      // Verifica se tem resultados
      if (!response.data || !response.data.data || response.data.data.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Nenhum GIF encontrado para "${searchTerm}". Tente outra busca.`,
          options: {
            quotedMessageId: message.origin.id._serialized
          }
        });
      }
      
      // Seleciona um GIF aleatório dos resultados
      const randomIndex = Math.floor(Math.random() * response.data.data.length);
      gifData = response.data.data[randomIndex];
      gifTrending = false;
    }
    
    // Extrai dados do GIF
    // MUDANÇA AQUI: Usamos a versão MP4 do GIF para garantir compatibilidade com WhatsApp
    gifUrl = gifData.images.original.mp4 || gifData.images.original.url;
    gifTitle = gifData.title || 'GIF do Giphy';
    gifRating = gifData.rating || 'g';
    gifSource = gifData.source_tld || 'giphy.com';
    
    // Formato para visualizações
    const formatViews = (views) => {
      if (!views) return 'N/A';
      
      if (views >= 1000000) {
        return `${(views / 1000000).toFixed(1)}M`;
      } else if (views >= 1000) {
        return `${(views / 1000).toFixed(1)}K`;
      } else {
        return views.toString();
      }
    };
    
    // Baixa o GIF
    const gifResponse = await axios.get(gifUrl, { responseType: 'arraybuffer' });
    const gifBuffer = Buffer.from(gifResponse.data, 'binary');
    
    // Determina o tipo MIME correto com base na URL
    const isMP4 = gifUrl.endsWith('.mp4');
    
    // Variável para armazenar o buffer final a ser enviado
    let finalBuffer;
    let finalMimeType = 'video/mp4'; // Sempre enviaremos como MP4
    
    if (isMP4) {
        // Se já for MP4, usamos diretamente
        finalBuffer = gifBuffer;
    } else {
        // Se for GIF, convertemos para MP4 usando FFMPEG
        logger.info('Convertendo GIF para MP4...');
        
        // Salvamos o GIF temporariamente
        const inputPath = generateTempFilePath('gif');
        await fs.writeFile(inputPath, gifBuffer);
        
        try {
            // Convertemos para MP4 sem áudio
            const outputPath = await convertGifToMp4(inputPath);
            
            // Lemos o arquivo convertido
            finalBuffer = await fs.readFile(outputPath);
            
            // Limpamos os arquivos temporários
            await fs.unlink(inputPath).catch(e => logger.error('Erro ao excluir arquivo temporário:', e));
            await fs.unlink(outputPath).catch(e => logger.error('Erro ao excluir arquivo temporário:', e));
        } catch (error) {
            logger.error('Erro ao converter GIF para MP4:', error);
            // Em caso de falha na conversão, usamos o GIF original
            finalBuffer = gifBuffer;
            finalMimeType = 'image/gif';
        }
    }
    
    // Convertemos para base64
    const finalBase64 = finalBuffer.toString('base64');
    
    // Cria mídia para o GIF/MP4
    const media = new MessageMedia(finalMimeType, finalBase64, 'giphy.mp4');
    
    // Prepara a legenda
    let caption = '';
    
    if (gifTrending) {
      caption = `🔥 *GIF Popular*\n`;
    } else {
      caption = `🔍 *Busca:* ${args.join(' ')}\n`;
    }
    
    // Adiciona informações do GIF
    caption += `🏷️ *Título:* ${gifTitle}\n`;
    
    if (gifData.import_datetime) {
      const date = new Date(gifData.import_datetime);
      caption += `📅 *Publicado:* ${date.toLocaleDateString('pt-BR')}\n`;
    }
    
    // Adiciona visualizações, se disponíveis
    if (gifData.analytics) {
      const views = gifData.analytics?.viewport?.value || 0;
      caption += `👀 *Visualizações:* ${formatViews(views)}\n`;
    }
    
    // Adiciona classificação e fonte
    caption += `📊 *Classificação:* ${gifRating.toUpperCase()}\n`;
    caption += `🔗 *Fonte:* ${gifSource || 'Giphy'}\n`;
    
    // Retorna a mídia com legenda e configuração correta para GIF
    return new ReturnMessage({
      chatId: chatId,
      content: media,
      options: {
        caption: caption,
        sendMediaAsDocument: false,
        sendVideoAsGif: true, // IMPORTANTE: Define para enviar como GIF animado
        quotedMessageId: message.origin.id._serialized
      }
    });
    
    logger.info(`GIF enviado com sucesso para ${chatId}`);
  } catch (error) {
    logger.error('Erro ao buscar/enviar GIF:', error);
    
    const chatId = message.group || message.author;
    let errorMessage = 'Erro ao buscar GIF. Por favor, tente novamente.';
    
    if (error.response) {
      // Erro da API
      if (error.response.status === 403) {
        errorMessage = 'Chave de API do Giphy inválida. Verifique sua configuração.';
      } else if (error.response.status === 429) {
        errorMessage = 'Limite de requisições da API do Giphy excedido. Tente novamente mais tarde.';
      }
    }
    
    return new ReturnMessage({
      chatId: chatId,
      content: `❌ ${errorMessage}`,
      options: {
        quotedMessageId: message.origin.id._serialized
      }
    });
  }
}

/**
 * Converte um GIF para MP4 sem áudio usando FFMPEG
 * @param {string} inputPath - Caminho do arquivo GIF
 * @returns {Promise<string>} - Caminho do arquivo MP4 gerado
 */
async function convertGifToMp4(inputPath) {
  const outputPath = generateTempFilePath('mp4');
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .noAudio() // Sem áudio
      .videoCodec('libx264') // Codec de vídeo H.264
      .outputOptions([
        '-pix_fmt yuv420p', // Formato de pixel compatível
        '-movflags +faststart', // Otimização para streaming
        '-preset ultrafast', // Conversão rápida
        '-crf 23' // Qualidade razoável (valores menores = melhor qualidade)
      ])
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

// Comandos utilizando a classe Command
const commands = [
  new Command({
    name: 'gif',
    description: 'Busca e envia um GIF do Giphy',
    category: "busca",
    reactions: {
      before: "⏳",
      after: "📱"
    },
    method: enviarGif
  })
];

// Registra os comandos sendo exportados
//logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };