/**
 * @file Gerencia a lógica do jogo Anagrama para o bot.
 * @author Zacksb
 */

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const { MessageMedia } = require('whatsapp-web.js');
const Command = require('../models/Command');
const Database = require('../utils/Database');
const Canvas = require("canvas");

const logger = new Logger('anagrama-game');
const database = Database.getInstance();

// --- Configurações do Jogo ---
const GAME_DURATION_SECONDS = 45;
const HINTS_PER_ROUND = 3;
const SKIPS_PER_ROUND = 3;
const DEBOUNCE_SAVE_MS = 5000; // Salva 5s após a última alteração

// --- Caminhos ---
const ANAGRAMA_DATA_PATH = path.join(database.databasePath, 'anagrama.json');
const ANAGRAMA_LETTERS_PATH = path.join(database.databasePath, 'letters');
const ANAGRAMA_WORDS_PATH = path.join(database.databasePath, 'words');

// --- Estado do Jogo ---
/**
 * Armazena os jogos ativos por ID de grupo.
 * @type {Object<string, import('./AnagramGame').GameSession>}
 */
let activeGames = {};
let anagramaData = { groups: {} }; // Buffer de dados em memória

/**
 * @typedef {Object} GameSession
 * @property {number} round
 * @property {number} hintsUsed
 * @property {number} skipsUsed
 * @property {string} word
 * @property {string} scrambledWord
 * @property {NodeJS.Timeout} timer
 * @property {boolean[]} revealedLetters
 */


// --- Funções de Utilitário ---

/**
 * Cria uma função "debounced", que atrasa a execução de `func` até que `wait` milissegundos
 * tenham se passado desde a última vez que foi invocada.
 * @param {Function} func A função para "debounce".
 * @param {number} wait O número de milissegundos para atrasar.
 * @returns {Function} A nova função "debounced".
 */
function debounce(func, wait) {
  let timeout;
  const debounced = (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
  // Permite forçar o salvamento imediato se necessário (ex: ao desligar)
  debounced.flush = () => {
    clearTimeout(timeout);
    func();
  };
  return debounced;
}

/**
 * Lê palavras de um arquivo de texto.
 * @param {"portuguese" | "english"} language Idioma das palavras.
 * @returns {string[]}
 */
function readWordsFromFile(language) {
  try {
    const filePath = path.join(ANAGRAMA_WORDS_PATH, `${language}.txt`);
    return fsSync.readFileSync(filePath, 'utf8').split('\n').filter(Boolean); // filter(Boolean) remove linhas vazias
  } catch (error) {
    logger.warn(`Arquivo de palavras para "${language}" não encontrado. Usando lista de fallback.`);
    return [
      "laranja", "computador", "biblioteca", "desenvolvedor", "inteligencia",
      "paralelepipedo", "ornitorrinco", "felicidade", "aventura", "tecnologia",
      "abacaxi", "bicicleta", "hipopotamo", "rinoceronte", "independencia"
    ];
  }
}

const WORD_LIST = readWordsFromFile('portuguese');

// --- Gerenciamento de Dados ---

/**
 * Salva os dados do anagrama no arquivo.
 * Esta função é envolvida por um debounce para otimização.
 */
const saveToFile = async () => {
  try {
    const tempPath = `${ANAGRAMA_DATA_PATH}.temp`;
    await fs.writeFile(tempPath, JSON.stringify(anagramaData, null, 2));
    await fs.rename(tempPath, ANAGRAMA_DATA_PATH);
    logger.debug('Dados do anagrama salvos no arquivo.');
  } catch (error) {
    logger.error('Erro ao salvar dados do anagrama:', error);
  }
};

// Cria a versão debounced da função de salvar.
const saveAnagramaData = debounce(saveToFile, DEBOUNCE_SAVE_MS);

/**
 * Carrega os dados do anagrama do arquivo JSON para a memória.
 */
async function loadAnagramaData() {
  try {
    const data = await fs.readFile(ANAGRAMA_DATA_PATH, 'utf8');
    anagramaData = JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info('Arquivo de dados não encontrado, criando um novo.');
      await saveAnagramaData(); // Salva a estrutura padrão inicial
    } else {
      logger.error('Erro ao carregar dados do anagrama:', error);
    }
  }
}


/**
 * Embaralha os caracteres de uma palavra.
 * @param {string} word A palavra a ser embaralhada.
 * @returns {string} A palavra embaralhada.
 */
function scrambleWord(word) {
  const arr = word.split('');
  let scrambled;
  do {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    scrambled = arr.join('');
  } while (scrambled === word); // Garante que a palavra embaralhada seja diferente da original
  return scrambled;
}

/**
 * Gera uma imagem com a palavra embaralhada.
 */
async function generateImageText(word, level, record) {
  const spaceBetweenLetters = 2;
  const totalWidth = 512;
  const totalHeight = 512;

  const letterWidth = (totalWidth - (word.length - 1) * spaceBetweenLetters) / word.length;
  const letterHeight = letterWidth;

  const canvas = Canvas.createCanvas(totalWidth, totalHeight);
  const context = canvas.getContext('2d');

  const startX = (totalWidth - (word.length * (letterWidth + spaceBetweenLetters) - spaceBetweenLetters)) / 2;
  const startY = (totalHeight - letterHeight) / 2;

  let currentX = startX;

  for (const char of word) {
    let letter = char.toLowerCase();
    if (letter === " ") letter = "space";
    // Usar path.join é uma boa prática para compatibilidade
    const imagePath = path.join(ANAGRAMA_LETTERS_PATH, `${letter}.png`);

    if (fsSync.existsSync(imagePath)) {
      const letterImage = await Canvas.loadImage(imagePath);
      context.drawImage(letterImage, currentX, startY, letterWidth, letterHeight);
      currentX += letterWidth + spaceBetweenLetters;
    }
  }

  // Configurações de texto para Nível e Recorde
  const fontSize = 40;
  context.font = `${fontSize}px "Arial"`;
  context.textAlign = "center";
  context.lineWidth = 5;
  context.strokeStyle = 'black';
  context.fillStyle = 'white';
  const textX = totalWidth / 2;

  if (level) {
    context.strokeText(level, textX, 45);
    context.fillText(level, textX, 45);
  }
  if (record) {
    context.strokeText(record, textX, totalHeight - 20);
    context.fillText(record, textX, totalHeight - 20);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Finaliza uma partida de anagrama.
 * @param {object} bot Instância do bot.
 * @param {string} groupId ID do grupo.
 * @param {'time_up' | 'reset'} reason Motivo do fim do jogo.
 */
async function endGame(bot, groupId, reason) {
  const game = activeGames[groupId];
  if (!game) return;

  clearTimeout(game.timer);
  delete activeGames[groupId];

  const groupData = anagramaData.groups[groupId] || { recordRound: 0, scores: {} };
  let messageContent = '';

  if (reason === 'time_up') {
    const newRecord = game.round > (groupData.recordRound || 0);
    if (newRecord) {
      groupData.recordRound = game.round;
      anagramaData.groups[groupId] = groupData;
      saveAnagramaData();
    }

    const sortedPlayers = Object.values(groupData.scores || {}).sort((a, b) => b.points - a.points);
    const sessionRanking = sortedPlayers.length > 0
      ? generateRankingText(sortedPlayers, `\n🏆 *Ranking da Partida*\n\n`)
      : "Ninguém pontuou nessa partida.";

    messageContent = `⏰ O tempo acabou! A palavra era *"${game.word}"*.\n\nVocês chegaram à *rodada ${game.round}*!\n${sessionRanking}`;
    if (newRecord) {
      messageContent += `\n\n🏆 *NOVO RECORDE DO GRUPO!*`;
    }
  } else if (reason === 'reset') {
    messageContent = `⚙️ O jogo de anagrama foi resetado por um administrador.`;
  }

  if (messageContent) {
    bot.sendReturnMessages(new ReturnMessage({ chatId: groupId, content: messageContent }));
  }
}

/**
 * Inicia uma nova rodada do jogo.
 */
async function startNewRound(bot, message, group, isFirstRound = true) {
  const groupId = message.group;
  const game = activeGames[groupId];
  if (!game) return;

  clearTimeout(game.timer);

  const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
  console.log(word)
  const scrambledWord = scrambleWord(word);

  // Atualiza o estado da sessão
  Object.assign(game, {
    word,
    scrambledWord,
    revealedLetters: new Array(word.length).fill(false),
    timer: setTimeout(() => endGame(bot, groupId, 'time_up'), GAME_DURATION_SECONDS * 1000),
  });

  const groupData = anagramaData.groups[groupId];
  const buffer = await generateImageText(
    scrambledWord,
    `⭐ Rodada ${game.round}`,
    `🏆 Recorde: ${groupData?.recordRound || 0}`
  );

  const media = new MessageMedia('image/png', buffer.toString('base64'));
  bot.sendReturnMessages(new ReturnMessage({
    chatId: groupId,
    content: media,
    options: { sendMediaAsSticker: true, stickerAuthor: "Ravena", stickerName: group.name }
  }));

  if (isFirstRound) {
    const hintsLeft = HINTS_PER_ROUND - game.hintsUsed;
    const skipsLeft = SKIPS_PER_ROUND - game.skipsUsed;
    let startMessage = `Use *!a <palpite>* para responder.\n`;
    startMessage += `Você tem ${GAME_DURATION_SECONDS} segundos!\n\n`;
    startMessage += `> 💡 Dicas: ${hintsLeft} | 🐇 Pulos: ${skipsLeft}`;
    bot.sendReturnMessages(new ReturnMessage({ chatId: groupId, content: startMessage }));
  }
}



/**
 * Gera o texto do ranking.
 * @param {Array<Object>} users Array de jogadores com nome e pontos.
 * @param {string} [customText] Cabeçalho personalizado.
 * @returns {string}
 */
function generateRankingText(users, customText) {
  const sortedUsers = users.sort((a, b) => b.points - a.points).slice(0, 15);
  let rankingText = `${customText || "🏆 *Ranking do Grupo*\n\n"}`;
  const emojis = ['🥇', '🥈', '🥉', '🏅', '🎖'];

  sortedUsers.forEach((user, i) => {
    const emoji = emojis[i] || '🔸';
    rankingText += `${emoji} ${user.name.trim()} - Pontuação: *${user.points}*\n`;
  });

  return rankingText;
}


// --- Comandos do Jogo ---

async function startGameCommand(bot, message, args, group) {
  const groupId = message.group;
  if (!groupId) {
    return new ReturnMessage({ chatId: message.author, content: 'O jogo de anagrama só pode ser jogado em grupos.' });
  }
  if (activeGames[groupId]) {
    return new ReturnMessage({
      chatId: groupId,
      content: `Já existe uma partida em andamento na *rodada ${activeGames[groupId].round}*! A palavra é: *${activeGames[groupId].scrambledWord}*`,
      options: { quotedMessageId: message.origin.id._serialized }
    });
  }

  // Cria uma nova sessão de jogo
  activeGames[groupId] = {
    round: 1,
    hintsUsed: 0,
    skipsUsed: 0,
  };

  startNewRound(bot, message, group, true);
  return null;
}

async function guessCommand(bot, message, args, group) {
  const groupId = message.group;
  const game = activeGames[groupId];
  if (!game) return null; // Ignora palpites se não houver jogo

  const guess = args[0]?.toLowerCase();
  if (!guess) {
    return new ReturnMessage({
      chatId: groupId,
      content: 'Você precisa fornecer um palpite. Ex: `!a palavra`',
      options: { quotedMessageId: message.origin.id._serialized }
    });
  }

  if (guess === game.word.toLowerCase()) {
    const userId = message.author;
    const userName = message.authorName || "Jogador";

    // Atualiza a pontuação
    const groupScores = anagramaData.groups[groupId]?.scores || {};
    if (!groupScores[userId]) {
      groupScores[userId] = { name: userName, points: 0 };
    }
    groupScores[userId].points += 1;
    groupScores[userId].name = userName; // Sempre atualiza o nome

    if (!anagramaData.groups[groupId]) {
      anagramaData.groups[groupId] = { scores: {}, recordRound: 0 };
    }
    anagramaData.groups[groupId].scores = groupScores;
    saveAnagramaData();

    // A LÓGICA DE AVANÇO FICA AQUI AGORA
    const successMessage = `🎉 *${userName} acertou!* Pontuação: *${groupScores[userId].points}*`;

    game.round++; // Incrementa a rodada SÓ no acerto

    bot.sendReturnMessages(new ReturnMessage({
      chatId: message.group,
      content: `${successMessage}\n\n🔄 Iniciando próxima rodada... 🌟 *Level ${game.round}*`
    }));

    setTimeout(() => {
      startNewRound(bot, message, group, false);
    }, 2000); // 2 segundos de delay

  } else {
    // Reage com base na similaridade
    const distance = (s1, s2) => { /* Implementação de Levenshtein */
      const costs = []; for (let i = 0; i <= s1.length; i++) { let lastValue = i; for (let j = 0; j <= s2.length; j++) { if (i === 0) costs[j] = j; else if (j > 0) { let newValue = costs[j - 1]; if (s1.charAt(i - 1) !== s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1; costs[j - 1] = lastValue; lastValue = newValue; } } if (i > 0) costs[s2.length] = lastValue; } return costs[s2.length];
    };
    const similarity = 1 - (distance(guess, game.word) / Math.max(guess.length, game.word.length));

    let reaction = '🥶'; // Frio
    if (similarity > 0.80) reaction = '🔥'; // Quente
    else if (similarity > 0.50) reaction = '🌡️'; // Morno

    message.origin.react(reaction).catch(e => logger.error("Falha ao reagir:", e));
  }
  return null;
}

async function hintCommand(bot, message) {
  const groupId = message.group;
  const game = activeGames[groupId];
  if (!game) return new ReturnMessage({ chatId: groupId, content: 'Não há um jogo em andamento.' });
  if (game.hintsUsed >= HINTS_PER_ROUND) return new ReturnMessage({ chatId: groupId, content: '> As dicas para esta rodada já acabaram!' });

  const unrevealedIndices = game.revealedLetters.map((revealed, i) => revealed ? null : i).filter(i => i !== null);
  if (unrevealedIndices.length <= 2) return new ReturnMessage({ chatId: groupId, content: '> A palavra já está muito revelada!' });

  const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
  game.revealedLetters[randomIndex] = true;
  game.hintsUsed++;

  const hintDisplay = game.word.split('').map((char, i) => game.revealedLetters[i] ? ` ${char.toUpperCase()} ` : ' __ ').join('');
  const hintsLeft = HINTS_PER_ROUND - game.hintsUsed;

  return new ReturnMessage({
    chatId: groupId,
    content: `📝 *Dica:* ${hintDisplay}\n\n> 💡 Você tem mais ${hintsLeft} dica(s).`
  });
}

async function skipCommand(bot, message, args, group) {
  const groupId = message.group;
  const game = activeGames[groupId];
  if (!game) return new ReturnMessage({ chatId: groupId, content: '> Não há um jogo em andamento para pular.' });
  if (game.skipsUsed >= SKIPS_PER_ROUND) return new ReturnMessage({ chatId: groupId, content: '> Os pulos para esta rodada já acabaram!' });

  game.skipsUsed++;
  const skipsLeft = SKIPS_PER_ROUND - game.skipsUsed;
  const skippedWord = game.word;

  // A LÓGICA DE TROCAR A PALAVRA FICA AQUI
  // Note que game.round NÃO é incrementado
  bot.sendReturnMessages(new ReturnMessage({
    chatId: groupId,
    content: `⏭️ A palavra *"${skippedWord}"* foi pulada!\n\n> 🐇 Pulos restantes: ${skipsLeft}\n\n🔄 Carregando nova palavra para a *rodada ${game.round}*...`
  }));

  // Inicia a próxima rodada (com uma nova palavra, mas no mesmo nível)
  setTimeout(() => {
    startNewRound(bot, message, group, false);
  }, 2000); // 2 segundos de delay

  return null;
}

async function rankingCommand(bot, message) {
  const groupId = message.group;
  if (!groupId) return new ReturnMessage({ chatId: message.author, content: '> O ranking só pode ser visto em grupos.' });

  const groupData = anagramaData.groups[groupId];
  if (!groupData || (!groupData.scores && !groupData.recordRound)) {
    return new ReturnMessage({ chatId: groupId, content: '🏆 Ainda não há dados de Anagrama para este grupo. Comece a jogar com `!anagrama`!' });
  }

  let rankingMessage = '';
  const players = Object.values(groupData.scores || {});

  if (players.length === 0) {
    rankingMessage += '📊 *Ainda não há jogadores no ranking.*';
  } else {
    rankingMessage += generateRankingText(players);
  }
  rankingMessage += `\n📈 *Recorde do Grupo:* ${groupData.recordRound || 0} rodadas`;

  return new ReturnMessage({ chatId: groupId, content: rankingMessage });
}

async function resetCommand(bot, message, args, group) {
  const groupId = message.group;
  if (!groupId) return new ReturnMessage({ chatId: message.author, content: 'Este comando só funciona em grupos.' });
  const isAdmin = await bot.adminUtils.isAdmin(message.author, group, null, bot.client);
  if (!isAdmin) return new ReturnMessage({ chatId: groupId, content: '❌ Apenas administradores podem resetar os dados.' });

  if (activeGames[groupId]) {
    endGame(bot, groupId, 'reset');
  }

  if (anagramaData.groups[groupId]) {
    delete anagramaData.groups[groupId];
    saveAnagramaData(); // Salva a remoção
    return new ReturnMessage({ chatId: groupId, content: '✅ O ranking e recorde do Anagrama para este grupo foram resetados!' });
  } else {
    return new ReturnMessage({ chatId: groupId, content: 'ℹ️ Não há dados de Anagrama para este grupo para serem resetados.' });
  }
}

// Inicializa os dados ao carregar o módulo
loadAnagramaData();

// Garante que os dados pendentes sejam salvos ao encerrar
process.on('exit', () => {
  logger.info('Salvando dados do anagrama antes de encerrar...');
  saveAnagramaData.flush(); // Força a execução da função debounced, se houver uma pendente
});

// --- Definição dos Comandos ---
const commands = [
  new Command({
    name: 'anagrama',
    description: 'Inicia uma partida do jogo Anagrama.',
    category: 'jogos',
    aliases: ['anagram'],
    cooldown: 20,
    method: startGameCommand,
    reactions: {
      before: '🧩',
      error: '❌'
    }
  }),
  new Command({
    name: 'a',
    description: 'Envia um palpite para o jogo Anagrama.',
    category: 'jogos',
    usage: '!a <palpite>',
    needsArgs: true,
    cooldown: 2,
    method: guessCommand
  }),
  new Command({
    name: 'dica',
    description: 'Pede uma dica para a palavra atual do Anagrama.',
    category: 'jogos',
    cooldown: 5,
    method: hintCommand,
    reactions: {
      after: '📝',
      error: '❌'
    }
  }),
  new Command({
    name: 'pular',
    description: 'Pula a palavra atual no jogo Anagrama.',
    category: 'jogos',
    cooldown: 5,
    method: skipCommand,
    reactions: {
      after: '⏭️',
      error: '❌'
    }
  }),
  new Command({
    name: 'anagrama-ranking',
    description: 'Mostra o ranking do jogo Anagrama.',
    category: 'jogos',
    aliases: ['a-rank', 'anagramaranking'],
    cooldown: 10,
    method: rankingCommand,
    reactions: {
      after: '🏆',
      error: '❌'
    }
  }),
  new Command({
    name: 'anagrama-reset',
    description: 'Reseta o ranking do Anagrama para o grupo (admins).',
    category: 'jogos',
    adminOnly: true,
    cooldown: 60,
    method: resetCommand,
    reactions: {
      before: '🗑️',
      after: '✅',
      error: '❌'
    }
  })
];

module.exports = {
  commands,
  forceSaveAnagramaData: saveAnagramaData.flush
};