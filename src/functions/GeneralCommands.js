const path = require('path');
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const Database = require('../utils/Database');
const fs = require('fs').promises;

const logger = new Logger('general-commands');

const database = Database.getInstance();


// Define os métodos de comando separadamente
async function pingCommand(bot, message, args, group) {
  const chatId = message.group || message.author;

  const delayMsg = bot.getCurrentTimestamp() - (message.origin.timestamp ?? bot.getCurrentTimestamp());
  logger.debug(`Executando comando ping para ${chatId}`);
  
  return new ReturnMessage({
    chatId: chatId,
    content: `Pong! 🏓 _(${delayMsg}s)_`,
    options: {
      quotedMessageId: message.origin.id._serialized
    }
  });
}

async function grupaoCommand(bot, message, args, group){
  const chatId = message.group || message.author;
  const grupao = await bot.client.getChatById(bot.grupoInteracao);

  try{
    await grupao.addParticipants([message.author]);
  } catch(e){
    logger.error(`[grupaoCommand] Não consegui add '${message.author}' no grupão (${bot.grupoInteracao})`);
  }

  return new ReturnMessage({
    chatId: chatId,
    content: `Ok! Tentei de adicionar no grupão da ravena. Se não tiver sido adicionado, entre pelo link: ${bot.linkGrupao}`
  });

}

async function avisosCommand(bot, message, args, group){
  const chatId = message.group || message.author;
  const avisos = await bot.client.getChatById(bot.grupoAvisos);

  try{
    await avisos.addParticipants([message.author]);
  } catch(e){
    logger.error(`[avisosCommand] Não consegui add '${message.author}' no grupo de avisos (${bot.grupoAvisos})`);
  }

  return new ReturnMessage({
    chatId: chatId,
    content: `Ok! Tentei de adicionar no grupo de avisos da ravena. Se não tiver sido adicionado, entre pelo link: ${bot.linkAvisos}`
  });
}

async function goldCommand(bot, message, args, group) {
  const chatId = message.group || message.author;

  try {
    const goldPath = path.join(database.databasePath, 'textos', 'gold.txt');
    const goldContent = await fs.readFile(goldPath, 'utf8');

    return new ReturnMessage({
      chatId: chatId,
      content: goldContent.trim()
    });

  } catch (error) {
    logger.warn('Erro ao ler gold.txt:', error);
    return new ReturnMessage({
      chatId: chatId,
      content: `🔗 *Github:* https://github.com/moothz/ravena-ai`
    });
  }

}

async function codigoCommand(bot, message, args, group) {
  const chatId = message.group || message.author;

  try {
    const codigoPath = path.join(database.databasePath, 'textos', 'codigo.txt');
    const codigoContent = await fs.readFile(codigoPath, 'utf8');

    return new ReturnMessage({
      chatId: chatId,
      content: codigoContent.trim()
    });

  } catch (error) {
    logger.warn('Erro ao ler codigo.txt:', error);
    return new ReturnMessage({
      chatId: chatId,
      content: `🔗 *Github:* https://github.com/moothz/ravena-ai`
    });
  }

}


async function conviteCommand(bot, message, args, group) {
  const chatId = message.group || message.author;

  try{    
    const invitesHeaderPath = path.join(database.databasePath, 'textos', 'invites_header.txt');
    const headerConvite = await fs.readFile(invitesHeaderPath, 'utf8');
    const invitesFooterPath = path.join(database.databasePath, 'textos', 'invites_footer.txt');
    const footerConvite = await fs.readFile(invitesFooterPath, 'utf8');
    const invitesPosPath = path.join(database.databasePath, 'textos', 'invites_pos.txt');
    const posConvite = await fs.readFile(invitesPosPath, 'utf8');

    const todas = [
      new ReturnMessage({
        chatId: chatId,
        content: `${headerConvite}${footerConvite}\n\n${bot.rndString()}`
    })];

    if(posConvite.length > 5){
      todas.push(new ReturnMessage({
        chatId: chatId,
        content: posConvite, 
        delay: 1000
      })) 
    }

    return todas;
  } catch (error) {
    logger.warn('Erro ao ler invites_xxx.txt:', error);
    return [

    new ReturnMessage({
      chatId: chatId,
      content: `🐦‍⬛ Então você quer a *ravenabot* no seu grupo?
Pra começar, me envie o *LINK*, apenas o _LINK_ do seu grupo.
Se você enviar um convite tradicional, não vai adiantar de nada, pois não consigo aceitar por aqui.
Após o link, siga as instruções do bot, enviando uma mensagem explicando o motivo de querer o bot no seu grupo.`
    }),
    new ReturnMessage({
      chatId: chatId,
      content: posConvite, 
      delay: 1000
    })    

    ];
  }
}

async function diferencasCommand(bot, message, args, group) {
  const chatId = message.group || message.author;

  return new ReturnMessage({
    chatId: chatId,
    content: `Bem vindo à nova *ravena*!
Se tiver dúvidas, entre no *!grupao*

Aqui vai as principais diferenças pra antiga:

*No dia a dia:*
- Os comandos genéricos não existem mais (vocês mesmos podem criar no grupo)
- Os comandos de gerencia foram trocados por !g-xxx, envie !cmd-g para conhecê-los!
- Todos os comandos precisam de prefixo agora, então quando criar um comando, não coloque o "!" na frente do nome do comando
- O prefixo dos comandos pode ser alterado usando !g-setPrefixo
- O !stt, que transformar áudio em texto, agora roda local e não precisa mais de chave azure nenhuma
- Agora dá pra adicionar quantos canais de twitch, kick e youtube quiser em um grupo
- 

*Novos comandos legais*
- Pastas: É o _drive da ravena_! Guarde seus arquivos aqui e use comandos pra baixar todos de uma vez. Útil para grupos que precisam toda hora enviar documentos e outras coisas para membros novos.
- TTS com voz personalizada: Agora sintetizo as vozes local usando o AllSpeak, sendo o default a voz da ravena, mas podendo aprender a voz de outras pessoas também
- 

*De código:*
- O código está liberado e qualquer um pode contribuir pra novas funçoes: https://github.com/moothz/ravena-ai
- Foi 90% escrito por inteligência artificial _(Claude Sonnet 3.7)_
- A base de dados é compartilhada entre todas as ravenas agora
- Todas as ravenas rodam no mesmo processo
`
  });
}

/**
 * Define um apelido para o usuário em um grupo
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Mensagem formatada
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function apelidoCommand(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Se não há argumentos, mostrar o apelido atual
    if (args.length === 0) {
      const userNick = getUserNickname(group, message.author);
      if (userNick) {
        return new ReturnMessage({
          chatId: group.id,
          content: `Seu apelido atual é: *${userNick}*`,
          options: {
            quotedMessageId: message.origin.id._serialized
          }
        });
      } else {
        return new ReturnMessage({
          chatId: group.id,
          content: 'Você não tem um apelido definido.\nUse !apelido [apelido] para definir um.',
          options: {
            quotedMessageId: message.origin.id._serialized
          }
        });
      }
    }
    
    // Obter o apelido dos argumentos
    let nickname = args.join(' ');
    
    // Verificar o comprimento mínimo
    if (nickname.length < 2) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'O apelido deve ter pelo menos 2 caracteres.',
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    // Limitar a 20 caracteres
    if (nickname.length > 20) {
      nickname = nickname.substring(0, 20);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `O apelido foi limitado a 20 caracteres: *${nickname}*`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    // Inicializar nicks array se não existir
    if (!group.nicks) {
      group.nicks = [];
    }
    
    // Verificar se o usuário já tem um apelido
    const existingIndex = group.nicks.findIndex(nick => nick.numero === message.author);
    
    if (existingIndex !== -1) {
      // Atualizar apelido existente
      group.nicks[existingIndex].apelido = nickname;
    } else {
      // Adicionar novo apelido
      group.nicks.push({
        numero: message.author,
        apelido: nickname
      });
    }
    
    // Salvar grupo
    await database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Apelido definido: *${nickname}*`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
    });
  } catch (error) {
    logger.error('Erro ao definir apelido:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao definir apelido. Por favor, tente novamente.'
    });
  }
}

/**
 * Obtém o apelido de um usuário de um grupo
 * @param {Object} group - Dados do grupo
 * @param {string} userId - ID do usuário
 * @returns {string|null} - Apelido do usuário ou null se não definido
 */
function getUserNickname(group, userId) {
  if (!group || !group.nicks || !Array.isArray(group.nicks)) {
    return null;
  }
  
  const nickData = group.nicks.find(nick => nick.numero === userId);
  return nickData ? nickData.apelido : null;
}


// Criar array de comandos usando a classe Command
const commands = [
  new Command({
    name: 'ping',
    description: 'Verifica se o bot está online',
    category: "geral",
    hidden: "true",
    reactions: {
      before: "⏳",
      after: "✅"
    },
    method: pingCommand
  }),
  new Command({
    name: 'apelido',
    description: 'Define seu apelido no grupo',
    category: "grupo",
    method: apelidoCommand
  }), 


  new Command({
    name: 'diferenças',
    description: 'Exibe as diferenças para a ravena antiga',
    category: "geral",
    method: diferencasCommand
  }),
  
  new Command({
    name: 'grupao',
    description: 'Grupo de interação ravenabot',
    category: "geral",
    reactions: {
      before: "👨‍👨‍👧‍👦"
    },
    method: grupaoCommand
  }),
  new Command({
    name: 'avisos',
    description: 'Grupo de avisos ravenabot',
    category: "geral",
    reactions: {
      before: "📣"
    },
    method: avisosCommand
  }),
  new Command({
    name: 'codigo',
    description: 'Código da ravenabot',
    category: "geral",
    reactions: {
      before: "💾"
    },
    method: codigoCommand
  }),
  new Command({
    name: 'código',
    description: 'Código da ravenabot',
    category: "geral",
    hidden: true,
    reactions: {
      before: "💾"
    },
    method: codigoCommand
  }),
  new Command({
    name: 'gold',
    description: 'Info Ravena gold',
    category: "geral",
    hidden: true,
    reactions: {
      before: "🪙"
    },
    method: goldCommand
  }),
  
  new Command({
    name: 'convite',
    description: 'Saiba mas sobre a ravena em grupos',
    category: "geral",
    reactions: {
      before: "📩"
    },
    method: conviteCommand
  })
];

// Registra os comandos sendo exportados
//logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands, getUserNickname  };
