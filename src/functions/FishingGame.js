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
const MAX_FISH_WEIGHT = 51;
const FISHING_COOLDOWN = 5 * 60; // 5 minutos em segundos

// Armazena os cooldowns de pesca
const fishingCooldowns = {};

// Caminho para o arquivo de dados de pesca
const FISHING_DATA_PATH = path.join(__dirname, '../../data/fishing.json');

/**
 * Obtém os dados de pesca do arquivo JSON dedicado
 * @returns {Promise<Object>} Dados de pesca
 */
async function getFishingData() {
  try {
    // Verifica se o arquivo existe
    try {
      await fs.access(FISHING_DATA_PATH);
    } catch (error) {
      // Se o arquivo não existir, cria um novo com estrutura padrão
      const defaultData = {
        fishingData: {}, // Dados dos jogadores
        groupData: {}  // Dados por grupo
      };
      await fs.writeFile(FISHING_DATA_PATH, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }

    // Lê o arquivo
    const data = await fs.readFile(FISHING_DATA_PATH, 'utf8');
    const parsedData = JSON.parse(data);
    
    // Verifica se o campo groupData existe, caso contrário, adiciona-o
    if (!parsedData.groupData) {
      parsedData.groupData = {};
      // Salva o arquivo atualizado
      await fs.writeFile(FISHING_DATA_PATH, JSON.stringify(parsedData, null, 2));
    }
    
    return parsedData;
  } catch (error) {
    logger.error('Erro ao ler dados de pesca:', error);
    // Retorna objeto padrão em caso de erro
    return {
      fishingData: {},
      groupData: {}
    };
  }
}

/**
 * Salva os dados de pesca no arquivo JSON dedicado
 * @param {Object} fishingData Dados de pesca a serem salvos
 * @returns {Promise<boolean>} Status de sucesso
 */
async function saveFishingData(fishingData) {
  try {
    // Garante que o diretório exista
    const dir = path.dirname(FISHING_DATA_PATH);
    await fs.mkdir(dir, { recursive: true });

    // Salva os dados
    await fs.writeFile(FISHING_DATA_PATH, JSON.stringify(fishingData, null, 2));
    return true;
  } catch (error) {
    logger.error('Erro ao salvar dados de pesca:', error);
    return false;
  }
}

/**
 * Obtém peixe aleatório do array de peixes
 * @param {Array} fishArray - Array com nomes de peixes
 * @returns {Object} Peixe sorteado com peso
 */
function getRandomFish(fishArray) {
  // Verifica se o array tem peixes
  if (!fishArray || !Array.isArray(fishArray) || fishArray.length === 0) {
    // Lista de peixes padrão caso não tenha
    fishArray = ["Aba-aba","Abrotea","Acará","Acari","Agulha","Anchova","Arenque","Arraia","Aruanã","Atum","Bacalhau","Badejo","Bagre","Baiacu","Barbo","Barracuda","Betta","Betara","Bicuda","Bótia","Black Bass","Bonito","Bota-velha","Budião","Baiacu-de-espinhos","Cachara","Cação","Caranha","Carapau","Carapeba","Tubarão","Carapicu","Cascudo","Cachorra","Clarias","Candiru","Carpa","Cavala","Cavalinha","Cavalo-marinho","Cherne","Celacanto","Ciliares","Cirurgião-patela","Congro","Corvina","Curimã","Curimbatá","Dunkerocampus dactyliophorus","Dojô","Dourada","Dourado","Enguia","Espadarte","Estriatos","Esturjão","Enchova","Frade-de-rabo-de-andorinha","Frade-vermelho","Garoupa","Guarajuba","Guaru","Hadoque","Jacundá","Jamanta","Jaú","Kipper","Lambari","Lampreia","Linguado","Limpa-vidro","Mandi","Manjuba","Marlim-branco","Martens-belo","Martens-do-mar","Martens-roxo","Matrinxã","Merluza","Mero","Miraguaia","Mapará","Moreia","Muçum","Mugil cephalus","Namorado","Neon","Neymar-cirurgião","Olhete","Olho-de-boi","Oscar","Pacu","Pampo","Papa-terra","Parati","Patinga","Pargo","Paru","Pavlaki Branco","Pavlaki-da-areia","Peixe-anjo","Peixe-agulha","Peixe-aranha","Peixe-arlequim","Peixe-bala","Peixe-borboleta","Peixe-bruxa","Peixe-cabra","Peixe-carvão","Peixe-cão","Peixe-cego-das-cavernas","Peixe-cirurgião","Peixe-cofre","Peixe-corda","Peixe-dentado","Peixe-dourado","Peixe-elefante","Peixe-escorpião","Peixe-espada","Peixe-esparadrapo","Peixe-faca","Peixe-farol","Peixe-folha","Peixe-frade","Peixe-galo","Peixe-gatilho","Peixe-gato","Peixe-gelo","Peixe-imperador","Peixe-lanterna","Peixe-leão","Peixe-lua","Peixe-machado","Peixe-mandarim","Peixe-martelo","Peixe-médico","Peixe-morcego","Peixe-mosquito","Peixe-nuvem","Peixe-palhaço","Peixe-palmito","Peixe-papagaio","Peixe-pedra","Peixe-pescador","Peixe-piloto","Peixe-porco","Peixe-rato","Peixe-rei","Peixe-remo","Peixe-royal-gramma","Peixe-sapo","Peixe-serra","Peixe-sol","Peixe-soldado","Peixe-tigre","Peixe-tripé","Peixe-trombeta","Peixe-unicórnio","Peixe-ventosa","Peixe-vermelho","Peixe-víbora","Peixe-voador","Peixe-zebra","Perca","Pescada","Piaba","Piapara","Piau","Pintado","Piracanjuba","Piraíba","Pirambóia","Piranha","Piraputanga","Pirarara","Pirarucu","Piratinga","Poraquê","Porquinho","Prejereba","Quimera","Raia","Rêmora","Robalo","Rodóstomo","Saicanga","Sarda","Sardinha","Sargocentron diadema","Salmão","Solha","Surubi","Tabarana","Tainha","Tambacu","Tambaqui","Tamboril","Tamuatá","Tilápia","Traíra","Tricolor","Truta","Tubarana","Tubarão","Tucunaré","Ubarana","Ubeba","Xaréu","Zigão-preto"];
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
    const groupId = message.group; // ID do grupo, se for uma mensagem de grupo
    
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
    
    // Obtém dados de pesca
    const fishingData = await getFishingData();
    
    // Inicializa os dados do usuário se não existirem
    if (!fishingData.fishingData[userId]) {
      fishingData.fishingData[userId] = {
        name: userName,
        fishes: [],
        totalWeight: 0,
        biggestFish: null,
        totalCatches: 0
      };
    } else {
      // Atualiza nome do usuário se mudou
      fishingData.fishingData[userId].name = userName;
    }
    
    // Inicializa os dados do grupo se for uma mensagem de grupo e não existirem
    if (groupId && !fishingData.groupData[groupId]) {
      fishingData.groupData[groupId] = {};
    }
    
    // Inicializa os dados do usuário no grupo se for uma mensagem de grupo
    if (groupId && !fishingData.groupData[groupId][userId]) {
      fishingData.groupData[groupId][userId] = {
        name: userName,
        totalWeight: 0,
        biggestFish: null,
        totalCatches: 0
      };
    } else if (groupId) {
      // Atualiza nome do usuário no grupo se mudou
      fishingData.groupData[groupId][userId].name = userName;
    }
    
    // Obtém o peixe aleatório
    const fish = await getRandomFish();
    
    // Atualiza estatísticas do usuário
    fishingData.fishingData[userId].totalCatches++;
    fishingData.fishingData[userId].totalWeight += fish.weight;
    
    // Atualiza estatísticas do usuário no grupo, se for uma mensagem de grupo
    if (groupId) {
      fishingData.groupData[groupId][userId].totalCatches++;
      fishingData.groupData[groupId][userId].totalWeight += fish.weight;
    }
    
    // Verifica se é o maior peixe do usuário
    if (!fishingData.fishingData[userId].biggestFish || 
        fish.weight > fishingData.fishingData[userId].biggestFish.weight) {
      fishingData.fishingData[userId].biggestFish = fish;
    }
    
    // Verifica se é o maior peixe do usuário no grupo, se for uma mensagem de grupo
    if (groupId && (!fishingData.groupData[groupId][userId].biggestFish || 
                     fish.weight > fishingData.groupData[groupId][userId].biggestFish.weight)) {
      fishingData.groupData[groupId][userId].biggestFish = fish;
    }
    
    // Adiciona o peixe à lista do usuário, mantendo apenas os MAX_FISH_PER_USER mais recentes
    fishingData.fishingData[userId].fishes.push(fish);
    if (fishingData.fishingData[userId].fishes.length > MAX_FISH_PER_USER) {
      // Se exceder o limite, remove o peixe mais antigo
      const oldFish = fishingData.fishingData[userId].fishes.shift();
      // Ajusta o peso total
      fishingData.fishingData[userId].totalWeight -= oldFish.weight;
    }
    
    // Salva os dados atualizados
    await saveFishingData(fishingData);
    
    // Define o cooldown
    fishingCooldowns[userId] = now + FISHING_COOLDOWN;
    
    // Seleciona uma mensagem aleatória
    const fishingMessages = [
      `🎣 ${userName} pescou um *${fish.name}* de _${fish.weight.toFixed(2)} kg_!`,
      `🐟 Wow! ${userName} fisgou um(a) *${fish.name}* pesando _${fish.weight.toFixed(2)} kg_!`,
      `🎣 Um(a) *${fish.name}* de ${fish.weight.toFixed(2)} kg mordeu a isca de ${userName}!`,
      `🐠 ${userName} recolheu a linha e encontrou um(a) *${fish.name}* de _${fish.weight.toFixed(2)} kg_!`,
      `🏆 ${userName} capturou um(a) impressionante *${fish.name}* de _${fish.weight.toFixed(2)} kg_!`
    ];
    
    const randomMessage = fishingMessages[Math.floor(Math.random() * fishingMessages.length)];
    
    // Adiciona informações adicionais para peixes grandes
    let additionalInfo = '';
    if (fish.weight > 20) {
      additionalInfo = '\n\n🏆 *Uau!* Este é um peixe enorme!';
    } else if (fish.weight > 15) {
      additionalInfo = '\n\n👏 Que belo exemplar!';
    }
    
    // Adiciona informação sobre o maior peixe do usuário
    additionalInfo += `\n\n> 🐳 Seu maior peixe: ${fishingData.fishingData[userId].biggestFish.name} (${fishingData.fishingData[userId].biggestFish.weight.toFixed(2)} kg)`;
    
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
    
    // Obtém dados de pesca
    const fishingData = await getFishingData();
    
    // Verifica se o usuário tem peixes
    if (!fishingData.fishingData[userId]) {
      return new ReturnMessage({
        chatId,
        content: `🎣 ${userName}, você ainda não pescou nenhum peixe. Use !pescar para começar.`
      });
    }
    
    const userData = fishingData.fishingData[userId];
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
 * Mostra o ranking de pescaria do grupo atual
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
    const groupId = message.group;
    
    // Verifica se o comando foi executado em um grupo
    if (!groupId) {
      return new ReturnMessage({
        chatId,
        content: '🎣 Este comando só funciona em grupos. Use-o em um grupo para ver o ranking desse grupo específico.'
      });
    }
    
    // Obtém dados de pesca
    const fishingData = await getFishingData();
    
    // Verifica se há dados para este grupo
    if (!fishingData.groupData || 
        !fishingData.groupData[groupId] || 
        Object.keys(fishingData.groupData[groupId]).length === 0) {
      return new ReturnMessage({
        chatId,
        content: '🎣 Ainda não há dados de pescaria neste grupo. Use !pescar para começar.'
      });
    }
    
    // Obtém os dados dos jogadores deste grupo
    const players = Object.entries(fishingData.groupData[groupId]).map(([id, data]) => ({
      id,
      ...data
    }));
    
    // Determina o tipo de ranking
    let rankingType = 'biggest'; // Padrão: maior peixe (sem argumentos)
    
    if (args.length > 0) {
      const arg = args[0].toLowerCase();
      if (arg === 'quantidade') {
        rankingType = 'count';
      } else if (arg === 'pesado') {
        rankingType = 'weight';
      }
    }
    
    // Ordena jogadores com base no tipo de ranking
    if (rankingType === 'weight') {
      // Ordena por peso total
      players.sort((a, b) => b.totalWeight - a.totalWeight);
    } else if (rankingType === 'count') {
      // Ordena por quantidade total de peixes
      players.sort((a, b) => b.totalCatches - a.totalCatches);
    } else {
      // Ordena por tamanho do maior peixe
      players.sort((a, b) => {
        // Se algum jogador não tiver um maior peixe, coloca-o no final
        if (!a.biggestFish) return 1;
        if (!b.biggestFish) return -1;
        return b.biggestFish.weight - a.biggestFish.weight;
      });
    }
    
    // Prepara o título do ranking de acordo com o tipo
    let rankingTitle = '';
    if (rankingType === 'weight') {
      rankingTitle = 'Peso Total';
    } else if (rankingType === 'count') {
      rankingTitle = 'Quantidade Total';
    } else {
      rankingTitle = 'Maior Peixe';
    }
    
    // Prepara a mensagem de ranking
    let rankingMessage = `🏆 *Ranking de Pescaria deste Grupo* (${rankingTitle})\n\n`;
    
    // Lista os jogadores
    const topPlayers = players.slice(0, 10);
    topPlayers.forEach((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      
      if (rankingType === 'weight') {
        rankingMessage += `${medal} ${player.name}: ${player.totalWeight.toFixed(2)} kg (${player.totalCatches} peixes)\n`;
      } else if (rankingType === 'count') {
        rankingMessage += `${medal} ${player.name}: ${player.totalCatches} peixes (${player.totalWeight.toFixed(2)} kg)\n`;
      } else {
        // Se o jogador não tiver um maior peixe, mostra uma mensagem apropriada
        if (!player.biggestFish) {
          rankingMessage += `${medal} ${player.name}: Ainda não pescou nenhum peixe\n`;
        } else {
          rankingMessage += `${medal} ${player.name}: ${player.biggestFish.name} de ${player.biggestFish.weight.toFixed(2)} kg\n`;
        }
      }
    });
    
    // Informações sobre os outros rankings
    rankingMessage += `\nOutros rankings disponíveis:`;
    if (rankingType !== 'biggest') {
      rankingMessage += `\n- !pesca-ranking (sem argumentos): Ranking por maior peixe`;
    }
    if (rankingType !== 'weight') {
      rankingMessage += `\n- !pesca-ranking pesado: Ranking por peso total`;
    }
    if (rankingType !== 'count') {
      rankingMessage += `\n- !pesca-ranking quantidade: Ranking por quantidade de peixes`;
    }
    
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
    
    // Obtém dados de pesca
    const fishingData = await getFishingData();
    
    // Verifica se há dados de pescaria
    if (!fishingData.fishingData || Object.keys(fishingData.fishingData).length === 0) {
      return new ReturnMessage({
        chatId,
        content: '🎣 Ainda não há dados de pescaria. Use !pescar para começar.'
      });
    }
    
    // Cria uma lista de todos os maiores peixes
    const biggestFishes = [];
    
    for (const [userId, userData] of Object.entries(fishingData.fishingData)) {
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
    
    // Obtém peixes das custom-variables
    let fishArray = [];
    try {
      const customVariables = await database.getCustomVariables();
      if (customVariables?.peixes && Array.isArray(customVariables.peixes) && customVariables.peixes.length > 0) {
        fishArray = customVariables.peixes;
      } else {
        return new ReturnMessage({
          chatId,
          content: '🎣 Ainda não há tipos de peixes definidos nas variáveis personalizadas. O sistema usará peixes padrão ao pescar.'
        });
      }
    } catch (error) {
      logger.error('Erro ao obter peixes de custom-variables:', error);
      return new ReturnMessage({
        chatId,
        content: '❌ Ocorreu um erro ao buscar os tipos de peixes. Por favor, tente novamente.'
      });
    }
    
    // Ordena alfabeticamente
    const sortedFishes = [...fishArray].sort();
    
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
    cooldown: 5,
    reactions: {
      after: "🐠",
      error: "❌"
    },
    method: myFishCommand
  }),
  
  new Command({
    name: 'pesca-ranking',
    description: 'Mostra o ranking de pescaria do grupo atual',
    category: "jogos",
    group: "pescrank",
    cooldown: 5,
    reactions: {
      after: "🏆",
      error: "❌"
    },
    method: fishingRankingCommand
  }),
  
  new Command({
    name: 'pescados',
    description: 'Mostra o ranking de pescaria do grupo atual',
    category: "jogos",
    group: "pescrank",
    cooldown: 5,
    reactions: {
      after: "🐋",
      error: "❌"
    },
    method: fishingRankingCommand
  }),
  new Command({
    name: 'pesca-peixes',
    description: 'Lista todos os tipos de peixes disponíveis',
    category: "jogos",
    hidden: true,
    cooldown: 5,
    reactions: {
      after: "📋",
      error: "❌"
    },
    method: listFishTypesCommand
  })
];

module.exports = { commands };