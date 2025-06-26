const Logger = require("../utils/Logger");
const Command = require("../models/Command");
const ReturnMessage = require("../models/ReturnMessage");
const Database = require("../utils/Database");
const CustomVariableProcessor = require("../utils/CustomVariableProcessor");

// Cria novo logger
const logger = new Logger("cantada");

const database = Database.getInstance();
const variableProcessor = new CustomVariableProcessor();

/**
 * Retorna uma cantada aleatória para uma pessoa aleatória
 * @param {WhatsAppBot} bot
 * @param {Object} message
 * @param {Array} args
 * @param {Object} group
 * @returns {Promise<ReturnMessage>}
 */
async function cantadaCommand(bot, message, args, group) {
  const chatId = message.group || message.author;

  try {
    const customVariables = await database.getCustomVariables();
    const frases = customVariables["cantadas-ruins"];

    if (!frases || frases.length === 0) {
      logger.warn("Nenhuma frase encontrada em 'cantadas-ruins'");
      return new ReturnMessage({
        chatId,
        content: "❌ Nenhuma cantada disponível no momento.",
        options: {
          quotedMessageId: message.origin?.id?._serialized,
          evoReply: message.origin
        }
      });
    }

    const fraseIndex = Math.floor(Math.random() * frases.length);
    const options = {};
    
    // Processar a frase completa com as variáveis
    const fraseFinal = await variableProcessor.process(
      `💕 *{nomeAutor}* chegou em *{mention}* com: \n${frases[fraseIndex]}`,
      { message, group, options, bot }
    );

    return new ReturnMessage({
      chatId,
      content: fraseFinal,
      options: {
        quotedMessageId: message.origin?.id?._serialized,
        evoReply: message.origin,
        ...options
      }
    });

  } catch (err) {
    logger.error("Erro ao gerar cantada:", err);
    return new ReturnMessage({
      chatId,
      content: "❌ Algo deu errado ao tentar a cantada. Tente novamente mais tarde.",
      options: {
        quotedMessageId: message.origin?.id?._serialized,
        evoReply: message.origin
      }
    });
  }
}

// Comandos registrados
const commands = [
  new Command({
    name: 'cantada',
    description: 'Faz uma cantada para alguém do grupo',
    category: "zoeira",
    reactions: {
      after: "💕"
    },
    method: cantadaCommand
  })
];

// Exporta os comandos
module.exports = {
  commands
};
