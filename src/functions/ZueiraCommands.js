const path = require('path');
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const Database = require('../utils/Database');
const CustomVariableProcessor = require('../utils/CustomVariableProcessor');

const logger = new Logger('general-commands');

const database = Database.getInstance();
const variableProcessor = new CustomVariableProcessor();


async function violencia(bot, message, args, group) {
  const chatId = message.group || message.author;

  const customVariables = await database.getCustomVariables();
  const frases = customVariables.violencia;
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

async function morreu(bot, message, args, group) {
  const chatId = message.group || message.author;

  const customVariables = await database.getCustomVariables();
  const frases = customVariables.morreu;
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


async function boleto(bot, message, args, group) {
  const chatId = message.group || message.author;

  const options = {};
  const fraseFinal = await variableProcessor.process("*{mention}* foi escolhido pra pagar esse boleto para *{nomeAutor}* 😏😏\n___\n```B O Q U E T E```\n█║▌│║▌║▌│█│▌║│█│\n¹²³ ³² ²³¹ ¹ ¹²³² ³²¹ ³²³ ¹²³", {message, group, options, bot});
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

async function cartao(bot, message, args, group) {
  const chatId = message.group || message.author;

  const options = {};
  const fraseFinal = await variableProcessor.process("💳 {nomeAutor} *clonou* o cartão de {mention}! 😏🥷 \n\n🔢 *Número:* {rndDadoRange-1000-9999}-{rndDadoRange-1000-9999}-{rndDadoRange-1000-9999}-{rndDadoRange-1000-9999}\n🔐 *Código de Segurança:* {rndDadoRange-100-999}\n📅 *Validade*: {rndDadoRange-1-12}/{rndDadoRange-23-50}\n📍 *CEP*: {rndDadoRange-10000-99999}-{rndDadoRange-100-999}\n💸 *Limite*: R${rndDadoRange-100-9999},{rndDadoRange-10-99}", {message, group, options, bot});
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
    method: violencia
  }),
  new Command({
    name: 'violência',
    hidden: 'true',
    reactions: {
      after: "💢"
    },
    method: violencia
  }),

  new Command({
    name: 'morreu',
    description: 'de gue?',
    category: "zoeira",
    reactions: {
      after: "⚰️"
    },
    method: morreu
  }),

  new Command({
    name: 'boleto',
    description: 'Escolhe alguém pra pagar',
    category: "zoeira",
    reactions: {
      after: "🔳"
    },
    method: boleto
  }),

  new Command({
    name: 'clonarcartao',
    description: 'Pra pagar o agiota',
    category: "zoeira",
    reactions: {
      after: "💳"
    },
    method: cartao
  }),

  new Command({
    name: 'presente',
    description: 'Os melhores da internet',
    category: "zoeira",
    reactions: {
      after: "🎁"
    },
    method: presente
  })
];



module.exports = { commands  };
