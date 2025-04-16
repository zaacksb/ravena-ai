const path = require('path');
const LLMService = require('../services/LLMService');
const Logger = require('../utils/Logger');

const logger = new Logger('placeholder-commands');

// Cria instância do serviço LLM com configuração padrão
const llmService = new LLMService({});

logger.info('Módulo PlaceholderCommands carregado');

const commands = [
  {
    name: 'ping',
    description: 'Verifica se o bot está online',
    reactions: {
      before: "⏳",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      const chatId = message.group || message.author;
      logger.debug(`Executando comando ping para ${chatId}`);
      await bot.sendMessage(chatId, 'Pong! 🏓');
    }
  },
  {
    name: 'ai',
    description: 'Pergunte algo à IA',
    reactions: {
      before: "🧠",
      after: "✨"
    },
    method: async (bot, message, args, group) => {
      const chatId = message.group || message.author;
      
      if (args.length === 0) {
        logger.debug('Comando ai chamado sem pergunta');
        await bot.sendMessage(chatId, 'Por favor, forneça uma pergunta. Exemplo: !ai Qual é a capital da França?');
        return;
      }
      
      const question = args.join(' ');
      logger.debug(`Comando ai com pergunta: ${question}`);
      
      // Envia indicador de digitação
      try {
        await bot.client.sendPresenceUpdate('composing', chatId);
      } catch (error) {
        logger.error('Erro ao enviar indicador de digitação:', error);
      }
      
      // Obtém resposta da IA
      try {
        logger.debug('Tentando obter completação LLM');
        const response = await llmService.getCompletion({
          prompt: question,
          provider: 'openrouter', // Usa LM Studio local por padrão
          temperature: 0.7,
          maxTokens: 500
        });
        
        logger.debug('Resposta LLM obtida, enviando para usuário', response);
        await bot.sendMessage(chatId, response);
      } catch (error) {
        logger.error('Erro ao obter completação LLM:', error);
        await bot.sendMessage(chatId, 'Desculpe, encontrei um erro ao processar sua solicitação.');
      }
    }
  },
  {
    name: 'echo',
    description: 'Repete o texto fornecido',
    reactions: {
      before: "📝",
      after: "🔊"
    },
    method: async (bot, message, args, group) => {
      const chatId = message.group || message.author;
      
      if (args.length === 0) {
        logger.debug('Comando echo chamado sem texto');
        await bot.sendMessage(chatId, 'Por favor, forneça algum texto para repetir.');
        return;
      }
      
      const text = args.join(' ');
      logger.debug(`Comando echo com texto: ${text}`);
      await bot.sendMessage(chatId, text);
    }
  },
  {
    name: 'roll',
    description: 'Joga um dado (padrão: 6 lados)',
    reactions: {
      before: "🎲",
      after: "🎯"
    },
    method: async (bot, message, args, group) => {
      const chatId = message.group || message.author;
      
      let sides = 6;
      if (args.length > 0 && !isNaN(args[0])) {
        sides = parseInt(args[0]);
      }
      
      logger.debug(`Comando roll com ${sides} lados`);
      const result = Math.floor(Math.random() * sides) + 1;
      await bot.sendMessage(chatId, `🎲 Você tirou ${result} (d${sides})`);
    }
  }
];

// Registra os comandos sendo exportados
logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };