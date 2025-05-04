const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');
const Logger = require('../utils/Logger');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');
require('dotenv').config();

const logger = new Logger('placas-commands');

/**
 * Valida e normaliza uma placa de carro brasileira
 * @param {string} placa - A placa a ser validada/normalizada
 * @returns {Object} - Objeto com a placa normalizada e status de validação
 */
function validarPlaca(placa) {
  if (!placa) {
    return { valid: false, placa: null };
  }

  // Normaliza a placa: remove espaços, traços e converte para minúsculo
  let placaNormalizada = placa.replace(/[^a-zA-Z0-9]/g, '');
  
  // Substituir 'o' ou 'O' por '0'
  const primeiros3 = placaNormalizada.substring(0, 3);
  const resto = placaNormalizada.substring(3);
  const restoCorrigido = resto.replace(/o/gi, '0');

  placaNormalizada = primeiros3 + restoCorrigido;
  placaNormalizada = placaNormalizada.toLowerCase().trim();
  
  // Verificar o formato da placa
  const formatoAntigo = /^[a-z]{3}[0-9]{4}$/;
  const formatoNovo = /^[a-z]{3}[0-9][a-j][0-9]{2}$/;
  
  if (!formatoAntigo.test(placaNormalizada) && !formatoNovo.test(placaNormalizada)) {
    return { valid: false, placa: placaNormalizada };
  }
  
  return { valid: true, placa: placaNormalizada };
}

/**
 * Busca informações sobre uma placa de carro usando a API de placas
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function buscarPlaca(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça uma placa para consultar. Exemplo: !placa ABC1234'
      });
    }
    
    // Obtém a placa do primeiro argumento
    const placaInput = args.join("");
    
    // Valida e normaliza a placa
    const { valid, placa } = validarPlaca(placaInput);
    
    if (!valid) {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Placa inválida: "${placaInput}". Formato correto: ABC1234 ou ABC1D23`
      });
    }
    
    logger.info(`Consultando placa: ${placa}`);
    
    // Verifica se a API está configurada
    if (!process.env.API_PLACAS_COMUM || !process.env.API_PLACAS_PREMIUM) {
      return new ReturnMessage({
        chatId: chatId,
        content: '⚠️ API de consulta de placas não configurada. Defina API_PLACAS_COMUM e/ou API_PLACAS_PREMIUM no arquivo .env'
      });
    }
    
    // Configura parâmetros para a apiPlacas
    const isPremium = process.env.API_PLACAS_USAR_PREMIUM ? true : false;
    
    // Define uma Promise para capturar o resultado da função apiPlacas
    const placaPromise = new Promise((resolve) => {
      // Função de callback para receber o resultado
      const callback = (resultados) => {
        resolve(resultados);
      };
      
      // Chama a função apiPlacas com callback
      apiPlacas(message, message.author, placa, isPremium, callback);
    });
    
    // Espera o resultado da consulta
    const resultado = await placaPromise;
    
    // Verifica se houve resposta
    if (!resultado || !resultado.msg) {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Não foi possível consultar a placa "${placa}". Tente novamente mais tarde.`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    // Retorna o resultado da consulta
    return new ReturnMessage({
      chatId: chatId,
      content: resultado.msg,
      options: {
        quotedMessageId: message.origin.id._serialized
      },
      reactions: {
        after: resultado.react || "🚘"
      }
    });
    
  } catch (error) {
    logger.error('Erro ao consultar placa:', error);
    
    const chatId = message.group || message.author;
    return new ReturnMessage({
      chatId: chatId,
      content: '❌ Erro ao consultar placa. Tente novamente mais tarde.',
      options: {
        quotedMessageId: message.origin.id._serialized
      }
    });
  }
}

/**
 * Implementação da função apiPlacas
 * @param {Object} msg - Mensagem original
 * @param {string} numeroAutor - Número do autor
 * @param {string} placa - Placa a ser consultada
 * @param {boolean} premium - Se deve usar API premium
 * @param {Function} callback - Callback para retornar resultado
 */
function apiPlacas(msg, numeroAutor, placa, premium, callback) {
  // Configura a URL da API baseada no tipo de acesso
  const apiUrl = `https://wdapi2.com.br/consulta/${placa}/${premium ? process.env.API_PLACAS_PREMIUM : process.env.API_PLACAS_COMUM}`;
  
  // Faz a requisição à API
  axios.get(apiUrl)
    .then(res => res.data)
    .then(async dados => {
      logger.info(`[apiPlacas_${premium ? 'premium' : 'comum'}] ${placa} => ${JSON.stringify(dados, null, "\t")}`);
      
      let retorno = { msg: '', react: '🚘' };

      if (dados.message || dados.erro) {
        const mensagem = dados.message ?? dados.erro;
        retorno.msg = `🔎 Resultado para *${placa}*\n\n_${mensagem.trim()}_`;
      } else {
        let fipe = { texto_valor: "R$ ??,??", codigo_fipe: "?", mes_referencia: "?", texto_modelo: "?" };
        if (dados.fipe?.dados) {
          if (Array.isArray(dados.fipe?.dados)) {
            if (dados.fipe?.dados.length > 0) {
              dados.fipe.dados.sort((a, b) => b.score - a.score);
              fipe = dados.fipe?.dados[0];
            }
          }
        }

        const nomeCarro = `${dados.MARCA} ${dados.MODELO}`;
        const restricoes = [
          dados.extra?.restricao_1 ?? "-",
          dados.extra?.restricao_2 ?? "-",
          dados.extra?.restricao_3 ?? "-",
          dados.extra?.restricao_4 ?? "-"
        ].filter(onlyUnique).join(", ");
        
        const renavam = dados.extra?.renavam ? `\n   🪪 *Renavam:* ${dados.extra.renavam}` : "";
        const ano = parseInt(dados.ano ?? "1970");
        const municipio = dados.extra?.municipio ?? dados.municipio ?? "-";
        const estado = dados.extra?.uf ?? dados.uf ?? "-";

        retorno.msg = `🔎 Resultado para *${dados.placa}/${dados.placa_alternativa}* _(${dados.extra?.tipo_veiculo ?? "?"})_:

   🚘 *Modelo:* ${nomeCarro} (${dados.cor})
   📅 *Ano:* ${dados.ano} / ${dados.anoModelo} (${dados.origem})
   📍 *Localidade:* ${municipio} - ${estado}
   🔢 *Chassi/Motor:* ${dados.extra?.chassi ?? "-"} / ${dados.extra?.motor ?? "-"}
   🧍 *Passageiros:* ${dados.extra?.quantidade_passageiro ?? "-"}
   ⚡️ *Performance:* (${dados.extra?.cilindradas ?? "-"} cc) | ${dados.extra?.combustivel ?? "-"}

   🪙 *FIPE:* ${fipe.texto_valor} (${fipe.texto_modelo} (${fipe.codigo_fipe}), ${fipe.mes_referencia})${renavam}
   ⚠️ *Obs:* ${dados.extra?.tipo_doc_prop ?? "-"}, ${restricoes}`;

        // Verifica se é um Honda Civic Si entre 2006 e 2011
        if (nomeCarro.toLowerCase().includes("honda civic si") && (2006 <= ano && ano <= 2011)) {
          logger.info(`[apiPlacas_${premium ? 'premium' : 'comum'}] Carro buscado é um Civic Si, buscando também no SiPt...`);
          
          try {
            // Busca também no SiPt
            const resSiPt = await getSiPtPlaca(dados.placa, `${numeroAutor}`);
            
            if (resSiPt && resSiPt.length > 0) {
              const respostaSiPt = resSiPt[0].msg.replace("Resultado", "SiPT Resultado");
              logger.info(`[apiPlacas_${premium ? 'premium' : 'comum'}] Resposta Sipt: ${respostaSiPt}`);
              
              if (respostaSiPt.includes(" / ")) { // retorno válido
                logger.info(`[apiPlacas_${premium ? 'premium' : 'comum'}] Resposta válida, incluindo!`);
                retorno.msg += `\n\n${respostaSiPt}`;
              }
            }
          } catch (siPtError) {
            logger.error(`[apiPlacas_${premium ? 'premium' : 'comum'}] Erro ao buscar no SiPt:`, siPtError);
          }
        }
      }
      
      // Retorna resultado via callback
      callback(retorno);
    })
    .catch(error => {
      logger.error(`[apiPlacas_${premium ? 'premium' : 'comum'}] Erro:`, error);
      callback({ 
        msg: `❌ Erro ao consultar a placa ${placa}. Tente novamente mais tarde.`, 
        react: "⚠️" 
      });
    });
}

/**
 * Função auxiliar para filtrar valores únicos em um array
 */
function onlyUnique(value, index, array) {
  return array.indexOf(value) === index;
}

/**
 * Converte HTML para formatação de WhatsApp
 * @param {string} html - String HTML para converter
 * @returns {string} - Texto formatado para WhatsApp
 */
function convertToWhatsAppMarkup(html) {
  if (!html) return '';

  // Convert <br> tags to line breaks
  let result = html.replace(/<br\s*\/?>/gi, '\n');

  // Convert <b> and <strong> tags to asterisks
  result = result.replace(/<(b|strong)>(.*?)<\/\1>/gi, '*$2*');

  // Convert <i> and <em> tags to underscores
  result = result.replace(/<(i|em)>(.*?)<\/\1>/gi, '_$2_');

  // Convert <u> tags to tilde (~)
  result = result.replace(/<u>(.*?)<\/u>/gi, '~$1~');

  // Convert <a> tags to plain text links
  result = result.replace(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1[^>]*>(.*?)<\/a>/gi, '$3 ($2)');

  // Remove all other HTML tags
  result = result.replace(/<\/?[^>]+(>|$)/g, '');

  return result;
}

/**
 * Consulta uma placa no serviço SiPt
 * @param {string} placa - Placa para consulta
 * @param {string} usuario - ID do usuário que solicitou
 * @returns {Promise<Array>} - Array com objetos de resultado
 */
async function getSiPtPlaca(placa, usuario) {
  const retorno = {
    msg: `⚠️ Ocorreu um erro buscando esta placa.`, 
    reply: true, 
    react: "🚘"
  };
  
  // Limita o tamanho da placa
  placa = placa.substring(0, 10);

  // Create JSON payload
  const payload = JSON.stringify({ 
    placa: placa.toLowerCase(), 
    usuario: usuario 
  });

  // Set request options
  const url = process.env.SIPT_URL || 'http://192.168.3.200:1936/getInfoPlaca';
  const headers = {
    'Content-Type': 'application/json',
    'x-sipt-token': process.env.SIPT_TOKEN, 
  };

  try {
    // Send HTTP request with axios
    const response = await axios.post(url, payload, {
      headers,
      timeout: 5000
    });

    const responseData = response.data;
    logger.info(`[siPtPlaca] Resultado busca placa: ${JSON.stringify(responseData)}`);

    if (responseData.status === 1) {
      retorno.msg = convertToWhatsAppMarkup(responseData.resultado);
    }
  } catch (error) {
    logger.warn(`[siPtPlaca] Erro buscando placa: ${error}`);
  }

  return [retorno];
}

/**
 * Consulta uma placa no serviço SiPt
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function consultarSiPt(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça uma placa para consultar. Exemplo: !sipt ABC1234'
      });
    }
    
    // Obtém a placa do primeiro argumento
    const placaInput = args[0];
    
    // Valida e normaliza a placa
    const { valid, placa } = validarPlaca(placaInput);
    
    if (!valid) {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Placa inválida: "${placaInput}". Formato correto: ABC1234 ou ABC1D23`
      });
    }
    
    logger.info(`Consultando placa no SiPt: ${placa}`);
    
    // Busca no SiPt usando função nativa
    const resultados = await getSiPtPlaca(placa, message.author);
    
    if (!resultados || resultados.length === 0 || !resultados[0].msg) {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Não foi possível consultar a placa "${placa}" no SiPt. Tente novamente mais tarde.`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    // Retorna o resultado da consulta
    return new ReturnMessage({
      chatId: chatId,
      content: resultados[0].msg,
      options: {
        quotedMessageId: resultados[0].reply ? message.origin.id._serialized : undefined
      },
      reactions: {
        after: resultados[0].react || "🚘"
      }
    });
    
  } catch (error) {
    logger.error('Erro ao consultar placa no SiPt:', error);
    
    const chatId = message.group || message.author;
    return new ReturnMessage({
      chatId: chatId,
      content: '❌ Erro ao consultar placa no SiPt. Tente novamente mais tarde.',
      options: {
        quotedMessageId: message.origin.id._serialized
      }
    });
  }
}

// Criar array de comandos usando a classe Command
const commands = [
  new Command({
    name: 'placa',
    hidden: true,
    description: 'Consulta informações sobre uma placa de veículo',
    category: "busca",
    usage: "!placa ABC1234",
    reactions: {
      before: "⏳",
      after: "🚘"
    },
    method: buscarPlaca,
    exclusive: process.env.GRUPOS_PLACA_PREMIUM ? process.env.GRUPOS_PLACA_PREMIUM.split(",") : []
  }),
  new Command({
    name: 'sipt',
    description: 'Consulta informações sobre uma placa no InstaSiPt',
    category: "busca",
    usage: "!sipt ABC1234",
    aliases: ['instasipt'],
    reactions: {
      before: "⏳",
      after: "🚘"
    },
    method: consultarSiPt
  })
];

module.exports = { commands };