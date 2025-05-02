const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');
const Logger = require('../utils/Logger');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');
const { translateText } = require('./TranslationCommands');

const logger = new Logger('imdb-commands');

//logger.info('Módulo ImdbCommands carregado');

// API key do OMDB (baseado na API do IMDB)
const OMDB_API_KEY = process.env.OMDB_API_KEY || '';

// URL base da API
const OMDB_API_URL = 'http://www.omdbapi.com/';

/**
 * Busca informações sobre um filme ou série no IMDB
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage com informações do filme/série
 */
async function buscarImdb(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    const returnMessages = [];
    
    // Verificar se a API key está configurada
    if (!OMDB_API_KEY) {
      return new ReturnMessage({
        chatId: chatId,
        content: '⚠️ API do OMDB não configurada. Defina OMDB_API_KEY no arquivo .env'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça o nome de um filme ou série para buscar. Exemplo: !imdb Inception',
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    // Obtém o nome do filme/série
    const nome = args.join(' ');
    
    
    // Realiza a busca inicial para obter o ID do filme/série
    const searchResponse = await axios.get(OMDB_API_URL, {
      params: {
        apikey: OMDB_API_KEY,
        s: nome,
        type: '', // todos os tipos (filme, série, episódio)
        r: 'json'
      }
    });
    
    // Verifica se encontrou resultados
    if (searchResponse.data.Response === 'False' || !searchResponse.data.Search || searchResponse.data.Search.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Não foi possível encontrar "${nome}". Verifique se o nome está correto.`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    // Obtém o primeiro resultado da busca
    const firstResult = searchResponse.data.Search[0];
    const imdbId = firstResult.imdbID;
    
    // Realiza a busca detalhada pelo ID
    const detailResponse = await axios.get(OMDB_API_URL, {
      params: {
        apikey: OMDB_API_KEY,
        i: imdbId,
        plot: 'full', // sinopse completa
        r: 'json'
      }
    });
    
    // Verifica se encontrou detalhes
    if (detailResponse.data.Response === 'False') {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Erro ao buscar detalhes para "${nome}".`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    // Obtém os detalhes do filme/série
    const data = detailResponse.data;
    
    // Formata duração (converte minutos para horas e minutos)
    let duracao = data.Runtime;
    if (duracao && duracao.includes('min')) {
      const minutos = parseInt(duracao.replace(' min', ''));
      if (!isNaN(minutos) && minutos > 60) {
        const horas = Math.floor(minutos / 60);
        const minutosRestantes = minutos % 60;
        duracao = `${horas}h ${minutosRestantes}min`;
      }
    }
    
    // Prepara a mensagem
    let mensagem = `🎬 *${data.Title}* (${data.Year})\n\n`;
    
    // Adiciona tipo e classificação
    mensagem += `📋 *Tipo:* ${data.Type.charAt(0).toUpperCase() + data.Type.slice(1)}`;
    if (data.Rated && data.Rated !== "N/A") {
      mensagem += ` | *Classificação:* ${data.Rated}`;
    }
    mensagem += '\n';
    
    // Adiciona informações básicas
    if (duracao && duracao !== "N/A") mensagem += `⏱️ *Duração:* ${duracao}\n`;
    if (data.Genre && data.Genre !== "N/A") mensagem += `🎭 *Gênero:* ${data.Genre}\n`;
    if (data.Director && data.Director !== "N/A") mensagem += `🎬 *Direção:* ${data.Director}\n`;
    if (data.Writer && data.Writer !== "N/A") {
      const writers = data.Writer.length > 100 ? data.Writer.substring(0, 97) + '...' : data.Writer;
      mensagem += `✍️ *Roteiro:* ${writers}\n`;
    }
    if (data.Actors && data.Actors !== "N/A") mensagem += `🎭 *Elenco:* ${data.Actors}\n`;
    
    // Adiciona informações de streaming se disponíveis
    if (data.streamingInfo && Object.keys(data.streamingInfo).length > 0) {
      const plataformas = Object.keys(data.streamingInfo).join(', ');
      mensagem += `📺 *Disponível em:* ${plataformas}\n`;
    }
    
    // Adiciona avaliações
    mensagem += '\n📊 *Avaliações:*\n';
    
    if (data.imdbRating && data.imdbRating !== "N/A") {
      mensagem += `  • IMDB: ${data.imdbRating}/10 (${data.imdbVotes} votos)\n`;
    }
    
    if (data.Ratings && data.Ratings.length > 0) {
      data.Ratings.forEach(rating => {
        if (rating.Source !== 'Internet Movie Database') {
          mensagem += `  • ${rating.Source}: ${rating.Value}\n`;
        }
      });
    }
    
    // Adiciona sinopse
    if (data.Plot && data.Plot !== "N/A") {
      // Limita tamanho da sinopse
      let sinopse = data.Plot.length > 300 ? 
        data.Plot.substring(0, 297) + '...' : 
        data.Plot;
      
      sinopse = (await translateText(sinopse, "pt")) || sinopse;
      mensagem += `\n📝 *Sinopse:* ${sinopse}\n`;
    }
    
    // Adiciona link e ID do IMDB
    mensagem += `\n🔗 *IMDB:* https://www.imdb.com/title/${data.imdbID}/`;
    
    // Tenta obter a imagem do poster
    if (data.Poster && data.Poster !== 'N/A') {
      try {
        // Baixa a imagem do poster
        const imageResponse = await axios.get(data.Poster, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data, 'binary');
        const base64Image = imageBuffer.toString('base64');
        
        // Determina o tipo de imagem (geralmente jpg, mas pode ser png)
        const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
        
        // Cria a mídia para o poster
        const media = new MessageMedia(contentType, base64Image, `${data.imdbID}.jpg`);
        
        // Retorna a mensagem com o poster
        return new ReturnMessage({
          chatId: chatId,
          content: media,
          options: {
            caption: mensagem,
            quotedMessageId: message.origin.id._serialized
          }
        });
      } catch (imageError) {
        logger.error('Erro ao baixar poster:', imageError);
        // Se falhar ao baixar a imagem, envia apenas o texto
        return new ReturnMessage({
          chatId: chatId,
          content: mensagem,
          options: {
            quotedMessageId: message.origin.id._serialized
          }
        });
      }
    } else {
      // Se não tiver poster, envia apenas o texto
      return new ReturnMessage({
        chatId: chatId,
        content: mensagem,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
  } catch (error) {
    logger.error('Erro ao buscar IMDB:', error);
    
    const chatId = message.group || message.author;
    let errorMessage = 'Erro ao buscar informações do IMDB. Por favor, tente novamente.';
    
    if (error.response) {
      // Erros relacionados à API
      const status = error.response.status;
      
      if (status === 401) {
        errorMessage = 'Chave de API do OMDB inválida. Verifique a configuração.';
      } else if (status === 404) {
        errorMessage = 'Filme ou série não encontrado.';
      } else if (status === 429) {
        errorMessage = 'Limite de requisições excedido. Tente novamente mais tarde.';
      }
    }
    
    return new ReturnMessage({
      chatId: chatId,
      content: `❌ ${errorMessage}`
    });
  }
}

// Definição de comandos usando a classe Command
const commands = [
  new Command({
    name: 'imdb',
    description: 'Busca informações sobre filmes ou séries no IMDB',
    category: "cultura",
    reactions: {
      before: "⏳",
      after: "🎬"
    },
    method: buscarImdb
  })
];

module.exports = { commands };