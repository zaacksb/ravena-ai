const axios = require('axios');
const Logger = require('../utils/Logger');
const { MessageMedia } = require('whatsapp-web.js');

const logger = new Logger('giphy-commands');

logger.info('Módulo GiphyCommands carregado');

// Chave da API do Giphy
const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

// URLs da API Giphy
const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search';
const GIPHY_TRENDING_URL = 'https://api.giphy.com/v1/gifs/trending';

const commands = [
  {
    name: 'gif',
    description: 'Busca e envia um GIF do Giphy',
    reactions: {
      before: "🔍",
      after: "📱"
    },
    method: async (bot, message, args, group) => {
      await enviarGif(bot, message, args, group);
    }
  }
];

/**
 * Busca e envia um GIF do Giphy
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 */
async function enviarGif(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Se não tiver API key configurada
    if (!GIPHY_API_KEY) {
      await bot.sendMessage(chatId, '⚠️ API do Giphy não configurada. Defina GIPHY_API_KEY no arquivo .env');
      return;
    }
    
    // Envia mensagem de aguarde
    await bot.sendMessage(chatId, '🔍 Buscando GIF...');
    
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
        await bot.sendMessage(chatId, '❌ Não foi possível encontrar GIFs populares. Tente novamente mais tarde.');
        return;
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
        await bot.sendMessage(chatId, `❌ Nenhum GIF encontrado para "${searchTerm}". Tente outra busca.`);
        return;
      }
      
      // Seleciona um GIF aleatório dos resultados
      const randomIndex = Math.floor(Math.random() * response.data.data.length);
      gifData = response.data.data[randomIndex];
      gifTrending = false;
    }
    
    // Extrai dados do GIF
    gifUrl = gifData.images.original.url;
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
    const gifBase64 = gifBuffer.toString('base64');
    
    // Cria mídia para o GIF
    const media = new MessageMedia('image/gif', gifBase64, 'giphy.gif');
    
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
    
    // Envia a mídia com legenda
    await bot.sendMessage(chatId, media, {
      caption: caption,
      sendMediaAsDocument: false // Envia como mídia normal (não documento)
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
    
    await bot.sendMessage(chatId, `❌ ${errorMessage}`);
  }
}

// Registra os comandos sendo exportados
logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };