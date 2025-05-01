const path = require('path');
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const Database = require('../utils/Database');

const logger = new Logger('anonymous-message');
const database = Database.getInstance();

// Constantes
const COOLDOWN_HOURS = 12; // Cooldown de 12 horas
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000; // Cooldown em milissegundos

// Armazena últimos usos por usuário
const lastUsedTimes = {};

/**
 * Envia uma mensagem anônima para um grupo
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function anonymousMessage(bot, message, args, group) {
  try {
    // Verifica o ID do remetente
    const senderId = message.author;
    
    // Verifica se há argumentos suficientes
    if (args.length < 2) {
      return new ReturnMessage({
        chatId: senderId,
        content: '⚠️ Formato incorreto. Use: !anonimo [idGrupo] mensagem\n\nExemplo: !anonimo grupoteste Olá, esta é uma mensagem anônima!'
      });
    }
    
    // Verifica cooldown
    const now = Date.now();
    if (lastUsedTimes[senderId] && (now - lastUsedTimes[senderId]) < COOLDOWN_MS) {
      const timeLeft = Math.ceil((COOLDOWN_MS - (now - lastUsedTimes[senderId])) / (1000 * 60 * 60));
      return new ReturnMessage({
        chatId: senderId,
        content: `⏳ Você precisa esperar ${timeLeft} hora(s) para enviar outra mensagem anônima.`
      });
    }
    
    // Obtém o ID do grupo alvo
    const targetGroupName = args[0].toLowerCase();
    
    // Obtém a mensagem a ser enviada
    const anonymousText = args.slice(1).join(' ');
    
    // Verifica se a mensagem é muito curta
    if (anonymousText.length < 5) {
      return new ReturnMessage({
        chatId: senderId,
        content: '⚠️ A mensagem é muito curta. Por favor, escreva algo mais substancial.'
      });
    }
    
    // Obtém todos os grupos para verificar o alvo
    const groups = await database.getGroups();
    
    // Encontra o grupo pelo nome ou ID
    const targetGroup = groups.find(g => 
      (g.name && g.name.toLowerCase() === targetGroupName) || 
      (g.id && g.id.toLowerCase().includes(targetGroupName))
    );
    
    if (!targetGroup) {
      return new ReturnMessage({
        chatId: senderId,
        content: `❌ Grupo "${targetGroupName}" não encontrado. Verifique o nome e tente novamente.`
      });
    }
    
    // Verifica se o grupo existe e se o bot está no grupo
    try {
      await bot.client.getChatById(targetGroup.id);
    } catch (error) {
      return new ReturnMessage({
        chatId: senderId,
        content: `❌ Não foi possível acessar o grupo. O bot pode não estar mais nele ou o grupo foi excluído.`
      });
    }
    
    // Verifica se o usuário está no grupo (opcional, pode remover esta verificação)
    /*
    try {
      const chat = await bot.client.getChatById(targetGroup.id);
      const participants = await chat.participants;
      
      const isUserInGroup = participants.some(
        p => p.id._serialized === senderId
      );
      
      if (!isUserInGroup) {
        return new ReturnMessage({
          chatId: senderId,
          content: `❌ Você não é membro do grupo "${targetGroup.name}". Apenas membros podem enviar mensagens anônimas.`
        });
      }
    } catch (error) {
      logger.error('Erro ao verificar participantes do grupo:', error);
    }
    */
    
    // Registra o uso do comando para controle de cooldown
    lastUsedTimes[senderId] = now;
    
    // Mantém um registro para moderar abusos (opcional)
    try {
      // Obtém variáveis personalizadas
      const customVariables = await database.getCustomVariables();
      
      // Inicializa registros de mensagens anônimas se não existir
      if (!customVariables.anonymousMessages) {
        customVariables.anonymousMessages = [];
      }
      
      // Adiciona registro
      customVariables.anonymousMessages.push({
        senderId,
        targetGroupId: targetGroup.id,
        targetGroupName: targetGroup.name,
        message: anonymousText,
        timestamp: now
      });
      
      // Limita o histórico a 100 mensagens
      if (customVariables.anonymousMessages.length > 100) {
        customVariables.anonymousMessages = customVariables.anonymousMessages.slice(-100);
      }
      
      // Salva variáveis atualizadas
      await database.saveCustomVariables(customVariables);
    } catch (error) {
      logger.error('Erro ao registrar mensagem anônima:', error);
    }
    
    // Envia a mensagem para o grupo alvo
    try {
      // Formata a mensagem anônima
      const formattedMessage = `👻 *Um membro anônimo enviou:*\n\n"${anonymousText}"`;
      
      // Envia para o grupo alvo
      await bot.sendMessage(targetGroup.id, formattedMessage);
      
      // Confirma o envio para o remetente
      return new ReturnMessage({
        chatId: senderId,
        content: `✅ Sua mensagem anônima foi enviada com sucesso para o grupo "${targetGroup.name}".\n\nVocê poderá enviar outra mensagem anônima em ${COOLDOWN_HOURS} horas.`
      });
    } catch (error) {
      logger.error('Erro ao enviar mensagem anônima:', error);
      
      return new ReturnMessage({
        chatId: senderId,
        content: `❌ Erro ao enviar mensagem anônima: ${error.message}`
      });
    }
  } catch (error) {
    logger.error('Erro no comando de mensagem anônima:', error);
    
    return new ReturnMessage({
      chatId: message.author,
      content: '❌ Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.'
    });
  }
}

// Criar comando
const commands = [
  new Command({
    name: 'anonimo',
    description: 'Envia uma mensagem anônima para um grupo',
    category: "jogos",
    cooldown: 0, // O cooldown é gerenciado internamente
    reactions: {
      before: "📨",
      after: "👻",
      error: "❌"
    },
    method: anonymousMessage
  })
];

module.exports = { commands };