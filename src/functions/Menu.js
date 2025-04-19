// Atualiza o arquivo Menu.js na pasta src/functions

const path = require('path');
const Logger = require('../utils/Logger');
const fs = require('fs').promises;
const Database = require('../utils/Database');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');

const logger = new Logger('menu-commands');
const database = Database.getInstance();

//logger.info('Módulo MenuCommands carregado');

/**
 * Agrupa comandos por categoria para melhor organização
 * @param {Array} commands - Lista de comandos
 * @returns {Object} - Comandos agrupados por categoria
 */
function groupCommandsByCategory(commands) {
  const categories = {
    group: [],
    fixed: [],
    management: [],
    custom: []
  };
  
  // Agrupa comandos por categoria
  for (const cmd of commands) {
    if (cmd.category === 'group') {
      categories.group.push(cmd);
    } else {
      categories.fixed.push(cmd);
    }
  }
  
  return categories;
}

/**
 * Formata comando para exibição no menu
 * @param {Object} cmd - Objeto de comando
 * @param {string} prefix - Prefixo de comando
 * @returns {string} - String de comando formatada
 */
function formatCommand(cmd, prefix) {
  let result = `• *${prefix}${cmd.name}*`;
  
  // Adiciona aliases se disponíveis
  if (cmd.aliases && Array.isArray(cmd.aliases) && cmd.aliases.length > 0) {
    result += `, *${prefix}${cmd.aliases.join(`*, *${prefix}`)}*`;
  } else if (cmd.aliasFor) {
    // Este é um alias
    result += ` (alias para ${prefix}${cmd.aliasFor})`;
  }
  
  // Adiciona reação se disponível
  if (cmd.reactions && cmd.reactions.trigger) {
    result += ` (${cmd.reactions.trigger})`;
  }
  
  // Adiciona descrição
  if (cmd.description) {
    result += `: ${cmd.description}`;
  }
  
  return result;
}

/**
 * Envia uma lista de todos os comandos disponíveis
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com a lista de comandos
 */
async function sendCommandList(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    logger.debug(`Enviando lista de comandos para ${chatId}`);
    
    // Obtém todos os comandos fixos
    const fixedCommands = bot.eventHandler.commandHandler.fixedCommands.getAllCommands();
    
    // Obtém comandos personalizados para este grupo
    const customCommands = group ? 
      (await database.getCustomCommands(group.id)).filter(cmd => cmd.active && !cmd.deleted) : 
      [];
    
    // Agrupa comandos fixos por categoria
    const categorizedCommands = groupCommandsByCategory(fixedCommands);
    
    // Constrói mensagem
    let menuText = '*Comandos Disponíveis*\n\n';
    const prefix = group && group.prefix ? group.prefix : bot.prefix;
    
    // MELHORIA: Mostra comandos personalizados primeiro
    // Adiciona seção de comandos personalizados se houver algum
    if (customCommands.length > 0) {
      menuText += '*Comandos Personalizados:*\n';
      for (const cmd of customCommands) {
        let cmdText = `• *${prefix}${cmd.startsWith}*`;
        if (cmd.reactions && cmd.reactions.trigger) {
          cmdText += ` (${cmd.reactions.trigger})`;
        }
        menuText += `${cmdText}\n`;
      }
      menuText += '\n';
    }
    
    // Adiciona seção de comandos de grupo (se houver)
    if (categorizedCommands.group.length > 0) {
      menuText += '*Comandos de Grupo:*\n';
      for (const cmd of categorizedCommands.group) {
        menuText += `${formatCommand(cmd, prefix)}\n`;
      }
      menuText += '\n';
    }
    
    // Adiciona seção de comandos fixos
    menuText += '*Comandos Gerais:*\n';
    for (const cmd of categorizedCommands.fixed) {
      menuText += `${formatCommand(cmd, prefix)}\n`;
    }
    
    // Adiciona seção de comandos de gerenciamento
    menuText += '\n*Comandos de Gerenciamento:*\n';
    menuText += `• *${prefix}g-help*: Mostra ajuda de comandos de gerenciamento\n`;
    menuText += `• *${prefix}g-info*: Mostra informações detalhadas do grupo\n`;
    menuText += `• *${prefix}g-setName*: Muda nome do grupo\n`;
    menuText += `• *${prefix}g-addCmd*: Adiciona um comando personalizado\n`;
    menuText += `• *${prefix}g-delCmd*: Exclui um comando personalizado\n`;
    menuText += `• *${prefix}g-enableCmd*: Habilita um comando personalizado\n`;
    menuText += `• *${prefix}g-disableCmd*: Desabilita um comando personalizado\n`;
    menuText += `• *${prefix}g-setCustomPrefix*: Muda prefixo de comando\n`;
    menuText += `• *${prefix}g-setWelcome*: Define mensagem de boas-vindas\n`;
    menuText += `• *${prefix}g-setFarewell*: Define mensagem de despedida\n`;
    menuText += `• *${prefix}g-setReact*: Define reação 'depois' do comando\n`;
    menuText += `• *${prefix}g-setStartReact*: Define reação 'antes' do comando\n`;
    menuText += `• *${prefix}g-filtro-palavra*: Adiciona/remove palavras do filtro\n`;
    menuText += `• *${prefix}g-filtro-links*: Ativa/desativa filtro de links\n`;
    menuText += `• *${prefix}g-filtro-pessoa*: Adiciona/remove pessoas do filtro\n`;
    menuText += `• *${prefix}g-filtro-nsfw*: Ativa/desativa filtro de conteúdo NSFW\n`;
    
    // Retorna a mensagem com o menu
    return new ReturnMessage({
      chatId: chatId,
      content: menuText
    });
  } catch (error) {
    logger.error('Erro ao enviar lista de comandos:', error);
    const chatId = message.group || message.author;
    
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao recuperar lista de comandos. Por favor, tente novamente.'
    });
  }
}

// Criar array de comandos usando a classe Command
const commands = [
  new Command({
    name: 'cmd',
    description: 'Mostra todos os comandos disponíveis',
    method: async (bot, message, args, group) => {
      return await sendCommandList(bot, message, args, group);
    }
  }),
  
  new Command({
    name: 'menu',
    description: 'Mostra todos os comandos disponíveis',
    method: async (bot, message, args, group) => {
      return await sendCommandList(bot, message, args, group);
    }
  })
];

// Registra os comandos sendo exportados
//logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };