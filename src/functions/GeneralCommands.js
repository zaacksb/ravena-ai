const path = require('path');
const LLMService = require('../services/LLMService');
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');

const logger = new Logger('general-commands');

// Cria instância do serviço LLM com configuração padrão
const llmService = new LLMService({});


// Define os métodos de comando separadamente
async function pingCommand(bot, message, args, group) {
  const chatId = message.group || message.author;
  logger.debug(`Executando comando ping para ${chatId}`);
  
  return new ReturnMessage({
    chatId: chatId,
    content: 'Pong! 🏓'
  });
}

async function aiCommand(bot, message, args, group) {
  const chatId = message.group || message.author;
  
  let question = args.join(' ');
  const quotedMsg = await message.origin.getQuotedMessage();
  if(quotedMsg){
    // Tem mensagem marcada, junta o conteudo (menos que tenha vindo de reação)
    if(!message.originReaction){
      if(quotedMsg.body.length > 10){
        question += `\n\n${quotedMsg.body}`;
      }
    }
  }

  if (question.length < 5) {
    logger.debug('Comando ai chamado sem pergunta');
    return new ReturnMessage({
      chatId: chatId,
      content: 'Por favor, forneça uma pergunta. Exemplo: !ai Qual é a capital da França?'
    });
  }
  
  logger.debug(`Comando ai com pergunta: ${question}`);
  
  // Primeiro, envia uma mensagem indicando que está processando
  const processingMessage = new ReturnMessage({
    chatId: chatId,
    content: `🔍 Processando: "${question}"...`
  });
  
  // Obtém resposta da IA
  try {
    logger.debug('Tentando obter completação LLM');
    const response = await llmService.getCompletion({
      prompt: question,
      provider: 'openrouter', // Usa LM Studio local por padrão
      temperature: 0.7,
      maxTokens: 500
    });
    
    logger.debug('Resposta LLM obtida', response);
    
    // Retorna a resposta da IA
    return new ReturnMessage({
      chatId: chatId,
      content: response
    });
  } catch (error) {
    logger.error('Erro ao obter completação LLM:', error);
    return new ReturnMessage({
      chatId: chatId,
      content: 'Desculpe, encontrei um erro ao processar sua solicitação.'
    });
  }
}


// Criar array de comandos usando a classe Command
const commands = [
  new Command({
    name: 'ping',
    description: 'Verifica se o bot está online',
    category: "geral",
    hidden: "true",
    reactions: {
      before: "⏳",
      after: "✅"
    },
    method: pingCommand
  }),
  
  new Command({
    name: 'ai',
    description: 'Pergunte algo à IA',
    category: "ia",
    group: "askia",
    reactions: {
      trigger: "🤖",
      before: "⏳",
      after: "🤖"
    },
    method: aiCommand
  }),
  new Command({
    name: 'ia',
    description: 'Alias para AI',
    category: "ia",
    group: "askia",
    reactions: {
      trigger: "🤖",
      before: "⏳",
      after: "🤖"
    },
    method: aiCommand
  })
];

// Registra os comandos sendo exportados
//logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };