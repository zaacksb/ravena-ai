// src/functions/FishingGame.js
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const Database = require('../utils/Database');
const sdModule = require('./StableDiffusionCommands');

const logger = new Logger('fishing-game');
const database = Database.getInstance();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Constantes do jogo
const MAX_FISH_PER_USER = 10;
const MIN_FISH_WEIGHT = 1;
const MAX_FISH_WEIGHT = 125; // Aumentado para 100kg
const DIFFICULTY_THRESHOLD = 60; // Peso a partir do qual a dificuldade aumenta
const FISHING_COOLDOWN = 5;
const MAX_BAITS = 3; // Máximo de iscas reduzido para 5
const BAIT_REGEN_TIME = 180 * 60; // 3 horas
const SAVE_INTERVAL = 30 * 1000; // 30 segundos em milissegundos

// Armazena os cooldowns de pesca
const fishingCooldowns = {};
const weightScaleMsgs = [140,100,90,70,60,50];

// Buffer para os dados de pesca
let fishingDataBuffer = null;
let lastSaveTime = 0;
let hasUnsavedChanges = false;

// Peixes raríssimos e seus pesos adicionais
const RARE_FISH = [
  { name: "Dai Gum Loong", chance: 0.000008, weightBonus: 10000, emoji: "🐲" },
  { name: "Leviathan", chance: 0.00001, weightBonus: 8000, emoji: "🐉" },
  { name: "Megalodon", chance: 0.000015, weightBonus: 6000, emoji: "🦈" },
  { name: "Baleia", chance: 0.00005, weightBonus: 1000, emoji: "🐋" },
  //{ name: "Tubarão", chance: 0.0001, weightBonus: 500, emoji: "🦈" }
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
  { name: "Relógio parado", emoji: "⌚" },
  { name: "Bebê Reborn", emoji: "👶" },
  { name: "Faca Velha", emoji: "🔪" },
  { name: "Tesoura Enferrujada", emoji: "✂" },
  { name: "Cadeado Sem Chave", emoji: "🔒" },
  { name: "Botão de salvar?", emoji: "💾" },
  { name: "Hétero", emoji: "🔝" },
  { name: "Microscópio Sujo", emoji: "🔬" },
  { name: "Extintor Velho", emoji: "🧯" },
  { name: "Camisinha Furada", emoji: "🎈" },
  { name: "Conta de Energia", emoji: "📜" },
  { name: "Conta de Água", emoji: "📜" },
  { name: "Boleto do Condomínio", emoji: "📜" },
  { name: "Siso Cariado", emoji: "🦷" },
  { name: "Maiô Rasgado", emoji: "🩱"},
  { name: "Biquíni", emoji: "👙"},
  { name: "Anel de Plástico", emoji: "💍"},
  { name: "Fita Mimosa", emoji: "🎗"},
  { name: "Boia Seca", emoji: "🛟"},
  { name: "Relógio Enferrujado", emoji: "⏲"},
  { name: "Imã", emoji: "🧲"},
  { name: "Tijolo 6 Furo", emoji: "🧱"},
  { name: "Chapa de Raio X", emoji: "🩻"},
  { name: "Fita Fofinha", emoji: "🎀"},
  { name: "Pacote da Shopee", emoji: "📦"},
  { name: "Pacote da OLX", emoji: "📦"},
  { name: "Pacote do Mercado Livre", emoji: "📦"},
  { name: "Pacote do AliExpress", emoji: "📦"},
  { name: "Pacote da Amazon", emoji: "📦"}
];

// Upgrades para pesca
const UPGRADES = [
  { name: "Chapéu de Pescador", chance: 0.05, emoji: "👒", effect: "weight_boost", value: 0.2, duration: 3 },
  { name: "Minhocão", chance: 0.05, emoji: "🪱", effect: "next_fish_bonus", minValue: 10, maxValue: 80 },
  { name: "Rede", chance: 0.01, emoji: "🕸️", effect: "double_catch" },
  { name: "Carretel", chance: 0.02, emoji: "🧵", effect: "weight_boost", value: 0.75, duration: 3 },
  { name: "Pacote de Iscas", chance: 0.1, emoji: "🎁", effect: "extra_baits", minValue: 1, maxValue: 3 }
];

// Downgrades para pesca
const DOWNGRADES = [
  { name: "Mina Aquática", chance: 0.0003, emoji: "💣", effect: "clear_inventory" },
  { name: "Vela Acesa do 𝒸𝒶𝓅𝒾𝓇𝑜𝓉𝑜", chance: 0.006, emoji: "🕯", effect: "weight_loss", value: -0.4, duration: 3 },
  { name: "Tartaruga Gulosa", chance: 0.015, emoji: "🐢", effect: "remove_baits", minValue: 1, maxValue: 3 }
];

// Caminho para o arquivo de dados de pesca
const FISHING_DATA_PATH = path.join(database.databasePath, 'fishing.json');

/**
 * Obtém os dados de pesca do arquivo JSON dedicado ou do buffer
 * @returns {Promise<Object>} Dados de pesca
 */
async function getFishingData() {
  try {
    // Se já temos dados no buffer, retornamos ele
    if (fishingDataBuffer !== null) {
      return fishingDataBuffer;
    }

    // Caso contrário, carregamos do arquivo
    try {
      await fs.access(FISHING_DATA_PATH);
    } catch (error) {
      // Se o arquivo não existir, cria um novo com estrutura padrão
      const defaultData = {
        fishingData: {}, // Dados dos jogadores
        groupData: {}  // Dados por grupo
      };
      
      // Atualiza o buffer e retorna
      fishingDataBuffer = defaultData;
      hasUnsavedChanges = true;
      
      // Forçar primeira gravação
      await saveToFile(defaultData);
      
      return defaultData;
    }

    // Lê o arquivo
    const data = await fs.readFile(FISHING_DATA_PATH, 'utf8');
    const parsedData = JSON.parse(data);
    
    // Verifica se o campo groupData existe, caso contrário, adiciona-o
    if (!parsedData.groupData) {
      parsedData.groupData = {};
      hasUnsavedChanges = true;
    }
    
    // Atualiza o buffer
    fishingDataBuffer = parsedData;
    
    return parsedData;
  } catch (error) {
    logger.error('Erro ao ler dados de pesca:', error);
    // Retorna objeto padrão em caso de erro
    const defaultData = {
      fishingData: {},
      groupData: {}
    };
    
    // Atualiza o buffer
    fishingDataBuffer = defaultData;
    hasUnsavedChanges = true;
    
    return defaultData;
  }
}

/**
 * Verifica se é hora de salvar os dados no arquivo
 * @returns {boolean} True se for hora de salvar
 */
function shouldSaveToFile() {
  const now = Date.now();
  return hasUnsavedChanges && (now - lastSaveTime > SAVE_INTERVAL);
}

/**
 * Salva os dados no arquivo (operação real de I/O)
 * @param {Object} data Dados a serem salvos
 * @returns {Promise<boolean>} Status de sucesso
 */
async function saveToFile(data) {
  try {
    // Garante que o diretório exista
    const dir = path.dirname(FISHING_DATA_PATH);
    await fs.mkdir(dir, { recursive: true });

    // Salva os dados no arquivo temporário primeiro
    const tempPath = `${FISHING_DATA_PATH}.temp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
    
    logger.info(`[saveToFile] ${tempPath}`);

    // Renomeia o arquivo temporário para o arquivo final
    // Isso reduz o risco de corrupção durante a gravação
    try {
      await fs.unlink(FISHING_DATA_PATH);
    } catch (err) {
      // Arquivo pode não existir, ignoramos o erro
    }

    logger.info(`[saveToFile] Rename: ${tempPath} => FISHING_DATA_PATH`);
    await fs.rename(tempPath, FISHING_DATA_PATH);
    
    // Atualiza o tempo da última gravação
    lastSaveTime = Date.now();
    hasUnsavedChanges = false;
    
    logger.debug('Dados de pesca salvos no arquivo');
    return true;
  } catch (error) {
    logger.error('Erro ao salvar dados de pesca no arquivo:', error);
    return false;
  }
}

/**
 * Salva os dados de pesca no buffer e possivelmente no arquivo
 * @param {Object} fishingData Dados de pesca a serem salvos
 * @returns {Promise<boolean>} Status de sucesso
 */
async function saveFishingData(fishingData) {
  try {
    // Atualiza o buffer
    fishingDataBuffer = fishingData;
    hasUnsavedChanges = true;
    
    // Verifica se é hora de salvar no arquivo
    if (shouldSaveToFile()) {
      await saveToFile(fishingData);
    }
    
    return true;
  } catch (error) {
    logger.error('Erro ao salvar dados de pesca:', error);
    return false;
  }
}

/**
 * Força o salvamento dos dados no arquivo, independente do temporizador
 */
async function forceSave() {
  if (fishingDataBuffer !== null && hasUnsavedChanges) {
    await saveToFile(fishingDataBuffer);
  }
}

// Configura salvar periodicamente, independente das alterações
setInterval(async () => {
  if (fishingDataBuffer !== null && hasUnsavedChanges) {
    await saveToFile(fishingDataBuffer);
  }
}, SAVE_INTERVAL);

// Configura salvamento antes do fechamento do programa
process.on('exit', () => {
  if (fishingDataBuffer !== null && hasUnsavedChanges) {

    // Usando writeFileSync pois estamos no evento 'exit'
    try {
      if (!fsSync.existsSync(path.dirname(FISHING_DATA_PATH))) {
        fsSync.mkdirSync(path.dirname(FISHING_DATA_PATH), { recursive: true });
      }
      fsSync.writeFileSync(FISHING_DATA_PATH, JSON.stringify(fishingDataBuffer, null, 2));
      logger.info('Dados de pesca salvos antes de encerrar');
    } catch (error) {
      logger.error('Erro ao salvar dados de pesca antes de encerrar:', error);
    }
  }
});

// Configura salvamento em sinais de término
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
  process.on(signal, async () => {
    logger.info(`Recebido sinal ${signal}, salvando dados de pesca...`);
    await forceSave();
  });
});

/**
 * Obtém peixe aleatório do array de peixes com escala de dificuldade
 * @param {Array} fishArray - Array com nomes de peixes
 * @param {boolean} isMultiCatch - Se é uma pescaria múltipla (rede)
 * @returns {Object} Peixe sorteado com peso
 */
async function getRandomFish(fishArray, isMultiCatch = false) {
  // Verifica se o array tem peixes
  if (!fishArray || !Array.isArray(fishArray) || fishArray.length === 0) {
    const customVariables = await database.getCustomVariables();
    fishArray = customVariables.peixes ?? ["Lambari", "Traira"];
  }
  
  // Se for pescaria múltipla, não permite peixes raros
  if (!isMultiCatch) {
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
  }
  
  // Peixe normal
  // Seleciona um peixe aleatório
  const fishIndex = Math.floor(Math.random() * fishArray.length);
  const fishName = fishArray[fishIndex];
  
  // Gera um peso aleatório com dificuldade progressiva
  let weight;
  
  if (Math.random() < 0.8) {
    // 80% de chance de pegar um peixe entre 1kg e DIFFICULTY_THRESHOLD (60kg)
    weight = parseFloat((Math.random() * (DIFFICULTY_THRESHOLD - MIN_FISH_WEIGHT) + MIN_FISH_WEIGHT).toFixed(2));
  } else {
    // 20% de chance de entrar no sistema de dificuldade progressiva
    // Quanto maior o peso, mais difícil de conseguir
    // Usando uma distribuição exponencial invertida
    const difficultyRange = MAX_FISH_WEIGHT - DIFFICULTY_THRESHOLD;
    const randomValue = Math.random();
    // Quanto menor o expoente, mais difícil é pegar peixes grandes
    const exponent = 3; 
    // Quanto maior o resultado de pow, mais perto do peso mínimo da faixa
    const difficultyFactor = 1 - Math.pow(randomValue, exponent);
    
    // Aplica o fator de dificuldade para determinar o peso
    weight = parseFloat((DIFFICULTY_THRESHOLD + (difficultyFactor * difficultyRange)).toFixed(2));
  }
  
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
 * Calcula o tempo até a próxima regeneração de isca
 * @param {Object} userData - Dados do usuário
 * @returns {Object} - Objeto com informações de tempo
 */
function getNextBaitRegenTime(userData) {
  const now = Date.now();
  const lastRegen = userData.lastBaitRegen || now;
  const elapsedSeconds = Math.floor((now - lastRegen) / 1000);
  const secondsUntilNextBait = BAIT_REGEN_TIME - (elapsedSeconds % BAIT_REGEN_TIME);
  
  // Calcula quando todas as iscas estarão regeneradas
  const missingBaits = MAX_BAITS - userData.baits;
  const secondsUntilAllBaits = secondsUntilNextBait + ((missingBaits - 1) * BAIT_REGEN_TIME);
  
  // Calcula os timestamps
  const nextBaitTime = new Date(now + (secondsUntilNextBait * 1000));
  const allBaitsTime = new Date(now + (secondsUntilAllBaits * 1000));
  
  return {
    secondsUntilNextBait,
    secondsUntilAllBaits,
    nextBaitTime,
    allBaitsTime
  };
}

/**
 * Formata tempo em segundos para string legível
 * @param {number} seconds - Segundos para formatar
 * @returns {string} - String formatada
 */
function formatTimeString(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  let timeString = '';
  if (hours > 0) {
    timeString += `${hours}h `;
  }
  if (minutes > 0 || hours > 0) {
    timeString += `${minutes}m `;
  }
  timeString += `${remainingSeconds}s`;
  
  return timeString;
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
  if (!userData.debuffs) userData.debuffs = [];
  
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
          userData.baits = userData.baits + item.value;
          effectMessage = `\n\n${item.emoji} Você encontrou um ${item.name}! +${item.value} iscas adicionadas (${userData.baits}/${MAX_BAITS}).`;
          break;
      }
      break;
      
    case 'downgrade':
      switch (item.effect) {
        case 'weight_loss':
          userData.debuffs.push({
            type: 'weight_loss',
            value: item.value,
            remainingUses: item.duration
          });
          effectMessage = `\n\n${item.emoji} 𝕍𝕠𝕔ê 𝕡𝕖𝕤𝕔𝕠𝕦 𝕦𝕞𝕒... 🕯️𝕍𝔼𝕃𝔸 𝔸ℂ𝔼𝕊𝔸?! 😱 𝒪𝒷𝓇𝒶 𝒹𝑜 𝒸𝒶𝓅𝒾𝓇𝑜𝓉𝑜! 🔥👹🩸`;
          break;

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

function toDemonic(text) {
  const substitutions = {
    a: ['𝖆', 'α', 'ᴀ', 'ᴀ', 'ค'],
    b: ['𝖇', 'в', 'ɓ'],
    c: ['𝖈', 'ƈ', 'ς'],
    d: ['𝖉', 'ԁ', 'ɗ'],
    e: ['𝖊', 'є', 'ɛ', 'ҽ'],
    f: ['𝖋', 'ғ', 'ƒ'],
    g: ['𝖌', 'ɠ', 'g'],
    h: ['𝖍', 'ђ', 'ħ'],
    i: ['𝖎', 'ι', 'ɨ', 'į'],
    j: ['𝖏', 'ʝ', 'ј'],
    k: ['𝖐', 'κ', 'ҡ'],
    l: ['𝖑', 'ʟ', 'ℓ'],
    m: ['𝖒', 'м', 'ʍ'],
    n: ['𝖓', 'и', 'ภ'],
    o: ['𝖔', 'σ', 'ø', 'ɵ'],
    p: ['𝖕', 'ρ', 'ք'],
    q: ['𝖖', 'զ', 'ʠ'],
    r: ['𝖗', 'я', 'ʀ'],
    s: ['𝖘', 'ѕ', 'ʂ'],
    t: ['𝖙', 'τ', '†'],
    u: ['𝖚', 'υ', 'ʋ'],
    v: ['𝖛', 'ν', 'ⱱ'],
    w: ['𝖜', 'ฬ', 'щ'],
    x: ['𝖝', 'ж', 'ҳ'],
    y: ['𝖞', 'ү', 'ყ'],
    z: ['𝖟', 'ʐ', 'ζ']
  };

  function substituteChar(char) {
    const lower = char.toLowerCase();
    if (substitutions[lower]) {
      const options = substitutions[lower];
      const replacement = options[Math.floor(Math.random() * options.length)];
      return char === lower ? replacement : replacement.toUpperCase();
    }
    return char;
  }

  // Embaralhar levemente a string mantendo um pouco de legibilidade
  const chars = text.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    if (Math.random() < 0.3) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
  }

  return chars.map(substituteChar).join('');
}


/**
 * Aplica efeitos de buffs a um peixe
 * @param {Object} userData - Dados do usuário
 * @param {Object} fish - Peixe capturado
 * @returns {Object} - Objeto com peixe modificado e buffs atualizados
 */
function applyBuffs(userData, fish) {
  // Se não há buffs OU debuffs, retorna o peixe original
  if ((!userData.buffs || userData.buffs.length === 0) && (!userData.debuffs || userData.debuffs.length === 0)) {
    return { fish, buffs: [] };
  }
    
  if(!userData.debuffs){
    userData.debuffs = [];
  }
  // Copia o peixe para não modificar o original
  let modifiedFish = { ...fish };
  // Copia os buffs para atualizá-los
  let updatedBuffs = [...userData.buffs];
  let updatedDebuffs = [...userData.debuffs];
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

  updatedDebuffs = updatedDebuffs.filter(debuff => {
    if (debuff.remainingUses <= 0) return false;
    
    switch (debuff.type) {
      case 'weight_loss':
        const originalWeight = modifiedFish.weight;
        modifiedFish.weight *= (1 + debuff.value);
        modifiedFish.weight = parseFloat(modifiedFish.weight.toFixed(2));
        
        modifiedFish.name = toDemonic(modifiedFish.name);
        // Adiciona mensagem de debuff
        buffMessages.push(`⬇️ ⱻ𝖘𝖘𝖊 ⲡ𝖊𝗂𝖝𝖊 𝖕ⲁ𝓇𝖊𝖈𝖊... †αᑰ ʍαɢ𝓇υ? (${originalWeight}kg → ${modifiedFish.weight}kg)`);
        break;
    }
    
    // Decrementa usos restantes
    debuff.remainingUses--;
    // Mantém o buff se ainda tiver usos restantes
    return debuff.remainingUses > 0;
  });


  
  return { fish: modifiedFish, buffs: updatedBuffs, debuffs: updatedDebuffs, buffMessages };
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
    logger.info(`[generateRareFishImage] ${prompt}`)
    
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
    const mockGroup = {filters: {nsfw: false}};
    
    const result = await imagineCommand.method(bot, mockMessage, prompt.split(' '), mockGroup, true);
    
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
        buffs: [],
        debuffs: []
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
        setTimeout((mo) => {
          mo.react("⏰");
        }, 2000, message.origin);
      } catch (reactError) {
        logger.error('Erro ao reagir com emoji de relógio:', reactError);
      }
      return null;
    }
    
    // Verifica se o usuário tem iscas
    if (fishingData.fishingData[userId].baits <= 0) {
      // Apenas reage com emoji de balde vazio, sem mensagem
      try {
        setTimeout((mo) => {
          mo.react("🪣");
        }, 3000, message.origin);
      } catch (reactError) {
        logger.error('Erro ao reagir com emoji de balde:', reactError);
      }
      return null;
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
      fishingData.fishingData[userId].debuffs = buffResult.debuffs;
      
      // Adiciona mensagens de buffs ao effectMessage
      let buffResultMsg = "xxxxxxxx";
      if (buffResult.buffMessages && buffResult.buffMessages.length > 0) {
        buffResultMsg = '\n\n' + buffResult.buffMessages.join('\n');
        effectMessage += buffResultMsg;
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
      
      // Adiciona o peixe à lista do usuário
      fishingData.fishingData[userId].fishes.push(modifiedFish);
      caughtFishes.push(modifiedFish);
      
      // Atualiza o peso total do inventário
      fishingData.fishingData[userId].inventoryWeight = (fishingData.fishingData[userId].inventoryWeight || 0) + modifiedFish.weight;
      
      // Remove o peixe mais leve se exceder o limite
      if (fishingData.fishingData[userId].fishes.length > MAX_FISH_PER_USER) {
        // Encontra o peixe mais leve no inventário
        let lightestFishIndex = 0;
        let lightestFishWeight = fishingData.fishingData[userId].fishes[0].weight;
        
        for (let j = 1; j < fishingData.fishingData[userId].fishes.length; j++) {
          const currentFish = fishingData.fishingData[userId].fishes[j];
          if (currentFish.weight < lightestFishWeight) {
            lightestFishIndex = j;
            lightestFishWeight = currentFish.weight;
          }
        }
        
        // Remove o peixe mais leve
        const removedFish = fishingData.fishingData[userId].fishes.splice(lightestFishIndex, 1)[0];
        
        // Ajusta o peso do inventário
        fishingData.fishingData[userId].inventoryWeight -= removedFish.weight;
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
            
            effectMessage = effectMessage.replace(buffResultMsg, ""); // remove msg do buff se pegou lixo
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
        content: `🎣 ${userName} jogou a linha... ${effectMessage}\n\n> 🪱 Iscas restantes: ${fishingData.fishingData[userId].baits}/${MAX_BAITS}`,
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
    if (caughtFishes.length === 1) {
      const weight = caughtFishes[0].weight;
      if (weight > weightScaleMsgs[5]) {
        effectMessage = '\n\n👏 *EXTRAORDINÁRIO!* Este é um peixe monumental, quase impossível de encontrar!' + effectMessage;
      } else if (weight > weightScaleMsgs[4]) {
        effectMessage = '\n\n👏 *IMPRESSIONANTE!* Este é um peixe muito raro!' + effectMessage;
      } else if (weight > weightScaleMsgs[3]) {
        effectMessage = '\n\n👏 *FENOMENAL!* Um peixe deste tamanho é raro!' + effectMessage;
      } else if (weight > weightScaleMsgs[2]) {
        effectMessage = '\n\n👏 *UAU!* Este é um peixe verdadeiramente enorme!' + effectMessage;
      } else if (weight > weightScaleMsgs[1]) {
        effectMessage = '\n\n👏 Muito impressionante! Que espécime magnífico!' + effectMessage;
      } else if (weight > weightScaleMsgs[0]) {
        effectMessage = '\n\n👏 Um excelente exemplar!' + effectMessage;
      }
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
          // Salva a imagem e registra o peixe lendário
          const savedImageName = await saveRareFishImage(rareFishImage, userId, caughtFishes[0].name);
          
          // Inicializa o array de peixes lendários se não existir
          if (!fishingData.legendaryFishes) {
            fishingData.legendaryFishes = [];
          }
          
          // Adiciona o peixe lendário à lista
          fishingData.legendaryFishes.push({
            fishName: caughtFishes[0].name,
            weight: caughtFishes[0].weight,
            userId: userId,
            userName: userName,
            groupId: groupId || null,
            groupName: group ? group.name : "chat privado",
            timestamp: Date.now(),
            imageName: savedImageName
          });
        
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
            
            const msgsEnviadas = await bot.sendReturnMessages(notificationMessage);
            msgsEnviadas[0].pin(260000);
          }
          
          if (bot.grupoAvisos) {
            const groupName = group ? group.name : "chat privado";
            const notificationMessage = new ReturnMessage({
              chatId: bot.grupoAvisos,
              content: rareFishImage,
              options: {
                caption: `🏆 ${userName} capturou um(a) *${caughtFishes[0].name}* LENDÁRIO(A) de *${caughtFishes[0].weight.toFixed(2)} kg* no grupo "${groupName}"!`
              }
            });
            
            const msgsEnviadas = await bot.sendReturnMessages(notificationMessage);
            msgsEnviadas[0].pin(260000);
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
      fishMessage += `Iscas: ${userData.baits}/${MAX_BAITS}\n`;
      
      // Adiciona informações de regeneração de iscas
      if (userData.baits < MAX_BAITS) {
        const regenInfo = getNextBaitRegenTime(userData);
        fishMessage += `Próxima isca em: ${formatTimeString(regenInfo.secondsUntilNextBait)}\n`;
        fishMessage += `Todas as iscas em: ${formatTimeString(regenInfo.secondsUntilAllBaits)}\n`;
      }

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

      if (userData.debuffs && userData.debuffs.length > 0) {
        fishMessage += `\n*Debuffs Ativos*:\n`;
        userData.debuffs.forEach(debuff => {
          switch (debuff.type) {
            case 'weight_loss':
              fishMessage += `✝️ 𝕰'𝖘𝖍 𝖕𝖍𝖊𝖘𝖍 𝖛𝖍𝖔𝖗𝖓... †𝖆𝖆𝖆𝖌𝖗𝖗𝖗𝖗𝖍𝖙𝖍?? 🐟✝️ (🕯 ${debuff.remainingUses}🕯)\n`;
              break;
          }
        });
      }


      
      // Informa sobre o limite de inventário
      if (fishes.length >= MAX_FISH_PER_USER) {
        fishMessage += `\n⚠️ Seu inventário está cheio! Ao pescar novamente, seu peixe mais leve será liberado.`;
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
 * Salva imagem de peixe raro em disco
 * @param {Object} mediaContent - Objeto MessageMedia
 * @param {string} userId - ID do usuário
 * @param {string} fishName - Nome do peixe
 * @returns {Promise<string>} - Caminho onde a imagem foi salva
 */
async function saveRareFishImage(mediaContent, userId, fishName) {
  try {
    // Cria o diretório de mídia se não existir
    const mediaDir = path.join(database.databasePath, 'media');
    try {
      await fs.access(mediaDir);
    } catch (error) {
      await fs.mkdir(mediaDir, { recursive: true });
    }

    // Cria nome de arquivo único com timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `peixe_raro_${fishName.toLowerCase().replace(/\s+/g, '_')}_${userId.split('@')[0]}_${timestamp}.jpg`;
    const filePath = path.join(mediaDir, fileName);

    // Salva a imagem
    const imageBuffer = Buffer.from(mediaContent.data, 'base64');
    await fs.writeFile(filePath, imageBuffer);
    
    logger.info(`Imagem de peixe raro salva em: ${filePath}`);
    return fileName;
  } catch (error) {
    logger.error('Erro ao salvar imagem de peixe raro:', error);
    return null;
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
    
    fishMessage += `\n*Sistema de Pesos*:\n`;
    fishMessage += `• Peixes normais: 1-100kg\n`;
    fishMessage += `• Até 60kg: chances iguais\n`;
    fishMessage += `• Acima de 60kg: cada vez mais raro quanto maior o peso\n`;
    fishMessage += `• Peixes de 80kg+ são extremamente raros!\n`;
    
    fishMessage += `\n*Iscas*:`;
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
        buffs: [],
        debuffs: []
      };
    }
    
    // Regenera iscas
    fishingData.fishingData[userId] = regenerateBaits(fishingData.fishingData[userId]);
    
    // Calcula tempo para regeneração
    const regenInfo = getNextBaitRegenTime(fishingData.fishingData[userId]);
    
    // Formata o tempo
    const nextBaitTime = regenInfo.nextBaitTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const allBaitsTime = regenInfo.allBaitsTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
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
      baitMessage += `Próxima isca em: ${formatTimeString(regenInfo.secondsUntilNextBait)} (${nextBaitTime})\n`;
      if (fishingData.fishingData[userId].baits < MAX_BAITS - 1) {
        baitMessage += `Todas as iscas em: ${formatTimeString(regenInfo.secondsUntilAllBaits)} (${allBaitsTime})\n`;
      }
    } else {
      baitMessage += `Suas iscas estão no máximo!\n`;
    }

    baitMessage += `\n*Sobre Iscas*:\n`;
    baitMessage += `• Você precisa de iscas para pescar\n`;
    baitMessage += `• Regenera 1 isca a cada ${Math.floor(BAIT_REGEN_TIME/60)} minutos (${Math.floor(BAIT_REGEN_TIME/60/60)} hora e ${Math.floor((BAIT_REGEN_TIME/60) % 60)} minutos)\n`;
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

/**
 * Mostra os peixes lendários que foram pescados
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} Mensagem(ns) de retorno
 */
async function legendaryFishCommand(bot, message, args, group) {
  try {
    // Obtém ID do chat
    const chatId = message.group || message.author;
    
    // Obtém dados de pesca
    const fishingData = await getFishingData();
    
    // Verifica se há peixes lendários
    if (!fishingData.legendaryFishes || fishingData.legendaryFishes.length === 0) {
      return new ReturnMessage({
        chatId,
        content: '🐉 Ainda não foram pescados peixes lendários. Continue pescando e você pode ser o primeiro a encontrar um!'
      });
    }
    
    // Ordena os peixes lendários por data (mais recente primeiro)
    const sortedLegendaryFishes = [...fishingData.legendaryFishes].sort((a, b) => b.timestamp - a.timestamp);
    const rareFishList = RARE_FISH.map(f => `\t${f.emoji} ${f.name} _(${f.weightBonus}kg)_`).join("\n");

    // Prepara a mensagem com a lista completa de todos os peixes lendários
    let textMessage = `🌊 *Lista de Peixes Lendários* 🎣\n${rareFishList}\n\n🏆 *REGISTRO DE PEIXES LENDÁRIOS* 🎖️\n\n`;
    
    // Adiciona todos os peixes lendários na mensagem de texto
    for (let i = 0; i < sortedLegendaryFishes.length; i++) {
      const legendary = sortedLegendaryFishes[i];
      
      // Formata data para um formato legível
      const date = new Date(legendary.timestamp).toLocaleDateString('pt-BR');
      
      // Adiciona emoji especial para os 3 primeiros
      const medal = i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : `${i+1}. `;
      
      textMessage += `${medal}*${legendary.fishName}* (${legendary.weight.toFixed(2)} kg)\n`;
      textMessage += `   Pescador: ${legendary.userName}\n`;
      textMessage += `   Local: ${legendary.groupName || 'desconhecido'}\n`;
      textMessage += `   Data: ${date}\n\n`;
    }
    
    // Adiciona mensagem sobre as imagens
    if (sortedLegendaryFishes.length > 0) {
      textMessage += `🖼️ *Mostrando imagens das ${Math.min(5, sortedLegendaryFishes.length)} lendas mais recentes...*`;
    }
    
    // Mensagens a serem enviadas
    const messages = [];
    
    // Adiciona a mensagem de texto inicial
    messages.push(new ReturnMessage({
      chatId,
      content: textMessage
    }));
    
    // Limita a 5 peixes para as imagens
    const legendaryToShow = sortedLegendaryFishes.slice(0, 5);
    
    // Cria uma mensagem para cada peixe lendário (apenas os 5 mais recentes)
    for (const legendary of legendaryToShow) {
      try {
        let content;
        let options = {};
        
        // Tenta carregar a imagem se existir
        if (legendary.imageName) {
          const imagePath = path.join(database.databasePath, 'media', legendary.imageName);
          try {
            await fs.access(imagePath);
            // Imagem existe, cria média
            const media = await bot.createMedia(imagePath);
            content = media;
            
            // Prepara a legenda
            const date = new Date(legendary.timestamp).toLocaleDateString('pt-BR');
            options.caption = `🏆 *Peixe Lendário*\n\n*${legendary.fishName}* de ${legendary.weight.toFixed(2)} kg\nPescado por: ${legendary.userName}\nLocal: ${legendary.groupName || 'desconhecido'}\nData: ${date}`;
          } catch (imageError) {
            // Imagem não existe, pula para o próximo
            logger.error(`Imagem do peixe lendário não encontrada: ${imagePath}`, imageError);
            continue;
          }
        } else {
          // Sem imagem, pula para o próximo
          continue;
        }
        
        // Adiciona a mensagem à lista
        messages.push(new ReturnMessage({
          chatId,
          content,
          options,
          // Adiciona delay para evitar envio muito rápido
          delay: messages.length * 1000 
        }));
        
      } catch (legendaryError) {
        logger.error('Erro ao processar peixe lendário:', legendaryError);
      }
    }
    
    if (messages.length === 1) {
      return messages[0]; // Retorna apenas a mensagem de texto se não houver imagens
    }
    
    return messages;
  } catch (error) {
    logger.error('Erro no comando de peixes lendários:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Ocorreu um erro ao mostrar os peixes lendários. Por favor, tente novamente.'
    });
  }
}


/**
 * Atualiza peixes raros após o bug
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function updateRareFishesAfterBug(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Envia mensagem de processamento
    await bot.sendReturnMessages(new ReturnMessage({
      chatId: chatId,
      content: '🔄 Iniciando verificação de peixes raros... Este processo pode demorar alguns minutos.'
    }));

    logger.info('🔄 Iniciando verificação de peixes raros... Este processo pode demorar alguns minutos.');
    
    // Obtém dados de pesca
    const fishingData = await getFishingData();
    
    // Inicializa o array de peixes lendários se não existir
    if (!fishingData.legendaryFishes) {
      fishingData.legendaryFishes = [];
    }
    
    // Lista para armazenar os peixes raros encontrados
    const foundRareFishes = [];
    
    // Contadores para o relatório
    let countAdded = 0;
    let countProcessed = 0;
    let countBiggestAdded = 0;
    
    // Para cada usuário, verificar seu biggestFish e seus peixes
    for (const [userId, userData] of Object.entries(fishingData.fishingData)) {
      const userName = userData.name || "Pescador";
      
      // 1. Verifica o biggestFish
      if (userData.biggestFish && isRareFish(userData.biggestFish.name)) {
        // Verifica se este peixe não está no array fishes
        const fishExists = userData.fishes.some(fish => 
          fish.name === userData.biggestFish.name && 
          fish.weight === userData.biggestFish.weight
        );
        
        if (!fishExists) {
          // Adiciona o biggestFish ao array fishes
          userData.fishes.push({...userData.biggestFish});
          countBiggestAdded++;
          
          // Também adiciona à lista de encontrados para processamento
          foundRareFishes.push({
            userId,
            userName,
            fish: userData.biggestFish,
            groupId: null, // Não sabemos o grupo original
            groupName: "desconhecido"
          });
        }
      }
      
      // 2. Verifica todos os peixes no array fishes
      for (const fish of userData.fishes) {
        if (isRareFish(fish.name) || (fish.isRare === true)) {
          // Marca o peixe como raro se não estiver marcado
          if (!fish.isRare) {
            fish.isRare = true;
            
            // Adiciona emoji e outros campos que possa estar faltando
            const rareFishData = RARE_FISH.find(rf => rf.name === fish.name);
            if (rareFishData) {
              fish.emoji = rareFishData.emoji || '🐠';
              if (!fish.baseWeight && !fish.bonusWeight) {
                fish.baseWeight = fish.weight - rareFishData.weightBonus;
                fish.bonusWeight = rareFishData.weightBonus;
              }
            } else {
              fish.emoji = '🐠';
            }
          }
          
          // Verifica se este peixe já está em legendaryFishes
          const alreadyInLegendary = fishingData.legendaryFishes.some(lf => 
            lf.userId === userId && 
            lf.fishName === fish.name && 
            lf.weight === fish.weight
          );
          
          if (!alreadyInLegendary) {
            // Adiciona à lista para processamento
            foundRareFishes.push({
              userId,
              userName,
              fish,
              groupId: null, // Não sabemos o grupo original
              groupName: "desconhecido"
            });
          }
        }
      }
    }
    
    // Agora, processa todos os peixes raros encontrados
    const updateMessage = `🔄 Encontrados ${foundRareFishes.length} peixes raros para processar...`;
    logger.info(updateMessage);
    await bot.sendReturnMessages(new ReturnMessage({
      chatId: chatId,
      content: updateMessage
    }));
    
    for (const [index, rareFishData] of foundRareFishes.entries()) {
      try {
        // Gera a imagem para o peixe raro
        const progress = `🔄 Processando peixe ${index + 1}/${foundRareFishes.length}: ${rareFishData.fish.name} (${rareFishData.userName})`;
        logger.info(progress);
        if ((index + 1) % 5 === 0 || index === 0) {
          await bot.sendReturnMessages(new ReturnMessage({
            chatId: chatId,
            content: progress
          }));
        }
        
        const rareFishImage = await generateRareFishImage(bot, rareFishData.userName, rareFishData.fish.name);
        
        if (rareFishImage) {
          // Salva a imagem
          const savedImageName = await saveRareFishImage(rareFishImage, rareFishData.userId, rareFishData.fish.name);
          
          // Adiciona o peixe lendário à lista
          fishingData.legendaryFishes.push({
            fishName: rareFishData.fish.name,
            weight: rareFishData.fish.weight,
            userId: rareFishData.userId,
            userName: rareFishData.userName,
            groupId: rareFishData.groupId,
            groupName: rareFishData.groupName || "grupo desconhecido",
            timestamp: rareFishData.fish.timestamp || Date.now(),
            imageName: savedImageName
          });
          
          countAdded++;

          // Notifica o grupo com a imagem

          try {
            const notificationMessage = new ReturnMessage({
              chatId: rareFishData.groupId,
              content: rareFishImage,
              options: {
                caption: `🏆 [Atrasado] ${rareFishData.userName} capturou um(a) *${rareFishData.fish.name}* LENDÁRIO(A) de *${rareFishData.fish.weight.toFixed(2)} kg*!`
              }
            });
            
            try{
              await bot.sendReturnMessages(notificationMessage);
            } catch(e){
              logger.error("erro return bot num e do grupo");
            }
          } catch (notifyError) {
            logger.error('Erro ao notificar grupo de interação:', notifyError);
          }
          
          // // Notifica o grupo de interação sobre o peixe raro se disponível
          // if (bot.grupoInteracao) {
          //   try {
          //     const notificationMessage = new ReturnMessage({
          //       chatId: bot.grupoInteracao,
          //       content: rareFishImage,
          //       options: {
          //         caption: `🏆 [RECUPERADO] ${rareFishData.userName} capturou um(a) *${rareFishData.fish.name}* LENDÁRIO(A) de *${rareFishData.fish.weight.toFixed(2)} kg*!`
          //       }
          //     });
              
          //     await bot.sendReturnMessages(notificationMessage);
          //   } catch (notifyError) {
          //     logger.error('Erro ao notificar grupo de interação:', notifyError);
          //   }
          // }

        }
        
        countProcessed++;
      } catch (processError) {
        logger.error(`Erro ao processar peixe raro de ${rareFishData.userName}:`, processError);
      }

      await sleep(5000);
    }
    
    // Salva os dados atualizados
    await saveFishingData(fishingData);
    
    // Envia relatório final
    return new ReturnMessage({
      chatId: chatId,
      content: `✅ *Atualização de Peixes Raros Concluída*\n\n` +
        `🔍 Peixes raros encontrados: ${foundRareFishes.length}\n` +
        `🐠 Peixes processados com sucesso: ${countProcessed}\n` +
        `🏆 Peixes adicionados à lista de lendários: ${countAdded}\n` +
        `📊 Peixes adicionados do "biggestFish": ${countBiggestAdded}\n\n` +
        `Os peixes raros foram recuperados e agora estão devidamente registrados!`
    });
  } catch (error) {
    logger.error('Erro ao atualizar peixes raros:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: `❌ Ocorreu um erro ao atualizar os peixes raros: ${error.message}\n\nConsulte os logs para mais detalhes.`
    });
  }
}

/**
 * Verifica se o nome do peixe corresponde a um peixe raro
 * @param {string} fishName - Nome do peixe
 * @returns {boolean} - True se for um peixe raro
 */
function isRareFish(fishName) {
  if (!fishName) return false;
  return RARE_FISH.some(rare => rare.name === fishName);
}

/**  
 * Reseta os dados de pesca para o grupo atual  
 * @param {WhatsAppBot} bot - Instância do bot  
 * @param {Object} message - Dados da mensagem  
 * @param {Array} args - Argumentos do comando  
 * @param {Object} group - Dados do grupo  
 * @returns {Promise<ReturnMessage>} Mensagem de retorno  
 */  
async function resetFishingDataCommand(bot, message, args, group) {  
  try {  
    // Verifica se é um grupo  
    if (!message.group) {  
      return new ReturnMessage({  
        chatId: message.author,  
        content: "❌ Este comando só pode ser usado em grupos.",  
        options: {  
          quotedMessageId: message.origin.id._serialized  
        }  
      });  
    }  
  
    // Verifica se o usuário é admin  
    const isAdmin = await bot.adminUtils.isAdmin(message.author, group, null, bot.client);  
    if (!isAdmin) {  
      return new ReturnMessage({  
        chatId: message.group || message.author,  
        content: "❌ Este comando só pode ser usado por administradores do grupo.",  
        options: {  
          quotedMessageId: message.origin.id._serialized  
        }  
      });  
    }  
  
    // Obtém dados de pesca  
    const fishingData = await getFishingData();  
      
    // Verifica se há dados para este grupo  
    if (!fishingData.groupData || !fishingData.groupData[message.group]) {  
      return new ReturnMessage({  
        chatId: message.group,  
        content: "ℹ️ Não há dados de pesca para este grupo.",  
        options: {  
          quotedMessageId: message.origin.id._serialized  
        }  
      });  
    }  
  
    // Faz backup dos dados antes de resetar  
    const backupData = { ...fishingData.groupData[message.group] };  
    const numPlayers = Object.keys(backupData).length;  
      
    // Reseta os dados do grupo  
    fishingData.groupData[message.group] = {};  
      
    // Salva os dados atualizados  
    await saveFishingData(fishingData);  
      
    return new ReturnMessage({  
      chatId: message.group,  
      content: `✅ Dados de pesca resetados com sucesso!\n\n${numPlayers} jogadores tiveram seus dados de pesca neste grupo apagados.`,  
      options: {  
        quotedMessageId: message.origin.id._serialized  
      }  
    });  
  } catch (error) {  
    logger.error('Erro ao resetar dados de pesca:', error);  
      
    return new ReturnMessage({  
      chatId: message.group || message.author,  
      content: '❌ Ocorreu um erro ao resetar os dados de pesca. Por favor, tente novamente.',  
      options: {  
        quotedMessageId: message.origin.id._serialized  
      }  
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
    name: 'pesca-iscas',
    description: 'Mostra suas iscas de pesca',
    category: "jogos",
    cooldown: 5,
    reactions: {
      after: "🪱",
      error: "❌"
    },
    method: showBaitsCommand
  }),
  new Command({
    name: 'pesca-lendas',
    description: 'Mostra os peixes lendários que foram pescados',
    category: "jogos",
    cooldown: 10,
    reactions: {
      after: "🐉",
      error: "❌"
    },
    method: legendaryFishCommand
  }),
  new Command({  
    name: 'pesca-reset',  
    description: 'Reseta os dados de pesca para o grupo atual',  
    category: "jogos",  
    adminOnly: true,  
    cooldown: 10,  
    reactions: {  
      before: "⏳",  
      after: "✅",  
      error: "❌"  
    },  
    method: resetFishingDataCommand  
  })
];

// Exporta os comandos e uma função para forçar o salvamento
module.exports = { 
  commands,
  forceSaveFishingData: forceSave 
};