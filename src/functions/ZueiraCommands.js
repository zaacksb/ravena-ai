const path = require('path');
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const Database = require('../utils/Database');
const CustomVariableProcessor = require('../utils/CustomVariableProcessor');

const logger = new Logger('general-commands');

const database = Database.getInstance();
const variableProcessor = new CustomVariableProcessor();

 
async function handleComandoVariavelSimples(bot, message, args, group, variavel) {
  const chatId = message.group || message.author;

  const customVariables = await database.getCustomVariables();
  const frases = customVariables[variavel];
  const fraseIndex = Math.floor(Math.random() * frases.length);
  
  const options = {};
  const fraseFinal = await variableProcessor.process(frases[fraseIndex], {message, group, options, bot});

  const resposta = new ReturnMessage({
    chatId: chatId,
    content: fraseFinal,
    options: {
      quotedMessageId: message.origin.id._serialized,
      ...options
    }
  });

  return resposta;
}

async function presente(bot, message, args, group) {
  const chatId = message.group || message.author;

  const options = {};
  const fraseFinal = await variableProcessor.process("*{nomeAutor}* deu _{presente}_ para *{mention}*! 🎁", {message, group, options, bot});

  const resposta = new ReturnMessage({
    chatId: chatId,
    content: fraseFinal,
    options: {
      quotedMessageId: message.origin.id._serialized,
      ...options
    }
  });

  return resposta;
}

// Criar array de comandos usando a classe Command
const commands = [
  new Command({
    name: 'violencia',
    description: 'Pratica um ato de violência',
    category: "zoeira",
    reactions: {
      after: "💢"
    },
    method: async (bot, message, args, group) => {
      return await handleComandoVariavelSimples(bot, message, args, group, "violencia");
    }
  }),
  new Command({
    name: 'violência',
    category: "zoeira",
    hidden: 'true',
    reactions: {
      after: "💢"
    },
    method: async (bot, message, args, group) => {
      return await handleComandoVariavelSimples(bot, message, args, group, "violencia");
    }
  }),

  new Command({
    name: 'morreu',
    description: 'de gue?',
    category: "zoeira",
    reactions: {
      after: "⚰️"
    },
    method: async (bot, message, args, group) => {
      return await handleComandoVariavelSimples(bot, message, args, group, "morreu");
    }
  }),

  new Command({
    name: 'boleto',
    description: 'Escolhe alguém pra pagar',
    category: "zoeira",
    reactions: {
      after: "🔳"
    },
    method: async (bot, message, args, group) => {
      return await handleComandoVariavelSimples(bot, message, args, group, "boleto");
    }
  }),

  new Command({
    name: 'clonarcartao',
    description: 'Pra pagar o agiota',
    category: "zoeira",
    reactions: {
      after: "💳"
    },
    method: async (bot, message, args, group) => {
      return await handleComandoVariavelSimples(bot, message, args, group, "cartao");
    }
  }),

  new Command({
    name: 'presente',
    description: 'Os melhores da internet',
    category: "zoeira",
    reactions: {
      after: "🎁"
    },
    method: presente
  }),

  new Command({
    name: 'aniversario',
    description: 'Parabeniza um membro do grupo!',
    category: "zoeira",
    reactions: {
      after: "🎂"
    },
    method: async (bot, message, args, group) => {
      return await handleComandoVariavelSimples(bot, message, args, group, "aniversario");
    }
  }),
  new Command({
    name: 'aniversário',
    category: "zoeira",
    hidden: 'true',
    reactions: {
      after: "🎂"
    },
    method: async (bot, message, args, group) => {
      return await handleComandoVariavelSimples(bot, message, args, group, "aniversario");
    }
  }),
  new Command({
    name: 'pecar',
    category: "zoeira",
    reactions: {
      after: "⛪️"
    },
    method: async (bot, message, args, group) => {
      return await handleComandoVariavelSimples(bot, message, args, group, "pecados");
    }
  }),
  new Command({
    name: 'meus-pecados',
    category: "zoeira",
    hidden: 'true',
    reactions: {
      after: "⛪️"
    },
    method: async (bot, message, args, group) => {
      return await handleComandoVariavelSimples(bot, message, args, group, "pecados");
    }
  }),
  new Command({
    name: 'genshin',
    hidden: 'false',
    category: "zoeira",
    reactions: {
      after: "☄️"
    },
    method: async (bot, message, args, group) => {
      return await handleComandoVariavelSimples(bot, message, args, group, "genshin");
    }
  })
];



module.exports = { commands };
