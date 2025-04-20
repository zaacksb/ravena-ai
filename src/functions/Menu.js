// Atualiza o arquivo Menu.js na pasta src/functions

const path = require('path');
const Logger = require('../utils/Logger');
const fs = require('fs').promises;
const Database = require('../utils/Database');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');

const logger = new Logger('menu-commands');
const database = Database.getInstance();

/**
 * Emojis para as categorias de comandos
 * A ordem das chaves define a ordem de apresentação das categorias
 */
const CATEGORY_EMOJIS = {
  "geral": "📃",
  "grupo": "👥",
  "utilidades": "🛠️",
  "midia": "📱",
  "ia": "🤖",
  "downloaders": "📤",
  "jogos": "🎮",
  "cultura": "🍿",
  "áudio": "🔈",
  "tts": "🗣",
  "busca": "🔎",
  "listas": "📜",
  "arquivos": "📂",
  "general": "🖨️",
  "diversao": "🎮",
  "info": "ℹ️",
  "imagens": "🖼️",
  "resto": "❓",
};

/**
 * Ordem personalizada para comandos por nome
 * Os comandos não listados aparecem depois na ordem original
 */
const COMMAND_ORDER = ["cmd","doar","clima","news","apagar","atencao","ignorar","stt","traduzir","lembretes","lembrar","l-cancelar","s","sticker","sbg, stickerbg","removebg","distort","neon","oil","pixelate","sketch","ai","imagine","resumo","interagir","yt","sr","roletarussa","roletaranking","roll","d10","lol","valorant","wr","anime","imdb","volume","getaudio","getvoice","tts","tts-mulher","tts-homem","buscar","buscar-ig","gif","wiki","lastfm","listas","lc","lct","ld","le","ls","lt","lr","pastas","p-enviar","p-criar","p-baixar","p-excluir","g-ajuda","g-setName","g-addCmd","g-delCmd","g-setPrefixo","g-setBemvindo","g-setDespedida","g-cmdReact","g-cmdStartReact","g-filtro-palavra","g-filtro-links","g-filtro-nsfw","g-filtro-pessoa","g-info","g-enableCmd","g-disableCmd"];

/**
 * Lê o arquivo de cabeçalho do menu
 * @returns {Promise<string>} - Conteúdo do cabeçalho
 */
async function readMenuHeader() {
  try {
    const headerPath = path.join(process.cwd(), 'data', 'cmd_header');
    const headerContent = await fs.readFile(headerPath, 'utf8');
    return headerContent.trim();
  } catch (error) {
    logger.warn('Erro ao ler cabeçalho do menu:', error);
    return '*Menu de Comandos do Ravenabot*';
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
    const customCommands = group ? 
      (await database.getCustomCommands(group.id)).filter(cmd => cmd.active && !cmd.deleted) : 
      [];
    
    // Lê o cabeçalho do menu
    const header = await readMenuHeader();
    
    // Agrupa comandos fixos por categoria
    const categorizedCommands = groupCommandsByCategory(fixedCommands);
    
    // Define o prefixo do comando
    const prefix = group && group.prefix ? group.prefix : bot.prefix;
    
    // Constrói mensagem
    let menuText = header + '\n\n';
    
    // 1. Comandos Personalizados
    if (customCommands.length > 0) {
      menuText += '📋 *Comandos do Grupo:*\n';
      for (const cmd of customCommands) {
        let cmdText = `• *${prefix}${cmd.startsWith}*`;
        if (cmd.reactions && cmd.reactions.trigger) {
          cmdText += ` (${cmd.reactions.trigger})`;
        }
        menuText += `${cmdText}\n`;
      }
      menuText += '\n';
    }
    
    // 2. Comandos Fixos por categoria
    menuText += '📌 *Comandos Fixos:*\n';
    
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
    menuText += '\n⚙️ *Comandos de Gerenciamento:*\n';
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
    category: "geral",
    group: "menu",
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
  })
];

module.exports = { commands };