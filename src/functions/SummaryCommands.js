const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');
const LLMService = require('../services/LLMService');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

const logger = new Logger('summary-commands');
const database = Database.getInstance();
const llmService = new LLMService({});

// Diretório para armazenar mensagens recentes
const dataDir = path.join(database.databasePath, 'conversations');

// Garante que o diretório exista
fs.mkdir(dataDir, { recursive: true })
  .then(() => {
    logger.info(`Diretório de conversas criado: ${dataDir}`);
  })
  .catch(error => {
    logger.error('Erro ao criar diretório de conversas:', error);
  });

//logger.info('Módulo SummaryCommands carregado');

/**
 * Resume conversa de grupo
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage com o resumo
 */
async function summarizeConversation(bot, message, args, group) {
  try {
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    logger.info(`Resumindo conversa para o grupo ${message.group}`);
    
    // Tenta buscar mensagens do histórico de chat
    const chat = await message.origin.getChat();
    let recentMessages;
    
    try {
      // Tenta obter mensagens diretamente do WhatsApp
      const fetchedMessages = await chat.fetchMessages({ limit: 30 }); // NÃO IMPLEMENTADO NA EVO
      
      if (fetchedMessages && fetchedMessages.length > 0) {
        recentMessages = await Promise.all(fetchedMessages.map(async (msg) => {
          const contact = await msg.getContact();
          const authorName = contact.pushname || contact.name || "Desconhecido";
          const textContent = msg.body || msg.caption || "";
          
          return {
            author: authorName,
            text: textContent,
            timestamp: msg.timestamp * 1000 // Converte para milissegundos
          };
        }));
        
        // Filtra mensagens vazias
        recentMessages = recentMessages.filter(msg => msg.text.trim() !== "");
      } else {
        // Recorre a mensagens armazenadas
        recentMessages = await getRecentMessages(message.group);
      }
    } catch (fetchError) {
      logger.error('Erro ao buscar mensagens do chat:', fetchError);
      // Recorre a mensagens armazenadas
      recentMessages = await getRecentMessages(message.group);
    }
    
    if (!recentMessages || recentMessages.length === 0) {
      return new ReturnMessage({
        chatId: message.group,
        content: 'Nenhuma mensagem recente para resumir.'
      });
    }
    
    // Formata mensagens para prompt
    const formattedMessages = formatMessagesForPrompt(recentMessages);
    
    // Cria prompt para LLM
    const prompt = `Abaixo está uma conversa recente de um grupo de WhatsApp. Por favor, resuma os principais pontos discutidos de forma concisa:

${formattedMessages}

Resumo:`;
    
    
    // Obtém resumo do LLM
    const summary = await llmService.getCompletion({ prompt: prompt });
    
    if (!summary) {
      return new ReturnMessage({
        chatId: message.group,
        content: 'Falha ao gerar resumo. Por favor, tente novamente.'
      });
    }
    
    // Envia o resumo
    return new ReturnMessage({
      chatId: message.group,
      content: `📋 *Resumo da conversa:*\n\n${summary}`
    });
    
    logger.info(`Resumo de conversa enviado com sucesso para ${message.group}`);
  } catch (error) {
    logger.error('Erro ao resumir conversa:', error);
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao gerar resumo. Por favor, tente novamente.'
    });
  }
}

/**
 * Gera mensagem interativa baseada na conversa
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com a interação gerada
 */
async function interactWithConversation(bot, message, args, group) {
  try {
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }

    const retornarErro = args[0] ?? true;
    
    logger.info(`[interactWithConversation] Gerando interação para o grupo ${message.group}`);
    
    // Tenta buscar mensagens do histórico de chat
    const chat = await message.origin.getChat();
    let recentMessages;
    
    try {
      // Tenta obter mensagens diretamente do WhatsApp
      const fetchedMessages = await chat.fetchMessages({ limit: 30 }); // Não implementado na evo
      
      if (fetchedMessages && fetchedMessages.length > 0) {
        recentMessages = await Promise.all(fetchedMessages.map(async (msg) => {
          const contact = await msg.getContact();
          const authorName = contact.pushname || contact.name || "Desconhecido";
          const textContent = msg.body || msg.caption || "";
          
          return {
            author: authorName,
            text: textContent,
            timestamp: msg.timestamp * 1000 // Converte para milissegundos
          };
        }));
        
        // Filtra mensagens vazias
        recentMessages = recentMessages.filter(msg => msg.text.trim() !== "");
      } else {
        // Recorre a mensagens armazenadas
        recentMessages = await getRecentMessages(message.group);
      }

    } catch (fetchError) {
      logger.error('[interactWithConversation] Erro ao buscar mensagens do chat:', fetchError);
      // Recorre a mensagens armazenadas
      recentMessages = await getRecentMessages(message.group);
    }

    logger.info(`[interactWithConversation] Mensagens recentes: ${recentMessages.length}`);
    
    if (!recentMessages || recentMessages.length === 0) {
      if(retornarErro){
        return new ReturnMessage({
          chatId: message.group,
          content: 'Nenhuma mensagem recente para interagir.'
        });
      } else {
        return [];

      }
    } 
    
    // Formata mensagens para prompt
    const formattedMessages = formatMessagesForPrompt(recentMessages);
    
    // Cria prompt para LLM
    const prompt = `Responda apenas em português do brasil. A seguir anexei uma conversa recente de um grupo de WhatsApp. Crie uma única mensagem curta para interagir com o grupo de forma natural, como se você entendesse o assunto e quisesse participar da conversa com algo relevante. Tente usar o mesmo tom e estilo informal que as pessoas estão usando. A mensagem deve ser curta e natural:

${formattedMessages}`;
    
    logger.info(`[interactWithConversation] Enviando prompt: ${prompt.substring(0, 500)}`);

    // Obtém interação do LLM
    const interaction = await llmService.getCompletion({prompt: prompt});
    
    if (!interaction) {
      if(retornarErro){
        return new ReturnMessage({
          chatId: message.group,
          content: 'Falha ao gerar mensagem. Por favor, tente novamente.'
        });
      } else {
        return [];
      }
    } 
    
    // Verifica se teve mentions
    const llmMentions = interaction.match(/@(\d{8,})/g)?.map(m => m.slice(1)) || [];

    // Envia a mensagem de interação
    if(interaction.includes("Não foi poss") && !retornarErro){
      logger.info(`Mensagem de interação ignorada pois ocorreu um erro na hora de gerar (${message.group}/'${interaction}')`);
      return [];
    } else {
      logger.info(`Mensagem de interação enviada com sucesso para ${message.group}`);

      return new ReturnMessage({
        chatId: message.group,
        content: interaction,
        mentions: llmMentions
      });
    }
    
  } catch (error) {
    logger.error('Erro ao gerar interação:', error);
    if(retornarErro){
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: 'Erro ao gerar mensagem. Por favor, tente novamente.'
      });
    } else {
      return [];
    }
  }
}

/**
 * Armazena uma mensagem no histórico de conversas do grupo
 * @param {Object} message - Os dados da mensagem
 * @param {Object} group - Os dados do grupo
 */
async function storeMessage(message, group) {
  try {
    if (!message.group || !group) return;
    
    const conversationFile = path.join(dataDir, `latest-messages-${group.id}.json`);
    
    // Carrega mensagens existentes
    let messages = [];
    try {
      const data = await fs.readFile(conversationFile, 'utf8');
      messages = JSON.parse(data);
    } catch (error) {
      // Arquivo provavelmente não existe ainda, tudo bem
      logger.debug(`Nenhum arquivo de conversa existente para ${group.id}`);
    }
    
    // Adiciona nova mensagem
    let textContent = message.type === 'text' ? message.content : message.caption;

    if(message.type === 'image'){
      // Tenta interpretar a imagem usando Vision AI
      if(message.content){
        const completionOptions = {
          prompt: "Analise a foto e retorne apenas uma sucinta descrição (em pt-BR) do que vê na imagem no formato, máximo 200 caracteres: Imagem[xxxx xxxx xxx]",
          systemContext: "Você é um bot especialista em interpretação de imagens.",
          provider: 'lmstudio',
          image: message.content.data
        };

        //logger.info(`[storeMessage] Prompt: `, completionOptions);
        const response = await llmService.getCompletion(completionOptions);


        if(response && !response.includes("Não foi poss") && !response.includes("Ocorreu um erro")){
          textContent = message.caption ? `${response}\nLegenda: ${message.caption}` : response;
          logger.info(`[storeMessage] Imagem interpretada: ${textContent}`);
        }
      }
    }

    if (textContent) {
      // Obtém detalhes do contato
      let authorName = "Desconhecido";
      try {
        const contact = await message.origin.getContact();
        authorName = contact.pushname || contact.name || "Desconhecido";
      } catch (error) {
        logger.error('Erro ao obter nome do contato:', error);
      }
      
      messages.push({
        author: authorName,
        text: textContent,
        timestamp: Date.now()
      });
      
      // Mantém apenas as últimas 30 mensagens
      if (messages.length > 30) {
        messages = messages.slice(messages.length - 30);
      }
      
      // Salva mensagens atualizadas
      await fs.writeFile(conversationFile, JSON.stringify(messages, null, 2), 'utf8');
      //logger.debug(`Mensagem armazenada no arquivo de conversa para ${group.id}`);
    }
  } catch (error) {
    logger.error('Erro ao armazenar mensagem:', error);
  }
}

/**
 * Obtém mensagens recentes para um grupo
 * @param {string} groupId - O ID do grupo
 * @returns {Promise<Array>} - Array de objetos de mensagem
 */
async function getRecentMessages(groupId) {
  try {
    const conversationFile = path.join(dataDir, `latest-messages-${groupId}.json`);
    
    // Carrega mensagens existentes
    try {
      const data = await fs.readFile(conversationFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.debug(`Nenhum arquivo de conversa existente para ${groupId}`);
      return [];
    }
  } catch (error) {
    logger.error('Erro ao obter mensagens recentes:', error);
    return [];
  }
}

/**
 * Formata mensagens para prompt do LLM
 * @param {Array} messages - Array de objetos de mensagem
 * @returns {string} - String de mensagens formatada
 */
function formatMessagesForPrompt(messages) {
  return messages.map(msg => `${msg.author}: ${msg.text}`).join('\n');
}


// Lista de comandos usando a classe Command
const commands = [
  new Command({
    name: 'resumo',
    description: 'Resume conversas recentes do grupo',
    category: 'ia',
    reactions: {
      before: process.env.LOADING_EMOJI ?? "🌀",
      after: "📋"
    },
    method: summarizeConversation
  }),
  
  new Command({
    name: 'interagir',
    description: 'Gera uma mensagem interativa baseada na conversa',
    category: 'ia',
    reactions: {
      trigger: "🦜",
      before: process.env.LOADING_EMOJI ?? "🌀",
      after: "💬"
    },
    method: interactWithConversation
  })
];

// Exporta a função storeMessage para ser usada em EventHandler
module.exports.storeMessage = storeMessage;

// Exporta comandos
module.exports.commands = commands;