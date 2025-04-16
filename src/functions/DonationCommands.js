const path = require('path');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');

const logger = new Logger('donation-commands');
const database = Database.getInstance();

logger.info('Módulo DonationCommands carregado');

const commands = [
  {
    name: 'donate',
    description: 'Mostra informações de doação e link',
    method: async (bot, message, args, group) => {
      await showDonationInfo(bot, message, args, group);
    }
  },
  {
    name: 'doar',
    description: 'Mostra informações de doação e link (Português)',
    method: async (bot, message, args, group) => {
      await showDonationInfo(bot, message, args, group);
    }
  },
  {
    name: 'doadores',
    description: 'Mostra principais doadores',
    method: async (bot, message, args, group) => {
      await showTopDonors(bot, message, args, group);
    }
  },
  {
    name: 'donors',
    description: 'Mostra principais doadores (Inglês)',
    method: async (bot, message, args, group) => {
      await showTopDonors(bot, message, args, group);
    }
  }
];

/**
 * Mostra informações de doação e link
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 */
async function showDonationInfo(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Obtém link de doação da variável de ambiente
    const donationLink = process.env.DONATION_LINK || 'https://tipa.ai/seunome';
    
    const donationMsg = 
      `💖 *Apoie-nos com uma doação!* 💖\n\n` +
      `Suas doações nos ajudam a manter e melhorar este bot.\n\n` +
      `🔗 *Link de Doação:* ${donationLink}\n\n` +
      `Use !donors ou !doadores para ver uma lista de doadores que já contribuíram. Obrigado!`;
    
    await bot.sendMessage(chatId, donationMsg);
    
    logger.debug('Informações de doação enviadas com sucesso');
  } catch (error) {
    logger.error('Erro ao enviar informações de doação:', error);
    const chatId = message.group || message.author;
    await bot.sendMessage(chatId, 'Erro ao recuperar informações de doação. Por favor, tente novamente.');
  }
}

/**
 * Mostra status da meta de doação (se configurada)
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 */
async function showDonationGoal(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Verifica se a meta de doação está configurada
    const goalAmount = process.env.DONATION_GOAL_AMOUNT;
    const goalDescription = process.env.DONATION_GOAL_DESCRIPTION;
    
    if (!goalAmount || isNaN(parseFloat(goalAmount))) {
      await bot.sendMessage(chatId, 'Nenhuma meta de doação está definida atualmente.');
      return;
    }
    
    // Obtém todas as doações
    const donations = await database.getDonations();
    
    // Calcula total de doações
    const totalAmount = donations.reduce((total, donation) => total + donation.valor, 0);
    
    // Calcula porcentagem
    const goalAmountNum = parseFloat(goalAmount);
    const percentage = Math.min(100, Math.floor((totalAmount / goalAmountNum) * 100));
    
    // Cria barra de progresso
    const barLength = 20;
    const filledLength = Math.floor((percentage / 100) * barLength);
    const progressBar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    // Constrói mensagem
    let goalMsg = 
      `🎯 *Meta de Doação* 🎯\n\n` +
      `Atual: R$${totalAmount.toFixed(2)} / Meta: R$${goalAmountNum.toFixed(2)}\n` +
      `[${progressBar}] ${percentage}%\n\n`;
    
    if (goalDescription) {
      goalMsg += `*Meta:* ${goalDescription}\n\n`;
    }
    
    goalMsg += `Use !donate ou !doar para nos ajudar a alcançar nossa meta!`;
    
    await bot.sendMessage(chatId, goalMsg);
    
    logger.debug('Informações de meta de doação enviadas com sucesso');
  } catch (error) {
    logger.error('Erro ao enviar informações de meta de doação:', error);
    const chatId = message.group || message.author;
    await bot.sendMessage(chatId, 'Erro ao recuperar informações de meta de doação. Por favor, tente novamente.');
  }
}

/**
 * Mostra lista dos principais doadores
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 */
async function showTopDonors(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Obtém todas as doações
    const donations = await database.getDonations();
    
    if (!donations || donations.length === 0) {
      await bot.sendMessage(chatId, 'Nenhuma doação foi recebida ainda. Seja o primeiro a doar!');
      return;
    }
    
    // Ordena doações por valor (maior primeiro)
    donations.sort((a, b) => b.valor - a.valor);
    
    // Limita aos 10 principais doadores
    const topDonors = donations.slice(0, 10);
    
    // Calcula total de doações
    const totalAmount = donations.reduce((total, donation) => total + donation.valor, 0);
    
    // Constrói mensagem
    let donorsMsg = 
      `🏆 *Principais Doadores* 🏆\n\n` +
      `Obrigado a todos os nossos apoiadores! Total de doações: R$${totalAmount.toFixed(2)}\n\n`;
    
    topDonors.forEach((donor, index) => {
      donorsMsg += `${index + 1}. ${donor.nome}: R$${donor.valor.toFixed(2)}\n`;
    });
    
    donorsMsg += `\nUse !donate ou !doar para nos apoiar também!`;
    
    await bot.sendMessage(chatId, donorsMsg);
    
    logger.debug('Lista de principais doadores enviada com sucesso');
  } catch (error) {
    logger.error('Erro ao enviar lista de principais doadores:', error);
    const chatId = message.group || message.author;
    await bot.sendMessage(chatId, 'Erro ao recuperar informações de doadores. Por favor, tente novamente.');
  }
}

// Registra os comandos sendo exportados
logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };