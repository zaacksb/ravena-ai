const axios = require("axios");
const cheerio = require("cheerio");
const Logger = require("../utils/Logger");
const Command = require("../models/Command");
const ReturnMessage = require("../models/ReturnMessage");

// Cria novo logger
const logger = new Logger('myinstants-audio');

/**
 * Busca áudios no myinstants.com
 * @param {string} pesquisa
 * @returns {Promise<Array<{title: string, mp3: string}>>}
 */
async function buscarAudios(pesquisa) {
  const query = encodeURIComponent(pesquisa);
  const base = "https://www.myinstants.com";
  const url = `${base}/search/?name=${query}`;

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const botoes = $(".instant");

    const resultados = [];

    botoes.each((i, el) => {
      const a = $(el).find('a.instant-link').first();
      const title = a.text().trim();
      const onclick = $(el).find('button').attr('onclick');
      const match = onclick && onclick.match(/play\('([^']+)'/);
      const mp3 = match ? new URL(match[1], base).href : null;

      if (mp3 && title) {
        resultados.push({ title, mp3 });
      }
    });

    return resultados;
  } catch (err) {
    logger.error("Erro ao buscar áudios:", err);
    return [];
  }
}

/**
 * Comando para buscar e enviar áudio do myinstants.com
 * @param {WhatsAppBot} bot
 * @param {Object} message
 * @param {Array} args
 * @param {Object} group
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>}
 */
async function audioCommand(bot, message, args, group) {
  const chatId = message.group || message.author;

  try {
    if (!args.length) {
      return new ReturnMessage({
        chatId,
        content: "Digite o nome do áudio para buscar.",
        options: {
          quotedMessageId: message.origin?.id?._serialized
        }
      });
    }

    const termo = args.slice(0, -1).join(" ").trim();
    const ultimoArg = args[args.length - 1];
    const index = parseInt(ultimoArg);
    const numeroInformado = !isNaN(index);

    const query = numeroInformado ? termo : args.join(" ").trim();
    const resultados = await buscarAudios(query);

    if (!resultados.length) {
      return new ReturnMessage({
        chatId,
        content: `Nenhum áudio encontrado para "${query}".`,
        options: {
          quotedMessageId: message.origin?.id?._serialized
        }
      });
    }

    if (!numeroInformado) {
      const preview = resultados.map((r, i) => `${i + 1}. ${r.title}`).join("\n");
      return new ReturnMessage({
        chatId,
        content: `Resultados para "${query}":\n${preview}\n\nUse: !audio-buscar ${query} número_do_áudio para enviar o áudio desejado.\n\nExemplo: !audio-buscar ${query} 1`,
        options: {
          quotedMessageId: message.origin?.id?._serialized
        }
      });
    }

    const indexValido = index - 1;
    const resultado = resultados[indexValido];

    if (!resultado) {
      return new ReturnMessage({
        chatId,
        content: `Número inválido. Encontre um número entre 1 e ${resultados.length}.`,
        options: {
          quotedMessageId: message.origin?.id?._serialized
        }
      });
    }

    const audio = await bot.createMediaFromURL(resultado.mp3);

    logger.info(`Enviando áudio: ${resultado.title}`);

    return new ReturnMessage({
      chatId,
      content: `▶️ ${resultado.title}`,
      media: audio,
      reactions: {
        after: "🔊"
      },
      options: {
        quotedMessageId: message.origin?.id?._serialized
      }
    });
  } catch (error) {
    logger.error('Erro ao executar comando audio:', error);
    return new ReturnMessage({
      chatId,
      content: '❌ Ocorreu um erro ao buscar o áudio. Por favor, tente novamente mais tarde.',
      reactions: {
        after: "❌"
      }
    });
  }
}

// Criação dos comandos
const commands = [
  new Command({
    name: 'audio-buscar',
    description: 'Busca e envia um áudio do site myinstants.com',
    usage: '/audio [nome_do_áudio] [número_opcional]',
    category: "utilidades",
    reactions: {
      before: "⏳",
      after: "🔊",
      error: "❌"
    },
    method: audioCommand
  })
];

// Exporta o módulo
module.exports = {
  commands,
  buscarAudios
};
