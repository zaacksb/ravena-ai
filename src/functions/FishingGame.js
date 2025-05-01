// src/functions/FishingGame.js
const path = require('path');
const fs = require('fs').promises;
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const Database = require('../utils/Database');

const logger = new Logger('fishing-game');
const database = Database.getInstance();

// Constantes do jogo
const MAX_FISH_PER_USER = 10;
const MIN_FISH_WEIGHT = 1;
const MAX_FISH_WEIGHT = 30;
const FISHING_COOLDOWN = 5 * 60; // 5 minutos em segundos

// Armazena os cooldowns de pesca
const fishingCooldowns = {};

/**
 * Obtém peixe aleatório do array de peixes
 * @param {Array} fishArray - Array com nomes de peixes
 * @returns {Object} Peixe sorteado com peso
 */
function getRandomFish(fishArray) {
  // Verifica se o array tem peixes
  if (!fishArray || !Array.isArray(fishArray) || fishArray.length === 0) {
    // Lista de peixes padrão caso não tenha
    fishArray = [
      "Tilápia", "Tucunaré", "Tambaqui", "Dourado", "Pintado", 
      "Pirarucu", "Traíra", "Pacu", "Robalo", "Salmão", 
      "Atum", "Sardinha", "Bacalhau", "Piranha", "Peixe-Boi",
      "Lambari", "Bagre", "Linguado", "Anchova", "Corvina"
    ];
  }
  
  // Seleciona um peixe aleatório
  const fishIndex = Math.floor(Math.random() * fishArray.length);
  const fishName = fishArray[fishIndex];
  
  // Gera um peso aleatório entre MIN e MAX
  const weight = parseFloat((Math.random() * (MAX_FISH_WEIGHT - MIN_FISH_WEIGHT) + MIN_FISH_WEIGHT).toFixed(2));
  
  return {
    name: fishName,
    weight,
    timestamp: Date.now()
  };
}

/**
 * Pescar um peixe
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function fishCommand(bot, message, args, group) {
  try {
    // Obtém IDs do chat e do usuário
    const chatId = message.group || message.author;
    const userId = message.author;
    const userName = message.authorName || "Pescador";
    
    // Verifica cooldown
    const now = Math.floor(Date.now() / 1000);
    if (fishingCooldowns[userId] && now < fishingCooldowns[userId]) {
      const timeLeft = fishingCooldowns[userId] - now;
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      
      return new ReturnMessage({
        chatId,
        content: `🎣 ${userName}, você precisa esperar ${minutes}m ${seconds}s para pescar novamente.`
      });
    }
    
    // Obtém variáveis personalizadas
    const customVariables = await database.getCustomVariables();
    
    // Inicializa peixes se não existir
    if (!customVariables.peixes) {
      customVariables.peixes = [];
    }
    
    // Inicializa fishing se não existir
    if (!customVariables.fishing) {
      customVariables.fishing = {};
    }
    
    // Inicializa lista de peixes do usuário
    if (!customVariables.fishing[userId]) {
      customVariables.fishing[userId] = {
        name: userName,
        fishes: [],
        totalWeight: 0,
        biggestFish: null,
        totalCatches: 0
      };
    } else {
      // Atualiza nome do usuário se mudou
      customVariables.fishing[userId].name = userName;
    }
    
    // Obtém o peixe aleatório
    const fish = getRandomFish(customVariables.peixes);
    
    // Atualiza estatísticas do usuário
    customVariables.fishing[userId].totalCatches++;
    customVariables.fishing[userId].totalWeight += fish.weight;
    
    // Verifica se é o maior peixe
    if (!customVariables.fishing[userId].biggestFish || 
        fish.weight > customVariables.fishing[userId].biggestFish.weight) {
      customVariables.fishing[userId].biggestFish = fish;
    }
    
    // Adiciona o peixe à lista do usuário, mantendo apenas os MAX_FISH_PER_USER mais recentes
    customVariables.fishing[userId].fishes.push(fish);
    if (customVariables.fishing[userId].fishes.length > MAX_FISH_PER_USER) {
      // Se exceder o limite, remove o peixe mais antigo
      const oldFish = customVariables.fishing[userId].fishes.shift();
      // Ajusta o peso total
      customVariables.fishing[userId].totalWeight -= oldFish.weight;
    }
    
    // Salva as variáveis atualizadas
    await database.saveCustomVariables(customVariables);
    
    // Define o cooldown
    fishingCooldowns[userId] = now + FISHING_COOLDOWN;
    
    // Seleciona uma mensagem aleatória
    const fishingMessages = [
      `🎣 ${userName} pescou um(a) ${fish.name} de ${fish.weight.toFixed(2)} kg!`,
      `🐟 Wow! ${userName} fisgou um(a) ${fish.name} pesando ${fish.weight.toFixed(2)} kg!`,
      `🎣 Um(a) ${fish.name} de ${fish.weight.toFixed(2)} kg mordeu a isca de ${userName}!`,
      `🐠 ${userName} recolheu a linha e encontrou um(a) ${fish.name} de ${fish.weight.toFixed(2)} kg!`,
      `🏆 ${userName} capturou um(a) impressionante ${fish.name} de ${fish.weight.toFixed(2)} kg!`
    ];
    
    const randomMessage = fishingMessages[Math.floor(Math.random() * fishingMessages.length)];
    
    // Adiciona informações adicionais para peixes grandes
    let additionalInfo = '';
    if (fish.weight > 20) {
      additionalInfo = '\n\n🏆 Uau! Este é um peixe enorme!';
    } else if (fish.weight > 15) {
      additionalInfo = '\n\n👏 Que belo exemplar!';
    }
    
    // Adiciona informação sobre o maior peixe do usuário
    additionalInfo += `\n\n🐳 Seu maior peixe: ${customVariables.fishing[userId].biggestFish.name} (${customVariables.fishing[userId].biggestFish.weight.toFixed(2)} kg)`;
    
    return new ReturnMessage({
      chatId,
      content: randomMessage + additionalInfo,
      reactions: {
        after: "🎣"
      }
    });
  } catch (error) {
    logger.error('Erro no comando de pesca:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Ocorreu um erro ao pescar. Por favor, tente novamente.'
    });
  }
}

/**
 * Mostra os peixes do jogador
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function myFishCommand(bot, message, args, group) {
  try {
    // Obtém IDs do chat e do usuário
    const chatId = message.group || message.author;
    const userId = message.author;
    const userName = message.authorName || "Pescador";
    
    // Obtém variáveis personalizadas
    const customVariables = await database.getCustomVariables();
    
    // Verifica se o usuário tem peixes
    if (!customVariables.fishing || !customVariables.fishing[userId]) {
      return new ReturnMessage({
        chatId,
        content: `🎣 ${userName}, você ainda não pescou nenhum peixe. Use !pescar para começar.`
      });
    }
    
    const userData = customVariables.fishing[userId];
    const fishes = userData.fishes;
    
    // Prepara a mensagem
    let fishMessage = `🎣 *Peixes de ${userName}*\n\n`;
    
    if (fishes.length === 0) {
      fishMessage += 'Você ainda não tem peixes no seu inventário. Use !pescar para começar.';
    } else {
      // Ordena por peso (maior para menor)
      const sortedFishes = [...fishes].sort((a, b) => b.weight - a.weight);
      
      // Lista os peixes
      sortedFishes.forEach((fish, index) => {
        fishMessage += `${index + 1}. ${fish.name}: ${fish.weight.toFixed(2)} kg\n`;
      });
      
      // Adiciona estatísticas
      fishMessage += `\n*Estatísticas*:\n`;
      fishMessage += `Total de peixes: ${userData.totalCatches}\n`;
      fishMessage += `Peso total atual: ${userData.totalWeight.toFixed(2)} kg\n`;
      fishMessage += `Maior peixe: ${userData.biggestFish.name} (${userData.biggestFish.weight.toFixed(2)} kg)\n`;
      fishMessage += `Inventário atual: ${fishes.length}/${MAX_FISH_PER_USER} peixes\n`;
      
      // Informa sobre o limite de inventário
      if (fishes.length >= MAX_FISH_PER_USER) {
        fishMessage += `\n⚠️ Seu inventário está cheio! Ao pescar novamente, seu peixe mais antigo será liberado.`;
      }
    }
    
    return new ReturnMessage({
      chatId,
      content: fishMessage
    });
  } catch (error) {
    logger.error('Erro ao mostrar peixes do jogador:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Ocorreu um erro ao mostrar seus peixes. Por favor, tente novamente.'
    });
  }
}

/**
 * Mostra o ranking de pescaria
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function fishingRankingCommand(bot, message, args, group) {
  try {
    // Obtém ID do chat
    const chatId = message.group || message.author;
    
    // Obtém variáveis personalizadas
    const customVariables = await database.getCustomVariables();
    
    // Verifica se há dados de pescaria
    if (!customVariables.fishing || Object.keys(customVariables.fishing).length === 0) {
      return new ReturnMessage({
        chatId,
        content: '🎣 Ainda não há dados de pescaria. Use !pescar para começar.'
      });
    }
    
    // Converte dados para array
    const players = Object.entries(customVariables.fishing).map(([id, data]) => ({
      id,
      ...data
    }));
    
    // Determina o tipo de ranking
    let rankingType = 'weight';
    if (args.length > 0 && args[0].toLowerCase() === 'quantidade') {
      rankingType = 'count';
    }
    
    // Ordena jogadores com base no tipo de ranking
    if (rankingType === 'weight') {
      // Ordena por peso total
      players.sort((a, b) => b.totalWeight - a.totalWeight);
    } else {
      // Ordena por quantidade total de peixes
      players.sort((a, b) => b.totalCatches - a.totalCatches);
    }
    
    // Prepara a mensagem de ranking
    let rankingMessage = `🏆 *Ranking de Pescaria* (${rankingType === 'weight' ? 'Peso Total' : 'Quantidade Total'})\n\n`;
    
    // Lista os 10 primeiros jogadores
    const topPlayers = players.slice(0, 10);
    topPlayers.forEach((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      
      if (rankingType === 'weight') {
        rankingMessage += `${medal} ${player.name}: ${player.totalWeight.toFixed(2)} kg (${player.totalCatches} peixes)\n`;
      } else {
        rankingMessage += `${medal} ${player.name}: ${player.totalCatches} peixes (${player.totalWeight.toFixed(2)} kg)\n`;
      }
    });
    
    // Informações sobre o outro ranking
    rankingMessage += `\nPara ver o ranking por ${rankingType === 'weight' ? 'quantidade' : 'peso'}, use !pesca-ranking ${rankingType === 'weight' ? 'quantidade' : 'peso'}`;
    
    return new ReturnMessage({
      chatId,
      content: rankingMessage
    });
  } catch (error) {
    logger.error('Erro ao mostrar ranking de pescaria:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Ocorreu um erro ao mostrar o ranking. Por favor, tente novamente.'
    });
  }
}

/**
 * Mostra os maiores peixes pescados
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function biggestFishCommand(bot, message, args, group) {
  try {
    // Obtém ID do chat
    const chatId = message.group || message.author;
    
    // Obtém variáveis personalizadas
    const customVariables = await database.getCustomVariables();
    
    // Verifica se há dados de pescaria
    if (!customVariables.fishing || Object.keys(customVariables.fishing).length === 0) {
      return new ReturnMessage({
        chatId,
        content: '🎣 Ainda não há dados de pescaria. Use !pescar para começar.'
      });
    }
    
    // Cria uma lista de todos os maiores peixes
    const biggestFishes = [];
    
    for (const [userId, userData] of Object.entries(customVariables.fishing)) {
      if (userData.biggestFish) {
        biggestFishes.push({
          playerName: userData.name,
          ...userData.biggestFish
        });
      }
    }
    
    // Verifica se há peixes
    if (biggestFishes.length === 0) {
      return new ReturnMessage({
        chatId,
        content: '🎣 Ainda não há registros de peixes. Use !pescar para começar.'
      });
    }
    
    // Ordena por peso (maior para menor)
    biggestFishes.sort((a, b) => b.weight - a.weight);
    
    // Prepara a mensagem
    let fishMessage = '🐋 *Os Maiores Peixes Pescados*\n\n';
    
    // Lista os 10 maiores peixes
    const topFishes = biggestFishes.slice(0, 10);
    topFishes.forEach((fish, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      fishMessage += `${medal} ${fish.playerName}: ${fish.name} de ${fish.weight.toFixed(2)} kg\n`;
    });
    
    return new ReturnMessage({
      chatId,
      content: fishMessage
    });
  } catch (error) {
    logger.error('Erro ao mostrar maiores peixes:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Ocorreu um erro ao mostrar os maiores peixes. Por favor, tente novamente.'
    });
  }
}


/**
 * Lista todos os tipos de peixes disponíveis
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function listFishTypesCommand(bot, message, args, group) {
  try {
    // Obtém ID do chat
    const chatId = message.group || message.author;
    
    // Obtém variáveis personalizadas
    const customVariables = await database.getCustomVariables();
    
    // Verifica se há peixes
    if (!customVariables.peixes || customVariables.peixes.length === 0) {
      return new ReturnMessage({
        chatId,
        content: '🎣 Ainda não há tipos de peixes definidos. O sistema usará peixes padrão.'
      });
    }
    
    // Ordena alfabeticamente
    const sortedFishes = [...customVariables.peixes].sort();
    
    // Prepara a mensagem
    let fishMessage = '🐟 *Lista de Peixes Disponíveis*\n\n';
    
    // Agrupa em colunas
    const columns = 2;
    const rows = Math.ceil(sortedFishes.length / columns);
    
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < columns; j++) {
        const index = i + j * rows;
        if (index < sortedFishes.length) {
          fishMessage += `${sortedFishes[index]}`;
          // Adiciona espaço ou quebra de linha
          if (j < columns - 1 && i + (j + 1) * rows < sortedFishes.length) {
            fishMessage += ' | ';
          }
        }
      }
      fishMessage += '\n';
    }
    
    fishMessage += `\nTotal: ${sortedFishes.length} tipos de peixes`;
    
    return new ReturnMessage({
      chatId,
      content: fishMessage
    });
  } catch (error) {
    logger.error('Erro ao listar tipos de peixes:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Ocorreu um erro ao listar os tipos de peixes. Por favor, tente novamente.'
    });
  }
}


// Criar array de comandos usando a classe Command
const commands = [
  new Command({
    name: 'pescar',
    description: 'Pesque um peixe aleatório',
    category: "jogos",
    cooldown: 0, // O cooldown é gerenciado internamente
    reactions: {
      before: "🎣",
      after: "🐟",
      error: "❌"
    },
    method: fishCommand
  }),
  
  new Command({
    name: 'meus-pescados',
    description: 'Mostra seus peixes pescados',
    category: "jogos",
    cooldown: 10,
    reactions: {
      after: "🐠",
      error: "❌"
    },
    method: myFishCommand
  }),
  
  new Command({
    name: 'pesca-ranking',
    description: 'Mostra o ranking de pescaria',
    category: "jogos",
    cooldown: 30,
    reactions: {
      after: "🏆",
      error: "❌"
    },
    method: fishingRankingCommand
  }),
  
  new Command({
    name: 'pescados',
    description: 'Mostra os maiores peixes pescados',
    category: "jogos",
    cooldown: 30,
    reactions: {
      after: "🐋",
      error: "❌"
    },
    method: biggestFishCommand
  }),
  new Command({
    name: 'pesca-peixes',
    description: 'Lista todos os tipos de peixes disponíveis',
    category: "jogos",
    cooldown: 30,
    reactions: {
      after: "📋",
      error: "❌"
    },
    method: listFishTypesCommand
  })
];

module.exports = { commands };