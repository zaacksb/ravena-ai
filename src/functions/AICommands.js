const path = require('path');
const fs = require('fs').promises;
const Logger = require('../utils/Logger');
const LLMService = require('../services/LLMService');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const Database = require('../utils/Database');


const logger = new Logger('ai-commands');

const llmService = new LLMService({});
const database = Database.getInstance();

async function aiCommand(bot, message, args, group) {
  const chatId = message.group || message.author;

  // Contexto e descrição do bot
  const ctxPath = path.join(database.databasePath, 'textos', 'llm_context.txt');
  let ctxContent = await fs.readFile(ctxPath, 'utf8');

  const fixedCommands = bot.eventHandler.commandHandler.fixedCommands.getAllCommands();
  const managementCommands = bot.eventHandler.commandHandler.management.getManagementCommands();

  let cmdSimpleList = "";
  let cmdGerenciaSimplesList = "";

  for(let cmd of fixedCommands){
    if(cmd.description && cmd.description.length > 0 && !cmd.description.toLowerCase().includes("alias") && !cmd.hidden){
      const usage = cmd.usage ? ` | Uso: ${cmd.usage}`: "";
    	cmdSimpleList += `- ${bot.prefix}${cmd.name}: ${cmd.description}${usage}\n`;
    }
  }
  for(let cmd in managementCommands){
    const desc = managementCommands[cmd].description;
    cmdGerenciaSimplesList += `- ${bot.prefix}g-${cmd}: ${desc}\n`;
  }

  const variaveisReturn = await bot.eventHandler.commandHandler.management.listVariables(bot, message, args, group);
  const variaveisList = variaveisReturn.content;

  ctxContent += `\n\nEstes são todos os comandos que você pode processar:\n\n${cmdSimpleList}\n\nPara os comandos personalizados criados com g-addCmd, você pode usar variáveis:\n${variaveisList}\n\nEstes são os comandos usados apenas por administradores para gerenciarem seus grupos: ${cmdGerenciaSimplesList}\n\nSempre que for informar uma variável em um comando, use {} para encapsular ela, como {titulo}, {pessoa}. Quando o comando de gerencia pedir mídia, o comando deve ser enviado na legenda da foto/vídeo ou em resposta (reply) à mensagem que contém midia. Lembre o usuário que com o comando !g-painel algumas configurações do gerenciar são mais fáceis de fazer, como mensagem de boas vindas e canais da twitch/youtube`;
  
  let question = message.caption ?? message.content;
  const quotedMsg = await message.origin.getQuotedMessage();
  if(quotedMsg){
    // Tem mensagem marcada, junta o conteudo (menos que tenha vindo de reação)
    if(!message.originReaction){
      const quotedText = quotedMsg.caption ?? quotedMsg.content ?? quotedMsg.body;

      if(quotedText.length > 10){
        question += `\n\n${quotedText}`;
      }
    }
  }

  const media = await getMediaFromMessage(message);

  if (!media && question.length < 5) {
    return new ReturnMessage({
      chatId: chatId,
      content: 'Por favor, forneça uma pergunta ou uma imagem com uma pergunta. Exemplo: !ai Qual é a capital da França?',
      options: {
        quotedMessageId: message.origin.id._serialized,
        evoReply: message.origin
      }
    });
  }
  
  //logger.debug(`Comando ai com pergunta: ctx: ${ctxContent}, \n Prompt: '${question}'`);
  
  const completionOptions = {
    prompt: question,
    systemContext: ctxContent
  };

  if (media && media.data) {
    logger.debug('[aiCommand] Comando AI com mídia detectada.');
    completionOptions.provider = 'lmstudio';
    completionOptions.image = media.data;
  }

  // Obtém resposta da IA
  try {
    logger.debug('[aiCommand] Tentando obter resposta do LLM', completionOptions);
    const response = await llmService.getCompletion(completionOptions);
    
    logger.debug('[aiCommand] Resposta LLM obtida, processando variaveis', response);

    let processedResponse;
    try{
      processedResponse = await bot.eventHandler.commandHandler.variableProcessor.process(response, {message, group, command: false, options: {}, bot });
    } catch(e){
      processedResponse = response;
    }
    
    // Retorna a resposta da IA
    return new ReturnMessage({
      chatId: chatId,
      content: processedResponse,
      options: {
        quotedMessageId: message.origin.id._serialized,
        evoReply: message.origin
      }
    });
  } catch (error) {
    logger.error('[aiCommand] Erro ao obter completação LLM:', error);
    return new ReturnMessage({
      chatId: chatId,
      content: 'Desculpe, encontrei um erro ao processar sua solicitação.',
      options: {
        quotedMessageId: message.origin.id._serialized,
        evoReply: message.origin
      }
    });
  }
}

// Auxiliar para obter mídia da mensagem
function getMediaFromMessage(message) {
  return new Promise((resolve, reject) => {
    // Se a mensagem tem mídia direta
    if (message.type !== 'text') {
      resolve(message.content);
      return;
    }
    
    // Tenta obter mídia da mensagem citada
    message.origin.getQuotedMessage()
      .then(quotedMsg => {
        if (quotedMsg && quotedMsg.hasMedia) {
          return quotedMsg.downloadMedia();
        }
        resolve(null);
      })
      .then(media => {
        if (media) resolve(media);
      })
      .catch(error => {
        logger.error('Erro ao obter mídia da mensagem citada:', error);
        resolve(null);
      });
  });
}

const commands = [
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
    cooldown: 60,
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
    cooldown: 60,
    method: aiCommand
  }), 
  new Command({
    name: 'gpt',
    hidden: true,
    description: 'Alias para AI',
    category: "ia",
    group: "askia",
    reactions: {
      trigger: "🤖",
      before: "⏳",
      after: "🤖"
    },
    cooldown: 60,
    method: aiCommand
  }), 
  new Command({
    name: 'gemini',
    hidden: true,
    description: 'Alias para AI',
    category: "ia",
    group: "askia",
    reactions: {
      trigger: "🤖",
      before: "⏳",
      after: "🤖"
    },
    cooldown: 60,
    method: aiCommand
  })
];

module.exports = { commands, aiCommand };
