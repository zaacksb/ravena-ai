// Cria um novo arquivo: src/functions/GroupCommands.js

const path = require('path');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');

const logger = new Logger('group-commands');
const database = Database.getInstance();

logger.info('Módulo GroupCommands carregado');

const commands = [
  {
    name: 'atencao',
    description: 'Menciona todos os membros do grupo silenciosamente',
    category: 'group',
    reactions: {
      before: "📢",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await mentionAllMembers(bot, message, args, group);
    }
  },
  {
    name: 'galera',
    description: 'Menciona todos os membros do grupo silenciosamente',
    category: 'group',
    aliasFor: 'atencao',
    reactions: {
      before: "📢",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await mentionAllMembers(bot, message, args, group);
    }
  },
  {
    name: 'ignorar',
    description: 'Alterna ser ignorado pelas menções de grupo',
    category: 'group',
    reactions: {
      before: "🔇",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await toggleIgnore(bot, message, args, group);
    }
  },
  {
    name: 'apagar',
    description: 'Apaga a mensagem do bot quando usado em resposta a ela',
    category: 'group',
    needsQuotedMsg: true,
    reactions: {
      before: "🗑️",
      after: "✅"
    },
    method: async (bot, message, args, group) => {
      await apagarMensagem(bot, message, args, group);
    }
  }
];

/**
 * Menciona todos os membros em um grupo
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 */
async function mentionAllMembers(bot, message, args, group) {
  try {
    if (!message.group) {
      await bot.sendMessage(message.author, 'Este comando só pode ser usado em grupos.');
      return;
    }
    
    // Obtém o chat para acessar participantes
    const chat = await message.origin.getChat();
    if (!chat.isGroup) {
      await bot.sendMessage(message.group, 'Este comando só pode ser usado em grupos.');
      return;
    }
    
    // Obtém usuários ignorados para este grupo
    const ignoredUsers = group.ignoredUsers || [];
    
    // Filtra usuários ignorados
    const participants = chat.participants.filter(
      participant => !ignoredUsers.includes(participant.id._serialized)
    );
    
    if (participants.length === 0) {
      await bot.sendMessage(message.group, 'Nenhum membro para mencionar.');
      return;
    }
    
    // Cria array de menções para todos os participantes
    const mentions = [];
    for (const participant of participants) {
      mentions.push(participant.id._serialized);
    }
    
    // Cria texto da mensagem (de args ou padrão)
    const messageText = args.length > 0 ? 
      args.join(' ') : 
      '🚨 Atenção pessoal! 🚨';
    
    // Envia mensagem com menções
    await bot.client.sendMessage(message.group, messageText, {
      mentions: mentions
    });
    
    logger.info(`Mencionados ${mentions.length} membros no grupo ${message.group}`);
  } catch (error) {
    logger.error('Erro ao mencionar membros do grupo:', error);
    await bot.sendMessage(message.group, 'Erro ao mencionar membros do grupo. Por favor, tente novamente.');
  }
}

/**
 * Alterna ser ignorado por menções de grupo
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 */
async function toggleIgnore(bot, message, args, group) {
  try {
    if (!message.group) {
      await bot.sendMessage(message.author, 'Este comando só pode ser usado em grupos.');
      return;
    }
    
    // Inicializa array de usuários ignorados se não existir
    if (!group.ignoredUsers) {
      group.ignoredUsers = [];
    }
    
    const userIndex = group.ignoredUsers.indexOf(message.author);
    
    if (userIndex === -1) {
      // Adiciona usuário à lista de ignorados
      group.ignoredUsers.push(message.author);
      await database.saveGroup(group);
      await bot.sendMessage(message.group, 'Você agora será ignorado nas menções de grupo.', {
        quotedMessageId: message.origin.id._serialized
      });
    } else {
      // Remove usuário da lista de ignorados
      group.ignoredUsers.splice(userIndex, 1);
      await database.saveGroup(group);
      await bot.sendMessage(message.group, 'Você agora será incluído nas menções de grupo.', {
        quotedMessageId: message.origin.id._serialized
      });
    }
    
    logger.info(`Status de ignorar alternado para usuário ${message.author} no grupo ${message.group}`);
  } catch (error) {
    logger.error('Erro ao alternar status de ignorar:', error);
    await bot.sendMessage(message.group, 'Erro ao atualizar seu status de ignorar. Por favor, tente novamente.');
  }
}

/**
 * Apaga a mensagem do bot quando usado em resposta a ela
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 */
async function apagarMensagem(bot, message, args, group) {
  try {
    // Obtém a mensagem citada
    const quotedMsg = await message.origin.getQuotedMessage();
    
    if (!quotedMsg) {
      logger.debug('Comando apagar usado sem mensagem citada');
      return;
    }
    
    // Verifica se a mensagem citada é do bot
    const botNumber = bot.client.info.wid._serialized;
    const quotedSender = quotedMsg.author || quotedMsg.from;
    
    if (quotedSender !== botNumber) {
      // Se a mensagem não for do bot, verifica se o bot é admin do grupo
      if (message.group) {
        try {
          // Obtém informações do chat
          const chat = await message.origin.getChat();
          
          // Verifica se o bot é admin
          if (chat.isGroup) {
            const participants = chat.participants || [];
            const botParticipant = participants.find(p => p.id._serialized === botNumber);
            
            if (botParticipant && botParticipant.isAdmin) {
              // Bot é admin, pode apagar mensagens de outros
              logger.info(`Tentando apagar mensagem de outro usuário como admin: ${quotedSender}`);
              await quotedMsg.delete(true);
              
              // Reage com emoji de sucesso
              try {
                await message.origin.react("✅");
              } catch (reactError) {
                logger.error('Erro ao aplicar reação de sucesso:', reactError);
              }
              
              // Apaga também o comando !apagar
              try {
                await message.origin.delete(true);
              } catch (deleteError) {
                logger.error('Erro ao apagar mensagem de comando:', deleteError);
              }
              
              return;
            }
          }
        } catch (chatError) {
          logger.error('Erro ao verificar se bot é admin:', chatError);
        }
      }
      
      // Se chegou aqui, ou não está em grupo ou bot não é admin
      await bot.sendMessage(message.group || message.author, 'Só posso apagar minhas próprias mensagens ou mensagens de outros se eu for admin do grupo.');
      return;
    }
    
    // Tenta apagar a mensagem do bot
    try {
      await quotedMsg.delete(true);
      logger.info('Mensagem do bot apagada com sucesso');
      
      // Reage com emoji de sucesso
      try {
        await message.origin.react("✅");
      } catch (reactError) {
        logger.error('Erro ao aplicar reação de sucesso:', reactError);
      }
      
      // Apaga também o comando !apagar
      try {
        await message.origin.delete(true);
      } catch (deleteError) {
        logger.error('Erro ao apagar mensagem de comando:', deleteError);
      }
    } catch (error) {
      logger.error('Erro ao apagar mensagem:', error);
      
      // Reage com emoji de erro
      try {
        await message.origin.react("❌");
      } catch (reactError) {
        logger.error('Erro ao aplicar reação de erro:', reactError);
      }
      
      // Envia mensagem de erro apenas em grupos (em privado é desnecessário)
      if (message.group) {
        await bot.sendMessage(message.group, 'Não foi possível apagar a mensagem. Verifique se tenho permissões necessárias.');
      }
    }
  } catch (error) {
    logger.error('Erro geral ao apagar mensagem:', error);
  }
}

// Registra os comandos sendo exportados
logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };