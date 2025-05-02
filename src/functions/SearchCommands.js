const axios = require('axios');
const cheerio = require('cheerio');
const { MessageMedia } = require('whatsapp-web.js');
const Logger = require('../utils/Logger');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

const logger = new Logger('search-commands');

// Decodificador simples de entidades HTML
function decodeHtmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

//logger.info('Módulo SearchCommands carregado');

/**
 * Consulta informações de aeronaves no Registro Aeronáutico Brasileiro (RAB)
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com os resultados da consulta
 */
async function searchAircraftRAB(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça a matrícula da aeronave. Exemplo: !rab PT-XYZ',
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    const marca = args[0].toUpperCase();
    logger.info(`Consultando aeronave com matrícula: ${marca}`);
    
    // URL da consulta RAB
    const url = `https://sistemas.anac.gov.br/aeronaves/cons_rab_resposta.asp?textMarca=${marca}`;
    
    // Realiza a requisição com timeout de 10 segundos
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    // Decodifica a resposta usando ISO-8859-1 (padrão para sites brasileiros antigos)
    const decoder = new TextDecoder('iso-8859-1');
    const html = decoder.decode(response.data);
    
    // Carrega o HTML para parsing
    const $ = cheerio.load(html);
    
    // Verifica se a aeronave foi encontrada
    if (html.includes('encontrado')) { // alert("Registro não encontrado!");
      logger.info(`Matrícula ${marca} não encontrada.`);
      return new ReturnMessage({
        chatId: chatId,
        content: `✈️ Consulta RAB - Matrícula '${marca}' não encontrada!`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    } 
    
    // Encontra a tabela com os dados da aeronave
    const table = $('.table.table-hover');
    
    // Inicializa a mensagem de retorno
    let retorno = `✈️ *Consulta RAB - Matrícula ${marca}*\n\n`;
    
    // Itera sobre cada linha da tabela
    table.find('tr').each((index, element) => {
      // Extrai a propriedade e o valor de cada linha
      const property = $(element).find('th:nth-child(1)').text().trim();
      const value = $(element).find('td:nth-child(2)').text().trim();
      
      // Adiciona à mensagem de retorno se houver conteúdo
      if (property && value) {
        retorno += `*${property}*: ${value}\n`;
      }
    });
    
    logger.info(`Dados da aeronave ${marca} encontrados e processados.`);
    
    // Retorna a mensagem com os dados da aeronave
    return new ReturnMessage({
      chatId: chatId,
      content: retorno,
      options: {
        quotedMessageId: message.origin.id._serialized
      }
    });
    
  } catch (error) {
    logger.error('Erro na consulta RAB:', error);
    const chatId = message.group || message.author;
    
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao consultar o Registro Aeronáutico Brasileiro. Por favor, tente novamente mais tarde.',
      options: {
        quotedMessageId: message.origin.id._serialized
      }
    });
  }
}


/**
 * Busca na web usando DuckDuckGo
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com os resultados da busca
 */
async function searchWeb(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça uma consulta de busca. Exemplo: !buscar tutorial javascript',
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    const query = args.join(' ');
    logger.info(`Buscando na web por: ${query}`);
        
    // Usa API DuckDuckGo
    const response = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: query,
        format: 'json',
        skip_disambig: 1,
        no_html: 1,
        no_redirect: 1
      },
      timeout: 10000
    });
    
    const data = response.data;
    
    // Constrói mensagem de resultados da busca
    let resultsMessage = `🔍 *Resultados para "${query}":*\n\n`;
    
    // Adiciona resumo se disponível
    if (data.AbstractText) {
      resultsMessage += `*${data.AbstractSource}:*\n${decodeHtmlEntities(data.AbstractText)}\n\n`;
    }
    
    // Adiciona tópicos relacionados
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const topResults = data.RelatedTopics.slice(0, 5);
      topResults.forEach((result, index) => {
        if (result.Text) {
          resultsMessage += `${index + 1}. ${decodeHtmlEntities(result.Text)}\n`;
          if (result.FirstURL) {
            resultsMessage += `   🔗 ${result.FirstURL}\n\n`;
          }
        }
      });
    } else if (data.Results && data.Results.length > 0) {
      // Alternativa: usa Results se disponível
      const topResults = data.Results.slice(0, 5);
      topResults.forEach((result, index) => {
        if (result.Text) {
          resultsMessage += `${index + 1}. ${decodeHtmlEntities(result.Text)}\n`;
          if (result.FirstURL) {
            resultsMessage += `   🔗 ${result.FirstURL}\n\n`;
          }
        }
      });
    } else {
      // Se não houver resultados claros, tenta usar as informações que temos
      if (data.Infobox && data.Infobox.content) {
        const infoItems = data.Infobox.content.slice(0, 5);
        infoItems.forEach((item, index) => {
          if (item.label && item.value) {
            resultsMessage += `${item.label}: ${item.value}\n`;
          }
        });
        resultsMessage += '\n';
      }
      
      // Se ainda não houver resultados, fornece uma mensagem alternativa
      if (resultsMessage === `🔍 *Resultados para "${query}":*\n\n`) {
        resultsMessage += "Não foram encontrados resultados específicos para esta busca.\n\n";
        resultsMessage += `Tente buscar diretamente: https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
      }
    }
    
    // Retorna os resultados
    return new ReturnMessage({
      chatId: chatId,
      content: resultsMessage,
      options: {
        quotedMessageId: message.origin.id._serialized
      }
    });
    
    logger.info(`Resultados de busca enviados com sucesso para "${query}"`);
  } catch (error) {
    logger.error('Erro na busca web:', error);
    const chatId = message.group || message.author;
    
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao realizar busca na web. Por favor, tente novamente.',
      options: {
        quotedMessageId: message.origin.id._serialized
      }
    });
  }
}

/**
 * Busca por imagens
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function searchImages(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    const returnMessages = [];
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça uma consulta de busca. Exemplo: !buscar-img gatos fofos',
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    const query = args.join(' ');
    logger.info(`Buscando imagens para: ${query}`);
    
    // Envia indicador de digitação
    try {
      await bot.client.sendPresenceUpdate('composing', chatId);
    } catch (error) {
      logger.error('Erro ao enviar indicador de digitação:', error);
    }
    
    // Informa o usuário
    returnMessages.push(
      new ReturnMessage({
        chatId: chatId,
        content: `🔍 Buscando imagens para "${query}"...`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      })
    );
    
    try {
      // Obtém a API key do .env
      const unsplashApiKey = process.env.UNSPLASH_API_KEY;
      
      // Adiciona logging para debug
      logger.debug(`Usando API key: ${unsplashApiKey.substring(0, 5)}...`);
      
      // Utiliza Unsplash API para buscar imagens
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
          query: query,
          per_page: 3,
          client_id: unsplashApiKey
        },
        timeout: 10000
      });
      
      const results = response.data.results;
      
      if (!results || results.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: `Não foram encontradas imagens para "${query}". Tente outra consulta.`,
          options: {
            quotedMessageId: message.origin.id._serialized
          }
        });
      }
      
      // Adiciona logging para debug
      logger.debug(`Encontradas ${results.length} imagens para "${query}"`);
      
      // Retorna até 3 imagens
      const imageMessages = [];
      for (let i = 0; i < Math.min(3, results.length); i++) {
        try {
          const imgUrl = results[i].urls.regular;
          logger.debug(`Processando imagem ${i+1}: ${imgUrl}`);
          
          // Obtém dados da imagem
          const imgResponse = await axios.get(imgUrl, {
            responseType: 'arraybuffer',
            timeout: 15000
          });
          
          // Determina o tipo MIME
          const contentType = imgResponse.headers['content-type'] || 'image/jpeg';
          
          // Cria mídia
          const media = new MessageMedia(
            contentType,
            Buffer.from(imgResponse.data).toString('base64'),
            `image-${i + 1}.jpg`
          );
          
          // Adiciona mensagem com a imagem
          imageMessages.push(
            new ReturnMessage({
              chatId: chatId,
              content: media,
              options: {
                caption: `Resultado ${i + 1} para "${query}" | Fonte: Unsplash`,
                quotedMessageId: message.origin.id._serialized
              },
              delay: i * 1500 // Adiciona um pequeno atraso entre imagens
            })
          );
          
          logger.debug(`Imagem ${i+1} processada com sucesso`);
        } catch (imgError) {
          logger.error(`Erro ao processar imagem ${i + 1}:`, imgError);
        }
      }
      
      // Retorna as imagens encontradas
      if (imageMessages.length > 0) {
        logger.info(`Enviando ${imageMessages.length} imagens para "${query}"`);
        return imageMessages;
      } else {
        logger.warn(`Nenhuma imagem processada com sucesso para "${query}"`);
        return new ReturnMessage({
          chatId: chatId,
          content: `Erro ao processar imagens para "${query}". Tente novamente mais tarde.`,
          options: {
            quotedMessageId: message.origin.id._serialized
          }
        });
      }
    } catch (apiError) {
      logger.error('Erro na API de imagens:', apiError);
      logger.debug(`Detalhes do erro: ${JSON.stringify(apiError.response?.data || 'Sem dados')}`);
      
      // Verifica erro específico de limite da API
      const isRateLimitError = apiError.response && 
                              (apiError.response.status === 429 || 
                               apiError.response.data?.errors?.includes('Rate Limit Exceeded'));
      
      if (isRateLimitError) {
        return new ReturnMessage({
          chatId: chatId,
          content: `Limite de requisições de API excedido. Por favor, tente novamente mais tarde ou configure uma chave de API válida no arquivo .env (UNSPLASH_API_KEY=sua_chave_aqui).`,
          options: {
            quotedMessageId: message.origin.id._serialized
          }
        });
      }
      
      // Fallback para imagens de placeholder se a API falhar
      const placeholderMessages = [];
      
      // URLs para imagens de placeholder
      const placeholderUrls = [
        `https://via.placeholder.com/800x600?text=${encodeURIComponent(query + ' 1')}`,
        `https://via.placeholder.com/800x600?text=${encodeURIComponent(query + ' 2')}`,
        `https://via.placeholder.com/800x600?text=${encodeURIComponent(query + ' 3')}`
      ];
      
      logger.info(`Usando imagens de placeholder como fallback para "${query}"`);
      
      // Tenta obter imagens de placeholder
      for (let i = 0; i < 3; i++) {
        try {
          // Obtém dados da imagem
          const response = await axios.get(placeholderUrls[i], {
            responseType: 'arraybuffer',
            timeout: 10000
          });
          
          // Cria mídia
          const media = new MessageMedia(
            'image/jpeg',
            Buffer.from(response.data).toString('base64'),
            `placeholder-${i + 1}.jpg`
          );
          
          // Adiciona mensagem com a imagem
          placeholderMessages.push(
            new ReturnMessage({
              chatId: chatId,
              content: media,
              options: {
                quotedMessageId: message.origin.id._serialized,
                caption: `Resultado ${i + 1} para "${query}"`
              },
              delay: i * 1000 // Adiciona um pequeno atraso entre imagens
            })
          );
        } catch (imgError) {
          logger.error(`Erro ao enviar imagem de placeholder:`, imgError);
        }
      }
      
      // Retorna as imagens de placeholder encontradas
      if (placeholderMessages.length > 0) {
        return placeholderMessages;
      } else {
        return new ReturnMessage({
          chatId: chatId,
          content: `Erro ao buscar imagens para "${query}". Tente novamente mais tarde.`,
          options: {
            quotedMessageId: message.origin.id._serialized
          }
        });
      }
    }
  } catch (error) {
    logger.error('Erro na busca de imagens:', error);
    const chatId = message.group || message.author;
    
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao realizar busca de imagens. Por favor, tente novamente.',
          options: {
            quotedMessageId: message.origin.id._serialized
          }
    });
  }
}

// Comandos usando a classe Command
const commands = [
  new Command({
    name: 'buscar',
    description: 'Busca na web',
    category: "busca",
    aliases: ['google', 'search'],
    reactions: {
      trigger: "🔍",
      before: "⏳",
      after: "🔍"
    },
    method: searchWeb
  }),
  
  new Command({
    name: 'buscar-img',
    description: 'Busca por imagens',
    category: "busca",
    aliases: ['img', 'imagem'],
    reactions: {
      before: "⏳",
      after: "🖼️"
    },
    method: searchImages
  }),

  new Command({
    name: 'rab',
    description: 'Consultas ao Registro Aeronáutico Brasileiro',
    category: "busca",
    reactions: {
      before: "⏳",
      after: "✈️"
    },
    method: searchAircraftRAB
  })
];

// Registra os comandos sendo exportados
//logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };