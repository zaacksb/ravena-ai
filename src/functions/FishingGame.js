// src/functions/FishingGame.js
const path = require('path');
const fs = require('fs').promises;
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const Database = require('../utils/Database');
const sdModule = require('./StableDiffusionCommands');;

const logger = new Logger('fishing-game');
const database = Database.getInstance();

// Constantes do jogo
const MAX_FISH_PER_USER = 10;
const MIN_FISH_WEIGHT = 1;
const MAX_FISH_WEIGHT = 60; // Aumentado para 60kg
const FISHING_COOLDOWN = 5;
const MAX_BAITS = 10; // Máximo de iscas
const BAIT_REGEN_TIME = 60 * 60; // 1 hora em segundos para regenerar isca

// Armazena os cooldowns de pesca
const fishingCooldowns = {};

// Peixes raríssimos e seus pesos adicionais
const RARE_FISH = [
  { name: "Megalodon", chance: 0.00001, weightBonus: 5000, emoji: "🦈" },
  { name: "Leviathan", chance: 0.00001, weightBonus: 5000, emoji: "🐉" },
  { name: "Baleia", chance: 0.00005, weightBonus: 1000, emoji: "🐋" },
  { name: "Tubarão", chance: 0.0001, weightBonus: 500, emoji: "🦈" }
];

// Itens de lixo que podem ser pescados
const TRASH_ITEMS = [
  { name: "Bota velha", emoji: "👢" },
  { name: "Sacola plástica", emoji: "🛍️" },
  { name: "Latinha", emoji: "🥫" },
  { name: "Mochila rasgada", emoji: "🎒" },
  { name: "Saco de lixo", emoji: "🗑️" },
  { name: "Pneu furado", emoji: "🛞" },
  { name: "Garrafa vazia", emoji: "🍾" },
  { name: "Chapéu de pirata", emoji: "👒" },
  { name: "Celular quebrado", emoji: "📱" },
  { name: "Relógio parado", emoji: "⌚" }
];

// Upgrades para pesca
const UPGRADES = [
  { name: "Chapéu de Pescador", chance: 0.05, emoji: "👒", effect: "weight_boost", value: 0.1, duration: 10 },
  { name: "Minhocão", chance: 0.05, emoji: "🪱", effect: "next_fish_bonus", minValue: 20, maxValue: 50 },
  { name: "Rede", chance: 0.05, emoji: "🕸️", effect: "double_catch" },
  { name: "Carretel", chance: 0.01, emoji: "🧵", effect: "weight_boost", value: 0.5, duration: 10 },
  { name: "Pacote de Iscas", chance: 0.05, emoji: "🎁", effect: "extra_baits", minValue: 1, maxValue: 5 }
];

// Downgrades para pesca
const DOWNGRADES = [
  { name: "Mina Aquática", chance: 0.0001, emoji: "💣", effect: "clear_inventory" },
  { name: "Tartaruga Gulosa", chance: 0.01, emoji: "🐢", effect: "remove_baits", minValue: 1, maxValue: 5 }
];

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
  
  // Sorteia peixe raro com chances muito baixas
  for (const rareFish of RARE_FISH) {
    if (Math.random() < rareFish.chance) {
      // Gera um peso aleatório base entre MIN e MAX
      const baseWeight = parseFloat((Math.random() * (MAX_FISH_WEIGHT - MIN_FISH_WEIGHT) + MIN_FISH_WEIGHT).toFixed(2));
      // Adiciona o bônus de peso do peixe raro
      const totalWeight = baseWeight + rareFish.weightBonus;
      
      return {
        name: rareFish.name,
        weight: totalWeight,
        timestamp: Date.now(),
        isRare: true,
        emoji: rareFish.emoji,
        baseWeight: baseWeight,
        bonusWeight: rareFish.weightBonus
      };
    }
  }
  
  // Peixe normal
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
 * Verifica e regenera iscas para um jogador
 * @param {Object} userData - Dados do usuário
 * @returns {Object} - Dados do usuário atualizados
 */
function regenerateBaits(userData) {
  // Inicializa iscas se não existirem
  if (userData.baits === undefined) {
    userData.baits = MAX_BAITS;
    userData.lastBaitRegen = Date.now();
    return userData;
  }
  
  // Verifica se já está no máximo
  if (userData.baits >= MAX_BAITS) {
    userData.lastBaitRegen = Date.now();
    return userData;
  }
  
  // Calcula quantas iscas devem ser regeneradas
  const now = Date.now();
  const lastRegen = userData.lastBaitRegen || now;
  const elapsedSeconds = Math.floor((now - lastRegen) / 1000);
  const regensCount = Math.floor(elapsedSeconds / BAIT_REGEN_TIME);
  
  if (regensCount > 0) {
    // Adiciona iscas, mas não excede o máximo
    userData.baits = Math.min(userData.baits + regensCount, MAX_BAITS);
    userData.lastBaitRegen = now - (elapsedSeconds % BAIT_REGEN_TIME) * 1000;
  }
  
  return userData;
}

/**
 * Verifica se foi obtido um item aleatório (lixo, upgrade ou downgrade)
 * @returns {Object|null} - Item obtido ou null
 */
function checkRandomItem() {
  // Verifica se obtém lixo (10% de chance)
  if (Math.random() < 0.1) {
    const trashIndex = Math.floor(Math.random() * TRASH_ITEMS.length);
    return {
      type: 'trash',
      ...TRASH_ITEMS[trashIndex]
    };
  }
  
  // Verifica se obtém upgrade (cada upgrade tem sua própria chance)
  for (const upgrade of UPGRADES) {
    if (Math.random() < upgrade.chance) {
      let itemData = { ...upgrade, type: 'upgrade' };
      
      // Se for pacote de iscas, gera valor aleatório
      if (upgrade.effect === 'extra_baits') {
        itemData.value = Math.floor(Math.random() * (upgrade.maxValue - upgrade.minValue + 1)) + upgrade.minValue;
      }
      
      // Se for minhocão, gera valor aleatório
      if (upgrade.effect === 'next_fish_bonus') {
        itemData.value = Math.floor(Math.random() * (upgrade.maxValue - upgrade.minValue + 1)) + upgrade.minValue;
      }
      
      return itemData;
    }
  }
  
  // Verifica se obtém downgrade (cada downgrade tem sua própria chance)
  for (const downgrade of DOWNGRADES) {
    if (Math.random() < downgrade.chance) {
      let itemData = { ...downgrade, type: 'downgrade' };
      
      // Se for tartaruga gulosa, gera valor aleatório
      if (downgrade.effect === 'remove_baits') {
        itemData.value = Math.floor(Math.random() * (downgrade.maxValue - downgrade.minValue + 1)) + downgrade.minValue;
      }
      
      return itemData;
    }
  }
  
  return null;
}

/**
 * Aplica efeito de item ao usuário
 * @param {Object} userData - Dados do usuário
 * @param {Object} item - Item obtido
 * @returns {Object} - Dados do usuário atualizados e mensagem de efeito
 */
function applyItemEffect(userData, item) {
  let effectMessage = '';
  
  // Inicializa propriedades de buff se não existirem
  if (!userData.buffs) userData.buffs = [];
  
  switch (item.type) {
    case 'trash':
      effectMessage = `\n\n${item.emoji} Você pescou um(a) ${item.name}. Que pena!`;
      break;
      
    case 'upgrade':
      switch (item.effect) {
        case 'weight_boost':
          userData.buffs.push({
            type: 'weight_boost',
            value: item.value,
            remainingUses: item.duration
          });
          effectMessage = `\n\n${item.emoji} Você encontrou um ${item.name}! +${item.value*100}% no peso dos próximos ${item.duration} peixes.`;
          break;
          
        case 'next_fish_bonus':
          userData.buffs.push({
            type: 'next_fish_bonus',
            value: item.value,
            remainingUses: 1
          });
          effectMessage = `\n\n${item.emoji} Você encontrou um ${item.name}! O próximo peixe terá +${item.value}kg.`;
          break;
          
        case 'double_catch':
          userData.buffs.push({
            type: 'double_catch',
            remainingUses: 1
          });
          effectMessage = `\n\n${item.emoji} Você encontrou uma ${item.name}! Na próxima pescaria, você pegará 2 peixes de uma vez.`;
          break;
          
        case 'extra_baits':
          userData.baits = Math.min(userData.baits + item.value, MAX_BAITS);
          effectMessage = `\n\n${item.emoji} Você encontrou um ${item.name}! +${item.value} iscas adicionadas (${userData.baits}/${MAX_BAITS}).`;
          break;
      }
      break;
      
    case 'downgrade':
      switch (item.effect) {
        case 'clear_inventory':
          userData.fishes = [];
          userData.totalWeight -= userData.inventoryWeight || 0;
          userData.inventoryWeight = 0;
          effectMessage = `\n\n${item.emoji} OH NÃO! Você encontrou uma ${item.name}! Seu inventário de peixes foi destruído!`;
          break;
          
        case 'remove_baits':
          const baitsLost = Math.min(userData.baits, item.value);
          userData.baits -= baitsLost;
          effectMessage = `\n\n${item.emoji} Uma ${item.name} apareceu e comeu ${baitsLost} de suas iscas! (${userData.baits}/${MAX_BAITS} iscas restantes).`;
          break;
      }
      break;
  }
  
  return { userData, effectMessage };
}

/**
 * Aplica efeitos de buffs a um peixe
 * @param {Object} userData - Dados do usuário
 * @param {Object} fish - Peixe capturado
 * @returns {Object} - Objeto com peixe modificado e buffs atualizados
 */
function applyBuffs(userData, fish) {
  // Se não há buffs, retorna o peixe original
  if (!userData.buffs || userData.buffs.length === 0) {
    return { fish, buffs: [] };
  }
  
  // Copia o peixe para não modificar o original
  let modifiedFish = { ...fish };
  // Copia os buffs para atualizá-los
  let updatedBuffs = [...userData.buffs];
  let buffMessages = [];
  
  // Aplica cada buff e atualiza seus usos restantes
  updatedBuffs = updatedBuffs.filter(buff => {
    if (buff.remainingUses <= 0) return false;
    
    switch (buff.type) {
      case 'weight_boost':
        const originalWeight = modifiedFish.weight;
        modifiedFish.weight *= (1 + buff.value);
        modifiedFish.weight = parseFloat(modifiedFish.weight.toFixed(2));
        
        // Adiciona mensagem de buff
        buffMessages.push(`🎯 Buff do ${buff.originalName || 'item'}: +${buff.value*100}% de peso (${originalWeight}kg → ${modifiedFish.weight}kg)`);
        break;
        
      case 'next_fish_bonus':
        const beforeBonus = modifiedFish.weight;
        modifiedFish.weight += buff.value;
        modifiedFish.weight = parseFloat(modifiedFish.weight.toFixed(2));
        
        // Adiciona mensagem de buff
        buffMessages.push(`🎯 Buff do ${buff.originalName || 'Minhocão'}: +${buff.value}kg (${beforeBonus}kg → ${modifiedFish.weight}kg)`);
        break;
    }
    
    // Decrementa usos restantes
    buff.remainingUses--;
    // Mantém o buff se ainda tiver usos restantes
    return buff.remainingUses > 0;
  });
  
  return { fish: modifiedFish, buffs: updatedBuffs, buffMessages };
}

/**
 * Gera uma imagem de peixe raro usando Stable Diffusion
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {string} userName - Nome do pescador
 * @param {string} fishName - Nome do peixe raro
 * @returns {Promise<Object|null>} - Objeto MessageMedia ou null em caso de erro
 */
async function generateRareFishImage(bot, userName, fishName) {
  try {
    const prompt = `${userName} fishing an epic enormous fish named '${fishName}' using only a wooden fishing rod`;
    
    // Verifica se o módulo StableDiffusionCommands está disponível
    try {
      
      if (!sdModule || !sdModule.commands || !sdModule.commands[0] || !sdModule.commands[0].method) {
        logger.error('Módulo StableDiffusionCommands não está configurado corretamente');
        return null;
      }
    } catch (error) {
      logger.error('Erro ao importar módulo StableDiffusionCommands:', error);
      return null;
    }
    
    // Simula mensagem para usar o método do módulo
    const mockMessage = {
      author: 'SYSTEM',
      authorName: 'Sistema',
      content: prompt,
      origin: {
        getQuotedMessage: () => Promise.resolve(null)
      }
    };
    
    // Chama o método do comando imagine
    const imagineCommand = sdModule.commands[0];
    const result = await imagineCommand.method(bot, mockMessage, prompt.split(' '), null);
    
    if (result && result.content && result.content.mimetype) {
      return result.content;
    }
    
    return null;
  } catch (error) {
    logger.error('Erro ao gerar imagem para peixe raro:', error);
    return null;
  }
}

/**
 * Verifica se o usuário tem buffs de pescaria dupla
 * @param {Object} userData - Dados do usuário
 * @returns {boolean} - True se tem buff de pescaria dupla
 */
function hasDoubleCatchBuff(userData) {
  if (!userData.buffs || userData.buffs.length === 0) {
    return false;
  }
  
  return userData.buffs.some(buff => buff.type === 'double_catch' && buff.remainingUses > 0);
}

/**
 * Consome o buff de pescaria dupla
 * @param {Object} userData - Dados do usuário
 * @returns {Object} - Dados do usuário atualizados
 */
function consumeDoubleCatchBuff(userData) {
  if (!userData.buffs || userData.buffs.length === 0) {
    return userData;
  }
  
  userData.buffs = userData.buffs.filter(buff => {
    if (buff.type === 'double_catch' && buff.remainingUses > 0) {
      buff.remainingUses--;
      return buff.remainingUses > 0;
    }
    return true;
  });
  
  return userData;
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
    
    // Obtém dados de pesca
    const fishingData = await getFishingData();
    
    // Inicializa os dados do usuário se não existirem
    if (!fishingData.fishingData[userId]) {
      fishingData.fishingData[userId] = {
        name: userName,
        fishes: [],
        totalWeight: 0,
        inventoryWeight: 0,
        biggestFish: null,
        totalCatches: 0,
        baits: MAX_BAITS, // Começa com máximo de iscas
        lastBaitRegen: Date.now(),
        buffs: []
      };
    } else {
      // Atualiza nome do usuário se mudou
      fishingData.fishingData[userId].name = userName;
    }
    
    // Regenera iscas do usuário
    fishingData.fishingData[userId] = regenerateBaits(fishingData.fishingData[userId]);
    
    // Verifica cooldown
    const now = Math.floor(Date.now() / 1000);
    if (fishingCooldowns[userId] && now < fishingCooldowns[userId]) {
      // Só reage com emoji de relógio, sem mensagem
      try {
        await message.origin.react("⏰");
      } catch (reactError) {
        logger.error('Erro ao reagir com emoji de relógio:', reactError);
      }
      return null;
    }
    
    // Verifica se o usuário tem iscas
    if (fishingData.fishingData[userId].baits <= 0) {
      return new ReturnMessage({
        chatId,
        content: `🎣 ${userName}, você não tem iscas para pescar. As iscas regeneram automaticamente (1 a cada hora), ou você pode encontrar pacotes de iscas enquanto pesca.`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
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
    
    // Consome uma isca
    fishingData.fishingData[userId].baits--;
    
    // Verifica se o usuário tem buff de pescaria dupla
    const doubleCatch = hasDoubleCatchBuff(fishingData.fishingData[userId]);
    
    // Quantidade de peixes a pescar
    const fishesToCatch = doubleCatch ? 2 : 1;
    
    // Array para armazenar os peixes capturados
    const caughtFishes = [];
    let randomItem = null;
    let effectMessage = '';
    
    // Captura os peixes
    for (let i = 0; i < fishesToCatch; i++) {
      // Obtém o peixe aleatório
      const fish = await getRandomFish();
      
      // Aplica buffs ao peixe
      const buffResult = applyBuffs(fishingData.fishingData[userId], fish);
      const modifiedFish = buffResult.fish;
      fishingData.fishingData[userId].buffs = buffResult.buffs;
      
      // Adiciona mensagens de buffs ao effectMessage
      if (buffResult.buffMessages && buffResult.buffMessages.length > 0) {
        effectMessage += '\n\n' + buffResult.buffMessages.join('\n');
      }
      
      // Atualiza estatísticas do usuário
      fishingData.fishingData[userId].totalCatches++;
      fishingData.fishingData[userId].totalWeight += modifiedFish.weight;
      
      // Atualiza estatísticas do usuário no grupo, se for uma mensagem de grupo
      if (groupId) {
        fishingData.groupData[groupId][userId].totalCatches++;
        fishingData.groupData[groupId][userId].totalWeight += modifiedFish.weight;
      }
      
      // Verifica se é o maior peixe do usuário
      if (!fishingData.fishingData[userId].biggestFish || 
          modifiedFish.weight > fishingData.fishingData[userId].biggestFish.weight) {
        fishingData.fishingData[userId].biggestFish = modifiedFish;
      }
      
      // Verifica se é o maior peixe do usuário no grupo, se for uma mensagem de grupo
      if (groupId && (!fishingData.groupData[groupId][userId].biggestFish || 
                       modifiedFish.weight > fishingData.groupData[groupId][userId].biggestFish.weight)) {
        fishingData.groupData[groupId][userId].biggestFish = modifiedFish;
      }
      
      // Adiciona o peixe à lista do usuário, mantendo apenas os MAX_FISH_PER_USER mais recentes
      fishingData.fishingData[userId].fishes.push(modifiedFish);
      caughtFishes.push(modifiedFish);
      
      // Atualiza o peso total do inventário
      fishingData.fishingData[userId].inventoryWeight = (fishingData.fishingData[userId].inventoryWeight || 0) + modifiedFish.weight;
      
      // Remove peixes antigos se exceder o limite
      if (fishingData.fishingData[userId].fishes.length > MAX_FISH_PER_USER) {
        // Se exceder o limite, remove o peixe mais antigo
        const oldFish = fishingData.fishingData[userId].fishes.shift();
        // Ajusta o peso do inventário
        fishingData.fishingData[userId].inventoryWeight -= oldFish.weight;
      }
      
      // Somente no primeiro peixe, verifica se obteve um item aleatório
      if (i === 0 && !modifiedFish.isRare) {
        randomItem = checkRandomItem();
        
        if (randomItem) {
          const itemResult = applyItemEffect(fishingData.fishingData[userId], randomItem);
          fishingData.fishingData[userId] = itemResult.userData;
          effectMessage += itemResult.effectMessage;
          
          // Se for lixo, este peixe não conta
          if (randomItem.type === 'trash') {
            caughtFishes.pop();
            fishingData.fishingData[userId].fishes.pop();
            fishingData.fishingData[userId].totalCatches--;
            fishingData.fishingData[userId].totalWeight -= modifiedFish.weight;
            fishingData.fishingData[userId].inventoryWeight -= modifiedFish.weight;
            
            if (groupId) {
              fishingData.groupData[groupId][userId].totalCatches--;
              fishingData.groupData[groupId][userId].totalWeight -= modifiedFish.weight;
            }
            
            break; // Sai do loop, não pesca mais peixes
          }
        }
      }
    }
    
    // Se foi uma pescaria dupla, consome o buff
    if (doubleCatch) {
      fishingData.fishingData[userId] = consumeDoubleCatchBuff(fishingData.fishingData[userId]);
      effectMessage += `\n\n🕸️ Sua rede te ajudou a pegar 2 peixes de uma vez!`;
    }
    
    // Salva os dados atualizados
    await saveFishingData(fishingData);
    
    // Define o cooldown
    fishingCooldowns[userId] = now + FISHING_COOLDOWN;
    
    // Se não pescou nenhum peixe (só lixo), retorna mensagem de lixo
    if (caughtFishes.length === 0) {
      return new ReturnMessage({
        chatId,
        content: `🎣 ${userName} jogou a linha... ${effectMessage}\n\nIscas restantes: ${fishingData.fishingData[userId].baits}/${MAX_BAITS}`,
        reactions: {
          after: "🎣"
        },
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    // Se tiver mais de um peixe, formata mensagem para múltiplos peixes
    let fishMessage;
    if (caughtFishes.length > 1) {
      const fishDetails = caughtFishes.map(fish => `*${fish.name}* (_${fish.weight.toFixed(2)} kg_)`).join(" e ");
      fishMessage = `🎣 ${userName} pescou ${fishDetails}!`;
    } else {
      // Mensagem para um único peixe
      const fish = caughtFishes[0];
      
      // Seleciona uma mensagem aleatória para peixes normais
      const fishingMessages = [
        `🎣 ${userName} pescou um *${fish.name}* de _${fish.weight.toFixed(2)} kg_!`,
        `🐟 Wow! ${userName} fisgou um(a) *${fish.name}* pesando _${fish.weight.toFixed(2)} kg_!`,
        `🎣 Um(a) *${fish.name}* de ${fish.weight.toFixed(2)} kg mordeu a isca de ${userName}!`,
        `🐠 ${userName} recolheu a linha e encontrou um(a) *${fish.name}* de _${fish.weight.toFixed(2)} kg_!`
      ];
      
      // Mensagens especiais para peixes raros
      const rareFishMessages = [
        `🏆 INCRÍVEL! ${userName} capturou um(a) *${fish.name}* GIGANTE de _${fish.weight.toFixed(2)} kg_! (${fish.emoji})`,
        `🏆 LENDÁRIO! ${userName} conseguiu o impossível e pescou um(a) *${fish.name}* de _${fish.weight.toFixed(2)} kg_! (${fish.emoji})`,
        `🏆 ÉPICO! As águas se agitaram e ${userName} capturou um(a) *${fish.name}* colossal de _${fish.weight.toFixed(2)} kg_! (${fish.emoji})`
      ];
      
      // Escolhe mensagem apropriada
      if (fish.isRare) {
        const randomIndex = Math.floor(Math.random() * rareFishMessages.length);
        fishMessage = rareFishMessages[randomIndex];
      } else {
        const randomIndex = Math.floor(Math.random() * fishingMessages.length);
        fishMessage = fishingMessages[randomIndex];
      }
    }
    
    // Adiciona informações adicionais para peixes grandes
    if (caughtFishes.length === 1 && caughtFishes[0].weight > 50) {
      effectMessage = '\n\n🏆 *EXTRAORDINÁRIO!* Este é um peixe monumental!' + effectMessage;
    } else if (caughtFishes.length === 1 && caughtFishes[0].weight > 40) {
      effectMessage = '\n\n🏆 *UAU!* Este é um peixe verdadeiramente enorme!' + effectMessage;
    } else if (caughtFishes.length === 1 && caughtFishes[0].weight > 30) {
      effectMessage = '\n\n👏 Impressionante! Que espécime magnífico!' + effectMessage;
    }
    
    // Adiciona informação sobre o maior peixe do usuário
    const userBiggest = fishingData.fishingData[userId].biggestFish;
    fishMessage += `\n\n> 🐳 Seu maior peixe: ${userBiggest.name} (${userBiggest.weight.toFixed(2)} kg)`;
    
    // Adiciona informação sobre as iscas restantes
    fishMessage += `\n> 🪱 Iscas restantes: ${fishingData.fishingData[userId].baits}/${MAX_BAITS}`;
    
    // Adiciona as mensagens de efeito (itens, buffs, etc)
    fishMessage += effectMessage;
    
    // Se pescou um peixe raro, gera imagem e notifica grupo de interação
    if (caughtFishes.length === 1 && caughtFishes[0].isRare) {
      try {
        // Gera a imagem para o peixe raro
        const rareFishImage = await generateRareFishImage(bot, userName, caughtFishes[0].name);
        
        if (rareFishImage) {
          // Notifica o grupo de interação sobre o peixe raro
          if (bot.grupoInteracao) {
            const groupName = group ? group.name : "chat privado";
            const notificationMessage = new ReturnMessage({
              chatId: bot.grupoInteracao,
              content: rareFishImage,
              options: {
                caption: `🏆 ${userName} capturou um(a) *${caughtFishes[0].name}* LENDÁRIO(A) de *${caughtFishes[0].weight.toFixed(2)} kg* no grupo "${groupName}"!`
              }
            });
            
            await bot.sendReturnMessages(notificationMessage);
          }
          
          // Envia a mensagem com a imagem
          return new ReturnMessage({
            chatId,
            content: rareFishImage,
            options: {
              caption: fishMessage,
              quotedMessageId: message.origin.id._serialized
            },
            reactions: {
              after: "🎣"
            }
          });
        }
      } catch (imageError) {
        logger.error('Erro ao gerar ou enviar imagem de peixe raro:', imageError);
      }
    }
    
    // Retorna a mensagem de texto normal se não houver imagem
    return new ReturnMessage({
      chatId,
      content: fishMessage,
      reactions: {
        after: "🎣"
      },
      options: {
        quotedMessageId: message.origin.id._serialized
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
        content: `🎣 ${userName}, você ainda não pescou nenhum peixe. Use !pescar para começar.`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    // Regenera iscas antes de mostrar
    fishingData.fishingData[userId] = regenerateBaits(fishingData.fishingData[userId]);
    await saveFishingData(fishingData);
    
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
        const rareMark = fish.isRare ? ` ${fish.emoji} RARO!` : '';
        fishMessage += `${index + 1}. ${fish.name}: ${fish.weight.toFixed(2)} kg${rareMark}\n`;
      });
      
      // Adiciona estatísticas
      fishMessage += `\n*Estatísticas*:\n`;
      fishMessage += `Total de peixes: ${userData.totalCatches}\n`;
      fishMessage += `Peso total atual: ${userData.inventoryWeight?.toFixed(2) || userData.totalWeight.toFixed(2)} kg\n`;
      fishMessage += `Maior peixe: ${userData.biggestFish.name} (${userData.biggestFish.weight.toFixed(2)} kg)\n`;
      fishMessage += `Inventário atual: ${fishes.length}/${MAX_FISH_PER_USER} peixes\n`;
      fishMessage += `Iscas: ${userData.baits}/${MAX_BAITS} (regenera 1 a cada hora)\n`;
      
      // Adiciona buffs ativos
      if (userData.buffs && userData.buffs.length > 0) {
        fishMessage += `\n*Buffs Ativos*:\n`;
        userData.buffs.forEach(buff => {
          switch (buff.type) {
            case 'weight_boost':
              fishMessage += `👒 +${buff.value*100}% peso (${buff.remainingUses} peixes restantes)\n`;
              break;
            case 'next_fish_bonus':
              fishMessage += `🪱 +${buff.value}kg no próximo peixe\n`;
              break;
            case 'double_catch':
              fishMessage += `🕸️ Próxima pescaria pega 2 peixes\n`;
              break;
          }
        });
      }
      
      // Informa sobre o limite de inventário
      if (fishes.length >= MAX_FISH_PER_USER) {
        fishMessage += `\n⚠️ Seu inventário está cheio! Ao pescar novamente, seu peixe mais antigo será liberado.`;
      }
    }
    
    return new ReturnMessage({
      chatId,
      content: fishMessage,
      options: {
        quotedMessageId: message.origin.id._serialized
      }
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
          const rareMark = player.biggestFish.isRare ? ` ${player.biggestFish.emoji}` : '';
          rankingMessage += `${medal} ${player.name}: ${player.biggestFish.name} de ${player.biggestFish.weight.toFixed(2)} kg${rareMark}\n`;
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
      const rareMark = fish.isRare ? ` ${fish.emoji} RARO!` : '';
      fishMessage += `${medal} ${fish.playerName}: ${fish.name} de ${fish.weight.toFixed(2)} kg${rareMark}\n`;
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
    
    // Adiciona informações sobre peixes raros
    fishMessage += `\n*Peixes Raríssimos*:\n`;
    RARE_FISH.forEach(fish => {
      const chancePercent = fish.chance * 100;
      fishMessage += `${fish.emoji} ${fish.name}: ${fish.weightBonus}kg extra (${chancePercent.toFixed(5)}% de chance)\n`;
    });
    
    fishMessage += `\n*Itens Especiais*:`;
    fishMessage += `\n🪱 Use !iscas para ver suas iscas`;
    
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

/**
 * Mostra as iscas do jogador
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function showBaitsCommand(bot, message, args, group) {
  try {
    // Obtém IDs do chat e do usuário
    const chatId = message.group || message.author;
    const userId = message.author;
    const userName = message.authorName || "Pescador";
    
    // Obtém dados de pesca
    const fishingData = await getFishingData();
    
    // Verifica se o usuário tem dados
    if (!fishingData.fishingData[userId]) {
      fishingData.fishingData[userId] = {
        name: userName,
        fishes: [],
        totalWeight: 0,
        inventoryWeight: 0,
        biggestFish: null,
        totalCatches: 0,
        baits: MAX_BAITS,
        lastBaitRegen: Date.now(),
        buffs: []
      };
    }
    
    // Regenera iscas
    fishingData.fishingData[userId] = regenerateBaits(fishingData.fishingData[userId]);
    
    // Calcula tempo para a próxima isca
    const now = Date.now();
    const lastRegen = fishingData.fishingData[userId].lastBaitRegen || now;
    const elapsedSeconds = Math.floor((now - lastRegen) / 1000);
    const secondsUntilNextBait = BAIT_REGEN_TIME - (elapsedSeconds % BAIT_REGEN_TIME);
    
    // Formata o tempo
    const minutes = Math.floor(secondsUntilNextBait / 60);
    const seconds = secondsUntilNextBait % 60;
    const timeFormatted = `${minutes}m ${seconds}s`;
    
    // Salva os dados atualizados
    await saveFishingData(fishingData);
    
    // Prepara a mensagem
    let baitMessage = `🪱 *Iscas de ${userName}*\n\n`;
    
    // Adiciona emojis de isca para representar visualmente
    const baitEmojis = Array(MAX_BAITS).fill('⚪').fill('🪱', 0, fishingData.fishingData[userId].baits).join(' ');
    
    baitMessage += `${baitEmojis}\n\n`;
    baitMessage += `Você tem ${fishingData.fishingData[userId].baits}/${MAX_BAITS} iscas.\n`;
    
    // Adiciona mensagem sobre regeneração
    if (fishingData.fishingData[userId].baits < MAX_BAITS) {
      baitMessage += `Próxima isca em: ${timeFormatted}\n`;
    } else {
      baitMessage += `Suas iscas estão no máximo!\n`;
    }
    
    baitMessage += `\n*Sobre Iscas*:\n`;
    baitMessage += `• Você precisa de iscas para pescar\n`;
    baitMessage += `• Regenera 1 isca a cada hora\n`;
    baitMessage += `• Máximo de ${MAX_BAITS} iscas\n`;
    baitMessage += `• Você pode encontrar pacotes de iscas enquanto pesca\n`;
    
    return new ReturnMessage({
      chatId,
      content: baitMessage,
      options: {
        quotedMessageId: message.origin.id._serialized
      }
    });
  } catch (error) {
    logger.error('Erro ao mostrar iscas do jogador:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Ocorreu um erro ao mostrar suas iscas. Por favor, tente novamente.'
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
    name: 'pesca',
    hidden: true,
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
  }),
  
  new Command({
    name: '!pesca-iscas',
    description: 'Mostra suas iscas de pesca',
    category: "jogos",
    cooldown: 5,
    reactions: {
      after: "🪱",
      error: "❌"
    },
    method: showBaitsCommand
  })
];

module.exports = { commands };