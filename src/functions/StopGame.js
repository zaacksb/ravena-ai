// src/functions/StopGame.js
const path = require('path');
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const Database = require('../utils/Database');
const LLMService = require('../services/LLMService');

const logger = new Logger('stop-game');
const database = Database.getInstance();
const llmService = new LLMService({});

// Constantes do jogo
const GAME_DURATION = 5 * 60 * 1000; // 5 minutos em milissegundos
const NUM_CATEGORIES = 5; // Número de categorias por rodada
const MINIMUM_RESPONSES = 2; // Mínimo de respostas para validar o jogo

// Lista de categorias disponíveis
const CATEGORIES = [
  "Alimento", "Fruta", "Animal", "Celebridade", "Carro", 
  "C.E.P (Cidade, Estado, País)", "Cor", "Esporte", "Filme", 
  "Série", "Banda", "Marca", "Meios de Transporte", 
  "Partes do Corpo", "Ator ou Atriz", "Flor", "Objeto"
];

// Lista de letras disponíveis para sorteio (excluindo letras difíceis como K, W, X, Y, Z)
const AVAILABLE_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L',
  'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V'
];

// Armazena os jogos ativos
const activeGames = {};

/**
 * Seleciona categorias aleatórias da lista
 * @param {number} count - Número de categorias a selecionar
 * @returns {Array} - Array de categorias selecionadas
 */
function getRandomCategories(count) {
  const categories = [...CATEGORIES];
  const selected = [];
  
  for (let i = 0; i < count && categories.length > 0; i++) {
    const index = Math.floor(Math.random() * categories.length);
    selected.push(categories[index]);
    categories.splice(index, 1); // Remove a categoria selecionada para evitar duplicatas
  }
  
  return selected;
}

/**
 * Seleciona uma letra aleatória da lista de letras disponíveis
 * @returns {string} - Letra selecionada
 */
function getRandomLetter() {
  const index = Math.floor(Math.random() * AVAILABLE_LETTERS.length);
  return AVAILABLE_LETTERS[index];
}

/**
 * Verifica se uma string começa com a letra especificada (ignorando acentos)
 * @param {string} text - Texto a verificar
 * @param {string} letter - Letra inicial
 * @returns {boolean} - Verdadeiro se começar com a letra
 */
function startsWithLetter(text, letter) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return false;
  }
  
  // Normaliza para remover acentos e converte para maiúscula
  const normalizedText = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const normalizedLetter = letter.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  
  return normalizedText.startsWith(normalizedLetter);
}

/**
 * Inicia um novo jogo de Stop/Adedonha
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function startStopGame(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'O jogo de Stop/Adedonha só pode ser jogado em grupos.'
      });
    }
    
    const groupId = message.group;
    
    // Verifica se já existe um jogo ativo
    if (activeGames[groupId]) {
      // Verifica se o jogo já expirou
      if (Date.now() > activeGames[groupId].endTime) {
        // Finaliza o jogo antigo
        await endGame(bot, groupId);
      } else {
        // Informa que há um jogo em andamento
        const timeRemaining = Math.ceil((activeGames[groupId].endTime - Date.now()) / 1000);
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        
        return new ReturnMessage({
          chatId: groupId,
          content: `🛑 Já existe um jogo de Stop/Adedonha em andamento! Tempo restante: ${minutes}m ${seconds}s.`
        });
      }
    }
    
    // Verifica argumentos para personalização
    let gameDuration = GAME_DURATION;
    let numCategories = NUM_CATEGORIES;
    
    if (args.length > 0) {
      // Verifica se tem argumento para duração (em minutos)
      const duration = parseInt(args[0]);
      if (!isNaN(duration) && duration > 0 && duration <= 15) {
        gameDuration = duration * 60 * 1000; // Converte minutos para milissegundos
      }
    }
    
    if (args.length > 1) {
      // Verifica se tem argumento para número de categorias
      const catCount = parseInt(args[1]);
      if (!isNaN(catCount) && catCount > 0 && catCount <= 10) {
        numCategories = catCount;
      }
    }
    
    // Seleciona categorias aleatórias
    const selectedCategories = getRandomCategories(numCategories);
    
    // Seleciona uma letra aleatória
    const selectedLetter = getRandomLetter();
    
    // Cria o objeto do jogo
    activeGames[groupId] = {
      categories: selectedCategories,
      letter: selectedLetter,
      startTime: Date.now(),
      endTime: Date.now() + gameDuration,
      responses: [],
      initiatedBy: message.author,
      initiatorName: message.authorName || "Jogador",
      results: null,
      gameHeader: `🛑 *STOP!* ✋ - Letra: *${selectedLetter}*`
    };
    
    // Prepara a mensagem do jogo
    let gameMessage = `${activeGames[groupId].gameHeader}\n\n`;
    
    selectedCategories.forEach((category, index) => {
      gameMessage += `- ${category}:\n`;
    });
    
    // Adiciona instruções
    const minutes = Math.floor(gameDuration / 60000);
    const seconds = Math.floor((gameDuration % 60000) / 1000);
    
    gameMessage += `\nVocê tem ${minutes}m${seconds > 0 ? ` ${seconds}s` : ''} para responder!\n`;
    gameMessage += `Todas as respostas devem começar com a letra *${selectedLetter}*.\n`;
    gameMessage += `Copie esta mensagem, preencha as categorias e envie no grupo!`;
    
    // Envia a mensagem do jogo
    await bot.sendMessage(groupId, gameMessage);
    
    // Configura o temporizador para finalizar o jogo
    setTimeout(async () => {
      if (activeGames[groupId]) {
        // Envia mensagem de que o tempo acabou
        await bot.sendMessage(groupId, `⏰ Tempo esgotado para o jogo de Stop/Adedonha!\n\nAguarde, analisando respostas...`);
        
        // Finaliza o jogo após um breve intervalo
        setTimeout(async () => {
          await endGame(bot, groupId);
        }, 2000);
      }
    }, gameDuration);
    
    return null; // Retorna null porque já enviamos as mensagens
  } catch (error) {
    logger.error('Erro ao iniciar jogo de Stop/Adedonha:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Erro ao iniciar o jogo de Stop/Adedonha. Por favor, tente novamente.'
    });
  }
}

/**
 * Processa uma mensagem para verificar se é uma resposta ao jogo Stop/Adedonha
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem formatada
 * @returns {Promise<boolean>} - Se a mensagem foi processada como resposta do jogo
 */
async function processStopGameResponse(bot, message) {
  try {
    // Verifica se é uma mensagem de grupo
    if (!message.group) {
      return false;
    }
    
    const groupId = message.group;
    const userId = message.author;
    const userName = message.authorName || "Jogador";
    
    // Verifica se há um jogo ativo no grupo
    if (!activeGames[groupId]) {
      return false;
    }
    
    // Verifica se o jogo expirou
    if (Date.now() > activeGames[groupId].endTime) {
      return false;
    }
    
    // Verifica se a mensagem começa com o cabeçalho do jogo
    const messageContent = message.content;
    if (typeof messageContent !== 'string') {
      return false;
    }
    
    if (!messageContent.startsWith(activeGames[groupId].gameHeader)) {
      return false;
    }
    
    // Evita que o usuário envie múltiplas respostas (apenas considera a última)
    const existingResponseIndex = activeGames[groupId].responses.findIndex(
      response => response.userId === userId
    );
    
    if (existingResponseIndex !== -1) {
      // Substitui a resposta anterior
      activeGames[groupId].responses[existingResponseIndex] = {
        userId,
        userName,
        messageContent,
        timestamp: Date.now()
      };
      
      // Reage à mensagem para indicar que foi atualizada
      try {
        await message.origin.react("🔄");
      } catch (reactError) {
        logger.error('Erro ao reagir à resposta atualizada:', reactError);
      }
    } else {
      // Adiciona nova resposta
      activeGames[groupId].responses.push({
        userId,
        userName,
        messageContent,
        timestamp: Date.now()
      });
      
      // Reage à mensagem para indicar que foi registrada
      try {
        await message.origin.react("✅");
      } catch (reactError) {
        logger.error('Erro ao reagir à resposta:', reactError);
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Erro ao processar resposta do jogo Stop/Adedonha:', error);
    return false;
  }
}

/**
 * Analisa respostas do jogo usando LLM
 * @param {Array} categories - Lista de categorias do jogo
 * @param {Array} responses - Lista de respostas dos usuários
 * @param {string} letter - Letra sorteada para o jogo
 * @returns {Promise<Object>} - Resultados da análise
 */
async function analyzeResponses(categories, responses, letter) {
  try {
    const results = {};
    const game = activeGames[responses[0].messageContent.split('\n')[0].split('*')[4]];
    
    // Processa cada resposta
    for (const response of responses) {
      // Extrai respostas das categorias da mensagem
      const lines = response.messageContent.split('\n');
      const userAnswers = {};
      
      let currentCategory = null;
      
      for (const line of lines) {
        // Procura por linhas que comecem com "- Categoria:" ou similar
        const categoryMatch = line.match(/^-\s*([^:]+):\s*(.*)$/);
        if (categoryMatch) {
          const categoryName = categoryMatch[1].trim();
          const answer = categoryMatch[2].trim();
          
          // Verifica se é uma das categorias do jogo
          if (categories.some(cat => categoryName.includes(cat))) {
            // Determina a categoria exata
            const exactCategory = categories.find(cat => categoryName.includes(cat));
            userAnswers[exactCategory] = answer;
          }
        }
      }
      
      // Verifica se o usuário respondeu a todas as categorias
      let missingCategories = 0;
      for (const category of categories) {
        if (!userAnswers[category] || userAnswers[category] === '') {
          missingCategories++;
        }
      }
      
      // Se muitas categorias estão faltando, considera a resposta inválida
      if (missingCategories > categories.length / 2) {
        results[response.userId] = {
          userName: response.userName,
          invalid: true,
          reason: `Muitas categorias não preenchidas (${missingCategories}/${categories.length})`,
          score: 0,
          answers: {}
        };
        continue;
      }
      
      // Se muitas categorias estão faltando ou muitas respostas não começam com a letra correta
      let invalidLetterCount = 0;
      for (const category of categories) {
        const answer = userAnswers[category] || '';
        if (answer && !startsWithLetter(answer, letter)) {
          invalidLetterCount++;
        }
      }
      
      // Se mais da metade das respostas não começa com a letra correta, considera a resposta inválida
      if (invalidLetterCount > Object.keys(userAnswers).length / 2) {
        results[response.userId] = {
          userName: response.userName,
          invalid: true,
          reason: `Muitas respostas não começam com a letra ${letter} (${invalidLetterCount}/${Object.keys(userAnswers).length})`,
          score: 0,
          answers: {}
        };
        continue;
      }
      
      // Prepara para validar as respostas usando LLM
      const validationPrompt = createValidationPrompt(categories, userAnswers, letter);
      
      try {
        const llmResponse = await llmService.getCompletion({
          prompt: validationPrompt
        });
        
        // Analisa a resposta do LLM (espera um JSON)
        const validationResults = parseLLMResponse(llmResponse);
        
        // Calcula a pontuação
        let totalScore = 0;
        const validatedAnswers = {};
        
        for (const category of categories) {
          const answer = userAnswers[category] || '';
          const validation = validationResults[category] || { valid: false, reason: 'Resposta ausente' };
          
          validatedAnswers[category] = {
            answer,
            valid: validation.valid,
            reason: validation.reason,
            score: validation.valid ? 10 : 0
          };
          
          totalScore += validatedAnswers[category].score;
        }
        
        // Armazena os resultados deste usuário
        results[response.userId] = {
          userName: response.userName,
          invalid: false,
          score: totalScore,
          answers: validatedAnswers
        };
      } catch (llmError) {
        logger.error('Erro ao validar respostas com LLM:', llmError);
        
        // Caso haja erro com o LLM, aceita todas as respostas não vazias que começam com a letra correta
        const validatedAnswers = {};
        let totalScore = 0;
        
        for (const category of categories) {
          const answer = userAnswers[category] || '';
          const valid = answer.trim() !== '' && startsWithLetter(answer, letter);
          
          validatedAnswers[category] = {
            answer,
            valid,
            reason: valid ? 'Resposta fornecida com letra correta' : (answer.trim() === '' ? 'Resposta ausente' : 'Não começa com a letra correta'),
            score: valid ? 10 : 0
          };
          
          totalScore += validatedAnswers[category].score;
        }
        
        // Armazena os resultados deste usuário
        results[response.userId] = {
          userName: response.userName,
          invalid: false,
          score: totalScore,
          answers: validatedAnswers
        };
      }
    }
    
    return results;
  } catch (error) {
    logger.error('Erro ao analisar respostas:', error);
    throw error;
  }
}

/**
 * Cria um prompt para validação das respostas
 * @param {Array} categories - Lista de categorias
 * @param {Object} userAnswers - Respostas do usuário por categoria
 * @param {string} letter - Letra sorteada para o jogo
 * @returns {string} - Prompt para enviar ao LLM
 */
function createValidationPrompt(categories, userAnswers, letter) {
  let prompt = `Você é um juiz de um jogo chamado "Stop" ou "Adedonha". Preciso que analise as respostas de um jogador para as seguintes categorias. Todas as respostas devem começar com a letra "${letter}":\n\n`;
  
  for (const category of categories) {
    const answer = userAnswers[category] || '';
    prompt += `Categoria: ${category}\nResposta: ${answer}\n\n`;
  }
  
  prompt += `Para cada categoria, avalie se a resposta é válida de acordo com estas regras:
1. A resposta deve pertencer realmente à categoria indicada
2. A resposta deve começar com a letra "${letter}" (ignorando acentos)
3. Respostas em branco ou "N/A" são inválidas
4. A resposta deve ser específica e não genérica demais

Forneça sua avaliação em formato JSON, seguindo este modelo:
{
  "Categoria1": {
    "valid": true/false,
    "reason": "Explicação breve"
  },
  "Categoria2": {
    "valid": true/false,
    "reason": "Explicação breve"
  }
}

Use exatamente os mesmos nomes de categorias que forneci. Seja rigoroso mas justo na avaliação.`;

  return prompt;
}

/**
 * Analisa a resposta do LLM para extrair os resultados de validação
 * @param {string} llmResponse - Resposta do LLM
 * @returns {Object} - Objeto com os resultados de validação
 */
function parseLLMResponse(llmResponse) {
  try {
    // Tenta extrair apenas a parte JSON da resposta
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Se não encontrar um padrão JSON claro, tenta analisar a resposta completa
    return JSON.parse(llmResponse);
  } catch (error) {
    logger.error('Erro ao analisar resposta do LLM:', error);
    logger.debug('Resposta do LLM:', llmResponse);
    
    // Retorna um objeto vazio em caso de erro
    return {};
  }
}

/**
 * Finaliza um jogo de Stop/Adedonha
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {string} groupId - ID do grupo
 */
async function endGame(bot, groupId) {
  try {
    if (!activeGames[groupId]) {
      return;
    }
    
    const game = activeGames[groupId];
    
    // Verifica se há respostas suficientes
    if (game.responses.length < MINIMUM_RESPONSES) {
      await bot.sendMessage(groupId, `📝 O jogo de Stop/Adedonha foi cancelado por ter menos de ${MINIMUM_RESPONSES} respostas.`);
      delete activeGames[groupId];
      return;
    }
    
    // Analisa as respostas
    const results = await analyzeResponses(game.categories, game.responses, game.letter);
    
    // Armazena os resultados no objeto do jogo
    game.results = results;
    
    // Prepara a mensagem de resultados
    let resultsMessage = `🏁 *Resultados do Stop/Adedonha - Letra: ${game.letter}*\n\n`;
    
    // Ordena os jogadores por pontuação
    const sortedPlayers = Object.entries(results)
      .filter(([userId, result]) => !result.invalid)
      .sort(([, resultA], [, resultB]) => resultB.score - resultA.score);
    
    // Mostra o ranking
    if (sortedPlayers.length > 0) {
      resultsMessage += '*Classificação:*\n';
      
      sortedPlayers.forEach(([userId, result], index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        resultsMessage += `${medal} ${result.userName}: ${result.score} pontos\n`;
      });
      
      // Mostra detalhes do vencedor se houver
      if (sortedPlayers.length > 0) {
        const [winnerId, winner] = sortedPlayers[0];
        
        resultsMessage += `\n🏆 *Vencedor: ${winner.userName}*\n\n`;
        resultsMessage += '*Respostas do vencedor:*\n';
        
        for (const category of game.categories) {
          const answer = winner.answers[category];
          const status = answer.valid ? '✅' : '❌';
          resultsMessage += `${status} ${category}: ${answer.answer || '(não respondeu)'}\n`;
        }
      }
    } else {
      resultsMessage += 'Nenhuma resposta válida nesta rodada. 😢';
    }
    
    // Envia a mensagem com os resultados
    await bot.sendMessage(groupId, resultsMessage);
    
    // Atualiza o ranking global
    await updateStopGameRanking(game, results);
    
    // Remove o jogo da lista de ativos
    delete activeGames[groupId];
  } catch (error) {
    logger.error('Erro ao finalizar jogo de Stop/Adedonha:', error);
    
    // Tenta enviar mensagem de erro
    try {
      await bot.sendMessage(groupId, '❌ Ocorreu um erro ao finalizar o jogo. Por favor, tente novamente.');
    } catch (sendError) {
      logger.error('Erro ao enviar mensagem de erro:', sendError);
    }
    
    // Garante que o jogo seja removido mesmo em caso de erro
    delete activeGames[groupId];
  }
}

/**
 * Atualiza o ranking do jogo Stop/Adedona
 * @param {Object} game - Objeto do jogo
 * @param {Object} results - Resultados da rodada
 */
async function updateStopGameRanking(game, results) {
  try {
    // Obtém variáveis personalizadas
    const customVariables = await database.getCustomVariables();
    
    // Inicializa ranking se não existir
    if (!customVariables.stopGameRanking) {
      customVariables.stopGameRanking = {
        groups: {}
      };
    }
    
    // Inicializa ranking do grupo se não existir
    const groupId = game.groupId;
    if (!customVariables.stopGameRanking.groups[groupId]) {
      customVariables.stopGameRanking.groups[groupId] = {};
    }
    
    // Atualiza ranking para cada jogador
    for (const [userId, result] of Object.entries(results)) {
      if (result.invalid) continue;
      
      // Atualiza ranking do grupo
      if (!customVariables.stopGameRanking.groups[groupId][userId]) {
        customVariables.stopGameRanking.groups[groupId][userId] = {
          name: result.userName,
          score: 0,
          games: 0,
          wins: 0
        };
      }
      
      customVariables.stopGameRanking.groups[groupId][userId].score += result.score;
      customVariables.stopGameRanking.groups[groupId][userId].games += 1;
      
      // Verifica se foi o vencedor (maior pontuação)
      const isWinner = Object.entries(results)
        .filter(([id, r]) => !r.invalid && id !== userId)
        .every(([, r]) => r.score <= result.score);
      
      if (isWinner) {
        customVariables.stopGameRanking.groups[groupId][userId].wins += 1;
      }
      
      // Atualiza nome se mudou
      customVariables.stopGameRanking.groups[groupId][userId].name = result.userName;
    }
    
    // Salva variáveis atualizadas
    await database.saveCustomVariables(customVariables);
  } catch (error) {
    logger.error('Erro ao atualizar ranking do jogo Stop/Adedona:', error);
  }
}

/**
 * Mostra o ranking do jogo Stop/Adedona
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function showStopGameRanking(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: '🏆 O ranking do jogo Stop/Adedona só pode ser visualizado em grupos.'
      });
    }
    
    const chatId = message.group;
    
    // Obtém as variáveis customizadas
    const customVariables = await database.getCustomVariables();
    
    // Verifica se existe ranking
    if (!customVariables.stopGameRanking || 
        !customVariables.stopGameRanking.groups ||
        !customVariables.stopGameRanking.groups[chatId]) {
      return new ReturnMessage({
        chatId,
        content: '🏆 Ainda não há ranking do jogo Stop/Adedona neste grupo. Jogue algumas partidas!'
      });
    }
    
    // Obtém o ranking do grupo
    const rankingData = customVariables.stopGameRanking.groups[chatId];
    
    // Converte para array para poder ordenar
    const players = Object.entries(rankingData).map(([id, data]) => ({
      id,
      ...data
    }));
    
    // Verifica se há jogadores
    if (players.length === 0) {
      return new ReturnMessage({
        chatId,
        content: '🏆 Ainda não há jogadores no ranking deste grupo. Jogue algumas partidas!'
      });
    }
    
    // Ordena por pontos (maior para menor)
    players.sort((a, b) => b.score - a.score);
    
    // Limita a 10 jogadores
    const topPlayers = players.slice(0, 10);
    
    // Prepara a mensagem de ranking
    let rankingMessage = `🏆 *Ranking do Stop/Adedona - ${group.name || "Grupo"}*\n\n`;
    
    topPlayers.forEach((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const avgPoints = player.games > 0 ? (player.score / player.games).toFixed(1) : '0.0';
      
      rankingMessage += `${medal} ${player.name}: ${player.score} pts (${player.games} jogos, média: ${avgPoints}, vitórias: ${player.wins})\n`;
    });
    
    return new ReturnMessage({
      chatId,
      content: rankingMessage
    });
  } catch (error) {
    logger.error('Erro ao mostrar ranking do jogo Stop/Adedona:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Erro ao mostrar ranking. Por favor, tente novamente.'
    });
  }
}

// Criar array de comandos usando a classe Command
const commands = [
  new Command({
    name: 'adedonha',
    description: 'Inicia um jogo de Stop/Adedonha',
    category: "jogos",
    cooldown: 60,
    reactions: {
      before: "🛑",
      after: "📝",
      error: "❌"
    },
    method: startStopGame
  }),
  
  new Command({
    name: 'stop',
    description: 'Alias para o jogo de Stop/Adedonha',
    category: "jogos",
    cooldown: 60,
    reactions: {
      before: "🛑",
      after: "📝",
      error: "❌"
    },
    method: startStopGame
  }),
  
  new Command({
    name: 'stop-ranking',
    description: 'Mostra o ranking do jogo Stop/Adedonha',
    category: "jogos",
    cooldown: 30,
    reactions: {
      after: "🏆",
      error: "❌"
    },
    method: showStopGameRanking
  })
];

//module.exports = { commands, processStopGameResponse };