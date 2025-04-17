const axios = require('axios');
const malScraper = require('mal-scraper');
const { MessageMedia } = require('whatsapp-web.js');
const Logger = require('../utils/Logger');

const logger = new Logger('anime-commands');

logger.info('Módulo AnimeCommands carregado');

const commands = [
  {
    name: 'anime',
    description: 'Busca informações sobre um anime no MyAnimeList',
    reactions: {
      before: "🔍",
      after: "🗾"
    },
    method: async (bot, message, args, group) => {
      await buscarAnime(bot, message, args, group);
    }
  }
];

/**
 * Busca informações sobre um anime no MyAnimeList
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 */
async function buscarAnime(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    if (args.length === 0) {
      await bot.sendMessage(chatId, 'Por favor, forneça o nome de um anime para buscar. Exemplo: !anime Naruto');
      return;
    }
    
    // Obtém o nome do anime
    const nome = args.join(' ');
    
    // Envia mensagem de processamento
    await bot.sendMessage(chatId, `🔍 Buscando informações sobre "${nome}"...`);
    
    // Busca informações do anime usando mal-scraper
    const data = await malScraper.getInfoFromName(nome);
    
    // Verifica se encontrou dados
    if (!data || !data.title) {
      await bot.sendMessage(chatId, `❌ Não foi possível encontrar informações sobre "${nome}". Verifique se o nome está correto.`);
      return;
    }
    
    // Obtém dados do anime
    const titulo = data.title;
    const tituloJapones = data.japaneseTitle || 'N/A';
    const sinopse = data.synopsis || 'Sinopse não disponível.';
    const lancamento = data.aired ? data.aired.split(' to ')[0] : 'N/A';
    const finalizado = data.status || 'N/A';
    const episodios = data.episodes || 'N/A';
    const duracao = data.duration || 'N/A';
    const generos = data.genres ? data.genres.join(', ') : 'N/A';
    const nota = data.score || 'N/A';
    const ranking = data.ranked || 'N/A';
    const popularidade = data.popularity || 'N/A';
    const imagem = data.picture || null;
    const fonte = data.source || 'N/A';
    const estudio = data.studios ? data.studios.join(', ') : 'N/A';
    const tipo = data.type || 'N/A';
    
    // Prepara o texto da mensagem
    let mensagem = `🗾 *${titulo}* (${tituloJapones})\n\n`;
    mensagem += `📅 *Lançamento*: ${lancamento} (${finalizado} @ ${tipo})\n`;
    mensagem += `🏢 *Estúdio*: ${estudio}\n`;
    mensagem += `📖 *Fonte*: ${fonte}\n`;
    mensagem += `🍿 *Gênero*: ${generos}\n`;
    mensagem += `🔢 *Episódios*: ${episodios} (_${duracao}_)\n`;
    mensagem += `🏆 *Nota:* ${nota}, #${ranking} no ranking, #${popularidade} em popularidade\n\n`;
    mensagem += `💬 *Sinopse:* ${sinopse.trim()}`;
    
    // Se tiver imagem, baixa e envia com a mensagem
    if (imagem) {
      try {
        // Baixa a imagem
        const response = await axios.get(imagem, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'binary');
        const base64Image = imageBuffer.toString('base64');
        
        // Cria mídia a partir da imagem
        const media = new MessageMedia('image/jpeg', base64Image, 'anime.jpg');
        
        // Envia a mensagem com mídia
        await bot.sendMessage(chatId, media, { caption: mensagem });
      } catch (imageError) {
        logger.error('Erro ao baixar imagem do anime:', imageError);
        // Se falhar ao baixar a imagem, envia apenas o texto
        await bot.sendMessage(chatId, mensagem);
      }
    } else {
      // Se não tiver imagem, envia apenas o texto
      await bot.sendMessage(chatId, mensagem);
    }
  } catch (error) {
    logger.error('Erro ao buscar anime:', error);
    
    const chatId = message.group || message.author;
    let errorMessage = 'Erro ao buscar informações do anime. Por favor, tente novamente.';
    
    if (error.message.includes('Invalid')) {
      errorMessage = `Não foi possível encontrar esse anime. Verifique se o nome está correto.`;
    } else if (error.message.includes('timeout')) {
      errorMessage = `Tempo esgotado ao buscar informações. A API pode estar indisponível.`;
    }
    
    await bot.sendMessage(chatId, `❌ ${errorMessage}`);
  }
}

// Registra os comandos sendo exportados
logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };