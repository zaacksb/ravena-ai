const axios = require('axios');
const Logger = require('../utils/Logger');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

// Create a new logger
const logger = new Logger('riot-games-commands');

// Riot Games API key from environment variables
const RIOT_API_KEY = process.env.RIOT_API_KEY;

// Base URLs for different Riot APIs
const LOL_BASE_URL = 'https://br1.api.riotgames.com/lol'; // Default to NA region
const VALORANT_BASE_URL = 'https://br1.api.riotgames.com/val';
const WR_BASE_URL = 'https://br1.api.riotgames.com/riot/account/v1';

// Emoji mapping for ranked tiers
const RANK_EMOJIS = {
  'IRON': '🔗',
  'BRONZE': '🥉',
  'SILVER': '🥈',
  'GOLD': '🥇',
  'PLATINUM': '💎',
  'DIAMOND': '💍',
  'MASTER': '🏆',
  'GRANDMASTER': '👑',
  'CHALLENGER': '⚡'
};

// Emoji mapping for positions/roles
const POSITION_EMOJIS = {
  'TOP': '🛡️',
  'JUNGLE': '🌳',
  'MIDDLE': '🧙‍♂️',
  'BOTTOM': '🏹',
  'SUPPORT': '💉'
};

/**
 * Get rank emoji for a tier
 * @param {string} tier - Rank tier (e.g., GOLD, PLATINUM)
 * @returns {string} - Corresponding emoji
 */
function getRankEmoji(tier) {
  return RANK_EMOJIS[tier] || '❓';
}

/**
 * Format number with commas for thousands
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Get League of Legends summoner data
 * @param {string} summonerName - Summoner name to look up
 * @returns {Promise<Object>} - Formatted summoner data
 */
async function getLolSummonerData(summonerName) {
  try {
    // Fetch summoner by name
    const summonerResponse = await axios.get(
      `${LOL_BASE_URL}/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    
    const summoner = summonerResponse.data;
    
    // Fetch ranked data
    const rankedResponse = await axios.get(
      `${LOL_BASE_URL}/league/v4/entries/by-summoner/${summoner.id}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    
    // Fetch mastery data (top 5 champions)
    const masteryResponse = await axios.get(
      `${LOL_BASE_URL}/champion-mastery/v4/champion-masteries/by-summoner/${summoner.id}/top?count=5`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    
    // Get champion data to map champion IDs to names
    const championResponse = await axios.get(
      'http://ddragon.leagueoflegends.com/cdn/latest/data/en_US/champion.json'
    );
    
    const championData = championResponse.data.data;
    const championIdToName = {};
    
    // Map champion IDs to names
    for (const champKey in championData) {
      const champion = championData[champKey];
      championIdToName[champion.key] = champion.name;
    }
    
    // Process ranked data
    const soloQueue = rankedResponse.data.find(queue => queue.queueType === 'RANKED_SOLO_5x5') || {};
    const flexQueue = rankedResponse.data.find(queue => queue.queueType === 'RANKED_FLEX_SR') || {};
    
    // Process mastery data
    const masteryData = masteryResponse.data.map(mastery => ({
      championName: championIdToName[mastery.championId] || `Champion #${mastery.championId}`,
      championLevel: mastery.championLevel,
      championPoints: mastery.championPoints
    }));
    
    return {
      name: summoner.name,
      level: summoner.summonerLevel,
      profileIconId: summoner.profileIconId,
      soloQueue: {
        tier: soloQueue.tier || 'UNRANKED',
        rank: soloQueue.rank || '',
        leaguePoints: soloQueue.leaguePoints || 0,
        wins: soloQueue.wins || 0,
        losses: soloQueue.losses || 0
      },
      flexQueue: {
        tier: flexQueue.tier || 'UNRANKED',
        rank: flexQueue.rank || '',
        leaguePoints: flexQueue.leaguePoints || 0,
        wins: flexQueue.wins || 0,
        losses: flexQueue.losses || 0
      },
      mastery: masteryData
    };
  } catch (error) {
    logger.error(`Error fetching LoL data for ${summonerName}:`, error.message);
    throw new Error(`Não foi possível encontrar o invocador "${summonerName}" ou ocorreu um erro durante a busca.`);
  }
}

/**
 * Format LoL summoner data into a message
 * @param {Object} data - Summoner data
 * @returns {string} - Formatted message
 */
function formatLolMessage(data) {
  // Calculate win rates
  const soloWinRate = data.soloQueue.wins + data.soloQueue.losses > 0 
    ? Math.round((data.soloQueue.wins / (data.soloQueue.wins + data.soloQueue.losses)) * 100) 
    : 0;
    
  const flexWinRate = data.flexQueue.wins + data.flexQueue.losses > 0 
    ? Math.round((data.flexQueue.wins / (data.flexQueue.wins + data.flexQueue.losses)) * 100) 
    : 0;
  
  let message = `🎮 *League of Legends - ${data.name}*\n`;
  message += `📊 Nível: ${data.level}\n\n`;
  
  // Solo/Duo queue
  message += `*💪 Ranqueada Solo/Duo:*\n`;
  if (data.soloQueue.tier === 'UNRANKED') {
    message += `Sem classificação\n`;
  } else {
    message += `${getRankEmoji(data.soloQueue.tier)} ${data.soloQueue.tier} ${data.soloQueue.rank} (${data.soloQueue.leaguePoints} LP)\n`;
    message += `🏅 ${data.soloQueue.wins}V ${data.soloQueue.losses}D (${soloWinRate}% de vitórias)\n`;
  }
  
  // Flex queue
  message += `\n*👥 Ranqueada Flex:*\n`;
  if (data.flexQueue.tier === 'UNRANKED') {
    message += `Sem classificação\n`;
  } else {
    message += `${getRankEmoji(data.flexQueue.tier)} ${data.flexQueue.tier} ${data.flexQueue.rank} (${data.flexQueue.leaguePoints} LP)\n`;
    message += `🏅 ${data.flexQueue.wins}V ${data.flexQueue.losses}D (${flexWinRate}% de vitórias)\n`;
  }
  
  // Champion mastery
  message += `\n*🏆 Principais Campeões:*\n`;
  for (let i = 0; i < data.mastery.length; i++) {
    const champ = data.mastery[i];
    message += `${i+1}. ${champ.championName} (Nível ${champ.championLevel}, ${formatNumber(champ.championPoints)} pts)\n`;
  }
  
  return message;
}

/**
 * Get Wild Rift player data
 * @param {string} gameName - Game name to look up
 * @param {string} tagLine - Tag line (e.g., "NA1")
 * @returns {Promise<Object>} - Formatted player data
 */
async function getWildRiftPlayerData(gameName, tagLine) {
  try {
    // In a real implementation, we would use the Riot Account API to get the PUUID
    // Then use that PUUID with the Wild Rift API
    // For now, we'll create a simplified simulation since Wild Rift API isn't fully public
    
    // Fetch Riot account by riot ID (gameName#tagLine)
    const accountResponse = await axios.get(
      `${WR_BASE_URL}/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    
    const puuid = accountResponse.data.puuid;
    
    // NOTE: The below is simulated as the Wild Rift API isn't fully public
    // In a real implementation, these would be actual API calls
    
    // Simulate ranked data
    const simulatedRankedData = {
      tier: ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'][Math.floor(Math.random() * 10)],
      rank: ['IV', 'III', 'II', 'I'][Math.floor(Math.random() * 4)],
      leaguePoints: Math.floor(Math.random() * 100),
      wins: Math.floor(Math.random() * 100) + 50,
      losses: Math.floor(Math.random() * 100)
    };
    
    // Simulate top champions
    const sampleChampions = [
      "Ahri", "Akali", "Ashe", "Braum", "Darius", "Evelynn", "Ezreal", 
      "Gragas", "Jhin", "Jinx", "Lee Sin", "Leona", "Lux", "Master Yi", 
      "Miss Fortune", "Nasus", "Singed", "Sona", "Soraka", "Teemo", "Vayne", "Yasuo"
    ];
    
    const simulatedMasteryData = [];
    for (let i = 0; i < 5; i++) {
      simulatedMasteryData.push({
        championName: sampleChampions[Math.floor(Math.random() * sampleChampions.length)],
        championLevel: Math.floor(Math.random() * 5) + 3,
        championPoints: Math.floor(Math.random() * 50000) + 20000
      });
    }
    
    return {
      name: gameName,
      tagLine: tagLine,
      puuid: puuid,
      ranked: simulatedRankedData,
      mastery: simulatedMasteryData
    };
  } catch (error) {
    logger.error(`Error fetching Wild Rift data for ${gameName}#${tagLine}:`);
    throw new Error(`Não foi possível encontrar o jogador de Wild Rift "${gameName}#${tagLine}" ou ocorreu um erro durante a busca.`);
  }
}

/**
 * Format Wild Rift player data into a message
 * @param {Object} data - Player data
 * @returns {string} - Formatted message
 */
function formatWildRiftMessage(data) {
  // Calculate win rate
  const winRate = Math.round((data.ranked.wins / (data.ranked.wins + data.ranked.losses)) * 100);
  
  let message = `📱 *Wild Rift - ${data.name}#${data.tagLine}*\n\n`;
  
  // Ranked info
  message += `*🏆 Ranqueada:*\n`;
  message += `${getRankEmoji(data.ranked.tier)} ${data.ranked.tier} ${data.ranked.rank} (${data.ranked.leaguePoints} LP)\n`;
  message += `🏅 ${data.ranked.wins}V ${data.ranked.losses}D (${winRate}% de vitórias)\n`;
  
  // Champion mastery
  message += `\n*🏆 Principais Campeões:*\n`;
  for (let i = 0; i < data.mastery.length; i++) {
    const champ = data.mastery[i];
    message += `${i+1}. ${champ.championName} (Nível ${champ.championLevel}, ${formatNumber(champ.championPoints)} pts)\n`;
  }
  
  return message;
}

/**
 * Get Valorant player data
 * @param {string} gameName - Game name to look up
 * @param {string} tagLine - Tag line (e.g., "NA1")
 * @returns {Promise<Object>} - Formatted player data
 */
async function getValorantPlayerData(gameName, tagLine) {
  try {
    // Fetch Riot account by riot ID (gameName#tagLine)
    const accountResponse = await axios.get(
      `${WR_BASE_URL}/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { headers: { 'X-Riot-Token': RIOT_API_KEY } }
    );
    
    const puuid = accountResponse.data.puuid;
    
    // NOTE: The below is simulated as we don't have full access to Valorant API
    // In a real implementation, these would be actual API calls
    
    // Simulate ranked data
    const ranks = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'ASCENDANT', 'IMMORTAL', 'RADIANT'];
    const simulatedRankedData = {
      tier: ranks[Math.floor(Math.random() * ranks.length)],
      rank: ranks[ranks.length - 1] === 'RADIANT' ? '' : ['I', 'II', 'III'][Math.floor(Math.random() * 3)],
      rr: Math.floor(Math.random() * 100),
      wins: Math.floor(Math.random() * 100) + 20,
      losses: Math.floor(Math.random() * 100)
    };
    
    // Simulate agent data
    const agents = [
      "Jett", "Raze", "Breach", "Omen", "Brimstone", 
      "Phoenix", "Sage", "Sova", "Viper", "Cypher", 
      "Reyna", "Killjoy", "Skye", "Yoru", "Astra", 
      "KAY/O", "Chamber", "Neon", "Fade", "Harbor",
      "Gekko", "Deadlock", "Iso", "Clove"
    ];
    
    const simulatedAgentData = [];
    // Get 5 random unique agents
    const chosenAgents = new Set();
    while (chosenAgents.size < 5) {
      chosenAgents.add(agents[Math.floor(Math.random() * agents.length)]);
    }
    
    chosenAgents.forEach(agent => {
      simulatedAgentData.push({
        name: agent,
        matches: Math.floor(Math.random() * 50) + 10,
        winRate: Math.floor(Math.random() * 70) + 30,
        kda: (Math.random() * 2 + 1).toFixed(2)
      });
    });
    
    return {
      name: gameName,
      tagLine: tagLine,
      puuid: puuid,
      ranked: simulatedRankedData,
      agents: simulatedAgentData
    };
  } catch (error) {
    logger.error(`Error fetching Valorant data for ${gameName}#${tagLine}:`);
    throw new Error(`Não foi possível encontrar o jogador de Valorant "${gameName}#${tagLine}" ou ocorreu um erro durante a busca.`);
  }
}

/**
 * Format Valorant player data into a message
 * @param {Object} data - Player data
 * @returns {string} - Formatted message
 */
function formatValorantMessage(data) {
  // Calculate win rate
  const winRate = Math.round((data.ranked.wins / (data.ranked.wins + data.ranked.losses)) * 100);
  
  let message = `🔫 *Valorant - ${data.name}#${data.tagLine}*\n\n`;
  
  // Ranked info
  message += `*🏆 Rank Competitivo:*\n`;
  const rankStr = data.ranked.tier === 'RADIANT' ? 'RADIANT' : `${data.ranked.tier} ${data.ranked.rank}`;
  message += `${getRankEmoji(data.ranked.tier)} ${rankStr} (${data.ranked.rr} RR)\n`;
  message += `🏅 ${data.ranked.wins}V ${data.ranked.losses}D (${winRate}% de vitórias)\n`;
  
  // Top agents
  message += `\n*👤 Principais Agentes:*\n`;
  for (let i = 0; i < data.agents.length; i++) {
    const agent = data.agents[i];
    message += `${i+1}. ${agent.name} - ${agent.matches} partidas, ${agent.winRate}% VIT, ${agent.kda} KDA\n`;
  }
  
  return message;
}

/**
 * Parse a Riot ID from input
 * @param {Array} args - Command arguments
 * @returns {Object} - Parsed game name and tag line
 */
function parseRiotId(args) {
  // If the input has a hashtag, split by it
  const input = args.join(' ');
  if (input.includes('#')) {
    const [gameName, tagLine] = input.split('#');
    return { gameName, tagLine };
  }
  
  // Otherwise, look for the last word and assume it's the tagLine
  if (args.length >= 2) {
    const tagLine = args.pop();
    const gameName = args.join(' ');
    return { gameName, tagLine };
  }
  
  // If only one word, assume it's a legacy LoL summoner name (no tagline needed)
  return { gameName: input, tagLine: null };
}

/**
 * Handles the LoL command
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} message - Message data
 * @param {Array} args - Command arguments
 * @param {Object} group - Group data
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage or array of ReturnMessages
 */
async function handleLolCommand(bot, message, args, group) {
  const chatId = message.group || message.author;
  const returnMessages = [];
  
  try {
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça um nome de invocador. Exemplo: !lol Faker'
      });
    }
    
    const summonerName = args.join(' ');
    
    // Send a waiting message
    returnMessages.push(
      new ReturnMessage({
        chatId: chatId,
        content: `🔍 Buscando invocador: ${summonerName}...`
      })
    );
    
    // Get summoner data
    const summonerData = await getLolSummonerData(summonerName);
    
    // Format message
    const formattedMessage = formatLolMessage(summonerData);
    
    // Send response
    return new ReturnMessage({
      chatId: chatId,
      content: formattedMessage
    });
    
  } catch (error) {
    logger.error('Erro ao executar comando lol:');
    return new ReturnMessage({
      chatId: chatId,
      content: `Erro: ${error.message || 'Ocorreu um erro ao buscar o invocador.'}`
    });
  }
}

/**
 * Handles the WR command
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} message - Message data
 * @param {Array} args - Command arguments
 * @param {Object} group - Group data
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage or array of ReturnMessages
 */
async function handleWRCommand(bot, message, args, group) {
  const chatId = message.group || message.author;
  const returnMessages = [];
  
  try {
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça um Riot ID (ex: !wr NomeJogador#NA1)'
      });
    }
    
    // Parse the Riot ID
    const { gameName, tagLine } = parseRiotId(args);
    
    if (!tagLine) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça um Riot ID completo com tagline (ex: NomeJogador#NA1)'
      });
    }
    
    // Send a waiting message
    returnMessages.push(
      new ReturnMessage({
        chatId: chatId,
        content: `🔍 Buscando jogador de Wild Rift: ${gameName}#${tagLine}...`
      })
    );
    
    // Get player data
    const playerData = await getWildRiftPlayerData(gameName, tagLine);
    
    // Format message
    const formattedMessage = formatWildRiftMessage(playerData);
    
    // Send response
    return new ReturnMessage({
      chatId: chatId,
      content: formattedMessage
    });
    
  } catch (error) {
    logger.error('Erro ao executar comando wr:');
    return new ReturnMessage({
      chatId: chatId,
      content: `Erro: ${error.message || 'Ocorreu um erro ao buscar o jogador.'}`
    });
  }
}

/**
 * Handles the Valorant command
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} message - Message data
 * @param {Array} args - Command arguments
 * @param {Object} group - Group data
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage or array of ReturnMessages
 */
async function handleValorantCommand(bot, message, args, group) {
  const chatId = message.group || message.author;
  const returnMessages = [];
  
  try {
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça um Riot ID (ex: !valorant NomeJogador#NA1)'
      });
    }
    
    // Parse the Riot ID
    const { gameName, tagLine } = parseRiotId(args);
    
    if (!tagLine) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça um Riot ID completo com tagline (ex: NomeJogador#NA1)'
      });
    }
    
    // Send a waiting message
    returnMessages.push(
      new ReturnMessage({
        chatId: chatId,
        content: `🔍 Buscando jogador de Valorant: ${gameName}#${tagLine}...`
      })
    );
    
    // Get player data
    const playerData = await getValorantPlayerData(gameName, tagLine);
    
    // Format message
    const formattedMessage = formatValorantMessage(playerData);
    
    // Send response
    return new ReturnMessage({
      chatId: chatId,
      content: formattedMessage
    });
    
  } catch (error) {
    logger.error('Erro ao executar comando valorant:');
    return new ReturnMessage({
      chatId: chatId,
      content: `Erro: ${error.message || 'Ocorreu um erro ao buscar o jogador.'}`
    });
  }
}

// Define commands using Command class
const commands = [
  new Command({
    name: 'lol',
    description: 'Busca perfil de jogador de League of Legends',
    category: "jogos",
    reactions: {
      before: "⏳",
      after: "🎮",
      error: "❌"
    },
    method: handleLolCommand
  }),
  
  new Command({
    name: 'wr',
    description: 'Busca perfil de jogador de Wild Rift',
    category: "jogos",
    reactions: {
      before: "⏳",
      after: "📱",
      error: "❌"
    },
    method: handleWRCommand
  }),
  
  new Command({
    name: 'valorant',
    description: 'Busca perfil de jogador de Valorant',
    category: "jogos",
    reactions: {
      before: "⏳",
      after: "🔫",
      error: "❌"
    },
    method: handleValorantCommand
  })
];

// Registra os comandos
//logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };