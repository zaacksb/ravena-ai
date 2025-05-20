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
const IMAGE_ANGLES = [0, 120, 240]; // Ângulos para StreetView
const MIN_DISTANCE_PERFECT = 500; // 500 metros ou menos = 100 pontos
const MAX_DISTANCE_POINTS = 500000; // 500 km ou mais = 0 pontos
const BRAZIL_BOUNDS = {
  minLat: -33.75,
  maxLat: 5.27,
  minLng: -73.99,
  maxLng: -34.79,
};
const PLACE_TYPES = [
  'tourist_attraction',
  'gas_station',
  'restaurant',
  'school',
  'park',
  'cafe',
  'shopping_mall',
  'museum',
  'church',
];
const EMOJIS_LOCAL = {
  school: "🏫",
  restaurant: "🍽️",
  cafe: "☕",
  gas_station: "⛽",
  park: "🏞️",
  museum: "🏛️",
  church: "⛪",
  shopping_mall: "🛍️",
  tourist_attraction: "📸"
};


// API Key - Deve ser configurada no .env como GOOGLE_MAPS_API_KEY
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Armazena os jogos ativos
const activeGames = {};

function getRandomCoordinate(bounds) {
  const lat = Math.random() * (bounds.maxLat - bounds.minLat) + bounds.minLat;
  const lng = Math.random() * (bounds.maxLng - bounds.minLng) + bounds.minLng;
  return { lat, lng };
}

function getRandomPlaceType() {
  const index = Math.floor(Math.random() * PLACE_TYPES.length);
  return PLACE_TYPES[index];
}

async function getRandomPlaceInBrazil() {
  const location = getRandomCoordinate(BRAZIL_BOUNDS);
  const type = getRandomPlaceType();
  const radius = 50000; // meters

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&type=${type}&key=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status === 'OK' && data.results.length > 0) {
    const randomResult = data.results[Math.floor(Math.random() * data.results.length)];
    return {
      name: randomResult.name,
      location: randomResult.geometry.location,
      type,
    };
  } else {
    console.warn('No places found, retrying...');
    return getRandomPlaceInBrazil(); // try again recursively
  }
}

async function getStreetViewImagesFromPlace(place) {
  const { lat, lng } = place.location;

  // First, check if Street View exists nearby
  const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=5000&key=${API_KEY}`;
  const metadataRes = await fetch(metadataUrl);
  const metadata = await metadataRes.json();

  if (metadata.status !== 'OK') {
    return null;
  }

  // Create Street View image URLs for multiple angles
  const streetViewImages = IMAGE_ANGLES.map((heading) => {
    return {
      heading,
      url: `https://maps.googleapis.com/maps/api/streetview?size=640x640&location=${lat},${lng}&fov=90&heading=${heading}&pitch=0&key=${API_KEY}`
    };
  });

  // Create Static Map URL with pin and info
  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=640x640&maptype=roadmap&markers=color:red%7Clabel:P%7C${lat},${lng}&key=${API_KEY}`;

  return {
    placeName: place.name,
    placeType: place.type,
    location: { lat, lng },
    streetViewImages,
    staticMapUrl
  };
}

async function getRandomStreetViewInBrazil(retries = 0) {
  if(retries > 10){
    return false;
  }

  logger.info(`[getRandomStreetViewInBrazil] ${retries}/10`);
  const place = await getRandomPlaceInBrazil();
  const placeStreetView =  await getStreetViewImagesFromPlace(place);

  if(placeStreetView){
    return placeStreetView;
  } else {
    logger.info(`[getRandomStreetViewInBrazil] No street view, trying again`);
    return getRandomStreetViewInBrazil(retries+1);
  }
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
  const chatId = message.group || message.author;

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
          content: `🌎 Já existe um jogo de Geoguesser em andamento neste grupo! Tempo restante: ${timeRemaining} segundos.`
        });
      }
    }
    
    
    // Envia mensagem inicial
    const returnMessages = [new ReturnMessage({chatId: chatId, content: "🌎 *Inicializando _Geoguesser_*, aguarde as imagens! ⏳"})];
    try{

      const localRandom = await getRandomStreetViewInBrazil();
      const localEmoji = EMOJIS_LOCAL[localRandom.placeType] ?? "📍";

      // Cria o objeto do jogo
      activeGames[groupId] = {
        location: localRandom.location,
        mapUrl: localRandom.staticMapUrl,
        locationInfo: `${localEmoji} ${localRandom.placeName}`,
        guesses: [],
        startTime: Date.now(),
        endTime: Date.now() + GAME_DURATION
      };


      for(let img of localRandom.streetViewImages){
        const media = await bot.createMediaFromURL(img.url);

        returnMessages.push(new ReturnMessage({
          chatId: chatId,
          content: media,
          options: {
            // caption: `📷 Vista ${angle}° do local`, // Sem caption pra ficar organizado
            quotedMessageId: message.origin.id._serialized
          }
        }));

      }

      // Envia instruções
      const instructions = '🌎 *Onde está esse lugar?* 🔍\n\n' +
                         '- Envie sua localização pelo WhatsApp ou\n' +
                         '- !geoguess latitude longitude\n\n' +
                         'Vocês tem *5 minutos* para adivinhar!';
      
      returnMessages.push(new ReturnMessage({
        chatId: chatId,
        content: instructions,
        options: {
          quotedMessageId: message.origin.id._serialized
        },
        delay: 1000
      }));

      // Configura o temporizador para finalizar o jogo
      setTimeout(async () => {
        if (activeGames[groupId]) {
          await endGame(bot, groupId);
        }
      }, GAME_DURATION);
      
      return returnMessages;
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
      // Baixa a imagem do mapa
      const mapMedia = await bot.createMediaFromURL(game.mapUrl);
      // Envia o mapa
      await bot.sendMessage(groupId, mapMedia,{
        caption: `🗺️ Localização correta\n\n_${game.locationInfo}_`
      });
    } catch (mapError) {
      logger.error('Erro ao enviar mapa:', mapError);
      await bot.sendMessage(groupId, '⚠️ Não foi possível enviar o mapa da localização correta.');
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
    //await database.saveCustomVariables(customVariables);
    
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

module.exports = { commands, processLocationMessage };