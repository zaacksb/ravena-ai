// src/functions/ListCommands.js

const path = require('path');
const fs = require('fs').promises;
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');

const logger = new Logger('list-commands');
const database = Database.getInstance();

// Emoji numbers for reactions
const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

logger.info('Módulo ListCommands carregado');

const commands = [
  {
    name: 'listas',
    description: 'Mostra as listas disponíveis no grupo',
    category: 'group',
    reactions: {
      before: "📋",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await showLists(bot, message, args, group);
    }
  },
  {
    name: 'll',
    description: 'Alias para comando listas',
    category: 'group',
    reactions: {
      before: "📋",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await showLists(bot, message, args, group);
    }
  },
  {
    name: 'lc',
    description: 'Cria uma nova lista',
    category: 'group',
    reactions: {
      before: "➕",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await createList(bot, message, args, group);
    }
  },
  {
    name: 'lct',
    description: 'Cria uma nova lista com título',
    category: 'group',
    reactions: {
      before: "➕",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await createListWithTitle(bot, message, args, group);
    }
  },
  {
    name: 'ld',
    description: 'Deleta uma lista',
    category: 'group',
    reactions: {
      before: "🗑️",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await deleteList(bot, message, args, group);
    }
  },
  {
    name: 'le',
    description: 'Entra em uma lista',
    category: 'group',
    reactions: {
      before: "➡️",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await joinList(bot, message, args, group);
    }
  },
  {
    name: 'ls',
    description: 'Sai de uma lista',
    category: 'group',
    reactions: {
      before: "⬅️",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await leaveList(bot, message, args, group);
    }
  },
  {
    name: 'lt',
    description: 'Define título de uma lista',
    category: 'group',
    reactions: {
      before: "✏️",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await setListTitle(bot, message, args, group);
    }
  },
  {
    name: 'lr',
    description: 'Remove um usuário de uma lista (admin only)',
    category: 'group',
    reactions: {
      before: "❌",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await removeFromList(bot, message, args, group);
    }
  }
];

/**
 * Process reactions to join or leave lists
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} reaction - Reaction data
 * @returns {Promise<boolean>} True if reaction was processed
 */
async function processListReaction(bot, reaction) {
  try {
    // Check if reaction is a number emoji
    const emojiIndex = NUMBER_EMOJIS.indexOf(reaction.emoji);
    if (emojiIndex === -1) return false;
    
    // Get the original message
    const message = await bot.client.getMessage(reaction.messageId);
    if (!message) return false;
    
    // Check if the message is from the bot and contains lists
    if (message.fromMe && message.body.startsWith('*Listas disponíveis*')) {
      // Get the chat
      const chat = await message.getChat();
      if (!chat.isGroup) return false;
      
      // Get group data
      const group = await bot.eventHandler.getOrCreateGroup(chat.id._serialized);
      
      // Get lists for this group
      const lists = await getGroupLists(chat.id._serialized);
      
      // Check if the list index exists
      if (emojiIndex >= lists.length) return false;
      
      // Get the list at this index
      const list = lists[emojiIndex];
      
      // Get user info
      const user = await message.getContact();
      const userName = user.pushname || user.name || 'Usuário';
      const userId = user.id._serialized;
      
      // Check if user is already in the list
      const isInList = list.members.some(member => member.id === userId);
      
      if (isInList) {
        // Leave the list
        list.members = list.members.filter(member => member.id !== userId);
        await saveGroupLists(chat.id._serialized, lists);
        
        // Notify user
        await bot.sendMessage(chat.id._serialized, `${userName} saiu da lista "${list.name}"`);
      } else {
        // Join the list
        list.members.push({
          id: userId,
          name: userName,
          joinedAt: Date.now()
        });
        await saveGroupLists(chat.id._serialized, lists);
        
        // Notify user
        await bot.sendMessage(chat.id._serialized, `${userName} entrou na lista "${list.name}"`);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error processing list reaction:', error);
    return false;
  }
}

/**
 * Gets lists for a group
 * @param {string} groupId - Group ID
 * @returns {Promise<Array>} Lists array
 */
async function getGroupLists(groupId) {
  try {
    const listsDir = path.join(database.databasePath, 'lists');
    
    // Create lists directory if it doesn't exist
    try {
      await fs.mkdir(listsDir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
    }
    
    const listsPath = path.join(listsDir, `${groupId}.json`);
    
    try {
      // Try to read existing lists file
      const data = await fs.readFile(listsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist or can't be parsed, return empty array
      return [];
    }
  } catch (error) {
    logger.error(`Error getting lists for group ${groupId}:`, error);
    return [];
  }
}

/**
 * Saves lists for a group
 * @param {string} groupId - Group ID
 * @param {Array} lists - Lists array
 * @returns {Promise<boolean>} Success status
 */
async function saveGroupLists(groupId, lists) {
  try {
    const listsDir = path.join(database.databasePath, 'lists');
    
    // Create lists directory if it doesn't exist
    try {
      await fs.mkdir(listsDir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
    }
    
    const listsPath = path.join(listsDir, `${groupId}.json`);
    
    // Save lists to file
    await fs.writeFile(listsPath, JSON.stringify(lists, null, 2), 'utf8');
    
    return true;
  } catch (error) {
    logger.error(`Error saving lists for group ${groupId}:`, error);
    return false;
  }
}

/**
 * Gets user name with possible nickname
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} group - Group data
 * @param {string} userId - User ID
 * @returns {Promise<string>} User's name or nickname
 */
async function getUserDisplayName(bot, group, userId) {
  try {
    // Check if user has a nickname in this group
    if (group.nicks && Array.isArray(group.nicks)) {
      const nickData = group.nicks.find(nick => nick.numero === userId);
      if (nickData && nickData.apelido) {
        return nickData.apelido;
      }
    }
    
    // Get contact info as fallback
    try {
      const contact = await bot.client.getContactById(userId);
      return contact.pushname || contact.name || 'Usuário';
    } catch (error) {
      logger.error(`Error getting contact for ${userId}:`, error);
      return 'Usuário';
    }
  } catch (error) {
    logger.error(`Error getting display name for ${userId}:`, error);
    return 'Usuário';
  }
}

/**
 * Shows all lists in a group
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} message - Message data
 * @param {Array} args - Command arguments
 * @param {Object} group - Group data
 */
async function showLists(bot, message, args, group) {
  try {
    if (!message.group) {
      await bot.sendMessage(message.author, 'Este comando só pode ser usado em grupos.');
      return;
    }
    
    // Get lists for this group
    const lists = await getGroupLists(message.group);
    
    if (lists.length === 0) {
      await bot.sendMessage(message.group, 'Não há listas criadas neste grupo. Use !lc <nome> para criar uma lista.');
      return;
    }
    
    // Format the message with lists
    let listsMessage = '*Listas disponíveis*\n\n';
    
    for (let i = 0; i < lists.length; i++) {
      const list = lists[i];
      const emoji = i < NUMBER_EMOJIS.length ? NUMBER_EMOJIS[i] : `${i+1}.`;
      
      // Format list title or name
      const listTitle = list.title || list.name;
      
      listsMessage += `${emoji} *${listTitle}*`;
      
      // Add member count
      const memberCount = list.members ? list.members.length : 0;
      listsMessage += ` (${memberCount} membro${memberCount !== 1 ? 's' : ''})\n`;
      
      // Add members if any
      if (memberCount > 0) {
        listsMessage += 'Membros: ';
        const memberNames = [];
        
        for (const member of list.members) {
          // Get display name (with possible nickname)
          const displayName = await getUserDisplayName(bot, group, member.id);
          memberNames.push(displayName);
        }
        
        listsMessage += memberNames.join(', ');
        listsMessage += '\n';
      }
      
      listsMessage += '\n';
    }
    
    // Add instructions
    listsMessage += 'Reaja com o emoji do número para entrar/sair de uma lista.\n';
    listsMessage += 'Comandos: !le <lista> (entrar), !ls <lista> (sair)';
    
    // Send the message
    const sentMessage = await bot.sendMessage(message.group, listsMessage);
    
    // Log the sent message ID for reference
    logger.debug(`Lists message sent with ID: ${sentMessage.id._serialized}`);
  } catch (error) {
    logger.error('Error showing lists:', error);
    await bot.sendMessage(message.group || message.author, 'Erro ao mostrar listas. Por favor, tente novamente.');
  }
}

/**
 * Creates a new list
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} message - Message data
 * @param {Array} args - Command arguments
 * @param {Object} group - Group data
 */
async function createList(bot, message, args, group) {
  try {
    if (!message.group) {
      await bot.sendMessage(message.author, 'Este comando só pode ser usado em grupos.');
      return;
    }
    
    if (args.length === 0) {
      await bot.sendMessage(message.group, 'Por favor, forneça pelo menos um nome de lista. Exemplo: !lc lista1 lista2');
      return;
    }
    
    // Get lists for this group
    let lists = await getGroupLists(message.group);
    
    // Create each list
    const createdLists = [];
    
    for (const arg of args) {
      const listName = arg.trim();
      
      // Skip empty names
      if (!listName) continue;
      
      // Check if list already exists
      const existingList = lists.find(list => list.name.toLowerCase() === listName.toLowerCase());
      
      if (existingList) {
        // Skip existing lists
        await bot.sendMessage(message.group, `Lista "${listName}" já existe.`);
        continue;
      }
      
      // Create new list
      const newList = {
        name: listName,
        title: null,
        createdAt: Date.now(),
        createdBy: message.author,
        members: []
      };
      
      lists.push(newList);
      createdLists.push(listName);
    }
    
    // Save updated lists
    if (createdLists.length > 0) {
      await saveGroupLists(message.group, lists);
      
      // Notify about created lists
      await bot.sendMessage(message.group, `Lista${createdLists.length > 1 ? 's' : ''} criada${createdLists.length > 1 ? 's' : ''}: ${createdLists.join(', ')}`);
      
      // Show all lists
      await showLists(bot, message, [], group);
    }
  } catch (error) {
    logger.error('Error creating list:', error);
    await bot.sendMessage(message.group || message.author, 'Erro ao criar lista. Por favor, tente novamente.');
  }
}

/**
 * Creates a new list with title
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} message - Message data
 * @param {Array} args - Command arguments
 * @param {Object} group - Group data
 */
async function createListWithTitle(bot, message, args, group) {
  try {
    if (!message.group) {
      await bot.sendMessage(message.author, 'Este comando só pode ser usado em grupos.');
      return;
    }
    
    if (args.length < 2) {
      await bot.sendMessage(message.group, 'Por favor, forneça o nome da lista e o título. Exemplo: !lct lista1 Título da Lista');
      return;
    }
    
    // Get list name and title
    const listName = args[0].trim();
    const listTitle = args.slice(1).join(' ');
    
    // Get lists for this group
    let lists = await getGroupLists(message.group);
    
    // Check if list already exists
    const existingList = lists.find(list => list.name.toLowerCase() === listName.toLowerCase());
    
    if (existingList) {
      await bot.sendMessage(message.group, `Lista "${listName}" já existe. Use !lt ${listName} ${listTitle} para atualizar o título.`);
      return;
    }
    
    // Create new list with title
    const newList = {
      name: listName,
      title: listTitle,
      createdAt: Date.now(),
      createdBy: message.author,
      members: []
    };
    
    lists.push(newList);
    
    // Save updated lists
    await saveGroupLists(message.group, lists);
    
    // Notify about created list
    await bot.sendMessage(message.group, `Lista criada: ${listName} (${listTitle})`);
    
    // Show all lists
    await showLists(bot, message, [], group);
  } catch (error) {
    logger.error('Error creating list with title:', error);
    await bot.sendMessage(message.group || message.author, 'Erro ao criar lista. Por favor, tente novamente.');
  }
}

/**
 * Deletes a list
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} message - Message data
 * @param {Array} args - Command arguments
 * @param {Object} group - Group data
 */
async function deleteList(bot, message, args, group) {
  try {
    if (!message.group) {
      await bot.sendMessage(message.author, 'Este comando só pode ser usado em grupos.');
      return;
    }
    
    if (args.length === 0) {
      await bot.sendMessage(message.group, 'Por favor, forneça pelo menos um nome de lista para excluir. Exemplo: !ld lista1 lista2');
      return;
    }
    
    // Get lists for this group
    let lists = await getGroupLists(message.group);
    
    // Delete each list
    const deletedLists = [];
    
    for (const arg of args) {
      const listName = arg.trim();
      
      // Skip empty names
      if (!listName) continue;
      
      // Find list index
      const listIndex = lists.findIndex(list => list.name.toLowerCase() === listName.toLowerCase());
      
      if (listIndex === -1) {
        // Skip non-existent lists
        await bot.sendMessage(message.group, `Lista "${listName}" não encontrada.`);
        continue;
      }
      
      // Remove list
      lists.splice(listIndex, 1);
      deletedLists.push(listName);
    }
    
    // Save updated lists
    if (deletedLists.length > 0) {
      await saveGroupLists(message.group, lists);
      
      // Notify about deleted lists
      await bot.sendMessage(message.group, `Lista${deletedLists.length > 1 ? 's' : ''} excluída${deletedLists.length > 1 ? 's' : ''}: ${deletedLists.join(', ')}`);
      
      // Show remaining lists if any
      if (lists.length > 0) {
        await showLists(bot, message, [], group);
      }
    }
  } catch (error) {
    logger.error('Error deleting list:', error);
    await bot.sendMessage(message.group || message.author, 'Erro ao excluir lista. Por favor, tente novamente.');
  }
}

/**
 * Joins a list
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} message - Message data
 * @param {Array} args - Command arguments
 * @param {Object} group - Group data
 */
async function joinList(bot, message, args, group) {
  try {
    if (!message.group) {
      await bot.sendMessage(message.author, 'Este comando só pode ser usado em grupos.');
      return;
    }
    
    if (args.length === 0) {
      await bot.sendMessage(message.group, 'Por favor, forneça o nome da lista para entrar. Exemplo: !le lista1');
      return;
    }
    
    const listName = args[0].trim();
    
    // Get lists for this group
    let lists = await getGroupLists(message.group);
    
    // Find the list
    const list = lists.find(list => list.name.toLowerCase() === listName.toLowerCase());
    
    if (!list) {
      await bot.sendMessage(message.group, `Lista "${listName}" não encontrada.`);
      return;
    }
    
    // Get user name
    let userName = 'Usuário';
    try {
      const contact = await message.origin.getContact();
      userName = contact.pushname || contact.name || 'Usuário';
      
      // Check if user has a nickname in this group
      if (group.nicks && Array.isArray(group.nicks)) {
        const nickData = group.nicks.find(nick => nick.numero === message.author);
        if (nickData && nickData.apelido) {
          userName = nickData.apelido;
        }
      }
    } catch (error) {
      logger.error('Error getting contact name:', error);
    }
    
    // Check if user is already in the list
    if (!list.members) list.members = [];
    
    const existingMember = list.members.find(member => member.id === message.author);
    
    if (existingMember) {
      await bot.sendMessage(message.group, `Você já está na lista "${list.title || list.name}".`);
      return;
    }
    
    // Add user to the list
    list.members.push({
      id: message.author,
      name: userName,
      joinedAt: Date.now()
    });
    
    // Save updated lists
    await saveGroupLists(message.group, lists);
    
    // Notify about joining
    await bot.sendMessage(message.group, `${userName} entrou na lista "${list.title || list.name}".`);
    
    // Show all lists
    await showLists(bot, message, [], group);
  } catch (error) {
    logger.error('Error joining list:', error);
    await bot.sendMessage(message.group || message.author, 'Erro ao entrar na lista. Por favor, tente novamente.');
  }
}

/**
 * Leaves a list
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} message - Message data
 * @param {Array} args - Command arguments
 * @param {Object} group - Group data
 */
async function leaveList(bot, message, args, group) {
  try {
    if (!message.group) {
      await bot.sendMessage(message.author, 'Este comando só pode ser usado em grupos.');
      return;
    }
    
    if (args.length === 0) {
      await bot.sendMessage(message.group, 'Por favor, forneça o nome da lista para sair. Exemplo: !ls lista1');
      return;
    }
    
    const listName = args[0].trim();
    
    // Get lists for this group
    let lists = await getGroupLists(message.group);
    
    // Find the list
    const list = lists.find(list => list.name.toLowerCase() === listName.toLowerCase());
    
    if (!list) {
      await bot.sendMessage(message.group, `Lista "${listName}" não encontrada.`);
      return;
    }
    
    // Get user name
    let userName = 'Usuário';
    try {
      const contact = await message.origin.getContact();
      userName = contact.pushname || contact.name || 'Usuário';
      
      // Check if user has a nickname in this group
      if (group.nicks && Array.isArray(group.nicks)) {
        const nickData = group.nicks.find(nick => nick.numero === message.author);
        if (nickData && nickData.apelido) {
          userName = nickData.apelido;
        }
      }
    } catch (error) {
      logger.error('Error getting contact name:', error);
    }
    
    // Check if user is in the list
    if (!list.members) list.members = [];
    
    const memberIndex = list.members.findIndex(member => member.id === message.author);
    
    if (memberIndex === -1) {
      await bot.sendMessage(message.group, `Você não está na lista "${list.title || list.name}".`);
      return;
    }
    
    // Remove user from the list
    list.members.splice(memberIndex, 1);
    
    // Save updated lists
    await saveGroupLists(message.group, lists);
    
    // Notify about leaving
    await bot.sendMessage(message.group, `${userName} saiu da lista "${list.title || list.name}".`);
    
    // Show all lists
    await showLists(bot, message, [], group);
  } catch (error) {
    logger.error('Error leaving list:', error);
    await bot.sendMessage(message.group || message.author, 'Erro ao sair da lista. Por favor, tente novamente.');
  }
}

/**
 * Sets the title of a list
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} message - Message data
 * @param {Array} args - Command arguments
 * @param {Object} group - Group data
 */
async function setListTitle(bot, message, args, group) {
  try {
    if (!message.group) {
      await bot.sendMessage(message.author, 'Este comando só pode ser usado em grupos.');
      return;
    }
    
    if (args.length < 2) {
      await bot.sendMessage(message.group, 'Por favor, forneça o nome da lista e o título. Exemplo: !lt lista1 Novo Título');
      return;
    }
    
    const listName = args[0].trim();
    const listTitle = args.slice(1).join(' ');
    
    // Get lists for this group
    let lists = await getGroupLists(message.group);
    
    // Find the list
    const list = lists.find(list => list.name.toLowerCase() === listName.toLowerCase());
    
    if (!list) {
      await bot.sendMessage(message.group, `Lista "${listName}" não encontrada.`);
      return;
    }
    
    // Update list title
    list.title = listTitle;
    
    // Save updated lists
    await saveGroupLists(message.group, lists);
    
    // Notify about title change
    await bot.sendMessage(message.group, `Título da lista "${listName}" atualizado para "${listTitle}".`);
    
    // Show all lists
    await showLists(bot, message, [], group);
  } catch (error) {
    logger.error('Error setting list title:', error);
    await bot.sendMessage(message.group || message.author, 'Erro ao definir título da lista. Por favor, tente novamente.');
  }
}

/**
 * Removes a user from a list (admin only)
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} message - Message data
 * @param {Array} args - Command arguments
 * @param {Object} group - Group data
 */
async function removeFromList(bot, message, args, group) {
  try {
    if (!message.group) {
      await bot.sendMessage(message.author, 'Este comando só pode ser usado em grupos.');
      return;
    }
    
    // Check if user is admin in the group
    const chat = await message.origin.getChat();
    const participants = chat.participants || [];
    const sender = participants.find(p => p.id._serialized === message.author);
    
    if (!sender || !sender.isAdmin) {
      await bot.sendMessage(message.group, 'Este comando só pode ser usado por administradores do grupo.');
      return;
    }
    
    if (args.length < 2) {
      await bot.sendMessage(message.group, 'Por favor, forneça o nome da lista e o número do participante. Exemplo: !lr lista1 5521987654321');
      return;
    }
    
    const listName = args[0].trim();
    let userIdentifier = args[1].trim();
    
    // Clean phone number (remove non-digits)
    userIdentifier = userIdentifier.replace(/\D/g, '');
    
    // Get lists for this group
    let lists = await getGroupLists(message.group);
    
    // Find the list
    const list = lists.find(list => list.name.toLowerCase() === listName.toLowerCase());
    
    if (!list) {
      await bot.sendMessage(message.group, `Lista "${listName}" não encontrada.`);
      return;
    }
    
    // Check if list has members
    if (!list.members || list.members.length === 0) {
      await bot.sendMessage(message.group, `A lista "${list.title || list.name}" não tem membros.`);
      return;
    }
    
    // Find the member by phone number
    const memberIndex = list.members.findIndex(member => 
      member.id.includes(userIdentifier) || (member.name && member.name.includes(userIdentifier))
    );
    
    if (memberIndex === -1) {
      await bot.sendMessage(message.group, `Usuário com número "${userIdentifier}" não encontrado na lista.`);
      return;
    }
    
    // Get member name before removal
    const memberName = list.members[memberIndex].name || 'Usuário';
    
    // Remove the member
    list.members.splice(memberIndex, 1);
    
    // Save updated lists
    await saveGroupLists(message.group, lists);
    
    // Notify about removal
    await bot.sendMessage(message.group, `${memberName} foi removido da lista "${list.title || list.name}" por um administrador.`);
    
    // Show all lists
    await showLists(bot, message, [], group);
  } catch (error) {
    logger.error('Error removing user from list:', error);
    await bot.sendMessage(message.group || message.author, 'Erro ao remover usuário da lista. Por favor, tente novamente.');
  }
}

// Export commands and reaction handler
module.exports = { 
  commands,
  processListReaction
};