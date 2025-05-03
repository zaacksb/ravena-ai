const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');

const logger = new Logger('ranking-messages');

/**
 * Atualiza o ranking de mensagens para um usuário
 * @param {string} chatId - ID do chat (grupo ou PV)
 * @param {string} userId - ID do usuário
 * @param {string} userName - Nome do usuário
 */
async function updateMessageCount(chatId, userId, userName) {
  try {
    // Define o caminho do arquivo de ranking
    const rankingPath = path.join(__dirname, '../../data/ranking');
    const rankingFile = path.join(rankingPath, `${chatId}.json`);
    
    // Certifica-se que o diretório existe
    try {
      await fs.mkdir(rankingPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        logger.error('Erro ao criar diretório de ranking:', error);
        return;
      }
    }
    
    // Carrega o ranking atual ou cria um novo
    let ranking = [];
    try {
      const data = await fs.readFile(rankingFile, 'utf8');
      ranking = JSON.parse(data);
    } catch (error) {
      // Se o arquivo não existir, inicia com array vazio
      if (error.code !== 'ENOENT') {
        logger.error(`Erro ao ler arquivo de ranking ${rankingFile}:`, error);
      }
    }
    
    // Encontra o usuário no ranking ou cria uma nova entrada
    const userIndex = ranking.findIndex(item => item.numero === userId);
    
    if (userIndex !== -1) {
      // Atualiza entrada existente
      ranking[userIndex].qtdMsgs++;
      ranking[userIndex].nome = userName; // Atualiza o nome a cada mensagem
    } else {
      // Cria nova entrada
      ranking.push({
        nome: userName,
        numero: userId,
        qtdMsgs: 1
      });
    }
    
    // Salva o ranking atualizado
    await fs.writeFile(rankingFile, JSON.stringify(ranking, null, 2), 'utf8');
  } catch (error) {
    logger.error('Erro ao atualizar contagem de mensagens:', error);
  }
}

/**
 * Obtém o ranking de mensagens para um chat
 * @param {string} chatId - ID do chat
 * @returns {Array} - Array de objetos de ranking ordenados por quantidade de mensagens
 */
async function getMessageRanking(chatId) {
  try {
    // Define o caminho do arquivo de ranking
    const rankingFile = path.join(__dirname, '../../data/ranking', `${chatId}.json`);
    
    // Tenta ler o arquivo de ranking
    try {
      const data = await fs.readFile(rankingFile, 'utf8');
      const ranking = JSON.parse(data);
      
      // Ordena o ranking por quantidade de mensagens (decrescente)
      return ranking.sort((a, b) => b.qtdMsgs - a.qtdMsgs);
    } catch (error) {
      // Se o arquivo não existir, retorna array vazio
      if (error.code === 'ENOENT') {
        return [];
      }
      
      logger.error(`Erro ao ler arquivo de ranking ${rankingFile}:`, error);
      return [];
    }
  } catch (error) {
    logger.error('Erro ao obter ranking de mensagens:', error);
    return [];
  }
}

/**
 * Processa uma mensagem recebida para atualizar o ranking
 * @param {Object} message - Mensagem formatada
 */
async function processMessage(message) {
  try {
    if (!message || !message.author) return;
    
    // Obtém ID do chat (grupo ou PV)
    const chatId = message.group || message.author;
    
    // Obtém nome do usuário
    let userName = "Usuário";
    try {
      if (message.origin && message.origin.getContact) {
        const contact = await message.origin.getContact();
        userName = contact.pushname || contact.name || "Usuário";
      }
    } catch (error) {
      logger.error('Erro ao obter nome do contato:', error);
    }
    
    // Atualiza contagem de mensagens
    await updateMessageCount(chatId, message.author, userName);
  } catch (error) {
    logger.error('Erro ao processar mensagem para ranking:', error);
  }
}

/**
 * Exibe o ranking de faladores do grupo
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Mensagem formatada
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - Mensagem de retorno
 */
async function faladoresCommand(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: "Este comando só funciona em grupos."
      });
    }
    
    // Obtém ranking
    const ranking = await getMessageRanking(chatId);
    
    if (ranking.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: "Ainda não há estatísticas de mensagens para este grupo."
      });
    }
    
    // Formata a resposta
    let response = "*🏆 Ranking de faladores do grupo 🏆*\n\n";
    
    // Adiciona até os 10 primeiros do ranking
    const topTen = ranking.slice(0, 10);
    
    // Emojis para os 3 primeiros lugares
    const medals = ["🥇", "🥈", "🥉"];
    
    topTen.forEach((item, index) => {
      const position = index < 3 ? medals[index] : `${index + 1}º`;
      response += `${position} *${item.nome}*: ${item.qtdMsgs} mensagens\n`;
    });
    
    // Adiciona estatísticas gerais
    const totalMessages = ranking.reduce((sum, item) => sum + item.qtdMsgs, 0);
    const totalUsers = ranking.length;
    
    response += `\n📊 *Estatísticas:*\n`;
    response += `Total de ${totalMessages} mensagens enviadas por ${totalUsers} participantes`;
    
    return new ReturnMessage({
      chatId: chatId,
      content: response
    });
  } catch (error) {
    logger.error('Erro ao executar comando de ranking de faladores:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: "Ocorreu um erro ao obter o ranking de faladores."
    });
  }
}

// Comando para exibir o ranking de faladores
const commands = [
  new Command({
    name: 'faladores',
    description: 'Mostra o ranking de quem mais fala no grupo',
    category: "grupo",
    method: faladoresCommand
  })
];

module.exports = { 
  commands,
  processMessage
};