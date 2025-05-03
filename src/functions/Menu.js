// Atualiza o arquivo Menu.js na pasta src/functions

const path = require('path');
const Logger = require('../utils/Logger');
const fs = require('fs').promises;
const Database = require('../utils/Database');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const { COMMAND_ORDER, CATEGORY_EMOJIS } = require('./MenuOrder')
const logger = new Logger('menu-commands');
const database = Database.getInstance();


/**
 * Lê o arquivo de cabeçalho do menu
 * @returns {Promise<string>} - Conteúdo do cabeçalho
 */
async function readMenuHeader() {
  try {
    const headerPath = path.join(process.cwd(), 'data', 'textos', 'cmd_header.txt');
    const headerContent = await fs.readFile(headerPath, 'utf8');
    return headerContent.trim();
  } catch (error) {
    logger.warn('Erro ao ler cabeçalho do menu:', error);
    return '';
  }
}

/**
 * Agrupa comandos por categoria para melhor organização
 * @param {Array} commands - Lista de comandos
 * @returns {Object} - Comandos agrupados por categoria
 */
function groupCommandsByCategory(commands) {
  const categories = {};
  
  // Inicializa categorias com base no objeto CATEGORY_EMOJIS
  Object.keys(CATEGORY_EMOJIS).forEach(category => {
    categories[category] = [];
  });
  
  // Agrupa comandos por categoria
  for (const cmd of commands) {
    // Ignora comandos ocultos
    if (cmd.hidden) continue;
    
    let category = cmd.category?.toLowerCase() ?? "resto";
    if(category.length < 1){
      category = "resto";
    }
    
    // Cria a categoria se não existir
    if (!categories[category]) {
      categories[category] = [];
    }
    
    categories[category].push(cmd);
  }
  
  console.log(Object.keys(categories));
  return categories;
}

/**
 * Agrupa comandos que compartilham a mesma propriedade 'group'
 * @param {Array} commands - Lista de comandos de uma categoria
 * @returns {Array} - Lista de grupos de comandos
 */
function groupRelatedCommands(commands) {
  const groupedCommands = [];
  const groups = {};
  
  // Primeiro, separa comandos por grupo
  for (const cmd of commands) {
    if (cmd.group) {
      if (!groups[cmd.group]) {
        groups[cmd.group] = [];
      }
      groups[cmd.group].push(cmd);
    } else {
      // Comandos sem grupo são tratados individualmente
      groupedCommands.push([cmd]);
    }
  }
  
  // Adiciona os grupos de comandos à lista final
  for (const groupName in groups) {
    if (groups[groupName].length > 0) {
      // Ordena comandos dentro do grupo pelo nome
      groups[groupName].sort((a, b) => a.name.localeCompare(b.name));
      groupedCommands.push(groups[groupName]);
    }
  }
  
  return groupedCommands;
}

/**
 * Ordena comandos conforme a ordem definida em COMMAND_ORDER
 * @param {Array} commands - Lista de comandos ou grupos de comandos
 * @returns {Array} - Lista ordenada
 */
function sortCommands(commands) {
  return commands.sort((a, b) => {
    // Obtém o primeiro comando de cada grupo (ou o próprio comando se for individual)
    const cmdA = Array.isArray(a) ? a[0] : a;
    const cmdB = Array.isArray(b) ? b[0] : b;
    
    const indexA = COMMAND_ORDER.indexOf(cmdA.name);
    const indexB = COMMAND_ORDER.indexOf(cmdB.name);
    
    // Se ambos estão na lista de ordenação, usa a posição na lista
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    // Se apenas um está na lista, este vem primeiro
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    
    // Caso contrário, usa ordem alfabética
    return cmdA.name.localeCompare(cmdB.name);
  });
}

/**
 * Formata um grupo de comandos para exibição no menu
 * @param {Array} cmdGroup - Grupo de comandos relacionados
 * @param {string} prefix - Prefixo de comando
 * @returns {string} - String formatada do grupo de comandos
 */
function formatCommandGroup(cmdGroup, prefix) {
  // Usando o primeiro comando para a descrição
  const mainCmd = cmdGroup[0];
  
  // Formata os nomes de comando com prefixo
  const cmdNames = cmdGroup.map(cmd => {
    let cmdText = `${prefix}${cmd.name}`;
    
    // Adiciona aliases se disponíveis
    if (cmd.aliases && Array.isArray(cmd.aliases) && cmd.aliases.length > 0) {
      cmdText += `, ${prefix}${cmd.aliases.join(`, ${prefix}`)}`;
    }
    
    return cmdText;
  });
  
  // Junta todos os nomes de comando
  let result = `• *${cmdNames.join(', ')}*`;
  
  // Adiciona reação se disponível no comando principal
  if (mainCmd.reactions && mainCmd.reactions.trigger) {
    result += ` (${mainCmd.reactions.trigger})`;
  }
  
  // Adiciona descrição do comando principal
  if (mainCmd.description) {
    result += `: ${mainCmd.description}`;
  }
  
  return result;
}

/**
 * Formata comando individual para exibição no menu
 * @param {Object} cmd - Objeto de comando
 * @param {string} prefix - Prefixo de comando
 * @returns {string} - String de comando formatada
 */
function formatSingleCommand(cmd, prefix) {
  let result = `• *${prefix}${cmd.name}*`;
  
  // Adiciona aliases se disponíveis
  if (cmd.aliases && Array.isArray(cmd.aliases) && cmd.aliases.length > 0) {
    result += `, *${prefix}${cmd.aliases.join(`*, *${prefix}`)}*`;
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
    const customCommands = group ? (await database.getCustomCommands(group.id)).filter(cmd => cmd.active && !cmd.deleted) :  [];
    
    // Lê o cabeçalho do menu
    const header = await readMenuHeader();
    
    // Agrupa comandos fixos por categoria
    const categorizedCommands = groupCommandsByCategory(fixedCommands);
    
    // Define o prefixo do comando
    const prefix = group && group.prefix ? group.prefix : bot.prefix;
    
    // Constrói mensagem
    let menuText = "🤖 *Comandos Ravenabot*🐦‍⬛\n";
    if(!group){
      menuText += `> _PV da *${bot.id}*_\n`;
    } else {
      menuText += `> _Grupo *${group.name}*_\n`;
    }
    menuText += header + '\n';
    
    // 1. Comandos Personalizados
    // Muita poluição
    /*
    if (customCommands.length > 0) {
      menuText += `📋 *Exclusivos do grupo _${group.name}_:*\n`;
      for (const cmd of customCommands) {
        let cmdText = `• *${prefix}${cmd.startsWith}*`;
        if (cmd.reactions && cmd.reactions.trigger) {
          cmdText += ` (${cmd.reactions.trigger})`;
        }
        menuText += `${cmdText}\n`;
      }
      menuText += '\n';
    }
    */
    
    
    // 2. Comandos Fixos por categoria
    // Processa cada categoria na ordem definida em CATEGORY_EMOJIS
    for (const category in CATEGORY_EMOJIS) {
      const commands = categorizedCommands[category] || [];
      if (commands.length === 0) continue;
      
      // Adiciona cabeçalho da categoria com emoji
      const emoji = CATEGORY_EMOJIS[category];
      let nomeCategoria = category.charAt(0).toUpperCase() + category.slice(1);
      if(nomeCategoria.length < 4){
        nomeCategoria = nomeCategoria.toUpperCase();
      }
      menuText += `\n${emoji} *${nomeCategoria}:*\n`;
      
      // Agrupa comandos relacionados
      const groupedCommands = groupRelatedCommands(commands);
      
      // Ordena conforme COMMAND_ORDER
      const sortedGroups = sortCommands(groupedCommands);
      
      // Formata cada grupo de comandos
      for (const cmdGroup of sortedGroups) {
        if (Array.isArray(cmdGroup) && cmdGroup.length > 1) {
          // Grupo de comandos relacionados
          menuText += `${formatCommandGroup(cmdGroup, prefix)}\n`;
        } else {
          // Comando individual
          const cmd = Array.isArray(cmdGroup) ? cmdGroup[0] : cmdGroup;
          menuText += `${formatSingleCommand(cmd, prefix)}\n`;
        }
      }
    }
    
    // 3. Comandos de gerenciamento
    // Obtém comandos de gerenciamento dinamicamente
    const managementCommands = bot.eventHandler.commandHandler.management.getManagementCommands();

    // Ordena os comandos: primeiro os prioritários, depois os demais em ordem alfabética
    const sortedCmdNames = Object.keys(managementCommands).sort((a, b) => {
      const indexA = COMMAND_ORDER.indexOf(a);
      const indexB = COMMAND_ORDER.indexOf(b);
      
      // Se ambos estão na lista de prioridade, usa a posição na lista
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // Se apenas um está na lista, este vem primeiro
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // Caso contrário, usa ordem alfabética
      return a.localeCompare(b);
    });

    menuText += '\n⚙️ *Comandos de Gerenciamento:*\n';
    // Adiciona cada comando formatado ao menu
    for (const cmdName of sortedCmdNames) {
      const cmdInfo = managementCommands[cmdName];
      menuText += `• *${prefix}g-${cmdName}*: ${cmdInfo.description}\n`;
    }
    
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

/**
 * Envia uma lista de comandos de gerenciamento disponíveis
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com a lista de comandos de gerenciamento
 */
async function sendManagementCommandList(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    logger.debug(`Enviando lista de comandos de gerenciamento para ${chatId}`);
    
    // Lê o cabeçalho do menu
    const header = await readMenuHeader();
    
    // Define o prefixo do comando
    const prefix = group && group.prefix ? group.prefix : bot.prefix;
    
    // Constrói mensagem
    let menuText = header + '\n\n';
    menuText += '⚙️ *Comandos de Gerenciamento:*\n';
    
    // Obtém comandos de gerenciamento dinamicamente
    const managementCommands = bot.eventHandler.commandHandler.management.getManagementCommands();
    
    
    // Ordena os comandos: primeiro os prioritários, depois os demais em ordem alfabética
    const sortedCmdNames = Object.keys(managementCommands).sort((a, b) => {
      const indexA = COMMAND_ORDER.indexOf(a);
      const indexB = COMMAND_ORDER.indexOf(b);
      
      // Se ambos estão na lista de prioridade, usa a posição na lista
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // Se apenas um está na lista, este vem primeiro
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // Caso contrário, usa ordem alfabética
      return a.localeCompare(b);
    });
    
    // Adiciona cada comando formatado ao menu
    for (const cmdName of sortedCmdNames) {
      const cmdInfo = managementCommands[cmdName];
      menuText += `• *${prefix}g-${cmdName}*: ${cmdInfo.description}\n`;
    }
    
    // Retorna a mensagem com o menu de gerenciamento
    return new ReturnMessage({
      chatId: chatId,
      content: menuText
    });
  } catch (error) {
    logger.error('Erro ao enviar lista de comandos de gerenciamento:', error);
    const chatId = message.group || message.author;
    
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao recuperar lista de comandos de gerenciamento. Por favor, tente novamente.'
    });
  }
}

/**
 * Envia uma lista de comandos personalizados do grupo
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com a lista de comandos personalizados
 */
async function sendGroupCommandList(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Verifica se está em um grupo
    if (!group) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    logger.debug(`Enviando lista de comandos personalizados para o grupo ${group.id}`);
    
    // Obtém comandos personalizados para este grupo
    const customCommands = (await database.getCustomCommands(group.id)).filter(cmd => cmd.active && !cmd.deleted);
    
    // Verifica se existem comandos personalizados
    if (customCommands.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: '📋 *Comandos Personalizados*\n\nNenhum comando personalizado foi criado para este grupo ainda.\n\nUse `!g-addCmd` respondendo a uma mensagem para criar comandos personalizados.'
      });
    }
    
    // Define o prefixo do comando
    const prefix = group.prefix || bot.prefix;
    
    // Constrói mensagem
    let menuText = '📋 *Comandos Personalizados do Grupo*\n\n';
    
    // Ordena comandos por nome
    const sortedCommands = [...customCommands].sort((a, b) => {
      return a.startsWith.localeCompare(b.startsWith);
    });
    
    // Adiciona cada comando personalizado
    for (const cmd of sortedCommands) {
      let cmdText = `• *${prefix}${cmd.startsWith}*`;
      
      // Adiciona reação se disponível
      if (cmd.react) {
        cmdText += ` (${cmd.react})`;
      } else if (cmd.reactions && cmd.reactions.trigger) {
        cmdText += ` (${cmd.reactions.trigger})`;
      }
      
      // Adiciona contagem de uso, se disponível
      if (cmd.count) {
        cmdText += ` [Usado ${cmd.count} vezes]`;
      }
      
      // Adiciona informação sobre respostas
      if (cmd.responses && cmd.responses.length > 0) {
        cmdText += ` - ${cmd.responses.length} resposta(s)`;
        
        // Verifica se é envio de todas as respostas
        if (cmd.sendAllResponses) {
          cmdText += ' (envia todas)';
        }
      }
      
      menuText += `${cmdText}\n`;
    }
    
    // Adiciona instruções para gerenciamento
    menuText += '\n*Gerenciamento de Comandos:*\n';
    menuText += `• Use *${prefix}g-addCmd* respondendo a uma mensagem para criar um novo comando\n`;
    menuText += `• Use *${prefix}g-addCmdReply* para adicionar mais respostas a um comando\n`;
    menuText += `• Use *${prefix}g-delCmd* para excluir um comando\n`;
    
    // Retorna a mensagem com os comandos personalizados
    return new ReturnMessage({
      chatId: chatId,
      content: menuText
    });
  } catch (error) {
    logger.error('Erro ao enviar lista de comandos personalizados:', error);
    const chatId = message.group || message.author;
    
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao recuperar lista de comandos personalizados. Por favor, tente novamente.'
    });
  }
}

// Criar array de comandos usando a classe Command
const commands = [
  new Command({
    name: 'cmd',
    description: 'Mostra todos os comandos disponíveis',
    category: "geral",
    group: "menu",
    method: async (bot, message, args, group) => {
      return await sendCommandList(bot, message, args, group);
    }
  }),
  new Command({
    name: 'comandos',
    description: 'Mostra todos os comandos disponíveis',
    category: "geral",
    group: "menu",
    hidden: true,
    method: async (bot, message, args, group) => {
      return await sendCommandList(bot, message, args, group);
    }
  }),
  
  new Command({
    name: 'menu',
    category: "geral",
    group: "menu",
    description: 'Mostra todos os comandos disponíveis',
    method: async (bot, message, args, group) => {
      return await sendCommandList(bot, message, args, group);
    }
  }),
  new Command({
    name: 'cmd-gerenciamento',
    description: 'Mostra comandos de gerenciamento do grupo',
    category: "geral",
    group: "cmdGer",
    method: async (bot, message, args, group) => {
      return await sendManagementCommandList(bot, message, args, group);
    }
  }),
  
  new Command({
    name: 'cmd-g',
    description: 'Mostra comandos de gerenciamento do grupo',
    category: "geral",
    group: "cmdGer",
    hidden: true, // Não aparece no menu principal, pois é um alias
    method: async (bot, message, args, group) => {
      return await sendManagementCommandList(bot, message, args, group);
    }
  }),
  
  new Command({
    name: 'cmd-grupo',
    description: 'Mostra comandos personalizados do grupo',
    category: "geral",
    method: async (bot, message, args, group) => {
      return await sendGroupCommandList(bot, message, args, group);
    }
  })
];

module.exports = { commands };