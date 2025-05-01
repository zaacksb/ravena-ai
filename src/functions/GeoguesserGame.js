// src/functions/GeoguesserGame.js
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const Database = require('../utils/Database');

const logger = new Logger('geoguesser-game');
const database = Database.getInstance();

// Configurações do jogo
const GAME_DURATION = 5 * 60 * 1000; // 5 minutos em milissegundos
const IMAGE_ANGLES = [0, 90, 180, 270]; // Ângulos para StreetView
const MIN_DISTANCE_PERFECT = 500; // 500 metros ou menos = 100 pontos
const MAX_DISTANCE_POINTS = 500000; // 500 km ou mais = 0 pontos

// Armazena os jogos ativos
const activeGames = {};

// API Key - Deve ser configurada no .env como GOOGLE_MAPS_API_KEY
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Lista de coordenadas pré-definidas com StreetView disponível
// Estas são apenas coordenadas de exemplo - no funcionamento real, teríamos um banco de dados maior
const PREDEFINED_LOCATIONS = [
  { lat: 48.8584, lng: 2.2945 }, // Paris, Torre Eiffel
  { lat: 40.6892, lng: -74.0445 }, // Nova York, Estátua da Liberdade
  { lat: 37.8199, lng: -122.4783 }, // São Francisco, Golden Gate
  { lat: -22.9519, lng: -43.2106 }, // Rio de Janeiro, Cristo Redentor
  { lat: 35.6585, lng: 139.7454 }, // Tóquio, Torre de Tóquio
  { lat: 41.8902, lng: 12.4922 }, // Roma, Coliseu
  { lat: 27.1751, lng: 78.0421 }, // Agra, Taj Mahal
  { lat: 25.1972, lng: 55.2744 }, // Dubai, Burj Khalifa
  { lat: -33.8568, lng: 151.2153 }, // Sydney, Opera House
  { lat: 51.5007, lng: -0.1246 }, // Londres, Big Ben
  { lat: 13.4125, lng: 103.8670 }, // Angkor Wat, Camboja
  { lat: -13.1631, lng: -72.5450 }, // Machu Picchu, Peru
  { lat: 43.0729, lng: -79.0791 }, // Cataratas do Niágara
  { lat: 48.2082, lng: 16.3738 }, // Viena, Áustria
  { lat: 55.7539, lng: 37.6208 }, // Moscou, Praça Vermelha
  { lat: 31.2001, lng: 29.9187 }, // Alexandria, Egito
  { lat: -34.6037, lng: -58.3816 }, // Buenos Aires, Argentina
  { lat: 37.9715, lng: 23.7267 }, // Atenas, Acrópole
  { lat: 30.0444, lng: 31.2357 }, // Cairo, Pirâmides
  { lat: 52.3676, lng: 4.9041 }, // Amsterdã, Países Baixos
];

/**
 * Seleciona uma localização aleatória
 * @returns {Object} Coordenadas {lat, lng}
 */
function getRandomLocation() {
  const index = Math.floor(Math.random() * PREDEFINED_LOCATIONS.length);
  return PREDEFINED_LOCATIONS[index];
}

/**
 * Gera URL para imagem do Street View
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} heading - Ângulo da visão (0-360)
 * @returns {string} URL da imagem
 */
function generateStreetViewImageUrl(lat, lng, heading) {
  return `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${lat},${lng}&heading=${heading}&pitch=0&key=${API_KEY}`;
}

/**
 * Calcula a distância entre dois pontos usando a fórmula de Haversine
 * @param {number} lat1 - Latitude do ponto 1
 * @param {number} lon1 - Longitude do ponto 1
 * @param {number} lat2 - Latitude do ponto 2
 * @param {number} lon2 - Longitude do ponto 2
 * @returns {number} Distância em metros
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

/**
 * Calcula a pontuação com base na distância
 * @param {number} distance - Distância em metros
 * @returns {number} Pontuação (0-100)
 */
function calculateScore(distance) {
  if (distance <= MIN_DISTANCE_PERFECT) {
    return 100;
  }
  
  if (distance >= MAX_DISTANCE_POINTS) {
    return 0;
  }
  
  // Escala logarítmica para a pontuação
  const score = 100 - (Math.log10(distance) - Math.log10(MIN_DISTANCE_PERFECT)) / 
                     (Math.log10(MAX_DISTANCE_POINTS) - Math.log10(MIN_DISTANCE_PERFECT)) * 100;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Inicia um novo jogo de Geoguesser
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function startGeoguesserGame(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'O Geoguesser só pode ser jogado em grupos.'
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
        return new ReturnMessage({
          chatId: groupId,
          content: `🌎 Já existe um jogo de Geoguesser em andamento! Tempo restante: ${timeRemaining} segundos.`
        });
      }
    }
    
    // Seleciona uma localização aleatória
    const location = getRandomLocation();
    
    // Cria o objeto do jogo
    activeGames[groupId] = {
      location,
      guesses: [],
      startTime: Date.now(),
      endTime: Date.now() + GAME_DURATION,
      mediaFiles: [] // Para armazenar os caminhos dos arquivos temporários
    };
    
    // Envia mensagem inicial
    await bot.sendMessage(groupId, '🌎 Iniciando jogo de Geoguesser! Adivinhe onde está esse lugar...');
    
    // Baixa e envia as imagens
    try {
      for (const angle of IMAGE_ANGLES) {
        const imageUrl = generateStreetViewImageUrl(location.lat, location.lng, angle);
        
        // Baixa a imagem
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);
        
        // Cria diretório temporário se não existir
        const tempDir = path.join(__dirname, '../../temp');
        await fs.mkdir(tempDir, { recursive: true });
        
        // Salva a imagem em um arquivo temporário
        const tempFile = path.join(tempDir, `geoguesser_${groupId}_${Date.now()}_${angle}.jpg`);
        await fs.writeFile(tempFile, imageBuffer);
        
        // Armazena o caminho do arquivo
        activeGames[groupId].mediaFiles.push(tempFile);
        
        // Cria objeto de mídia
        const media = new MessageMedia('image/jpeg', imageBuffer.toString('base64'));
        
        // Envia a imagem
        await bot.sendMessage(groupId, media, {
          caption: `📷 Vista ${angle}° do local`
        });
        
        // Pequeno atraso entre as imagens
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Envia instruções
      const instructions = '🔍 *Onde está esse lugar?*\n\n' +
                         '- Envie sua localização pelo WhatsApp ou\n' +
                         '- Use o comando !geoguess latitude longitude\n\n' +
                         'Você tem 5 minutos para adivinhar! Boa sorte!';
      
      await bot.sendMessage(groupId, instructions);
      
      // Configura o temporizador para finalizar o jogo
      setTimeout(async () => {
        if (activeGames[groupId]) {
          await endGame(bot, groupId);
        }
      }, GAME_DURATION);
      
      return null; // Retorna null porque já enviamos as mensagens
    } catch (error) {
      logger.error('Erro ao baixar/enviar imagens:', error);
      
      // Limpa o jogo em caso de erro
      delete activeGames[groupId];
      
      return new ReturnMessage({
        chatId: groupId,
        content: '❌ Erro ao iniciar o jogo de Geoguesser. Por favor, tente novamente.'
      });
    }
  } catch (error) {
    logger.error('Erro ao iniciar jogo de Geoguesser:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Erro ao iniciar o jogo de Geoguesser. Por favor, tente novamente.'
    });
  }
}

/**
 * Processa uma adivinhação de localização
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function makeGuess(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'O Geoguesser só pode ser jogado em grupos.'
      });
    }
    
    const groupId = message.group;
    const userId = message.author;
    
    // Obtém o nome do usuário
    let userName = message.authorName || "Jogador";
    
    // Verifica se há um jogo ativo
    if (!activeGames[groupId]) {
      return new ReturnMessage({
        chatId: groupId,
        content: '🌎 Não há um jogo de Geoguesser em andamento. Inicie um com !geoguesser'
      });
    }
    
    // Verifica se o jogo expirou
    if (Date.now() > activeGames[groupId].endTime) {
      await endGame(bot, groupId);
      return new ReturnMessage({
        chatId: groupId,
        content: '⏰ O tempo para esse jogo de Geoguesser acabou! Inicie um novo com !geoguesser'
      });
    }
    
    // Verifica argumentos (latitude e longitude)
    if (args.length < 2) {
      return new ReturnMessage({
        chatId: groupId,
        content: '❌ Formato incorreto. Use: !geoguess latitude longitude'
      });
    }
    
    // Extrai e valida latitude e longitude
    const lat = parseFloat(args[0]);
    const lng = parseFloat(args[1]);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return new ReturnMessage({
        chatId: groupId,
        content: '❌ Coordenadas inválidas. Latitude deve estar entre -90 e 90, e longitude entre -180 e 180.'
      });
    }
    
    // Calcula a distância
    const targetLocation = activeGames[groupId].location;
    const distance = calculateDistance(lat, lng, targetLocation.lat, targetLocation.lng);
    
    // Calcula a pontuação
    const score = calculateScore(distance);
    
    // Adiciona a adivinhação
    const guess = {
      userId,
      userName,
      lat,
      lng,
      distance,
      score,
      timestamp: Date.now()
    };
    
    // Verifica se o usuário já fez uma adivinhação
    const existingGuessIndex = activeGames[groupId].guesses.findIndex(g => g.userId === userId);
    
    if (existingGuessIndex !== -1) {
      // Atualiza a adivinhação existente se a nova for melhor
      if (score > activeGames[groupId].guesses[existingGuessIndex].score) {
        activeGames[groupId].guesses[existingGuessIndex] = guess;
        
        return new ReturnMessage({
          chatId: groupId,
          content: `🔄 ${userName} atualizou sua adivinhação para ${lat.toFixed(6)}, ${lng.toFixed(6)}.\nDistância: ${(distance/1000).toFixed(2)} km\nPontuação: ${score} pontos (melhor que sua tentativa anterior)`
        });
      } else {
        return new ReturnMessage({
          chatId: groupId,
          content: `⚠️ ${userName}, sua adivinhação anterior de ${activeGames[groupId].guesses[existingGuessIndex].score} pontos era melhor que esta (${score} pontos).`
        });
      }
    } else {
      // Adiciona nova adivinhação
      activeGames[groupId].guesses.push(guess);
      
      return new ReturnMessage({
        chatId: groupId,
        content: `✅ ${userName} adivinhou as coordenadas ${lat.toFixed(6)}, ${lng.toFixed(6)}.\nDistância: ${(distance/1000).toFixed(2)} km\nPontuação: ${score} pontos`
      });
    }
  } catch (error) {
    logger.error('Erro ao processar adivinhação:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Erro ao processar sua adivinhação. Por favor, tente novamente.'
    });
  }
}

/**
 * Finaliza um jogo de Geoguesser
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {string} groupId - ID do grupo
 */
async function endGame(bot, groupId) {
  try {
    if (!activeGames[groupId]) {
      return;
    }
    
    const game = activeGames[groupId];
    
    // Ordena as adivinhações pela pontuação (maior para menor)
    const sortedGuesses = [...game.guesses].sort((a, b) => b.score - a.score);
    
    // Prepara a mensagem de resultados
    let resultsMessage = '🏁 *Fim do jogo de Geoguesser!*\n\n';
    resultsMessage += `📍 Local correto: ${game.location.lat.toFixed(6)}, ${game.location.lng.toFixed(6)}\n\n`;
    
    // Adiciona o ranking
    if (sortedGuesses.length > 0) {
      resultsMessage += '*Ranking:*\n';
      
      sortedGuesses.forEach((guess, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        resultsMessage += `${medal} ${guess.userName}: ${guess.score} pontos (${(guess.distance/1000).toFixed(2)} km)\n`;
      });
      
      // Menciona o vencedor
      if (sortedGuesses.length > 0) {
        resultsMessage += `\n🏆 Parabéns a ${sortedGuesses[0].userName} pela melhor adivinhação!`;
      }
    } else {
      resultsMessage += 'Ninguém fez uma adivinhação nesta rodada. 😢';
    }
    
    // Envia mensagem com os resultados
    await bot.sendMessage(groupId, resultsMessage);
    
    // Cria e envia um mapa com a localização correta
    try {
      const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${game.location.lat},${game.location.lng}&zoom=13&size=600x400&markers=color:red%7C${game.location.lat},${game.location.lng}&key=${API_KEY}`;
      
      // Baixa a imagem do mapa
      const response = await axios.get(mapUrl, { responseType: 'arraybuffer' });
      const mapBuffer = Buffer.from(response.data);
      
      // Cria objeto de mídia
      const media = new MessageMedia('image/png', mapBuffer.toString('base64'));
      
      // Envia o mapa
      await bot.sendMessage(groupId, media, {
        caption: '🗺️ Localização correta'
      });
    } catch (mapError) {
      logger.error('Erro ao enviar mapa:', mapError);
      await bot.sendMessage(groupId, '⚠️ Não foi possível enviar o mapa da localização correta.');
    }
    
    // Limpa arquivos temporários
    for (const filePath of game.mediaFiles) {
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        logger.error(`Erro ao excluir arquivo temporário ${filePath}:`, unlinkError);
      }
    }
    
    // Salva os resultados do jogo no banco de dados
    try {
      // Obter histórico atual
      const customVariables = await database.getCustomVariables();
      
      // Inicializa array de histórico se não existir
      if (!customVariables.geoguesserHistory) {
        customVariables.geoguesserHistory = [];
      }
      
      // Limita o tamanho do histórico (mantém apenas os últimos 50 jogos)
      if (customVariables.geoguesserHistory.length >= 50) {
        customVariables.geoguesserHistory = customVariables.geoguesserHistory.slice(-49);
      }
      
      // Adiciona resultados do jogo ao histórico
      customVariables.geoguesserHistory.push({
        groupId,
        location: game.location,
        guesses: game.guesses,
        startTime: game.startTime,
        endTime: Date.now(),
        timestamp: Date.now()
      });
      
      // Salva variáveis atualizadas
      await database.saveCustomVariables(customVariables);
    } catch (dbError) {
      logger.error('Erro ao salvar resultados do jogo:', dbError);
    }
    
    // Remove o jogo da lista de ativos
    delete activeGames[groupId];
  } catch (error) {
    logger.error('Erro ao finalizar jogo:', error);
    
    // Garante que o jogo seja removido mesmo em caso de erro
    delete activeGames[groupId];
  }
}

/**
 * Processa uma localização enviada
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem formatada
 * @returns {Promise<ReturnMessage|null>} Mensagem de retorno ou null
 */
async function processLocationMessage(bot, message) {
  try {
    // Verifica se é uma mensagem de grupo
    if (!message.group) {
      return null;
    }
    
    const groupId = message.group;
    
    // Verifica se há um jogo ativo no grupo
    if (!activeGames[groupId]) {
      return null;
    }
    
    // Verifica se o jogo expirou
    if (Date.now() > activeGames[groupId].endTime) {
      await endGame(bot, groupId);
      return null;
    }
    
// Extrai as coordenadas da mensagem de localização
    let lat, lng;
    
    // Na mensagem original, a localização está em message.origin._data.lat/lng
    if (message.origin && message.origin._data && message.origin._data.lat && message.origin._data.lng) {
      lat = message.origin._data.lat;
      lng = message.origin._data.lng;
    } else if (message.content && typeof message.content === 'object') {
      // Alguns clientes podem enviar a localização em message.content
      lat = message.content.lat || message.content.latitude;
      lng = message.content.lng || message.content.longitude;
    }
    
    if (!lat || !lng) {
      return null; // Não é uma mensagem de localização válida
    }
    
    const userId = message.author;
    const userName = message.authorName || "Jogador";
    
    // Calcula a distância
    const targetLocation = activeGames[groupId].location;
    const distance = calculateDistance(lat, lng, targetLocation.lat, targetLocation.lng);
    
    // Calcula a pontuação
    const score = calculateScore(distance);
    
    // Cria objeto de adivinhação
    const guess = {
      userId,
      userName,
      lat,
      lng,
      distance,
      score,
      timestamp: Date.now()
    };
    
    // Verifica se o usuário já fez uma adivinhação
    const existingGuessIndex = activeGames[groupId].guesses.findIndex(g => g.userId === userId);
    
    if (existingGuessIndex !== -1) {
      // Atualiza a adivinhação existente se a nova for melhor
      if (score > activeGames[groupId].guesses[existingGuessIndex].score) {
        activeGames[groupId].guesses[existingGuessIndex] = guess;
        
        return new ReturnMessage({
          chatId: groupId,
          content: `🔄 ${userName} atualizou sua adivinhação usando localização.\nDistância: ${(distance/1000).toFixed(2)} km\nPontuação: ${score} pontos (melhor que sua tentativa anterior)`
        });
      } else {
        return new ReturnMessage({
          chatId: groupId,
          content: `⚠️ ${userName}, sua adivinhação anterior de ${activeGames[groupId].guesses[existingGuessIndex].score} pontos era melhor que esta (${score} pontos).`
        });
      }
    } else {
      // Adiciona nova adivinhação
      activeGames[groupId].guesses.push(guess);
      
      return new ReturnMessage({
        chatId: groupId,
        content: `✅ ${userName} adivinhou usando localização.\nDistância: ${(distance/1000).toFixed(2)} km\nPontuação: ${score} pontos`
      });
    }
  } catch (error) {
    logger.error('Erro ao processar mensagem de localização:', error);
    return null;
  }
}

/**
 * Mostra o status do jogo atual
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function showGameStatus(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'O Geoguesser só pode ser jogado em grupos.'
      });
    }
    
    const groupId = message.group;
    
    // Verifica se há um jogo ativo
    if (!activeGames[groupId]) {
      return new ReturnMessage({
        chatId: groupId,
        content: '🌎 Não há um jogo de Geoguesser em andamento. Inicie um com !geoguesser'
      });
    }
    
    // Verifica se o jogo expirou
    if (Date.now() > activeGames[groupId].endTime) {
      await endGame(bot, groupId);
      return new ReturnMessage({
        chatId: groupId,
        content: '⏰ O tempo para esse jogo de Geoguesser acabou! Inicie um novo com !geoguesser'
      });
    }
    
    // Calcula tempo restante
    const timeRemaining = Math.ceil((activeGames[groupId].endTime - Date.now()) / 1000);
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    // Prepara a mensagem de status
    let statusMessage = '🌎 *Status do jogo de Geoguesser*\n\n';
    statusMessage += `⏱️ Tempo restante: ${minutes}m ${seconds}s\n\n`;
    
    // Adiciona lista de participantes
    const guesses = activeGames[groupId].guesses;
    
    if (guesses.length > 0) {
      statusMessage += '*Adivinhações até agora:*\n';
      
      // Ordena as adivinhações pela pontuação (maior para menor)
      const sortedGuesses = [...guesses].sort((a, b) => b.score - a.score);
      
      sortedGuesses.forEach((guess, index) => {
        statusMessage += `${index + 1}. ${guess.userName}: ${guess.score} pontos\n`;
      });
    } else {
      statusMessage += 'Ainda ninguém fez uma adivinhação nesta rodada!';
    }
    
    return new ReturnMessage({
      chatId: groupId,
      content: statusMessage
    });
  } catch (error) {
    logger.error('Erro ao mostrar status do jogo:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Erro ao mostrar status do jogo. Por favor, tente novamente.'
    });
  }
}

/**
 * Mostra o histórico de jogos de Geoguesser
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function showGameHistory(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'O comando de histórico só pode ser usado em grupos.'
      });
    }
    
    const groupId = message.group;
    
    // Obtém o histórico
    const customVariables = await database.getCustomVariables();
    const allHistory = customVariables.geoguesserHistory || [];
    
    // Filtra apenas os jogos deste grupo
    const groupHistory = allHistory.filter(game => game.groupId === groupId);
    
    if (groupHistory.length === 0) {
      return new ReturnMessage({
        chatId: groupId,
        content: '📜 Ainda não há histórico de jogos de Geoguesser neste grupo.'
      });
    }
    
    // Limita a exibir apenas os 5 jogos mais recentes
    const recentGames = groupHistory.slice(-5).reverse();
    
    // Prepara a mensagem de histórico
    let historyMessage = '📜 *Histórico de Geoguesser*\n\n';
    
    recentGames.forEach((game, index) => {
      // Obtém a data formatada
      const gameDate = new Date(game.timestamp);
      const dateStr = gameDate.toLocaleString('pt-BR');
      
      historyMessage += `*Jogo ${index + 1}* - ${dateStr}\n`;
      
      // Adiciona o local
      historyMessage += `📍 ${game.location.lat.toFixed(6)}, ${game.location.lng.toFixed(6)}\n`;
      
      // Adiciona o vencedor se houver
      if (game.guesses && game.guesses.length > 0) {
        // Ordena as adivinhações pela pontuação (maior para menor)
        const sortedGuesses = [...game.guesses].sort((a, b) => b.score - a.score);
        
        historyMessage += `🏆 Vencedor: ${sortedGuesses[0].userName} (${sortedGuesses[0].score} pts)\n`;
      } else {
        historyMessage += `😢 Sem participantes\n`;
      }
      
      historyMessage += '\n';
    });
    
    historyMessage += `Total de jogos realizados neste grupo: ${groupHistory.length}`;
    
    return new ReturnMessage({
      chatId: groupId,
      content: historyMessage
    });
  } catch (error) {
    logger.error('Erro ao mostrar histórico de jogos:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Erro ao mostrar histórico de jogos. Por favor, tente novamente.'
    });
  }
}

// Registra pontos do geoguesser para um usuário
async function registerGeoguesserPoints(userId, userName, groupId, points) {
  try {
    // Obtém variáveis customizadas
    const customVariables = await database.getCustomVariables();
    
    // Inicializa classificação global se não existir
    if (!customVariables.geoguesserRanking) {
      customVariables.geoguesserRanking = {
        global: {},
        groups: {}
      };
    }
    
    // Inicializa rankings por grupo se não existir
    if (!customVariables.geoguesserRanking.groups[groupId]) {
      customVariables.geoguesserRanking.groups[groupId] = {};
    }
    
    // Atualiza pontos globais
    if (!customVariables.geoguesserRanking.global[userId]) {
      customVariables.geoguesserRanking.global[userId] = {
        name: userName,
        points: 0,
        games: 0,
        wins: 0
      };
    }
    
    customVariables.geoguesserRanking.global[userId].points += points;
    customVariables.geoguesserRanking.global[userId].games += 1;
    
    // Se obteve pontuação máxima (100), conta como vitória perfeita
    if (points === 100) {
      customVariables.geoguesserRanking.global[userId].wins += 1;
    }
    
    // Atualiza nome se mudou
    customVariables.geoguesserRanking.global[userId].name = userName;
    
    // Atualiza pontos do grupo
    if (!customVariables.geoguesserRanking.groups[groupId][userId]) {
      customVariables.geoguesserRanking.groups[groupId][userId] = {
        name: userName,
        points: 0,
        games: 0,
        wins: 0
      };
    }
    
    customVariables.geoguesserRanking.groups[groupId][userId].points += points;
    customVariables.geoguesserRanking.groups[groupId][userId].games += 1;
    
    // Se obteve pontuação máxima (100), conta como vitória perfeita
    if (points === 100) {
      customVariables.geoguesserRanking.groups[groupId][userId].wins += 1;
    }
    
    // Atualiza nome se mudou
    customVariables.geoguesserRanking.groups[groupId][userId].name = userName;
    
    // Salva variáveis atualizadas
    await database.saveCustomVariables(customVariables);
    
    return true;
  } catch (error) {
    logger.error('Erro ao registrar pontos de Geoguesser:', error);
    return false;
  }
}

/**
 * Mostra o ranking global de Geoguesser
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function showGeoguesserRanking(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Obtém as variáveis customizadas
    const customVariables = await database.getCustomVariables();
    
    // Verifica se existe ranking
    if (!customVariables.geoguesserRanking) {
      return new ReturnMessage({
        chatId,
        content: '🏆 Ainda não há ranking de Geoguesser. Jogue algumas partidas!'
      });
    }
    
    // Determina qual ranking mostrar (global ou do grupo)
    const showGlobal = args[0] === 'global' || !message.group;
    const rankingData = showGlobal 
      ? customVariables.geoguesserRanking.global 
      : (customVariables.geoguesserRanking.groups[message.group] || {});
    
    // Converte para array para poder ordenar
    const players = Object.entries(rankingData).map(([id, data]) => ({
      id,
      ...data
    }));
    
    // Verifica se há jogadores
    if (players.length === 0) {
      return new ReturnMessage({
        chatId,
        content: showGlobal 
          ? '🏆 Ainda não há jogadores no ranking global. Jogue algumas partidas!'
          : '🏆 Ainda não há jogadores no ranking deste grupo. Jogue algumas partidas!'
      });
    }
    
    // Ordena por pontos (maior para menor)
    players.sort((a, b) => b.points - a.points);
    
    // Limita a 10 jogadores
    const topPlayers = players.slice(0, 10);
    
    // Prepara a mensagem de ranking
    let rankingMessage = `🏆 *Ranking de Geoguesser ${showGlobal ? 'Global' : 'do Grupo'}*\n\n`;
    
    topPlayers.forEach((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const avgPoints = player.games > 0 ? (player.points / player.games).toFixed(1) : '0.0';
      
      rankingMessage += `${medal} ${player.name}: ${player.points} pts (${player.games} jogos, média: ${avgPoints}, vitórias perfeitas: ${player.wins})\n`;
    });
    
    // Adiciona instruções para ver outro ranking
    if (message.group) {
      rankingMessage += `\nUse "!georanking global" para ver o ranking global`;
    } else {
      rankingMessage += `\nEste é o ranking global. Use o comando em um grupo para ver o ranking específico.`;
    }
    
    return new ReturnMessage({
      chatId,
      content: rankingMessage
    });
  } catch (error) {
    logger.error('Erro ao mostrar ranking de Geoguesser:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Erro ao mostrar ranking. Por favor, tente novamente.'
    });
  }
}

// Criar array de comandos usando a classe Command
const commands = [
  new Command({
    name: 'geoguesser',
    description: 'Inicia um jogo de adivinhação de localização',
    category: "jogos",
    cooldown: 300, // 5 minutos
    reactions: {
      before: "🌎",
      after: "🔍",
      error: "❌"
    },
    method: startGeoguesserGame
  }),
  
  new Command({
    name: 'geoguess',
    description: 'Envia uma adivinhação para o jogo atual',
    category: "jogos",
    hidden: true,
    cooldown: 0,
    reactions: {
      before: "🧐",
      after: "📍",
      error: "❌"
    },
    method: makeGuess
  }),
  
  new Command({
    name: 'geostatus',
    description: 'Mostra o status do jogo atual',
    category: "jogos",
    hidden: true,
    cooldown: 10,
    reactions: {
      after: "ℹ️",
      error: "❌"
    },
    method: showGameStatus
  }),
  
  new Command({
    name: 'geohistory',
    description: 'Mostra o histórico de jogos',
    category: "jogos",
    hidden: true,
    cooldown: 30,
    reactions: {
      after: "📜",
      error: "❌"
    },
    method: showGameHistory
  }),
  
  new Command({
    name: 'geo-ranking',
    description: 'Mostra o ranking de jogadores',
    category: "jogos",
    cooldown: 30,
    reactions: {
      after: "🏆",
      error: "❌"
    },
    method: showGeoguesserRanking
  })
];

//module.exports = { commands, processLocationMessage };