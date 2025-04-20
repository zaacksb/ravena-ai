const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');
const Logger = require('../utils/Logger');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

const logger = new Logger('wikipedia-commands');

//logger.info('Módulo WikipediaCommands carregado');

// URL base da API da Wikipedia
const WIKI_API_URL = 'https://pt.wikipedia.org/api/rest_v1/page/summary/';
const WIKI_SEARCH_API = 'https://pt.wikipedia.org/w/api.php';

/**
 * Busca informações na Wikipedia
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function buscarWikipedia(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    const returnMessages = [];
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça um termo para buscar na Wikipedia. Exemplo: !wiki Brasil'
      });
    }
    
    // Obtém o termo de busca
    const termo = args.join(' ');
    
    // Envia mensagem de processamento
    returnMessages.push(
      new ReturnMessage({
        chatId: chatId,
        content: `🔍 Buscando informações sobre "${termo}" na Wikipedia...`
      })
    );
    
    // Primeira etapa: realizar uma busca para encontrar o artigo mais relevante
    const searchResponse = await axios.get(WIKI_SEARCH_API, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: termo,
        format: 'json',
        utf8: 1,
        srlimit: 1
      }
    });
    
    // Verifica se encontrou resultados
    if (!searchResponse.data.query || !searchResponse.data.query.search || searchResponse.data.query.search.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Não foi possível encontrar informações sobre "${termo}" na Wikipedia.`
      });
    }
    
    // Obtém o título do artigo mais relevante
    const pageTitle = searchResponse.data.query.search[0].title;
    
    // Segunda etapa: buscar o sumário do artigo
    try {
      const summaryResponse = await axios.get(encodeURI(`${WIKI_API_URL}${pageTitle}`));
      const data = summaryResponse.data;
      
      // Verifica se encontrou informações
      if (!data || !data.title) {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Erro ao buscar informações detalhadas sobre "${termo}".`
        });
      }
      
      // Prepara a mensagem
      let mensagem = `📚 *${data.title}*\n\n`;
      
      // Adiciona descrição (se disponível)
      if (data.description) {
        mensagem += `*${data.description}*\n\n`;
      }
      
      // Adiciona resumo
      if (data.extract) {
        // Limita tamanho do resumo
        const resumo = data.extract.length > 1000 ? 
          data.extract.substring(0, 997) + '...' : 
          data.extract;
        
        mensagem += resumo;
      }
      
      // Adiciona aviso sobre informações adicionais
      mensagem += `\n\n🔗 *Leia mais:* ${data.content_urls?.desktop?.page || data.content_urls?.mobile?.page || `https://pt.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`}`;
      
      // Se tiver imagem, baixa e envia com a mensagem
      if (data.thumbnail && data.thumbnail.source) {
        try {
          // Busca a imagem em melhor resolução
          let imageUrl = data.thumbnail.source;
          
          // Se disponível, usa a imagem original em vez da miniatura
          if (data.originalimage && data.originalimage.source) {
            imageUrl = data.originalimage.source;
          }
          
          // Baixa a imagem
          const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          const imageBuffer = Buffer.from(imageResponse.data, 'binary');
          const base64Image = imageBuffer.toString('base64');
          
          // Determina o tipo de mídia (jpg, png, etc)
          const mimeType = imageResponse.headers['content-type'] || 'image/jpeg';
          
          // Cria mídia para envio
          const media = new MessageMedia(mimeType, base64Image, `wiki_${pageTitle.replace(/\s+/g, '_')}.jpg`);
          
          // Retorna a mensagem com mídia
          return new ReturnMessage({
            chatId: chatId,
            content: media,
            options: {
              caption: mensagem
            }
          });
        } catch (imageError) {
          logger.error('Erro ao baixar imagem da Wikipedia:', imageError);
          // Se falhar ao baixar a imagem, envia apenas o texto
          return new ReturnMessage({
            chatId: chatId,
            content: mensagem
          });
        }
      } else {
        // Se não tiver imagem, envia apenas o texto
        return new ReturnMessage({
          chatId: chatId,
          content: mensagem
        });
      }
    } catch (summaryError) {
      logger.error('Erro ao buscar sumário da Wikipedia:', summaryError);
      
      // Trata erro de não encontrado especificamente
      if (summaryError.response && summaryError.response.status === 404) {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Não foi possível encontrar uma página completa sobre "${termo}" na Wikipedia.`
        });
      } else {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Erro ao buscar informações detalhadas sobre "${termo}". Tente novamente mais tarde.`
        });
      }
    }
  } catch (error) {
    logger.error('Erro geral ao buscar Wikipedia:', error);
    
    const chatId = message.group || message.author;
    let errorMessage = 'Erro ao buscar informações da Wikipedia. Por favor, tente novamente.';
    
    if (error.response) {
      // Trata códigos de erro específicos
      const status = error.response.status;
      
      if (status === 404) {
        errorMessage = `Não foi possível encontrar informações sobre "${args.join(' ')}" na Wikipedia.`;
      } else if (status === 429) {
        errorMessage = 'Muitas solicitações à Wikipedia. Por favor, tente novamente mais tarde.';
      }
    }
    
    return new ReturnMessage({
      chatId: chatId,
      content: `❌ ${errorMessage}`
    });
  }
}

// Comandos usando a classe Command
const commands = [
  new Command({
    name: 'wiki',
    description: 'Busca informações na Wikipedia',
    category: "busca",
    reactions: {
      before: "⏳",
      after: "📚"
    },
    method: buscarWikipedia
  })
];

module.exports = { commands };