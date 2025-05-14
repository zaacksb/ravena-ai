const path = require('path');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');
const fs = require('fs').promises;

const logger = new Logger('donation-commands');
const database = Database.getInstance();

//logger.info('Módulo DonationCommands carregado');

/**
 * Lê o arquivo de cabeçalho dos donates
 * @returns {Promise<string>} - Conteúdo do cabeçalho
 */
async function readDonationHeader() {
  try {
    const headerPath = path.join(database.databasePath, 'textos', 'donate_header.txt');
    const headerContent = await fs.readFile(headerPath, 'utf8');
    return headerContent;
  } catch (error) {
    logger.warn('Erro ao ler cabeçalho do donate:', error);
    return '💖 *Ajuda de custos _ravenabot_!* 🐦‍⬛\n\n';
  }
}

/**
 * Lê o arquivo de rodapé dos donates
 * @returns {Promise<string>} - Conteúdo do rodapé
 */
async function readDonationFooter() {
  try {
    const headerPath = path.join(database.databasePath, 'textos', 'donate_footer.txt');
    const headerContent = await fs.readFile(headerPath, 'utf8');
    return headerContent;
  } catch (error) {
    logger.warn('Erro ao ler footer do donate:', error);
    return '';
  }
}


/**
 * Mostra status da meta de doação (se configurada)
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com informações da meta
 */
async function showDonationGoal(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Verifica se a meta de doação está configurada
    const goalAmount = process.env.DONATION_GOAL_AMOUNT;
    const goalDescription = process.env.DONATION_GOAL_DESCRIPTION;
    
    if (!goalAmount || isNaN(parseFloat(goalAmount))) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Nenhuma meta de doação está definida atualmente.'
      });
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
    
    logger.debug('Informações de meta de doação enviadas com sucesso');
    
    return new ReturnMessage({
      chatId: chatId,
      content: goalMsg
    });
  } catch (error) {
    logger.error('Erro ao enviar informações de meta de doação:', error);
    const chatId = message.group || message.author;
    
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao recuperar informações de meta de doação. Por favor, tente novamente.'
    });
  }
}

/**
 * Mostra lista dos principais doadores
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com lista de doadores
 */
async function showTopDonors(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Obtém todas as doações
    const donations = await database.getDonations();
    
    if (!donations || donations.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Nenhuma doação foi recebida ainda. Seja o primeiro a doar!'
      });
    }
    
    // Ordena doações por valor (maior primeiro)
    donations.sort((a, b) => b.valor - a.valor);
    
    // Limita aos 1000 principais doadores
    const topDonors = donations.slice(0, 1000);
    
    // Calcula total de doações
    const totalAmount = donations.reduce((total, donation) => total + donation.valor, 0);
    
    const donationLink = process.env.DONATION_LINK || 'https://tipa.ai/seunome';

    // Constrói mensagem
    let donorsMsg = await readDonationHeader();
    
    topDonors.forEach((donor, index) => {
      let emjNumero = (donor.numero?.length > 5) ? "" : " ❗️";
      donorsMsg += `${index + 1}. *${donor.nome}*: R$${donor.valor.toFixed(2)}${emjNumero}\n`;
    });
    
    donorsMsg += await readDonationFooter();

    
    logger.debug('Lista de principais doadores enviada com sucesso');
    
    return new ReturnMessage({
      chatId: chatId,
      content: donorsMsg
    });
  } catch (error) {
    logger.error('Erro ao enviar lista de principais doadores:', error);
    const chatId = message.group || message.author;
    
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao recuperar informações de doadores. Por favor, tente novamente.'
    });
  }
}

// Lista de comandos usando a classe Command
const commands = [
  new Command({
    name: 'doar',
    description: 'Mostra informações de doação e link',
    category: "geral",
    method: showTopDonors
  }),
  new Command({
    name: 'doadores',
    description: 'Mostra informações de doação e link',
    category: "geral",
    method: showTopDonors
  }),
  new Command({
    name: 'donate',
    description: 'Mostra informações de doação e link',
    category: "geral",
    method: showTopDonors,
    hidden: true
  })
];


module.exports = { commands };