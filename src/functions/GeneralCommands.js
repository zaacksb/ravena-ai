const path = require('path');
const LLMService = require('../services/LLMService');
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const Database = require('../utils/Database');

const logger = new Logger('general-commands');

const database = Database.getInstance();

// Cria instância do serviço LLM com configuração padrão
const llmService = new LLMService({});


// Define os métodos de comando separadamente
async function pingCommand(bot, message, args, group) {
  const chatId = message.group || message.author;
  logger.debug(`Executando comando ping para ${chatId}`);
  
  return new ReturnMessage({
    chatId: chatId,
    content: 'Pong! 🏓'
  });
}

async function grupaoCommand(bot, message, args, group){
  const chatId = message.group || message.author;
  const grupao = await bot.client.getChatById(process.env.GRUPO_INTERACAO);

  try{
    await grupao.addParticipants([message.author]);
  } catch(e){
    logger.error(`[grupaoCommand] Não consegui add '${message.author}' no grupão (${bot.grupoInteracao})`);
  }

  return new ReturnMessage({
    chatId: chatId,
    content: `Ok! Tentei de adicionar no grupão da ravena. Se não tiver sido adicionado, entre pelo link: ${process.env.LINK_GRUPO_INTERACAO}`
  });

}

async function diferencasCommand(bot, message, args, group) {
  const chatId = message.group || message.author;

  return new ReturnMessage({
    chatId: chatId,
    content: `Bem vindo à nova *ravena*!
Se tiver dúvidas, entre no *!grupao*

Aqui vai as principais diferenças pra antiga:

*No dia a dia:*
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

async function aiCommand(bot, message, args, group) {
  const chatId = message.group || message.author;
  
  let question = args.join(' ');
  const quotedMsg = await message.origin.getQuotedMessage();
  if(quotedMsg){
    // Tem mensagem marcada, junta o conteudo (menos que tenha vindo de reação)
    if(!message.originReaction){
      if(quotedMsg.body.length > 10){
        question += `\n\n${quotedMsg.body}`;
      }
    }
  }

  if (question.length < 5) {
    logger.debug('Comando ai chamado sem pergunta');
    return new ReturnMessage({
      chatId: chatId,
      content: 'Por favor, forneça uma pergunta. Exemplo: !ai Qual é a capital da França?'
    });
  }
  
  logger.debug(`Comando ai com pergunta: ${question}`);
  
  // Primeiro, envia uma mensagem indicando que está processando
  const processingMessage = new ReturnMessage({
    chatId: chatId,
    content: `🔍 Processando: "${question}"...`
  });
  
  // Obtém resposta da IA
  try {
    logger.debug('Tentando obter completação LLM');
    const response = await llmService.getCompletion({
      prompt: question,
      temperature: 0.7
    });
    
    logger.debug('Resposta LLM obtida', response);
    
    // Retorna a resposta da IA
    return new ReturnMessage({
      chatId: chatId,
      content: response
    });
  } catch (error) {
    logger.error('Erro ao obter completação LLM:', error);
    return new ReturnMessage({
      chatId: chatId,
      content: 'Desculpe, encontrei um erro ao processar sua solicitação.'
    });
  }
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
          content: `Seu apelido atual é: ${userNick}`
        });
      } else {
        return new ReturnMessage({
          chatId: group.id,
          content: 'Você não tem um apelido definido. Use !apelido [apelido] para definir um.'
        });
      }
    }
    
    // Obter o apelido dos argumentos
    let nickname = args.join(' ');
    
    // Verificar o comprimento mínimo
    if (nickname.length < 2) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'O apelido deve ter pelo menos 2 caracteres.'
      });
    }
    
    // Limitar a 20 caracteres
    if (nickname.length > 20) {
      nickname = nickname.substring(0, 20);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `O apelido foi limitado a 20 caracteres: ${nickname}`
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
      content: `Apelido definido: ${nickname}`
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
    name: 'ai',
    description: 'Pergunte algo à IA',
    category: "ia",
    group: "askia",
    reactions: {
      trigger: "🤖",
      before: "⏳",
      after: "🤖"
    },
    cooldown: 60,
    method: aiCommand
  }),
  new Command({
    name: 'ia',
    description: 'Alias para AI',
    category: "ia",
    group: "askia",
    reactions: {
      trigger: "🤖",
      before: "⏳",
      after: "🤖"
    },
    cooldown: 60,
    method: aiCommand
  }), 
  new Command({
    name: 'gpt',
    hidden: true,
    description: 'Alias para AI',
    category: "ia",
    group: "askia",
    reactions: {
      trigger: "🤖",
      before: "⏳",
      after: "🤖"
    },
    cooldown: 60,
    method: aiCommand
  }), 
  new Command({
    name: 'gemini',
    hidden: true,
    description: 'Alias para AI',
    category: "ia",
    group: "askia",
    reactions: {
      trigger: "🤖",
      before: "⏳",
      after: "🤖"
    },
    cooldown: 60,
    method: aiCommand
  }), 
  new Command({
    name: 'apelido',
    description: 'Define seu apelido no grupo',
    category: "geral",
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
    description: 'Grupo de interação',
    category: "geral",
    reactions: {
      before: "👨‍👨‍👧‍👦"
    },
    method: grupaoCommand
  })
];

// Registra os comandos sendo exportados
//logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands, getUserNickname  };