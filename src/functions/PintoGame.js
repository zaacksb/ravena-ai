// src/functions/PintoGame.js
const path = require('path');
const fs = require('fs').promises;
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const Database = require('../utils/Database');

const logger = new Logger('pinto-game');
const database = Database.getInstance();

// Constantes do jogo
const MIN_FLACCID = 0.5;
const MAX_FLACCID = 15.0;
const MIN_ERECT = 0.5;
const MAX_ERECT = 40.0;
const MIN_GIRTH = 6.0;
const MAX_GIRTH = 20.0;
const MAX_SCORE = 1000;
const COOLDOWN_DAYS = 7; // 7 dias de cooldown

// Variáveis para o sistema de cache e salvamento periódico  
let dadosCache = null;  
let ultimoSalvamento = 0;  
const INTERVALO_SALVAMENTO = 5 * 60 * 1000; // 5 minutos em millisegundos  
let modificacoesNaoSalvas = false;

// Caminho para o arquivo de dados do jogo
const PINTO_DATA_PATH = path.join(database.databasePath, 'pinto.json');

/**  
 * Obtém os dados do jogo do arquivo JSON dedicado  
 * @returns {Promise<Object>} Dados do jogo  
 */  
async function getPintoGameData() {  
  try {  
    // Return cached data if available  
    if (dadosCache !== null) {  
      return dadosCache;  
    }  
  
    // Verifica se o arquivo existe  
    try {  
      await fs.access(PINTO_DATA_PATH);  
    } catch (error) {  
      // Se o arquivo não existir, cria um novo com estrutura padrão  
      const defaultData = {  
        groups: {},  
        history: []  
      };  
        
      // Garante que o diretório exista  
      const dir = path.dirname(PINTO_DATA_PATH);  
      await fs.mkdir(dir, { recursive: true });  
        
      await fs.writeFile(PINTO_DATA_PATH, JSON.stringify(defaultData, null, 2));  
        
      // Update cache and last save time  
      dadosCache = defaultData;  
      ultimoSalvamento = Date.now();  
        
      return defaultData;  
    }  
  
    // Lê o arquivo  
    const data = await fs.readFile(PINTO_DATA_PATH, 'utf8');  
    const parsedData = JSON.parse(data);  
      
    // Update cache and last save time  
    dadosCache = parsedData;  
    ultimoSalvamento = Date.now();  
      
    return parsedData;  
  } catch (error) {  
    logger.error('Erro ao ler dados do jogo:', error);  
    // Retorna objeto padrão em caso de erro  
    return {  
      groups: {},  
      history: []  
    };  
  }  
}  
  
/**  
 * Salva os dados do jogo no arquivo JSON dedicado  
 * @param {Object} gameData Dados do jogo a serem salvos  
 * @param {boolean} forceSave Força o salvamento mesmo que não tenha passado o intervalo  
 * @returns {Promise<boolean>} Status de sucesso  
 */  
async function savePintoGameData(gameData, forceSave = false) {  
  try {  
    // Update cache  
    dadosCache = gameData;  
    modificacoesNaoSalvas = true;  
      
    // Only save to disk if forced or if enough time has passed since last save  
    const agora = Date.now();  
    if (forceSave || (agora - ultimoSalvamento) > INTERVALO_SALVAMENTO) {  
      // Garante que o diretório exista  
      const dir = path.dirname(PINTO_DATA_PATH);  
      await fs.mkdir(dir, { recursive: true });  
  
      // Salva os dados  
      await fs.writeFile(PINTO_DATA_PATH, JSON.stringify(gameData, null, 2));  
        
      ultimoSalvamento = agora;  
      modificacoesNaoSalvas = false;  
      logger.info('Dados do jogo pinto salvos em disco');  
    }  
      
    return true;  
  } catch (error) {  
    logger.error('Erro ao salvar dados do jogo:', error);  
    return false;  
  }  
}

/**
 * Gera um valor aleatório entre min e max com 1 casa decimal
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {number} - Valor aleatório com 1 casa decimal
 */
function generateRandomValue(min, max) {
  const value = Math.random() * (max - min) + min;
  return Math.round(value * 10) / 10; // Arredonda para 1 casa decimal
}

/**
 * Calcula o score com base nos valores
 * @param {number} flaccid - Comprimento flácido
 * @param {number} erect - Comprimento ereto
 * @param {number} girth - Circunferência
 * @returns {number} - Score calculado
 */
function calculateScore(flaccid, erect, girth) {
  // Normaliza os valores (0 a 1)
  const normFlaccid = (flaccid - MIN_FLACCID) / (MAX_FLACCID - MIN_FLACCID);
  const normErect = (erect - MIN_ERECT) / (MAX_ERECT - MIN_ERECT);
  const normGirth = (girth - MIN_GIRTH) / (MAX_GIRTH - MIN_GIRTH);
  
  // Calcula a média ponderada (dando mais peso para o comprimento ereto)
  const weightedAvg = (normFlaccid * 0.3 + normErect * 0.5 + normGirth * 0.2);
  
  // Converte para o score final
  return Math.round(weightedAvg * MAX_SCORE);
}

/**
 * Gera um comentário com base no score
 * @param {number} score - Score calculado
 * @returns {string} - Comentário engraçado
 */
function getComment(score) {
  if (score >= 900) {
    return "🔥 Impressionante! Você está no nível lendário!";
  } else if (score >= 800) {
    return "🏆 Excepcional! Um verdadeiro campeão!";
  } else if (score >= 700) {
    return "🌟 Incrível! Sem palavras para descrever!";
  } else if (score >= 600) {
    return "👏 Muito bem! Acima da média!";
  } else if (score >= 500) {
    return "👍 Bom resultado. Na média superior!";
  } else if (score >= 400) {
    return "😊 Resultado decente! Na média!";
  } else if (score >= 300) {
    return "🙂 Resultado aceitável. Um pouco abaixo da média.";
  } else if (score >= 200) {
    return "😐 Humm... Não é o melhor resultado, mas tudo bem.";
  } else if (score >= 100) {
    return "😬 Eita... Pelo menos você tem personalidade, certo?";
  } else {
    return "💀 F no chat... Mas tamanho não é documento!";
  }
}

/**
 * Formata data para exibição
 * @param {number} timestamp - Timestamp em milissegundos
 * @returns {string} - Data formatada
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Verifica se o usuário está em cooldown com base no lastUpdated salvo no banco
 * @param {string} groupId - ID do grupo
 * @param {string} userId - ID do usuário
 * @param {Object} gameData - Dados do jogo
 * @returns {Object} - Status do cooldown e próxima data disponível
 */
function checkCooldown(groupId, userId, gameData) {
  // Verifica se existe registro do usuário no grupo
  if (gameData.groups[groupId] && 
      gameData.groups[groupId][userId] && 
      gameData.groups[groupId][userId].lastUpdated) {
      
    const now = Date.now();
    const lastUsed = gameData.groups[groupId][userId].lastUpdated;
    const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    
    if (now - lastUsed < cooldownMs) {
      const nextAvailable = new Date(lastUsed + cooldownMs);
      const timeUntil = nextAvailable - now;
      const daysUntil = Math.ceil(timeUntil / (24 * 60 * 60 * 1000));
      
      return {
        inCooldown: true,
        nextAvailable,
        daysUntil
      };
    }
  }
  
  // Sem cooldown ativo
  return {
    inCooldown: false
  };
}

/**
 * Gera os resultados do comando !pinto
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function pintoCommand(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este jogo só pode ser jogado em grupos.',
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    // Obtém IDs e nome
    const groupId = message.group;
    const userId = message.author;
    const userName = message.authorName || "Usuário";
    
    // Obtém os dados do jogo
    const gameData = await getPintoGameData();
    
    // Verifica o cooldown baseado no lastUpdated salvo no banco
    const cooldownStatus = checkCooldown(groupId, userId, gameData);
    
    if (cooldownStatus.inCooldown) {
      return new ReturnMessage({
        chatId: groupId,
        content: `⏳ ${userName}, você já realizou sua avaliação recentemente.\n\nPróxima avaliação disponível em ${cooldownStatus.daysUntil} dia(s), dia ${formatDate(cooldownStatus.nextAvailable)}.`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    // Gera os valores aleatórios
    const flaccid = generateRandomValue(MIN_FLACCID, MAX_FLACCID);
    const erect = generateRandomValue(Math.max(flaccid, MIN_ERECT), MAX_ERECT); // Ereto é no mínimo igual ao flácido
    const girth = generateRandomValue(MIN_GIRTH, MAX_GIRTH);
    
    // Calcula o score
    const score = calculateScore(flaccid, erect, girth);
    
    // Obtém um comentário baseado no score
    const comment = getComment(score);
    
    // Salva os resultados no banco de dados
    try {
      // Inicializa a estrutura se necessário
      if (!gameData.groups[groupId]) {
        gameData.groups[groupId] = {};
      }
      
      // Timestamp atual
      const currentTimestamp = Date.now();
      
      // Salva ou atualiza os dados do jogador para este grupo
      gameData.groups[groupId][userId] = {
        name: userName,
        flaccid,
        erect,
        girth,
        score,
        lastUpdated: currentTimestamp
      };
      
      // Adiciona ao histórico geral
      gameData.history.push({
        userId,
        userName,
        groupId,
        flaccid,
        erect,
        girth,
        score,
        timestamp: currentTimestamp
      });
      
      // Limita o histórico a 100 entradas
      if (gameData.history.length > 100) {
        gameData.history = gameData.history.slice(-100);
      }
      
      // Salva as alterações
      await savePintoGameData(gameData);
    } catch (dbError) {
      logger.error('Erro ao salvar dados do jogo:', dbError);
    }
    
    // Prepara a mensagem de resposta
    const response = `${userName}, fiz a análise completa de seu membro e cheguei nos seguintes resultados:\n\n` +
                    `• *Comprimento Flácido:* ${flaccid.toFixed(1)} cm\n` +
                    `• *Comprimento Ereto:* ${erect.toFixed(1)} cm\n` +
                    `• *Circunferência:* ${girth.toFixed(1)} cm\n` +
                    `• *Score:* _${score} pontos_\n\n` +
                    `${comment}\n\n` +
                    `> Você pode voltar daqui a 1 semana para refazermos sua avaliação.`;
    
    return new ReturnMessage({
      chatId: groupId,
      content: response,
      options: {
        quotedMessageId: message.origin.id._serialized
      }
    });
  } catch (error) {
    logger.error('Erro no comando de pinto:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Erro ao processar o comando. Por favor, tente novamente.',
      options: {
        quotedMessageId: message.origin.id._serialized
      }
    });
  }
}

/**
 * Mostra o ranking do jogo Pinto
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function pintoRankingCommand(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: '🏆 O ranking do jogo só pode ser visualizado em grupos.'
      });
    }
    
    const groupId = message.group;
    
    // Obtém os dados do jogo
    const gameData = await getPintoGameData();
    
    // Verifica se existem dados do jogo para este grupo
    if (!gameData.groups[groupId] || Object.keys(gameData.groups[groupId]).length === 0) {
      return new ReturnMessage({
        chatId: groupId,
        content: '🏆 Ainda não há dados para o ranking neste grupo. Use !pinto para participar!'
      });
    }
    
    // Converte para array para poder ordenar
    const players = Object.entries(gameData.groups[groupId]).map(([id, data]) => ({
      id,
      ...data
    }));
    
    // Ordena por score (maior para menor)
    players.sort((a, b) => b.score - a.score);
    
    // Limita a 10 jogadores
    const topPlayers = players.slice(0, 10);
    
    // Prepara a mensagem de ranking
    let rankingMessage = `🍆 *Ranking do Tamanho - ${group.name || "Grupo"}*\n\n`;
    
    topPlayers.forEach((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      rankingMessage += `${medal} ${player.name}: ${player.score} pontos\n`;
    });
    
    // Encontra a posição do autor da mensagem
    const authorPosition = players.findIndex(player => player.id === message.author);
    
    // Se o autor não está no top 10, mas está no ranking
    if (authorPosition >= 10) {
      rankingMessage += `\n...\n\n`;
      rankingMessage += `${authorPosition + 1}. Você: ${players[authorPosition].score} pontos`;
    }
    
    return new ReturnMessage({
      chatId: groupId,
      content: rankingMessage
    });
  } catch (error) {
    logger.error('Erro ao mostrar ranking do jogo:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Erro ao mostrar ranking. Por favor, tente novamente.'
    });
  }
}

/**  
 * Reseta os dados do jogo Pinto para um grupo específico  
 * @param {WhatsAppBot} bot - Instância do bot  
 * @param {Object} message - Dados da mensagem  
 * @param {Array} args - Argumentos do comando  
 * @param {Object} group - Dados do grupo  
 * @returns {Promise<ReturnMessage[]>} Array de mensagens de retorno  
 */  
async function pintoResetCommand(bot, message, args, group) {  
  try {  
    // Verifica se está em um grupo  
    if (!message.group) {  
      return [new ReturnMessage({  
        chatId: message.author,  
        content: 'O reset do jogo só pode ser executado em grupos.'  
      })];  
    }  
      
    const groupId = message.group;  
    const userId = message.author;  
      
    // Verifica se o usuário é admin  
    const isAdmin = await bot.isUserAdminInGroup(userId, groupId);  
    if (!isAdmin) {  
      return [new ReturnMessage({  
        chatId: groupId,  
        content: '⛔ Apenas administradores podem resetar os dados do jogo.',  
        options: {  
          quotedMessageId: message.origin.id._serialized  
        }  
      })];  
    }  
      
    // Carrega dados do jogo  
    let gameData = await getPintoGameData();  
      
    // Verifica se há dados para este grupo  
    if (!gameData.groups[groupId] || Object.keys(gameData.groups[groupId]).length === 0) {  
      return [new ReturnMessage({  
        chatId: groupId,  
        content: '⚠️ Não há dados do jogo para este grupo.',  
        options: {  
          quotedMessageId: message.origin.id._serialized  
        }  
      })];  
    }  
      
    // Obtém o ranking atual antes de resetar  
    const rankingMessage = await pintoRankingCommand(bot, message, args, group);  
      
    // Faz backup dos dados atuais  
    const dadosAntigos = JSON.parse(JSON.stringify(gameData.groups[groupId]));  
    const numJogadores = Object.keys(dadosAntigos).length;  
      
    // Reseta os dados do grupo  
    gameData.groups[groupId] = {};  
      
    // Salva os dados (forçando salvamento imediato)  
    await savePintoGameData(gameData, true);  
      
    // Retorna mensagens  
    return [  
      rankingMessage,  
      new ReturnMessage({  
        chatId: groupId,  
        content: `🔄 *Dados do Jogo Pinto Resetados*\n\nForam removidos dados de ${numJogadores} jogadores deste grupo.\n\nO ranking acima mostra como estava antes do reset.`,  
        options: {  
          quotedMessageId: message.origin.id._serialized  
        }  
      })  
    ];  
  } catch (error) {  
    logger.error('Erro ao resetar dados do jogo:', error);  
      
    return [new ReturnMessage({  
      chatId: message.group || message.author,  
      content: 'Erro ao resetar dados do jogo. Por favor, tente novamente.'  
    })];  
  }  
}

// Adiciona um intervalo para salvar periodicamente os dados modificados  
setInterval(async () => {  
  try {  
    // Só processa se houver dados em cache e modificações não salvas  
    if (dadosCache !== null && modificacoesNaoSalvas) {  
      const agora = Date.now();  
      if ((agora - ultimoSalvamento) > INTERVALO_SALVAMENTO) {  
        logger.info('Salvando dados do jogo pinto periodicamente...');  
        await savePintoGameData(dadosCache, true);  
      }  
    }  
  } catch (error) {  
    logger.error('Erro ao salvar dados do jogo periodicamente:', error);  
  }  
}, 60000); // Verifica a cada minuto  
  
// Adicione um handler para salvar dados antes de encerrar o processo  
process.on('SIGINT', async () => {  
  try {  
    if (dadosCache !== null && modificacoesNaoSalvas) {  
      logger.info('Salvando dados do jogo pinto antes de encerrar...');  
      await savePintoGameData(dadosCache, true);  
    }  
  } catch (error) {  
    logger.error('Erro ao salvar dados do jogo durante encerramento:', error);  
  } finally {  
    process.exit(0);  
  }  
});

// Criar array de comandos usando a classe Command
const commands = [
  new Command({
    name: 'pinto',
    description: 'Gera uma avaliação de tamanho aleatória',
    category: "jogos",
    cooldown: 0, // O cooldown é controlado internamente pelo lastUpdated
    reactions: {
      before: "📏",
      after: "🍆",
      error: "❌"
    },
    method: pintoCommand
  }),
  
  new Command({
    name: 'pinto-ranking',
    description: 'Mostra o ranking do jogo',
    category: "jogos",
    cooldown: 30,
    reactions: {
      after: "🏆",
      error: "❌"
    },
    method: pintoRankingCommand
  }),  
    
  new Command({  
    name: 'pinto-reset',  
    description: 'Reseta os dados do jogo para este grupo',  
    category: "jogos",  
    adminOnly: true,  
    cooldown: 60,  
    reactions: {  
      after: "🔄",  
      error: "❌"  
    },  
    method: pintoResetCommand  
  })
];

module.exports = { commands, getPintoGameData, savePintoGameData };